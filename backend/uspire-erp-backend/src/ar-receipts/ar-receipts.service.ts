import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { SetReceiptAllocationsDto } from './dto/set-receipt-allocations.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';

type ReceiptStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

@Injectable()
export class ArReceiptsService {
  private readonly RECEIPT_NUMBER_SEQUENCE_NAME = 'AR_RECEIPT_NUMBER';
  private readonly OPENING_PERIOD_NAME = 'Opening Balances';

  constructor(private readonly prisma: PrismaService) {}

  private round2(n: number) {
    return Math.round(n * 100) / 100;
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

  private async assertEditable(receiptId: string, tenantId: string) {
    const r = await (this.prisma as any).customerReceipt.findFirst({
      where: { id: receiptId, tenantId },
      select: { id: true, status: true },
    });
    if (!r) throw new NotFoundException('Receipt not found');
    if (r.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT receipts can be edited');
    }
    return r;
  }

  private async nextReceiptNumber(tx: any, tenantId: string) {
    const counter = await tx.tenantSequenceCounter.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: this.RECEIPT_NUMBER_SEQUENCE_NAME,
        },
      },
      create: {
        tenantId,
        name: this.RECEIPT_NUMBER_SEQUENCE_NAME,
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

    return `RCPT-${String(bumped.value).padStart(6, '0')}`;
  }

  private async validateLines(params: {
    tenantId: string;
    customerId: string;
    receiptCurrency: string;
    totalAmount: number;
    lines?: Array<{ invoiceId: string; appliedAmount: number }>;
    receiptIdForUpdate?: string;
  }) {
    const lines = params.lines ?? [];

    for (const l of lines) {
      if (!l.invoiceId) {
        throw new BadRequestException('Receipt line missing invoiceId');
      }
      if (this.normalizeMoney(l.appliedAmount) < 0) {
        throw new BadRequestException('Receipt line appliedAmount must be >= 0');
      }
    }

    const appliedTotal = this.normalizeMoney(
      lines.reduce((s, l) => s + this.normalizeMoney(l.appliedAmount), 0),
    );
    const receiptTotal = this.normalizeMoney(params.totalAmount);

    if (appliedTotal > receiptTotal) {
      throw new BadRequestException({
        error: 'Applied total cannot exceed receipt totalAmount',
        appliedTotal,
        totalAmount: receiptTotal,
      });
    }

    if (lines.length > 0) {
      const invoiceIds = [...new Set(lines.map((l) => l.invoiceId))];

      const invoices = await this.prisma.customerInvoice.findMany({
        where: {
          tenantId: params.tenantId,
          customerId: params.customerId,
          id: { in: invoiceIds },
          status: 'POSTED',
        },
        select: {
          id: true,
          totalAmount: true,
          status: true,
          currency: true,
        } as any,
      });

      if (invoices.length !== invoiceIds.length) {
        throw new BadRequestException(
          'One or more invoices not found / not POSTED for customer / tenant',
        );
      }

      for (const inv of invoices) {
        const invCurrency = String((inv as any).currency ?? '').trim();
        if (!invCurrency) {
          throw new BadRequestException({
            error: 'Invoice currency missing; cannot allocate',
            invoiceId: inv.id,
          });
        }
        if (invCurrency !== params.receiptCurrency) {
          throw new BadRequestException({
            error: 'Receipt currency must match invoice currency',
            receiptCurrency: params.receiptCurrency,
            invoiceId: inv.id,
            invoiceCurrency: invCurrency,
          });
        }
      }

      const existingApplied = await (this.prisma as any).customerReceiptLine.groupBy({
        by: ['invoiceId'],
        where: {
          tenantId: params.tenantId,
          invoiceId: { in: invoiceIds },
          receipt: {
            tenantId: params.tenantId,
            status: 'POSTED',
          },
          ...(params.receiptIdForUpdate
            ? { receiptId: { not: params.receiptIdForUpdate } }
            : {}),
        } as any,
        _sum: { appliedAmount: true },
      });
      const appliedByInvoiceId = new Map(
        (existingApplied ?? []).map((g: any) => [
          g.invoiceId,
          Number(g._sum?.appliedAmount ?? 0),
        ]),
      );

      const invById = new Map(invoices.map((i: any) => [i.id, i] as const));
      for (const l of lines) {
        const inv = invById.get(l.invoiceId);
        const alreadyApplied = this.normalizeMoney(
          Number(appliedByInvoiceId.get(l.invoiceId) ?? 0),
        );
        const invoiceTotal = this.normalizeMoney(Number(inv?.totalAmount ?? 0));
        const openBalance = this.normalizeMoney(invoiceTotal - alreadyApplied);
        const nextApplied = this.normalizeMoney(l.appliedAmount);

        if (openBalance <= 0 && nextApplied > 0) {
          throw new BadRequestException({
            error: 'Invoice is fully settled; cannot allocate',
            invoiceId: l.invoiceId,
            invoiceTotal,
            alreadyApplied,
          });
        }
        if (nextApplied > openBalance) {
          throw new BadRequestException({
            error: 'Allocation exceeds invoice open balance',
            invoiceId: l.invoiceId,
            appliedAmount: nextApplied,
            invoiceTotal,
            alreadyApplied,
            openBalance,
          });
        }
      }
    }
  }

