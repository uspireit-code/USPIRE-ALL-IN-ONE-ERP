import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateCustomerInvoiceDto,
  BulkPostInvoicesDto,
  ListInvoicesQueryDto,
} from './invoices.dto';

@Injectable()
export class FinanceArInvoicesService {
  private readonly INVOICE_NUMBER_SEQUENCE_NAME = 'AR_INVOICE_NUMBER';
  private readonly OPENING_PERIOD_NAME = 'Opening Balances';

  constructor(private readonly prisma: PrismaService) {}

  private round2(n: number) {
    return Math.round(Number(n ?? 0) * 100) / 100;
  }

  private round6(n: number) {
    return Math.round(this.toNum(n) * 1_000_000) / 1_000_000;
  }

  private formatMoney(amount: number, _currency?: string) {
    const n = this.round2(this.toNum(amount ?? 0));
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  private computeDiscount(params: {
    gross: number;
    discountPercent?: any;
    discountAmount?: any;
  }): {
    discountPercent: number | null;
    discountAmount: number | null;
    discountTotal: number;
  } {
    const gross = this.round2(this.toNum(params.gross ?? 0));
    const discountPercent = this.round6(this.toNum(params.discountPercent ?? 0));
    const discountAmount = this.round2(this.toNum(params.discountAmount ?? 0));

    const hasPercent = discountPercent > 0;
    const hasAmount = discountAmount > 0;
    if (hasPercent && hasAmount) {
      throw new BadRequestException('Invoice line discountPercent and discountAmount are mutually exclusive');
    }
    if (discountPercent < 0 || discountPercent > 100) {
      throw new BadRequestException('Invoice line discountPercent must be between 0 and 100');
    }
    if (discountAmount < 0) {
      throw new BadRequestException('Invoice line discountAmount must be >= 0');
    }

    const computedDiscountTotal = hasPercent
      ? this.round2(gross * (discountPercent / 100))
      : hasAmount
        ? this.round2(discountAmount)
        : 0;

    if (computedDiscountTotal > gross) {
      throw new BadRequestException('Invoice line discount cannot exceed gross amount');
    }

    return {
      discountPercent: hasPercent ? discountPercent : null,
      discountAmount: hasAmount ? discountAmount : null,
      discountTotal: computedDiscountTotal,
    };
  }

  private escapeHtml(v: any) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  private normalizeHeaderKey(v: any) {
    return String(v ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9]/g, '');
  }

