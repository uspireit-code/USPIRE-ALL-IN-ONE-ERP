import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
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
import {
  BankAccountTypeDto,
  CreateBankAccountFoundationDto,
  UpdateBankAccountFoundationDto,
} from './dto/bank-accounts.dto';

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
        status: 'ACTIVE',
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
      where: { tenantId: tenant.id, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      include: { glAccount: true },
    });
  }

  private parseMoneyOrZero(v: unknown) {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  private async computePostedMovementByBankAccountId(params: {
    tenantId: string;
    bankAccountIds: string[];
  }) {
    const ids = [...new Set(params.bankAccountIds)].filter(Boolean);
    const postedReceipts = await this.prisma.payment.groupBy({
      by: ['bankAccountId'],
      where: {
        tenantId: params.tenantId,
        bankAccountId: { in: ids },
        status: 'POSTED',
        type: 'CUSTOMER_RECEIPT',
      },
      _sum: { amount: true },
    });

    const postedPayments = await this.prisma.payment.groupBy({
      by: ['bankAccountId'],
      where: {
        tenantId: params.tenantId,
        bankAccountId: { in: ids },
        status: 'POSTED',
        type: 'SUPPLIER_PAYMENT',
      },
      _sum: { amount: true },
    });

    const receiptsById = new Map<string, number>();
    for (const r of postedReceipts) {
      receiptsById.set(r.bankAccountId, this.parseMoneyOrZero(r._sum.amount));
    }

    const paymentsById = new Map<string, number>();
    for (const r of postedPayments) {
      paymentsById.set(r.bankAccountId, this.parseMoneyOrZero(r._sum.amount));
    }

    return { receiptsById, paymentsById };
  }

  private toFoundationResponse(row: any, movement?: { receipts: number; payments: number }) {
    const opening = this.parseMoneyOrZero(row.openingBalance);
    const receipts = this.parseMoneyOrZero(movement?.receipts);
    const payments = this.parseMoneyOrZero(movement?.payments);
    const computed = this.parseMoneyOrZero(opening + receipts - payments);

    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      type: row.type,
      currency: row.currency,
      status: row.status,
      bankName: row.bankName,
      accountNumber: row.accountNumber,
      glAccountId: row.glAccountId,
      glAccount: row.glAccount
        ? { id: row.glAccount.id, code: row.glAccount.code, name: row.glAccount.name, type: row.glAccount.type }
        : null,
      openingBalance: opening,
      computedBalance: computed,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listBankAccountsFoundation(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const rows = await this.prisma.bankAccount.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: 'asc' },
      include: {
        glAccount: { select: { id: true, code: true, name: true, type: true, isActive: true } },
      },
    });

    const ids = rows.map((r) => r.id);
    const { receiptsById, paymentsById } = await this.computePostedMovementByBankAccountId({
      tenantId: tenant.id,
      bankAccountIds: ids,
    });

    return rows.map((r) =>
      this.toFoundationResponse(r, {
        receipts: receiptsById.get(r.id) ?? 0,
        payments: paymentsById.get(r.id) ?? 0,
      }),
    );
  }

  async getBankAccountFoundationById(req: Request, id: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const row = await this.prisma.bankAccount.findFirst({
      where: { tenantId: tenant.id, id },
      include: {
        glAccount: { select: { id: true, code: true, name: true, type: true, isActive: true } },
      },
    });
    if (!row) throw new NotFoundException('Bank account not found');

    const { receiptsById, paymentsById } = await this.computePostedMovementByBankAccountId({
      tenantId: tenant.id,
      bankAccountIds: [row.id],
    });

    return this.toFoundationResponse(row, {
      receipts: receiptsById.get(row.id) ?? 0,
      payments: paymentsById.get(row.id) ?? 0,
    });
  }

  async createBankAccountFoundation(req: Request, dto: CreateBankAccountFoundationDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

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
      throw new BadRequestException('GL account must exist, be active, and be an ASSET (cash/bank)');
    }

    const opening = this.parseMoneyOrZero(dto.openingBalance);
    const bankName = dto.type === BankAccountTypeDto.CASH ? 'CASH' : String(dto.bankName ?? '').trim();
    if (!bankName) throw new BadRequestException('bankName is required for BANK accounts');

    const created = await this.prisma.bankAccount.create({
      data: {
        tenantId: tenant.id,
        name: dto.name,
        type: dto.type as any,
        currency: dto.currency,
        glAccountId: dto.glAccountId,
        bankName,
        accountNumber: dto.type === BankAccountTypeDto.CASH ? null : (dto.accountNumber ?? null),
        openingBalance: new Prisma.Decimal(opening),
        status: 'ACTIVE',
      },
      include: {
        glAccount: { select: { id: true, code: true, name: true, type: true, isActive: true } },
      },
    });

    return this.toFoundationResponse(created, { receipts: 0, payments: 0 });
  }

  async updateBankAccountFoundation(req: Request, id: string, dto: UpdateBankAccountFoundationDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const existing = await this.prisma.bankAccount.findFirst({
      where: { tenantId: tenant.id, id },
      include: { glAccount: { select: { id: true, code: true, name: true, type: true, isActive: true } } },
    });
    if (!existing) throw new NotFoundException('Bank account not found');
    if (existing.status === 'INACTIVE') throw new BadRequestException('Cannot edit an INACTIVE bank/cash account');

    const { receiptsById, paymentsById } = await this.computePostedMovementByBankAccountId({
      tenantId: tenant.id,
      bankAccountIds: [existing.id],
    });
    const currentBalance = this.parseMoneyOrZero(
      this.parseMoneyOrZero(existing.openingBalance) +
        (receiptsById.get(existing.id) ?? 0) -
        (paymentsById.get(existing.id) ?? 0),
    );

    if (dto.glAccountId && dto.glAccountId !== existing.glAccountId && currentBalance !== 0) {
      throw new BadRequestException('GL account cannot be changed unless balance is 0');
    }

    let glAccountId = existing.glAccountId;
    if (dto.glAccountId && dto.glAccountId !== existing.glAccountId) {
      const glAccount = await this.prisma.account.findFirst({
        where: {
          id: dto.glAccountId,
          tenantId: tenant.id,
          isActive: true,
          type: 'ASSET',
        },
        select: { id: true },
      });
      if (!glAccount) throw new BadRequestException('GL account must exist, be active, and be an ASSET (cash/bank)');
      glAccountId = dto.glAccountId;
    }

    const openingBalance =
      typeof dto.openingBalance === 'string'
        ? new Prisma.Decimal(this.parseMoneyOrZero(dto.openingBalance))
        : existing.openingBalance;

    const nextType = (dto.type ?? (existing.type as any)) as any;
    const bankName =
      nextType === BankAccountTypeDto.CASH
        ? 'CASH'
        : String(dto.bankName ?? existing.bankName ?? '').trim();
    if (!bankName) throw new BadRequestException('bankName is required for BANK accounts');

    const updated = await this.prisma.bankAccount.update({
      where: { id: existing.id },
      data: {
        name: typeof dto.name === 'string' ? dto.name : existing.name,
        type: nextType,
        currency: typeof dto.currency === 'string' ? dto.currency : existing.currency,
        glAccountId,
        bankName,
        accountNumber:
          nextType === BankAccountTypeDto.CASH
            ? null
            : typeof dto.accountNumber === 'string'
              ? dto.accountNumber
              : existing.accountNumber,
        openingBalance,
      },
      include: { glAccount: { select: { id: true, code: true, name: true, type: true, isActive: true } } },
    });

    const { receiptsById: r2, paymentsById: p2 } = await this.computePostedMovementByBankAccountId({
      tenantId: tenant.id,
      bankAccountIds: [updated.id],
    });

    return this.toFoundationResponse(updated, {
      receipts: r2.get(updated.id) ?? 0,
      payments: p2.get(updated.id) ?? 0,
    });
  }

  async deactivateBankAccountFoundation(req: Request, id: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const existing = await this.prisma.bankAccount.findFirst({
      where: { tenantId: tenant.id, id },
    });
    if (!existing) throw new NotFoundException('Bank account not found');
    if (existing.status === 'INACTIVE') return { ok: true };

    const { receiptsById, paymentsById } = await this.computePostedMovementByBankAccountId({
      tenantId: tenant.id,
      bankAccountIds: [existing.id],
    });

    const computedBalance = this.parseMoneyOrZero(
      this.parseMoneyOrZero(existing.openingBalance) +
        (receiptsById.get(existing.id) ?? 0) -
        (paymentsById.get(existing.id) ?? 0),
    );

    if (computedBalance !== 0) {
      throw new BadRequestException({
        error: 'Cannot deactivate bank/cash account with non-zero balance',
        computedBalance,
      });
    }

    await this.prisma.bankAccount.update({
      where: { id: existing.id },
      data: { status: 'INACTIVE' },
    });

    return { ok: true };
  }

  async createStatement(req: Request, dto: CreateBankStatementDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const prisma = this.prismaAny();

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, tenantId: tenant.id, status: 'ACTIVE' },
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
      where: { id: dto.bankAccountId, tenantId: tenant.id, status: 'ACTIVE' },
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
