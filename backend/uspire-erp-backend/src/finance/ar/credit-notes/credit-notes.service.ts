import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { GlService } from '../../../gl/gl.service';
import { PERMISSIONS } from '../../../rbac/permission-catalog';
import { writeAuditEventWithPrisma } from '../../../audit/audit-writer';
import { AuditEntityType, AuditEventType } from '@prisma/client';
import { assertPeriodIsOpen } from '../../common/accounting-period.guard';
import { resolveArControlAccount } from '../../common/resolve-ar-control-account';
import { ReportExportService } from '../../../reports/report-export.service';
import type {
  ApproveCreditNoteDto,
  CreateCustomerCreditNoteDto,
  ListCreditNotesQueryDto,
  SubmitCreditNoteDto,
  VoidCreditNoteDto,
} from './credit-notes.dto';

@Injectable()
export class FinanceArCreditNotesService {
  private readonly CREDIT_NOTE_NUMBER_SEQUENCE_NAME = 'AR_CREDIT_NOTE_NUMBER';

  constructor(
    private readonly prisma: PrismaService,
    private readonly gl: GlService,
    private readonly exports: ReportExportService,
  ) {}

  async exportPdf(req: Request, id: string): Promise<Buffer> {
    const tenant: any = (req as any).tenant;
    const entityLegalName = String(tenant?.legalName ?? '').trim();
    const currencyIsoCode = String(tenant?.defaultCurrency ?? '').trim();
    if (!entityLegalName || !currencyIsoCode) {
      throw new BadRequestException(
        'Missing tenant PDF metadata (legalName/defaultCurrency). Configure tenant settings before exporting.',
      );
    }

    const cn = await this.getById(req, id);
    return this.exports.creditNoteToPdf({
      creditNote: cn as any,
      header: {
        entityLegalName,
        reportName: 'Customer Credit Note',
        periodLine: `Credit Note Date: ${String((cn as any)?.creditNoteDate ?? '')}`,
        currencyIsoCode,
        headerFooterLine: `Currency: ${String((cn as any)?.currency ?? currencyIsoCode)}`,
      },
    });
  }

  private round2(n: number) {
    return Math.round(Number(n ?? 0) * 100) / 100;
  }

  private round6(n: number) {
    return Math.round(Number(n ?? 0) * 1_000_000) / 1_000_000;
  }

