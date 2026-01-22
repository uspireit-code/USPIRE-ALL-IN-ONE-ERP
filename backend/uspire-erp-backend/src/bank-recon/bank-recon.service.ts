import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuditEntityType, AuditEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import type {
  AddBankStatementLinesDto,
  CreateAdjustmentJournalDto,
  CreateBankStatementDto,
  ListStatementLinesQueryDto,
  MatchStatementLineDto,
  UnclearedTransactionsQueryDto,
} from './bank-recon.dto';

@Injectable()
export class BankReconService {
  private readonly JOURNAL_NUMBER_SEQUENCE_NAME = 'JOURNAL_ENTRY';

  constructor(private readonly prisma: PrismaService) {}

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

  private round2(n: number) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  private parseDateOnly(dateStr: string): Date {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
    // Normalize to midnight UTC for consistent comparisons
    return new Date(d.toISOString().slice(0, 10));
  }

  private parseMoney(n: unknown): Prisma.Decimal {
    const v = Number(n);
    if (!Number.isFinite(v)) throw new BadRequestException('Invalid amount');
    return new Prisma.Decimal(this.round2(v));
  }

  private toNumber2(v: any): number {
    return this.round2(Number(v ?? 0));
  }

  private assertStatementMutable(status: string) {
    if (status === 'LOCKED' || status === 'RECONCILED') {
      throw new BadRequestException('Statement is not editable');
    }
  }

  private async assertStatementEndDateInOpenPeriod(params: {
    prisma: PrismaService;
    tenantId: string;
    statementEndDate: Date;
  }) {
    const period = await (params.prisma.accountingPeriod as any).findFirst({
      where: {
        tenantId: params.tenantId,
        startDate: { lte: params.statementEndDate },
        endDate: { gte: params.statementEndDate },
      },
      select: { id: true, status: true },
    });

    if (!period) {
      throw new BadRequestException(
        'Cannot reconcile: accounting period is CLOSED.',
      );
    }

    const status = String((period as any).status);
    if (status !== 'OPEN') {
      throw new BadRequestException(
        'Cannot reconcile: accounting period is CLOSED.',
      );
    }

    return period;
  }

  private async assertPostingDateInOpenPeriod(params: {
    prisma: PrismaService;
    tenantId: string;
    postingDate: Date;
  }) {
    const period = await (params.prisma.accountingPeriod as any).findFirst({
      where: {
        tenantId: params.tenantId,
        startDate: { lte: params.postingDate },
        endDate: { gte: params.postingDate },
      },
      select: { id: true, status: true },
    });

    if (!period) {
      throw new BadRequestException(
        'Cannot post adjustment: accounting period is CLOSED.',
      );
    }

    const status = String((period as any).status);
    if (status !== 'OPEN') {
      throw new BadRequestException(
        'Cannot post adjustment: accounting period is CLOSED.',
      );
    }

    return period;
  }

  private validateDebitCredit(params: {
    debitAmount?: number;
    creditAmount?: number;
  }) {
    const debit = this.round2(Number(params.debitAmount ?? 0));
    const credit = this.round2(Number(params.creditAmount ?? 0));

    const debitPos = debit > 0;
    const creditPos = credit > 0;

    if ((debitPos && creditPos) || (!debitPos && !creditPos)) {
      throw new BadRequestException(
        'Exactly one of debitAmount or creditAmount must be > 0',
      );
    }

    return { debit, credit };
  }

  private async assertNoOverlap(params: {
    tenantId: string;
    bankAccountId: string;
    start: Date;
    end: Date;
  }) {
    const overlapping = await this.prisma.bankStatement.findFirst({
      where: {
        tenantId: params.tenantId,
        bankAccountId: params.bankAccountId,
        AND: [
          { statementStartDate: { lte: params.end } },
          { statementEndDate: { gte: params.start } },
        ],
      },
      select: { id: true },
    });

    if (overlapping) {
      throw new BadRequestException(
        'Bank statement date range overlaps an existing statement for this bank account',
      );
    }
  }

