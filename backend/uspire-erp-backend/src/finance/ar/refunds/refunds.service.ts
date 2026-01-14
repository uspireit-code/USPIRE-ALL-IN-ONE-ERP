import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { PERMISSIONS } from '../../../rbac/permission-catalog';
import { writeAuditEventWithPrisma } from '../../../audit/audit-writer';
import { AuditEntityType, AuditEventType } from '@prisma/client';
import { assertPeriodIsOpen } from '../../common/accounting-period.guard';
import { GlService } from '../../../gl/gl.service';
import { resolveArControlAccount } from '../../common/resolve-ar-control-account';
import { ReportExportService } from '../../../reports/report-export.service';
import type {
  CreateCustomerRefundDto,
  ListRefundsQueryDto,
  VoidRefundDto,
} from './refunds.dto';

@Injectable()
export class FinanceArRefundsService {
  private readonly REFUND_NUMBER_SEQUENCE_NAME = 'AR_REFUND_NUMBER';

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

    const refund = await this.getById(req, id);
    return this.exports.refundToPdf({
      refund: refund as any,
      header: {
        entityLegalName,
        reportName: 'Customer Refund',
        periodLine: `Refund Date: ${String((refund as any)?.refundDate ?? '')}`,
        currencyIsoCode,
        headerFooterLine: `Currency: ${String((refund as any)?.currency ?? currencyIsoCode)}`,
      },
    });
  }

  private round2(n: number) {
    return Math.round(Number(n ?? 0) * 100) / 100;
  }

  async approve(req: Request, id: string) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);
    const now = new Date();

    const refund = await (this.prisma as any).customerRefund.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!refund) throw new NotFoundException('Refund not found');

    if (String(refund.status) !== 'SUBMITTED') {
      throw new BadRequestException(`Refund cannot be approved from status: ${refund.status}`);
    }

    await (this.prisma as any).customerRefund.update({
      where: { id: refund.id },
      data: {
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: now,
      } as any,
    });

    return (this.prisma as any).customerRefund.findFirst({
      where: { id: refund.id, tenantId: tenant.id },
    });
  }

  private normalizeMoney(n: number) {
    return this.round2(Number(n ?? 0));
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

  private parseYmdToDateOrNull(s: any): Date | null {
    const v = String(s ?? '').trim();
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  private async nextRefundNumber(tx: any, tenantId: string) {
    const counter = await tx.tenantSequenceCounter.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: this.REFUND_NUMBER_SEQUENCE_NAME,
        },
      },
      create: {
        tenantId,
        name: this.REFUND_NUMBER_SEQUENCE_NAME,
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

  private async computeCreditNoteRefundable(params: {
    tenantId: string;
    creditNoteId: string;
  }) {
    const cn = await (this.prisma as any).customerCreditNote.findFirst({
      where: { tenantId: params.tenantId, id: params.creditNoteId },
      select: {
        id: true,
        status: true,
        currency: true,
        exchangeRate: true,
        totalAmount: true,
        customerId: true,
        creditNoteNumber: true,
        creditNoteDate: true,
      } as any,
    });
    if (!cn) throw new NotFoundException('Credit note not found');

    if (String(cn.status) !== 'POSTED') {
      throw new BadRequestException(
        `Refund requires a POSTED credit note (status: ${cn.status})`,
      );
    }

    const total = this.normalizeMoney(Number((cn as any).totalAmount ?? 0));

    const postedRefundAgg = await (this.prisma as any).customerRefund.aggregate({
      where: {
        tenantId: params.tenantId,
        creditNoteId: params.creditNoteId,
        status: 'POSTED',
      } as any,
      _sum: { amount: true },
    });

    const refunded = this.normalizeMoney(
      Number(postedRefundAgg?._sum?.amount ?? 0),
    );

    const refundable = this.normalizeMoney(total - refunded);

    return {
      creditNote: {
        id: cn.id,
        creditNoteNumber: String((cn as any).creditNoteNumber ?? '').trim(),
        creditNoteDate: (cn as any).creditNoteDate,
        customerId: (cn as any).customerId,
        currency: String((cn as any).currency ?? '').trim(),
        exchangeRate: Number((cn as any).exchangeRate ?? 1),
        totalAmount: total,
      },
      refunded,
      refundable,
    };
  }

  async getRefundableForCreditNote(req: Request, creditNoteId: string) {
    const tenant = this.ensureTenant(req);
    const out = await this.computeCreditNoteRefundable({
      tenantId: tenant.id,
      creditNoteId: String(creditNoteId ?? '').trim(),
    });

    return {
      creditNote: {
        ...out.creditNote,
        creditNoteDate:
          (out.creditNote as any).creditNoteDate?.toISOString?.().slice(0, 10) ??
          null,
      },
      refunded: Number(out.refunded),
      refundable: Number(out.refundable),
    };
  }

  async listRefundableCustomers(req: Request) {
    const tenant = this.ensureTenant(req);

    const creditNotes = await (this.prisma as any).customerCreditNote.findMany({
      where: {
        tenantId: tenant.id,
        status: 'POSTED',
      } as any,
      select: {
        id: true,
        customerId: true,
        totalAmount: true,
      } as any,
    });

    if ((creditNotes ?? []).length === 0) {
      return { items: [] as any[] };
    }

    const refundsAgg = await (this.prisma as any).customerRefund.groupBy({
      by: ['creditNoteId'],
      where: {
        tenantId: tenant.id,
        status: 'POSTED',
        creditNoteId: { in: creditNotes.map((c: any) => c.id) },
      } as any,
      _sum: { amount: true },
    });

    const refundedByCreditNoteId = new Map<string, number>();
    for (const r of refundsAgg ?? []) {
      refundedByCreditNoteId.set(
        String(r.creditNoteId),
        this.normalizeMoney(Number(r?._sum?.amount ?? 0)),
      );
    }

    const customerIds = new Set<string>();
    for (const cn of creditNotes ?? []) {
      const total = this.normalizeMoney(Number(cn.totalAmount ?? 0));
      const refunded = refundedByCreditNoteId.get(String(cn.id)) ?? 0;
      const refundable = this.normalizeMoney(total - refunded);
      if (refundable > 0) customerIds.add(String(cn.customerId));
    }

    if (customerIds.size === 0) {
      return { items: [] as any[] };
    }

    const customers = await (this.prisma as any).customer.findMany({
      where: {
        tenantId: tenant.id,
        id: { in: Array.from(customerIds) },
        status: 'ACTIVE',
      } as any,
      select: { id: true, name: true } as any,
      orderBy: { name: 'asc' },
    });

    return {
      items: (customers ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
      })),
    };
  }

  async listRefundableCreditNotes(req: Request, customerId: string) {
    const tenant = this.ensureTenant(req);

    const cid = String(customerId ?? '').trim();
    if (!cid) throw new BadRequestException('customerId is required');

    const creditNotes = await (this.prisma as any).customerCreditNote.findMany({
      where: {
        tenantId: tenant.id,
        customerId: cid,
        status: 'POSTED',
      } as any,
      orderBy: [{ creditNoteDate: 'desc' }, { creditNoteNumber: 'desc' }],
      select: {
        id: true,
        creditNoteNumber: true,
        creditNoteDate: true,
        invoiceId: true,
        invoice: { select: { invoiceNumber: true } },
        currency: true,
        totalAmount: true,
      } as any,
    });

    if ((creditNotes ?? []).length === 0) {
      return { items: [] as any[] };
    }

    const refundsAgg = await (this.prisma as any).customerRefund.groupBy({
      by: ['creditNoteId'],
      where: {
        tenantId: tenant.id,
        status: 'POSTED',
        creditNoteId: { in: creditNotes.map((c: any) => c.id) },
      } as any,
      _sum: { amount: true },
    });

    const refundedByCreditNoteId = new Map<string, number>();
    for (const r of refundsAgg ?? []) {
      refundedByCreditNoteId.set(
        String(r.creditNoteId),
        this.normalizeMoney(Number(r?._sum?.amount ?? 0)),
      );
    }

    const items = (creditNotes ?? [])
      .map((cn: any) => {
        const total = this.normalizeMoney(Number(cn.totalAmount ?? 0));
        const refunded = refundedByCreditNoteId.get(String(cn.id)) ?? 0;
        const refundable = this.normalizeMoney(total - refunded);
        return {
          id: cn.id,
          creditNoteNumber: String(cn.creditNoteNumber ?? '').trim(),
          creditNoteDate: cn.creditNoteDate?.toISOString?.().slice(0, 10) ?? null,
          invoiceId: cn.invoiceId ?? null,
          invoiceNumber: cn.invoice?.invoiceNumber ?? null,
          currency: String(cn.currency ?? '').trim(),
          totalAmount: total,
          refunded,
          refundable,
        };
      })
      .filter((x: any) => Number(x.refundable ?? 0) > 0);

    return { items };
  }

  async list(req: Request, q: ListRefundsQueryDto) {
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

    const creditNoteId = String(q.creditNoteId ?? '').trim();
    if (creditNoteId) where.creditNoteId = creditNoteId;

    const dateFrom = String(q.dateFrom ?? '').trim();
    const dateTo = String(q.dateTo ?? '').trim();
    if (dateFrom || dateTo) {
      where.refundDate = {};
      if (dateFrom) where.refundDate.gte = new Date(dateFrom);
      if (dateTo) where.refundDate.lte = new Date(dateTo);
    }

    const [items, total] = await Promise.all([
      (this.prisma as any).customerRefund.findMany({
        where,
        orderBy: [{ refundDate: 'desc' }, { refundNumber: 'desc' }],
        take,
        skip,
        include: {
          customer: { select: { id: true, name: true } },
          creditNote: {
            select: { id: true, creditNoteNumber: true, creditNoteDate: true },
          },
        } as any,
      }),
      (this.prisma as any).customerRefund.count({ where }),
    ]);

    return {
      items: (items ?? []).map((r: any) => ({
        id: r.id,
        refundNumber: r.refundNumber,
        refundDate: r.refundDate?.toISOString?.().slice(0, 10) ?? null,
        amount: Number(r.amount ?? 0),
        currency: r.currency,
        exchangeRate: Number(r.exchangeRate ?? 1),
        paymentMethod: r.paymentMethod,
        status: r.status,
        customerId: r.customerId,
        customerName: r.customer?.name ?? null,
        creditNoteId: r.creditNoteId,
        creditNoteNumber: r.creditNote?.creditNoteNumber ?? null,
        createdById: r.createdById,
        approvedById: r.approvedById ?? null,
        postedById: r.postedById ?? null,
        voidedById: r.voidedById ?? null,
        approvedAt: r.approvedAt?.toISOString?.() ?? null,
        postedAt: r.postedAt?.toISOString?.() ?? null,
        voidedAt: r.voidedAt?.toISOString?.() ?? null,
        postedJournalId: r.postedJournalId ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getById(req: Request, id: string) {
    const tenant = this.ensureTenant(req);

    const refund = await (this.prisma as any).customerRefund.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        customer: { select: { id: true, name: true } },
        creditNote: {
          select: {
            id: true,
            creditNoteNumber: true,
            creditNoteDate: true,
            totalAmount: true,
            currency: true,
            invoiceId: true,
          },
        },
        postedJournal: { select: { id: true } },
      } as any,
    });

    if (!refund) throw new NotFoundException('Refund not found');

    return {
      id: refund.id,
      refundNumber: refund.refundNumber,
      refundDate: refund.refundDate?.toISOString?.().slice(0, 10) ?? null,
      customerId: refund.customerId,
      customerName: refund.customer?.name ?? null,
      creditNoteId: refund.creditNoteId,
      creditNoteNumber: refund.creditNote?.creditNoteNumber ?? null,
      creditNoteDate:
        refund.creditNote?.creditNoteDate?.toISOString?.().slice(0, 10) ?? null,
      creditNoteTotalAmount: Number(refund.creditNote?.totalAmount ?? 0),
      creditNoteCurrency: refund.creditNote?.currency ?? null,
      invoiceId: refund.creditNote?.invoiceId ?? null,
      currency: refund.currency,
      exchangeRate: Number(refund.exchangeRate ?? 1),
      amount: Number(refund.amount ?? 0),
      paymentMethod: refund.paymentMethod,
      bankAccountId: refund.bankAccountId ?? null,
      status: refund.status,
      createdById: refund.createdById,
      createdAt: refund.createdAt?.toISOString?.() ?? null,
      approvedById: refund.approvedById ?? null,
      approvedAt: refund.approvedAt?.toISOString?.() ?? null,
      postedById: refund.postedById ?? null,
      postedAt: refund.postedAt?.toISOString?.() ?? null,
      voidedById: refund.voidedById ?? null,
      voidedAt: refund.voidedAt?.toISOString?.() ?? null,
      voidReason: refund.voidReason ?? null,
      postedJournalId: refund.postedJournalId ?? null,
    };
  }

  private async resolveClearingAccountId(params: {
    tenantId: string;
    paymentMethod: 'BANK' | 'CASH';
    bankAccountId: string | null;
  }) {
    if (params.paymentMethod === 'BANK') {
      if (!params.bankAccountId) {
        throw new BadRequestException({
          error: 'Bank account is required for BANK refunds',
          field: 'CustomerRefund.bankAccountId',
        });
      }
      if (params.bankAccountId) {
        const ba = await this.prisma.bankAccount.findFirst({
          where: {
            tenantId: params.tenantId,
            id: params.bankAccountId,
            isActive: true,
          },
          select: { glAccountId: true },
        });
        if (!ba) {
          throw new BadRequestException('Bank account not found or inactive');
        }

        const bankGl = await this.prisma.account.findFirst({
          where: {
            tenantId: params.tenantId,
            id: ba.glAccountId,
            isActive: true,
            type: 'ASSET',
          },
          select: { id: true },
        });
        if (!bankGl) {
          throw new BadRequestException('Bank GL account not found or invalid');
        }

        return bankGl.id;
      }
    }

    const tenantControls = await (this.prisma as any).tenant.findUnique({
      where: { id: params.tenantId },
      select: { cashClearingAccountId: true },
    });
    const cashClearingAccountId =
      (tenantControls?.cashClearingAccountId ?? null) as string | null;
    if (!cashClearingAccountId) {
      throw new BadRequestException({
        error: 'Missing configuration: cash clearing account',
        field: 'AR_CASH_CLEARING_ACCOUNT_ID',
      });
    }

    const cashAccount = await this.prisma.account.findFirst({
      where: {
        tenantId: params.tenantId,
        id: cashClearingAccountId,
        isActive: true,
        type: 'ASSET',
      },
      select: { id: true },
    });
    if (!cashAccount) {
      throw new BadRequestException(
        'Configured cash clearing GL account not found or invalid',
      );
    }

    return cashAccount.id;
  }

  async create(req: Request, dto: CreateCustomerRefundDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const refundDate = this.parseYmdToDateOrNull(dto.refundDate);
    if (!refundDate) throw new BadRequestException('refundDate is invalid');

    const paymentMethod = String(dto.paymentMethod ?? '').trim().toUpperCase();
    if (paymentMethod !== 'BANK' && paymentMethod !== 'CASH') {
      throw new BadRequestException('paymentMethod must be BANK or CASH');
    }

    const amount = this.normalizeMoney(Number(dto.amount));
    if (!(amount > 0)) throw new BadRequestException('amount must be > 0');

    const exchangeRate = Number(dto.exchangeRate ?? 1);
    if (!(exchangeRate > 0)) throw new BadRequestException('exchangeRate must be > 0');

    const refundable = await this.computeCreditNoteRefundable({
      tenantId: tenant.id,
      creditNoteId: String(dto.creditNoteId ?? '').trim(),
    });

    const requestedCustomerId = String(dto.customerId ?? '').trim();
    if (!requestedCustomerId) throw new BadRequestException('customerId is required');
    if (String(refundable.creditNote.customerId) !== requestedCustomerId) {
      throw new BadRequestException('creditNoteId does not belong to customerId');
    }

    if (amount > refundable.refundable) {
      throw new ConflictException('Refund amount exceeds available credit balance');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const refundNumber = await this.nextRefundNumber(tx, tenant.id);

      return (tx as any).customerRefund.create({
        data: {
          tenantId: tenant.id,
          refundNumber,
          refundDate,
          customerId: dto.customerId,
          creditNoteId: dto.creditNoteId,
          currency: dto.currency,
          exchangeRate,
          amount,
          paymentMethod,
          bankAccountId: dto.bankAccountId ?? null,
          status: 'DRAFT',
          createdById: user.id,
        } as any,
      });
    });

    return created;
  }

  async submit(req: Request, id: string) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const refund = await (this.prisma as any).customerRefund.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true, refundDate: true } as any,
    });
    if (!refund) throw new NotFoundException('Refund not found');

    if (String(refund.status) !== 'DRAFT') {
      throw new BadRequestException(`Refund cannot be submitted from status: ${refund.status}`);
    }

    const refundDate = new Date(refund.refundDate);
    try {
      await assertPeriodIsOpen({
        prisma: this.prisma,
        tenantId: tenant.id,
        date: refundDate,
        action: 'create',
        documentLabel: 'Refund',
        dateLabel: 'refund date',
      });
    } catch {
      throw new ForbiddenException('Cannot submit in a closed period');
    }

    await (this.prisma as any).customerRefund.update({
      where: { id: refund.id },
      data: { status: 'SUBMITTED' } as any,
    });

    return (this.prisma as any).customerRefund.findFirst({
      where: { id: refund.id, tenantId: tenant.id },
    });
  }

  async post(req: Request, id: string) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);
    const now = new Date();

    const refund = await (this.prisma as any).customerRefund.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!refund) throw new NotFoundException('Refund not found');

    if (refund.postedJournalId || String(refund.status) === 'POSTED') {
      throw new BadRequestException('Refund already posted');
    }

    if (String(refund.status) !== 'APPROVED') {
      throw new BadRequestException(
        `Refund cannot be posted from status: ${refund.status}`,
      );
    }

    if (!refund.creditNoteId) throw new BadRequestException('Refund must reference a credit note');

    const refundDate = new Date(refund.refundDate);
    try {
      await assertPeriodIsOpen({
        prisma: this.prisma,
        tenantId: tenant.id,
        date: refundDate,
        action: 'post',
        documentLabel: 'Refund',
        dateLabel: 'refund date',
      });
    } catch {
      throw new ForbiddenException('Cannot post in a closed period');
    }

    const refundable = await this.computeCreditNoteRefundable({
      tenantId: tenant.id,
      creditNoteId: String(refund.creditNoteId ?? ''),
    });
    const amount = this.normalizeMoney(Number(refund.amount ?? 0));
    if (amount > refundable.refundable) {
      throw new ConflictException('Refund amount exceeds available credit balance');
    }

    const arAccount = await resolveArControlAccount(this.prisma as any, tenant.id);

    const tenantControls = await (this.prisma as any).tenant.findUnique({
      where: { id: tenant.id },
      select: { defaultBankClearingAccountId: true },
    });
    const refundClearingAccountId =
      (tenantControls?.defaultBankClearingAccountId ?? null) as string | null;
    if (!refundClearingAccountId) {
      throw new BadRequestException({
        error: 'Missing configuration: refund clearing account',
        field: 'AR_REFUND_CLEARING_ACCOUNT_ID',
      });
    }
    const refundClearingAccount = await this.prisma.account.findFirst({
      where: {
        tenantId: tenant.id,
        id: refundClearingAccountId,
        isActive: true,
        type: 'ASSET',
      },
      select: { id: true },
    });
    if (!refundClearingAccount) {
      throw new BadRequestException(
        'Configured refund clearing GL account not found or invalid',
      );
    }

    const paymentAccountId = await this.resolveClearingAccountId({
      tenantId: tenant.id,
      paymentMethod: String(refund.paymentMethod) as any,
      bankAccountId: (refund as any).bankAccountId ?? null,
    });

    const journal = await this.prisma.journalEntry.create({
      data: {
        tenantId: tenant.id,
        sourceType: 'AR_REFUND',
        sourceId: refund.id,
        journalDate: refundDate,
        reference: `AR-REFUND:${refund.id}`,
        description: `AR refund posting: ${refund.refundNumber}`,
        createdById: refund.createdById,
        status: 'REVIEWED',
        reviewedById: user.id,
        reviewedAt: now,
        lines: {
          create: [
            {
              accountId: arAccount.id,
              debit: amount,
              credit: 0,
              description: 'AR control',
            },
            {
              accountId: refundClearingAccount.id,
              debit: 0,
              credit: amount,
              description: 'AR refund clearing',
            },
            {
              accountId: refundClearingAccount.id,
              debit: amount,
              credit: 0,
              description: 'AR refund clearing',
            },
            {
              accountId: paymentAccountId,
              debit: 0,
              credit: amount,
              description:
                String(refund.paymentMethod) === 'CASH'
                  ? 'Cash clearing'
                  : 'Bank account',
            },
          ],
        },
      } as any,
      select: { id: true },
    });

    const postedJournal = await this.gl.postJournal(req, journal.id);

    await (this.prisma as any).customerRefund.update({
      where: { id: refund.id },
      data: {
        status: 'POSTED',
        postedById: user.id,
        postedAt: now,
        postedJournalId: postedJournal.id,
      } as any,
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.AR_POST,
        entityType: AuditEntityType.CUSTOMER_INVOICE,
        entityId: refund.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'REFUND_POSTED',
        permissionUsed: PERMISSIONS.AR.REFUND_POST,
        lifecycleType: 'POST',
        metadata: {
          entityTypeRaw: 'CUSTOMER_REFUND',
          refundId: refund.id,
          journalId: postedJournal.id,
        },
      },
      this.prisma,
    );

    return (this.prisma as any).customerRefund.findFirst({
      where: { id: refund.id, tenantId: tenant.id },
    });
  }

  async void(req: Request, id: string, dto: VoidRefundDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const reason = String(dto.reason ?? '').trim();
    if (!reason) throw new BadRequestException('reason is required');

    const refund = await (this.prisma as any).customerRefund.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!refund) throw new NotFoundException('Refund not found');

    if (String(refund.status) === 'VOID') {
      return refund;
    }

    if (String(refund.status) !== 'POSTED') {
      throw new BadRequestException(
        `Refund cannot be voided from status: ${refund.status}`,
      );
    }

    const refundDate = new Date(refund.refundDate);
    await assertPeriodIsOpen({
      prisma: this.prisma,
      tenantId: tenant.id,
      date: refundDate,
      action: 'post',
      documentLabel: 'Refund',
      dateLabel: 'refund date',
    });

    const arAccount = await resolveArControlAccount(this.prisma as any, tenant.id);

    const tenantControls = await (this.prisma as any).tenant.findUnique({
      where: { id: tenant.id },
      select: { defaultBankClearingAccountId: true },
    });
    const refundClearingAccountId =
      (tenantControls?.defaultBankClearingAccountId ?? null) as string | null;
    if (!refundClearingAccountId) {
      throw new BadRequestException({
        error: 'Missing configuration: refund clearing account',
        field: 'AR_REFUND_CLEARING_ACCOUNT_ID',
      });
    }
    const refundClearingAccount = await this.prisma.account.findFirst({
      where: {
        tenantId: tenant.id,
        id: refundClearingAccountId,
        isActive: true,
        type: 'ASSET',
      },
      select: { id: true },
    });
    if (!refundClearingAccount) {
      throw new BadRequestException(
        'Configured refund clearing GL account not found or invalid',
      );
    }

    const paymentAccountId = await this.resolveClearingAccountId({
      tenantId: tenant.id,
      paymentMethod: String(refund.paymentMethod) as any,
      bankAccountId: (refund as any).bankAccountId ?? null,
    });

    const amount = this.normalizeMoney(Number(refund.amount ?? 0));

    const reversal = await this.prisma.journalEntry.create({
      data: {
        tenantId: tenant.id,
        sourceType: 'AR_REFUND_VOID',
        sourceId: refund.id,
        journalDate: refundDate,
        reference: `AR-REFUND-VOID:${refund.id}`,
        description: `Void AR refund: ${refund.refundNumber}`,
        createdById: refund.createdById,
        journalType: 'REVERSING',
        status: 'REVIEWED',
        reviewedById: refund.approvedById ?? refund.createdById,
        reviewedAt: new Date(),
        lines: {
          create: [
            {
              accountId: paymentAccountId,
              debit: amount,
              credit: 0,
              description:
                String(refund.paymentMethod) === 'CASH'
                  ? 'Cash clearing reversal'
                  : 'Bank account reversal',
            },
            {
              accountId: refundClearingAccount.id,
              debit: 0,
              credit: amount,
              description: 'AR refund clearing reversal',
            },
            {
              accountId: refundClearingAccount.id,
              debit: amount,
              credit: 0,
              description: 'AR refund clearing reversal',
            },
            {
              accountId: arAccount.id,
              debit: 0,
              credit: amount,
              description: 'AR control reversal',
            },
          ],
        },
      } as any,
      select: { id: true },
    });

    await this.gl.postJournal(req, reversal.id);

    await (this.prisma as any).customerRefund.update({
      where: { id: refund.id },
      data: {
        status: 'VOID',
        voidedById: user.id,
        voidedAt: new Date(),
        voidReason: reason,
      } as any,
    });

    return (this.prisma as any).customerRefund.findFirst({
      where: { id: refund.id, tenantId: tenant.id },
    });
  }
}