  private toNum(v: any) {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
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

  private async auditLifecycle(params: {
    req: Request;
    eventType:
      | 'AR_CREDIT_NOTE_CREATED'
      | 'AR_CREDIT_NOTE_SUBMITTED'
      | 'AR_CREDIT_NOTE_APPROVED'
      | 'AR_CREDIT_NOTE_POSTED'
      | 'AR_CREDIT_NOTE_VOIDED';
    creditNoteId: string;
    invoiceId: string | null;
    amount: number;
    previousStatus: string | null;
    newStatus: string;
    permissionUsed: string;
    outcome: 'SUCCESS' | 'BLOCKED' | 'FAILED';
    reason?: string;
  }) {
    const tenant = this.ensureTenant(params.req);
    const user = this.ensureUser(params.req);

    const lifecycleType =
      params.eventType === 'AR_CREDIT_NOTE_CREATED'
        ? 'CREATE'
        : params.eventType === 'AR_CREDIT_NOTE_SUBMITTED'
          ? 'SUBMIT'
          : params.eventType === 'AR_CREDIT_NOTE_APPROVED'
            ? 'APPROVE'
            : params.eventType === 'AR_CREDIT_NOTE_POSTED'
              ? 'POST'
              : 'VOID';

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.AR_POST,
        entityType: AuditEntityType.CUSTOMER_INVOICE,
        entityId: params.creditNoteId,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: params.outcome as any,
        action: params.eventType,
        permissionUsed: params.permissionUsed,
        lifecycleType: lifecycleType as any,
        reason: params.reason,
        metadata: {
          entityTypeRaw: 'CUSTOMER_CREDIT_NOTE',
          creditNoteId: params.creditNoteId,
          invoiceId: params.invoiceId,
          amount: params.amount,
          performedBy: user.id,
          previousStatus: params.previousStatus,
          newStatus: params.newStatus,
        },
      },
      this.prisma,
    );
  }

  private parseYmdToDateOrNull(s: any): Date | null {
    const v = String(s ?? '').trim();
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  private async nextCreditNoteNumber(tx: any, tenantId: string) {
    const counter = await tx.tenantSequenceCounter.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: this.CREDIT_NOTE_NUMBER_SEQUENCE_NAME,
        },
      },
      create: {
        tenantId,
        name: this.CREDIT_NOTE_NUMBER_SEQUENCE_NAME,
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

    return String(bumped.value);
  }

  private normalizeMoney(n: number) {
    return this.round2(Number(n ?? 0));
  }

  private async computeInvoiceOutstanding(params: {
    tenantId: string;
    invoiceId: string;
  }) {
    const inv = await this.prisma.customerInvoice.findFirst({
      where: {
        tenantId: params.tenantId,
        id: params.invoiceId,
        status: 'POSTED' as any,
      } as any,
      select: {
        id: true,
        customerId: true,
        currency: true,
        subtotal: true,
        totalAmount: true,
      } as any,
    });
    if (!inv) throw new NotFoundException('Invoice not found');

    const invoiceSubtotalNet = this.normalizeMoney(Number((inv as any).subtotal ?? 0));
    const invoiceTotalGross = this.normalizeMoney(Number((inv as any).totalAmount ?? 0));

    const receiptAppliedAgg = await (this.prisma as any).customerReceiptLine.groupBy(
      {
        by: ['invoiceId'],
        where: {
          tenantId: params.tenantId,
          invoiceId: params.invoiceId,
          receipt: { tenantId: params.tenantId, status: 'POSTED' },
        } as any,
        _sum: { appliedAmount: true },
      },
    );
    const receiptAppliedGross = this.normalizeMoney(
      Number(receiptAppliedAgg?.[0]?._sum?.appliedAmount ?? 0),
    );

    const creditAggGross = await (this.prisma as any).customerCreditNote.aggregate({
      where: {
        tenantId: params.tenantId,
        invoiceId: params.invoiceId,
        status: 'POSTED',
      } as any,
      _sum: { totalAmount: true },
    });
    const creditAppliedGross = this.normalizeMoney(
      Number(creditAggGross?._sum?.totalAmount ?? 0),
    );

    const creditAggNet = await (this.prisma as any).customerCreditNote.aggregate({
      where: {
        tenantId: params.tenantId,
        invoiceId: params.invoiceId,
        status: 'POSTED',
      } as any,
      _sum: { subtotal: true },
    });
    const creditAppliedNet = this.normalizeMoney(
      Number(creditAggNet?._sum?.subtotal ?? 0),
    );

    const receiptAppliedNet =
      invoiceTotalGross > 0
        ? this.normalizeMoney(
            receiptAppliedGross * (invoiceSubtotalNet / invoiceTotalGross),
          )
        : 0;

    const outstanding = this.normalizeMoney(
      invoiceSubtotalNet - receiptAppliedNet - creditAppliedNet,
    );

    return {
      invoice: {
        id: inv.id,
        customerId: (inv as any).customerId,
        currency: (inv as any).currency,
        totalAmount: invoiceTotalGross,
      },
      receiptApplied: receiptAppliedGross,
      creditApplied: creditAppliedGross,
      outstanding,
    };
  }

  async listEligibleCustomers(req: Request) {
    const tenant = this.ensureTenant(req);

    const customers = await (this.prisma as any).customer.findMany({
      where: {
        tenantId: tenant.id,
        invoices: {
          some: {
            tenantId: tenant.id,
            status: 'POSTED',
          },
        },
      } as any,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        customerCode: true,
      } as any,
    });

    return {
      items: (customers ?? []).map((c: any) => ({
        customerId: c.id,
        customerName: c.name,
        customerCode: c.customerCode ?? null,
      })),
    };
  }

  async listEligibleInvoices(req: Request, customerId: string) {
    const tenant = this.ensureTenant(req);

    const cid = String(customerId ?? '').trim();
    if (!cid) throw new BadRequestException('customerId is required');

    const invoices = await (this.prisma as any).customerInvoice.findMany({
      where: {
        tenantId: tenant.id,
        customerId: cid,
        status: 'POSTED',
      } as any,
      orderBy: [{ invoiceDate: 'desc' }, { invoiceNumber: 'desc' }],
      select: {
        id: true,
        invoiceNumber: true,
        currency: true,
      } as any,
    });

    const computed = await Promise.all(
      (invoices ?? []).map(async (inv: any) => {
        const out = await this.computeInvoiceOutstanding({
          tenantId: tenant.id,
          invoiceId: String(inv.id),
        });
        return {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          currency: String(inv.currency ?? '').trim(),
          outstandingBalance: Number(out.outstanding ?? 0),
        };
      }),
    );

    const items = (computed ?? [])
      .filter((x: any) => Number(x.outstandingBalance ?? 0) > 0)
      .sort((a: any, b: any) => String(b.invoiceNumber ?? '').localeCompare(String(a.invoiceNumber ?? '')));

    return { items };
  }

  async list(req: Request, q: ListCreditNotesQueryDto) {
    const tenant = this.ensureTenant(req);

    const page = Number(q.page ?? 1);
    const pageSize = Number(q.pageSize ?? 50);
    const take = pageSize;
    const skip = (page - 1) * pageSize;

    const where: any = { tenantId: tenant.id };
    const status = String(q.status ?? '').trim();
    if (status) where.status = status;

    const customerId = String(q.customerId ?? '').trim();
    if (customerId) where.customerId = customerId;

    const invoiceId = String(q.invoiceId ?? '').trim();
    if (invoiceId) where.invoiceId = invoiceId;

    const search = String(q.search ?? '').trim();
    if (search) {
      where.OR = [
        { creditNoteNumber: { contains: search, mode: 'insensitive' } },
        { memo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const dateFrom = String((q as any).dateFrom ?? '').trim();
    const dateTo = String((q as any).dateTo ?? '').trim();
    if (dateFrom || dateTo) {
      where.creditNoteDate = {};
      if (dateFrom) where.creditNoteDate.gte = new Date(dateFrom);
      if (dateTo) where.creditNoteDate.lte = new Date(dateTo);
    }

    const [items, total] = await Promise.all([
      (this.prisma as any).customerCreditNote.findMany({
        where,
        orderBy: [{ creditNoteDate: 'desc' }, { creditNoteNumber: 'desc' }],
        take,
        skip,
        include: {
          customer: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        } as any,
      }),
      (this.prisma as any).customerCreditNote.count({ where }),
    ]);

    return {
      items: (items ?? []).map((cn: any) => ({
        id: cn.id,
        creditNoteNumber: cn.creditNoteNumber,
        creditNoteDate: cn.creditNoteDate?.toISOString?.().slice(0, 10) ?? null,
        customerId: cn.customerId,
        customerName: cn.customer?.name ?? null,
        invoiceId: cn.invoiceId ?? null,
        invoiceNumber: cn.invoice?.invoiceNumber ?? null,
        currency: cn.currency,
        exchangeRate: Number(cn.exchangeRate ?? 1),
        subtotal: Number(cn.subtotal),
        taxAmount: Number(cn.taxAmount ?? 0),
        isTaxable: Boolean(cn.isTaxable ?? false),
        totalAmount: Number(cn.totalAmount),
        status: cn.status,
        createdById: cn.createdById,
        approvedById: cn.approvedById ?? null,
        postedById: cn.postedById ?? null,
        createdAt: cn.createdAt?.toISOString?.() ?? null,
        approvedAt: cn.approvedAt?.toISOString?.() ?? null,
        postedAt: cn.postedAt?.toISOString?.() ?? null,
        voidedAt: cn.voidedAt?.toISOString?.() ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getById(req: Request, id: string) {
    const tenant = this.ensureTenant(req);

    const cn = await (this.prisma as any).customerCreditNote.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        customer: true,
        invoice: true,
        lines: { include: { revenueAccount: true } },
        postedJournal: true,
      } as any,
    });

    if (!cn) throw new NotFoundException('Credit note not found');

    const invoiceId = cn.invoiceId ?? null;
    const invoiceSummary = invoiceId
      ? await this.computeInvoiceOutstanding({
          tenantId: tenant.id,
          invoiceId: String(invoiceId),
        }).catch(() => null)
      : null;

    return {
      id: cn.id,
      creditNoteNumber: cn.creditNoteNumber,
      creditNoteDate: cn.creditNoteDate?.toISOString?.().slice(0, 10) ?? null,
      customerId: cn.customerId,
      customerName: cn.customer?.name ?? '',
      invoiceId,
      invoiceNumber: cn.invoice?.invoiceNumber ?? null,
      invoiceSummary: invoiceSummary
        ? {
            invoiceId: invoiceSummary.invoice.id,
            invoiceNumber: cn.invoice?.invoiceNumber ?? null,
            invoiceTotal: Number(invoiceSummary.invoice.totalAmount ?? 0),
            paid: Number(invoiceSummary.receiptApplied ?? 0),
            credited: Number(invoiceSummary.creditApplied ?? 0),
            outstanding: Number(invoiceSummary.outstanding ?? 0),
          }
        : null,
      memo: cn.memo ?? null,
      currency: cn.currency,
      exchangeRate: Number(cn.exchangeRate ?? 1),
      subtotal: Number(cn.subtotal),
      taxAmount: Number((cn as any).taxAmount ?? 0),
      isTaxable: Boolean((cn as any).isTaxable ?? false),
      totalAmount: Number(cn.totalAmount),
      status: cn.status,
      createdById: cn.createdById,
      approvedById: cn.approvedById ?? null,
      postedById: cn.postedById ?? null,
      voidedById: cn.voidedById ?? null,
      voidReason: cn.voidReason ?? null,
      postedJournalId: cn.postedJournalId ?? null,
      createdAt: cn.createdAt?.toISOString?.() ?? null,
      approvedAt: cn.approvedAt?.toISOString?.() ?? null,
      postedAt: cn.postedAt?.toISOString?.() ?? null,
      voidedAt: cn.voidedAt?.toISOString?.() ?? null,
      lines: (cn.lines ?? []).map((l: any) => ({
        id: l.id,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        lineAmount: Number(l.lineAmount),
        revenueAccountId: l.revenueAccountId,
        revenueAccountCode: l.revenueAccount?.code ?? null,
        departmentId: l.departmentId ?? null,
        projectId: l.projectId ?? null,
        fundId: l.fundId ?? null,
      })),
    };
  }

  async create(req: Request, dto: CreateCustomerCreditNoteDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const creditNoteDate = this.parseYmdToDateOrNull(dto.creditNoteDate);
    if (!creditNoteDate) throw new BadRequestException('creditNoteDate is required');

    const currency = String(dto.currency ?? '').trim();
    if (!currency) throw new BadRequestException('currency is required');

    const tenantCurrency = String((tenant as any)?.defaultCurrency ?? '').trim();
    const exchangeRate =
      tenantCurrency && currency.toUpperCase() === tenantCurrency.toUpperCase()
        ? 1
        : this.round6(this.toNum((dto as any).exchangeRate ?? 0));
    if (!(exchangeRate > 0)) {
      throw new BadRequestException(
        'exchangeRate is required and must be > 0 for non-base currency',
      );
    }

    const customer = await (this.prisma as any).customer.findFirst({
      where: { id: dto.customerId, tenantId: tenant.id },
      select: { id: true, status: true },
    });
    if (!customer) throw new BadRequestException('Customer not found');
    if (String(customer.status) !== 'ACTIVE') {
      throw new BadRequestException(
        'Customer is inactive and cannot be used for new transactions.',
      );
    }

    const invoiceId = String(dto.invoiceId ?? '').trim() || null;
    let invoiceTaxable = false;
    let invoiceTaxAmount = 0;
    let invoiceSubtotal = 0;
    if (invoiceId) {
      const inv = await (this.prisma as any).customerInvoice.findFirst({
        where: { tenantId: tenant.id, id: invoiceId },
        select: {
          id: true,
          customerId: true,
          currency: true,
          status: true,
          isTaxable: true,
          taxAmount: true,
          subtotal: true,
        },
      });
      if (!inv) throw new BadRequestException('Invoice not found');
      if (String(inv.customerId) !== String(dto.customerId)) {
        throw new BadRequestException('Invoice customer does not match credit note customer');
      }
      if (String(inv.currency ?? '') !== currency) {
        throw new BadRequestException('Credit note currency must match invoice currency');
      }
      if (String(inv.status) !== 'POSTED') {
        throw new BadRequestException('Credit note can only be applied to a POSTED invoice');
      }

      invoiceTaxable = Boolean((inv as any).isTaxable);
      invoiceTaxAmount = this.normalizeMoney(Number((inv as any).taxAmount ?? 0));
      invoiceSubtotal = this.normalizeMoney(Number((inv as any).subtotal ?? 0));
    }

    if (!dto.lines || dto.lines.length < 1) {
      throw new BadRequestException('Credit note must have at least 1 line');
    }

    const accountIds = [...new Set(dto.lines.map((l: any) => l.revenueAccountId))];
    const accounts = await this.prisma.account.findMany({
      where: { tenantId: tenant.id, id: { in: accountIds }, isActive: true },
      select: { id: true, type: true },
    });
    const byId = new Map(accounts.map((a) => [a.id, a] as const));

    const computedLines = dto.lines.map((l: any) => {
      const qty = this.toNum(l.quantity ?? 1);
      const unitPrice = this.toNum(l.unitPrice);
      const description = String(l.description ?? '').trim();

      if (!description) {
        throw new BadRequestException('Credit note line description is required');
      }
      if (!(qty > 0)) {
        throw new BadRequestException('Credit note line quantity must be > 0');
      }
      if (!(unitPrice > 0)) {
        throw new BadRequestException('Credit note line unitPrice must be > 0');
      }

      const acct = byId.get(l.revenueAccountId);
      if (!acct) {
        throw new BadRequestException('One or more revenue accounts were not found or inactive');
      }
      if (String((acct as any).type) !== 'INCOME') {
        throw new BadRequestException('Credit note revenueAccountId must be an INCOME account');
      }

      const lineAmount = this.round2(qty * unitPrice);
      if (!(lineAmount > 0)) {
        throw new BadRequestException('Credit note lineAmount must be > 0');
      }

      return {
        description,
        quantity: this.round2(qty),
        unitPrice: this.round2(unitPrice),
        lineAmount,
        revenueAccountId: l.revenueAccountId,
        departmentId: l.departmentId ? String(l.departmentId) : null,
        projectId: l.projectId ? String(l.projectId) : null,
        fundId: l.fundId ? String(l.fundId) : null,
      };
    });

    const subtotal = this.round2(
      computedLines.reduce((s: number, l: any) => s + l.lineAmount, 0),
    );
    const taxAmount = invoiceId
      ? this.normalizeMoney(
          invoiceTaxable && invoiceSubtotal > 0
            ? (subtotal * invoiceTaxAmount) / invoiceSubtotal
            : 0,
        )
      : 0;
    const isTaxable = invoiceId ? Boolean(invoiceTaxable && taxAmount > 0) : false;
    const totalAmount = this.normalizeMoney(subtotal + taxAmount);

    const created = await this.prisma.$transaction(async (tx) => {
      const creditNoteNumber = await this.nextCreditNoteNumber(tx, tenant.id);
      return (tx as any).customerCreditNote.create({
        data: {
          tenantId: tenant.id,
          creditNoteNumber,
          creditNoteDate,
          customerId: dto.customerId,
          invoiceId,
          memo: dto.memo ? String(dto.memo) : null,
          currency,
          exchangeRate,
          subtotal,
          taxAmount,
          isTaxable,
          totalAmount,
          status: 'DRAFT',
          createdById: user.id,
          lines: {
            create: computedLines.map((l: any) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineAmount: l.lineAmount,
              revenueAccountId: l.revenueAccountId,
              departmentId: l.departmentId ?? undefined,
              projectId: l.projectId ?? undefined,
              fundId: l.fundId ?? undefined,
            })),
          },
        } as any,
        select: { id: true },
      });
    });

    await this.auditLifecycle({
      req,
      eventType: 'AR_CREDIT_NOTE_CREATED',
      creditNoteId: created.id,
      invoiceId,
      amount: totalAmount,
      previousStatus: null,
      newStatus: 'DRAFT',
      permissionUsed: PERMISSIONS.AR.CREDIT_NOTE_CREATE_RBAC,
      outcome: 'SUCCESS',
    });

    return this.getById(req, created.id);
  }

  async submit(req: Request, id: string, dto: SubmitCreditNoteDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const cn = await (this.prisma as any).customerCreditNote.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        status: true,
        creditNoteDate: true,
        invoiceId: true,
        totalAmount: true,
        subtotal: true,
      } as any,
    });
    if (!cn) throw new NotFoundException('Credit note not found');

    if (String(cn.status) !== 'DRAFT') {
      throw new BadRequestException(`Credit note cannot be submitted from status: ${cn.status}`);
    }

    const creditNoteDate = new Date(cn.creditNoteDate);
    try {
      await assertPeriodIsOpen({
        prisma: this.prisma,
        tenantId: tenant.id,
        date: creditNoteDate,
        action: 'create',
        documentLabel: 'Credit Note',
        dateLabel: 'credit note date',
      });
    } catch {
      throw new ForbiddenException('Cannot submit in a closed period');
    }

    if (cn.invoiceId) {
      const outstanding = await this.computeInvoiceOutstanding({
        tenantId: tenant.id,
        invoiceId: cn.invoiceId,
      });
      const totalAmount = this.normalizeMoney(Number(cn.subtotal ?? 0));

      if (totalAmount > outstanding.outstanding) {
        throw new BadRequestException(
          'Credit note exceeds the outstanding balance of the invoice.',
        );
      }
    }

    await (this.prisma as any).customerCreditNote.update({
      where: { id: cn.id },
      data: {
        status: 'SUBMITTED',
        ...(dto.memo !== undefined ? { memo: dto.memo ? String(dto.memo) : null } : {}),
      } as any,
    });

    await this.auditLifecycle({
      req,
      eventType: 'AR_CREDIT_NOTE_SUBMITTED',
      creditNoteId: cn.id,
      invoiceId: cn.invoiceId ?? null,
      amount: this.normalizeMoney(Number((cn as any).totalAmount ?? 0)),
      previousStatus: String(cn.status),
      newStatus: 'SUBMITTED',
      permissionUsed: PERMISSIONS.AR.CREDIT_NOTE_CREATE,
      outcome: 'SUCCESS',
    });

    return this.getById(req, cn.id);
  }

  async approve(req: Request, id: string, dto: ApproveCreditNoteDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const cn = await (this.prisma as any).customerCreditNote.findFirst({
      where: { id, tenantId: tenant.id },
      include: { lines: true, invoice: true } as any,
    });
    if (!cn) throw new NotFoundException('Credit note not found');

    if (String(cn.status) !== 'SUBMITTED') {
      throw new BadRequestException(`Credit note cannot be approved from status: ${cn.status}`);
    }

    const creditNoteDate = new Date(cn.creditNoteDate);
    try {
      await assertPeriodIsOpen({
        prisma: this.prisma,
        tenantId: tenant.id,
        date: creditNoteDate,
        action: 'create',
        documentLabel: 'Credit Note',
        dateLabel: 'credit note date',
      });
    } catch {
      throw new ForbiddenException('Cannot approve in a closed period');
    }

    if (cn.invoiceId) {
      const outstanding = await this.computeInvoiceOutstanding({
        tenantId: tenant.id,
        invoiceId: cn.invoiceId,
      });
      const totalAmount = this.normalizeMoney(Number((cn as any).subtotal ?? 0));

      if (totalAmount > outstanding.outstanding) {
        throw new BadRequestException(
          'Credit note exceeds the outstanding balance of the invoice.',
        );
      }
    }

    await (this.prisma as any).customerCreditNote.update({
      where: { id: cn.id },
      data: {
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
        ...(dto.memo !== undefined ? { memo: dto.memo ? String(dto.memo) : null } : {}),
      } as any,
    });

    await this.auditLifecycle({
      req,
      eventType: 'AR_CREDIT_NOTE_APPROVED',
      creditNoteId: cn.id,
      invoiceId: cn.invoiceId ?? null,
      amount: this.normalizeMoney(Number((cn as any).totalAmount ?? 0)),
      previousStatus: String(cn.status),
      newStatus: 'APPROVED',
      permissionUsed: PERMISSIONS.AR.CREDIT_NOTE_APPROVE,
      outcome: 'SUCCESS',
    });

    return this.getById(req, cn.id);
  }

  async post(req: Request, id: string) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const cn = await (this.prisma as any).customerCreditNote.findFirst({
      where: { id, tenantId: tenant.id },
      include: { lines: true } as any,
    });
    if (!cn) throw new NotFoundException('Credit note not found');

    if (cn.postedJournalId) {
      throw new BadRequestException('Credit note already posted');
    }

    if (String(cn.status) === 'POSTED') {
      throw new BadRequestException('Credit note already posted');
    }

    if (String(cn.status) !== 'APPROVED') {
      throw new BadRequestException(`Credit note cannot be posted from status: ${cn.status}`);
    }

    const creditNoteDate = new Date(cn.creditNoteDate);
    try {
      await assertPeriodIsOpen({
        prisma: this.prisma,
        tenantId: tenant.id,
        date: creditNoteDate,
        action: 'post',
        documentLabel: 'Credit Note',
        dateLabel: 'credit note date',
      });
    } catch {
      throw new ForbiddenException('Cannot post in a closed period');
    }

    if ((cn.lines ?? []).length < 1) {
      throw new BadRequestException('Credit note must have at least 1 line');
    }

    const totalAmount = this.normalizeMoney(Number((cn as any).totalAmount ?? 0));
    const subtotal = this.normalizeMoney(
      (cn.lines ?? []).reduce((s: number, l: any) => s + Number(l.lineAmount ?? 0), 0),
    );
    const taxAmount = this.normalizeMoney(Number((cn as any).taxAmount ?? 0));
    if (this.normalizeMoney(subtotal + taxAmount) !== this.normalizeMoney(totalAmount)) {
      throw new BadRequestException('Credit note totals failed validation before posting');
    }

    if (cn.invoiceId) {
      const outstanding = await this.computeInvoiceOutstanding({
        tenantId: tenant.id,
        invoiceId: cn.invoiceId,
      });

      const netAmount = this.normalizeMoney(Number((cn as any).subtotal ?? 0));
      if (netAmount > outstanding.outstanding) {
        throw new ConflictException(
          'Credit note total exceeds invoice outstanding balance',
        );
      }
    }

    const arAccount = await resolveArControlAccount(this.prisma as any, tenant.id);

    const taxLineAmount = taxAmount > 0 ? taxAmount : 0;
    const taxAccountId = taxLineAmount > 0
      ? String(
          (
            await (this.prisma as any).tenantTaxConfig.findFirst({
              where: { tenantId: tenant.id },
              select: { outputVatAccountId: true },
            })
          )?.outputVatAccountId ?? '',
        )
      : '';
    if (taxLineAmount > 0 && !taxAccountId) {
      throw new BadRequestException('Missing tenant output VAT account configuration');
    }

    const journal = await this.prisma.journalEntry.create({
      data: {
        tenantId: tenant.id,
        sourceType: 'AR_CREDIT_NOTE',
        sourceId: cn.id,
        journalDate: creditNoteDate,
        reference: `AR-CN:${cn.id}`,
        description: `AR credit note posting: ${cn.creditNoteNumber}`,
        createdById: cn.createdById,
        status: 'REVIEWED',
        reviewedById: cn.approvedById ?? user.id,
        reviewedAt: cn.approvedAt ?? new Date(),
        lines: {
          create: [
            ...(cn.lines ?? []).map((l: any) => ({
              accountId: l.revenueAccountId,
              debit: this.normalizeMoney(Number(l.lineAmount ?? 0)),
              credit: 0,
              departmentId: l.departmentId ?? undefined,
              projectId: l.projectId ?? undefined,
              fundId: l.fundId ?? undefined,
              description: String(l.description ?? '').trim() || undefined,
            })),
            ...(taxLineAmount > 0
              ? [
                  {
                    accountId: taxAccountId,
                    debit: taxLineAmount,
                    credit: 0,
                    description: 'Output VAT (credit note)',
                  },
                ]
              : []),
            {
              accountId: arAccount.id,
              debit: 0,
              credit: totalAmount,
              description: 'AR control',
            },
          ],
        },
      } as any,
      select: { id: true },
    });

    const postedJournal = await this.gl.postJournal(req, journal.id);

    await (this.prisma as any).customerCreditNote.update({
      where: { id: cn.id },
      data: {
        status: 'POSTED',
        postedById: user.id,
        postedAt: new Date(),
        postedJournalId: postedJournal.id,
      } as any,
    });

    await this.auditLifecycle({
      req,
      eventType: 'AR_CREDIT_NOTE_POSTED',
      creditNoteId: cn.id,
      invoiceId: cn.invoiceId ?? null,
      amount: totalAmount,
      previousStatus: String(cn.status),
      newStatus: 'POSTED',
      permissionUsed: PERMISSIONS.AR.CREDIT_NOTE_POST,
      outcome: 'SUCCESS',
    });

    return this.getById(req, cn.id);
  }

  async void(req: Request, id: string, dto: VoidCreditNoteDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const reason = String(dto.reason ?? '').trim();
    if (!reason) throw new BadRequestException('reason is required');

    const cn = await (this.prisma as any).customerCreditNote.findFirst({
      where: { id, tenantId: tenant.id },
      include: { lines: true } as any,
    });
    if (!cn) throw new NotFoundException('Credit note not found');

    if (String(cn.status) === 'VOID') {
      return this.getById(req, cn.id);
    }

    if (String(cn.status) !== 'POSTED') {
      throw new BadRequestException(`Credit note cannot be voided from status: ${cn.status}`);
    }

    const creditNoteDate = new Date(cn.creditNoteDate);
    await assertPeriodIsOpen({
      prisma: this.prisma,
      tenantId: tenant.id,
      date: creditNoteDate,
      action: 'post',
      documentLabel: 'Credit Note',
      dateLabel: 'credit note date',
    });

    const arAccount = await resolveArControlAccount(this.prisma as any, tenant.id);

    const totalAmount = this.normalizeMoney(Number(cn.totalAmount ?? 0));
    const taxAmount = this.normalizeMoney(Number((cn as any).taxAmount ?? 0));

    const taxLineAmount = taxAmount > 0 ? taxAmount : 0;
    const taxAccountId = taxLineAmount > 0
      ? String(
          (
            await (this.prisma as any).tenantTaxConfig.findFirst({
              where: { tenantId: tenant.id },
              select: { outputVatAccountId: true },
            })
          )?.outputVatAccountId ?? '',
        )
      : '';
    if (taxLineAmount > 0 && !taxAccountId) {
      throw new BadRequestException('Missing tenant output VAT account configuration');
    }

    const reversal = await this.prisma.journalEntry.create({
      data: {
        tenantId: tenant.id,
        sourceType: 'AR_CREDIT_NOTE_VOID',
        sourceId: cn.id,
        journalDate: creditNoteDate,
        reference: `AR-CN-VOID:${cn.id}`,
        description: `Void AR credit note: ${cn.creditNoteNumber}`,
        createdById: cn.createdById,
        journalType: 'REVERSING',
        status: 'REVIEWED',
        reviewedById: cn.approvedById ?? cn.createdById,
        reviewedAt: new Date(),
        lines: {
          create: [
            {
              accountId: arAccount.id,
              debit: totalAmount,
              credit: 0,
              description: 'AR control reversal',
            },
            ...(taxLineAmount > 0
              ? [
                  {
                    accountId: taxAccountId,
                    debit: 0,
                    credit: taxLineAmount,
                    description: 'Output VAT reversal (credit note)',
                  },
                ]
              : []),
            ...(cn.lines ?? []).map((l: any) => ({
              accountId: l.revenueAccountId,
              debit: 0,
              credit: this.normalizeMoney(Number(l.lineAmount ?? 0)),
              departmentId: l.departmentId ?? undefined,
              projectId: l.projectId ?? undefined,
              fundId: l.fundId ?? undefined,
              description: String(l.description ?? '').trim() || undefined,
            })),
          ],
        },
      } as any,
      select: { id: true },
    });

    await this.gl.postJournal(req, reversal.id);

    await (this.prisma as any).customerCreditNote.update({
      where: { id: cn.id },
      data: {
        status: 'VOID',
        voidedById: user.id,
        voidedAt: new Date(),
        voidReason: reason,
      } as any,
    });

    await this.auditLifecycle({
      req,
      eventType: 'AR_CREDIT_NOTE_VOIDED',
      creditNoteId: cn.id,
      invoiceId: cn.invoiceId ?? null,
      amount: totalAmount,
      previousStatus: String(cn.status),
      newStatus: 'VOID',
      permissionUsed: PERMISSIONS.AR.CREDIT_NOTE_VOID,
      outcome: 'SUCCESS',
      reason,
    });

    return this.getById(req, cn.id);
  }
}