  async listAllocations(req: Request, receiptId: string) {
    const tenant = this.ensureTenant(req);
    const r = await (this.prisma as any).customerReceipt.findFirst({
      where: { id: receiptId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!r) throw new NotFoundException('Receipt not found');

    const lines = await (this.prisma as any).customerReceiptLine.findMany({
      where: { receiptId },
      include: { invoice: true },
      orderBy: [{ createdAt: 'asc' }],
    });

    return {
      receiptId,
      lines: (lines ?? []).map((l: any) => ({
        id: l.id,
        invoiceId: l.invoiceId,
        invoiceNumber: l.invoice?.invoiceNumber ?? '',
        invoiceDate: l.invoice?.invoiceDate
          ? new Date(l.invoice.invoiceDate).toISOString().slice(0, 10)
          : null,
        invoiceTotalAmount: l.invoice ? Number(l.invoice.totalAmount) : null,
        currency: (l.invoice as any)?.currency ?? null,
        appliedAmount: Number(l.appliedAmount),
        createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : null,
      })),
    };
  }

  async setAllocations(req: Request, receiptId: string, dto: SetReceiptAllocationsDto) {
    const tenant = this.ensureTenant(req);

    await this.assertEditable(receiptId, tenant.id);

    const receipt = await (this.prisma as any).customerReceipt.findFirst({
      where: { id: receiptId, tenantId: tenant.id },
      select: {
        id: true,
        customerId: true,
        currency: true,
        totalAmount: true,
        status: true,
      },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');

    await this.validateLines({
      tenantId: tenant.id,
      customerId: receipt.customerId,
      receiptCurrency: String(receipt.currency),
      totalAmount: Number(receipt.totalAmount),
      lines: dto.lines,
      receiptIdForUpdate: receiptId,
    });

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).customerReceiptLine.deleteMany({
        where: { receiptId },
      });

      const lines = dto.lines ?? [];
      if (lines.length > 0) {
        await (tx as any).customerReceiptLine.createMany({
          data: lines.map((l) => ({
            tenantId: tenant.id,
            receiptId,
            invoiceId: l.invoiceId,
            appliedAmount: l.appliedAmount,
          })),
        });
      }
    });

    return this.listAllocations(req, receiptId);
  }

  async listReceipts(req: Request) {
    const tenant = this.ensureTenant(req);

    const rows = await (this.prisma as any).customerReceipt.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ receiptDate: 'desc' }, { receiptNumber: 'desc' }],
      include: { customer: true },
    });

    return rows.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      receiptDate: r.receiptDate.toISOString().slice(0, 10),
      customerId: r.customerId,
      customerName: r.customer?.name ?? '',
      currency: r.currency,
      totalAmount: Number(r.totalAmount),
      paymentMethod: r.paymentMethod,
      paymentReference: r.paymentReference,
      status: r.status,
      glJournalId: r.glJournalId ?? null,
      createdAt: r.createdAt.toISOString(),
      postedAt: r.postedAt?.toISOString() ?? null,
      voidedAt: r.voidedAt?.toISOString() ?? null,
    }));
  }

  async getReceiptById(req: Request, id: string) {
    const tenant = this.ensureTenant(req);

    const r = await (this.prisma as any).customerReceipt.findFirst({
      where: { id, tenantId: tenant.id },
      include: { customer: true, lines: { include: { invoice: true } } },
    });
    if (!r) throw new NotFoundException('Receipt not found');

    return {
      id: r.id,
      receiptNumber: r.receiptNumber,
      receiptDate: r.receiptDate.toISOString().slice(0, 10),
      customerId: r.customerId,
      customerName: r.customer?.name ?? '',
      currency: r.currency,
      totalAmount: Number(r.totalAmount),
      paymentMethod: r.paymentMethod,
      paymentReference: r.paymentReference,
      status: r.status,
      glJournalId: r.glJournalId ?? null,
      createdAt: r.createdAt.toISOString(),
      postedAt: r.postedAt?.toISOString() ?? null,
      postedById: r.postedById ?? null,
      voidedAt: r.voidedAt?.toISOString() ?? null,
      voidReason: r.voidReason ?? null,
      lines: r.lines.map((l) => ({
        id: l.id,
        invoiceId: l.invoiceId,
        invoiceNumber: l.invoice?.invoiceNumber ?? '',
        appliedAmount: Number(l.appliedAmount),
      })),
    };
  }

  async createReceipt(req: Request, dto: CreateReceiptDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const customer = await (this.prisma as any).customer.findFirst({
      where: { id: dto.customerId, tenantId: tenant.id },
      select: { id: true, status: true },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found');
    }
    if (customer.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Customer is inactive and cannot be used for new transactions.',
      );
    }

    await this.validateLines({
      tenantId: tenant.id,
      customerId: dto.customerId,
      receiptCurrency: dto.currency,
      totalAmount: dto.totalAmount,
      lines: dto.lines,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const receiptNumber = await this.nextReceiptNumber(tx, tenant.id);
      return (tx as any).customerReceipt.create({
        data: {
          tenantId: tenant.id,
          receiptNumber,
          receiptDate: new Date(dto.receiptDate),
          customerId: dto.customerId,
          currency: dto.currency,
          totalAmount: dto.totalAmount,
          paymentMethod: dto.paymentMethod as any,
          paymentReference: dto.paymentReference,
          status: 'DRAFT' as any,
          createdById: user.id,
          lines: {
            create: (dto.lines ?? []).map((l) => ({
              tenantId: tenant.id,
              invoiceId: l.invoiceId,
              appliedAmount: l.appliedAmount,
            })),
          },
        },
      });
    });

    return this.getReceiptById(req, created.id);
  }

  async updateReceipt(req: Request, id: string, dto: UpdateReceiptDto) {
    const tenant = this.ensureTenant(req);

    await this.assertEditable(id, tenant.id);

    const current = await (this.prisma as any).customerReceipt.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, customerId: true, currency: true, totalAmount: true },
    });
    if (!current) throw new NotFoundException('Receipt not found');

    const nextCustomerId = dto.customerId ?? current.customerId;
    const nextTotalAmount = dto.totalAmount ?? Number(current.totalAmount);
    const nextCurrency = dto.currency ?? String(current.currency);

    if (dto.customerId) {
      const customer = await (this.prisma as any).customer.findFirst({
        where: { id: dto.customerId, tenantId: tenant.id },
        select: { id: true, status: true },
      });
      if (!customer) {
        throw new BadRequestException('Customer not found');
      }
      if (customer.status !== 'ACTIVE') {
        throw new BadRequestException(
          'Customer is inactive and cannot be used for new transactions.',
        );
      }
    }

    await this.validateLines({
      tenantId: tenant.id,
      customerId: nextCustomerId,
      receiptCurrency: nextCurrency,
      totalAmount: nextTotalAmount,
      lines: dto.lines,
      receiptIdForUpdate: id,
    });

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).customerReceipt.update({
        where: { id },
        data: {
          customerId: dto.customerId,
          receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : undefined,
          currency: dto.currency,
          totalAmount: dto.totalAmount,
          paymentMethod: dto.paymentMethod ? (dto.paymentMethod as any) : undefined,
          paymentReference: dto.paymentReference,
        },
      });

      if (dto.lines) {
        await (tx as any).customerReceiptLine.deleteMany({ where: { receiptId: id } });
        if (dto.lines.length > 0) {
          await (tx as any).customerReceiptLine.createMany({
            data: dto.lines.map((l) => ({
              tenantId: tenant.id,
              receiptId: id,
              invoiceId: l.invoiceId,
              appliedAmount: l.appliedAmount,
            })),
          });
        }
      }
    });

    return this.getReceiptById(req, id);
  }

  async postReceipt(req: Request, id: string) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);
    const now = new Date();

    const existing = await (this.prisma as any).customerReceipt.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        status: true,
        receiptDate: true,
        currency: true,
        totalAmount: true,
        createdById: true,
        glJournalId: true,
      },
    });
    if (!existing) throw new NotFoundException('Receipt not found');

    if (existing.status === 'POSTED') {
      return this.getReceiptById(req, id);
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT receipts can be posted');
    }

    const draftLines = await (this.prisma as any).customerReceiptLine.findMany({
      where: { receiptId: id },
      select: { invoiceId: true, appliedAmount: true },
    });

    const positiveLines = (draftLines ?? []).filter(
      (l: any) => this.normalizeMoney(Number(l.appliedAmount)) > 0,
    );
    if (positiveLines.length < 1) {
      throw new BadRequestException({
        error: 'Receipt must have at least one allocation line before posting',
        reason: 'NO_ALLOCATIONS',
      });
    }

    await this.validateLines({
      tenantId: tenant.id,
      customerId: String((existing as any).customerId ?? ''),
      receiptCurrency: String(existing.currency),
      totalAmount: Number(existing.totalAmount),
      lines: positiveLines.map((l: any) => ({
        invoiceId: l.invoiceId,
        appliedAmount: Number(l.appliedAmount),
      })),
    });

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        startDate: { lte: existing.receiptDate },
        endDate: { gte: existing.receiptDate },
      },
      select: { id: true, status: true, name: true },
    });

    if (!period || period.status !== 'OPEN') {
      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: !period
          ? 'No accounting period exists for the receipt date'
          : `Accounting period is not OPEN: ${period.name}`,
      });
    }

    if (period.name === this.OPENING_PERIOD_NAME) {
      throw new ForbiddenException({
        error: 'Posting blocked by opening balances control period',
        reason:
          'Operational postings are not allowed in the Opening Balances period',
      });
    }

    const cutoverLocked = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        name: this.OPENING_PERIOD_NAME,
        status: 'CLOSED',
      },
      orderBy: { startDate: 'desc' },
      select: { startDate: true },
    });

    if (cutoverLocked && existing.receiptDate < cutoverLocked.startDate) {
      throw new ForbiddenException({
        error: 'Posting blocked by cutover lock',
        reason: `Posting dated before cutover is not allowed (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`,
      });
    }

    const tenantConfig = await (this.prisma as any).tenant.findUnique({
      where: { id: tenant.id },
      select: {
        arControlAccountId: true,
        defaultBankClearingAccountId: true,
      },
    });

    const arControlAccountId = (tenantConfig?.arControlAccountId ?? null) as
      | string
      | null;
    const bankClearingAccountId = (
      tenantConfig?.defaultBankClearingAccountId ?? null
    ) as string | null;
    if (!bankClearingAccountId) {
      throw new BadRequestException({
        error: 'Missing configuration: default bank clearing account',
        field: 'Tenant.defaultBankClearingAccountId',
      });
    }
    if (!arControlAccountId) {
      throw new BadRequestException({
        error: 'Missing configuration: AR control account',
        field: 'Tenant.arControlAccountId',
      });
    }

    const [bankAccount, arAccount] = await Promise.all([
      this.prisma.account.findFirst({
        where: {
          tenantId: tenant.id,
          id: bankClearingAccountId as string,
          isActive: true,
          type: 'ASSET',
        },
        select: { id: true },
      }),
      this.prisma.account.findFirst({
        where: {
          tenantId: tenant.id,
          id: arControlAccountId as string,
          isActive: true,
          type: 'ASSET',
        },
        select: { id: true },
      }),
    ]);

    if (!bankAccount) {
      throw new BadRequestException(
        'Configured bank clearing GL account not found or invalid',
      );
    }
    if (!arAccount) {
      throw new BadRequestException(
        'Configured AR control GL account not found or invalid',
      );
    }

    const amount = Number(existing.totalAmount);
    if (!(amount > 0)) {
      throw new BadRequestException('Receipt totalAmount must be > 0 to post');
    }

    const posted = await this.prisma.$transaction(async (tx) => {
      const current = await (tx as any).customerReceipt.findFirst({
        where: { id, tenantId: tenant.id },
        select: { id: true, status: true, glJournalId: true },
      });
      if (!current) throw new NotFoundException('Receipt not found');
      if (current.status === 'POSTED') {
        return { receiptId: current.id, glJournalId: current.glJournalId ?? null };
      }
      if (current.status !== 'DRAFT') {
        throw new BadRequestException('Only DRAFT receipts can be posted');
      }

      const existingJournal = await tx.journalEntry.findFirst({
        where: {
          tenantId: tenant.id,
          reference: `AR-RECEIPT:${id}`,
        },
        select: { id: true, status: true },
      });
      if (existingJournal) {
        if (existingJournal.status !== 'POSTED') {
          throw new ConflictException({
            error: 'Existing receipt journal is not POSTED; cannot continue',
            journalId: existingJournal.id,
            status: existingJournal.status,
          });
        }

        await (tx as any).customerReceipt.update({
          where: { id },
          data: {
            status: 'POSTED' as ReceiptStatus,
            postedById: user.id,
            postedByUserId: user.id,
            postedAt: now,
            glJournalId: existingJournal.id,
          },
        });

        return { receiptId: id, glJournalId: existingJournal.id };
      }

      const journal = await tx.journalEntry.create({
        data: {
          tenantId: tenant.id,
          journalDate: existing.receiptDate,
          reference: `AR-RECEIPT:${id}`,
          description: `AR receipt posting: ${id}`,
          createdById: existing.createdById,
          lines: {
            create: [
              { accountId: bankAccount.id, debit: amount, credit: 0 },
              { accountId: arAccount.id, debit: 0, credit: amount },
            ],
          },
        } as any,
        include: { lines: true },
      });

      const postedJournal = await tx.journalEntry.update({
        where: { id: journal.id },
        data: {
          status: 'POSTED',
          postedById: user.id,
          postedAt: now,
        } as any,
        select: { id: true },
      });

      await (tx as any).customerReceipt.update({
        where: { id },
        data: {
          status: 'POSTED' as ReceiptStatus,
          postedById: user.id,
          postedByUserId: user.id,
          postedAt: now,
          glJournalId: postedJournal.id,
        },
      });

      await tx.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'AR_POST',
            entityType: 'CUSTOMER_RECEIPT',
            entityId: id,
            action: 'AR_RECEIPT_POST',
            outcome: 'SUCCESS',
            reason: JSON.stringify({ journalId: postedJournal.id }),
            userId: user.id,
            permissionUsed: 'AR_RECEIPTS_CREATE',
          } as any,
        })
        .catch(() => undefined);

      return { receiptId: id, glJournalId: postedJournal.id };
    });

    return this.getReceiptById(req, posted.receiptId);
  }

  async voidReceipt(req: Request, id: string, reason: string) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);
    const now = new Date();

    const r = await (this.prisma as any).customerReceipt.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true },
    });
    if (!r) throw new NotFoundException('Receipt not found');
    if (r.status === 'VOIDED') {
      throw new BadRequestException('Receipt already VOIDED');
    }
    if (r.status !== 'POSTED' && r.status !== 'DRAFT') {
      throw new ForbiddenException('Invalid receipt status');
    }

    if (!reason || reason.trim().length < 2) {
      throw new BadRequestException('Void reason is required');
    }

    await (this.prisma as any).customerReceipt.update({
      where: { id },
      data: {
        status: 'VOIDED' as ReceiptStatus,
        voidedById: user.id,
        voidedAt: now,
        voidReason: reason.trim(),
      },
    });

    return this.getReceiptById(req, id);
  }
}
