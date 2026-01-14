import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { AuditEntityType, AuditEventType } from '@prisma/client';
import { assertCanPost } from '../periods/period-guard';
import { AddBankStatementLinesDto } from './dto/add-bank-statement-lines.dto';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { CreateBankStatementDto } from './dto/create-bank-statement.dto';
import { ListBankStatementsQueryDto } from './dto/list-bank-statements-query.dto';
import { MatchBankReconciliationDto } from './dto/match-bank-reconciliation.dto';
import { ReconciliationStatusQueryDto } from './dto/reconciliation-status-query.dto';

@Injectable()
export class BankService {
  constructor(private readonly prisma: PrismaService) {}

  private prismaAny() {
    return this.prisma as any;
  }

  async createBankAccount(req: Request, dto: CreateBankAccountDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const glAccount = await this.prisma.account.findFirst({
      where: {
        id: dto.glAccountId,
        tenantId: tenant.id,
        isActive: true,
        type: 'ASSET',
      },
      select: { id: true },
    });

    if (!glAccount) {
      throw new BadRequestException(
        'GL account must exist, be active, and be an ASSET (cash/bank)',
      );
    }

    return this.prisma.bankAccount.create({
      data: {
        tenantId: tenant.id,
        name: dto.name,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        currency: dto.currency,
        glAccountId: dto.glAccountId,
        isActive: true,
      },
      include: { glAccount: true },
    });
  }

