import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Prisma, AuditEntityType, AuditEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS } from '../../rbac/permission-catalog';
import { writeAuditEventWithPrisma } from '../../audit/audit-writer';
import { assertCanPost } from '../../periods/period-guard';
import type {
  ExecutePaymentRunDto,
  ListPaymentRunsQueryDto,
} from './payment-runs.dto';

@Injectable()
export class PaymentRunsService {
  private readonly PAYMENT_RUN_NUMBER_SEQUENCE_NAME = 'AP_PAYMENT_RUN_NUMBER';

  constructor(private readonly prisma: PrismaService) {}

  private round2(n: number) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  private parseDateOnly(dateStr: string): Date {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
    return d;
  }

  private async nextRunNumber(tx: Prisma.TransactionClient, tenantId: string) {
    const counter = await tx.tenantSequenceCounter.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: this.PAYMENT_RUN_NUMBER_SEQUENCE_NAME,
        },
      },
      create: {
        tenantId,
        name: this.PAYMENT_RUN_NUMBER_SEQUENCE_NAME,
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

    return `PR-${String(bumped.value).padStart(6, '0')}`;
  }

  private async computeOutstandingByInvoiceId(params: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    invoiceIds: string[];
  }): Promise<Map<string, number>> {
    if (params.invoiceIds.length === 0) return new Map();

    const invoices = await params.tx.supplierInvoice.findMany({
      where: {
        tenantId: params.tenantId,
        id: { in: params.invoiceIds },
      },
      select: { id: true, totalAmount: true },
    });

    const allocs = await params.tx.paymentAllocation.findMany({
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

  private async resolvePostingPeriodOrThrow(params: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    postingDate: Date;
    actorUserId: string;
    refEntityId: string;
  }) {
    const period = await params.tx.accountingPeriod.findFirst({
      where: {
        tenantId: params.tenantId,
        startDate: { lte: params.postingDate },
        endDate: { gte: params.postingDate },
      },
      select: { id: true, status: true, name: true, startDate: true },
    });

    if (!period) {
      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: 'No accounting period exists for the execution date',
      });
    }

    try {
      assertCanPost(period.status, { periodName: period.name });
    } catch {
      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: `Accounting period is not OPEN: ${period.name}`,
      });
    }

    if (period.name === 'Opening Balances') {
      throw new ForbiddenException({
        error: 'Posting blocked by opening balances control period',
        reason: 'Operational postings are not allowed in the Opening Balances period',
      });
    }

    const cutoverLocked = await params.tx.accountingPeriod.findFirst({
      where: {
        tenantId: params.tenantId,
        name: 'Opening Balances',
        status: 'CLOSED',
      },
      orderBy: { startDate: 'desc' },
      select: { startDate: true },
    });

    if (cutoverLocked && params.postingDate < cutoverLocked.startDate) {
      throw new ForbiddenException({
        error: 'Posting blocked by cutover lock',
        reason: `Posting dated before cutover is not allowed (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`,
      });
    }

    return period;
  }

  async list(req: Request, q: ListPaymentRunsQueryDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.prisma.paymentRun.findMany({
      where: {
        tenantId: tenant.id,
        ...(q.status ? { status: q.status as any } : {}),
      },
      orderBy: { executedAt: 'desc' },
      include: {
        bankAccount: true,
        executedBy: { select: { id: true, name: true, email: true } },
        lines: { include: { invoice: true, supplier: true } },
        period: true,
      },
    });
  }

  async getById(req: Request, id: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const run = await this.prisma.paymentRun.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        bankAccount: true,
        executedBy: { select: { id: true, name: true, email: true } },
        lines: {
          include: {
            invoice: true,
            supplier: true,
            paymentProposalLine: {
              include: {
                proposal: true,
              },
            },
          },
        },
        period: true,
      },
    });

    if (!run) throw new NotFoundException('Payment run not found');
    return run;
  }

  async execute(req: Request, dto: ExecutePaymentRunDto) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const executionDate = this.parseDateOnly(dto.executionDate);
    const proposalIds = [...new Set(dto.paymentProposalIds ?? [])];
    if (proposalIds.length === 0) {
      throw new BadRequestException('At least one payment proposal is required');
    }

    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const proposals = await tx.paymentProposal.findMany({
          where: { tenantId: tenant.id, id: { in: proposalIds } },
          include: { lines: true },
        });

        const foundIds = new Set(proposals.map((p) => p.id));
        const missing = proposalIds.filter((id) => !foundIds.has(id));
        if (missing.length > 0) {
          throw new BadRequestException({
            error: 'Some payment proposals were not found',
            missingProposalIds: missing,
          });
        }

        const notApproved = proposals.filter((p) => p.status !== 'APPROVED');
        if (notApproved.length > 0) {
          throw new BadRequestException({
            error: 'Only APPROVED payment proposals can be executed',
            invalidProposals: notApproved.map((p) => ({
              id: p.id,
              status: p.status,
              proposalNumber: p.proposalNumber,
            })),
          });
        }

        const allLines = proposals.flatMap((p) => p.lines);
        if (allLines.length === 0) {
          throw new BadRequestException('Selected proposals have no lines to execute');
        }

        const lineIds = allLines.map((l) => l.id);
        const alreadyExecuted = await tx.paymentRunLine.findMany({
          where: { paymentProposalLineId: { in: lineIds } },
          select: { paymentProposalLineId: true, paymentRunId: true },
        });

        if (alreadyExecuted.length > 0) {
          throw new BadRequestException({
            error: 'Some proposal lines have already been executed in another payment run',
            executedLines: alreadyExecuted,
          });
        }

        const invoiceIds = [...new Set(allLines.map((l) => l.invoiceId))];
        const outstandingByInvoiceId = await this.computeOutstandingByInvoiceId({
          tx,
          tenantId: tenant.id,
          invoiceIds,
        });

        const insufficient = allLines
          .map((l) => {
            const out = outstandingByInvoiceId.get(l.invoiceId) ?? 0;
            const amt = this.round2(Number(l.proposedPayAmount));
            return {
              proposalLineId: l.id,
              invoiceId: l.invoiceId,
              invoiceNumber: l.invoiceNumber,
              proposedPayAmount: amt,
              outstanding: this.round2(out),
              ok: this.round2(out) >= amt,
            };
          })
          .filter((x) => !x.ok);

        if (insufficient.length > 0) {
          throw new BadRequestException({
            error: 'Outstanding amount is insufficient for one or more proposal lines',
            rows: insufficient,
          });
        }

        const period = await this.resolvePostingPeriodOrThrow({
          tx,
          tenantId: tenant.id,
          postingDate: executionDate,
          actorUserId: user.id,
          refEntityId: 'PAYMENT_RUN',
        });

        if (dto.periodId && dto.periodId !== period.id) {
          throw new BadRequestException({
            error: 'Selected accounting period does not match the execution date',
            selectedPeriodId: dto.periodId,
            periodForExecutionDateId: period.id,
            executionDate: dto.executionDate,
          });
        }

        const tenantRow = await tx.tenant.findUnique({
          where: { id: tenant.id },
          select: { apControlAccountId: true },
        });

        if (!tenantRow?.apControlAccountId) {
          throw new BadRequestException(
            'AP control account is not configured. Please configure it in Settings before executing payment runs.',
          );
        }

        const apAccount = await tx.account.findFirst({
          where: {
            tenantId: tenant.id,
            id: tenantRow.apControlAccountId,
            isActive: true,
            type: 'LIABILITY',
          },
          select: { id: true },
        });

        if (!apAccount) {
          throw new BadRequestException('AP control account not found or invalid');
        }

        const bankAccount = await tx.bankAccount.findFirst({
          where: { tenantId: tenant.id, id: dto.bankAccountId, status: 'ACTIVE' },
          select: { id: true, glAccountId: true },
        });

        if (!bankAccount) {
          throw new BadRequestException('Bank account not found or inactive');
        }

        const bankGl = await tx.account.findFirst({
          where: {
            tenantId: tenant.id,
            id: bankAccount.glAccountId,
            isActive: true,
            type: 'ASSET',
          },
          select: { id: true },
        });

        if (!bankGl) {
          throw new BadRequestException('Bank GL account not found or invalid');
        }

        const totalAmount = this.round2(
          allLines.reduce((s, l) => s + Number(l.proposedPayAmount), 0),
        );

        if (totalAmount <= 0) {
          throw new BadRequestException('Total amount must be greater than 0');
        }

        const runNumber = await this.nextRunNumber(tx, tenant.id);

        const run = await tx.paymentRun.create({
          data: {
            tenantId: tenant.id,
            runNumber,
            executionDate,
            periodId: period.id,
            bankAccountId: bankAccount.id,
            totalAmount,
            status: 'EXECUTED',
            executedByUserId: user.id,
            executedAt: now,
            lines: {
              create: allLines.map((l) => ({
                tenantId: tenant.id,
                paymentProposalLineId: l.id,
                supplierId: l.supplierId,
                invoiceId: l.invoiceId,
                amountPaid: l.proposedPayAmount,
              })),
            },
          },
          include: { lines: true },
        });

        await writeAuditEventWithPrisma(
          {
            tenantId: tenant.id,
            eventType: AuditEventType.PAYMENT_RUN_CREATED,
            entityType: AuditEntityType.PAYMENT_RUN,
            entityId: run.id,
            actorUserId: user.id,
            timestamp: now,
            outcome: 'SUCCESS' as any,
            action: 'AP_PAYMENT_RUN_CREATE',
            permissionUsed: PERMISSIONS.AP.PAYMENT_RUN_EXECUTE,
            lifecycleType: 'CREATE',
            reason: `Payment run created: ${run.runNumber}`,
          },
          tx as any,
        );

        const payment = await tx.payment.create({
          data: {
            tenantId: tenant.id,
            type: 'SUPPLIER_PAYMENT',
            bankAccountId: bankAccount.id,
            amount: new Prisma.Decimal(totalAmount),
            paymentDate: executionDate,
            reference: dto.reference?.trim() || `PAYMENT_RUN:${run.id}`,
            status: 'POSTED',
            createdById: user.id,
            approvedById: user.id,
            approvedAt: now,
            postedById: user.id,
            postedAt: now,
            allocations: {
              create: allLines.map((l) => ({
                sourceType: 'SUPPLIER_INVOICE',
                sourceId: l.invoiceId,
                amount: new Prisma.Decimal(this.round2(Number(l.proposedPayAmount))),
              })),
            },
          },
          include: { allocations: true },
        });

        const journal = await tx.journalEntry.create({
          data: {
            tenantId: tenant.id,
            journalDate: executionDate,
            reference: `PAYMENT_RUN:${run.id}`,
            description: `AP payment run execution: ${run.runNumber}`,
            createdById: user.id,
            lines: {
              create: [
                { accountId: apAccount.id, debit: totalAmount, credit: 0 },
                { accountId: bankGl.id, debit: 0, credit: totalAmount },
              ],
            },
          },
          include: { lines: true },
        });

        const postedJournal = await tx.journalEntry.update({
          where: { id: journal.id },
          data: {
            status: 'POSTED',
            postedById: user.id,
            postedAt: now,
          },
          include: { lines: true },
        });

        await writeAuditEventWithPrisma(
          {
            tenantId: tenant.id,
            eventType: AuditEventType.PAYMENT_RUN_EXECUTED,
            entityType: AuditEntityType.PAYMENT_RUN,
            entityId: run.id,
            actorUserId: user.id,
            timestamp: now,
            outcome: 'SUCCESS' as any,
            action: 'AP_PAYMENT_RUN_EXECUTE',
            permissionUsed: PERMISSIONS.AP.PAYMENT_RUN_EXECUTE,
            lifecycleType: 'POST',
            reason: `Payment run executed: ${run.runNumber}`,
          },
          tx as any,
        );

        return {
          paymentRun: run,
          payment,
          glJournal: postedJournal,
        };
      });
    } catch (e: any) {
      if (e?.code) {
        // let Prisma errors bubble as-is; they are translated elsewhere
      }
      throw e;
    }
  }
}
