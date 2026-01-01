import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';

type ReceiptStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

@Injectable()
export class ArReceiptsService {
  private readonly RECEIPT_NUMBER_SEQUENCE_NAME = 'AR_RECEIPT_NUMBER';

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
    totalAmount: number;
    lines?: Array<{ invoiceId: string; appliedAmount: number }>;
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
        },
        select: { id: true },
      });

      if (invoices.length !== invoiceIds.length) {
        throw new BadRequestException(
          'One or more invoices not found for customer / tenant',
        );
      }
    }
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
      createdAt: r.createdAt.toISOString(),
      postedAt: r.postedAt?.toISOString() ?? null,
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

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId: tenant.id, isActive: true },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException('Customer not found or inactive');
    }

    await this.validateLines({
      tenantId: tenant.id,
      customerId: dto.customerId,
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

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, tenantId: tenant.id, isActive: true },
        select: { id: true },
      });
      if (!customer) {
        throw new BadRequestException('Customer not found or inactive');
      }
    }

    await this.validateLines({
      tenantId: tenant.id,
      customerId: nextCustomerId,
      totalAmount: nextTotalAmount,
      lines: dto.lines,
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

    const r = await (this.prisma as any).customerReceipt.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true },
    });
    if (!r) throw new NotFoundException('Receipt not found');
    if (r.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT receipts can be posted');
    }

    await (this.prisma as any).customerReceipt.update({
      where: { id },
      data: {
        status: 'POSTED' as ReceiptStatus,
        postedById: user.id,
        postedAt: now,
      },
    });

    return this.getReceiptById(req, id);
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
