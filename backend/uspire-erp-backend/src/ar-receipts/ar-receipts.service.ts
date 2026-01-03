import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { SetReceiptAllocationsDto } from './dto/set-receipt-allocations.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';

type ReceiptStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

@Injectable()
export class ArReceiptsService {
  private readonly RECEIPT_NUMBER_SEQUENCE_NAME = 'AR_RECEIPT_NUMBER';
  private readonly OPENING_PERIOD_NAME = 'Opening Balances';

  constructor(private readonly prisma: PrismaService) {}

  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  private normalizeMoney(n: number) {
    return this.round2(Number(n ?? 0));
  }

  private escapeHtml(s: any) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatMoney(n: any) {
    const v = Number(n ?? 0);
    const fixed = this.round2(v).toFixed(2);
    const [a, b] = fixed.split('.');
    const withCommas = a.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${withCommas}.${b}`;
  }

  private ensurePdfKit() {
    let PDFDocument: any;
    try {
      PDFDocument = require('pdfkit');
    } catch {
      throw new BadRequestException(
        'PDF export not available (missing dependency pdfkit)',
      );
    }
    return PDFDocument;
  }

  private parseReference(dto: { paymentReference?: any; reference?: any }) {
    const a =
      dto.paymentReference === undefined
        ? undefined
        : String(dto.paymentReference ?? '').trim();
    const b =
      dto.reference === undefined
        ? undefined
        : String(dto.reference ?? '').trim();

    if (a && b && a !== b) {
      throw new BadRequestException(
        'Provide either paymentReference or reference (alias), not both with different values',
      );
    }

    const merged = (b ?? a ?? '').trim();
    return merged ? merged : null;
  }

  private async validateAndNormalizeHeader(params: {
    tenantId: string;
    currency: string;
    exchangeRate?: number | null;
    totalAmount: number;
  }) {
    const amount = this.normalizeMoney(params.totalAmount);
    if (!(amount > 0)) {
      throw new BadRequestException('Receipt totalAmount must be > 0');
    }

    const receiptCurrency = String(params.currency ?? '').trim();
    if (!receiptCurrency) {
      throw new BadRequestException('Receipt currency is required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { id: true, defaultCurrency: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const baseCurrency = String(tenant.defaultCurrency ?? '').trim();
    if (!baseCurrency) {
      throw new BadRequestException('Tenant defaultCurrency is not configured');
    }

    const nextExchangeRate =
      params.exchangeRate === null || params.exchangeRate === undefined
        ? null
        : Number(params.exchangeRate);

    if (receiptCurrency === baseCurrency) {
      if (nextExchangeRate !== null && !(Number(nextExchangeRate) === 1)) {
        throw new BadRequestException(
          'exchangeRate must be 1 when receipt currency equals base currency',
        );
      }
      return { amount, receiptCurrency, exchangeRate: 1, baseCurrency };
    }

    if (nextExchangeRate === null || !(Number(nextExchangeRate) > 0)) {
      throw new BadRequestException(
        'exchangeRate is required and must be > 0 when currency differs from base currency',
      );
    }

    return {
      amount,
      receiptCurrency,
      exchangeRate: Number(nextExchangeRate),
      baseCurrency,
    };
  }

  private ensureTenant(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');
    return tenant;
  }

  private ensureUser(req: Request) {
    const user = req.user;
    if (!user) throw new BadRequestException('Missing user context');
    return user;
  }

  private async assertEditable(receiptId: string, tenantId: string) {
    const r = await (this.prisma as any).customerReceipt.findFirst({
      where: { id: receiptId, tenantId },
      select: { id: true, status: true },
    });
    if (!r) throw new NotFoundException('Receipt not found');
    if (r.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT receipts can be edited');
    }
    return r;
  }

  private async nextReceiptNumber(tx: any, tenantId: string) {
    const counter = await tx.tenantSequenceCounter.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: this.RECEIPT_NUMBER_SEQUENCE_NAME,
        },
      },
      create: {
        tenantId,
        name: this.RECEIPT_NUMBER_SEQUENCE_NAME,
        value: 0,
      },
      update: {},
      select: { id: true },
    });

    const bumped = await tx.tenantSequenceCounter.update({
      where: { id: counter.id },
      data: { value: { increment: 1 } },
      select: { value: true },
    });

    return `RCPT-${String(bumped.value).padStart(6, '0')}`;
  }

  private async validateLines(params: {
    tenantId: string;
    customerId: string;
    receiptCurrency: string;
    totalAmount: number;
    lines?: Array<{ invoiceId: string; appliedAmount: number }>;
    receiptIdForUpdate?: string;
  }) {
    const lines = params.lines ?? [];

    for (const l of lines) {
      if (!l.invoiceId) {
        throw new BadRequestException('Receipt line missing invoiceId');
      }
      if (this.normalizeMoney(l.appliedAmount) < 0) {
        throw new BadRequestException(
          'Receipt line appliedAmount must be >= 0',
        );
      }
    }

    const appliedTotal = this.normalizeMoney(
      lines.reduce((s, l) => s + this.normalizeMoney(l.appliedAmount), 0),
    );
    const receiptTotal = this.normalizeMoney(params.totalAmount);

    if (appliedTotal > receiptTotal) {
      throw new BadRequestException({
        error: 'Applied total cannot exceed receipt totalAmount',
        appliedTotal,
        totalAmount: receiptTotal,
      });
    }

    if (lines.length > 0) {
      const invoiceIds = [...new Set(lines.map((l) => l.invoiceId))];

      const invoices = await this.prisma.customerInvoice.findMany({
        where: {
          tenantId: params.tenantId,
          customerId: params.customerId,
          id: { in: invoiceIds },
          status: 'POSTED',
        },
        select: {
          id: true,
          totalAmount: true,
          status: true,
          currency: true,
        } as any,
      });

      if (invoices.length !== invoiceIds.length) {
        throw new BadRequestException(
          'One or more invoices not found / not POSTED for customer / tenant',
        );
      }

      for (const inv of invoices) {
        const invCurrency = String((inv as any).currency ?? '').trim();
        if (!invCurrency) {
          throw new BadRequestException({
            error: 'Invoice currency missing; cannot allocate',
            invoiceId: inv.id,
          });
        }
        if (invCurrency !== params.receiptCurrency) {
          throw new BadRequestException({
            error: 'Receipt currency must match invoice currency',
            receiptCurrency: params.receiptCurrency,
            invoiceId: inv.id,
            invoiceCurrency: invCurrency,
          });
        }
      }

      const existingApplied = await (
        this.prisma as any
      ).customerReceiptLine.groupBy({
        by: ['invoiceId'],
        where: {
          tenantId: params.tenantId,
          invoiceId: { in: invoiceIds },
          receipt: {
            tenantId: params.tenantId,
            status: 'POSTED',
          },
          ...(params.receiptIdForUpdate
            ? { receiptId: { not: params.receiptIdForUpdate } }
            : {}),
        } as any,
        _sum: { appliedAmount: true },
      });
      const appliedByInvoiceId = new Map(
        (existingApplied ?? []).map((g: any) => [
          g.invoiceId,
          Number(g._sum?.appliedAmount ?? 0),
        ]),
      );

      const invById = new Map(invoices.map((i: any) => [i.id, i] as const));
      for (const l of lines) {
        const inv = invById.get(l.invoiceId);
        const alreadyApplied = this.normalizeMoney(
          Number(appliedByInvoiceId.get(l.invoiceId) ?? 0),
        );
        const invoiceTotal = this.normalizeMoney(Number(inv?.totalAmount ?? 0));
        const openBalance = this.normalizeMoney(invoiceTotal - alreadyApplied);
        const nextApplied = this.normalizeMoney(l.appliedAmount);

        if (openBalance <= 0 && nextApplied > 0) {
          throw new BadRequestException({
            error: 'Invoice is fully settled; cannot allocate',
            invoiceId: l.invoiceId,
            invoiceTotal,
            alreadyApplied,
          });
        }
        if (nextApplied > openBalance) {
          throw new BadRequestException({
            error: 'Allocation exceeds invoice open balance',
            invoiceId: l.invoiceId,
            appliedAmount: nextApplied,
            invoiceTotal,
            alreadyApplied,
            openBalance,
          });
        }
      }
    }
  }

  async listAllocations(req: Request, receiptId: string) {
    const tenant = this.ensureTenant(req);
    const r = await (this.prisma as any).customerReceipt.findFirst({
      where: { id: receiptId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!r) throw new NotFoundException('Receipt not found');

    const lines = await (this.prisma as any).customerReceiptLine.findMany({
      where: { receiptId },
      include: { invoice: true },
      orderBy: [{ createdAt: 'asc' }],
    });

    return {
      receiptId,
      lines: (lines ?? []).map((l: any) => ({
        id: l.id,
        invoiceId: l.invoiceId,
        invoiceNumber: l.invoice?.invoiceNumber ?? '',
        invoiceDate: l.invoice?.invoiceDate
          ? new Date(l.invoice.invoiceDate).toISOString().slice(0, 10)
          : null,
        invoiceTotalAmount: l.invoice ? Number(l.invoice.totalAmount) : null,
        currency: l.invoice?.currency ?? null,
        appliedAmount: Number(l.appliedAmount),
        createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : null,
      })),
    };
  }

  async setAllocations(
    req: Request,
    receiptId: string,
    dto: SetReceiptAllocationsDto,
  ) {
    const tenant = this.ensureTenant(req);

    await this.assertEditable(receiptId, tenant.id);

    const receipt = await (this.prisma as any).customerReceipt.findFirst({
      where: { id: receiptId, tenantId: tenant.id },
      select: {
        id: true,
        customerId: true,
        currency: true,
        totalAmount: true,
        status: true,
      },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');

    await this.validateLines({
      tenantId: tenant.id,
      customerId: receipt.customerId,
      receiptCurrency: String(receipt.currency),
      totalAmount: Number(receipt.totalAmount),
      lines: dto.lines,
      receiptIdForUpdate: receiptId,
    });

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).customerReceiptLine.deleteMany({
        where: { receiptId },
      });

      const lines = dto.lines ?? [];
      if (lines.length > 0) {
        await (tx as any).customerReceiptLine.createMany({
          data: lines.map((l) => ({
            tenantId: tenant.id,
            receiptId,
            invoiceId: l.invoiceId,
            appliedAmount: l.appliedAmount,
          })),
        });
      }
    });

    return this.listAllocations(req, receiptId);
  }

  async listReceipts(req: Request) {
    const tenant = this.ensureTenant(req);

    const rows = await (this.prisma as any).customerReceipt.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ receiptDate: 'desc' }, { receiptNumber: 'desc' }],
      include: { customer: true },
    });

    return rows.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      receiptDate: r.receiptDate.toISOString().slice(0, 10),
      customerId: r.customerId,
      customerName: r.customer?.name ?? '',
      currency: r.currency,
      exchangeRate: Number(r.exchangeRate ?? 1),
      totalAmount: Number(r.totalAmount),
      paymentMethod: r.paymentMethod,
      paymentReference: r.paymentReference,
      reference: r.paymentReference,
      status: r.status,
      glJournalId: r.glJournalId ?? null,
      createdAt: r.createdAt.toISOString(),
      postedAt: r.postedAt?.toISOString() ?? null,
      voidedAt: r.voidedAt?.toISOString() ?? null,
    }));
  }

  async getReceiptById(req: Request, id: string) {
    const tenant = this.ensureTenant(req);

    const r = await (this.prisma as any).customerReceipt.findFirst({
      where: { id, tenantId: tenant.id },
      include: { customer: true, lines: { include: { invoice: true } } },
    });
    if (!r) throw new NotFoundException('Receipt not found');

    return {
      id: r.id,
      receiptNumber: r.receiptNumber,
      receiptDate: r.receiptDate.toISOString().slice(0, 10),
      customerId: r.customerId,
      customerName: r.customer?.name ?? '',
      currency: r.currency,
      exchangeRate: Number(r.exchangeRate ?? 1),
      totalAmount: Number(r.totalAmount),
      paymentMethod: r.paymentMethod,
      paymentReference: r.paymentReference,
      reference: r.paymentReference,
      status: r.status,
      glJournalId: r.glJournalId ?? null,
      createdAt: r.createdAt.toISOString(),
      postedAt: r.postedAt?.toISOString() ?? null,
      postedById: r.postedById ?? null,
      voidedAt: r.voidedAt?.toISOString() ?? null,
      voidReason: r.voidReason ?? null,
      lines: r.lines.map((l) => ({
        id: l.id,
        invoiceId: l.invoiceId,
        invoiceNumber: l.invoice?.invoiceNumber ?? '',
        appliedAmount: Number(l.appliedAmount),
      })),
    };
  }

  async listCustomerOutstandingInvoices(
    req: Request,
    customerId: string,
    currency?: string,
  ) {
    const tenant = this.ensureTenant(req);

    const customer = await (this.prisma as any).customer.findFirst({
      where: { id: customerId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const where: any = {
      tenantId: tenant.id,
      customerId,
      status: 'POSTED',
    };
    if (currency) {
      const c = String(currency ?? '').trim();
      if (c) where.currency = c;
    }

    const invoices = await this.prisma.customerInvoice.findMany({
      where,
      orderBy: [{ invoiceDate: 'desc' }, { invoiceNumber: 'desc' }],
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        totalAmount: true,
        currency: true,
      } as any,
    });

    if ((invoices ?? []).length === 0) {
      return { customerId, currency: currency ?? null, invoices: [] };
    }

    const invoiceIds = invoices.map((i: any) => i.id);
    const existingApplied = await (
      this.prisma as any
    ).customerReceiptLine.groupBy({
      by: ['invoiceId'],
      where: {
        tenantId: tenant.id,
        invoiceId: { in: invoiceIds },
        receipt: { tenantId: tenant.id, status: 'POSTED' },
      } as any,
      _sum: { appliedAmount: true },
    });
    const appliedByInvoiceId = new Map(
      (existingApplied ?? []).map((g: any) => [
        g.invoiceId,
        this.normalizeMoney(Number(g._sum?.appliedAmount ?? 0)),
      ]),
    );

    const rows = (invoices ?? [])
      .map((inv: any) => {
        const total = this.normalizeMoney(Number(inv.totalAmount ?? 0));
        const applied = this.normalizeMoney(
          Number(appliedByInvoiceId.get(inv.id) ?? 0),
        );
        const outstanding = this.normalizeMoney(total - applied);
        return {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber ?? '',
          invoiceDate: inv.invoiceDate
            ? new Date(inv.invoiceDate).toISOString().slice(0, 10)
            : null,
          dueDate: inv.dueDate
            ? new Date(inv.dueDate).toISOString().slice(0, 10)
            : null,
          currency: inv.currency ?? null,
          totalAmount: total,
          outstandingAmount: outstanding,
        };
      })
      .filter((r: any) => this.normalizeMoney(Number(r.outstandingAmount)) > 0);

    return { customerId, currency: currency ?? null, invoices: rows };
  }

  async exportReceipt(
    req: Request,
    id: string,
    opts: { format: 'html' | 'pdf' },
  ) {
    const tenant = this.ensureTenant(req);

    const [t, r] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: {
          id: true,
          legalName: true,
          organisationName: true,
          defaultCurrency: true,
        },
      }),
      (this.prisma as any).customerReceipt.findFirst({
        where: { id, tenantId: tenant.id },
        include: { customer: true, lines: { include: { invoice: true } } },
      }),
    ]);

    if (!t) throw new NotFoundException('Tenant not found');
    if (!r) throw new NotFoundException('Receipt not found');
    if (String(r.status ?? '') !== 'POSTED') {
      throw new BadRequestException(
        'Receipt export is available for POSTED receipts only',
      );
    }

    const tenantName = String(
      (t as any).legalName ?? (t as any).organisationName ?? '',
    ).trim();
    const baseCurrency = String((t as any).defaultCurrency ?? '').trim();
    const receiptNumber = String(r.receiptNumber ?? '').trim();
    const receiptDate = r.receiptDate
      ? new Date(r.receiptDate).toISOString().slice(0, 10)
      : '';
    const currency = String(r.currency ?? '').trim();
    const exchangeRate = Number(r.exchangeRate ?? 1);
    const receiptAmount = this.normalizeMoney(Number(r.totalAmount ?? 0));
    const paymentMethod = String(r.paymentMethod ?? '').trim();
    const reference = String(r.paymentReference ?? '').trim();

    const customerName = String(r.customer?.name ?? '').trim();
    const customerEmail = String(r.customer?.email ?? '').trim();
    const customerPhone = String(r.customer?.phone ?? '').trim();
    const customerAddress = String(r.customer?.billingAddress ?? '').trim();

    const linesRaw = (r.lines ?? []) as any[];
    const receiptLines = linesRaw
      .map((l: any) => ({
        invoiceId: l.invoiceId,
        invoiceNumber: String(l.invoice?.invoiceNumber ?? '').trim(),
        invoiceDate: l.invoice?.invoiceDate
          ? new Date(l.invoice.invoiceDate).toISOString().slice(0, 10)
          : null,
        dueDate: l.invoice?.dueDate
          ? new Date(l.invoice.dueDate).toISOString().slice(0, 10)
          : null,
        invoiceTotalAmount: this.normalizeMoney(
          Number(l.invoice?.totalAmount ?? 0),
        ),
        appliedAmount: this.normalizeMoney(Number(l.appliedAmount ?? 0)),
      }))
      .filter((l) => l.appliedAmount > 0);

    const invoiceIds = [...new Set(receiptLines.map((l) => l.invoiceId))];

    const appliedAll = invoiceIds.length
      ? await (this.prisma as any).customerReceiptLine.groupBy({
          by: ['invoiceId'],
          where: {
            tenantId: tenant.id,
            invoiceId: { in: invoiceIds },
            receipt: {
              tenantId: tenant.id,
              status: 'POSTED',
            },
          } as any,
          _sum: { appliedAmount: true },
        })
      : [];

    const appliedAllByInvoiceId = new Map(
      (appliedAll ?? []).map((g: any) => [
        g.invoiceId,
        this.normalizeMoney(Number(g._sum?.appliedAmount ?? 0)),
      ]),
    );

    const appliedTotal = this.normalizeMoney(
      receiptLines.reduce(
        (s, l) => s + this.normalizeMoney(l.appliedAmount),
        0,
      ),
    );
    const unappliedTotal = this.normalizeMoney(receiptAmount - appliedTotal);

    const allocRows = receiptLines.map((l) => {
      const appliedIncl = this.normalizeMoney(
        Number(appliedAllByInvoiceId.get(l.invoiceId) ?? 0),
      );
      const balanceAfter = this.normalizeMoney(
        l.invoiceTotalAmount - appliedIncl,
      );
      return {
        ...l,
        balanceAfter,
      };
    });

    const showExchange =
      !!currency && !!baseCurrency && currency !== baseCurrency;

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${this.escapeHtml(receiptNumber)}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; color: #0B0C1E; margin: 32px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
      .brand h1 { margin: 0; font-size: 22px; }
      .muted { color: #667085; font-size: 12px; }
      .block { margin-top: 18px; }
      .row { display: flex; gap: 16px; }
      .card { border: 1px solid #E4E7EC; border-radius: 10px; padding: 14px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border-bottom: 1px solid #E4E7EC; padding: 10px 8px; font-size: 13px; }
      th { text-align: left; background: #F9FAFB; }
      td.num, th.num { text-align: right; }
      .totals { width: 340px; margin-left: auto; }
      .totals .line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
      .totals .grand { font-weight: 700; border-top: 1px solid #E4E7EC; margin-top: 8px; padding-top: 10px; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="brand">
        <h1>${this.escapeHtml(tenantName || 'USPIRE PROFESSIONAL SERVICES')}</h1>
        <div class="muted">Prepared in accordance with IFRS</div>
      </div>
      <div class="card" style="min-width: 300px;">
        <div style="font-weight:700; font-size: 18px;">RECEIPT</div>
        <div style="margin-top:8px;"><b>Receipt Number:</b> ${this.escapeHtml(receiptNumber)}</div>
        <div><b>Date:</b> ${this.escapeHtml(receiptDate)}</div>
        <div><b>Currency:</b> ${this.escapeHtml(currency)}</div>
        ${showExchange ? `<div><b>Exchange Rate:</b> ${this.escapeHtml(String(exchangeRate))}</div>` : ''}
      </div>
    </div>

    <div class="row block">
      <div class="card" style="flex:1;">
        <div style="font-weight:700; margin-bottom:6px;">Received From</div>
        <div>${this.escapeHtml(customerName)}</div>
        ${customerEmail ? `<div class="muted">${this.escapeHtml(customerEmail)}</div>` : ''}
        ${customerPhone ? `<div class="muted">${this.escapeHtml(customerPhone)}</div>` : ''}
        ${customerAddress ? `<div class="muted" style="margin-top:6px; white-space:pre-wrap;">${this.escapeHtml(customerAddress)}</div>` : ''}
      </div>
      <div class="card" style="min-width:300px;">
        <div style="font-weight:700; margin-bottom:6px;">Payment Details</div>
        <div><b>Payment Method:</b> ${this.escapeHtml(paymentMethod)}</div>
        ${reference ? `<div><b>Reference:</b> ${this.escapeHtml(reference)}</div>` : ''}
      </div>
    </div>

    <div class="block">
      <table>
        <thead>
          <tr>
            <th style="width: 140px;">Invoice #</th>
            <th style="width: 110px;">Invoice Date</th>
            <th style="width: 110px;">Due Date</th>
            <th class="num" style="width: 140px;">Invoice Total</th>
            <th class="num" style="width: 140px;">Amount Applied</th>
            <th class="num" style="width: 140px;">Balance After</th>
          </tr>
        </thead>
        <tbody>
          ${allocRows
            .map(
              (l: any) => `<tr>
              <td>${this.escapeHtml(l.invoiceNumber)}</td>
              <td>${this.escapeHtml(l.invoiceDate ?? '')}</td>
              <td>${this.escapeHtml(l.dueDate ?? '')}</td>
              <td class="num">${this.formatMoney(l.invoiceTotalAmount)}</td>
              <td class="num">${this.formatMoney(l.appliedAmount)}</td>
              <td class="num">${this.formatMoney(l.balanceAfter)}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="line"><span>Receipt Amount</span><span>${this.formatMoney(receiptAmount)}</span></div>
        <div class="line"><span>Applied Total</span><span>${this.formatMoney(appliedTotal)}</span></div>
        ${unappliedTotal > 0 ? `<div class="line"><span>Unapplied Total</span><span>${this.formatMoney(unappliedTotal)}</span></div>` : ''}
        <div class="line grand"><span>Total</span><span>${this.formatMoney(receiptAmount)}</span></div>
      </div>
    </div>

    <div class="block">
      <div class="card">
        <div style="font-weight:700;">Bank Details</div>
        <div class="muted" style="margin-top:6px;">
          Bank Name: FNB<br/>
          Account Name: Uspire Professional Services Ltd<br/>
          Account Number: 63144493680<br/>
          Branch Name/Number: Commercial Suite / 260001<br/>
          Swift Code: FIRNZMLX
        </div>
      </div>
    </div>
  </body>
</html>`;

    if (opts.format === 'html') {
      return {
        contentType: 'text/html; charset=utf-8',
        fileName: `Receipt_${receiptNumber || id}.html`,
        body: html,
      };
    }

    const PDFDocument = this.ensurePdfKit();
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks: Buffer[] = [];
    doc.on('data', (d: any) => chunks.push(Buffer.from(d)));

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const page = {
      left: doc.page.margins.left,
      right: doc.page.margins.right,
      top: doc.page.margins.top,
      bottom: doc.page.margins.bottom,
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      yMax: doc.page.height - doc.page.margins.bottom,
    };

    const colors = {
      text: '#0B0C1E',
      muted: '#667085',
      border: '#E4E7EC',
      headerBg: '#F9FAFB',
    };

    const ensureSpace = (minHeight: number, onNewPage?: () => void) => {
      if (doc.y + minHeight <= page.yMax) return;
      doc.addPage();
      if (onNewPage) onNewPage();
    };

    const drawDivider = () => {
      doc.save();
      doc.strokeColor(colors.border);
      doc
        .moveTo(page.left, doc.y)
        .lineTo(page.left + page.width, doc.y)
        .stroke();
      doc.restore();
    };

    const labelValue = (
      label: string,
      value: string,
      x: number,
      y: number,
      w: number,
    ) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.text);
      doc.text(label, x, y, { width: w });
      doc.font('Helvetica').fontSize(10).fillColor(colors.text);
      doc.text(value, x, doc.y, { width: w });
    };

    doc.fillColor(colors.text);
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(tenantName || 'USPIRE PROFESSIONAL SERVICES', page.left, doc.y);
    doc.moveDown(0.2);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(colors.muted)
      .text('Prepared in accordance with IFRS');
    doc.fillColor(colors.text);
    doc.moveDown(0.6);

    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .text('RECEIPT', page.left, doc.y, { align: 'right' });
    doc.moveDown(0.2);

    const metaTop = doc.y;
    const colGap = 18;
    const colW = (page.width - colGap) / 2;
    const leftX = page.left;
    const rightX = page.left + colW + colGap;
    doc.font('Helvetica').fontSize(10).fillColor(colors.text);

    labelValue('Receipt Number', receiptNumber, leftX, metaTop, colW);
    doc.moveDown(0.2);
    labelValue('Receipt Date', receiptDate, leftX, doc.y, colW);

    doc.y = metaTop;
    labelValue('Currency', currency, rightX, metaTop, colW);
    if (showExchange) {
      doc.moveDown(0.2);
      labelValue('Exchange Rate', String(exchangeRate), rightX, doc.y, colW);
    }

    doc.y = Math.max(doc.y, metaTop + 54) + 10;
    drawDivider();
    doc.moveDown(0.8);

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(colors.text)
      .text('Received From');
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(customerName || '', { continued: false });
    if (customerEmail)
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(colors.muted)
        .text(customerEmail);
    if (customerPhone)
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(colors.muted)
        .text(customerPhone);
    if (customerAddress) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(colors.muted)
        .text(customerAddress, {
          width: page.width,
        });
    }
    doc.fillColor(colors.text);
    doc.moveDown(0.6);

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(colors.text)
      .text('Payment Details');
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(colors.text)
      .text(`Payment Method: ${paymentMethod}`);
    if (reference) doc.text(`Reference: ${reference}`);
    doc.moveDown(0.8);

    const cols = {
      invoice: 120,
      invDate: 70,
      dueDate: 70,
      invTotal: 90,
      applied: 90,
      balance: 90,
    };
    const tableWidth =
      cols.invoice +
      cols.invDate +
      cols.dueDate +
      cols.invTotal +
      cols.applied +
      cols.balance;
    const scale = page.width / tableWidth;
    Object.keys(cols).forEach(
      (k) => ((cols as any)[k] = (cols as any)[k] * scale),
    );

    const xInvoice = page.left;
    const xInvDate = xInvoice + cols.invoice;
    const xDueDate = xInvDate + cols.invDate;
    const xInvTotal = xDueDate + cols.dueDate;
    const xApplied = xInvTotal + cols.invTotal;
    const xBalance = xApplied + cols.applied;

    const renderTableHeader = () => {
      const y = doc.y;
      doc.save();
      doc.rect(page.left, y, page.width, 18).fill(colors.headerBg);
      doc.restore();
      doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.text);
      doc.text('Invoice #', xInvoice + 4, y + 5, { width: cols.invoice - 8 });
      doc.text('Inv Date', xInvDate + 4, y + 5, { width: cols.invDate - 8 });
      doc.text('Due Date', xDueDate + 4, y + 5, { width: cols.dueDate - 8 });
      doc.text('Invoice Total', xInvTotal + 4, y + 5, {
        width: cols.invTotal - 8,
        align: 'right',
      });
      doc.text('Applied', xApplied + 4, y + 5, {
        width: cols.applied - 8,
        align: 'right',
      });
      doc.text('Balance After', xBalance + 4, y + 5, {
        width: cols.balance - 8,
        align: 'right',
      });
      doc.strokeColor(colors.border);
      doc
        .moveTo(page.left, y + 18)
        .lineTo(page.left + page.width, y + 18)
        .stroke();
      doc.y = y + 24;
    };

    const renderRow = (row: any) => {
      doc.font('Helvetica').fontSize(9).fillColor(colors.text);

      const y = doc.y;
      const cellPadY = 6;
      const maxH = Math.max(
        doc.heightOfString(row.invoiceNumber || '', {
          width: cols.invoice - 8,
        }),
        doc.heightOfString(String(row.invoiceDate ?? ''), {
          width: cols.invDate - 8,
        }),
        doc.heightOfString(String(row.dueDate ?? ''), {
          width: cols.dueDate - 8,
        }),
      );
      const rowH = Math.max(16, maxH) + cellPadY;

      ensureSpace(rowH + 8, renderTableHeader);

      doc.text(row.invoiceNumber || '', xInvoice + 4, y, {
        width: cols.invoice - 8,
      });
      doc.text(String(row.invoiceDate ?? ''), xInvDate + 4, y, {
        width: cols.invDate - 8,
      });
      doc.text(String(row.dueDate ?? ''), xDueDate + 4, y, {
        width: cols.dueDate - 8,
      });
      doc.text(this.formatMoney(row.invoiceTotalAmount), xInvTotal + 4, y, {
        width: cols.invTotal - 8,
        align: 'right',
      });
      doc.text(this.formatMoney(row.appliedAmount), xApplied + 4, y, {
        width: cols.applied - 8,
        align: 'right',
      });
      doc.text(this.formatMoney(row.balanceAfter), xBalance + 4, y, {
        width: cols.balance - 8,
        align: 'right',
      });

      doc.strokeColor(colors.border);
      doc
        .moveTo(page.left, y + rowH)
        .lineTo(page.left + page.width, y + rowH)
        .stroke();
      doc.y = y + rowH + 2;
    };

    renderTableHeader();
    for (const row of allocRows) {
      renderRow(row);
    }

    doc.moveDown(0.8);

    const totalsLabelW = 140;
    const totalsValueW = 120;
    const totalsX = page.left + page.width - (totalsLabelW + totalsValueW);

    const renderTotalLine = (
      label: string,
      value: string,
      bold?: boolean,
      borderTop?: boolean,
    ) => {
      ensureSpace(16);
      if (borderTop) {
        doc.strokeColor(colors.border);
        doc
          .moveTo(totalsX, doc.y)
          .lineTo(totalsX + totalsLabelW + totalsValueW, doc.y)
          .stroke();
        doc.moveDown(0.35);
      }
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10)
        .fillColor(colors.text);
      const y = doc.y;
      doc.text(label, totalsX, y, { width: totalsLabelW, align: 'left' });
      doc.text(value, totalsX + totalsLabelW, y, {
        width: totalsValueW,
        align: 'right',
      });
      doc.y = y + 14;
    };

    renderTotalLine('Receipt Amount', this.formatMoney(receiptAmount));
    renderTotalLine('Applied Total', this.formatMoney(appliedTotal));
    if (unappliedTotal > 0) {
      renderTotalLine('Unapplied Total', this.formatMoney(unappliedTotal));
    }
    renderTotalLine('Total', this.formatMoney(receiptAmount), true, true);

    ensureSpace(110);
    doc.moveDown(0.8);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(colors.text)
      .text('Bank Details');
    doc.font('Helvetica').fontSize(9).fillColor(colors.muted);
    doc.text('Bank Name: FNB');
    doc.text('Account Name: Uspire Professional Services Ltd');
    doc.text('Account Number: 63144493680');
    doc.text('Branch Name/Number: Commercial Suite / 260001');
    doc.text('Swift Code: FIRNZMLX');
    doc.fillColor(colors.text);

    doc.end();
    const pdf = await done;

    return {
      contentType: 'application/pdf',
      fileName: `Receipt_${receiptNumber || id}.pdf`,
      body: pdf,
    };
  }

  async createReceipt(req: Request, dto: CreateReceiptDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const customer = await (this.prisma as any).customer.findFirst({
      where: { id: dto.customerId, tenantId: tenant.id },
      select: { id: true, status: true },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }
    if (customer.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Customer is inactive and cannot be used for new transactions.',
      );
    }

    const header = await this.validateAndNormalizeHeader({
      tenantId: tenant.id,
      currency: dto.currency,
      exchangeRate: dto.exchangeRate ?? null,
      totalAmount: dto.totalAmount,
    });

    await this.validateLines({
      tenantId: tenant.id,
      customerId: dto.customerId,
      receiptCurrency: header.receiptCurrency,
      totalAmount: header.amount,
      lines: dto.lines,
    });

    const paymentReference = this.parseReference(dto);

    const created = await this.prisma.$transaction(async (tx) => {
      const receiptNumber = await this.nextReceiptNumber(tx, tenant.id);
      return (tx as any).customerReceipt.create({
        data: {
          tenantId: tenant.id,
          receiptNumber,
          receiptDate: new Date(dto.receiptDate),
          customerId: dto.customerId,
          currency: header.receiptCurrency,
          exchangeRate: header.exchangeRate,
          totalAmount: header.amount,
          paymentMethod: dto.paymentMethod as any,
          paymentReference,
          status: 'DRAFT' as any,
          createdById: user.id,
          lines: {
            create: (dto.lines ?? []).map((l) => ({
              tenantId: tenant.id,
              invoiceId: l.invoiceId,
              appliedAmount: l.appliedAmount,
            })),
          },
        },
      });
    });

    return this.getReceiptById(req, created.id);
  }

  async updateReceipt(req: Request, id: string, dto: UpdateReceiptDto) {
    const tenant = this.ensureTenant(req);

    await this.assertEditable(id, tenant.id);

    const current = await (this.prisma as any).customerReceipt.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        customerId: true,
        currency: true,
        exchangeRate: true,
        totalAmount: true,
      },
    });
    if (!current) throw new NotFoundException('Receipt not found');

    const nextCustomerId = dto.customerId ?? current.customerId;
    const nextTotalAmount = dto.totalAmount ?? Number(current.totalAmount);
    const nextCurrency = dto.currency ?? String(current.currency);
    const nextExchangeRate =
      dto.exchangeRate === undefined
        ? Number(current.exchangeRate ?? 1)
        : dto.exchangeRate;

    if (dto.customerId) {
      const customer = await (this.prisma as any).customer.findFirst({
        where: { id: dto.customerId, tenantId: tenant.id },
        select: { id: true, status: true },
      });
      if (!customer) {
        throw new BadRequestException('Customer not found');
      }
      if (customer.status !== 'ACTIVE') {
        throw new BadRequestException(
          'Customer is inactive and cannot be used for new transactions.',
        );
      }
    }

    const header = await this.validateAndNormalizeHeader({
      tenantId: tenant.id,
      currency: nextCurrency,
      exchangeRate: nextExchangeRate ?? null,
      totalAmount: nextTotalAmount,
    });

    await this.validateLines({
      tenantId: tenant.id,
      customerId: nextCustomerId,
      receiptCurrency: header.receiptCurrency,
      totalAmount: header.amount,
      lines: dto.lines,
      receiptIdForUpdate: id,
    });

    const paymentReference =
      dto.paymentReference === undefined && dto.reference === undefined
        ? undefined
        : this.parseReference(dto);

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).customerReceipt.update({
        where: { id },
        data: {
          customerId: dto.customerId,
          receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : undefined,
          currency:
            dto.currency === undefined ? undefined : header.receiptCurrency,
          exchangeRate:
            dto.currency === undefined && dto.exchangeRate === undefined
              ? undefined
              : header.exchangeRate,
          totalAmount:
            dto.totalAmount === undefined ? undefined : header.amount,
          paymentMethod: dto.paymentMethod
            ? (dto.paymentMethod as any)
            : undefined,
          paymentReference,
        },
      });

      if (dto.lines) {
        await (tx as any).customerReceiptLine.deleteMany({
          where: { receiptId: id },
        });
        if (dto.lines.length > 0) {
          await (tx as any).customerReceiptLine.createMany({
            data: dto.lines.map((l) => ({
              tenantId: tenant.id,
              receiptId: id,
              invoiceId: l.invoiceId,
              appliedAmount: l.appliedAmount,
            })),
          });
        }
      }
    });

    return this.getReceiptById(req, id);
  }

  async postReceipt(req: Request, id: string) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);
    const now = new Date();

    const existing = await (this.prisma as any).customerReceipt.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        status: true,
        receiptDate: true,
        customerId: true,
        currency: true,
        exchangeRate: true,
        totalAmount: true,
        createdById: true,
        glJournalId: true,
      },
    });
    if (!existing) throw new NotFoundException('Receipt not found');

    if (existing.status === 'POSTED') {
      return this.getReceiptById(req, id);
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT receipts can be posted');
    }

    const draftLines = await (this.prisma as any).customerReceiptLine.findMany({
      where: { receiptId: id },
      select: { invoiceId: true, appliedAmount: true },
    });

    const header = await this.validateAndNormalizeHeader({
      tenantId: tenant.id,
      currency: String(existing.currency),
      exchangeRate: Number(existing.exchangeRate ?? 1),
      totalAmount: Number(existing.totalAmount),
    });

    await this.validateLines({
      tenantId: tenant.id,
      customerId: String(existing.customerId ?? ''),
      receiptCurrency: header.receiptCurrency,
      totalAmount: header.amount,
      lines: (draftLines ?? []).map((l: any) => ({
        invoiceId: l.invoiceId,
        appliedAmount: Number(l.appliedAmount),
      })),
    });

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        startDate: { lte: existing.receiptDate },
        endDate: { gte: existing.receiptDate },
      },
      select: { id: true, status: true, name: true },
    });

    if (!period || period.status !== 'OPEN') {
      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: !period
          ? 'No accounting period exists for the receipt date'
          : `Accounting period is not OPEN: ${period.name}`,
      });
    }

    if (period.name === this.OPENING_PERIOD_NAME) {
      throw new ForbiddenException({
        error: 'Posting blocked by opening balances control period',
        reason:
          'Operational postings are not allowed in the Opening Balances period',
      });
    }

    const cutoverLocked = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        name: this.OPENING_PERIOD_NAME,
        status: 'CLOSED',
      },
      orderBy: { startDate: 'desc' },
      select: { startDate: true },
    });

    if (cutoverLocked && existing.receiptDate < cutoverLocked.startDate) {
      throw new ForbiddenException({
        error: 'Posting blocked by cutover lock',
        reason: `Posting dated before cutover is not allowed (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`,
      });
    }

    const tenantConfig = await (this.prisma as any).tenant.findUnique({
      where: { id: tenant.id },
      select: {
        arControlAccountId: true,
        defaultBankClearingAccountId: true,
        unappliedReceiptsAccountId: true,
      },
    });

    const arControlAccountId = (tenantConfig?.arControlAccountId ?? null) as
      | string
      | null;
    const bankClearingAccountId = (tenantConfig?.defaultBankClearingAccountId ??
      null) as string | null;
    const unappliedReceiptsAccountId =
      (tenantConfig?.unappliedReceiptsAccountId ?? null) as string | null;
    if (!bankClearingAccountId) {
      throw new BadRequestException({
        error: 'Missing configuration: default bank clearing account',
        field: 'Tenant.defaultBankClearingAccountId',
      });
    }
    if (!arControlAccountId) {
      throw new BadRequestException({
        error: 'Missing configuration: AR control account',
        field: 'Tenant.arControlAccountId',
      });
    }

    const [bankAccount, arAccount] = await Promise.all([
      this.prisma.account.findFirst({
        where: {
          tenantId: tenant.id,
          id: bankClearingAccountId,
          isActive: true,
          type: 'ASSET',
        },
        select: { id: true },
      }),
      this.prisma.account.findFirst({
        where: {
          tenantId: tenant.id,
          id: arControlAccountId,
          isActive: true,
          type: 'ASSET',
        },
        select: { id: true },
      }),
    ]);

    if (!bankAccount) {
      throw new BadRequestException(
        'Configured bank clearing GL account not found or invalid',
      );
    }
    if (!arAccount) {
      throw new BadRequestException(
        'Configured AR control GL account not found or invalid',
      );
    }

    const amount = header.amount;

    const allocatedTotal = this.normalizeMoney(
      (draftLines ?? []).reduce(
        (s: number, l: any) =>
          s + this.normalizeMoney(Number(l.appliedAmount ?? 0)),
        0,
      ),
    );
    const unappliedTotal = this.normalizeMoney(amount - allocatedTotal);

    if (unappliedTotal > 0 && !unappliedReceiptsAccountId) {
      throw new BadRequestException({
        error:
          'Missing configuration: unapplied receipts account is required when receipt has unapplied amount',
        field: 'Tenant.unappliedReceiptsAccountId',
        unappliedTotal,
      });
    }

    const unappliedAccount =
      unappliedTotal > 0
        ? await this.prisma.account.findFirst({
            where: {
              tenantId: tenant.id,
              id: unappliedReceiptsAccountId as string,
              isActive: true,
            },
            select: { id: true },
          })
        : null;
    if (unappliedTotal > 0 && !unappliedAccount) {
      throw new BadRequestException(
        'Configured unapplied receipts GL account not found or inactive',
      );
    }

    const posted = await this.prisma.$transaction(async (tx) => {
      const current = await (tx as any).customerReceipt.findFirst({
        where: { id, tenantId: tenant.id },
        select: { id: true, status: true, glJournalId: true },
      });
      if (!current) throw new NotFoundException('Receipt not found');
      if (current.status === 'POSTED') {
        return {
          receiptId: current.id,
          glJournalId: current.glJournalId ?? null,
        };
      }
      if (current.status !== 'DRAFT') {
        throw new BadRequestException('Only DRAFT receipts can be posted');
      }

      const existingJournal = await tx.journalEntry.findFirst({
        where: {
          tenantId: tenant.id,
          reference: `AR-RECEIPT:${id}`,
        },
        select: { id: true, status: true },
      });
      if (existingJournal) {
        if (existingJournal.status !== 'POSTED') {
          throw new ConflictException({
            error: 'Existing receipt journal is not POSTED; cannot continue',
            journalId: existingJournal.id,
            status: existingJournal.status,
          });
        }

        await (tx as any).customerReceipt.update({
          where: { id },
          data: {
            status: 'POSTED' as ReceiptStatus,
            postedById: user.id,
            postedByUserId: user.id,
            postedAt: now,
            glJournalId: existingJournal.id,
          },
        });

        return { receiptId: id, glJournalId: existingJournal.id };
      }

      const journal = await tx.journalEntry.create({
        data: {
          tenantId: tenant.id,
          journalDate: existing.receiptDate,
          reference: `AR-RECEIPT:${id}`,
          description: `AR receipt posting: ${id}`,
          createdById: existing.createdById,
          lines: {
            create: [
              { accountId: bankAccount.id, debit: amount, credit: 0 },
              ...(allocatedTotal > 0
                ? [
                    {
                      accountId: arAccount.id,
                      debit: 0,
                      credit: allocatedTotal,
                    },
                  ]
                : []),
              ...(unappliedTotal > 0
                ? [
                    {
                      accountId: (unappliedAccount as any).id,
                      debit: 0,
                      credit: unappliedTotal,
                    },
                  ]
                : []),
            ],
          },
        } as any,
        include: { lines: true },
      });

      const postedJournal = await tx.journalEntry.update({
        where: { id: journal.id },
        data: {
          status: 'POSTED',
          postedById: user.id,
          postedAt: now,
        } as any,
        select: { id: true },
      });

      await (tx as any).customerReceipt.update({
        where: { id },
        data: {
          status: 'POSTED' as ReceiptStatus,
          postedById: user.id,
          postedByUserId: user.id,
          postedAt: now,
          glJournalId: postedJournal.id,
        },
      });

      await tx.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'AR_POST',
            entityType: 'CUSTOMER_RECEIPT',
            entityId: id,
            action: 'AR_RECEIPT_POST',
            outcome: 'SUCCESS',
            reason: JSON.stringify({ journalId: postedJournal.id }),
            userId: user.id,
            permissionUsed: 'AR_RECEIPTS_CREATE',
          } as any,
        })
        .catch(() => undefined);

      return { receiptId: id, glJournalId: postedJournal.id };
    });

    return this.getReceiptById(req, posted.receiptId);
  }

  async voidReceipt(req: Request, id: string, reason: string) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);
    const now = new Date();

    const r = await (this.prisma as any).customerReceipt.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true },
    });
    if (!r) throw new NotFoundException('Receipt not found');
    if (r.status === 'VOIDED') {
      throw new BadRequestException('Receipt already VOIDED');
    }
    if (r.status !== 'POSTED' && r.status !== 'DRAFT') {
      throw new ForbiddenException('Invalid receipt status');
    }

    if (!reason || reason.trim().length < 2) {
      throw new BadRequestException('Void reason is required');
    }

    await (this.prisma as any).customerReceipt.update({
      where: { id },
      data: {
        status: 'VOIDED' as ReceiptStatus,
        voidedById: user.id,
        voidedAt: now,
        voidReason: reason.trim(),
      },
    });

    return this.getReceiptById(req, id);
  }
}
