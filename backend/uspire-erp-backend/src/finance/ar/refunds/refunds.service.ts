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
import { assertPeriodIsOpen } from '../../common/accounting-period.guard';
import { resolveArControlAccount } from '../../common/resolve-ar-control-account';
import type {
  ApproveRefundDto,
  CreateCustomerRefundDto,
  VoidRefundDto,
} from './refunds.dto';

@Injectable()
export class FinanceArRefundsService {
  private readonly REFUND_NUMBER_SEQUENCE_NAME = 'AR_REFUND_NUMBER';

  constructor(
    private readonly prisma: PrismaService,
    private readonly gl: GlService,
  ) {}

  private round2(n: number) {
    return Math.round(Number(n ?? 0) * 100) / 100;
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
        totalAmount: total,
      },
      refunded,
      refundable,
    };
  }

  private async resolveClearingAccountId(params: {
    tenantId: string;
    paymentMethod: 'BANK' | 'CASH';
    bankAccountId?: string | null;
  }) {
    if (params.paymentMethod === 'BANK') {
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

      const tenantControls = await (this.prisma as any).tenant.findUnique({
        where: { id: params.tenantId },
        select: { defaultBankClearingAccountId: true },
      });
      const bankClearingAccountId =
        (tenantControls?.defaultBankClearingAccountId ?? null) as string | null;
      if (!bankClearingAccountId) {
        throw new BadRequestException({
          error: 'Missing configuration: default bank clearing account',
          field: 'Tenant.defaultBankClearingAccountId',
        });
      }

      const bankAccount = await this.prisma.account.findFirst({
        where: {
          tenantId: params.tenantId,
          id: bankClearingAccountId,
          isActive: true,
          type: 'ASSET',
        },
        select: { id: true },
      });
      if (!bankAccount) {
        throw new BadRequestException(
          'Configured bank clearing GL account not found or invalid',
        );
      }

      return bankAccount.id;
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
        field: 'Tenant.cashClearingAccountId',
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

  async approve(req: Request, id: string, _dto: ApproveRefundDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const refund = await (this.prisma as any).customerRefund.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!refund) throw new NotFoundException('Refund not found');

    if (String(refund.status) !== 'DRAFT') {
      throw new BadRequestException(
        `Refund cannot be approved from status: ${refund.status}`,
      );
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
      throw new ForbiddenException('Cannot approve in a closed period');
    }

    const refundable = await this.computeCreditNoteRefundable({
      tenantId: tenant.id,
      creditNoteId: String(refund.creditNoteId ?? ''),
    });

    const amount = this.normalizeMoney(Number(refund.amount ?? 0));
    if (amount > refundable.refundable) {
      throw new ConflictException('Refund amount exceeds available credit balance');
    }

    await (this.prisma as any).customerRefund.update({
      where: { id: refund.id },
      data: {
        status: 'APPROVED',
        approvedById: user.id,
        approvedAt: new Date(),
      } as any,
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

    const clearingAccountId = await this.resolveClearingAccountId({
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
        reviewedById: refund.approvedById,
        reviewedAt: refund.approvedAt ?? now,
        lines: {
          create: [
            {
              accountId: arAccount.id,
              debit: amount,
              credit: 0,
              description: 'AR control',
            },
            {
              accountId: clearingAccountId,
              debit: 0,
              credit: amount,
              description:
                String(refund.paymentMethod) === 'CASH'
                  ? 'Cash clearing'
                  : 'Bank clearing',
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

    const clearingAccountId = await this.resolveClearingAccountId({
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
              accountId: clearingAccountId,
              debit: amount,
              credit: 0,
              description:
                String(refund.paymentMethod) === 'CASH'
                  ? 'Cash clearing reversal'
                  : 'Bank clearing reversal',
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
