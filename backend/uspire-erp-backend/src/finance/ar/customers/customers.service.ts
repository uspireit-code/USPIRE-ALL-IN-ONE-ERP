import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from './customers.dto';

@Injectable()
export class FinanceArCustomersService {
  private readonly CUSTOMER_CODE_SEQUENCE_NAME = 'CUSTOMER_CODE';

  constructor(private readonly prisma: PrismaService) {}

  private ensureTenant(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');
    return tenant;
  }

  private isValidEmail(email: string) {
    const s = String(email ?? '').trim();
    if (!s) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  private validateCustomerNameEmailOrThrow(params: { name: string; email: string }) {
    const name = String(params.name ?? '').trim();
    if (!name) throw new BadRequestException('Customer name is required');

    const email = String(params.email ?? '').trim();
    if (!email) throw new BadRequestException('Customer email is required');
    if (!this.isValidEmail(email)) throw new BadRequestException('Invalid email format');

    return { name, email };
  }

  async getById(req: Request, id: string) {
    const tenant = this.ensureTenant(req);

    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId: tenant.id } as any,
    });

    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
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
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        const cell = row.getCell(idx + 1);
        obj[h] = (cell.value as any)?.text ?? cell.value;
      });
      const hasAny = Object.values(obj).some((v) => String(v ?? '').trim() !== '');
      if (hasAny) rows.push({ rowNumber: r, row: obj });
    }

    return rows;
  }

  private async nextCustomerCode(tx: any, tenantId: string) {
    const counter = await tx.tenantSequenceCounter.upsert({
      where: { tenantId_name: { tenantId, name: this.CUSTOMER_CODE_SEQUENCE_NAME } },
      create: { tenantId, name: this.CUSTOMER_CODE_SEQUENCE_NAME, value: 0 },
      update: {},
      select: { id: true },
    });

    const bumped = await tx.tenantSequenceCounter.update({
      where: { id: counter.id },
      data: { value: { increment: 1 } },
      select: { value: true },
    });

    return `CUST-${String(bumped.value).padStart(6, '0')}`;
  }

  private async ensureUniqueCustomerCode(params: {
    tenantId: string;
    customerCode: string;
    excludeCustomerId?: string;
  }) {
    const existing = await this.prisma.customer.findFirst({
      where: {
        tenantId: params.tenantId,
        customerCode: params.customerCode,
        ...(params.excludeCustomerId ? { id: { not: params.excludeCustomerId } } : {}),
      } as any,
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Customer code already exists for this tenant');
    }
  }

  async list(req: Request, q: ListCustomersQueryDto) {
    const tenant = this.ensureTenant(req);

    const page = Number(q.page ?? 1);
    const pageSize = Number(q.pageSize ?? 20);
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 200) : 20;

    const status = q.status ? String(q.status) : 'ACTIVE';
    const search = String(q.search ?? '').trim();

    const where: any = {
      tenantId: tenant.id,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { customerCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);

    return {
      page: safePage,
      pageSize: safePageSize,
      total,
      items,
    };
  }

  async create(req: Request, dto: CreateCustomerDto) {
    const tenant = this.ensureTenant(req);

    const { name, email } = this.validateCustomerNameEmailOrThrow({ name: String(dto.name ?? ''), email: String(dto.email ?? '') });

    const created = await this.prisma.$transaction(async (tx) => {
      let customerCode = String(dto.customerCode ?? '').trim();
      if (customerCode) {
        const existing = await tx.customer.findFirst({
          where: { tenantId: tenant.id, customerCode } as any,
          select: { id: true },
        });
        if (existing) throw new ConflictException('Customer code already exists for this tenant');
      } else {
        for (let i = 0; i < 50; i++) {
          const next = await this.nextCustomerCode(tx, tenant.id);
          const exists = await tx.customer.findFirst({
            where: { tenantId: tenant.id, customerCode: next } as any,
            select: { id: true },
          });
          if (!exists) {
            customerCode = next;
            break;
          }
        }
        if (!customerCode) throw new ConflictException('Failed to generate unique customer code');
      }

      return tx.customer.create({
        data: {
          tenantId: tenant.id,
          customerCode,
          name,
          contactPerson: dto.contactPerson?.trim() || null,
          email,
          phone: dto.phone?.trim() || null,
          billingAddress: dto.billingAddress?.trim() || null,
          taxNumber: dto.taxNumber?.trim() || null,
          status: dto.status ? String(dto.status) : 'ACTIVE',
        } as any,
      });
    });

    return created;
  }

  async update(req: Request, id: string, dto: UpdateCustomerDto) {
    const tenant = this.ensureTenant(req);

    const existing = await this.prisma.customer.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        customerCode: true,
      } as any,
    });

    if (!existing) throw new NotFoundException('Customer not found');

    if ((dto as any).customerCode && String((dto as any).customerCode ?? '').trim() !== String(existing.customerCode ?? '').trim()) {
      throw new BadRequestException('customerCode is immutable');
    }

    const nameRaw = dto.name !== undefined ? String(dto.name ?? '') : '';
    const emailRaw = dto.email !== undefined ? String(dto.email ?? '') : '';

    const { name, email } = this.validateCustomerNameEmailOrThrow({ name: nameRaw, email: emailRaw });

    const status = dto.status !== undefined ? String(dto.status) : undefined;
    if (status !== undefined && status !== 'ACTIVE' && status !== 'INACTIVE') {
      throw new BadRequestException('Invalid status');
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        name,
        ...(status !== undefined ? { status } : {}),
        email,
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.contactPerson !== undefined ? { contactPerson: dto.contactPerson?.trim() || null } : {}),
        ...(dto.billingAddress !== undefined ? { billingAddress: dto.billingAddress?.trim() || null } : {}),
        ...(dto.taxNumber !== undefined ? { taxNumber: dto.taxNumber?.trim() || null } : {}),
      } as any,
    });
  }

  private buildImportPreviewRows(rawRows: Array<{ rowNumber: number; row: Record<string, any> }>) {
    type PreviewRow = {
      rowNumber: number;
      customerCode?: string;
      name: string;
      email: string;
      contactPerson?: string;
      phone?: string;
      billingAddress?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      errors: string[];
    };

    const preview: PreviewRow[] = [];

    for (const r of rawRows) {
      const rowNumber = r.rowNumber;
      const row = r.row ?? {};

      const name = String(row['name'] ?? row['customername'] ?? '').trim();
      const customerCode = String(row['customercode'] ?? row['code'] ?? '').trim();
      const email = String(row['email'] ?? '').trim();
      const contactPerson = String(row['contactperson'] ?? row['contact'] ?? '').trim();
      const phone = String(row['phone'] ?? '').trim();
      const billingAddress = String(row['billingaddress'] ?? row['address'] ?? '').trim();
      const statusRaw = String(row['status'] ?? '').trim().toUpperCase();
      const status = statusRaw === 'INACTIVE' ? 'INACTIVE' : statusRaw === 'ACTIVE' ? 'ACTIVE' : undefined;

      const errors: string[] = [];
      if (!name) errors.push('Customer name is required');
      if (!email) errors.push('Customer email is required');
      if (email && !this.isValidEmail(email)) errors.push('Invalid email format');
      if (statusRaw && !status) errors.push(`Invalid status '${statusRaw}'`);

      preview.push({
        rowNumber,
        customerCode: customerCode || undefined,
        name,
        email,
        contactPerson: contactPerson || undefined,
        phone: phone || undefined,
        billingAddress: billingAddress || undefined,
        status,
        errors,
      });
    }

    return preview;
  }

  async previewImport(req: Request, file?: any) {
    this.ensureTenant(req);

    if (!file) throw new BadRequestException('Missing file');
    if (!file.originalname) throw new BadRequestException('Missing file name');
    if (!file.buffer) throw new BadRequestException('Missing file buffer');

    const fileName = String(file.originalname);
    const lower = fileName.toLowerCase();
    const isXlsx = lower.endsWith('.xlsx');
    const isCsv = lower.endsWith('.csv');
    if (!isXlsx && !isCsv) {
      throw new BadRequestException('Unsupported file type. Please upload .xlsx or .csv');
    }

    const rawRows = isCsv
      ? this.parseCsvRows(file.buffer).map((r) => ({ rowNumber: r.rowNumber, row: r.row as any }))
      : await this.readXlsxRows(file.buffer);

    const preview = this.buildImportPreviewRows(rawRows);
    const invalid = preview.filter((p) => p.errors.length > 0);
    const valid = preview.filter((p) => p.errors.length === 0);

    return {
      totalRows: preview.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      rows: preview,
    };
  }

  async import(req: Request, file?: any) {
    const tenant = this.ensureTenant(req);

    if (!file) throw new BadRequestException('Missing file');
    if (!file.originalname) throw new BadRequestException('Missing file name');
    if (!file.buffer) throw new BadRequestException('Missing file buffer');

    const fileName = String(file.originalname);
    const lower = fileName.toLowerCase();
    const isXlsx = lower.endsWith('.xlsx');
    const isCsv = lower.endsWith('.csv');
    if (!isXlsx && !isCsv) {
      throw new BadRequestException('Unsupported file type. Please upload .xlsx or .csv');
    }

    type FailedRow = { rowNumber: number; reason: string };
    const failedRows: FailedRow[] = [];

    const rawRows = isCsv
      ? this.parseCsvRows(file.buffer).map((r) => ({ rowNumber: r.rowNumber, row: r.row as any }))
      : await this.readXlsxRows(file.buffer);

    if (rawRows.length === 0) {
      return {
        totalRows: 0,
        importedCount: 0,
        failedCount: 0,
        failedRows: [],
      };
    }

    const imported: string[] = [];

    for (const r of rawRows) {
      const rowNumber = r.rowNumber;
      const row = r.row ?? {};

      const name = String(row['name'] ?? row['customername'] ?? '').trim();
      const customerCodeRaw = String(row['customercode'] ?? row['code'] ?? '').trim();
      const contactPerson = String(row['contactperson'] ?? row['contact'] ?? '').trim();
      const email = String(row['email'] ?? '').trim();
      const phone = String(row['phone'] ?? '').trim();
      const billingAddress = String(row['billingaddress'] ?? row['address'] ?? '').trim();
      const taxNumber = String(row['taxnumber'] ?? '').trim();
      const statusRaw = String(row['status'] ?? '').trim().toUpperCase();
      const status = statusRaw === 'INACTIVE' ? 'INACTIVE' : statusRaw === 'ACTIVE' ? 'ACTIVE' : null;

      if (!name) {
        failedRows.push({ rowNumber, reason: 'Customer name is required' });
        continue;
      }

      if (!email) {
        failedRows.push({ rowNumber, reason: 'Customer email is required' });
        continue;
      }

      if (!this.isValidEmail(email)) {
        failedRows.push({ rowNumber, reason: 'Invalid email format' });
        continue;
      }

      if (statusRaw && !status) {
        failedRows.push({ rowNumber, reason: `Invalid status '${statusRaw}'` });
        continue;
      }

      try {
        const created = await this.prisma.$transaction(async (tx) => {
          let customerCode = customerCodeRaw;
          if (customerCode) {
            const existing = await tx.customer.findFirst({
              where: { tenantId: tenant.id, customerCode } as any,
              select: { id: true },
            });
            if (existing) throw new ConflictException('Duplicate customerCode');
          } else {
            for (let i = 0; i < 50; i++) {
              const next = await this.nextCustomerCode(tx, tenant.id);
              const exists = await tx.customer.findFirst({
                where: { tenantId: tenant.id, customerCode: next } as any,
                select: { id: true },
              });
              if (!exists) {
                customerCode = next;
                break;
              }
            }
            if (!customerCode) throw new ConflictException('Failed to generate unique customer code');
          }

          return tx.customer.create({
            data: {
              tenantId: tenant.id,
              customerCode,
              name,
              contactPerson: contactPerson || null,
              email,
              phone: phone || null,
              billingAddress: billingAddress || null,
              taxNumber: taxNumber || null,
              status: status ?? 'ACTIVE',
            } as any,
            select: { id: true },
          });
        });

        imported.push(created.id);
      } catch (e: any) {
        const msg = String(e?.message ?? 'Import failed');
        failedRows.push({ rowNumber, reason: msg });
      }
    }

    return {
      totalRows: rawRows.length,
      importedCount: imported.length,
      failedCount: failedRows.length,
      failedRows,
    };
  }

  async getCustomerImportCsvTemplate(req: Request): Promise<{ fileName: string; body: string }> {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    const headers = ['customerCode', 'name', 'email', 'contactPerson', 'phone', 'billingAddress', 'status'];
    const sample = [
      ['CUST-000001', 'Acme Trading', 'john.smith@acme.com', 'John Smith', '+1 555 0100', '123 Main St', 'ACTIVE'],
    ];

    const escape = (v: any) => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replaceAll('"', '""')}"`;
      }
      return s;
    };

    const body = [headers.join(','), ...sample.map((r) => r.map(escape).join(','))].join('\n') + '\n';
    return { fileName: 'customer_import_template.csv', body };
  }

  async getCustomerImportXlsxTemplate(req: Request): Promise<{ fileName: string; body: Buffer }> {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Customers');

    ws.addRow(['customerCode', 'name', 'email', 'contactPerson', 'phone', 'billingAddress', 'status']);
    ws.addRow(['CUST-000001', 'Acme Trading', 'john.smith@acme.com', 'John Smith', '+1 555 0100', '123 Main St', 'ACTIVE']);
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => (c.width = 22));

    const buf = await wb.xlsx.writeBuffer();
    return { fileName: 'customer_import_template.xlsx', body: Buffer.from(buf as any) };
  }
}
