import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import {
  BankAccountTypeDto,
  CreateBankAccountFoundationDto,
  UpdateBankAccountFoundationDto,
} from './dto/bank-accounts.dto';

@Injectable()
export class BankService {
  constructor(private readonly prisma: PrismaService) {}

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
}
