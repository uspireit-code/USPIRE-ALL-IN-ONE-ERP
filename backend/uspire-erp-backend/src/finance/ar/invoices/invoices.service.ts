import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateCustomerInvoiceDto,
  ListInvoicesQueryDto,
} from './invoices.dto';

@Injectable()
export class FinanceArInvoicesService {
  private readonly INVOICE_NUMBER_SEQUENCE_NAME = 'AR_INVOICE_NUMBER';
  private readonly OPENING_PERIOD_NAME = 'Opening Balances';

  constructor(private readonly prisma: PrismaService) {}

  private round2(n: number) {
    return Math.round(Number(n ?? 0) * 100) / 100;
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

  private normalizeHeaderKey(v: any) {
    return String(v ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9]/g, '');
  }

  private parseCsvRows(buf: Buffer): Array<{ rowNumber: number; row: Record<string, string> }> {
    const text = buf.toString('utf8');
    const lines = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((l) => l.trim().length > 0);

    if (lines.length === 0) return [];

    const parseLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }
        if (ch === ',' && !inQuotes) {
          out.push(cur);
          cur = '';
          continue;
        }
        cur += ch;
      }
      out.push(cur);
      return out;
    };

    const headers = parseLine(lines[0]).map((h) => this.normalizeHeaderKey(h));
    const rows: Array<{ rowNumber: number; row: Record<string, string> }> = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = String(cols[j] ?? '').trim();
      }
      const hasAny = Object.values(row).some((v) => String(v ?? '').trim() !== '');
      if (hasAny) rows.push({ rowNumber: i + 1, row });
    }

    return rows;
  }

  private async readXlsxRows(buf: Buffer): Promise<Array<{ rowNumber: number; row: Record<string, any> }>> {
    const wb = new ExcelJS.Workbook();
    await (wb.xlsx as any).load(buf as any);

    const ws = wb.worksheets[0];
    if (!ws) return [];

    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const raw = (cell.value as any)?.text ?? cell.value;
      headers[colNumber - 1] = this.normalizeHeaderKey(raw);
    });

    const rows: Array<{ rowNumber: number; row: Record<string, any> }> = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        const cell = row.getCell(idx + 1);
        const v = (cell.value as any)?.text ?? cell.value;
        obj[h] = v;
      });
      const hasAny = Object.values(obj).some((v) => String(v ?? '').trim() !== '');
      if (hasAny) rows.push({ rowNumber, row: obj });
    });

    return rows;
  }

  private parseYmdToDateOrNull(v: any): Date | null {
    const s = String(v ?? '').trim();
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  private toNum(v: any): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : 0;
  }

  private async assertOpenPeriodForInvoiceDate(params: { tenantId: string; invoiceDate: Date }) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: params.tenantId,
        startDate: { lte: params.invoiceDate },
        endDate: { gte: params.invoiceDate },
      },
      select: { id: true, status: true, name: true, startDate: true },
    });

    if (!period || period.status !== 'OPEN') {
      throw new ForbiddenException(
        !period
          ? 'Invoice date must fall within an OPEN accounting period'
          : `Invoice date period is not OPEN: ${period.name}`,
      );
    }

    if (period.name === this.OPENING_PERIOD_NAME) {
      throw new ForbiddenException(
        'Operational postings are not allowed in the Opening Balances period',
      );
    }

    const cutoverLocked = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: params.tenantId,
        name: this.OPENING_PERIOD_NAME,
        status: 'CLOSED',
      },
      orderBy: { startDate: 'desc' },
      select: { startDate: true },
    });

    if (cutoverLocked && params.invoiceDate < cutoverLocked.startDate) {
      throw new ForbiddenException(
        `Invoice date is before cutover and cannot be used (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`,
      );
    }
  }

  private async nextInvoiceNumber(tx: any, tenantId: string) {
    const counter = await tx.tenantSequenceCounter.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: this.INVOICE_NUMBER_SEQUENCE_NAME,
        },
      },
      create: {
        tenantId,
        name: this.INVOICE_NUMBER_SEQUENCE_NAME,
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

    return `INV-${String(bumped.value).padStart(6, '0')}`;
  }

  private async computeOutstandingBalance(params: { tenantId: string; invoiceId: string; totalAmount: number }) {
    const g = await (this.prisma as any).customerReceiptLine.groupBy({
      by: ['invoiceId'],
      where: {
        tenantId: params.tenantId,
        invoiceId: params.invoiceId,
        receipt: {
          tenantId: params.tenantId,
          status: 'POSTED',
        },
      },
      _sum: { appliedAmount: true },
    });

    const applied = this.round2(Number(g?.[0]?._sum?.appliedAmount ?? 0));
    const total = this.round2(Number(params.totalAmount ?? 0));
    return this.round2(total - applied);
  }

  async list(req: Request, q: ListInvoicesQueryDto) {
    const tenant = this.ensureTenant(req);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;

    const where: any = { tenantId: tenant.id };
    if (q.status) where.status = q.status;
    if (q.customerId) where.customerId = q.customerId;
    if (q.search) {
      const s = String(q.search).trim();
      if (s) {
        where.OR = [
          { invoiceNumber: { contains: s, mode: 'insensitive' } },
          { reference: { contains: s, mode: 'insensitive' } },
          { customer: { name: { contains: s, mode: 'insensitive' } } },
        ];
      }
    }

    const [total, items] = await Promise.all([
      this.prisma.customerInvoice.count({ where } as any),
      this.prisma.customerInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: true } as any,
      } as any),
    ]);

    const rows = await Promise.all(
      (items ?? []).map(async (inv: any) => ({
        ...inv,
        subtotal: Number(inv.subtotal),
        taxAmount: Number(inv.taxAmount),
        totalAmount: Number(inv.totalAmount),
        outstandingBalance: await this.computeOutstandingBalance({
          tenantId: tenant.id,
          invoiceId: inv.id,
          totalAmount: Number(inv.totalAmount),
        }),
      })),
    );

    return { page, pageSize, total, items: rows };
  }

  async getById(req: Request, id: string) {
    const tenant = this.ensureTenant(req);

    const inv = await this.prisma.customerInvoice.findFirst({
      where: { id, tenantId: tenant.id } as any,
      include: { customer: true, lines: true } as any,
    });

    if (!inv) throw new NotFoundException('Invoice not found');

    return {
      ...inv,
      subtotal: Number((inv as any).subtotal),
      taxAmount: Number((inv as any).taxAmount),
      totalAmount: Number((inv as any).totalAmount),
      lines: (inv as any).lines.map((l: any) => ({
        ...l,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        lineTotal: Number(l.lineTotal),
      })),
      outstandingBalance: await this.computeOutstandingBalance({
        tenantId: tenant.id,
        invoiceId: inv.id,
        totalAmount: Number((inv as any).totalAmount),
      }),
    };
  }

  async create(req: Request, dto: CreateCustomerInvoiceDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const invoiceDate = this.parseYmdToDateOrNull(dto.invoiceDate);
    const dueDate = this.parseYmdToDateOrNull(dto.dueDate);
    if (!invoiceDate) throw new BadRequestException('invoiceDate is required');
    if (!dueDate) throw new BadRequestException('dueDate is required');

    await this.assertOpenPeriodForInvoiceDate({ tenantId: tenant.id, invoiceDate });

    const currency = String(dto.currency ?? '').trim();
    if (!currency) throw new BadRequestException('currency is required');

    const customer = await (this.prisma as any).customer.findFirst({
      where: { id: dto.customerId, tenantId: tenant.id },
      select: { id: true, status: true },
    });

    if (!customer) throw new BadRequestException('Customer not found');
    if (customer.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Customer is inactive and cannot be used for new transactions.',
      );
    }

    if (!dto.lines || dto.lines.length < 1) {
      throw new BadRequestException('Invoice must have at least 1 line');
    }

    const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
    const accounts = await this.prisma.account.findMany({
      where: {
        tenantId: tenant.id,
        id: { in: accountIds },
        isActive: true,
      },
      select: { id: true, type: true },
    });
    const byId = new Map(accounts.map((a) => [a.id, a] as const));

    const computedLines = dto.lines.map((l) => {
      const qty = this.toNum(l.quantity ?? 1);
      const unitPrice = this.toNum(l.unitPrice);
      const description = String(l.description ?? '').trim();

      if (!l.accountId) throw new BadRequestException('Invoice line missing accountId');
      if (!description) throw new BadRequestException('Invoice line description is required');
      if (!(qty > 0)) throw new BadRequestException('Invoice line quantity must be > 0');
      if (unitPrice < 0) throw new BadRequestException('Invoice line unitPrice must be >= 0');

      const acct = byId.get(l.accountId);
      if (!acct) {
        throw new BadRequestException(`Account not found or inactive: ${l.accountId}`);
      }
      if ((acct as any).type !== 'INCOME') {
        throw new BadRequestException(`Invoice line account must be INCOME: ${l.accountId}`);
      }

      const lineTotal = this.round2(qty * unitPrice);
      return {
        accountId: l.accountId,
        description,
        quantity: qty,
        unitPrice,
        lineTotal,
      };
    });

    const subtotal = this.round2(computedLines.reduce((s, l) => s + l.lineTotal, 0));
    const taxAmount = 0;
    const totalAmount = this.round2(subtotal + taxAmount);

    const created = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.nextInvoiceNumber(tx, tenant.id);
      return tx.customerInvoice.create({
        data: {
          tenantId: tenant.id,
          customerId: dto.customerId,
          invoiceNumber,
          invoiceDate,
          dueDate,
          currency,
          reference: dto.reference ? String(dto.reference).trim() : undefined,
          subtotal,
          taxAmount,
          totalAmount,
          status: 'DRAFT',
          createdById: user.id,
          lines: {
            create: computedLines.map((l) => ({
              accountId: l.accountId,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
            })),
          },
        } as any,
        include: { customer: true, lines: true } as any,
      } as any);
    });

    return this.getById(req, (created as any).id);
  }

  async post(req: Request, id: string, opts?: { arControlAccountCode?: string }) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const inv = await this.prisma.customerInvoice.findFirst({
      where: { id, tenantId: tenant.id } as any,
      include: { lines: true } as any,
    });

    if (!inv) throw new NotFoundException('Invoice not found');
    if ((inv as any).status === 'POSTED') {
      throw new BadRequestException('Invoice is already posted');
    }

    await this.assertOpenPeriodForInvoiceDate({ tenantId: tenant.id, invoiceDate: (inv as any).invoiceDate });

    const arCode = String(opts?.arControlAccountCode ?? '1100');
    const arAccount = await this.prisma.account.findFirst({
      where: {
        tenantId: tenant.id,
        code: arCode,
        isActive: true,
        type: 'ASSET',
      } as any,
      select: { id: true, code: true, name: true },
    });
    if (!arAccount) {
      throw new BadRequestException(`AR control account not found or invalid: ${arCode}`);
    }

    const lines = ((inv as any).lines ?? []).map((l: any) => ({
      accountId: l.accountId,
      lineTotal: this.round2(Number(l.lineTotal)),
    }));

    if (lines.length < 1) throw new BadRequestException('Invoice must have at least 1 line');

    const creditsTotal = this.round2(lines.reduce((s, l) => s + l.lineTotal, 0));
    const invTotal = this.round2(Number((inv as any).totalAmount));
    if (creditsTotal !== invTotal) {
      throw new BadRequestException('Invoice totals failed validation before posting');
    }

    const journal = await this.prisma.journalEntry.create({
      data: {
        tenantId: tenant.id,
        journalDate: (inv as any).invoiceDate,
        reference: `AR-INVOICE:${(inv as any).id}`,
        description: `AR invoice posting: ${(inv as any).invoiceNumber}`,
        createdById: (inv as any).createdById,
        lines: {
          create: [
            {
              accountId: arAccount.id,
              debit: (inv as any).totalAmount,
              credit: 0,
            },
            ...lines.map((l: any) => ({
              accountId: l.accountId,
              debit: 0,
              credit: l.lineTotal,
            })),
          ],
        },
      } as any,
      include: { lines: true } as any,
    } as any);

    const postedJournal = await this.prisma.journalEntry.update({
      where: { id: (journal as any).id },
      data: {
        status: 'POSTED',
        postedById: user.id,
        postedAt: new Date(),
      },
      include: { lines: true } as any,
    } as any);

    const updated = await this.prisma.customerInvoice.update({
      where: { id: (inv as any).id },
      data: {
        status: 'POSTED',
        postedById: user.id,
        postedAt: new Date(),
      },
      include: { customer: true, lines: true } as any,
    } as any);

    return { invoice: await this.getById(req, (updated as any).id), glJournal: postedJournal };
  }

  async getImportCsvTemplate(req: Request) {
    this.ensureTenant(req);
    const headers = [
      'Customer Code',
      'Invoice Date',
      'Due Date',
      'Revenue Account Code',
      'Description',
      'Quantity',
      'Unit Price',
      'Currency',
      'Reference',
    ];

    const fileName = `invoice_import_template.csv`;
    const body = `${headers.join(',')}\n`;
    return { fileName, body };
  }

  async getImportXlsxTemplate(req: Request) {
    this.ensureTenant(req);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Invoices');
    ws.addRow([
      'Customer Code',
      'Invoice Date',
      'Due Date',
      'Revenue Account Code',
      'Description',
      'Quantity',
      'Unit Price',
      'Currency',
      'Reference',
    ]);

    const fileName = `invoice_import_template.xlsx`;
    const body = await (wb.xlsx as any).writeBuffer();
    return { fileName, body };
  }

  private async readImportRows(file: any) {
    if (!file?.buffer) throw new BadRequestException('Missing file');
    const name = String(file.originalname ?? '').toLowerCase();
    const buf: Buffer = file.buffer;

    if (name.endsWith('.xlsx')) {
      return this.readXlsxRows(buf);
    }

    return this.parseCsvRows(buf).map((r) => ({ rowNumber: r.rowNumber, row: r.row }));
  }

  async previewImport(req: Request, file: any) {
    const tenant = this.ensureTenant(req);

    const rows = await this.readImportRows(file);

    const parsed = rows.map((r) => {
      const raw = r.row;
      const customerCode = String(raw.customercode ?? raw.customer_code ?? raw.customer ?? '').trim();
      const invoiceDate = String(raw.invoicedate ?? raw.invoice_date ?? '').trim();
      const dueDate = String(raw.duedate ?? raw.due_date ?? '').trim();
      const revenueAccountCode = String(raw.revenueaccountcode ?? raw.revenue_account_code ?? raw.accountcode ?? raw.account_code ?? '').trim();
      const description = String(raw.description ?? '').trim();
      const quantity = this.toNum(raw.quantity ?? 1);
      const unitPrice = this.toNum(raw.unitprice ?? raw.unit_price ?? 0);
      const currency = String(raw.currency ?? '').trim();
      const reference = String(raw.reference ?? '').trim();

      const errors: string[] = [];
      if (!customerCode) errors.push('Customer Code is required');
      if (!invoiceDate || !this.parseYmdToDateOrNull(invoiceDate)) errors.push('Invoice Date is required and must be a valid date');
      if (!dueDate || !this.parseYmdToDateOrNull(dueDate)) errors.push('Due Date is required and must be a valid date');
      if (!currency) errors.push('Currency is required');
      if (!revenueAccountCode) errors.push('Revenue Account Code is required');
      if (!description) errors.push('Description is required');
      if (!(quantity > 0)) errors.push('Quantity must be > 0');
      if (unitPrice < 0) errors.push('Unit Price must be >= 0');

      return {
        rowNumber: r.rowNumber,
        customerCode,
        invoiceDate,
        dueDate,
        revenueAccountCode,
        description,
        quantity,
        unitPrice,
        currency,
        reference: reference || undefined,
        errors,
      };
    });

    const customerCodes = [...new Set(parsed.map((p) => p.customerCode).filter(Boolean))];
    const accountCodes = [...new Set(parsed.map((p) => p.revenueAccountCode).filter(Boolean))];

    const [customersRaw, accountsRaw] = await Promise.all([
      (this.prisma as any).customer.findMany({
        where: { tenantId: tenant.id, customerCode: { in: customerCodes } },
        select: { id: true, customerCode: true, status: true },
      }),
      this.prisma.account.findMany({
        where: { tenantId: tenant.id, code: { in: accountCodes }, isActive: true },
        select: { id: true, code: true, type: true },
      }),
    ]);

    const customers = (customersRaw ?? []) as any[];
    const accounts = (accountsRaw ?? []) as any[];

    const customerByCode = new Map(customers.map((c: any) => [String(c.customerCode), c] as const));
    const accountByCode = new Map(accounts.map((a: any) => [String(a.code), a] as const));

    for (const p of parsed) {
      if (p.customerCode) {
        const c = customerByCode.get(p.customerCode);
        if (!c) p.errors.push('Customer not found');
        else if (c.status !== 'ACTIVE') p.errors.push('Customer is inactive');
      }
      if (p.revenueAccountCode) {
        const a = accountByCode.get(p.revenueAccountCode);
        if (!a) p.errors.push('Revenue account not found or inactive');
        else if (a.type !== 'INCOME') p.errors.push('Revenue account must be INCOME');
      }
      const invDate = this.parseYmdToDateOrNull(p.invoiceDate);
      if (invDate) {
        try {
          await this.assertOpenPeriodForInvoiceDate({ tenantId: tenant.id, invoiceDate: invDate });
        } catch (e: any) {
          p.errors.push(String(e?.message ?? 'Invoice Date period is not OPEN'));
        }
      }
    }

    const validCount = parsed.filter((p) => p.errors.length === 0).length;
    const invalidCount = parsed.length - validCount;

    return {
      totalRows: parsed.length,
      validCount,
      invalidCount,
      rows: parsed,
    };
  }

  async import(req: Request, file: any) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const preview = await this.previewImport(req, file);
    const validRows = preview.rows.filter((r: any) => (r.errors ?? []).length === 0);
    const failedRows = preview.rows
      .filter((r: any) => (r.errors ?? []).length > 0)
      .map((r: any) => ({ rowNumber: r.rowNumber, reason: (r.errors ?? []).join('; ') }));

    if (validRows.length === 0) {
      return {
        totalRows: preview.totalRows,
        createdCount: 0,
        failedCount: failedRows.length,
        failedRows,
      };
    }

    const customerCodes = [...new Set(validRows.map((r: any) => r.customerCode))];
    const accountCodes = [...new Set(validRows.map((r: any) => r.revenueAccountCode))];

    const [customers, accounts] = await Promise.all([
      (this.prisma as any).customer.findMany({
        where: { tenantId: tenant.id, customerCode: { in: customerCodes } },
        select: { id: true, customerCode: true },
      }),
      this.prisma.account.findMany({
        where: { tenantId: tenant.id, code: { in: accountCodes }, isActive: true, type: 'INCOME' },
        select: { id: true, code: true },
      }),
    ]);

    const customerIdByCode = new Map(customers.map((c: any) => [String(c.customerCode), c.id] as const));
    const accountIdByCode = new Map(accounts.map((a: any) => [String(a.code), a.id] as const));

    const groups = new Map<string, any[]>();
    for (const r of validRows) {
      const key = `${r.customerCode}|${r.invoiceDate}|${r.dueDate}|${r.currency}|${r.reference ?? ''}`;
      const prev = groups.get(key) ?? [];
      prev.push(r);
      groups.set(key, prev);
    }

    let createdCount = 0;

    for (const [, rows] of groups.entries()) {
      try {
        const first = rows[0];
        const customerId = customerIdByCode.get(first.customerCode);
        const invoiceDate = this.parseYmdToDateOrNull(first.invoiceDate);
        const dueDate = this.parseYmdToDateOrNull(first.dueDate);

        if (!customerId || !invoiceDate || !dueDate) {
          throw new BadRequestException('Invalid grouping key');
        }

        await this.assertOpenPeriodForInvoiceDate({ tenantId: tenant.id, invoiceDate });

        const computedLines = rows.map((rr) => {
          const accountId = accountIdByCode.get(rr.revenueAccountCode);
          if (!accountId) throw new BadRequestException('Revenue account not found');
          const qty = this.toNum(rr.quantity ?? 1);
          const unitPrice = this.toNum(rr.unitPrice ?? 0);
          const lineTotal = this.round2(qty * unitPrice);
          return {
            accountId,
            description: String(rr.description ?? '').trim(),
            quantity: qty,
            unitPrice,
            lineTotal,
          };
        });

        const subtotal = this.round2(computedLines.reduce((s, l) => s + l.lineTotal, 0));
        const taxAmount = 0;
        const totalAmount = this.round2(subtotal + taxAmount);

        await this.prisma.$transaction(async (tx) => {
          const invoiceNumber = await this.nextInvoiceNumber(tx, tenant.id);
          await tx.customerInvoice.create({
            data: {
              tenantId: tenant.id,
              customerId,
              invoiceNumber,
              invoiceDate,
              dueDate,
              currency: String(first.currency).trim(),
              reference: first.reference ? String(first.reference).trim() : undefined,
              subtotal,
              taxAmount,
              totalAmount,
              status: 'DRAFT',
              createdById: user.id,
              lines: {
                create: computedLines.map((l) => ({
                  accountId: l.accountId,
                  description: l.description,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  lineTotal: l.lineTotal,
                })),
              },
            } as any,
          } as any);
        });

        createdCount += 1;
      } catch (e: any) {
        for (const rr of rows) {
          failedRows.push({
            rowNumber: rr.rowNumber,
            reason: String(e?.message ?? 'Failed to create invoice'),
          });
        }
      }
    }

    return {
      totalRows: preview.totalRows,
      createdCount,
      failedCount: failedRows.length,
      failedRows,
    };
  }
}