  async createStatement(req: Request, dto: CreateBankStatementDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, tenantId: tenant.id, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!bankAccount) throw new BadRequestException('Bank account not found');

    const start = this.parseDateOnly(dto.statementStartDate);
    const end = this.parseDateOnly(dto.statementEndDate);
    if (start > end) {
      throw new BadRequestException('statementStartDate must be <= statementEndDate');
    }

    await this.assertNoOverlap({
      tenantId: tenant.id,
      bankAccountId: dto.bankAccountId,
      start,
      end,
    });

    const now = new Date();

    try {
      const created = await this.prisma.bankStatement.create({
        data: {
          tenantId: tenant.id,
          bankAccountId: dto.bankAccountId,
          statementStartDate: start,
          statementEndDate: end,
          openingBalance: this.parseMoney(dto.openingBalance),
          closingBalance: this.parseMoney(dto.closingBalance),
          status: 'DRAFT',
          createdByUserId: user.id,
        },
        include: { lines: true },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.CREATE_BANK_STATEMENT,
          entityType: AuditEntityType.BANK_STATEMENT,
          entityId: created.id,
          actorUserId: user.id,
          timestamp: now,
          outcome: 'SUCCESS' as any,
          action: 'CREATE_BANK_STATEMENT',
          permissionUsed: PERMISSIONS.BANK.STATEMENT_IMPORT,
          lifecycleType: 'CREATE',
          metadata: {
            bankAccountId: dto.bankAccountId,
            statementStartDate: dto.statementStartDate,
            statementEndDate: dto.statementEndDate,
          },
        },
        this.prisma,
      ).catch(() => undefined);

      return created;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('Duplicate bank statement detected');
      }
      throw err;
    }
  }

  async getStatement(req: Request, id: string) {
    const tenant = this.ensureTenant(req);

    const row = await this.prisma.bankStatement.findFirst({
      where: { id, tenantId: tenant.id },
      include: {
        bankAccount: true,
        createdBy: { select: { id: true, name: true, email: true } },
        lines: {
          orderBy: { txnDate: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Bank statement not found');
    return row;
  }

  async listStatements(req: Request, bankAccountId: string) {
    const tenant = this.ensureTenant(req);

    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!bankAccount) throw new BadRequestException('Bank account not found');

    return this.prisma.bankStatement.findMany({
      where: { tenantId: tenant.id, bankAccountId },
      orderBy: { statementEndDate: 'desc' },
      include: { _count: { select: { lines: true } } },
    });
  }

  async addStatementLines(req: Request, statementId: string, dto: AddBankStatementLinesDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const statement = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, tenantId: tenant.id },
      select: {
        id: true,
        status: true,
        statementStartDate: true,
        statementEndDate: true,
      },
    });
    if (!statement) throw new NotFoundException('Bank statement not found');
    this.assertStatementMutable(String(statement.status));

    const now = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const createdLines = [] as any[];

      for (const line of dto.lines) {
        const txnDate = this.parseDateOnly(line.txnDate);
        if (txnDate < statement.statementStartDate || txnDate > statement.statementEndDate) {
          throw new BadRequestException(
            'txnDate must fall within the statement date range',
          );
        }

        const { debit, credit } = this.validateDebitCredit({
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
        });

        const row = await tx.bankStatementLine.create({
          data: {
            statementId: statement.id,
            txnDate,
            description: line.description,
            reference: line.reference ?? null,
            debitAmount: new Prisma.Decimal(this.round2(debit)),
            creditAmount: new Prisma.Decimal(this.round2(credit)),
            matched: false,
            matchedJournalLineId: null,
            classification: (line.classification as any) ?? 'UNIDENTIFIED',
          },
        });

        createdLines.push(row);

        await writeAuditEventWithPrisma(
          {
            tenantId: tenant.id,
            eventType: AuditEventType.ADD_BANK_STATEMENT_LINE,
            entityType: AuditEntityType.BANK_STATEMENT_LINE,
            entityId: row.id,
            actorUserId: user.id,
            timestamp: now,
            outcome: 'SUCCESS' as any,
            action: 'ADD_BANK_STATEMENT_LINE',
            permissionUsed: PERMISSIONS.BANK.STATEMENT_IMPORT,
            lifecycleType: 'CREATE',
            metadata: {
              statementId: statement.id,
              txnDate: line.txnDate,
              debitAmount: debit,
              creditAmount: credit,
              classification: (line.classification as any) ?? 'UNIDENTIFIED',
            },
          },
          tx as any,
        ).catch(() => undefined);
      }

      return createdLines;
    });

    return { lines: created };
  }

  async deleteStatementLine(req: Request, lineId: string) {
    const tenant = this.ensureTenant(req);

    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: lineId, statement: { tenantId: tenant.id } },
      select: {
        id: true,
        matched: true,
        statement: { select: { id: true, status: true } },
      },
    });

    if (!line) throw new NotFoundException('Bank statement line not found');

    this.assertStatementMutable(String(line.statement.status));

    if (line.matched) {
      throw new BadRequestException('Cannot delete a matched bank statement line');
    }

    await this.prisma.bankStatementLine.delete({ where: { id: line.id } });
    return { ok: true };
  }

  async listStatementLines(
    req: Request,
    statementId: string,
    q: ListStatementLinesQueryDto,
  ) {
    const tenant = this.ensureTenant(req);

    const statement = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!statement) throw new NotFoundException('Bank statement not found');

    const matchedFilter =
      typeof q.matched === 'string'
        ? String(q.matched).toLowerCase() === 'true'
        : undefined;

    return this.prisma.bankStatementLine.findMany({
      where: {
        statementId: statement.id,
        ...(typeof matchedFilter === 'boolean' ? { matched: matchedFilter } : {}),
      },
      orderBy: { txnDate: 'asc' },
    });
  }

  async matchStatementLine(req: Request, lineId: string, dto: MatchStatementLineDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const line = await tx.bankStatementLine.findFirst({
        where: {
          id: lineId,
          statement: { tenantId: tenant.id },
        },
        include: {
          statement: {
            include: { bankAccount: { select: { id: true, glAccountId: true } } },
          },
        },
      });

      if (!line) throw new NotFoundException('Bank statement line not found');

      this.assertStatementMutable(String(line.statement.status));

      if (line.matched || line.matchedJournalLineId) {
        throw new BadRequestException('Statement line is already matched');
      }

      const journalLine = await tx.journalLine.findFirst({
        where: {
          id: dto.journalLineId,
          accountId: line.statement.bankAccount.glAccountId,
          cleared: false,
          bankStatementLineId: null,
          journalEntry: { tenantId: tenant.id, status: 'POSTED' },
        },
        include: {
          journalEntry: { select: { id: true, status: true, journalDate: true } },
        },
      });

      if (!journalLine) {
        throw new BadRequestException('Journal line not found or not eligible for matching');
      }

      const stmtDebit = this.toNumber2(line.debitAmount);
      const stmtCredit = this.toNumber2(line.creditAmount);
      const jlDebit = this.toNumber2(journalLine.debit);
      const jlCredit = this.toNumber2(journalLine.credit);

      const isStmtDebit = stmtDebit > 0;
      const isStmtCredit = stmtCredit > 0;

      if ((isStmtDebit && isStmtCredit) || (!isStmtDebit && !isStmtCredit)) {
        throw new BadRequestException('Statement line amount is invalid');
      }

      const amountOk = isStmtDebit
        ? stmtDebit === jlCredit
        : stmtCredit === jlDebit;

      if (!amountOk) {
        throw new BadRequestException('Cannot match: amounts/direction do not align.');
      }

      const updatedLine = await tx.bankStatementLine.update({
        where: { id: line.id },
        data: {
          matched: true,
          matchedJournalLineId: journalLine.id,
          classification: 'SYSTEM_MATCH' as any,
        },
      });

      const updatedJournalLine = await tx.journalLine.update({
        where: { id: journalLine.id },
        data: {
          cleared: true,
          clearedAt: now,
          bankStatementLineId: line.id,
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.BANK_RECON_LINE_MATCHED,
          entityType: AuditEntityType.BANK_STATEMENT_LINE,
          entityId: line.id,
          actorUserId: user.id,
          timestamp: now,
          outcome: 'SUCCESS' as any,
          action: 'BANK_RECON_LINE_MATCHED',
          permissionUsed: PERMISSIONS.BANK.RECONCILE,
          lifecycleType: 'UPDATE',
          metadata: {
            statementId: line.statementId,
            statementLineId: line.id,
            journalLineId: journalLine.id,
            bankAccountId: line.statement.bankAccountId,
            debitAmount: stmtDebit,
            creditAmount: stmtCredit,
          },
        },
        tx as any,
      ).catch(() => undefined);

      return { statementLine: updatedLine, journalLine: updatedJournalLine };
    });

    return result;
  }

  async unmatchStatementLine(req: Request, lineId: string) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const line = await tx.bankStatementLine.findFirst({
        where: {
          id: lineId,
          statement: { tenantId: tenant.id },
        },
        include: { statement: true },
      });

      if (!line) throw new NotFoundException('Bank statement line not found');
      this.assertStatementMutable(String(line.statement.status));

      if (!line.matched || !line.matchedJournalLineId) {
        throw new BadRequestException('Statement line is not matched');
      }

      const journalLine = await tx.journalLine.findFirst({
        where: {
          id: line.matchedJournalLineId,
          bankStatementLineId: line.id,
          journalEntry: { tenantId: tenant.id },
        },
        select: { id: true },
      });

      if (!journalLine) {
        throw new BadRequestException('Linked journal line not found for this statement line');
      }

      const updatedLine = await tx.bankStatementLine.update({
        where: { id: line.id },
        data: {
          matched: false,
          matchedJournalLineId: null,
          classification: 'UNIDENTIFIED' as any,
        },
      });

      const updatedJournalLine = await tx.journalLine.update({
        where: { id: journalLine.id },
        data: {
          cleared: false,
          clearedAt: null,
          bankStatementLineId: null,
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.BANK_RECON_LINE_UNMATCHED,
          entityType: AuditEntityType.BANK_STATEMENT_LINE,
          entityId: line.id,
          actorUserId: user.id,
          timestamp: now,
          outcome: 'SUCCESS' as any,
          action: 'BANK_RECON_LINE_UNMATCHED',
          permissionUsed: PERMISSIONS.BANK.RECONCILE,
          lifecycleType: 'UPDATE',
          metadata: {
            statementId: line.statementId,
            statementLineId: line.id,
            journalLineId: journalLine.id,
            bankAccountId: line.statement.bankAccountId,
          },
        },
        tx as any,
      ).catch(() => undefined);

      return { statementLine: updatedLine, journalLine: updatedJournalLine };
    });

    return result;
  }

  async previewStatement(req: Request, statementId: string) {
    const tenant = this.ensureTenant(req);

    const statement = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, tenantId: tenant.id },
      include: { bankAccount: { select: { id: true, glAccountId: true } } },
    });
    if (!statement) throw new NotFoundException('Bank statement not found');

    const endDate = statement.statementEndDate;

    const [balanceAgg, outstandingAgg, matchedCount, unmatchedCount] =
      await Promise.all([
        this.prisma.journalLine.aggregate({
          where: {
            accountId: statement.bankAccount.glAccountId,
            journalEntry: {
              tenantId: tenant.id,
              status: 'POSTED',
              journalDate: { lte: endDate },
            },
          },
          _sum: { debit: true, credit: true },
        }),
        this.prisma.journalLine.aggregate({
          where: {
            accountId: statement.bankAccount.glAccountId,
            cleared: false,
            journalEntry: {
              tenantId: tenant.id,
              status: 'POSTED',
              journalDate: { lte: endDate },
            },
          },
          _sum: { debit: true, credit: true },
        }),
        this.prisma.bankStatementLine.count({
          where: { statementId: statement.id, matched: true },
        }),
        this.prisma.bankStatementLine.count({
          where: { statementId: statement.id, matched: false },
        }),
      ]);

    const systemDebit = this.toNumber2(balanceAgg._sum.debit);
    const systemCredit = this.toNumber2(balanceAgg._sum.credit);
    const systemBankBalanceAsAtEndDate = this.round2(systemDebit - systemCredit);

    const depositsInTransitTotal = this.toNumber2(outstandingAgg._sum.debit);
    const outstandingPaymentsTotal = this.toNumber2(outstandingAgg._sum.credit);

    const bankClosingBalance = this.toNumber2(statement.closingBalance);

    const differencePreview = this.round2(
      bankClosingBalance + depositsInTransitTotal - outstandingPaymentsTotal - systemBankBalanceAsAtEndDate,
    );

    return {
      bankClosingBalance,
      systemBankBalanceAsAtEndDate,
      outstandingPaymentsTotal,
      depositsInTransitTotal,
      matchedCount,
      unmatchedStatementLinesCount: unmatchedCount,
      differencePreview,
    };
  }

  async reconcileAndLockStatement(req: Request, statementId: string) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const statement = await tx.bankStatement.findFirst({
        where: { id: statementId, tenantId: tenant.id },
        include: {
          bankAccount: { select: { id: true, glAccountId: true } },
        },
      });

      if (!statement) throw new NotFoundException('Bank statement not found');

      const status = String(statement.status);
      if (status === 'LOCKED' || status === 'RECONCILED') {
        throw new ConflictException('Statement is already reconciled/locked');
      }
      if (status !== 'DRAFT' && status !== 'IN_PROGRESS') {
        throw new BadRequestException('Statement is not eligible for reconciliation');
      }

      await this.assertStatementEndDateInOpenPeriod({
        prisma: tx as any,
        tenantId: tenant.id,
        statementEndDate: statement.statementEndDate,
      });

      // Compute preview using the same underlying aggregation logic.
      const [balanceAgg, outstandingAgg] = await Promise.all([
        tx.journalLine.aggregate({
          where: {
            accountId: statement.bankAccount.glAccountId,
            journalEntry: {
              tenantId: tenant.id,
              status: 'POSTED',
              journalDate: { lte: statement.statementEndDate },
            },
          },
          _sum: { debit: true, credit: true },
        }),
        tx.journalLine.aggregate({
          where: {
            accountId: statement.bankAccount.glAccountId,
            cleared: false,
            journalEntry: {
              tenantId: tenant.id,
              status: 'POSTED',
              journalDate: { lte: statement.statementEndDate },
            },
          },
          _sum: { debit: true, credit: true },
        }),
      ]);

      const systemDebit = this.toNumber2(balanceAgg._sum.debit);
      const systemCredit = this.toNumber2(balanceAgg._sum.credit);
      const systemBankBalanceAsAtEndDate = this.round2(systemDebit - systemCredit);

      const depositsInTransitTotal = this.toNumber2(outstandingAgg._sum.debit);
      const outstandingPaymentsTotal = this.toNumber2(outstandingAgg._sum.credit);

      const bankClosingBalance = this.toNumber2(statement.closingBalance);

      const differencePreview = this.round2(
        bankClosingBalance +
          depositsInTransitTotal -
          outstandingPaymentsTotal -
          systemBankBalanceAsAtEndDate,
      );

      if (differencePreview !== 0) {
        throw new BadRequestException('Cannot reconcile: difference is not zero.');
      }

      const reconciled = await tx.bankStatement.update({
        where: { id: statement.id },
        data: {
          status: 'RECONCILED' as any,
          reconciledAt: now,
          reconciledByUserId: user.id,
        } as any,
        select: { id: true },
      });

      const adjustedBankBalance = this.round2(
        bankClosingBalance + depositsInTransitTotal - outstandingPaymentsTotal,
      );

      await (tx as any).bankReconciliationSnapshot.create({
        data: {
          tenantId: tenant.id,
          bankStatementId: statement.id,
          bankAccountId: statement.bankAccountId,
          statementEndDate: statement.statementEndDate,
          bankClosingBalance: new Prisma.Decimal(this.round2(bankClosingBalance)),
          systemBankBalance: new Prisma.Decimal(this.round2(systemBankBalanceAsAtEndDate)),
          outstandingPaymentsTotal: new Prisma.Decimal(this.round2(outstandingPaymentsTotal)),
          depositsInTransitTotal: new Prisma.Decimal(this.round2(depositsInTransitTotal)),
          adjustedBankBalance: new Prisma.Decimal(this.round2(adjustedBankBalance)),
          adjustedGLBalance: new Prisma.Decimal(this.round2(systemBankBalanceAsAtEndDate)),
          difference: new Prisma.Decimal(0),
          createdByUserId: user.id,
        },
        select: { id: true },
      });

      const locked = await tx.bankStatement.update({
        where: { id: reconciled.id },
        data: {
          status: 'LOCKED' as any,
          lockedAt: now,
          lockedByUserId: user.id,
        } as any,
        select: { id: true, status: true },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: 'BANK_RECON_STATEMENT_RECONCILED' as any,
          entityType: AuditEntityType.BANK_STATEMENT,
          entityId: statement.id,
          actorUserId: user.id,
          timestamp: now,
          outcome: 'SUCCESS' as any,
          action: 'BANK_RECON_STATEMENT_RECONCILED',
          permissionUsed: PERMISSIONS.BANK.RECONCILE,
          lifecycleType: 'UPDATE',
          metadata: {
            bankStatementId: statement.id,
            bankAccountId: statement.bankAccountId,
            statementEndDate: statement.statementEndDate,
            difference: 0,
          },
        },
        tx as any,
      ).catch(() => undefined);

      return locked;
    });

    return result;
  }

  async getFinalReconciliationSummary(req: Request, statementId: string) {
    const tenant = this.ensureTenant(req);

    const statement = await (this.prisma as any).bankStatement.findFirst({
      where: { id: statementId, tenantId: tenant.id },
      select: {
        id: true,
        status: true,
        reconciledAt: true,
        reconciledBy: { select: { id: true, name: true, email: true } },
        lockedAt: true,
        lockedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!statement) throw new NotFoundException('Bank statement not found');
    if (String(statement.status) !== 'LOCKED') {
      throw new BadRequestException('Statement not yet reconciled.');
    }

    const snapshot = await (this.prisma as any).bankReconciliationSnapshot.findFirst({
      where: { tenantId: tenant.id, bankStatementId: statement.id },
    });

    if (!snapshot) {
      throw new NotFoundException('Final reconciliation snapshot not found');
    }

    return {
      bankClosingBalance: Number(snapshot.bankClosingBalance),
      systemBankBalance: Number(snapshot.systemBankBalance),
      outstandingPaymentsTotal: Number(snapshot.outstandingPaymentsTotal),
      depositsInTransitTotal: Number(snapshot.depositsInTransitTotal),
      adjustedBankBalance: Number(snapshot.adjustedBankBalance),
      adjustedGLBalance: Number(snapshot.adjustedGLBalance),
      difference: Number(snapshot.difference),
      reconciledAt: statement.reconciledAt ?? null,
      reconciledBy: statement.reconciledBy ?? null,
      lockedAt: statement.lockedAt ?? null,
      lockedBy: statement.lockedBy ?? null,
    };
  }

  async createAdjustmentForStatementLine(
    req: Request,
    lineId: string,
    dto: CreateAdjustmentJournalDto,
  ) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const line = await tx.bankStatementLine.findFirst({
        where: {
          id: lineId,
          statement: { tenantId: tenant.id },
        },
        include: {
          statement: {
            include: {
              bankAccount: { select: { id: true, glAccountId: true } },
            },
          },
        },
      });

      if (!line) throw new NotFoundException('Bank statement line not found');

      this.assertStatementMutable(String(line.statement.status));

      if (line.adjustmentJournalId) {
        throw new ConflictException('Adjustment already exists for this statement line.');
      }

      if (line.matched || line.matchedJournalLineId) {
        throw new BadRequestException('Statement line is already matched');
      }

      const classification = String(line.classification);
      if (classification !== 'BANK_CHARGE' && classification !== 'INTEREST') {
        throw new BadRequestException('Statement line classification must be BANK_CHARGE or INTEREST');
      }

      const stmtDebit = this.toNumber2(line.debitAmount);
      const stmtCredit = this.toNumber2(line.creditAmount);

      if (classification === 'BANK_CHARGE') {
        if (!(stmtDebit > 0) || stmtCredit !== 0) {
          throw new BadRequestException('BANK_CHARGE must have debitAmount > 0 and creditAmount = 0');
        }
      }
      if (classification === 'INTEREST') {
        if (!(stmtCredit > 0) || stmtDebit !== 0) {
          throw new BadRequestException('INTEREST must have creditAmount > 0 and debitAmount = 0');
        }
      }

      const postingDate = this.parseDateOnly(dto.postingDate);
      if (postingDate < line.statement.statementStartDate) {
        throw new BadRequestException('postingDate must be within the statement date range');
      }
      if (postingDate > line.statement.statementEndDate) {
        throw new BadRequestException('postingDate must be <= statementEndDate');
      }

      const period = await this.assertPostingDateInOpenPeriod({
        prisma: tx as any,
        tenantId: tenant.id,
        postingDate,
      });

      const bankGlAccount = await tx.account.findFirst({
        where: {
          tenantId: tenant.id,
          id: line.statement.bankAccount.glAccountId,
          isActive: true,
          type: 'ASSET',
        },
        select: { id: true },
      });
      if (!bankGlAccount) {
        throw new BadRequestException('Bank GL account not found or invalid');
      }

      const glAccount = await tx.account.findFirst({
        where: {
          tenantId: tenant.id,
          id: dto.glAccountId,
          isActive: true,
          isPostingAllowed: true,
          type: classification === 'BANK_CHARGE' ? 'EXPENSE' : 'INCOME',
        },
        select: { id: true, type: true },
      });
      if (!glAccount) {
        throw new BadRequestException('GL account must exist, be active, postable, and of the correct type');
      }

      const legalEntity = await tx.legalEntity.findFirst({
        where: {
          tenantId: tenant.id,
          isActive: true,
          effectiveFrom: { lte: postingDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: postingDate } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        select: { id: true },
      });
      const legalEntityId = legalEntity?.id ?? null;

      const amount = new Prisma.Decimal(
        this.round2(
          classification === 'BANK_CHARGE' ? stmtDebit : stmtCredit,
        ),
      );

      const descriptionBase =
        classification === 'BANK_CHARGE'
          ? `Bank charge (statement line ${line.id})`
          : `Interest received (statement line ${line.id})`;
      const memo = dto.memo ? String(dto.memo).trim() : '';
      const journalDescription = memo ? `${descriptionBase} - ${memo}` : descriptionBase;

      const counter = await (tx as any).tenantSequenceCounter.upsert({
        where: {
          tenantId_name: {
            tenantId: tenant.id,
            name: this.JOURNAL_NUMBER_SEQUENCE_NAME,
          },
        },
        create: {
          tenantId: tenant.id,
          name: this.JOURNAL_NUMBER_SEQUENCE_NAME,
          value: 0,
        },
        update: {},
        select: { id: true },
      });

      const bumped = await (tx as any).tenantSequenceCounter.update({
        where: { id: counter.id },
        data: { value: { increment: 1 } },
        select: { value: true },
      });

      const bankAccountId = line.statement.bankAccountId;

      const debitLine =
        classification === 'BANK_CHARGE'
          ? { accountId: glAccount.id, debit: amount, credit: new Prisma.Decimal(0) }
          : { accountId: bankGlAccount.id, debit: amount, credit: new Prisma.Decimal(0) };
      const creditLine =
        classification === 'BANK_CHARGE'
          ? { accountId: bankGlAccount.id, debit: new Prisma.Decimal(0), credit: amount }
          : { accountId: glAccount.id, debit: new Prisma.Decimal(0), credit: amount };

      const journal = await (tx as any).journalEntry.create({
        data: {
          tenantId: tenant.id,
          reference: `BANK_RECON_ADJUSTMENT:${line.id}`,
          description: journalDescription,
          status: 'POSTED',
          createdById: user.id,
          postedById: user.id,
          postedAt: now,
          journalDate: postingDate,
          journalType: 'STANDARD',
          periodId: period.id,
          journalNumber: bumped.value,
          sourceType: 'BANK_RECON_ADJUSTMENT',
          sourceId: line.id,
          lines: {
            create: [
              {
                ...debitLine,
                legalEntityId,
                departmentId: null,
                projectId: null,
                fundId: null,
                lineNumber: 1,
              },
              {
                ...creditLine,
                legalEntityId,
                departmentId: null,
                projectId: null,
                fundId: null,
                lineNumber: 2,
              },
            ],
          },
        },
        include: { lines: true },
      });

      const bankLine = (journal.lines as any[]).find(
        (l) => l.accountId === bankGlAccount.id,
      );
      if (!bankLine) {
        throw new BadRequestException('Adjustment journal did not produce a bank GL line');
      }

      const updatedJournalLine = await tx.journalLine.update({
        where: { id: bankLine.id },
        data: {
          cleared: true,
          clearedAt: now,
          bankStatementLineId: line.id,
        },
      });

      const updatedLine = await tx.bankStatementLine.update({
        where: { id: line.id },
        data: {
          matched: true,
          matchedJournalLineId: bankLine.id,
          classification: 'SYSTEM_MATCH' as any,
          adjustmentJournalId: journal.id,
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.BANK_RECON_ADJUSTMENT_JOURNAL_CREATED,
          entityType: AuditEntityType.BANK_STATEMENT_LINE,
          entityId: line.id,
          actorUserId: user.id,
          timestamp: now,
          outcome: 'SUCCESS' as any,
          action: 'BANK_RECON_ADJUSTMENT_JOURNAL_CREATED',
          permissionUsed: PERMISSIONS.BANK.RECONCILE,
          lifecycleType: 'CREATE',
          metadata: {
            statementId: line.statementId,
            statementLineId: line.id,
            bankAccountId,
            postingDate: dto.postingDate,
            classification,
            glAccountId: dto.glAccountId,
            journalId: journal.id,
            bankJournalLineId: bankLine.id,
            amount: Number(amount),
          },
        },
        tx as any,
      ).catch(() => undefined);

      return {
        statementLine: updatedLine,
        journal,
        clearedJournalLine: updatedJournalLine,
      };
    });

    return result;
  }

  async listUnclearedTransactions(
    req: Request,
    bankAccountId: string,
    q: UnclearedTransactionsQueryDto,
  ) {
    const tenant = this.ensureTenant(req);

    const asAtDate = this.parseDateOnly(q.asAtDate);

    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, tenantId: tenant.id },
      select: { id: true, glAccountId: true },
    });
    if (!bankAccount) throw new BadRequestException('Bank account not found');

    const lines = await this.prisma.journalLine.findMany({
      where: {
        cleared: false,
        accountId: bankAccount.glAccountId,
        journalEntry: {
          tenantId: tenant.id,
          status: 'POSTED',
          journalDate: { lte: asAtDate },
        },
      },
      select: {
        id: true,
        journalEntryId: true,
        debit: true,
        credit: true,
        journalEntry: {
          select: {
            journalDate: true,
            reference: true,
            sourceType: true,
            sourceId: true,
          },
        },
      },
      orderBy: [{ journalEntry: { journalDate: 'asc' } }, { id: 'asc' }],
    });

    return lines.map((l) => ({
      journalLineId: l.id,
      journalId: l.journalEntryId,
      postingDate: l.journalEntry.journalDate,
      reference: l.journalEntry.reference,
      debitAmount: Number(l.debit),
      creditAmount: Number(l.credit),
      sourceModule: l.journalEntry.sourceType,
      sourceRefId: l.journalEntry.sourceId,
    }));
  }
}
