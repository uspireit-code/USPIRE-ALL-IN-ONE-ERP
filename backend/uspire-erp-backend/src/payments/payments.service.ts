import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { GlService } from '../gl/gl.service';
import { resolveArControlAccount } from '../finance/common/resolve-ar-control-account';
import { validateAccountPostingEligibility } from '../finance/common/account-posting-eligibility';
import { validateSegmentCompleteness } from '../finance/common/segment-completeness';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { AuditEntityType, AuditEventType } from '@prisma/client';
import { assertCanPost } from '../periods/period-guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gl: GlService,
  ) {}

  async createPayment(req: Request, dto: CreatePaymentDto) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const allocations = (dto as any).allocations ?? [];
    if (allocations.length > 0) {
      this.assertAllocations(allocations, dto.amount);
    }

    if (dto.type !== 'SUPPLIER_PAYMENT' && dto.type !== 'CUSTOMER_RECEIPT') {
      throw new BadRequestException('Invalid payment type');
    }

    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, tenantId: tenant.id, status: 'ACTIVE' },
      select: { id: true, glAccountId: true },
    });

    if (!bankAccount) {
      throw new BadRequestException('Bank account not found or inactive');
    }

    // Validate allocation source type matches payment type
    for (const a of allocations) {
      if (
        dto.type === 'SUPPLIER_PAYMENT' &&
        a.sourceType !== 'SUPPLIER_INVOICE' &&
        a.sourceType !== 'SUPPLIER_ADVANCE'
      ) {
        throw new BadRequestException(
          'Supplier payment allocations must reference SUPPLIER_INVOICE or SUPPLIER_ADVANCE',
        );
      }
      if (dto.type === 'CUSTOMER_RECEIPT' && a.sourceType !== 'CUSTOMER_INVOICE') {
        throw new BadRequestException(
          'Customer receipt allocations must reference CUSTOMER_INVOICE',
        );
      }
    }

    // Validate referenced documents exist and are POSTED
    if (dto.type === 'SUPPLIER_PAYMENT') {
      const invoiceAllocs = allocations.filter((a: any) => a.sourceType === 'SUPPLIER_INVOICE');
      if (invoiceAllocs.length > 0) {
        const ids = invoiceAllocs.map((a: any) => a.sourceId);
        const invoices = await this.prisma.supplierInvoice.findMany({
          where: { tenantId: tenant.id, id: { in: ids }, status: 'POSTED' },
          select: { id: true, totalAmount: true },
        });
        const map = new Map(invoices.map((i) => [i.id, i] as const));
        for (const a of invoiceAllocs) {
          const inv = map.get(a.sourceId);
          if (!inv) {
            throw new BadRequestException(
              `Supplier invoice not found or not POSTED: ${a.sourceId}`,
            );
          }
          if (Number(a.amount) > Number(inv.totalAmount)) {
            throw new BadRequestException(
              `Allocation exceeds supplier invoice total: ${a.sourceId}`,
            );
          }
        }
      }

      const advanceAllocs = allocations.filter((a: any) => a.sourceType === 'SUPPLIER_ADVANCE');
      if (advanceAllocs.length > 0) {
        const tenantCfg = await (this.prisma.tenant as any).findUnique({
          where: { id: tenant.id },
          select: { supplierAdvanceAccountId: true } as any,
        });
        const advAccountId = String((tenantCfg as any)?.supplierAdvanceAccountId ?? '').trim();
        if (!advAccountId) {
          throw new BadRequestException(
            'Supplier advance account is not configured. Please configure it in Settings before creating advance payments.',
          );
        }
        const advAccount = await this.prisma.account.findFirst({
          where: { tenantId: tenant.id, id: advAccountId, status: 'ACTIVE' as any, isActive: true } as any,
          select: {
            id: true,
            status: true,
            isActive: true,
            isPostingAllowed: true,
            isPosting: true,
            isControlAccount: true,
            requiresDepartment: true,
            requiresProject: true,
            requiresFund: true,
          } as any,
        });
        if (!advAccount) {
          throw new BadRequestException(
            'Supplier advance account is not configured correctly (not found or inactive).',
          );
        }
        validateAccountPostingEligibility(advAccount as any, {
          allowControlAccount: true,
          errorMode: 'BAD_REQUEST',
        });

        for (const a of advanceAllocs) {
          validateSegmentCompleteness(
            advAccount as any,
            {
              accountId: String((advAccount as any).id),
              lineNumber: null,
              departmentId: (a as any).departmentId ?? null,
              projectId: (a as any).projectId ?? null,
              fundId: (a as any).fundId ?? null,
            },
            { errorMode: 'BAD_REQUEST', module: 'PAYMENTS', transactionType: 'CREATE_PAYMENT' },
          );
        }
      }
    }

    if (dto.type === 'CUSTOMER_RECEIPT') {
      const ids = allocations.map((a: any) => a.sourceId);
      const invoices = await this.prisma.customerInvoice.findMany({
        where: { tenantId: tenant.id, id: { in: ids }, status: 'POSTED' },
        select: { id: true, totalAmount: true },
      });
      const map = new Map(invoices.map((i) => [i.id, i] as const));
      for (const a of allocations) {
        const inv = map.get(a.sourceId);
        if (!inv) {
          throw new BadRequestException(
            `Customer invoice not found or not POSTED: ${a.sourceId}`,
          );
        }
        if (Number(a.amount) > Number(inv.totalAmount)) {
          throw new BadRequestException(
            `Allocation exceeds customer invoice total: ${a.sourceId}`,
          );
        }
      }
    }

    return this.prisma.payment.create({
      data: {
        tenantId: tenant.id,
        type: dto.type,
        bankAccountId: dto.bankAccountId,
        amount: dto.amount,
        paymentDate: new Date(dto.paymentDate),
        reference: dto.reference,
        createdById: user.id,
        allocations: {
          create: allocations.map((a: any) => ({
            sourceType: a.sourceType,
            sourceId: a.sourceId,
            amount: a.amount,
            departmentId: a.departmentId ?? null,
            projectId: a.projectId ?? null,
            fundId: a.fundId ?? null,
          })),
        },
      },
      include: { allocations: true, bankAccount: true },
    });
  }

  async updatePayment(req: Request, id: string, dto: UpdatePaymentDto) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const existing = await this.prisma.payment.findFirst({
      where: { id, tenantId: tenant.id },
      include: { allocations: true, bankAccount: true },
    });

    if (!existing) {
      throw new NotFoundException('Payment not found');
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT payments can be edited');
    }

    const allocations = (dto as any).allocations ?? [];
    this.assertAllocations(allocations, dto.amount);

    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, tenantId: tenant.id, status: 'ACTIVE' },
      select: { id: true },
    });

    if (!bankAccount) {
      throw new BadRequestException('Bank account not found or inactive');
    }

    // Validate allocation source type matches payment type
    for (const a of allocations) {
      if (
        existing.type === 'SUPPLIER_PAYMENT' &&
        a.sourceType !== 'SUPPLIER_INVOICE' &&
        a.sourceType !== 'SUPPLIER_ADVANCE'
      ) {
        throw new BadRequestException(
          'Supplier payment allocations must reference SUPPLIER_INVOICE or SUPPLIER_ADVANCE',
        );
      }
      if (existing.type === 'CUSTOMER_RECEIPT' && a.sourceType !== 'CUSTOMER_INVOICE') {
        throw new BadRequestException(
          'Customer receipt allocations must reference CUSTOMER_INVOICE',
        );
      }
    }

    // Do not allow mixing invoice and advance allocations
    if (existing.type === 'SUPPLIER_PAYMENT') {
      const hasAdvance = allocations.some((a: any) => a.sourceType === 'SUPPLIER_ADVANCE');
      const hasInvoice = allocations.some((a: any) => a.sourceType === 'SUPPLIER_INVOICE');
      if (hasAdvance && hasInvoice) {
        throw new BadRequestException(
          'Supplier payment cannot mix SUPPLIER_INVOICE and SUPPLIER_ADVANCE allocations',
        );
      }
    }

    // Validate referenced documents exist and are POSTED
    if (existing.type === 'SUPPLIER_PAYMENT') {
      const invoiceAllocs = allocations.filter((a: any) => a.sourceType === 'SUPPLIER_INVOICE');
      if (invoiceAllocs.length > 0) {
        const ids = invoiceAllocs.map((a: any) => a.sourceId);
        const invoices = await this.prisma.supplierInvoice.findMany({
          where: { tenantId: tenant.id, id: { in: ids }, status: 'POSTED' },
          select: { id: true, totalAmount: true },
        });
        const map = new Map(invoices.map((i) => [i.id, i] as const));
        for (const a of invoiceAllocs) {
          const inv = map.get(a.sourceId);
          if (!inv) {
            throw new BadRequestException(
              `Supplier invoice not found or not POSTED: ${a.sourceId}`,
            );
          }
          if (Number(a.amount) > Number(inv.totalAmount)) {
            throw new BadRequestException(
              `Allocation exceeds supplier invoice total: ${a.sourceId}`,
            );
          }
        }
      }

      const advanceAllocs = allocations.filter((a: any) => a.sourceType === 'SUPPLIER_ADVANCE');
      if (advanceAllocs.length > 0) {
        const tenantCfg = await (this.prisma.tenant as any).findUnique({
          where: { id: tenant.id },
          select: { supplierAdvanceAccountId: true } as any,
        });
        const advAccountId = String((tenantCfg as any)?.supplierAdvanceAccountId ?? '').trim();
        if (!advAccountId) {
          throw new BadRequestException(
            'Supplier advance account is not configured. Please configure it in Settings before editing advance payments.',
          );
        }
        const advAccount = await this.prisma.account.findFirst({
          where: { tenantId: tenant.id, id: advAccountId, status: 'ACTIVE' as any, isActive: true } as any,
          select: {
            id: true,
            status: true,
            isActive: true,
            isPostingAllowed: true,
            isPosting: true,
            isControlAccount: true,
            requiresDepartment: true,
            requiresProject: true,
            requiresFund: true,
          } as any,
        });
        if (!advAccount) {
          throw new BadRequestException(
            'Supplier advance account is not configured correctly (not found or inactive).',
          );
        }
        validateAccountPostingEligibility(advAccount as any, {
          allowControlAccount: true,
          errorMode: 'BAD_REQUEST',
        });

        for (const a of advanceAllocs) {
          validateSegmentCompleteness(
            advAccount as any,
            {
              accountId: String((advAccount as any).id),
              lineNumber: null,
              departmentId: (a as any).departmentId ?? null,
              projectId: (a as any).projectId ?? null,
              fundId: (a as any).fundId ?? null,
            },
            { errorMode: 'BAD_REQUEST', module: 'PAYMENTS', transactionType: 'UPDATE_PAYMENT' },
          );
        }
      }
    }

    if (existing.type === 'CUSTOMER_RECEIPT') {
      const ids = allocations.map((a: any) => a.sourceId);
      const invoices = await this.prisma.customerInvoice.findMany({
        where: { tenantId: tenant.id, id: { in: ids }, status: 'POSTED' },
        select: { id: true, totalAmount: true },
      });
      const map = new Map(invoices.map((i) => [i.id, i] as const));
      for (const a of allocations) {
        const inv = map.get(a.sourceId);
        if (!inv) {
          throw new BadRequestException(
            `Customer invoice not found or not POSTED: ${a.sourceId}`,
          );
        }
        if (Number(a.amount) > Number(inv.totalAmount)) {
          throw new BadRequestException(
            `Allocation exceeds customer invoice total: ${a.sourceId}`,
          );
        }
      }
    }

    return this.prisma.payment.update({
      where: { id: existing.id },
      data: {
        bankAccountId: dto.bankAccountId,
        amount: dto.amount,
        paymentDate: new Date(dto.paymentDate),
        reference: dto.reference,
        allocations: {
          deleteMany: {},
          create: allocations.map((a: any) => ({
            sourceType: a.sourceType,
            sourceId: a.sourceId,
            amount: a.amount,
            departmentId: a.departmentId ?? null,
            projectId: a.projectId ?? null,
            fundId: a.fundId ?? null,
          })),
        },
      },
      include: { allocations: true, bankAccount: true },
    });
  }

  async approvePayment(req: Request, id: string) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const p = await this.prisma.payment.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true, createdById: true },
    });

    if (!p) {
      throw new NotFoundException('Payment not found');
    }

    if (p.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT payments can be approved');
    }

    return this.prisma.payment.update({
      where: { id: p.id },
      data: {
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
      },
      include: { allocations: true, bankAccount: true },
    });
  }

  async postPayment(
    req: Request,
    id: string,
    opts?: { apControlAccountCode?: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const p = await this.prisma.payment.findFirst({
      where: { id, tenantId: tenant.id },
      include: { allocations: true, bankAccount: true },
    });

    if (!p) {
      throw new NotFoundException('Payment not found');
    }

    if (p.status === 'POSTED') {
      throw new BadRequestException('Payment is already posted');
    }

    if (p.status !== 'APPROVED') {
      throw new BadRequestException('Only APPROVED payments can be posted');
    }

    if (!p.approvedById) {
      throw new BadRequestException(
        'Payment must have an approver before posting',
      );
    }

    if ((p.allocations ?? []).length > 0) {
      this.assertAllocations(
        p.allocations.map((a: any) => ({
          sourceType: a.sourceType,
          sourceId: a.sourceId,
          amount: Number(a.amount),
        })),
        Number(p.amount),
      );
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        startDate: { lte: p.paymentDate },
        endDate: { gte: p.paymentDate },
      },
      select: { id: true, status: true, name: true },
    });

    if (!period) {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.JOURNAL_POST,
          entityType: AuditEntityType.JOURNAL_ENTRY,
          entityId: p.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'PAYMENT_POST',
          permissionUsed: PERMISSIONS.PAYMENT.POST,
          lifecycleType: 'POST',
          reason: 'No accounting period exists for the payment date',
          metadata: {
            entityTypeRaw: 'PAYMENT',
            paymentId: p.id,
            periodId: null,
            periodName: null,
            periodStatus: null,
          },
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: 'No accounting period exists for the payment date',
      });
    }

    // Canonical period semantics: posting is allowed only in OPEN.
    // We preserve the existing ForbiddenException payload/messages on failure.
    try {
      assertCanPost(period.status, { periodName: period.name });
    } catch {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.JOURNAL_POST,
          entityType: AuditEntityType.JOURNAL_ENTRY,
          entityId: p.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'PAYMENT_POST',
          permissionUsed: PERMISSIONS.PAYMENT.POST,
          lifecycleType: 'POST',
          reason: `Accounting period is not OPEN: ${period.name}`,
          metadata: {
            entityTypeRaw: 'PAYMENT',
            paymentId: p.id,
            periodId: period.id,
            periodName: period.name,
            periodStatus: period.status,
          },
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: `Accounting period is not OPEN: ${period.name}`,
      });
    }

    if (period.name === 'Opening Balances') {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.JOURNAL_POST,
          entityType: AuditEntityType.JOURNAL_ENTRY,
          entityId: p.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'PAYMENT_POST',
          permissionUsed: PERMISSIONS.PAYMENT.POST,
          lifecycleType: 'POST',
          reason: 'Operational postings are not allowed in the Opening Balances period',
          metadata: {
            entityTypeRaw: 'PAYMENT',
            paymentId: p.id,
            periodId: period.id,
            periodName: period.name,
            periodStatus: period.status,
          },
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Posting blocked by opening balances control period',
        reason:
          'Operational postings are not allowed in the Opening Balances period',
      });
    }

    const cutoverLocked = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        name: 'Opening Balances',
        status: 'CLOSED',
      },
      orderBy: { startDate: 'desc' },
      select: { startDate: true },
    });

    if (cutoverLocked && p.paymentDate < cutoverLocked.startDate) {
      const cutoverReason = `Posting dated before cutover is not allowed (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`;
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.JOURNAL_POST,
          entityType: AuditEntityType.JOURNAL_ENTRY,
          entityId: p.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'PAYMENT_POST',
          permissionUsed: PERMISSIONS.PAYMENT.POST,
          lifecycleType: 'POST',
          reason: cutoverReason,
          metadata: {
            entityTypeRaw: 'PAYMENT',
            paymentId: p.id,
            cutoverDate: cutoverLocked.startDate.toISOString().slice(0, 10),
          },
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Posting blocked by cutover lock',
        reason: cutoverReason,
      });
    }

    const bankGl = await this.prisma.account.findFirst({
      where: {
        tenantId: tenant.id,
        id: p.bankAccount.glAccountId,
        status: 'ACTIVE' as any,
        isActive: true,
        type: 'ASSET',
      },
      select: {
        id: true,
        status: true,
        isActive: true,
        isPostingAllowed: true,
        isPosting: true,
        isControlAccount: true,
      },
    });

    if (!bankGl) {
      throw new BadRequestException('Bank GL account not found or invalid');
    }

    validateAccountPostingEligibility(bankGl as any, {
      allowControlAccount: true,
      errorMode: 'BAD_REQUEST',
    });

    const apCode = opts?.apControlAccountCode ?? '2000';

    let journalLines: Array<{
      accountId: string;
      debit: any;
      credit: any;
      departmentId?: string | null;
      projectId?: string | null;
      fundId?: string | null;
      lineNumber?: number;
    }>;

    if (p.type === 'SUPPLIER_PAYMENT') {
      const hasAdvance = (p.allocations ?? []).some((a: any) => a.sourceType === 'SUPPLIER_ADVANCE');
      const hasInvoice = (p.allocations ?? []).some((a: any) => a.sourceType === 'SUPPLIER_INVOICE');
      if (!hasAdvance && !hasInvoice) {
        throw new BadRequestException('Supplier payment must have at least 1 allocation');
      }
      if (hasAdvance && hasInvoice) {
        throw new BadRequestException('Supplier payment cannot mix SUPPLIER_INVOICE and SUPPLIER_ADVANCE allocations');
      }

      if (hasAdvance) {
        const tenantCfg = await (this.prisma.tenant as any).findUnique({
          where: { id: tenant.id },
          select: { supplierAdvanceAccountId: true } as any,
        });
        const advAccountId = String((tenantCfg as any)?.supplierAdvanceAccountId ?? '').trim();
        if (!advAccountId) {
          throw new BadRequestException(
            'Supplier advance account is not configured. Please configure it in Settings before posting advance payments.',
          );
        }

        const advAccount = await this.prisma.account.findFirst({
          where: {
            tenantId: tenant.id,
            id: advAccountId,
            status: 'ACTIVE' as any,
            isActive: true,
          } as any,
          select: {
            id: true,
            status: true,
            isActive: true,
            isPostingAllowed: true,
            isPosting: true,
            isControlAccount: true,
            requiresDepartment: true,
            requiresProject: true,
            requiresFund: true,
          } as any,
        });
        if (!advAccount) {
          throw new BadRequestException('Supplier advance account not found or invalid');
        }
        validateAccountPostingEligibility(advAccount as any, {
          allowControlAccount: true,
          errorMode: 'BAD_REQUEST',
        });

        journalLines = (p.allocations ?? []).map((a: any, idx: number) => ({
          accountId: String((advAccount as any).id),
          debit: a.amount,
          credit: 0,
          departmentId: a.departmentId ?? null,
          projectId: a.projectId ?? null,
          fundId: a.fundId ?? null,
          lineNumber: idx + 1,
        }));

        const bankLines = (p.allocations ?? []).map((a: any, idx: number) => ({
          accountId: String(bankGl.id),
          debit: 0,
          credit: a.amount,
          departmentId: a.departmentId ?? null,
          projectId: a.projectId ?? null,
          fundId: a.fundId ?? null,
          lineNumber: (p.allocations?.length ?? 0) + idx + 1,
        }));

        journalLines = [...journalLines, ...bankLines];
      } else {
      const apAccount = await this.prisma.account.findFirst({
        where: {
          tenantId: tenant.id,
          code: apCode,
          status: 'ACTIVE',
          isActive: true,
          type: 'LIABILITY',
        },
        select: {
          id: true,
          status: true,
          isActive: true,
          isPostingAllowed: true,
          isPosting: true,
          isControlAccount: true,
        },
      });
      if (!apAccount) {
        throw new BadRequestException(
          `AP control account not found or invalid: ${apCode}`,
        );
      }

      validateAccountPostingEligibility(apAccount as any, {
        allowControlAccount: true,
        errorMode: 'BAD_REQUEST',
      });

      const allocInvoiceIds = [...new Set((p.allocations ?? []).map((a: any) => String(a.sourceId)))]
        .map((s) => s.trim())
        .filter(Boolean);

      const invoices = await this.prisma.supplierInvoice.findMany({
        where: {
          tenantId: tenant.id,
          id: { in: allocInvoiceIds },
          status: 'POSTED' as any,
        } as any,
        include: {
          lines: {
            select: {
              id: true,
              amount: true,
              departmentId: true,
              projectId: true,
              fundId: true,
            } as any,
          },
        } as any,
      });
      const invById = new Map(invoices.map((i: any) => [String(i.id), i] as const));
      for (const alloc of p.allocations ?? []) {
        const inv = invById.get(String((alloc as any).sourceId));
        if (!inv) {
          throw new BadRequestException(
            `Supplier invoice not found or not POSTED: ${String((alloc as any).sourceId)}`,
          );
        }
        const lines = (inv as any).lines ?? [];
        if (!Array.isArray(lines) || lines.length < 1) {
          throw new BadRequestException(
            `Supplier invoice has no lines and cannot be allocated: ${String((alloc as any).sourceId)}`,
          );
        }
      }

      const bucket = new Map<
        string,
        { departmentId: string | null; projectId: string | null; fundId: string | null; amount: number }
      >();
      const bucketKey = (d: any, p: any, f: any) => `${String(d ?? '')}::${String(p ?? '')}::${String(f ?? '')}`;
      const round2 = (n: number) => Math.round(n * 100) / 100;

      for (const alloc of p.allocations ?? []) {
        const inv = invById.get(String((alloc as any).sourceId)) as any;
        const lines = (inv?.lines ?? []) as any[];
        const totals = lines.reduce((s, l) => s + Number(l.amount ?? 0), 0);
        const allocAmt = Number((alloc as any).amount ?? 0);
        if (allocAmt <= 0) continue;

        if (totals <= 0) {
          throw new BadRequestException(
            `Supplier invoice lines have invalid total for allocation: ${String((alloc as any).sourceId)}`,
          );
        }

        const normalized = lines
          .map((l) => ({
            departmentId: (l as any).departmentId ?? null,
            projectId: (l as any).projectId ?? null,
            fundId: (l as any).fundId ?? null,
            share: Number(l.amount ?? 0) / totals,
          }))
          .filter((x) => x.share > 0);

        let distributed = 0;
        for (let idx = 0; idx < normalized.length; idx++) {
          const n = normalized[idx];
          const isLast = idx === normalized.length - 1;
          const raw = allocAmt * n.share;
          const amt = isLast ? round2(allocAmt - distributed) : round2(raw);
          distributed = round2(distributed + amt);
          if (amt === 0) continue;

          const key = bucketKey(n.departmentId, n.projectId, n.fundId);
          const prev = bucket.get(key);
          if (prev) {
            prev.amount = round2(prev.amount + amt);
          } else {
            bucket.set(key, {
              departmentId: n.departmentId,
              projectId: n.projectId,
              fundId: n.fundId,
              amount: amt,
            });
          }
        }
      }

      const apDebits = [...bucket.values()]
        .filter((b) => b.amount !== 0)
        .map((b) => ({
          accountId: String(apAccount.id),
          debit: b.amount,
          credit: 0,
          departmentId: b.departmentId,
          projectId: b.projectId,
          fundId: b.fundId,
        }));

      const bankCredits = [...bucket.values()]
        .filter((b) => b.amount !== 0)
        .map((b) => ({
          accountId: String(bankGl.id),
          debit: 0,
          credit: b.amount,
          departmentId: b.departmentId,
          projectId: b.projectId,
          fundId: b.fundId,
        }));

      journalLines = [...apDebits, ...bankCredits];
      }
    } else if (p.type === 'CUSTOMER_RECEIPT') {
      const arAccount = await resolveArControlAccount(this.prisma as any, tenant.id);

      const allocInvoiceIds = [...new Set((p.allocations ?? []).map((a: any) => String(a.sourceId)))]
        .map((s) => s.trim())
        .filter(Boolean);

      const invoices = await this.prisma.customerInvoice.findMany({
        where: {
          tenantId: tenant.id,
          id: { in: allocInvoiceIds },
          status: 'POSTED' as any,
        } as any,
        select: {
          id: true,
          departmentId: true,
          projectId: true,
          fundId: true,
        } as any,
      });
      const invById = new Map(invoices.map((i: any) => [String(i.id), i] as const));
      for (const alloc of p.allocations ?? []) {
        if (!invById.get(String((alloc as any).sourceId))) {
          throw new BadRequestException(
            `Customer invoice not found or not POSTED: ${String((alloc as any).sourceId)}`,
          );
        }
      }

      const arCredits = (p.allocations ?? []).map((a: any) => {
        const inv = invById.get(String(a.sourceId)) as any;
        return {
          accountId: String(arAccount.id),
          debit: 0,
          credit: a.amount,
          departmentId: inv?.departmentId ?? null,
          projectId: inv?.projectId ?? null,
          fundId: inv?.fundId ?? null,
        };
      });

      journalLines = [
        { accountId: bankGl.id, debit: p.amount, credit: 0 },
        ...arCredits,
      ];
    } else {
      throw new BadRequestException('Invalid payment type');
    }

    const segmentAccounts = await this.prisma.account.findMany({
      where: {
        tenantId: tenant.id,
        id: { in: [...new Set(journalLines.map((l) => String(l.accountId)))] },
      },
      select: {
        id: true,
        requiresDepartment: true,
        requiresProject: true,
        requiresFund: true,
      } as any,
    });
    const segmentById = new Map(segmentAccounts.map((a: any) => [String(a.id), a] as const));
    for (const l of journalLines) {
      const a = segmentById.get(String(l.accountId));
      if (!a) {
        throw new BadRequestException(`Account not found: ${String(l.accountId)}`);
      }
      validateSegmentCompleteness(
        a as any,
        {
          accountId: String(l.accountId),
          lineNumber: (l as any).lineNumber ?? null,
          departmentId: (l as any).departmentId ?? null,
          projectId: (l as any).projectId ?? null,
          fundId: (l as any).fundId ?? null,
        },
        { errorMode: 'BAD_REQUEST', module: 'PAYMENTS', transactionType: 'POST_PAYMENT' },
      );
    }

    const now = new Date();

    const journal = await this.prisma.journalEntry.create({
      data: {
        tenantId: tenant.id,
        journalDate: p.paymentDate,
        reference: `PAYMENT:${p.id}`,
        description: `Payment posting: ${p.id}`,
        createdById: p.createdById,
        status: 'REVIEWED',
        reviewedById: user.id,
        reviewedAt: now,
        lines: {
          create: journalLines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            departmentId: (l as any).departmentId ?? null,
            projectId: (l as any).projectId ?? null,
            fundId: (l as any).fundId ?? null,
          })),
        },
      },
      include: { lines: true },
    });

    const postedJournal = await this.gl.postJournal(req, journal.id);

    const updatedPayment = await this.prisma.payment.update({
      where: { id: p.id },
      data: {
        status: 'POSTED',
        postedById: user.id,
        postedAt: now,
      },
      include: { allocations: true, bankAccount: true },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.JOURNAL_POST,
        entityType: AuditEntityType.JOURNAL_ENTRY,
        entityId: postedJournal.id,
        actorUserId: user.id,
        timestamp: now,
        outcome: 'SUCCESS' as any,
        action: 'PAYMENT_POST',
        permissionUsed: PERMISSIONS.PAYMENT.POST,
        lifecycleType: 'POST',
        metadata: {
          entityTypeRaw: 'PAYMENT',
          paymentId: updatedPayment.id,
          journalId: postedJournal.id,
          paymentType: updatedPayment.type,
        },
      },
      this.prisma,
    );

    return { payment: updatedPayment, glJournal: postedJournal };
  }

  async listPayments(req: Request) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    return this.prisma.payment.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
      include: { allocations: true, bankAccount: true },
    });
  }

  private assertAllocations(
    allocations: Array<{
      sourceType: string;
      sourceId: string;
      amount: number;
    }>,
    amount: number,
  ) {
    if (!allocations || allocations.length < 1) {
      throw new BadRequestException('Payment must have at least 1 allocation');
    }

    for (const a of allocations) {
      if ((a.amount ?? 0) <= 0) {
        throw new BadRequestException(
          'Allocation amount must be greater than zero',
        );
      }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const sum = round2(allocations.reduce((s, a) => s + (a.amount ?? 0), 0));
    const total = round2(amount ?? 0);

    if (sum !== total) {
      throw new BadRequestException({
        error: 'Allocations do not sum to payment amount',
        sum,
        amount: total,
      });
    }
  }
}