  private parseCsvRows(buf: Buffer): Array<{ rowNumber: number; row: Record<string, string> }> {
    const text = buf.toString('utf8');
    const lines = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((l) => l.trim().length > 0);

    if (lines.length === 0) return [];

    const parseLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }
        if (ch === ',' && !inQuotes) {
          out.push(cur);
          cur = '';
          continue;
        }
        cur += ch;
      }
      out.push(cur);
      return out;
    };

    const headers = parseLine(lines[0]).map((h) => this.normalizeHeaderKey(h));
    const rows: Array<{ rowNumber: number; row: Record<string, string> }> = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = String(cols[j] ?? '').trim();
      }
      const hasAny = Object.values(row).some((v) => String(v ?? '').trim() !== '');
      if (hasAny) rows.push({ rowNumber: i + 1, row });
    }

    return rows;
  }

  private async readXlsxRows(buf: Buffer): Promise<Array<{ rowNumber: number; row: Record<string, any> }>> {
    const wb = new ExcelJS.Workbook();
    await (wb.xlsx as any).load(buf as any);

    const ws = wb.worksheets[0];
    if (!ws) return [];

    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const raw = (cell.value as any)?.text ?? cell.value;
      headers[colNumber - 1] = this.normalizeHeaderKey(raw);
    });

    const rows: Array<{ rowNumber: number; row: Record<string, any> }> = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        const cell = row.getCell(idx + 1);
        const v = (cell.value as any)?.text ?? cell.value;
        obj[h] = v;
      });
      const hasAny = Object.values(obj).some((v) => String(v ?? '').trim() !== '');
      if (hasAny) rows.push({ rowNumber, row: obj });
    });

    return rows;
  }

  private parseYmdToDateOrNull(v: any): Date | null {
    const s = String(v ?? '').trim();
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  private toNum(v: any): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : 0;
  }

  private async assertOpenPeriodForInvoiceDate(params: { tenantId: string; invoiceDate: Date }) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: params.tenantId,
        startDate: { lte: params.invoiceDate },
        endDate: { gte: params.invoiceDate },
      },
      select: { id: true, status: true, name: true, startDate: true },
    });

    if (!period || period.status !== 'OPEN') {
      throw new ForbiddenException(
        !period
          ? 'Invoice date must fall within an OPEN accounting period'
          : `Invoice date period is not OPEN: ${period.name}`,
      );
    }

    if (period.name === this.OPENING_PERIOD_NAME) {
      throw new ForbiddenException(
        'Operational postings are not allowed in the Opening Balances period',
      );
    }

    const cutoverLocked = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: params.tenantId,
        name: this.OPENING_PERIOD_NAME,
        status: 'CLOSED',
      },
      orderBy: { startDate: 'desc' },
      select: { startDate: true },
    });

    if (cutoverLocked && params.invoiceDate < cutoverLocked.startDate) {
      throw new ForbiddenException(
        `Invoice date is before cutover and cannot be used (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`,
      );
    }
  }

  private async nextInvoiceNumber(tx: any, tenantId: string) {
    const counter = await tx.tenantSequenceCounter.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: this.INVOICE_NUMBER_SEQUENCE_NAME,
        },
      },
      create: {
        tenantId,
        name: this.INVOICE_NUMBER_SEQUENCE_NAME,
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

    return `INV-${String(bumped.value).padStart(6, '0')}`;
  }

  private async computeOutstandingBalance(params: { tenantId: string; invoiceId: string; totalAmount: number }) {
    const g = await (this.prisma as any).customerReceiptLine.groupBy({
      by: ['invoiceId'],
      where: {
        tenantId: params.tenantId,
        invoiceId: params.invoiceId,
        receipt: {
          tenantId: params.tenantId,
          status: 'POSTED',
        },
      },
      _sum: { appliedAmount: true },
    });

    const applied = this.round2(Number(g?.[0]?._sum?.appliedAmount ?? 0));
    const total = this.round2(Number(params.totalAmount ?? 0));
    return this.round2(total - applied);
  }

  async list(req: Request, q: ListInvoicesQueryDto) {
    const tenant = this.ensureTenant(req);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;

    const where: any = { tenantId: tenant.id };
    if (q.status) where.status = q.status;
    if (q.customerId) where.customerId = q.customerId;
    if (q.search) {
      const s = String(q.search).trim();
      if (s) {
        where.OR = [
          { invoiceNumber: { contains: s, mode: 'insensitive' } },
          { reference: { contains: s, mode: 'insensitive' } },
          { customer: { name: { contains: s, mode: 'insensitive' } } },
        ];
      }
    }

    const [total, items] = await Promise.all([
      this.prisma.customerInvoice.count({ where } as any),
      this.prisma.customerInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: true } as any,
      } as any),
    ]);

    const rows = await Promise.all(
      (items ?? []).map(async (inv: any) => ({
        ...inv,
        subtotal: Number(inv.subtotal),
        taxAmount: Number(inv.taxAmount),
        totalAmount: Number(inv.totalAmount),
        outstandingBalance: await this.computeOutstandingBalance({
          tenantId: tenant.id,
          invoiceId: inv.id,
          totalAmount: Number(inv.totalAmount),
        }),
      })),
    );

    return { page, pageSize, total, items: rows };
  }

  async getById(req: Request, id: string) {
    const tenant = this.ensureTenant(req);

    const inv = await this.prisma.customerInvoice.findFirst({
      where: { id, tenantId: tenant.id } as any,
      include: { customer: true, lines: true } as any,
    });

    if (!inv) throw new NotFoundException('Invoice not found');

    return {
      ...inv,
      subtotal: Number((inv as any).subtotal),
      taxAmount: Number((inv as any).taxAmount),
      totalAmount: Number((inv as any).totalAmount),
      lines: (inv as any).lines.map((l: any) => ({
        ...l,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discountPercent: l.discountPercent === null || l.discountPercent === undefined ? l.discountPercent : Number(l.discountPercent),
        discountAmount: l.discountAmount === null || l.discountAmount === undefined ? l.discountAmount : Number(l.discountAmount),
        discountTotal: l.discountTotal === null || l.discountTotal === undefined ? l.discountTotal : Number(l.discountTotal),
        lineTotal: Number(l.lineTotal),
      })),
      outstandingBalance: await this.computeOutstandingBalance({
        tenantId: tenant.id,
        invoiceId: inv.id,
        totalAmount: Number((inv as any).totalAmount),
      }),
    };
  }

  async create(req: Request, dto: CreateCustomerInvoiceDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const invoiceDate = this.parseYmdToDateOrNull(dto.invoiceDate);
    const dueDate = this.parseYmdToDateOrNull(dto.dueDate);
    if (!invoiceDate) throw new BadRequestException('invoiceDate is required');
    if (!dueDate) throw new BadRequestException('dueDate is required');

    if (dueDate < invoiceDate) {
      throw new BadRequestException('Due date cannot be earlier than invoice date');
    }

    await this.assertOpenPeriodForInvoiceDate({ tenantId: tenant.id, invoiceDate });

    const currency = String(dto.currency ?? '').trim();
    if (!currency) throw new BadRequestException('currency is required');

    const tenantCurrency = String((tenant as any)?.defaultCurrency ?? '').trim();
    const exchangeRate =
      tenantCurrency && currency.toUpperCase() === tenantCurrency.toUpperCase()
        ? 1
        : this.round6(this.toNum((dto as any).exchangeRate ?? 0));
    if (!(exchangeRate > 0)) {
      throw new BadRequestException('exchangeRate is required and must be > 0 for non-base currency');
    }

    const customer = await (this.prisma as any).customer.findFirst({
      where: { id: dto.customerId, tenantId: tenant.id },
      select: { id: true, status: true, name: true, email: true, billingAddress: true },
    });

    if (!customer) throw new BadRequestException('Customer not found');
    if (customer.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Customer is inactive and cannot be used for new transactions.',
      );
    }

    if (!dto.lines || dto.lines.length < 1) {
      throw new BadRequestException('Invoice must have at least 1 line');
    }

    const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
    const accounts = await this.prisma.account.findMany({
      where: {
        tenantId: tenant.id,
        id: { in: accountIds },
        isActive: true,
      },
      select: { id: true, type: true },
    });
    const byId = new Map(accounts.map((a) => [a.id, a] as const));

    const computedLines = dto.lines.map((l) => {
      const qty = this.toNum(l.quantity ?? 1);
      const unitPrice = this.toNum(l.unitPrice);
      const description = String(l.description ?? '').trim();

      if (!l.accountId) throw new BadRequestException('Invoice line missing accountId');
      if (!description) throw new BadRequestException('Invoice line description is required');
      if (!(qty > 0)) throw new BadRequestException('Invoice line quantity must be > 0');
      if (!(unitPrice > 0)) throw new BadRequestException('Invoice line unitPrice must be > 0');

      const acct = byId.get(l.accountId);
      if (!acct) {
        throw new BadRequestException(`Account not found or inactive: ${l.accountId}`);
      }
      if ((acct as any).type !== 'INCOME') {
        throw new BadRequestException(`Invoice line account must be INCOME: ${l.accountId}`);
      }

      const gross = this.round2(qty * unitPrice);
      const disc = this.computeDiscount({
        gross,
        discountPercent: (l as any).discountPercent,
        discountAmount: (l as any).discountAmount,
      });
      const lineTotal = this.round2(gross - disc.discountTotal);
      return {
        accountId: l.accountId,
        description,
        quantity: qty,
        unitPrice,
        discountPercent: disc.discountPercent,
        discountAmount: disc.discountAmount,
        discountTotal: disc.discountTotal,
        lineTotal,
      };
    });

    const subtotal = this.round2(computedLines.reduce((s, l) => s + l.lineTotal, 0));
    const discountTotal = this.round2(computedLines.reduce((s, l) => s + this.toNum((l as any).discountTotal ?? 0), 0));
    const taxAmount = 0;
    const totalAmount = this.round2(subtotal + taxAmount);

    const created = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.nextInvoiceNumber(tx, tenant.id);
      return tx.customerInvoice.create({
        data: {
          tenantId: tenant.id,
          customerId: dto.customerId,
          invoiceNumber,
          invoiceDate,
          dueDate,
          currency,
          exchangeRate,
          reference: dto.reference ? String(dto.reference).trim() : undefined,
          invoiceNote: (dto as any).invoiceNote ? String((dto as any).invoiceNote).trim() : undefined,
          customerNameSnapshot: String((customer as any).name ?? '').trim(),
          customerEmailSnapshot: (customer as any).email ? String((customer as any).email).trim() : undefined,
          customerBillingAddressSnapshot: (customer as any).billingAddress ? String((customer as any).billingAddress).trim() : undefined,
          subtotal,
          taxAmount,
          totalAmount,
          status: 'DRAFT',
          createdById: user.id,
          lines: {
            create: computedLines.map((l) => ({
              accountId: l.accountId,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountPercent: (l as any).discountPercent ?? undefined,
              discountAmount: (l as any).discountAmount ?? undefined,
              discountTotal: (l as any).discountTotal ?? 0,
              lineTotal: l.lineTotal,
            })),
          },
        } as any,
        include: { customer: true, lines: true } as any,
      } as any);
    });

    return this.getById(req, (created as any).id);
  }

  async post(req: Request, id: string, opts?: { arControlAccountCode?: string }) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const inv = await this.prisma.customerInvoice.findFirst({
      where: { id, tenantId: tenant.id } as any,
      include: { lines: true } as any,
    });

    if (!inv) throw new NotFoundException('Invoice not found');
    if ((inv as any).status === 'POSTED') {
      throw new BadRequestException('Invoice is already posted');
    }

    if ((inv as any).dueDate && (inv as any).invoiceDate && (inv as any).dueDate < (inv as any).invoiceDate) {
      throw new BadRequestException('Due date cannot be earlier than invoice date');
    }

    await this.assertOpenPeriodForInvoiceDate({ tenantId: tenant.id, invoiceDate: (inv as any).invoiceDate });

    const arCode = String(opts?.arControlAccountCode ?? '1100');
    const arAccount = await this.prisma.account.findFirst({
      where: {
        tenantId: tenant.id,
        code: arCode,
        isActive: true,
        type: 'ASSET',
      } as any,
      select: { id: true, code: true, name: true },
    });
    if (!arAccount) {
      throw new BadRequestException(`AR control account not found or invalid: ${arCode}`);
    }

    const lines = ((inv as any).lines ?? []).map((l: any) => ({
      accountId: l.accountId,
      lineTotal: this.round2(Number(l.lineTotal)),
    }));

    if (lines.length < 1) throw new BadRequestException('Invoice must have at least 1 line');

    const creditsTotal = this.round2(lines.reduce((s, l) => s + l.lineTotal, 0));
    const invTotal = this.round2(Number((inv as any).totalAmount));
    if (creditsTotal !== invTotal) {
      throw new BadRequestException('Invoice totals failed validation before posting');
    }

    let postedJournal: any = null;
    try {
      const journal = await this.prisma.journalEntry.create({
        data: {
          tenantId: tenant.id,
          journalDate: (inv as any).invoiceDate,
          reference: `AR-INVOICE:${(inv as any).id}`,
          description: `AR invoice posting: ${(inv as any).invoiceNumber}`,
          createdById: (inv as any).createdById,
          lines: {
            create: [
              {
                accountId: arAccount.id,
                debit: (inv as any).totalAmount,
                credit: 0,
              },
              ...lines.map((l: any) => ({
                accountId: l.accountId,
                debit: 0,
                credit: l.lineTotal,
              })),
            ],
          },
        } as any,
        include: { lines: true } as any,
      } as any);

      postedJournal = await this.prisma.journalEntry.update({
        where: { id: (journal as any).id },
        data: {
          status: 'POSTED',
          postedById: user.id,
          postedAt: new Date(),
        },
        include: { lines: true } as any,
      } as any);

      const updated = await this.prisma.customerInvoice.update({
        where: { id: (inv as any).id },
        data: {
          status: 'POSTED',
          postedById: user.id,
          postedAt: new Date(),
        },
        include: { customer: true, lines: true } as any,
      } as any);

      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'AR_POST',
            entityType: 'CUSTOMER_INVOICE',
            entityId: String((inv as any).id),
            action: 'AR_INVOICE_POST',
            outcome: 'SUCCESS',
            reason: JSON.stringify({ invoiceNumber: (inv as any).invoiceNumber }),
            userId: user.id,
            permissionUsed: 'AR_INVOICE_POST',
          } as any,
        } as any)
        .catch(() => undefined);

      return { invoice: await this.getById(req, (updated as any).id), glJournal: postedJournal };
    } catch (e: any) {
      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'AR_POST',
            entityType: 'CUSTOMER_INVOICE',
            entityId: String((inv as any).id),
            action: 'AR_INVOICE_POST',
            outcome: 'FAILED',
            reason: String(e?.message ?? 'Failed to post invoice'),
            userId: user.id,
            permissionUsed: 'AR_INVOICE_POST',
          } as any,
        } as any)
        .catch(() => undefined);
      throw e;
    }
  }

  async bulkPost(req: Request, dto: BulkPostInvoicesDto) {
    this.ensureTenant(req);
    this.ensureUser(req);

    const ids = Array.from(
      new Set((dto.invoiceIds ?? []).map((x) => String(x ?? '').trim()).filter(Boolean)),
    );
    if (ids.length < 1) throw new BadRequestException('invoiceIds is required');

    const postedInvoiceIds: string[] = [];
    const failed: Array<{ invoiceId: string; reason: string }> = [];

    for (const invoiceId of ids) {
      try {
        await this.post(req, invoiceId, {
          arControlAccountCode: dto.arControlAccountCode,
        });
        postedInvoiceIds.push(invoiceId);
      } catch (e: any) {
        failed.push({
          invoiceId,
          reason: String(e?.message ?? 'Failed to post invoice'),
        });
      }
    }

    return {
      postedCount: postedInvoiceIds.length,
      failedCount: failed.length,
      postedInvoiceIds,
      failed,
    };
  }

  async getImportCsvTemplate(req: Request) {
    this.ensureTenant(req);
    const headers = [
      'rowType',
      'invoiceRef',
      'customerCode',
      'invoiceDate',
      'dueDate',
      'currency',
      'revenueAccountCode',
      'description',
      'quantity',
      'unitPrice',
      'discountPercent',
      'discountAmount',
    ];

    const fileName = `invoice_import_template.csv`;
    const sampleRows = [
      ['SAMPLE', 'INVREF-1001', 'CUST-001', '2026-01-01', '2026-01-31', 'USD', '4000', 'Consulting services - Phase 1', '1', '1500', '10', ''],
      ['SAMPLE', 'INVREF-1001', 'CUST-001', '2026-01-01', '2026-01-31', 'USD', '4000', 'Consulting services - Phase 2', '2', '750', '', '25.00'],
      ['SAMPLE', 'INVREF-2001', 'CUST-002', '2026-01-05', '2026-02-05', 'USD', '4010', 'Monthly subscription', '1', '99', '', ''],
    ];
    const body = `${headers.join(',')}\n${sampleRows.map((r) => r.join(',')).join('\n')}\n`;
    return { fileName, body };
  }

  async getImportXlsxTemplate(req: Request) {
    this.ensureTenant(req);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Invoices');
    ws.addRow([
      'rowType',
      'invoiceRef',
      'customerCode',
      'invoiceDate',
      'dueDate',
      'currency',
      'revenueAccountCode',
      'description',
      'quantity',
      'unitPrice',
      'discountPercent',
      'discountAmount',
    ]);

    // Header notes (Excel comments) to guide users; SAMPLE rows are ignored during preview/import.
    try {
      ws.getCell('A1').note = 'Optional. Use SAMPLE to include example rows (ignored during preview/import). Leave blank for real data.';
      ws.getCell('B1').note = 'Required. Rows with the same invoiceRef are grouped into ONE invoice with multiple lines.';
      ws.getCell('C1').note = 'Required. Must be consistent for all rows within the same invoiceRef group.';
      ws.getCell('D1').note = 'Required. Must be consistent for all rows within the same invoiceRef group.';
      ws.getCell('E1').note = 'Required. Must be consistent for all rows within the same invoiceRef group. Must be >= Invoice Date.';
      ws.getCell('F1').note = 'Required. Use a valid ISO code (e.g. USD). Must be consistent within invoiceRef group.';
      ws.getCell('K1').note = 'Optional. Discount percent (0-100). Mutually exclusive with discountAmount.';
      ws.getCell('L1').note = 'Optional. Discount amount (>= 0). Mutually exclusive with discountPercent.';
    } catch {
      // ignore if notes unsupported
    }

    ws.addRow(['SAMPLE', 'INVREF-1001', 'CUST-001', '2026-01-01', '2026-01-31', 'USD', '4000', 'Consulting services - Phase 1', 1, 1500, 10, null]);
    ws.addRow(['SAMPLE', 'INVREF-1001', 'CUST-001', '2026-01-01', '2026-01-31', 'USD', '4000', 'Consulting services - Phase 2', 2, 750, null, 25]);
    ws.addRow(['SAMPLE', 'INVREF-2001', 'CUST-002', '2026-01-05', '2026-02-05', 'USD', '4010', 'Monthly subscription', 1, 99, null, null]);

    const fileName = `invoice_import_template.xlsx`;
    const body = await (wb.xlsx as any).writeBuffer();
    return { fileName, body };
  }

  private async readImportRows(file: any) {
    if (!file?.buffer) throw new BadRequestException('Missing file');
    const name = String(file.originalname ?? '').toLowerCase();
    const buf: Buffer = file.buffer;

    if (name.endsWith('.xlsx')) {
      return this.readXlsxRows(buf);
    }

    return this.parseCsvRows(buf).map((r) => ({ rowNumber: r.rowNumber, row: r.row }));
  }

  async previewImport(req: Request, file: any, opts?: { importId?: string }) {
    const tenant = this.ensureTenant(req);

    const importId = String(opts?.importId ?? '').trim() || randomUUID();

    const rows = await this.readImportRows(file);

    const parsedAll = rows.map((r) => {
      const raw = r.row;
      const rowTypeRaw = String(raw.rowtype ?? raw.row_type ?? raw.type ?? raw.flag ?? '').trim();
      const isSample = rowTypeRaw.toUpperCase() === 'SAMPLE';
      const invoiceRef = String(raw.invoiceref ?? raw.invoice_ref ?? raw.invoicereference ?? '').trim();
      const customerCode = String(raw.customercode ?? raw.customer_code ?? raw.customer ?? '').trim();
      const invoiceDate = String(raw.invoicedate ?? raw.invoice_date ?? '').trim();
      const dueDate = String(raw.duedate ?? raw.due_date ?? '').trim();
      const revenueAccountCode = String(raw.revenueaccountcode ?? raw.revenue_account_code ?? raw.accountcode ?? raw.account_code ?? '').trim();
      const description = String(raw.description ?? '').trim();
      const quantity = this.toNum(raw.quantity ?? 1);
      const unitPrice = this.toNum(raw.unitprice ?? raw.unit_price ?? 0);
      const currency = String(raw.currency ?? '').trim();
      const discountPercent = raw.discountpercent ?? raw.discount_percent ?? raw.discpercent ?? raw.disc_percent;
      const discountAmount = raw.discountamount ?? raw.discount_amount ?? raw.discamount ?? raw.disc_amount;

      const errors: string[] = [];
      if (isSample) {
        return {
          rowNumber: r.rowNumber,
          invoiceRef,
          customerCode,
          invoiceDate,
          dueDate,
          revenueAccountCode,
          description,
          quantity,
          unitPrice,
          currency,
          discountPercent,
          discountAmount,
          errors,
          _isSample: true,
        };
      }
      if (!invoiceRef) errors.push('invoiceRef is required');
      if (!customerCode) errors.push('Customer Code is required');
      if (!invoiceDate || !this.parseYmdToDateOrNull(invoiceDate)) errors.push('Invoice Date is required and must be a valid date');
      if (!dueDate || !this.parseYmdToDateOrNull(dueDate)) errors.push('Due Date is required and must be a valid date');
      if (!currency) errors.push('Currency is required');
      if (!revenueAccountCode) errors.push('Revenue Account Code is required');
      if (!description) errors.push('Description is required');
      if (!(quantity > 0)) errors.push('Quantity must be > 0');
      if (!(unitPrice > 0)) errors.push('Unit Price must be > 0');

      if (errors.length === 0) {
        try {
          const gross = this.round2(this.toNum(quantity) * this.toNum(unitPrice));
          this.computeDiscount({
            gross,
            discountPercent,
            discountAmount,
          });
        } catch (e: any) {
          errors.push(String(e?.message ?? 'Invalid discount'));
        }
      }

      const invDateObj = this.parseYmdToDateOrNull(invoiceDate);
      const dueDateObj = this.parseYmdToDateOrNull(dueDate);
      if (invDateObj && dueDateObj && dueDateObj < invDateObj) {
        errors.push('Due Date cannot be earlier than Invoice Date');
      }

      return {
        rowNumber: r.rowNumber,
        invoiceRef,
        customerCode,
        invoiceDate,
        dueDate,
        revenueAccountCode,
        description,
        quantity,
        unitPrice,
        currency,
        discountPercent,
        discountAmount,
        errors,
        _isSample: false,
      };
    });

    const parsed = (parsedAll ?? []).filter((p: any) => !p._isSample);

    const customerCodes = [...new Set(parsed.map((p) => p.customerCode).filter(Boolean))];
    const accountCodes = [...new Set(parsed.map((p) => p.revenueAccountCode).filter(Boolean))];

    const [customersRaw, accountsRaw] = await Promise.all([
      (this.prisma as any).customer.findMany({
        where: { tenantId: tenant.id, customerCode: { in: customerCodes } },
        select: { id: true, customerCode: true, status: true },
      }),
      this.prisma.account.findMany({
        where: { tenantId: tenant.id, code: { in: accountCodes }, isActive: true },
        select: { id: true, code: true, type: true },
      }),
    ]);

    const customers = (customersRaw ?? []) as any[];
    const accounts = (accountsRaw ?? []) as any[];

    const customerByCode = new Map(customers.map((c: any) => [String(c.customerCode), c] as const));
    const accountByCode = new Map(accounts.map((a: any) => [String(a.code), a] as const));

    for (const p of parsed) {
      if (p.customerCode) {
        const c = customerByCode.get(p.customerCode);
        if (!c) p.errors.push('Customer not found');
        else if (c.status !== 'ACTIVE') p.errors.push('Customer is inactive');
      }
      if (p.revenueAccountCode) {
        const a = accountByCode.get(p.revenueAccountCode);
        if (!a) p.errors.push('Revenue account not found or inactive');
        else if (a.type !== 'INCOME') p.errors.push('Revenue account must be INCOME');
      }
      const invDate = this.parseYmdToDateOrNull(p.invoiceDate);
      if (invDate) {
        try {
          await this.assertOpenPeriodForInvoiceDate({ tenantId: tenant.id, invoiceDate: invDate });
        } catch (e: any) {
          p.errors.push(String(e?.message ?? 'Invoice Date period is not OPEN'));
        }
      }
    }

    // Group-level consistency checks: header fields must match within an invoiceRef group.
    const groups = new Map<string, any[]>();
    for (const p of parsed) {
      const key = String(p.invoiceRef ?? '').trim();
      if (!key) continue;
      const prev = groups.get(key) ?? [];
      prev.push(p);
      groups.set(key, prev);
    }

    for (const [invoiceRef, rows] of groups.entries()) {
      if (!rows || rows.length < 2) continue;
      const base = rows[0];
      const baseCustomer = String(base.customerCode ?? '').trim();
      const baseCurrency = String(base.currency ?? '').trim().toUpperCase();
      const baseInvDate = String(base.invoiceDate ?? '').trim();
      const baseDueDate = String(base.dueDate ?? '').trim();

      const mixedCustomer = rows.some((r) => String(r.customerCode ?? '').trim() !== baseCustomer);
      const mixedCurrency = rows.some((r) => String(r.currency ?? '').trim().toUpperCase() !== baseCurrency);
      const mixedInvDate = rows.some((r) => String(r.invoiceDate ?? '').trim() !== baseInvDate);
      const mixedDueDate = rows.some((r) => String(r.dueDate ?? '').trim() !== baseDueDate);

      if (!mixedCustomer && !mixedCurrency && !mixedInvDate && !mixedDueDate) continue;

      for (const r of rows) {
        if (mixedCustomer) r.errors.push(`Mixed customers in invoiceRef group: ${invoiceRef}`);
        if (mixedCurrency) r.errors.push(`Mixed currencies in invoiceRef group: ${invoiceRef}`);
        if (mixedInvDate || mixedDueDate) r.errors.push(`Mixed invoice/due dates in invoiceRef group: ${invoiceRef}`);
      }
    }

    const validCount = parsed.filter((p) => p.errors.length === 0).length;
    const invalidCount = parsed.length - validCount;

    return {
      importId,
      totalRows: parsed.length,
      validCount,
      invalidCount,
      rows: parsed,
    };
  }

  async import(req: Request, file: any, importIdRaw: string) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const importId = String(importIdRaw ?? '').trim();
    if (!importId) throw new BadRequestException('importId is required');

    try {
      await (this.prisma as any).customerInvoiceImportLog.create({
        data: {
          tenantId: tenant.id,
          importId,
          processedById: user.id,
        } as any,
      } as any);
    } catch (e: any) {
      const code = String(e?.code ?? '');
      if (code === 'P2002') {
        throw new BadRequestException('This import has already been processed.');
      }
      throw e;
    }

    const preview = await this.previewImport(req, file, { importId });
    const validRows = preview.rows.filter((r: any) => (r.errors ?? []).length === 0);
    const failedRows = preview.rows
      .filter((r: any) => (r.errors ?? []).length > 0)
      .map((r: any) => ({ rowNumber: r.rowNumber, reason: (r.errors ?? []).join('; ') }));

    if (validRows.length === 0) {
      return {
        totalRows: preview.totalRows,
        createdCount: 0,
        failedCount: failedRows.length,
        failedRows,
      };
    }

    const customerCodes = [...new Set(validRows.map((r: any) => r.customerCode))];
    const accountCodes = [...new Set(validRows.map((r: any) => r.revenueAccountCode))];

    const [customers, accounts] = await Promise.all([
      (this.prisma as any).customer.findMany({
        where: { tenantId: tenant.id, customerCode: { in: customerCodes } },
        select: { id: true, customerCode: true },
      }),
      this.prisma.account.findMany({
        where: { tenantId: tenant.id, code: { in: accountCodes }, isActive: true, type: 'INCOME' },
        select: { id: true, code: true },
      }),
    ]);

    const customerIdByCode = new Map(customers.map((c: any) => [String(c.customerCode), c.id] as const));
    const accountIdByCode = new Map(accounts.map((a: any) => [String(a.code), a.id] as const));

    const groups = new Map<string, any[]>();
    for (const r of validRows) {
      const key = String(r.invoiceRef ?? '').trim();
      if (!key) continue;
      const prev = groups.get(key) ?? [];
      prev.push(r);
      groups.set(key, prev);
    }

    let createdCount = 0;

    for (const [, rows] of groups.entries()) {
      try {
        const first = rows[0];
        const customerId = customerIdByCode.get(first.customerCode);
        const invoiceDate = this.parseYmdToDateOrNull(first.invoiceDate);
        const dueDate = this.parseYmdToDateOrNull(first.dueDate);

        if (!customerId || !invoiceDate || !dueDate) {
          throw new BadRequestException('Invalid grouping key');
        }

        if (dueDate < invoiceDate) {
          throw new BadRequestException('Due date cannot be earlier than invoice date');
        }

        await this.assertOpenPeriodForInvoiceDate({ tenantId: tenant.id, invoiceDate });

        // Ensure the customer is ACTIVE and snapshot details are captured
        const customer = await (this.prisma as any).customer.findFirst({
          where: { tenantId: tenant.id, id: customerId },
          select: { id: true, status: true, name: true, email: true, billingAddress: true },
        });
        if (!customer) throw new BadRequestException('Customer not found');
        if ((customer as any).status !== 'ACTIVE') throw new BadRequestException('Customer is inactive');

        const tenantCurrency = String((tenant as any)?.defaultCurrency ?? '').trim();
        const exchangeRate =
          tenantCurrency && String(first.currency).trim().toUpperCase() === tenantCurrency.toUpperCase()
            ? 1
            : 1;

        const computedLines = rows.map((rr) => {
          const accountId = accountIdByCode.get(rr.revenueAccountCode);
          if (!accountId) throw new BadRequestException('Revenue account not found');
          const qty = this.toNum(rr.quantity ?? 1);
          const unitPrice = this.toNum(rr.unitPrice ?? 0);
          if (!(qty > 0)) throw new BadRequestException('Quantity must be > 0');
          if (!(unitPrice > 0)) throw new BadRequestException('Unit Price must be > 0');
          const gross = this.round2(qty * unitPrice);
          const disc = this.computeDiscount({
            gross,
            discountPercent: (rr as any).discountPercent,
            discountAmount: (rr as any).discountAmount,
          });
          const lineTotal = this.round2(gross - disc.discountTotal);
          return {
            accountId,
            description: String(rr.description ?? '').trim(),
            quantity: qty,
            unitPrice,
            discountPercent: disc.discountPercent,
            discountAmount: disc.discountAmount,
            discountTotal: disc.discountTotal,
            lineTotal,
          };
        });

        const subtotal = this.round2(computedLines.reduce((s, l) => s + l.lineTotal, 0));
        const taxAmount = 0;
        const totalAmount = this.round2(subtotal + taxAmount);

        await this.prisma.$transaction(async (tx) => {
          const invoiceNumber = await this.nextInvoiceNumber(tx, tenant.id);
          await tx.customerInvoice.create({
            data: {
              tenantId: tenant.id,
              customerId,
              invoiceNumber,
              invoiceDate,
              dueDate,
              currency: String(first.currency).trim(),
              exchangeRate,
              customerNameSnapshot: String((customer as any).name ?? '').trim(),
              customerEmailSnapshot: (customer as any).email ? String((customer as any).email).trim() : undefined,
              customerBillingAddressSnapshot: (customer as any).billingAddress ? String((customer as any).billingAddress).trim() : undefined,
              subtotal,
              taxAmount,
              totalAmount,
              status: 'DRAFT',
              createdById: user.id,
              lines: {
                create: computedLines.map((l) => ({
                  accountId: l.accountId,
                  description: l.description,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  discountPercent: (l as any).discountPercent ?? undefined,
                  discountAmount: (l as any).discountAmount ?? undefined,
                  discountTotal: (l as any).discountTotal ?? 0,
                  lineTotal: l.lineTotal,
                })),
              },
            } as any,
          } as any);
        });

        createdCount += 1;
      } catch (e: any) {
        for (const rr of rows) {
          failedRows.push({
            rowNumber: rr.rowNumber,
            reason: String(e?.message ?? 'Failed to create invoice'),
          });
        }
      }
    }

    return {
      totalRows: preview.totalRows,
      createdCount,
      failedCount: failedRows.length,
      failedRows,
    };
  }

  async exportInvoice(req: Request, id: string, opts: { format: 'html' | 'pdf' }) {
    const tenant = this.ensureTenant(req);

    const inv = await this.prisma.customerInvoice.findFirst({
      where: { id, tenantId: tenant.id } as any,
      include: { lines: true, customer: true } as any,
    });

    if (!inv) throw new NotFoundException('Invoice not found');
    if ((inv as any).status !== 'POSTED') {
      throw new BadRequestException('Invoice export is available for POSTED invoices only');
    }

    const tenantName = String((tenant as any).legalName ?? (tenant as any).organisationName ?? '');
    const invoiceNumber = String((inv as any).invoiceNumber ?? '').trim();
    const currency = String((inv as any).currency ?? '').trim();
    const invoiceNote = String((inv as any).invoiceNote ?? '').trim();

    const invLines = ((inv as any).lines ?? []).map((l: any) => {
      const qty = Number(l.quantity ?? 0);
      const unitPrice = Number(l.unitPrice ?? 0);
      const discountTotal = Number(l.discountTotal ?? 0);
      const lineTotal = Number(l.lineTotal ?? 0);
      const discountPercent = Number(l.discountPercent ?? 0);
      const discountAmount = Number(l.discountAmount ?? 0);
      return {
        description: String(l.description ?? ''),
        qty,
        unitPrice,
        discountPercent,
        discountAmount,
        discountTotal,
        lineTotal,
      };
    });
    const hasDiscount = invLines.some((l) => (l.discountTotal ?? 0) > 0);
    const discountTotalSum = this.round2(invLines.reduce((s, l) => s + (Number(l.discountTotal ?? 0) || 0), 0));
    const grossSubtotal = this.round2(invLines.reduce((s, l) => s + this.round2(Number(l.qty ?? 0) * Number(l.unitPrice ?? 0)), 0));

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${invoiceNumber}</title>
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
      .totals { width: 320px; margin-left: auto; }
      .totals .line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
      .totals .grand { font-weight: 700; border-top: 1px solid #E4E7EC; margin-top: 8px; padding-top: 10px; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="brand">
        <h1>${tenantName || 'Invoice'}</h1>
        <div class="muted">Prepared in accordance with IFRS</div>
      </div>
      <div class="card" style="min-width: 280px;">
        <div><b>Invoice:</b> ${invoiceNumber}</div>
        <div><b>Date:</b> ${String((inv as any).invoiceDate).slice(0, 10)}</div>
        <div><b>Due:</b> ${String((inv as any).dueDate).slice(0, 10)}</div>
        <div><b>Currency:</b> ${currency}</div>
      </div>
    </div>

    <div class="row block">
      <div class="card" style="flex: 1;">
        <div style="font-weight: 700; margin-bottom: 6px;">Bill To</div>
        <div>${String((inv as any).customerNameSnapshot || (inv as any).customer?.name || '').trim()}</div>
        ${(inv as any).customerEmailSnapshot ? `<div class="muted">${String((inv as any).customerEmailSnapshot)}</div>` : ''}
        ${(inv as any).customerBillingAddressSnapshot ? `<div class="muted" style="margin-top: 6px; white-space: pre-wrap;">${String((inv as any).customerBillingAddressSnapshot)}</div>` : ''}
      </div>
    </div>

    <div class="block">
      <table>
        <thead>
          <tr>
            <th class="num" style="width: 52px;">Line #</th>
            <th>Description</th>
            <th class="num">Qty</th>
            <th class="num">Unit Price</th>
            ${hasDiscount ? '<th class="num">Discount</th>' : ''}
            <th class="num">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${invLines
            .map((l: any, idx: number) => {
              const discountText = l.discountTotal > 0
                ? (l.discountPercent > 0 ? `${l.discountPercent.toFixed(2)}%` : `${this.formatMoney(l.discountTotal, currency)}`)
                : '';
              return `<tr>
                <td class="num">${idx + 1}</td>
                <td>${this.escapeHtml(l.description)}</td>
                <td class="num">${this.formatMoney(l.qty, currency)}</td>
                <td class="num">${this.formatMoney(l.unitPrice, currency)}</td>
                ${hasDiscount ? `<td class="num">${this.escapeHtml(discountText)}</td>` : ''}
                <td class="num">${this.formatMoney(l.lineTotal, currency)}</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>

      <div class="totals">
        ${hasDiscount ? `<div class="line"><span>Gross Subtotal</span><span>${this.formatMoney(grossSubtotal, currency)}</span></div>` : ''}
        ${hasDiscount ? `<div class="line"><span>Less: Discount</span><span>${this.formatMoney(discountTotalSum, currency)}</span></div>` : ''}
        <div class="line"><span>${hasDiscount ? 'Net Subtotal' : 'Subtotal'}</span><span>${this.formatMoney(Number((inv as any).subtotal ?? 0), currency)}</span></div>
        <div class="line"><span>Tax</span><span>${this.formatMoney(Number((inv as any).taxAmount ?? 0), currency)}</span></div>
        <div class="line grand"><span>Total</span><span>${this.formatMoney(Number((inv as any).totalAmount ?? 0), currency)}</span></div>
      </div>
    </div>

    <div class="block">
      <div class="card">
        <div style="font-weight: 700;">Bank Details</div>
        <div class="muted" style="margin-top: 6px;">
          Bank Name: FNB<br/>
          Account Name: Uspire Professional Services Ltd<br/>
          Account Number: 63144493680<br/>
          Branch Name/Number: Commercial Suite / 260001<br/>
          Swift Code: FIRNZMLX
        </div>
      </div>
    </div>

    ${invoiceNote ? `<div class="block"><div class="card"><div style="font-weight: 700;">Note</div><div style="margin-top: 6px; white-space: pre-wrap;">${this.escapeHtml(invoiceNote)}</div></div></div>` : ''}
  </body>
</html>`;

    if (opts.format === 'pdf') {
      let PDFDocument: any;
      try {
        PDFDocument = require('pdfkit');
      } catch {
        throw new BadRequestException('PDF export not available (missing dependency pdfkit)');
      }

      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      doc.on('data', (d: any) => chunks.push(Buffer.from(d)));
      const done = new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });

      doc.font('Helvetica-Bold').fontSize(16).text(tenantName || 'Invoice', { align: 'center' });
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10).fillColor('#444').text('Prepared in accordance with IFRS', { align: 'center' });
      doc.fillColor('#000');
      doc.moveDown(1);

      doc.font('Helvetica-Bold').fontSize(11).text(`Invoice: ${invoiceNumber}`);
      doc.font('Helvetica').fontSize(10).text(`Date: ${String((inv as any).invoiceDate).slice(0, 10)}`);
      doc.text(`Due: ${String((inv as any).dueDate).slice(0, 10)}`);
      doc.text(`Currency: ${currency}`);
      doc.moveDown(1);

      doc.font('Helvetica-Bold').text('Bill To');
      doc.font('Helvetica').text(String((inv as any).customerNameSnapshot || (inv as any).customer?.name || '').trim());
      if ((inv as any).customerEmailSnapshot) doc.text(String((inv as any).customerEmailSnapshot));
      if ((inv as any).customerBillingAddressSnapshot) doc.text(String((inv as any).customerBillingAddressSnapshot));
      doc.moveDown(1);

      // Lines table
      const startX = doc.page.margins.left;
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const col = {
        line: startX,
        desc: startX + 40,
        qty: startX + (hasDiscount ? 300 : 340),
        unit: startX + (hasDiscount ? 370 : 420),
        disc: startX + 450,
        total: startX + (hasDiscount ? 520 : 520),
      };
      const descWidth = (hasDiscount ? 250 : 290);

      const headerY = doc.y;
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text('Line #', col.line, headerY, { width: 40, align: 'right' });
      doc.text('Description', col.desc, headerY, { width: descWidth, align: 'left' });
      doc.text('Quantity', col.qty, headerY, { width: 70, align: 'right' });
      doc.text('Unit Price', col.unit, headerY, { width: 80, align: 'right' });
      if (hasDiscount) {
        doc.text('Discount', col.disc, headerY, { width: 70, align: 'right' });
      }
      doc.text('Line Total', col.total, headerY, { width: 80, align: 'right' });
      doc.moveDown(0.5);
      doc.moveTo(startX, doc.y).lineTo(startX + pageWidth, doc.y).strokeColor('#E4E7EC').stroke();
      doc.strokeColor('#000');
      doc.moveDown(0.4);

      doc.font('Helvetica').fontSize(9);
      invLines.forEach((l, idx) => {
        const y0 = doc.y;
        const discountText = hasDiscount
          ? l.discountTotal > 0
            ? (l.discountPercent > 0 ? `${l.discountPercent.toFixed(2)}%` : this.formatMoney(l.discountTotal, currency))
            : ''
          : '';

        doc.text(String(idx + 1), col.line, y0, { width: 40, align: 'right' });
        doc.text(String(l.description ?? ''), col.desc, y0, { width: descWidth, align: 'left' });
        doc.text(this.formatMoney(l.qty, currency), col.qty, y0, { width: 70, align: 'right' });
        doc.text(this.formatMoney(l.unitPrice, currency), col.unit, y0, { width: 80, align: 'right' });
        if (hasDiscount) {
          doc.text(discountText, col.disc, y0, { width: 70, align: 'right' });
        }
        doc.text(this.formatMoney(l.lineTotal, currency), col.total, y0, { width: 80, align: 'right' });

        doc.moveDown(0.9);
      });
      doc.moveDown(0.5);

      if (hasDiscount) {
        doc.font('Helvetica-Bold').text(`Gross Subtotal: ${this.formatMoney(grossSubtotal, currency)}`, { align: 'right' });
        doc.font('Helvetica-Bold').text(`Less: Discount: ${this.formatMoney(discountTotalSum, currency)}`, { align: 'right' });
        doc.font('Helvetica-Bold').text(`Net Subtotal: ${this.formatMoney(Number((inv as any).subtotal ?? 0), currency)}`, { align: 'right' });
      } else {
        doc.font('Helvetica-Bold').text(`Subtotal: ${this.formatMoney(Number((inv as any).subtotal ?? 0), currency)}`, { align: 'right' });
      }
      doc.font('Helvetica-Bold').text(`Tax: ${this.formatMoney(Number((inv as any).taxAmount ?? 0), currency)}`, { align: 'right' });
      doc.font('Helvetica-Bold').text(`Total: ${this.formatMoney(Number((inv as any).totalAmount ?? 0), currency)}`, { align: 'right' });
      doc.moveDown(1);

      doc.font('Helvetica-Bold').fontSize(10).text('Bank Details');
      doc.font('Helvetica').fontSize(9);
      doc.text('Bank Name: FNB');
      doc.text('Account Name: Uspire Professional Services Ltd');
      doc.text('Account Number: 63144493680');
      doc.text('Branch Name/Number: Commercial Suite / 260001');
      doc.text('Swift Code: FIRNZMLX');
      doc.moveDown(0.8);

      if (invoiceNote) {
        doc.font('Helvetica-Bold').fontSize(10).text('Note');
        doc.font('Helvetica').fontSize(9).text(invoiceNote);
        doc.moveDown(0.6);
      }

      doc.end();
      const pdf = await done;
      return {
        fileName: `Invoice-${invoiceNumber}.pdf`,
        contentType: 'application/pdf',
        body: pdf,
      };
    }

    return {
      fileName: `Invoice-${invoiceNumber}.html`,
      contentType: 'text/html; charset=utf-8',
      body: html,
    };
  }
}