  async listBankAccounts(req: Request) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    return this.prisma.bankAccount.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: 'asc' },
      include: { glAccount: true },
    });
  }

  async createStatement(req: Request, dto: CreateBankStatementDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const prisma = this.prismaAny();

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, tenantId: tenant.id, isActive: true },
      select: { id: true },
    });

    if (!bankAccount) {
      throw new BadRequestException('Bank account not found or inactive');
    }

    return prisma.bankStatement.create({
      data: {
        tenantId: tenant.id,
        bankAccountId: dto.bankAccountId,
        statementDate: new Date(dto.statementDate),
        openingBalance: dto.openingBalance,
        closingBalance: dto.closingBalance,
      },
      include: { lines: true },
    });
  }

  async listStatements(req: Request, dto: ListBankStatementsQueryDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const prisma = this.prismaAny();

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, tenantId: tenant.id, isActive: true },
      select: { id: true },
    });

    if (!bankAccount) {
      throw new NotFoundException('Bank account not found');
    }

    return prisma.bankStatement.findMany({
      where: { tenantId: tenant.id, bankAccountId: dto.bankAccountId },
      orderBy: { statementDate: 'desc' },
      select: {
        id: true,
        bankAccountId: true,
        statementDate: true,
        openingBalance: true,
        closingBalance: true,
        createdAt: true,
      },
    });
  }

  async getStatement(req: Request, id: string) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const prisma = this.prismaAny();

    const statement = await prisma.bankStatement.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        bankAccountId: true,
        statementDate: true,
        openingBalance: true,
        closingBalance: true,
        createdAt: true,
        lines: {
          orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            transactionDate: true,
            description: true,
            amount: true,
            reference: true,
            isReconciled: true,
          },
        },
      },
    });

    if (!statement) {
      throw new NotFoundException('Bank statement not found');
    }

    return statement;
  }

  async addStatementLines(
    req: Request,
    bankStatementId: string,
    dto: AddBankStatementLinesDto,
  ) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const prisma = this.prismaAny();

    const statement = await prisma.bankStatement.findFirst({
      where: { id: bankStatementId, tenantId: tenant.id },
      select: { id: true },
    });

    if (!statement) {
      throw new NotFoundException('Bank statement not found');
    }

    const created = await prisma.bankStatementLine.createMany({
      data: dto.lines.map((l) => ({
        bankStatementId: statement.id,
        transactionDate: new Date(l.transactionDate),
        description: l.description,
        amount: l.amount,
        reference: l.reference,
      })),
    });

    return { createdCount: created.count };
  }

  async unmatched(req: Request) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const prisma = this.prismaAny();

    const unreconciledPayments = await prisma.payment.findMany({
      where: {
        tenantId: tenant.id,
        status: 'POSTED',
        reconciliations: { none: {} },
      },
      orderBy: { paymentDate: 'desc' },
      select: {
        id: true,
        type: true,
        bankAccountId: true,
        amount: true,
        paymentDate: true,
        reference: true,
      },
    } as any);

    const unreconciledStatementLines = await prisma.bankStatementLine.findMany({
      where: {
        isReconciled: false,
        bankStatement: { tenantId: tenant.id },
      },
      orderBy: { transactionDate: 'desc' },
      select: {
        id: true,
        transactionDate: true,
        description: true,
        amount: true,
        reference: true,
        bankStatement: {
          select: { id: true, bankAccountId: true, statementDate: true },
        },
      },
    });

    return {
      unreconciledPayments,
      unreconciledStatementLines,
    };
  }

  async match(req: Request, dto: MatchBankReconciliationDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const prisma = this.prismaAny();

    const [payment, line] = await Promise.all([
      prisma.payment.findFirst({
        where: { id: dto.paymentId, tenantId: tenant.id },
        select: {
          id: true,
          status: true,
          bankAccountId: true,
          amount: true,
          paymentDate: true,
        },
      }),
      prisma.bankStatementLine.findFirst({
        where: {
          id: dto.statementLineId,
          bankStatement: { tenantId: tenant.id },
        },
        select: {
          id: true,
          amount: true,
          isReconciled: true,
          transactionDate: true,
          bankStatement: { select: { id: true, bankAccountId: true } },
        },
      }),
    ]);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (!line) {
      throw new NotFoundException('Statement line not found');
    }

    if (payment.status !== 'POSTED') {
      throw new BadRequestException('Only POSTED payments can be reconciled');
    }
    if (line.isReconciled) {
      throw new BadRequestException('Statement line is already reconciled');
    }

    if (payment.bankAccountId !== line.bankStatement.bankAccountId) {
      throw new BadRequestException(
        'Payment bank account does not match statement line bank account',
      );
    }

    const paymentAmount = Number(payment.amount);
    const lineAmount = Number(line.amount);
    const round2 = (n: number) => Math.round(n * 100) / 100;

    if (round2(paymentAmount) !== round2(lineAmount)) {
      throw new BadRequestException({
        error: 'Amounts do not match (exact match required)',
        paymentAmount: round2(paymentAmount),
        statementLineAmount: round2(lineAmount),
      });
    }

    const [paymentPeriod, linePeriod] = await Promise.all([
      prisma.accountingPeriod.findFirst({
        where: {
          tenantId: tenant.id,
          startDate: { lte: payment.paymentDate },
          endDate: { gte: payment.paymentDate },
        },
        select: { id: true, status: true, name: true },
      }),
      prisma.accountingPeriod.findFirst({
        where: {
          tenantId: tenant.id,
          startDate: { lte: line.transactionDate },
          endDate: { gte: line.transactionDate },
        },
        select: { id: true, status: true, name: true },
      }),
    ]);

    if (!paymentPeriod) {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.BANK_RECONCILIATION_MATCH,
          entityType: AuditEntityType.BANK_RECONCILIATION_MATCH,
          entityId: dto.statementLineId,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'BANK_RECONCILE',
          permissionUsed: PERMISSIONS.BANK.RECONCILE,
          lifecycleType: 'POST',
          reason: 'No accounting period exists for the payment date',
          metadata: {
            periodId: null,
            periodName: null,
            periodStatus: null,
            paymentId: payment.id,
            statementLineId: dto.statementLineId,
          },
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Reconciliation blocked by accounting period control',
        reason: 'No accounting period exists for the payment date',
      });
    }

    // Canonical period semantics: posting-like actions are allowed only in OPEN.
    // We preserve the existing ForbiddenException payload/messages on failure.
    try {
      assertCanPost(paymentPeriod.status, { periodName: paymentPeriod.name });
    } catch {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.BANK_RECONCILIATION_MATCH,
          entityType: AuditEntityType.BANK_RECONCILIATION_MATCH,
          entityId: dto.statementLineId,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'BANK_RECONCILE',
          permissionUsed: PERMISSIONS.BANK.RECONCILE,
          lifecycleType: 'POST',
          reason: `Accounting period is not OPEN for payment date: ${paymentPeriod.name}`,
          metadata: {
            periodId: paymentPeriod.id,
            periodName: paymentPeriod.name,
            periodStatus: paymentPeriod.status,
            paymentId: payment.id,
            statementLineId: dto.statementLineId,
          },
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Reconciliation blocked by accounting period control',
        reason: `Accounting period is not OPEN for payment date: ${paymentPeriod.name}`,
      });
    }

    if (!linePeriod) {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.BANK_RECONCILIATION_MATCH,
          entityType: AuditEntityType.BANK_RECONCILIATION_MATCH,
          entityId: dto.statementLineId,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'BANK_RECONCILE',
          permissionUsed: PERMISSIONS.BANK.RECONCILE,
          lifecycleType: 'POST',
          reason: 'No accounting period exists for the statement transaction date',
          metadata: {
            periodId: null,
            periodName: null,
            periodStatus: null,
            paymentId: payment.id,
            statementLineId: dto.statementLineId,
          },
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Reconciliation blocked by accounting period control',
        reason: 'No accounting period exists for the statement transaction date',
      });
    }

    try {
      assertCanPost(linePeriod.status, { periodName: linePeriod.name });
    } catch {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.BANK_RECONCILIATION_MATCH,
          entityType: AuditEntityType.BANK_RECONCILIATION_MATCH,
          entityId: dto.statementLineId,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'BANK_RECONCILE',
          permissionUsed: PERMISSIONS.BANK.RECONCILE,
          lifecycleType: 'POST',
          reason: `Accounting period is not OPEN for statement date: ${linePeriod.name}`,
          metadata: {
            periodId: linePeriod.id,
            periodName: linePeriod.name,
            periodStatus: linePeriod.status,
            paymentId: payment.id,
            statementLineId: dto.statementLineId,
          },
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Reconciliation blocked by accounting period control',
        reason: `Accounting period is not OPEN for statement date: ${linePeriod.name}`,
      });
    }

    const now = new Date();

    try {
      const rec = await this.prisma.$transaction(async (tx) => {
        const createdRec = await (tx as any).bankReconciliation.create({
          data: {
            tenantId: tenant.id,
            bankAccountId: payment.bankAccountId,
            paymentId: payment.id,
            statementLineId: line.id,
            reconciledAt: now,
            reconciledBy: user.id,
          },
        });

        await (tx as any).bankStatementLine.update({
          where: { id: line.id },
          data: {
            isReconciled: true,
            reconciledAt: now,
            reconciledBy: user.id,
          },
        });

        return createdRec;
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.BANK_RECONCILIATION_MATCH,
          entityType: AuditEntityType.BANK_RECONCILIATION_MATCH,
          entityId: rec.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'SUCCESS' as any,
          action: 'BANK_RECONCILE',
          permissionUsed: PERMISSIONS.BANK.RECONCILE,
          lifecycleType: 'POST',
          metadata: {
            paymentId: payment.id,
            statementLineId: line.id,
          },
        },
        this.prisma,
      );

      return { reconciliation: rec };
    } catch (e: any) {
      // Unique constraints enforce one-to-one matching.
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.BANK_RECONCILIATION_MATCH,
          entityType: AuditEntityType.BANK_RECONCILIATION_MATCH,
          entityId: dto.statementLineId,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'FAILED' as any,
          action: 'BANK_RECONCILE',
          permissionUsed: PERMISSIONS.BANK.RECONCILE,
          lifecycleType: 'POST',
          reason: e?.message,
          metadata: {
            paymentId: payment.id,
            statementLineId: line.id,
          },
        },
        this.prisma,
      );

      throw new BadRequestException({
        error: 'Reconciliation failed (already reconciled?)',
        detail: e?.message,
      });
    }
  }

  async status(req: Request, dto: ReconciliationStatusQueryDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const prisma = this.prismaAny();

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, tenantId: tenant.id },
      select: { id: true },
    });

    if (!bankAccount) {
      throw new NotFoundException('Bank account not found');
    }

    const totalStatementLines = await prisma.bankStatementLine.count({
      where: {
        bankStatement: {
          tenantId: tenant.id,
          bankAccountId: dto.bankAccountId,
        },
      },
    });

    const reconciledCount = await prisma.bankStatementLine.count({
      where: {
        bankStatement: {
          tenantId: tenant.id,
          bankAccountId: dto.bankAccountId,
        },
        isReconciled: true,
      },
    });

    return {
      bankAccountId: dto.bankAccountId,
      totalStatementLines,
      reconciledCount,
      unreconciledCount: totalStatementLines - reconciledCount,
    };
  }
}
