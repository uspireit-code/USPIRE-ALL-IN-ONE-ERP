import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS } from '../../rbac/permission-catalog';
import { bucketForDaysOverdue, daysBetweenUtc } from './ar-aging.util';

export type ArAgingRow = {
  customerId: string;
  customerName: string;
  current: number;
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90_plus: number;
  total: number;
};

export type ArAgingResponse = {
  asOf: string;
  buckets: Array<'CURRENT' | '0_30' | '31_60' | '61_90' | '90_PLUS'>;
  rows: ArAgingRow[];
  totals: Omit<ArAgingRow, 'customerId' | 'customerName'>;
};

@Injectable()
export class ArAgingService {
  constructor(private readonly prisma: PrismaService) {}

  private round2(n: number) {
    return Math.round(Number(n ?? 0) * 100) / 100;
  }

  private parseAsOfOrThrow(asOf?: string) {
    if (!asOf) {
      const d = new Date();
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }

    const v = String(asOf).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      throw new BadRequestException('Invalid as-of date. Use YYYY-MM-DD.');
    }

    const d = new Date(`${v}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid as-of date. Use YYYY-MM-DD.');
    }

    // Ensure the Y-M-D parts roundtrip (rejects 2026-09-31)
    if (d.toISOString().slice(0, 10) !== v) {
      throw new BadRequestException('Invalid as-of date. Use YYYY-MM-DD.');
    }

    return d;
  }

  async getAging(req: Request, q: { asOf?: string; customerId?: string }): Promise<ArAgingResponse> {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const customerId = String(q.customerId ?? '').trim() || null;
    const asOfDate = this.parseAsOfOrThrow(q.asOf);
    const asOfIso = asOfDate.toISOString().slice(0, 10);

    const invoices = (await (this.prisma.customerInvoice as any).findMany({
      where: {
        tenantId: tenant.id,
        status: 'POSTED',
        invoiceDate: { lte: asOfDate },
        ...(customerId ? { customerId } : {}),
      } as any,
      select: {
        id: true,
        customerId: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        totalAmount: true,
        customer: { select: { id: true, name: true } },
      } as any,
      orderBy: [{ customer: { name: 'asc' } }, { dueDate: 'asc' }, { invoiceNumber: 'asc' }],
    })) as Array<{
      id: string;
      customerId: string;
      invoiceNumber: string;
      invoiceDate: Date;
      dueDate: Date;
      totalAmount: any;
      customer: { id: string; name: string };
    }>;

    const invoiceIds = invoices.map((i) => i.id);

    const receiptsAgg: Array<{ invoiceId: string; _sum: { appliedAmount: any } }> = invoiceIds.length
      ? await (this.prisma as any).customerReceiptLine.groupBy({
          by: ['invoiceId'],
          where: {
            tenantId: tenant.id,
            invoiceId: { in: invoiceIds },
            receipt: {
              tenantId: tenant.id,
              status: 'POSTED',
              receiptDate: { lte: asOfDate },
            },
          } as any,
          _sum: { appliedAmount: true },
        })
      : [];

    const receiptAppliedByInvoiceId = new Map<string, number>(
      (receiptsAgg ?? []).map((g: any) => [g.invoiceId, this.round2(Number(g._sum?.appliedAmount ?? 0))] as const),
    );

    const creditAgg: Array<{ invoiceId: string; _sum: { totalAmount: any } }> = invoiceIds.length
      ? await (this.prisma as any).customerCreditNote.groupBy({
          by: ['invoiceId'],
          where: {
            tenantId: tenant.id,
            invoiceId: { in: invoiceIds },
            status: 'POSTED',
            creditNoteDate: { lte: asOfDate },
          } as any,
          _sum: { totalAmount: true },
        })
      : [];

    const creditedByInvoiceId = new Map<string, number>(
      (creditAgg ?? []).map((g: any) => [g.invoiceId, this.round2(Number(g._sum?.totalAmount ?? 0))] as const),
    );

    const rowsByCustomerId = new Map<string, ArAgingRow>();

    for (const inv of invoices) {
      const total = this.round2(Number(inv.totalAmount ?? 0));
      const receiptsApplied = this.round2(Number(receiptAppliedByInvoiceId.get(inv.id) ?? 0));
      const creditsApplied = this.round2(Number(creditedByInvoiceId.get(inv.id) ?? 0));
      const outstanding = this.round2(total - receiptsApplied - creditsApplied);

      if (!(outstanding > 0)) continue;

      const daysOverdue = daysBetweenUtc(asOfDate, inv.dueDate);
      const bucket = bucketForDaysOverdue(daysOverdue);

      let row = rowsByCustomerId.get(inv.customerId);
      if (!row) {
        row = {
          customerId: inv.customerId,
          customerName: (inv as any).customer?.name ?? '',
          current: 0,
          b0_30: 0,
          b31_60: 0,
          b61_90: 0,
          b90_plus: 0,
          total: 0,
        };
        rowsByCustomerId.set(inv.customerId, row);
      }

      if (bucket === 'CURRENT') row.current = this.round2(row.current + outstanding);
      else if (bucket === '0_30') row.b0_30 = this.round2(row.b0_30 + outstanding);
      else if (bucket === '31_60') row.b31_60 = this.round2(row.b31_60 + outstanding);
      else if (bucket === '61_90') row.b61_90 = this.round2(row.b61_90 + outstanding);
      else row.b90_plus = this.round2(row.b90_plus + outstanding);

      row.total = this.round2(row.total + outstanding);
    }

    const rows = [...rowsByCustomerId.values()].sort((a, b) => a.customerName.localeCompare(b.customerName));

    const totals = rows.reduce(
      (acc, r) => {
        acc.current = this.round2(acc.current + r.current);
        acc.b0_30 = this.round2(acc.b0_30 + r.b0_30);
        acc.b31_60 = this.round2(acc.b31_60 + r.b31_60);
        acc.b61_90 = this.round2(acc.b61_90 + r.b61_90);
        acc.b90_plus = this.round2(acc.b90_plus + r.b90_plus);
        acc.total = this.round2(acc.total + r.total);
        return acc;
      },
      { current: 0, b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0 },
    );

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'REPORT_VIEW' as any,
          entityType: 'REPORT' as any,
          entityId: `AR_AGING:${asOfIso}:${customerId ?? 'ALL'}`,
          action: 'AR_AGING_VIEW',
          outcome: 'SUCCESS' as any,
          reason: JSON.stringify({ asOf: asOfIso, customerId: customerId ?? null }),
          userId: user.id,
          permissionUsed: PERMISSIONS.AR_AGING.VIEW,
        } as any,
      })
      .catch(() => undefined);

    return {
      asOf: asOfIso,
      buckets: ['CURRENT', '0_30', '31_60', '61_90', '90_PLUS'],
      rows,
      totals,
    };
  }
}
