import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AgingQueryDto } from './dto/aging-query.dto';
import { ProfitLossQueryDto } from './dto/profit-loss-query.dto';
import { BalanceSheetQueryDto } from './dto/balance-sheet-query.dto';
import { StatementQueryDto } from './dto/statement-query.dto';
import { VatSummaryQueryDto } from './dto/vat-summary-query.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly OPENING_PERIOD_NAME = 'Opening Balances';

  private readonly agingBuckets = [
    { code: '0_30', label: '0–30', fromDays: 0, toDays: 30 },
    { code: '31_60', label: '31–60', fromDays: 31, toDays: 60 },
    { code: '61_90', label: '61–90', fromDays: 61, toDays: 90 },
    {
      code: '90_PLUS',
      label: '90+',
      fromDays: 91,
      toDays: null as null | number,
    },
  ] as const;

  private parseDateOnly(dateStr: string): Date {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    return d;
  }

  async vatSummary(req: Request, dto: VatSummaryQueryDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const from = new Date(dto.from);
    const to = new Date(dto.to);
    if (from > to) {
      throw new BadRequestException('from must be less than or equal to to');
    }

    await this.assertPeriodCoverage({ tenantId: tenant.id, from, to });

    const [apInvoices, arInvoices] = await Promise.all([
      this.prisma.supplierInvoice.findMany({
        where: {
          tenantId: tenant.id,
          status: 'POSTED',
          invoiceDate: { gte: from, lte: to },
        },
        select: { id: true },
      }),
      this.prisma.customerInvoice.findMany({
        where: {
          tenantId: tenant.id,
          status: 'POSTED',
          invoiceDate: { gte: from, lte: to },
        },
        select: { id: true },
      }),
    ]);

    const apIds = apInvoices.map((i) => i.id);
    const arIds = arInvoices.map((i) => i.id);

    const emptyTaxLines: Array<{ taxAmount: any }> = [];

    const [inputTaxLines, outputTaxLines] = await Promise.all([
      apIds.length
        ? this.prisma.invoiceTaxLine.findMany({
            where: {
              tenantId: tenant.id,
              sourceType: 'SUPPLIER_INVOICE',
              sourceId: { in: apIds },
              taxRate: { type: 'INPUT' },
            },
            select: { taxAmount: true },
          })
        : Promise.resolve(emptyTaxLines),
      arIds.length
        ? this.prisma.invoiceTaxLine.findMany({
            where: {
              tenantId: tenant.id,
              sourceType: 'CUSTOMER_INVOICE',
              sourceId: { in: arIds },
              taxRate: { type: 'OUTPUT' },
            },
            select: { taxAmount: true },
          })
        : Promise.resolve(emptyTaxLines),
    ]);

    const totalInputVat = this.round2(
      inputTaxLines.reduce((s, t) => s + Number(t.taxAmount), 0),
    );
    const totalOutputVat = this.round2(
      outputTaxLines.reduce((s, t) => s + Number(t.taxAmount), 0),
    );
    const netVat = this.round2(totalOutputVat - totalInputVat);

    return {
      from: dto.from,
      to: dto.to,
      totalOutputVat,
      totalInputVat,
      netVat,
      netPosition: netVat >= 0 ? 'PAYABLE' : 'RECEIVABLE',
    };
  }

  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  private daysBetween(a: Date, b: Date) {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((a.getTime() - b.getTime()) / msPerDay);
  }

  async profitLoss(req: Request, dto: ProfitLossQueryDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    let from = new Date(dto.from);
    const to = new Date(dto.to);

    if (from > to) {
      throw new BadRequestException('from must be less than or equal to to');
    }

    const cutover = await this.getCutoverDateIfLocked({ tenantId: tenant.id });
    if (cutover && to < cutover) {
      return {
        from: dto.from,
        to: dto.to,
        income: { total: 0, rows: [] },
        expenses: { total: 0, rows: [] },
        profitOrLoss: 0,
      };
    }

    if (cutover && from < cutover) {
      from = cutover;
    }

    await this.assertPeriodCoverage({ tenantId: tenant.id, from, to });

    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          tenantId: tenant.id,
          status: 'POSTED',
          journalDate: { gte: from, lte: to },
        },
        account: {
          tenantId: tenant.id,
          type: { in: ['INCOME', 'EXPENSE'] },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const accountIds = grouped.map((g) => g.accountId);

    const accounts = await this.prisma.account.findMany({
      where: {
        tenantId: tenant.id,
        id: { in: accountIds },
      },
      select: { id: true, code: true, name: true, type: true },
    });

    const accountMap = new Map(accounts.map((a) => [a.id, a] as const));

    const incomeRows: Array<{
      accountCode: string;
      accountName: string;
      balance: number;
    }> = [];
    const expenseRows: Array<{
      accountCode: string;
      accountName: string;
      balance: number;
    }> = [];

    const round2 = (n: number) => Math.round(n * 100) / 100;

    for (const g of grouped) {
      const a = accountMap.get(g.accountId);
      const debit = Number(g._sum?.debit ?? 0);
      const credit = Number(g._sum?.credit ?? 0);

      if (!a) {
        continue;
      }

      if (a.type === 'INCOME') {
        incomeRows.push({
          accountCode: a.code,
          accountName: a.name,
          balance: round2(credit - debit),
        });
      }

      if (a.type === 'EXPENSE') {
        expenseRows.push({
          accountCode: a.code,
          accountName: a.name,
          balance: round2(debit - credit),
        });
      }
    }

    incomeRows.sort((x, y) => x.accountCode.localeCompare(y.accountCode));
    expenseRows.sort((x, y) => x.accountCode.localeCompare(y.accountCode));

    const totalIncome = round2(
      incomeRows.reduce((sum, r) => sum + r.balance, 0),
    );
    const totalExpenses = round2(
      expenseRows.reduce((sum, r) => sum + r.balance, 0),
    );
    const profitOrLoss = round2(totalIncome - totalExpenses);

    return {
      from:
        cutover && new Date(dto.from) < cutover
          ? cutover.toISOString().slice(0, 10)
          : dto.from,
      to: dto.to,
      income: { total: totalIncome, rows: incomeRows },
      expenses: { total: totalExpenses, rows: expenseRows },
      profitOrLoss,
    };
  }

  async apAging(req: Request, dto: AgingQueryDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const asOf = this.parseDateOnly(dto.asOf);

    const invoices = await this.prisma.supplierInvoice.findMany({
      where: {
        tenantId: tenant.id,
        status: 'POSTED',
        invoiceDate: { lte: asOf },
      },
      select: {
        id: true,
        supplierId: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        totalAmount: true,
        supplier: { select: { id: true, name: true } },
      },
      orderBy: [
        { supplier: { name: 'asc' } },
        { dueDate: 'asc' },
        { invoiceNumber: 'asc' },
      ],
    });

    const invoiceIds = invoices.map((i) => i.id);

    const allocations = invoiceIds.length
      ? await this.prisma.paymentAllocation.findMany({
          where: {
            sourceType: 'SUPPLIER_INVOICE',
            sourceId: { in: invoiceIds },
            payment: {
              tenantId: tenant.id,
              status: 'POSTED',
              type: 'SUPPLIER_PAYMENT',
              paymentDate: { lte: asOf },
            },
          },
          select: {
            sourceId: true,
            amount: true,
          },
        })
      : [];

    const paidByInvoiceId = new Map<string, number>();
    for (const a of allocations) {
      const prev = paidByInvoiceId.get(a.sourceId) ?? 0;
      paidByInvoiceId.set(a.sourceId, prev + Number(a.amount));
    }

    type InvoiceRow = {
      invoiceId: string;
      invoiceNumber: string;
      invoiceDate: string;
      dueDate: string;
      daysPastDue: number;
      totalAmount: number;
      paidToDate: number;
      outstanding: number;
      bucket: string;
    };

    type SupplierGroup = {
      supplierId: string;
      supplierName: string;
      totalsByBucket: Record<string, number>;
      totalOutstanding: number;
      invoices: InvoiceRow[];
    };

    const supplierMap = new Map<string, SupplierGroup>();

    const bucketForDaysPastDue = (daysPastDue: number) => {
      const d = Math.max(0, daysPastDue);
      for (const b of this.agingBuckets) {
        if (b.toDays === null) {
          if (d >= b.fromDays) return b.code;
        } else if (d >= b.fromDays && d <= b.toDays) {
          return b.code;
        }
      }
      return this.agingBuckets[0].code;
    };

    for (const inv of invoices) {
      const paid = this.round2(paidByInvoiceId.get(inv.id) ?? 0);
      const total = Number(inv.totalAmount);
      const outstanding = this.round2(total - paid);
      if (outstanding <= 0) {
        continue;
      }

      const daysPastDue = this.daysBetween(asOf, inv.dueDate);
      const bucket = bucketForDaysPastDue(daysPastDue);

      let g = supplierMap.get(inv.supplierId);
      if (!g) {
        const totalsByBucket: Record<string, number> = {};
        for (const b of this.agingBuckets) {
          totalsByBucket[b.code] = 0;
        }
        g = {
          supplierId: inv.supplierId,
          supplierName: inv.supplier.name,
          totalsByBucket,
          totalOutstanding: 0,
          invoices: [],
        };
        supplierMap.set(inv.supplierId, g);
      }

      g.invoices.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
        dueDate: inv.dueDate.toISOString().slice(0, 10),
        daysPastDue,
        totalAmount: this.round2(total),
        paidToDate: paid,
        outstanding,
        bucket,
      });

      g.totalsByBucket[bucket] = this.round2(
        (g.totalsByBucket[bucket] ?? 0) + outstanding,
      );
      g.totalOutstanding = this.round2(g.totalOutstanding + outstanding);
    }

    const suppliers = [...supplierMap.values()].sort((a, b) =>
      a.supplierName.localeCompare(b.supplierName),
    );

    const grandTotalsByBucket: Record<string, number> = {};
    for (const b of this.agingBuckets) {
      grandTotalsByBucket[b.code] = 0;
    }
    let grandTotalOutstanding = 0;
    for (const s of suppliers) {
      for (const b of this.agingBuckets) {
        grandTotalsByBucket[b.code] = this.round2(
          grandTotalsByBucket[b.code] + (s.totalsByBucket[b.code] ?? 0),
        );
      }
      grandTotalOutstanding = this.round2(
        grandTotalOutstanding + s.totalOutstanding,
      );
    }

    return {
      asOf: dto.asOf,
      buckets: this.agingBuckets.map((b) => ({ code: b.code, label: b.label })),
      grandTotalsByBucket,
      grandTotalOutstanding,
      suppliers,
    };
  }

  async arAging(req: Request, dto: AgingQueryDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const asOf = this.parseDateOnly(dto.asOf);

    const invoices = await this.prisma.customerInvoice.findMany({
      where: {
        tenantId: tenant.id,
        status: 'POSTED',
        invoiceDate: { lte: asOf },
      },
      select: {
        id: true,
        customerId: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        totalAmount: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: [
        { customer: { name: 'asc' } },
        { dueDate: 'asc' },
        { invoiceNumber: 'asc' },
      ],
    });

    const invoiceIds = invoices.map((i) => i.id);

    const allocations = invoiceIds.length
      ? await this.prisma.paymentAllocation.findMany({
          where: {
            sourceType: 'CUSTOMER_INVOICE',
            sourceId: { in: invoiceIds },
            payment: {
              tenantId: tenant.id,
              status: 'POSTED',
              type: 'CUSTOMER_RECEIPT',
              paymentDate: { lte: asOf },
            },
          },
          select: {
            sourceId: true,
            amount: true,
          },
        })
      : [];

    const paidByInvoiceId = new Map<string, number>();
    for (const a of allocations) {
      const prev = paidByInvoiceId.get(a.sourceId) ?? 0;
      paidByInvoiceId.set(a.sourceId, prev + Number(a.amount));
    }

    type InvoiceRow = {
      invoiceId: string;
      invoiceNumber: string;
      invoiceDate: string;
      dueDate: string;
      daysPastDue: number;
      totalAmount: number;
      receivedToDate: number;
      outstanding: number;
      bucket: string;
    };

    type CustomerGroup = {
      customerId: string;
      customerName: string;
      totalsByBucket: Record<string, number>;
      totalOutstanding: number;
      invoices: InvoiceRow[];
    };

    const customerMap = new Map<string, CustomerGroup>();

    const bucketForDaysPastDue = (daysPastDue: number) => {
      const d = Math.max(0, daysPastDue);
      for (const b of this.agingBuckets) {
        if (b.toDays === null) {
          if (d >= b.fromDays) return b.code;
        } else if (d >= b.fromDays && d <= b.toDays) {
          return b.code;
        }
      }
      return this.agingBuckets[0].code;
    };

    for (const inv of invoices) {
      const received = this.round2(paidByInvoiceId.get(inv.id) ?? 0);
      const total = Number(inv.totalAmount);
      const outstanding = this.round2(total - received);
      if (outstanding <= 0) {
        continue;
      }

      const daysPastDue = this.daysBetween(asOf, inv.dueDate);
      const bucket = bucketForDaysPastDue(daysPastDue);

      let g = customerMap.get(inv.customerId);
      if (!g) {
        const totalsByBucket: Record<string, number> = {};
        for (const b of this.agingBuckets) {
          totalsByBucket[b.code] = 0;
        }
        g = {
          customerId: inv.customerId,
          customerName: inv.customer.name,
          totalsByBucket,
          totalOutstanding: 0,
          invoices: [],
        };
        customerMap.set(inv.customerId, g);
      }

      g.invoices.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
        dueDate: inv.dueDate.toISOString().slice(0, 10),
        daysPastDue,
        totalAmount: this.round2(total),
        receivedToDate: received,
        outstanding,
        bucket,
      });

      g.totalsByBucket[bucket] = this.round2(
        (g.totalsByBucket[bucket] ?? 0) + outstanding,
      );
      g.totalOutstanding = this.round2(g.totalOutstanding + outstanding);
    }

    const customers = [...customerMap.values()].sort((a, b) =>
      a.customerName.localeCompare(b.customerName),
    );

    const grandTotalsByBucket: Record<string, number> = {};
    for (const b of this.agingBuckets) {
      grandTotalsByBucket[b.code] = 0;
    }
    let grandTotalOutstanding = 0;
    for (const c of customers) {
      for (const b of this.agingBuckets) {
        grandTotalsByBucket[b.code] = this.round2(
          grandTotalsByBucket[b.code] + (c.totalsByBucket[b.code] ?? 0),
        );
      }
      grandTotalOutstanding = this.round2(
        grandTotalOutstanding + c.totalOutstanding,
      );
    }

    return {
      asOf: dto.asOf,
      buckets: this.agingBuckets.map((b) => ({ code: b.code, label: b.label })),
      grandTotalsByBucket,
      grandTotalOutstanding,
      customers,
    };
  }

  async supplierStatement(
    req: Request,
    supplierId: string,
    dto: StatementQueryDto,
  ) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const from = this.parseDateOnly(dto.from);
    const to = this.parseDateOnly(dto.to);
    if (from > to) {
      throw new BadRequestException('from must be less than or equal to to');
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId: tenant.id },
      select: { id: true, name: true },
    });

    if (!supplier) {
      throw new BadRequestException('Supplier not found');
    }

    const invoicesUpToTo = await this.prisma.supplierInvoice.findMany({
      where: {
        tenantId: tenant.id,
        supplierId,
        status: 'POSTED',
        invoiceDate: { lte: to },
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        totalAmount: true,
      },
      orderBy: [{ invoiceDate: 'asc' }, { invoiceNumber: 'asc' }],
    });

    const invoiceIdsUpToTo = invoicesUpToTo.map((i) => i.id);

    const paymentsUpToTo = invoiceIdsUpToTo.length
      ? await this.prisma.paymentAllocation.findMany({
          where: {
            sourceType: 'SUPPLIER_INVOICE',
            sourceId: { in: invoiceIdsUpToTo },
            payment: {
              tenantId: tenant.id,
              status: 'POSTED',
              type: 'SUPPLIER_PAYMENT',
              paymentDate: { lte: to },
            },
          },
          select: {
            amount: true,
            payment: {
              select: { id: true, paymentDate: true, reference: true },
            },
          },
        })
      : [];

    const openingInvoices = invoicesUpToTo
      .filter((i) => i.invoiceDate < from)
      .reduce((s, i) => s + Number(i.totalAmount), 0);

    const openingPayments = paymentsUpToTo
      .filter((a) => a.payment.paymentDate < from)
      .reduce((s, a) => s + Number(a.amount), 0);

    const openingBalance = this.round2(openingInvoices - openingPayments);

    type StatementLine = {
      date: string;
      type: 'INVOICE' | 'PAYMENT';
      reference: string;
      debit: number;
      credit: number;
      runningBalance: number;
    };

    const tx: Array<
      | { date: Date; type: 'INVOICE'; reference: string; amount: number }
      | { date: Date; type: 'PAYMENT'; reference: string; amount: number }
    > = [];

    for (const i of invoicesUpToTo) {
      if (i.invoiceDate >= from && i.invoiceDate <= to) {
        tx.push({
          date: i.invoiceDate,
          type: 'INVOICE',
          reference: i.invoiceNumber,
          amount: Number(i.totalAmount),
        });
      }
    }

    for (const a of paymentsUpToTo) {
      const d = a.payment.paymentDate;
      if (d >= from && d <= to) {
        tx.push({
          date: d,
          type: 'PAYMENT',
          reference: a.payment.reference ?? a.payment.id,
          amount: Number(a.amount),
        });
      }
    }

    tx.sort((x, y) => {
      const diff = x.date.getTime() - y.date.getTime();
      if (diff !== 0) return diff;
      if (x.type === y.type) return x.reference.localeCompare(y.reference);
      return x.type === 'INVOICE' ? -1 : 1;
    });

    const lines: StatementLine[] = [];
    let running = openingBalance;
    for (const t of tx) {
      if (t.type === 'INVOICE') {
        running = this.round2(running + t.amount);
        lines.push({
          date: t.date.toISOString().slice(0, 10),
          type: 'INVOICE',
          reference: t.reference,
          debit: this.round2(t.amount),
          credit: 0,
          runningBalance: running,
        });
      } else {
        running = this.round2(running - t.amount);
        lines.push({
          date: t.date.toISOString().slice(0, 10),
          type: 'PAYMENT',
          reference: t.reference,
          debit: 0,
          credit: this.round2(t.amount),
          runningBalance: running,
        });
      }
    }

    const closingInvoices = invoicesUpToTo.reduce(
      (s, i) => s + Number(i.totalAmount),
      0,
    );
    const closingPayments = paymentsUpToTo.reduce(
      (s, a) => s + Number(a.amount),
      0,
    );
    const closingBalance = this.round2(closingInvoices - closingPayments);

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      from: dto.from,
      to: dto.to,
      openingBalance,
      lines,
      closingBalance,
    };
  }

  async customerStatement(
    req: Request,
    customerId: string,
    dto: StatementQueryDto,
  ) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const from = this.parseDateOnly(dto.from);
    const to = this.parseDateOnly(dto.to);
    if (from > to) {
      throw new BadRequestException('from must be less than or equal to to');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId: tenant.id },
      select: { id: true, name: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found');
    }

    const invoicesUpToTo = await this.prisma.customerInvoice.findMany({
      where: {
        tenantId: tenant.id,
        customerId,
        status: 'POSTED',
        invoiceDate: { lte: to },
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        totalAmount: true,
      },
      orderBy: [{ invoiceDate: 'asc' }, { invoiceNumber: 'asc' }],
    });

    const invoiceIdsUpToTo = invoicesUpToTo.map((i) => i.id);

    const receiptsUpToTo = invoiceIdsUpToTo.length
      ? await this.prisma.paymentAllocation.findMany({
          where: {
            sourceType: 'CUSTOMER_INVOICE',
            sourceId: { in: invoiceIdsUpToTo },
            payment: {
              tenantId: tenant.id,
              status: 'POSTED',
              type: 'CUSTOMER_RECEIPT',
              paymentDate: { lte: to },
            },
          },
          select: {
            amount: true,
            payment: {
              select: { id: true, paymentDate: true, reference: true },
            },
          },
        })
      : [];

    const openingInvoices = invoicesUpToTo
      .filter((i) => i.invoiceDate < from)
      .reduce((s, i) => s + Number(i.totalAmount), 0);

    const openingReceipts = receiptsUpToTo
      .filter((a) => a.payment.paymentDate < from)
      .reduce((s, a) => s + Number(a.amount), 0);

    const openingBalance = this.round2(openingInvoices - openingReceipts);

    type StatementLine = {
      date: string;
      type: 'INVOICE' | 'RECEIPT';
      reference: string;
      debit: number;
      credit: number;
      runningBalance: number;
    };

    const tx: Array<
      | { date: Date; type: 'INVOICE'; reference: string; amount: number }
      | { date: Date; type: 'RECEIPT'; reference: string; amount: number }
    > = [];

    for (const i of invoicesUpToTo) {
      if (i.invoiceDate >= from && i.invoiceDate <= to) {
        tx.push({
          date: i.invoiceDate,
          type: 'INVOICE',
          reference: i.invoiceNumber,
          amount: Number(i.totalAmount),
        });
      }
    }

    for (const a of receiptsUpToTo) {
      const d = a.payment.paymentDate;
      if (d >= from && d <= to) {
        tx.push({
          date: d,
          type: 'RECEIPT',
          reference: a.payment.reference ?? a.payment.id,
          amount: Number(a.amount),
        });
      }
    }

    tx.sort((x, y) => {
      const diff = x.date.getTime() - y.date.getTime();
      if (diff !== 0) return diff;
      if (x.type === y.type) return x.reference.localeCompare(y.reference);
      return x.type === 'INVOICE' ? -1 : 1;
    });

    const lines: StatementLine[] = [];
    let running = openingBalance;
    for (const t of tx) {
      if (t.type === 'INVOICE') {
        running = this.round2(running + t.amount);
        lines.push({
          date: t.date.toISOString().slice(0, 10),
          type: 'INVOICE',
          reference: t.reference,
          debit: this.round2(t.amount),
          credit: 0,
          runningBalance: running,
        });
      } else {
        running = this.round2(running - t.amount);
        lines.push({
          date: t.date.toISOString().slice(0, 10),
          type: 'RECEIPT',
          reference: t.reference,
          debit: 0,
          credit: this.round2(t.amount),
          runningBalance: running,
        });
      }
    }

    const closingInvoices = invoicesUpToTo.reduce(
      (s, i) => s + Number(i.totalAmount),
      0,
    );
    const closingReceipts = receiptsUpToTo.reduce(
      (s, a) => s + Number(a.amount),
      0,
    );
    const closingBalance = this.round2(closingInvoices - closingReceipts);

    return {
      customerId: customer.id,
      customerName: customer.name,
      from: dto.from,
      to: dto.to,
      openingBalance,
      lines,
      closingBalance,
    };
  }

  async balanceSheet(req: Request, dto: BalanceSheetQueryDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const asOf = new Date(dto.asOf);

    const cutover = await this.getCutoverDateIfLocked({ tenantId: tenant.id });
    if (cutover && asOf < cutover) {
      throw new BadRequestException({
        error: 'Reporting blocked by cutover lock',
        reason: `Balance sheet asOf before cutover is not allowed (cutover: ${cutover.toISOString().slice(0, 10)})`,
      });
    }

    await this.assertPeriodCoverage({
      tenantId: tenant.id,
      from: asOf,
      to: asOf,
    });

    const currentPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        startDate: { lte: asOf },
        endDate: { gte: asOf },
      },
      select: { startDate: true },
    });

    if (!currentPeriod) {
      throw new BadRequestException(
        'No accounting period exists for asOf date',
      );
    }

    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          tenantId: tenant.id,
          status: 'POSTED',
          journalDate: { lte: asOf },
        },
        account: {
          tenantId: tenant.id,
          type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const accountIds = grouped.map((g) => g.accountId);

    const accounts = await this.prisma.account.findMany({
      where: { tenantId: tenant.id, id: { in: accountIds } },
      select: { id: true, code: true, name: true, type: true },
    });

    const accountMap = new Map(accounts.map((a) => [a.id, a] as const));

    const assets: Array<{
      accountCode: string;
      accountName: string;
      balance: number;
    }> = [];
    const liabilities: Array<{
      accountCode: string;
      accountName: string;
      balance: number;
    }> = [];
    const equity: Array<{
      accountCode: string;
      accountName: string;
      balance: number;
    }> = [];

    const round2 = (n: number) => Math.round(n * 100) / 100;

    for (const g of grouped) {
      const a = accountMap.get(g.accountId);
      if (!a) {
        continue;
      }

      const debit = Number(g._sum?.debit ?? 0);
      const credit = Number(g._sum?.credit ?? 0);

      if (a.type === 'ASSET') {
        assets.push({
          accountCode: a.code,
          accountName: a.name,
          balance: round2(debit - credit),
        });
      }

      if (a.type === 'LIABILITY') {
        liabilities.push({
          accountCode: a.code,
          accountName: a.name,
          balance: round2(credit - debit),
        });
      }

      if (a.type === 'EQUITY') {
        equity.push({
          accountCode: a.code,
          accountName: a.name,
          balance: round2(credit - debit),
        });
      }
    }

    const retainedEarnings = await this.retainedEarnings({
      tenantId: tenant.id,
      beforeDate: currentPeriod.startDate,
    });

    if (retainedEarnings !== 0) {
      equity.push({
        accountCode: 'RETAINED_EARNINGS',
        accountName: 'Retained Earnings (derived)',
        balance: retainedEarnings,
      });
    }

    assets.sort((x, y) => x.accountCode.localeCompare(y.accountCode));
    liabilities.sort((x, y) => x.accountCode.localeCompare(y.accountCode));
    equity.sort((x, y) => x.accountCode.localeCompare(y.accountCode));

    const totalAssets = round2(assets.reduce((sum, r) => sum + r.balance, 0));
    const totalLiabilities = round2(
      liabilities.reduce((sum, r) => sum + r.balance, 0),
    );
    const totalEquity = round2(equity.reduce((sum, r) => sum + r.balance, 0));

    return {
      asOf: dto.asOf,
      assets: { total: totalAssets, rows: assets },
      liabilities: { total: totalLiabilities, rows: liabilities },
      equity: { total: totalEquity, rows: equity },
      equation: {
        assets: totalAssets,
        liabilitiesPlusEquity: round2(totalLiabilities + totalEquity),
        balanced:
          round2(totalAssets) === round2(totalLiabilities + totalEquity),
      },
    };
  }

  private async retainedEarnings(params: {
    tenantId: string;
    beforeDate: Date;
  }): Promise<number> {
    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          tenantId: params.tenantId,
          status: 'POSTED',
          journalDate: { lt: params.beforeDate },
        },
        account: {
          tenantId: params.tenantId,
          type: { in: ['INCOME', 'EXPENSE'] },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const accountIds = grouped.map((g) => g.accountId);

    const accounts = await this.prisma.account.findMany({
      where: { tenantId: params.tenantId, id: { in: accountIds } },
      select: { id: true, type: true },
    });

    const typeById = new Map(accounts.map((a) => [a.id, a.type] as const));

    let totalIncome = 0;
    let totalExpense = 0;

    for (const g of grouped) {
      const t = typeById.get(g.accountId);
      const debit = Number(g._sum?.debit ?? 0);
      const credit = Number(g._sum?.credit ?? 0);

      if (t === 'INCOME') {
        totalIncome += credit - debit;
      }
      if (t === 'EXPENSE') {
        totalExpense += debit - credit;
      }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    return round2(totalIncome - totalExpense);
  }

  private async assertPeriodCoverage(params: {
    tenantId: string;
    from: Date;
    to: Date;
  }) {
    const periods = await this.prisma.accountingPeriod.findMany({
      where: {
        tenantId: params.tenantId,
        startDate: { lte: params.to },
        endDate: { gte: params.from },
      },
      orderBy: { startDate: 'asc' },
      select: { id: true, startDate: true, endDate: true },
    });

    if (periods.length === 0) {
      throw new BadRequestException(
        'No accounting periods configured for requested date range',
      );
    }

    const from = params.from;
    const to = params.to;

    let cursor = from;

    for (const p of periods) {
      if (p.endDate < cursor) {
        continue;
      }

      if (p.startDate > cursor) {
        throw new BadRequestException(
          'Accounting period coverage gap for requested date range',
        );
      }

      const next = new Date(p.endDate.getTime());
      next.setMilliseconds(next.getMilliseconds() + 1);
      cursor = next;

      if (cursor > to) {
        return;
      }
    }

    throw new BadRequestException(
      'Accounting period coverage gap for requested date range',
    );
  }

  private async getCutoverDateIfLocked(params: {
    tenantId: string;
  }): Promise<Date | null> {
    const closed = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: params.tenantId,
        name: this.OPENING_PERIOD_NAME,
        status: 'CLOSED',
      },
      orderBy: { startDate: 'desc' },
      select: { startDate: true },
    });

    return closed?.startDate ?? null;
  }
}
