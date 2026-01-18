import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, PaymentProposalStatus } from '@prisma/client';
import { writeAuditEventWithPrisma } from '../../audit/audit-writer';
import { AuditEntityType, AuditEventType } from '@prisma/client';
import { assertCanPost } from '../../periods/period-guard';
import { PERMISSIONS } from '../../rbac/permission-catalog';
import type {
  CreatePaymentProposalDto,
  EligibleApInvoicesQueryDto,
  ListPaymentProposalsQueryDto,
  RejectPaymentProposalDto,
} from './payment-proposals.dto';

@Injectable()
export class PaymentProposalsService {
  private readonly PROPOSAL_NUMBER_SEQUENCE_NAME = 'AP_PAYMENT_PROPOSAL_NUMBER';

  constructor(private readonly prisma: PrismaService) {}

  private round2(n: number) {
    return Math.round((Number(n ?? 0) + Number.EPSILON) * 100) / 100;
  }

  async updateDraft(req: Request, id: string, dto: CreatePaymentProposalDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    const proposalDateStr = String(dto.proposalDate ?? this.todayIsoDate()).trim();
    const proposalDate = this.parseDateOnly(proposalDateStr);

    if (!Array.isArray(dto.lines) || dto.lines.length === 0) {
      throw new BadRequestException('At least one invoice line is required');
    }

    return this.prisma.$transaction(async (tx: any) => {
      const existing = await tx.paymentProposal.findFirst({
        where: { id, tenantId: tenant.id },
        include: { lines: true },
      });
      if (!existing) throw new NotFoundException('Payment proposal not found');

      if (existing.status !== PaymentProposalStatus.DRAFT) {
        throw new BadRequestException('Only DRAFT proposals can be edited');
      }

      if (existing.createdById !== user.id) {
        throw new ForbiddenException('Only the creator can edit this proposal');
      }

      const invoiceIds = dto.lines.map((l) => l.invoiceId);
      const invoices = await tx.supplierInvoice.findMany({
        where: {
          tenantId: tenant.id,
          id: { in: invoiceIds },
          status: 'POSTED',
        },
        include: { supplier: { select: { id: true, name: true } } },
      });

      const invoiceMap = new Map(invoices.map((i: any) => [i.id, i] as const));
      for (const line of dto.lines) {
        const inv = invoiceMap.get(line.invoiceId);
        if (!inv) {
          throw new BadRequestException(`Invoice not found or not POSTED: ${line.invoiceId}`);
        }
      }

      const outstanding = await this.computeOutstandingByInvoiceId({
        tenantId: tenant.id,
        invoiceIds,
        tx,
      });

      const reservedMap = await this.computeReservedByInvoiceId({
        tenantId: tenant.id,
        invoiceIds,
        statuses: ['SUBMITTED', 'APPROVED'],
        excludeProposalId: existing.id,
        tx,
      });

      const computedLines = dto.lines.map((l) => {
        const inv: any = invoiceMap.get(l.invoiceId);
        const outAmt = this.round2(outstanding.get(l.invoiceId) ?? 0);
        const reservedAmt = this.round2(reservedMap.get(l.invoiceId) ?? 0);
        const remainingAmt = this.round2(outAmt - reservedAmt);
        const proposed = this.round2(Number(l.proposedPayAmount));

        if (proposed <= 0) {
          throw new BadRequestException('Proposed amount must be greater than zero.');
        }
        if (outAmt <= 0 || remainingAmt <= 0) {
          throw new BadRequestException('Invoice is not eligible for payment proposal.');
        }
        if (proposed > remainingAmt) {
          throw new BadRequestException('Proposed amount exceeds remaining payable balance for this invoice.');
        }

        return {
          tenantId: tenant.id,
          supplierId: inv.supplierId,
          supplierName: inv.supplier?.name ?? '',
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          originalAmount: inv.totalAmount,
          outstandingAmount: new Prisma.Decimal(outAmt),
          proposedPayAmount: new Prisma.Decimal(proposed),
        };
      });

      for (const l of computedLines) {
        await this.assertInvoicePeriodOpen({
          tenantId: tenant.id,
          invoiceDate: l.invoiceDate as any,
          tx,
        });
      }

      const totalAmount = computedLines.reduce(
        (s, l) => s + Number(l.proposedPayAmount),
        0,
      );

      await tx.paymentProposalLine.deleteMany({ where: { proposalId: existing.id } });

      const updated = await tx.paymentProposal.update({
        where: { id: existing.id },
        data: {
          proposalDate,
          notes: dto.notes ?? null,
          totalAmount: new Prisma.Decimal(this.round2(totalAmount)),
          lines: { create: computedLines },
        },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
          approvedBy: { select: { id: true, email: true, name: true } },
          rejectedBy: { select: { id: true, email: true, name: true } },
          lines: true,
        },
      });

      return updated;
    });
  }

  private todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  private parseDateOnly(dateStr: string): Date {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
    return d;
  }

  private async nextProposalNumber(tx: any, tenantId: string) {
    const counter = await tx.tenantSequenceCounter.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: this.PROPOSAL_NUMBER_SEQUENCE_NAME,
        },
      },
      create: {
        tenantId,
        name: this.PROPOSAL_NUMBER_SEQUENCE_NAME,
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

    return `PP-${String(bumped.value).padStart(6, '0')}`;
  }

  private async computeOutstandingByInvoiceId(params: {
    tenantId: string;
    invoiceIds: string[];
    tx?: Prisma.TransactionClient;
  }): Promise<Map<string, number>> {
    const tx = params.tx ?? (this.prisma as any);

    if (params.invoiceIds.length === 0) return new Map();

    const invoices = await tx.supplierInvoice.findMany({
      where: {
        tenantId: params.tenantId,
        id: { in: params.invoiceIds },
      },
      select: { id: true, totalAmount: true },
    });

    const allocs = await tx.paymentAllocation.findMany({
      where: {
        sourceType: 'SUPPLIER_INVOICE',
        sourceId: { in: params.invoiceIds },
        payment: {
          tenantId: params.tenantId,
          status: 'POSTED',
          type: 'SUPPLIER_PAYMENT',
        },
      },
      select: { sourceId: true, amount: true },
    });

    const paid = new Map<string, number>();
    for (const a of allocs) {
      const prev = paid.get(a.sourceId) ?? 0;
      paid.set(a.sourceId, prev + Number(a.amount));
    }

    const out = new Map<string, number>();
    for (const inv of invoices) {
      const total = Number(inv.totalAmount);
      const paidAmt = this.round2(paid.get(inv.id) ?? 0);
      out.set(inv.id, this.round2(total - paidAmt));
    }
    return out;
  }

  private async computeReservedByInvoiceId(params: {
    tenantId: string;
    invoiceIds: string[];
    statuses: string[];
    excludeProposalId?: string;
    tx?: Prisma.TransactionClient;
  }): Promise<Map<string, number>> {
    const tx = params.tx ?? (this.prisma as any);

    if (params.invoiceIds.length === 0) return new Map();

    const grouped = await tx.paymentProposalLine.groupBy({
      by: ['invoiceId'],
      where: {
        tenantId: params.tenantId,
        invoiceId: { in: params.invoiceIds },
        ...(params.excludeProposalId
          ? { proposalId: { not: params.excludeProposalId } }
          : {}),
        proposal: { status: { in: params.statuses as any } },
      },
      _sum: { proposedPayAmount: true },
    });

    const out = new Map<string, number>();
    for (const r of grouped as any[]) {
      out.set(r.invoiceId, Number(r._sum?.proposedPayAmount ?? 0));
    }
    return out;
  }

  private async assertInvoicePeriodOpen(params: {
    tenantId: string;
    invoiceDate: Date;
    tx: Prisma.TransactionClient;
  }) {
    const period = await params.tx.accountingPeriod.findFirst({
      where: {
        tenantId: params.tenantId,
        startDate: { lte: params.invoiceDate },
        endDate: { gte: params.invoiceDate },
      },
      select: { id: true, status: true, name: true },
    });

    if (!period) {
      throw new ForbiddenException({
        error: 'Blocked by accounting period control',
        reason: 'No accounting period exists for the invoice date',
      });
    }

    try {
      assertCanPost(period.status, { periodName: period.name });
    } catch {
      throw new ForbiddenException({
        error: 'Blocked by accounting period control',
        reason: `Accounting period is not OPEN: ${period.name}`,
      });
    }

    if (period.name === 'Opening Balances') {
      throw new ForbiddenException({
        error: 'Blocked by opening balances control period',
        reason: 'Operational postings are not allowed in the Opening Balances period',
      });
    }
  }

  async list(req: Request, q: ListPaymentProposalsQueryDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const where: any = { tenantId: tenant.id };
    if (q.status) where.status = q.status;

    if (q.fromDate || q.toDate) {
      const from = q.fromDate ? this.parseDateOnly(q.fromDate) : undefined;
      const to = q.toDate ? this.parseDateOnly(q.toDate) : undefined;
      where.proposalDate = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    return this.prisma.paymentProposal.findMany({
      where,
      orderBy: [{ proposalDate: 'desc' }, { proposalNumber: 'desc' }],
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        approvedBy: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async listEligibleInvoices(req: Request, q: EligibleApInvoicesQueryDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const limitRaw = typeof q.limit === 'number' ? q.limit : undefined;
    const take = Math.max(1, Math.min(limitRaw ?? 200, 500));

    const supplierId = (q.supplierId ?? '').trim();
    const search = (q.search ?? '').trim();

    const where: any = {
      tenantId: tenant.id,
      status: 'POSTED',
      ...(supplierId ? { supplierId } : {}),
    };

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const invoices = await this.prisma.supplierInvoice.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { invoiceDate: 'asc' }],
      take,
      select: {
        id: true,
        supplierId: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        totalAmount: true,
        status: true,
        supplier: { select: { id: true, name: true } },
      },
    });

    const invoiceIds = invoices.map((i) => i.id);
    const outstandingMap = await this.computeOutstandingByInvoiceId({
      tenantId: tenant.id,
      invoiceIds,
    });

    const reservedMap = await this.computeReservedByInvoiceId({
      tenantId: tenant.id,
      invoiceIds,
      statuses: ['SUBMITTED', 'APPROVED'],
    });

    const results = invoices
      .map((inv: any) => {
        const outstandingAmount = this.round2(outstandingMap.get(inv.id) ?? 0);
        const reservedAmount = this.round2(reservedMap.get(inv.id) ?? 0);
        const remainingProposableAmount = this.round2(outstandingAmount - reservedAmount);

        return {
          id: inv.id,
          invoiceId: inv.id,
          supplierId: inv.supplierId,
          supplierName: inv.supplier?.name ?? '',
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          totalAmount: Number(inv.totalAmount),
          invoiceTotal: Number(inv.totalAmount),
          outstandingAmount,
          outstandingBalance: outstandingAmount,
          reservedAmount,
          remainingProposableAmount,
          remainingProposable: remainingProposableAmount,
        };
      })
      .filter((r) => r.outstandingAmount > 0 && r.remainingProposableAmount > 0);

    return results;
  }

  async listEligibleForExecution(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const proposals = await this.prisma.paymentProposal.findMany({
      where: {
        tenantId: tenant.id,
        status: PaymentProposalStatus.APPROVED,
      },
      orderBy: [{ proposalDate: 'desc' }, { proposalNumber: 'desc' }],
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        approvedBy: { select: { id: true, email: true, name: true } },
        lines: { orderBy: [{ supplierName: 'asc' }, { dueDate: 'asc' }] },
      },
    });

    if (proposals.length === 0) return [];

    const allLines = proposals.flatMap((p) => p.lines);
    const lineIds = allLines.map((l) => l.id);
    const invoiceIds = [...new Set(allLines.map((l) => l.invoiceId))];

    const executed = await this.prisma.paymentRunLine.findMany({
      where: { paymentProposalLineId: { in: lineIds } },
      select: { paymentProposalLineId: true },
    });
    const executedSet = new Set(executed.map((x) => x.paymentProposalLineId));

    const outstandingByInvoiceId = await this.computeOutstandingByInvoiceId({
      tenantId: tenant.id,
      invoiceIds,
    });

    const out = proposals
      .map((p: any) => {
        const linesWithOutstanding = (p.lines ?? []).map((l: any) => {
          const outstanding = this.round2(outstandingByInvoiceId.get(l.invoiceId) ?? 0);
          return {
            ...l,
            outstandingAmount: new Prisma.Decimal(outstanding),
            outstandingAmountNumber: outstanding,
          };
        });

        // Execution endpoint executes the whole proposal. So we only expose proposals that will pass:
        // - none of its lines were executed before
        // - each line has sufficient outstanding
        const hasExecutedLine = linesWithOutstanding.some((l: any) => executedSet.has(l.id));
        if (hasExecutedLine) return null;

        const insufficient = linesWithOutstanding.some((l: any) => {
          const outstanding = Number(l.outstandingAmountNumber ?? 0);
          const proposed = this.round2(Number(l.proposedPayAmount ?? 0));
          return !(outstanding > 0) || outstanding < proposed;
        });
        if (insufficient) return null;

        return {
          ...p,
          lines: linesWithOutstanding.map(({ outstandingAmountNumber, ...rest }: any) => rest),
        };
      })
      .filter(Boolean);

    return out;
  }

  async getById(req: Request, id: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const pp = await this.prisma.paymentProposal.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        approvedBy: { select: { id: true, email: true, name: true } },
        lines: { orderBy: [{ supplierName: 'asc' }, { dueDate: 'asc' }] },
      },
    });

    if (!pp) throw new NotFoundException('Payment proposal not found');
    return pp;
  }

  async create(req: Request, dto: CreatePaymentProposalDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    const proposalDateStr = String(dto.proposalDate ?? this.todayIsoDate()).trim();
    const proposalDate = this.parseDateOnly(proposalDateStr);

    if (!Array.isArray(dto.lines) || dto.lines.length === 0) {
      throw new BadRequestException('At least one invoice line is required');
    }

    return this.prisma.$transaction(async (tx: any) => {
      const invoiceIds = dto.lines.map((l) => l.invoiceId);

      const invoices = await tx.supplierInvoice.findMany({
        where: {
          tenantId: tenant.id,
          id: { in: invoiceIds },
          status: 'POSTED',
        },
        include: { supplier: { select: { id: true, name: true } } },
      });

      const invoiceMap = new Map(invoices.map((i: any) => [i.id, i] as const));
      for (const line of dto.lines) {
        const inv = invoiceMap.get(line.invoiceId);
        if (!inv) {
          throw new BadRequestException(
            `Invoice not found or not POSTED: ${line.invoiceId}`,
          );
        }
      }

      const outstanding = await this.computeOutstandingByInvoiceId({
        tenantId: tenant.id,
        invoiceIds,
        tx,
      });

      const reservedMap = await this.computeReservedByInvoiceId({
        tenantId: tenant.id,
        invoiceIds,
        statuses: ['SUBMITTED', 'APPROVED'],
        tx,
      });

      const proposalNumber = await this.nextProposalNumber(tx, tenant.id);

      const computedLines = dto.lines.map((l) => {
        const inv: any = invoiceMap.get(l.invoiceId);
        const outAmt = this.round2(outstanding.get(l.invoiceId) ?? 0);
        const reservedAmt = this.round2(reservedMap.get(l.invoiceId) ?? 0);
        const remainingAmt = this.round2(outAmt - reservedAmt);
        const proposed = this.round2(Number(l.proposedPayAmount));

        if (proposed <= 0) {
          throw new BadRequestException('Proposed amount must be greater than zero.');
        }
        if (outAmt <= 0 || remainingAmt <= 0) {
          throw new BadRequestException('Invoice is not eligible for payment proposal.');
        }
        if (proposed > remainingAmt) {
          throw new BadRequestException(
            'Proposed amount exceeds remaining payable balance for this invoice.',
          );
        }

        return {
          tenantId: tenant.id,
          supplierId: inv.supplierId,
          supplierName: inv.supplier?.name ?? '',
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          originalAmount: inv.totalAmount,
          outstandingAmount: new Prisma.Decimal(outAmt),
          proposedPayAmount: new Prisma.Decimal(proposed),
        };
      });

      // Period-open validation per invoice.
      for (const l of computedLines) {
        await this.assertInvoicePeriodOpen({
          tenantId: tenant.id,
          invoiceDate: l.invoiceDate as any,
          tx,
        });
      }

      const totalAmount = computedLines.reduce(
        (s, l) => s + Number(l.proposedPayAmount),
        0,
      );

      const created = await tx.paymentProposal.create({
        data: {
          tenantId: tenant.id,
          proposalNumber,
          proposalDate,
          status: PaymentProposalStatus.DRAFT,
          totalAmount: new Prisma.Decimal(this.round2(totalAmount)),
          createdById: user.id,
          notes: dto.notes ?? null,
          lines: { create: computedLines },
        },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
          approvedBy: { select: { id: true, email: true, name: true } },
          lines: true,
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.PAYMENT_PROPOSAL_CREATED,
          entityType: AuditEntityType.PAYMENT_PROPOSAL,
          entityId: created.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'SUCCESS' as any,
          action: 'PAYMENT_PROPOSAL_CREATED',
          permissionUsed: PERMISSIONS.AP.PAYMENT_PROPOSAL_CREATE,
          metadata: {
            proposalNumber,
            proposalDate: proposalDateStr,
            lineCount: created.lines.length,
            totalAmount: Number(created.totalAmount),
          },
        },
        this.prisma,
      ).catch(() => undefined);

      return created;
    });
  }

  async submit(req: Request, id: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    return this.prisma.$transaction(async (tx: any) => {
      const pp = await tx.paymentProposal.findFirst({
        where: { id, tenantId: tenant.id },
        include: { lines: true },
      });
      if (!pp) throw new NotFoundException('Payment proposal not found');

      if (pp.status !== 'DRAFT') {
        throw new BadRequestException('Only DRAFT proposals can be submitted');
      }

      if (pp.createdById !== user.id) {
        throw new ForbiddenException('Only the creator can submit this proposal');
      }

      const invoiceIds = pp.lines.map((l) => l.invoiceId);
      const invoices = await tx.supplierInvoice.findMany({
        where: { tenantId: tenant.id, id: { in: invoiceIds }, status: 'POSTED' },
        include: { supplier: { select: { id: true, name: true } } },
      });
      const invoiceMap = new Map(invoices.map((i: any) => [i.id, i] as const));

      const outstanding = await this.computeOutstandingByInvoiceId({
        tenantId: tenant.id,
        invoiceIds,
        tx,
      });

      const reservedMap = await this.computeReservedByInvoiceId({
        tenantId: tenant.id,
        invoiceIds,
        statuses: ['SUBMITTED', 'APPROVED'],
        excludeProposalId: pp.id,
        tx,
      });

      for (const line of pp.lines) {
        const inv: any = invoiceMap.get(line.invoiceId);
        if (!inv) {
          throw new BadRequestException(
            `Invoice not found or not POSTED: ${line.invoiceId}`,
          );
        }

        await this.assertInvoicePeriodOpen({
          tenantId: tenant.id,
          invoiceDate: inv.invoiceDate,
          tx,
        });

        const outAmt = this.round2(outstanding.get(line.invoiceId) ?? 0);
        const reservedAmt = this.round2(reservedMap.get(line.invoiceId) ?? 0);
        const remainingAmt = this.round2(outAmt - reservedAmt);
        if (outAmt <= 0 || remainingAmt <= 0) {
          throw new BadRequestException('Invoice is not eligible for payment proposal.');
        }

        const proposed = this.round2(Number(line.proposedPayAmount));
        if (proposed <= 0) {
          throw new BadRequestException('Proposed amount must be greater than zero.');
        }
        if (proposed > remainingAmt) {
          throw new BadRequestException(
            `Proposed amount of ${proposed} exceeds remaining payable balance of ${remainingAmt} for this invoice.`,
          );
        }

        await tx.paymentProposalLine.update({
          where: { id: line.id },
          data: {
            supplierId: inv.supplierId,
            supplierName: inv.supplier?.name ?? '',
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate,
            dueDate: inv.dueDate,
            originalAmount: inv.totalAmount,
            outstandingAmount: new Prisma.Decimal(outAmt),
          },
        });
      }

      const refreshed = await tx.paymentProposalLine.findMany({
        where: { proposalId: pp.id },
        select: { proposedPayAmount: true },
      });
      const totalAmount = refreshed.reduce(
        (s, l) => s + Number(l.proposedPayAmount),
        0,
      );

      const updated = await tx.paymentProposal.update({
        where: { id: pp.id },
        data: {
          status: PaymentProposalStatus.SUBMITTED,
          totalAmount: new Prisma.Decimal(this.round2(totalAmount)),
          rejectedAt: null,
          rejectedByUserId: null,
          rejectionReason: null,
        },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
          approvedBy: { select: { id: true, email: true, name: true } },
          lines: true,
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.PAYMENT_PROPOSAL_SUBMITTED,
          entityType: AuditEntityType.PAYMENT_PROPOSAL,
          entityId: updated.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'SUCCESS' as any,
          action: 'PAYMENT_PROPOSAL_SUBMITTED',
          permissionUsed: PERMISSIONS.AP.PAYMENT_PROPOSAL_SUBMIT,
          metadata: {
            proposalNumber: updated.proposalNumber,
            lineCount: updated.lines.length,
            totalAmount: Number(updated.totalAmount),
          },
        },
        this.prisma,
      ).catch(() => undefined);

      return updated;
    });
  }

  async approve(req: Request, id: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    return this.prisma.$transaction(async (tx: any) => {
      const pp = await tx.paymentProposal.findFirst({
        where: { id, tenantId: tenant.id },
        include: { lines: true },
      });
      if (!pp) throw new NotFoundException('Payment proposal not found');

      if (pp.status !== 'SUBMITTED') {
        throw new BadRequestException('Only SUBMITTED proposals can be approved');
      }

      if (pp.createdById === user.id) {
        throw new ForbiddenException('Approver cannot be the creator');
      }

      const invoiceIds = pp.lines.map((l) => l.invoiceId);
      const invoices = await tx.supplierInvoice.findMany({
        where: { tenantId: tenant.id, id: { in: invoiceIds }, status: 'POSTED' },
        include: { supplier: { select: { id: true, name: true } } },
      });
      const invoiceMap = new Map(invoices.map((i: any) => [i.id, i] as const));

      const outstanding = await this.computeOutstandingByInvoiceId({
        tenantId: tenant.id,
        invoiceIds,
        tx,
      });

      const reservedMap = await this.computeReservedByInvoiceId({
        tenantId: tenant.id,
        invoiceIds,
        statuses: ['SUBMITTED', 'APPROVED'],
        excludeProposalId: pp.id,
        tx,
      });

      for (const line of pp.lines) {
        const inv: any = invoiceMap.get(line.invoiceId);
        if (!inv) {
          throw new BadRequestException(
            `Invoice not found or not POSTED: ${line.invoiceId}`,
          );
        }

        await this.assertInvoicePeriodOpen({
          tenantId: tenant.id,
          invoiceDate: inv.invoiceDate,
          tx,
        });

        const outAmt = this.round2(outstanding.get(line.invoiceId) ?? 0);
        const reservedAmt = this.round2(reservedMap.get(line.invoiceId) ?? 0);
        const remainingAmt = this.round2(outAmt - reservedAmt);
        if (outAmt <= 0 || remainingAmt <= 0) {
          throw new BadRequestException('Invoice is not eligible for payment proposal.');
        }

        const proposed = this.round2(Number(line.proposedPayAmount));
        if (proposed <= 0) {
          throw new BadRequestException('Proposed amount must be greater than zero.');
        }
        if (proposed > remainingAmt) {
          throw new BadRequestException(
            'Proposed amount exceeds remaining payable balance for this invoice.',
          );
        }

        await tx.paymentProposalLine.update({
          where: { id: line.id },
          data: {
            supplierId: inv.supplierId,
            supplierName: inv.supplier?.name ?? '',
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.invoiceDate,
            dueDate: inv.dueDate,
            originalAmount: inv.totalAmount,
            outstandingAmount: new Prisma.Decimal(outAmt),
          },
        });
      }

      const refreshed = await tx.paymentProposalLine.findMany({
        where: { proposalId: pp.id },
        select: { proposedPayAmount: true },
      });
      const totalAmount = refreshed.reduce(
        (s, l) => s + Number(l.proposedPayAmount),
        0,
      );

      const updated = await tx.paymentProposal.update({
        where: { id: pp.id },
        data: {
          status: PaymentProposalStatus.APPROVED,
          approvedById: user.id,
          approvedAt: new Date(),
          totalAmount: new Prisma.Decimal(this.round2(totalAmount)),
          rejectedAt: null,
          rejectedByUserId: null,
          rejectionReason: null,
        },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
          approvedBy: { select: { id: true, email: true, name: true } },
          lines: true,
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.PAYMENT_PROPOSAL_APPROVED,
          entityType: AuditEntityType.PAYMENT_PROPOSAL,
          entityId: updated.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'SUCCESS' as any,
          action: 'PAYMENT_PROPOSAL_APPROVED',
          permissionUsed: PERMISSIONS.AP.PAYMENT_PROPOSAL_APPROVE,
          metadata: {
            proposalNumber: updated.proposalNumber,
            lineCount: updated.lines.length,
            totalAmount: Number(updated.totalAmount),
          },
        },
        this.prisma,
      ).catch(() => undefined);

      return updated;
    });
  }

  async reject(req: Request, id: string, dto: RejectPaymentProposalDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    const reason = String(dto?.reason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    return this.prisma.$transaction(async (tx: any) => {
      const pp = await tx.paymentProposal.findFirst({
        where: { id, tenantId: tenant.id },
        include: { lines: true },
      });
      if (!pp) throw new NotFoundException('Payment proposal not found');

      const prevStatus = String(pp.status);

      if (pp.status !== 'SUBMITTED') {
        throw new BadRequestException('Only SUBMITTED proposals can be rejected');
      }

      if (pp.createdById === user.id) {
        throw new ForbiddenException('Creator cannot reject their own proposal');
      }

      const updated = await tx.paymentProposal.update({
        where: { id: pp.id },
        data: {
          status: PaymentProposalStatus.DRAFT,
          rejectedAt: new Date(),
          rejectedByUserId: user.id,
          rejectionReason: reason,
          approvedAt: null,
          approvedById: null,
        },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
          approvedBy: { select: { id: true, email: true, name: true } },
          rejectedBy: { select: { id: true, email: true, name: true } },
          lines: true,
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: (AuditEventType as any).PAYMENT_PROPOSAL_REJECTED,
          entityType: AuditEntityType.PAYMENT_PROPOSAL,
          entityId: updated.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'SUCCESS' as any,
          action: 'PAYMENT_PROPOSAL_REJECTED',
          permissionUsed: PERMISSIONS.AP.PAYMENT_PROPOSAL_REJECT,
          metadata: {
            previousStatus: prevStatus,
            newStatus: PaymentProposalStatus.DRAFT,
            rejectionReason: reason,
          },
        },
        this.prisma,
      ).catch(() => undefined);

      return updated;
    });
  }
}
