import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS } from '../../rbac/permission-catalog';

export type ArStatementTransactionType = 'INVOICE' | 'RECEIPT' | 'CREDIT_NOTE';

export type ArStatementTransaction = {
  date: string;
  type: ArStatementTransactionType;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export type ArStatementResponse = {
  customer: { id: string; name: string };
  fromDate: string;
  toDate: string;
  openingBalance: number;
  transactions: ArStatementTransaction[];
  closingBalance: number;
};

@Injectable()
export class ArStatementsService {
  constructor(private readonly prisma: PrismaService) {}

  private round2(n: number) {
    return Math.round(Number(n ?? 0) * 100) / 100;
  }

  private parseDateOnlyOrThrow(label: string, v: string) {
    const s = String(v ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      throw new BadRequestException(`${label} must be a valid date (YYYY-MM-DD).`);
    }
    const d = new Date(`${s}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
      throw new BadRequestException(`${label} must be a valid date (YYYY-MM-DD).`);
    }
    return d;
  }

  private resolveWindowOrThrow(q: { fromDate?: string; toDate?: string; asOfDate?: string }) {
    const fromDate = q.fromDate ? String(q.fromDate).trim() : '';
    const toDate = q.toDate ? String(q.toDate).trim() : '';
    const asOfDate = q.asOfDate ? String(q.asOfDate).trim() : '';

    const hasRange = Boolean(fromDate || toDate);
    const hasAsOf = Boolean(asOfDate);

    if (hasRange && hasAsOf) {
      throw new BadRequestException('Choose either a date range (fromDate + toDate) or an as-of date (asOfDate).');
    }

    if (hasAsOf) {
      const to = this.parseDateOnlyOrThrow('asOfDate', asOfDate);
      return { from: new Date('1970-01-01T00:00:00.000Z'), to, fromIso: '1970-01-01', toIso: to.toISOString().slice(0, 10) };
    }

    if (!fromDate || !toDate) {
      throw new BadRequestException('Choose either a date range (fromDate + toDate) or an as-of date (asOfDate).');
    }

    const from = this.parseDateOnlyOrThrow('fromDate', fromDate);
    const to = this.parseDateOnlyOrThrow('toDate', toDate);

    if (from > to) {
      throw new BadRequestException('End date must be after start date.');
    }

    return { from, to, fromIso: from.toISOString().slice(0, 10), toIso: to.toISOString().slice(0, 10) };
  }

  async getStatement(req: Request, q: { customerId: string; fromDate?: string; toDate?: string; asOfDate?: string }): Promise<ArStatementResponse> {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const customerId = String(q.customerId ?? '').trim();
    if (!customerId) {
      throw new BadRequestException('Selected customer does not exist.');
    }

    const window = this.resolveWindowOrThrow({ fromDate: q.fromDate, toDate: q.toDate, asOfDate: q.asOfDate });

    const customer = await this.prisma.customer.findFirst({
      where: { tenantId: tenant.id, id: customerId },
      select: { id: true, name: true },
    });

    if (!customer) {
      throw new BadRequestException('Selected customer does not exist.');
    }

    // Opening balance: all movements strictly before from
    const [openingInvoicesAgg, openingReceiptsAgg, openingCreditsAgg] = await Promise.all([
      this.prisma.customerInvoice.aggregate({
        where: {
          tenantId: tenant.id,
          customerId,
          status: 'POSTED',
          invoiceDate: { lt: window.from },
        },
        _sum: { totalAmount: true },
      }),
      (this.prisma as any).customerReceipt.aggregate({
        where: {
          tenantId: tenant.id,
          customerId,
          status: 'POSTED',
          receiptDate: { lt: window.from },
        } as any,
        _sum: { totalAmount: true },
      }),
      (this.prisma as any).customerCreditNote.aggregate({
        where: {
          tenantId: tenant.id,
          customerId,
          status: 'POSTED',
          creditNoteDate: { lt: window.from },
        } as any,
        _sum: { totalAmount: true },
      }),
    ]);

    const openingInvoices = this.round2(Number(openingInvoicesAgg._sum?.totalAmount ?? 0));
    const openingReceipts = this.round2(Number(openingReceiptsAgg._sum?.totalAmount ?? 0));
    const openingCredits = this.round2(Number(openingCreditsAgg._sum?.totalAmount ?? 0));

    const openingBalance = this.round2(openingInvoices - openingReceipts - openingCredits);

    const [invoices, receipts, creditNotes] = await Promise.all([
      this.prisma.customerInvoice.findMany({
        where: {
          tenantId: tenant.id,
          customerId,
          status: 'POSTED',
          invoiceDate: { gte: window.from, lte: window.to },
        },
        select: { invoiceDate: true, invoiceNumber: true, totalAmount: true },
        orderBy: [{ invoiceDate: 'asc' }, { invoiceNumber: 'asc' }],
      }),
      (this.prisma as any).customerReceipt.findMany({
        where: {
          tenantId: tenant.id,
          customerId,
          status: 'POSTED',
          receiptDate: { gte: window.from, lte: window.to },
        } as any,
        select: { receiptDate: true, receiptNumber: true, totalAmount: true },
        orderBy: [{ receiptDate: 'asc' }, { receiptNumber: 'asc' }],
      }),
      (this.prisma as any).customerCreditNote.findMany({
        where: {
          tenantId: tenant.id,
          customerId,
          status: 'POSTED',
          creditNoteDate: { gte: window.from, lte: window.to },
        } as any,
        select: { creditNoteDate: true, creditNoteNumber: true, totalAmount: true },
        orderBy: [{ creditNoteDate: 'asc' }, { creditNoteNumber: 'asc' }],
      }),
    ]);

    const tx: Array<
      | { date: Date; type: 'INVOICE'; reference: string; amount: number }
      | { date: Date; type: 'RECEIPT'; reference: string; amount: number }
      | { date: Date; type: 'CREDIT_NOTE'; reference: string; amount: number }
    > = [];

    for (const i of invoices) {
      tx.push({
        date: i.invoiceDate,
        type: 'INVOICE',
        reference: i.invoiceNumber,
        amount: Number(i.totalAmount),
      });
    }

    for (const r of receipts as any[]) {
      tx.push({
        date: r.receiptDate,
        type: 'RECEIPT',
        reference: r.receiptNumber,
        amount: Number(r.totalAmount),
      });
    }

    for (const c of creditNotes as any[]) {
      tx.push({
        date: c.creditNoteDate,
        type: 'CREDIT_NOTE',
        reference: c.creditNoteNumber,
        amount: Number(c.totalAmount),
      });
    }

    tx.sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      if (diff !== 0) return diff;
      if (a.type === b.type) return a.reference.localeCompare(b.reference);
      // Invoices before credits/receipts on the same day for deterministic running balance
      const order: Record<string, number> = { INVOICE: 0, CREDIT_NOTE: 1, RECEIPT: 2 };
      return (order[a.type] ?? 99) - (order[b.type] ?? 99);
    });

    let running = openingBalance;
    const transactions: ArStatementTransaction[] = [];

    for (const t of tx) {
      if (t.type === 'INVOICE') {
        running = this.round2(running + t.amount);
        transactions.push({
          date: t.date.toISOString().slice(0, 10),
          type: 'INVOICE',
          reference: t.reference,
          debit: this.round2(t.amount),
          credit: 0,
          runningBalance: running,
        });
      } else {
        running = this.round2(running - t.amount);
        transactions.push({
          date: t.date.toISOString().slice(0, 10),
          type: t.type,
          reference: t.reference,
          debit: 0,
          credit: this.round2(t.amount),
          runningBalance: running,
        });
      }
    }

    const closingBalance = running;

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'REPORT_VIEW' as any,
          entityType: 'CUSTOMER' as any,
          entityId: customerId,
          action: 'AR_STATEMENT_VIEW',
          outcome: 'SUCCESS' as any,
          reason: JSON.stringify({ customerId, fromDate: q.fromDate ?? null, toDate: q.toDate ?? null, asOfDate: q.asOfDate ?? null }),
          userId: user.id,
          permissionUsed: PERMISSIONS.AR_STATEMENT.VIEW,
        } as any,
      })
      .catch(() => undefined);

    return {
      customer: { id: customer.id, name: customer.name },
      fromDate: window.fromIso,
      toDate: window.toIso,
      openingBalance,
      transactions,
      closingBalance,
    };
  }
}
