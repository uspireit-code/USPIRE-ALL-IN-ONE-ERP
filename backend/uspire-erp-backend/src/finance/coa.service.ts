import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash } from 'crypto';
import ExcelJS from 'exceljs';
import { AuditEntityType, AuditEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCoaAccountDto, UpdateCoaAccountDto } from './coa.dto';

type RequestContext = Request;

@Injectable()
export class CoaService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeHeader(v: any) {
    return String(v ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
  }

  private normalizeHeaderKey(v: any) {
    return this.normalizeHeader(v).replace(/[^a-z0-9]/g, '');
  }

  private parseCsvRows(buf: Buffer): {
    headers: string[];
    rows: Array<{ rowNumber: number; row: Record<string, string> }>;
  } {
    const text = buf.toString('utf8');
    const lines = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

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
        row[headers[j]] = (cols[j] ?? '').trim();
      }
      const hasAny = Object.values(row).some(
        (v) => String(v ?? '').trim() !== '',
      );
      if (hasAny) rows.push({ rowNumber: i + 1, row });
    }
    return { headers, rows };
  }

  private async readXlsxRows(buf: Buffer, sheetName: string) {
    const wb = new ExcelJS.Workbook();
    await (wb.xlsx as any).load(buf as any);
    const ws = wb.worksheets.find(
      (s) => s.name.trim().toLowerCase() === sheetName.trim().toLowerCase(),
    );
    if (!ws)
      return {
        headers: [] as string[],
        rows: [] as Array<{ rowNumber: number; row: Record<string, any> }>,
      };

    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const v = this.normalizeHeaderKey(
        (cell.value as any)?.text ?? cell.value,
      );
      headers[colNumber - 1] = v;
    });

    const rows: Array<{ rowNumber: number; row: Record<string, any> }> = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        const cell = row.getCell(idx + 1);
        const raw = (cell.value as any)?.text ?? cell.value;
        obj[h] = raw;
      });
      const hasAny = Object.values(obj).some(
        (v) => String(v ?? '').trim() !== '',
      );
      if (hasAny) rows.push({ rowNumber: r, row: obj });
    }
    return { headers, rows };
  }

  private mapCategoryStrict(raw: string) {
    const v = String(raw ?? '')
      .trim()
      .toUpperCase();
    if (v === 'ASSET') return 'ASSET' as const;
    if (v === 'LIABILITY') return 'LIABILITY' as const;
    if (v === 'EQUITY') return 'EQUITY' as const;
    if (v === 'INCOME') return 'INCOME' as const;
    if (v === 'EXPENSE') return 'EXPENSE' as const;
    return null;
  }

  private mapNormalBalanceStrict(raw: string) {
    const v = String(raw ?? '')
      .trim()
      .toUpperCase();
    if (v === 'DEBIT') return 'DEBIT' as const;
    if (v === 'CREDIT') return 'CREDIT' as const;
    return null;
  }

  private parseBooleanStrict(raw: any) {
    const v = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (v === '') return null;
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
  }

  private computeCanonicalHash(codes: string[]) {
    const sorted = [...codes]
      .map((c) => c.trim())
      .filter(Boolean)
      .sort();
    return createHash('sha256').update(sorted.join('\n')).digest('hex');
  }

  private mapCategoryToAccountType(raw: string) {
    const v = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (v === 'assets' || v === 'asset') return 'ASSET' as const;
    if (v === 'liabilities' || v === 'liability') return 'LIABILITY' as const;
    if (v === 'equity') return 'EQUITY' as const;
    if (v === 'income' || v === 'other_income' || v === 'other income')
      return 'INCOME' as const;
    if (
      v === 'expenses' ||
      v === 'expense' ||
      v === 'other_expenses' ||
      v === 'other expenses' ||
      v === 'cost_of_sales' ||
      v === 'cost of sales'
    ) {
      return 'EXPENSE' as const;
    }
    return null;
  }

  private mapNormalBalance(raw: string) {
    const v = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (v === 'debit') return 'DEBIT' as const;
    if (v === 'credit') return 'CREDIT' as const;
    return null;
  }

  private pickField(row: Record<string, any>, keys: string[]) {
    for (const k of keys) {
      const v = row[k];
      if (v !== undefined) return v;
    }
    return undefined;
  }

  private async getTenantCoaState(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { coaFrozen: true, coaLockedAt: true },
    });
    if (!t) throw new BadRequestException('Missing tenant context');
    return { coaFrozen: Boolean(t.coaFrozen), coaLockedAt: t.coaLockedAt };
  }

  async importCanonical(req: Request, file?: any) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    if (!file) throw new BadRequestException('Missing file');
    if (!file.originalname) throw new BadRequestException('Missing file name');
    if (!file.buffer) throw new BadRequestException('Missing file buffer');

    await this.assertCoaNotFrozen(tenant.id);
    await this.assertCoaNotLocked({ tenantId: tenant.id, operation: 'create' });

    const fileName = String(file.originalname);
    const lower = fileName.toLowerCase();
    const isXlsx = lower.endsWith('.xlsx');
    const isCsv = lower.endsWith('.csv');
    if (!isXlsx && !isCsv) {
      throw new BadRequestException(
        'Unsupported file type. Please upload .xlsx or .csv',
      );
    }

    type ImportError = { row: number; column: string; message: string };
    const errors: ImportError[] = [];

    const requiredColumns = [
      'accountCode',
      'accountName',
      'category',
      'subCategory',
      'normalBalance',
      'fsMappingLevel1',
      'fsMappingLevel2',
    ] as const;
    const requiredKeys = requiredColumns.map((c) => this.normalizeHeaderKey(c));

    const rawRows: Array<{ rowNumber: number; row: Record<string, any> }> = [];
    if (isCsv) {
      const parsedCsv = this.parseCsvRows(file.buffer);
      const found = new Set<string>(parsedCsv.headers.filter(Boolean));
      for (let i = 0; i < requiredKeys.length; i++) {
        const key = requiredKeys[i];
        if (!found.has(key)) {
          errors.push({
            row: 0,
            column: requiredColumns[i],
            message: `Missing required column: ${requiredColumns[i]}`,
          });
        }
      }
      for (const r of parsedCsv.rows)
        rawRows.push({ rowNumber: r.rowNumber, row: r.row });
    } else {
      const wb = new ExcelJS.Workbook();
      await (wb.xlsx as any).load(file.buffer);

      const hasAllRequiredHeaders = (ws: ExcelJS.Worksheet) => {
        const headerRow = ws.getRow(1);
        const found = new Set<string>();
        headerRow.eachCell({ includeEmpty: true }, (cell) => {
          const k = this.normalizeHeaderKey(
            (cell.value as any)?.text ?? cell.value,
          );
          if (k) found.add(k);
        });
        return requiredKeys.every((k) => found.has(k));
      };

      const candidate = wb.worksheets.find((ws) => hasAllRequiredHeaders(ws));
      if (!candidate) {
        errors.push({
          row: 0,
          column: '',
          message:
            'No worksheet contains the required COA columns. Required columns: accountCode, accountName, category, subCategory, normalBalance, fsMappingLevel1, fsMappingLevel2',
        });
      } else {
        const headerRow = candidate.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          headers[colNumber - 1] = this.normalizeHeaderKey(
            (cell.value as any)?.text ?? cell.value,
          );
        });

        for (let r = 2; r <= candidate.rowCount; r++) {
          const row = candidate.getRow(r);
          const obj: Record<string, any> = {};
          headers.forEach((h, idx) => {
            const cell = row.getCell(idx + 1);
            const raw = (cell.value as any)?.text ?? cell.value;
            obj[h] = raw;
          });
          const hasAny = Object.values(obj).some(
            (v) => String(v ?? '').trim() !== '',
          );
          if (hasAny) rawRows.push({ rowNumber: r, row: obj });
        }
      }
    }

    if (errors.length === 0 && rawRows.length === 0) {
      errors.push({
        row: 0,
        column: '',
        message: 'The uploaded file contains no account rows.',
      });
    }

    type CanonicalRow = {
      rowNumber: number;
      accountCode: string;
      accountName: string;
      category: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
      subCategory: string;
      normalBalance: 'DEBIT' | 'CREDIT';
      fsMappingLevel1: string;
      fsMappingLevel2: string;
      parentAccountCode: string | null;
      isControlAccount: boolean;
    };

    const parsed: CanonicalRow[] = [];
    const seenCodes = new Set<string>();
    const duplicateCodes = new Set<string>();

    const parentCodesRequested = new Set<string>();

    for (const r of rawRows) {
      const row = r.row;
      const rowNumber = r.rowNumber;

      const codeRaw = this.pickField(row, ['accountcode', 'code']);
      const nameRaw = this.pickField(row, ['accountname', 'name']);
      const categoryRaw = this.pickField(row, ['category']);
      const subCategoryRaw = this.pickField(row, ['subcategory']);
      const balanceRaw = this.pickField(row, ['normalbalance', 'balance']);
      const fs1Raw = this.pickField(row, ['fsmappinglevel1', 'fs1']);
      const fs2Raw = this.pickField(row, ['fsmappinglevel2', 'fs2']);
      const parentRaw = this.pickField(row, ['parentaccountcode', 'parent']);
      const isControlRaw = this.pickField(row, ['iscontrolaccount', 'control']);

      const accountCode = String(codeRaw ?? '').trim();
      const accountName = String(nameRaw ?? '').trim();
      const category = String(categoryRaw ?? '').trim();
      const subCategory = String(subCategoryRaw ?? '').trim();
      const fsMappingLevel1 = String(fs1Raw ?? '').trim();
      const fsMappingLevel2 = String(fs2Raw ?? '').trim();
      const normalBalance = this.mapNormalBalanceStrict(
        String(balanceRaw ?? '').trim(),
      );
      const accountType = this.mapCategoryStrict(category);
      const parentAccountCode = String(parentRaw ?? '').trim() || null;
      const isControlParsed = this.parseBooleanStrict(isControlRaw);
      const isControlAccount = isControlParsed ?? false;

      if (parentAccountCode) parentCodesRequested.add(parentAccountCode);

      if (!accountCode)
        errors.push({
          row: rowNumber,
          column: 'accountCode',
          message: 'accountCode is required',
        });
      if (!accountName)
        errors.push({
          row: rowNumber,
          column: 'accountName',
          message: 'accountName is required',
        });
      if (!category)
        errors.push({
          row: rowNumber,
          column: 'category',
          message: 'category is required',
        });
      if (!accountType && category)
        errors.push({
          row: rowNumber,
          column: 'category',
          message: `Invalid value '${category}'`,
        });
      if (!subCategory)
        errors.push({
          row: rowNumber,
          column: 'subCategory',
          message: 'subCategory is required',
        });
      if (!normalBalance)
        errors.push({
          row: rowNumber,
          column: 'normalBalance',
          message: 'Must be DEBIT or CREDIT',
        });
      if (!fsMappingLevel1)
        errors.push({
          row: rowNumber,
          column: 'fsMappingLevel1',
          message: 'fsMappingLevel1 is required',
        });
      if (!fsMappingLevel2)
        errors.push({
          row: rowNumber,
          column: 'fsMappingLevel2',
          message: 'fsMappingLevel2 is required',
        });
      if (
        isControlParsed === null &&
        String(isControlRaw ?? '').trim() !== ''
      ) {
        errors.push({
          row: rowNumber,
          column: 'isControlAccount',
          message: 'Must be true or false',
        });
      }

      if (accountCode) {
        const key = accountCode.toLowerCase();
        if (seenCodes.has(key)) duplicateCodes.add(accountCode);
        seenCodes.add(key);
      }

      if (
        accountCode &&
        accountName &&
        accountType &&
        subCategory &&
        normalBalance &&
        fsMappingLevel1 &&
        fsMappingLevel2
      ) {
        parsed.push({
          rowNumber,
          accountCode,
          accountName,
          category: accountType,
          subCategory,
          normalBalance,
          fsMappingLevel1,
          fsMappingLevel2,
          parentAccountCode,
          isControlAccount,
        });
      }
    }

    for (const dup of duplicateCodes) {
      errors.push({
        row: 0,
        column: 'accountCode',
        message: `Duplicate accountCode in upload: '${dup}'`,
      });
    }

    if (errors.length === 0) {
      const existingParents = new Set<string>();
      const distinctParents = Array.from(parentCodesRequested)
        .map((c) => c.trim())
        .filter(Boolean);
      if (distinctParents.length > 0) {
        const rows = await this.prisma.account.findMany({
          where: { tenantId: tenant.id, code: { in: distinctParents } },
          select: { code: true },
        });
        for (const r of rows)
          existingParents.add(String(r.code ?? '').toLowerCase());
      }

      const seenSoFar = new Set<string>();
      for (const row of parsed) {
        const cur = row.accountCode.toLowerCase();
        if (row.parentAccountCode) {
          const parent = row.parentAccountCode.toLowerCase();
          if (!seenSoFar.has(parent) && !existingParents.has(parent)) {
            errors.push({
              row: row.rowNumber,
              column: 'parentAccountCode',
              message: `Parent accountCode '${row.parentAccountCode}' not found`,
            });
          }
        }
        seenSoFar.add(cur);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors,
      });
    }

    const canonicalCodes = parsed.map((r) => r.accountCode);
    const canonicalHash = this.computeCanonicalHash(canonicalCodes);
    const format = isCsv ? 'csv' : 'xlsx';

    const created: string[] = [];
    const updated: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const row of parsed) {
        const accountType = row.category;
        const existing = await tx.account.findFirst({
          where: { tenantId: tenant.id, code: row.accountCode },
          select: { id: true },
        });

        if (!existing) {
          const createdRow = await tx.account.create({
            data: {
              tenantId: tenant.id,
              code: row.accountCode,
              name: row.accountName,
              type: accountType,
              subCategory: row.subCategory,
              fsMappingLevel1: row.fsMappingLevel1,
              fsMappingLevel2: row.fsMappingLevel2,
              parentAccountId: null,
              isPosting: true,
              isPostingAllowed: true,
              isControlAccount: row.isControlAccount,
              normalBalance: row.normalBalance,
              isActive: true,
              createdById: user.id,
            },
            select: { id: true },
          });

          await tx.account.updateMany({
            where: { tenantId: tenant.id, id: createdRow.id },
            data: { hierarchyPath: createdRow.id },
          });

          created.push(row.accountCode);
        } else {
          await tx.account.updateMany({
            where: { tenantId: tenant.id, id: existing.id },
            data: {
              name: row.accountName,
              type: accountType,
              subCategory: row.subCategory,
              fsMappingLevel1: row.fsMappingLevel1,
              fsMappingLevel2: row.fsMappingLevel2,
              isControlAccount: row.isControlAccount,
              normalBalance: row.normalBalance,
            },
          });
          updated.push(row.accountCode);
        }
      }

      await tx.coaCanonicalSnapshot.create({
        data: {
          tenantId: tenant.id,
          uploadedById: user.id,
          fileName,
          format,
          rowCount: parsed.length,
          hash: canonicalHash,
          data: {
            accountCodes: [...new Set(canonicalCodes.map((c) => c.trim()))],
          },
        },
        select: { id: true },
      });

      await tx.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: AuditEventType.COA_IMPORTED,
            entityType: AuditEntityType.CHART_OF_ACCOUNTS,
            entityId: tenant.id,
            action: 'COA_IMPORTED',
            outcome: 'SUCCESS',
            reason: JSON.stringify({
              fileName,
              format,
              rowCount: parsed.length,
              canonicalHash,
              created: created.length,
              updated: updated.length,
            }),
            userId: user.id,
            permissionUsed: 'FINANCE_COA_UPDATE',
          },
        })
        .catch(() => undefined);
    });

    return {
      fileName,
      canonicalHash,
      rowCount: parsed.length,
      created: created.length,
      updated: updated.length,
      warnings:
        updated.length > 0
          ? [`${updated.length} accounts already existed and were updated`]
          : [],
    };
  }

  async getImportTemplate(req: Request, params: { format?: string }) {
    const format = (params.format ?? 'csv').toLowerCase();
    const headers = [
      'accountCode',
      'accountName',
      'category',
      'subCategory',
      'normalBalance',
      'fsMappingLevel1',
      'fsMappingLevel2',
    ];

    const sampleRows = [
      {
        accountCode: '1000',
        accountName: 'Cash on Hand',
        category: 'Assets',
        subCategory: 'Cash',
        normalBalance: 'Debit',
        fsMappingLevel1: 'Current Assets',
        fsMappingLevel2: 'Cash and cash equivalents',
      },
      {
        accountCode: '2000',
        accountName: 'Accounts Payable',
        category: 'Liabilities',
        subCategory: 'Payables',
        normalBalance: 'Credit',
        fsMappingLevel1: 'Current Liabilities',
        fsMappingLevel2: 'Trade and other payables',
      },
      {
        accountCode: '4000',
        accountName: 'Sales Revenue',
        category: 'Income',
        subCategory: 'Revenue',
        normalBalance: 'Credit',
        fsMappingLevel1: 'Revenue',
        fsMappingLevel2: 'Sales',
      },
    ];

    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('COA');
      ws.addRow(headers);
      for (const r of sampleRows) {
        ws.addRow(headers.map((h) => (r as any)[h] ?? ''));
      }
      const body = (await wb.xlsx.writeBuffer()) as any as Buffer;
      return {
        fileName: 'coa_import_template.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body,
      };
    }

    if (format === 'csv') {
      const escape = (v: any) => {
        const s = String(v ?? '');
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const lines = [headers.join(',')];
      for (const r of sampleRows) {
        lines.push(headers.map((h) => escape((r as any)[h])).join(','));
      }
      return {
        fileName: 'coa_import_template.csv',
        contentType: 'text/csv; charset=utf-8',
        body: lines.join('\n'),
      };
    }

    throw new BadRequestException('Unsupported format. Use csv or xlsx');
  }

  async cleanupNonCanonical(
    req: Request,
    dto: { canonicalHash?: string; dryRun?: boolean },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const dryRun = dto.dryRun ?? true;

    const snapshot = await this.prisma.coaCanonicalSnapshot.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { uploadedAt: 'desc' },
      select: { id: true, hash: true, data: true, uploadedAt: true },
    });

    if (!snapshot) {
      throw new ConflictException({
        code: 'COA_CANONICAL_NOT_UPLOADED',
        message: 'Canonical COA snapshot not uploaded for this tenant',
      });
    }

    const canonicalCodes: string[] = Array.isArray(
      (snapshot.data as any)?.accountCodes,
    )
      ? ((snapshot.data as any).accountCodes as string[])
      : [];

    const canonicalSet = new Set(
      canonicalCodes.map((c) => String(c ?? '').trim()),
    );

    const candidates = await this.prisma.account.findMany({
      where: { tenantId: tenant.id, code: { notIn: Array.from(canonicalSet) } },
      select: { id: true, code: true, name: true, isControlAccount: true },
    });

    const blockedById = new Map<string, Set<string>>();
    const addBlocked = (accountId: string, reason: string) => {
      const set = blockedById.get(accountId) ?? new Set<string>();
      set.add(reason);
      blockedById.set(accountId, set);
    };

    for (const c of candidates) {
      if (c.isControlAccount) addBlocked(c.id, 'CONTROL_ACCOUNT');
    }

    const candidateIds = candidates.map((c) => c.id);
    if (candidateIds.length === 0) {
      return {
        canonicalHash: snapshot.hash ?? null,
        dryRun,
        wouldDeleteCount: 0,
        wouldDelete: [],
        blocked: [],
      };
    }

    const childRefs = await this.prisma.account.findMany({
      where: { tenantId: tenant.id, parentAccountId: { in: candidateIds } },
      select: { parentAccountId: true },
    });
    for (const r of childRefs) {
      if (r.parentAccountId)
        addBlocked(r.parentAccountId, 'HAS_CHILD_ACCOUNTS');
    }

    const [
      journalRefs,
      budgetRefs,
      forecastRefs,
      supplierRefs,
      customerRefs,
      recurringRefs,
      bankRefs,
      taxRefs,
      faCatRefs,
      faRefs,
    ] = await this.prisma.$transaction([
      this.prisma.journalLine.findMany({
        where: {
          accountId: { in: candidateIds },
          journalEntry: { tenantId: tenant.id },
        },
        select: { accountId: true },
      }),
      this.prisma.budgetLine.findMany({
        where: { accountId: { in: candidateIds }, tenantId: tenant.id },
        select: { accountId: true },
      }),
      this.prisma.forecastLine.findMany({
        where: {
          accountId: { in: candidateIds },
          version: { forecast: { tenantId: tenant.id } },
        },
        select: { accountId: true },
      }),
      this.prisma.supplierInvoiceLine.findMany({
        where: {
          accountId: { in: candidateIds },
          supplierInvoice: { tenantId: tenant.id },
        },
        select: { accountId: true },
      }),
      this.prisma.customerInvoiceLine.findMany({
        where: {
          accountId: { in: candidateIds },
          customerInvoice: { tenantId: tenant.id },
        },
        select: { accountId: true },
      }),
      this.prisma.recurringJournalTemplateLine.findMany({
        where: {
          accountId: { in: candidateIds },
          template: { tenantId: tenant.id },
        },
        select: { accountId: true },
      }),
      this.prisma.bankAccount.findMany({
        where: { tenantId: tenant.id, glAccountId: { in: candidateIds } },
        select: { glAccountId: true },
      }),
      this.prisma.taxRate.findMany({
        where: { tenantId: tenant.id, glAccountId: { in: candidateIds } },
        select: { glAccountId: true },
      }),
      this.prisma.fixedAssetCategory.findMany({
        where: {
          tenantId: tenant.id,
          OR: [
            { assetAccountId: { in: candidateIds } },
            { accumDepAccountId: { in: candidateIds } },
            { depExpenseAccountId: { in: candidateIds } },
          ],
        },
        select: {
          assetAccountId: true,
          accumDepAccountId: true,
          depExpenseAccountId: true,
        },
      }),
      this.prisma.fixedAsset.findMany({
        where: {
          tenantId: tenant.id,
          OR: [
            { assetAccountId: { in: candidateIds } },
            { accumDepAccountId: { in: candidateIds } },
            { depExpenseAccountId: { in: candidateIds } },
          ],
        },
        select: {
          assetAccountId: true,
          accumDepAccountId: true,
          depExpenseAccountId: true,
        },
      }),
    ]);

    for (const r of journalRefs) addBlocked(r.accountId, 'JournalLine');
    for (const r of budgetRefs) addBlocked(r.accountId, 'BudgetLine');
    for (const r of forecastRefs) addBlocked(r.accountId, 'ForecastLine');
    for (const r of supplierRefs)
      addBlocked(r.accountId, 'SupplierInvoiceLine');
    for (const r of customerRefs)
      addBlocked(r.accountId, 'CustomerInvoiceLine');
    for (const r of recurringRefs)
      addBlocked(r.accountId, 'RecurringJournalTemplateLine');
    for (const r of bankRefs) addBlocked(r.glAccountId, 'BankAccount');
    for (const r of taxRefs) {
      if (r.glAccountId) addBlocked(r.glAccountId, 'TaxRate');
    }
    for (const r of faCatRefs) {
      addBlocked(r.assetAccountId, 'FixedAssetCategory');
      addBlocked(r.accumDepAccountId, 'FixedAssetCategory');
      addBlocked(r.depExpenseAccountId, 'FixedAssetCategory');
    }
    for (const r of faRefs) {
      if (r.assetAccountId) addBlocked(r.assetAccountId, 'FixedAsset');
      if (r.accumDepAccountId) addBlocked(r.accumDepAccountId, 'FixedAsset');
      if (r.depExpenseAccountId)
        addBlocked(r.depExpenseAccountId, 'FixedAsset');
    }

    const wouldDelete = [] as Array<{
      accountCode: string;
      name: string;
      reason: string;
    }>;
    const blocked = [] as Array<{
      accountCode: string;
      name: string;
      referencedBy: string[];
    }>;

    const deletableIds: string[] = [];
    for (const c of candidates) {
      const reasons = Array.from(blockedById.get(c.id) ?? []);
      if (reasons.length > 0) {
        blocked.push({
          accountCode: c.code,
          name: c.name,
          referencedBy: reasons,
        });
        continue;
      }
      deletableIds.push(c.id);
      wouldDelete.push({
        accountCode: c.code,
        name: c.name,
        reason: 'NON_CANONICAL_UNUSED',
      });
    }

    if (dryRun) {
      return {
        canonicalHash: snapshot.hash ?? null,
        dryRun,
        wouldDeleteCount: deletableIds.length,
        wouldDelete,
        blocked,
      };
    }

    const deleted = await this.prisma.account.deleteMany({
      where: { tenantId: tenant.id, id: { in: deletableIds } },
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: AuditEventType.COA_CLEANUP_EXECUTED,
          entityType: AuditEntityType.CHART_OF_ACCOUNTS,
          entityId: tenant.id,
          action: 'COA_CLEANUP_EXECUTED',
          outcome: 'SUCCESS',
          reason: JSON.stringify({
            canonicalHash: dto.canonicalHash ?? snapshot.hash ?? null,
            snapshotHash: snapshot.hash ?? null,
            deleted: deleted.count,
            blockedCount: blocked.length,
          }),
          userId: user.id,
          permissionUsed: 'FINANCE_COA_UPDATE',
        },
      })
      .catch(() => undefined);

    return {
      canonicalHash: snapshot.hash ?? null,
      dryRun,
      deletedCount: deleted.count,
      blockedCount: blocked.length,
      blocked,
    };
  }

  private async assertCoaNotFrozen(tenantId: string) {
    const { coaFrozen } = await this.getTenantCoaState(tenantId);
    if (coaFrozen) throw new ForbiddenException('Chart of Accounts is frozen');
  }

  private async assertCoaNotLocked(params: {
    tenantId: string;
    operation: 'create' | 'update_code' | 'update_hierarchy';
  }) {
    const { coaLockedAt } = await this.getTenantCoaState(params.tenantId);
    if (!coaLockedAt) return;
    if (params.operation === 'create') {
      throw new ForbiddenException(
        'Chart of Accounts is locked: cannot create accounts',
      );
    }
    if (params.operation === 'update_code') {
      throw new ForbiddenException(
        'Chart of Accounts is locked: cannot edit account codes',
      );
    }
    if (params.operation === 'update_hierarchy') {
      throw new ForbiddenException(
        'Chart of Accounts is locked: cannot edit account hierarchy',
      );
    }
  }

  private async assertParentValid(params: {
    tenantId: string;
    parentAccountId: string;
  }) {
    const parent = await this.prisma.account.findFirst({
      where: { tenantId: params.tenantId, id: params.parentAccountId },
      select: { id: true, isPosting: true },
    });
    if (!parent) throw new BadRequestException('Parent account not found');
    if (parent.isPosting) {
      throw new BadRequestException(
        'Parent account cannot be a posting account',
      );
    }
  }

  private async assertCannotDeactivateUsedInPostedJournals(params: {
    tenantId: string;
    accountId: string;
  }) {
    const used = await this.prisma.journalLine.findFirst({
      where: {
        accountId: params.accountId,
        journalEntry: { tenantId: params.tenantId, status: 'POSTED' },
      },
      select: { id: true },
    });
    if (used) {
      throw new BadRequestException(
        'Cannot deactivate an account used in posted journals',
      );
    }
  }

  private async assertControlAccountMayDeactivate(params: {
    tenantId: string;
    accountId: string;
  }) {
    const [supplierLine, customerLine, bankAccount] =
      await this.prisma.$transaction([
        this.prisma.supplierInvoiceLine.findFirst({
          where: {
            accountId: params.accountId,
            supplierInvoice: { tenantId: params.tenantId },
          },
          select: { id: true },
        }),
        this.prisma.customerInvoiceLine.findFirst({
          where: {
            accountId: params.accountId,
            customerInvoice: { tenantId: params.tenantId },
          },
          select: { id: true },
        }),
        this.prisma.bankAccount.findFirst({
          where: { glAccountId: params.accountId, tenantId: params.tenantId },
          select: { id: true },
        }),
      ]);

    if (supplierLine || customerLine || bankAccount) {
      throw new BadRequestException(
        'Control accounts linked to subledgers cannot be disabled',
      );
    }
  }

  private async assertNoChildren(params: {
    tenantId: string;
    accountId: string;
  }) {
    const child = await this.prisma.account.findFirst({
      where: { tenantId: params.tenantId, parentAccountId: params.accountId },
      select: { id: true },
    });
    if (child)
      throw new BadRequestException(
        'Posting accounts cannot have child accounts',
      );
  }

  private async computeHierarchyPath(params: {
    tenantId: string;
    accountId: string;
    parentAccountId: string | null;
  }) {
    if (!params.parentAccountId) return params.accountId;
    const parent = await this.prisma.account.findFirst({
      where: { tenantId: params.tenantId, id: params.parentAccountId },
      select: { hierarchyPath: true },
    });
    if (!parent) throw new BadRequestException('Parent account not found');
    const prefix = parent.hierarchyPath?.trim() || params.parentAccountId;
    return `${prefix}/${params.accountId}`;
  }

  private async rebuildHierarchyPaths(params: {
    tenantId: string;
    rootAccountId: string;
    newRootPath: string;
  }) {
    const rows = await this.prisma.account.findMany({
      where: { tenantId: params.tenantId },
      select: { id: true, parentAccountId: true, hierarchyPath: true },
    });

    const childrenById = new Map<string, string[]>();
    const nodeById = new Map<
      string,
      { parentAccountId: string | null; hierarchyPath: string | null }
    >();

    for (const r of rows) {
      nodeById.set(r.id, {
        parentAccountId: r.parentAccountId ?? null,
        hierarchyPath: r.hierarchyPath ?? null,
      });
      if (r.parentAccountId) {
        const list = childrenById.get(r.parentAccountId) ?? [];
        list.push(r.id);
        childrenById.set(r.parentAccountId, list);
      }
    }

    const updates: Array<{ id: string; hierarchyPath: string }> = [];
    const walk = (id: string, path: string) => {
      updates.push({ id, hierarchyPath: path });
      const kids = childrenById.get(id) ?? [];
      for (const c of kids) walk(c, `${path}/${c}`);
    };

    walk(params.rootAccountId, params.newRootPath);

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.account.updateMany({
          where: { tenantId: params.tenantId, id: u.id },
          data: { hierarchyPath: u.hierarchyPath },
        }),
      ),
    );
  }

  private async assertNoCircularReference(params: {
    tenantId: string;
    accountId: string;
    parentAccountId: string;
  }) {
    if (params.parentAccountId === params.accountId) {
      throw new BadRequestException('Account cannot be its own parent');
    }

    let cursor: string | null = params.parentAccountId;
    const seen = new Set<string>();

    while (cursor) {
      if (seen.has(cursor)) {
        throw new BadRequestException('Circular account hierarchy detected');
      }
      seen.add(cursor);
      if (cursor === params.accountId) {
        throw new BadRequestException('Circular account hierarchy detected');
      }

      const next = await this.prisma.account.findFirst({
        where: { tenantId: params.tenantId, id: cursor },
        select: { parentAccountId: true },
      });
      if (!next) {
        throw new BadRequestException('Parent account not found');
      }
      cursor = next.parentAccountId;
    }
  }

  async list(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const [accounts, t] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where: { tenantId: tenant.id },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          tenantId: true,
          code: true,
          name: true,
          type: true,
          parentAccountId: true,
          isPosting: true,
          isPostingAllowed: true,
          isControlAccount: true,
          normalBalance: true,
          hierarchyPath: true,
          isActive: true,
          isFrozen: true,
          ifrsMappingCode: true,
          isBudgetRelevant: true,
          budgetControlMode: true,
          createdAt: true,
          createdById: true,
          updatedAt: true,
        },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: { coaFrozen: true, coaLockedAt: true },
      }),
    ]);

    return {
      coaFrozen: Boolean(t?.coaFrozen),
      coaLockedAt: t?.coaLockedAt ?? null,
      accounts,
    };
  }

  async tree(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const [rows, t] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where: { tenantId: tenant.id },
        orderBy: [{ hierarchyPath: 'asc' }, { code: 'asc' }],
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          subCategory: true,
          fsMappingLevel1: true,
          fsMappingLevel2: true,
          parentAccountId: true,
          isPosting: true,
          isPostingAllowed: true,
          isControlAccount: true,
          normalBalance: true,
          hierarchyPath: true,
          isActive: true,
          isBudgetRelevant: true,
          budgetControlMode: true,
        },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: { coaFrozen: true, coaLockedAt: true },
      }),
    ]);

    const nodeById = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        type: string;
        parentAccountId: string | null;
        isPosting: boolean;
        isActive: boolean;
        children: any[];
      }
    >();

    for (const r of rows) {
      nodeById.set(r.id, {
        ...r,
        parentAccountId: r.parentAccountId ?? null,
        children: [],
      });
    }

    const roots: any[] = [];
    for (const n of nodeById.values()) {
      if (n.parentAccountId && nodeById.has(n.parentAccountId)) {
        nodeById.get(n.parentAccountId)!.children.push(n);
      } else {
        roots.push(n);
      }
    }

    return {
      coaFrozen: Boolean(t?.coaFrozen),
      coaLockedAt: t?.coaLockedAt ?? null,
      tree: roots,
    };
  }

  async create(req: Request, dto: CreateCoaAccountDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    await this.assertCoaNotFrozen(tenant.id);
    await this.assertCoaNotLocked({ tenantId: tenant.id, operation: 'create' });

    const parentAccountId = dto.parentAccountId ?? null;
    if (parentAccountId) {
      await this.assertParentValid({ tenantId: tenant.id, parentAccountId });
    }

    const isPosting = dto.isPostingAllowed ?? dto.isPosting ?? true;

    const created = await this.prisma.account.create({
      data: {
        tenantId: tenant.id,
        code: dto.code,
        name: dto.name,
        type: dto.accountType,
        subCategory: dto.subCategory,
        fsMappingLevel1: dto.fsMappingLevel1,
        fsMappingLevel2: dto.fsMappingLevel2,
        parentAccountId,
        isPosting,
        isPostingAllowed: isPosting,
        isControlAccount: dto.isControlAccount ?? false,
        normalBalance: (dto.normalBalance as any) ?? 'DEBIT',
        isActive: dto.isActive ?? true,
        isBudgetRelevant: dto.isBudgetRelevant,
        budgetControlMode: (dto.budgetControlMode as any) ?? undefined,
        createdById: user.id,
      },
      select: { id: true },
    });

    const hierarchyPath = await this.computeHierarchyPath({
      tenantId: tenant.id,
      accountId: created.id,
      parentAccountId,
    });
    await this.prisma.account.updateMany({
      where: { tenantId: tenant.id, id: created.id },
      data: { hierarchyPath },
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'COA_CREATE',
          entityType: 'ACCOUNT',
          entityId: created.id,
          action: 'COA_CREATE',
          outcome: 'SUCCESS',
          reason: JSON.stringify({
            code: dto.code,
            name: dto.name,
            accountType: dto.accountType,
          }),
          userId: user.id,
          permissionUsed: 'FINANCE_COA_UPDATE',
        },
      })
      .catch(() => undefined);

    return this.get(req, created.id);
  }

  public async setupTaxControlAccounts(req: RequestContext) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    await this.assertCoaNotFrozen(tenant.id);
    await this.assertCoaNotLocked({ tenantId: tenant.id, operation: 'create' });

    const specs = [
      {
        ifrsMappingCode: 'TAX:VAT_OUTPUT',
        code: 'TAX:VAT_OUTPUT',
        name: 'VAT Output Control',
        type: 'LIABILITY' as const,
        normalBalance: 'CREDIT' as const,
      },
      {
        ifrsMappingCode: 'TAX:VAT_INPUT',
        code: 'TAX:VAT_INPUT',
        name: 'VAT Input Control',
        type: 'ASSET' as const,
        normalBalance: 'DEBIT' as const,
      },
      {
        ifrsMappingCode: 'TAX:PAYE_PAYABLE',
        code: 'TAX:PAYE_PAYABLE',
        name: 'PAYE Payable Control',
        type: 'LIABILITY' as const,
        normalBalance: 'CREDIT' as const,
      },
      {
        ifrsMappingCode: 'TAX:WHT_PAYABLE',
        code: 'TAX:WHT_PAYABLE',
        name: 'Withholding Tax Payable Control',
        type: 'LIABILITY' as const,
        normalBalance: 'CREDIT' as const,
      },
    ];

    const createdAccountIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const spec of specs) {
        const existingByMapping = await tx.account.findFirst({
          where: { tenantId: tenant.id, ifrsMappingCode: spec.ifrsMappingCode },
          select: { id: true },
        });

        if (existingByMapping) continue;

        const existingByCode = await tx.account.findFirst({
          where: { tenantId: tenant.id, code: spec.code },
          select: { id: true, ifrsMappingCode: true },
        });

        if (existingByCode) {
          throw new BadRequestException(
            `Cannot create tax control account ${spec.ifrsMappingCode}: account code '${spec.code}' already exists with ifrsMappingCode '${existingByCode.ifrsMappingCode ?? ''}'`,
          );
        }

        const created = await tx.account.create({
          data: {
            tenantId: tenant.id,
            code: spec.code,
            name: spec.name,
            type: spec.type,
            parentAccountId: null,
            isPosting: true,
            isPostingAllowed: true,
            isControlAccount: true,
            normalBalance: spec.normalBalance,
            isActive: true,
            ifrsMappingCode: spec.ifrsMappingCode,
            createdById: user.id,
          },
          select: { id: true },
        });

        const hierarchyPath = await this.computeHierarchyPath({
          tenantId: tenant.id,
          accountId: created.id,
          parentAccountId: null,
        });

        await tx.account.updateMany({
          where: { tenantId: tenant.id, id: created.id },
          data: { hierarchyPath },
        });

        await tx.auditEvent
          .create({
            data: {
              tenantId: tenant.id,
              eventType: 'COA_CREATE',
              entityType: 'ACCOUNT',
              entityId: created.id,
              action: 'COA_CREATE',
              outcome: 'SUCCESS',
              reason: 'COA_CREATE_TAX_CONTROL',
              userId: user.id,
              permissionUsed: 'FINANCE_COA_UPDATE',
            },
          })
          .catch(() => undefined);

        createdAccountIds.push(created.id);
      }
    });

    return { createdCount: createdAccountIds.length, createdAccountIds };
  }

  async get(req: Request, id: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const account = await this.prisma.account.findFirst({
      where: { tenantId: tenant.id, id },
      select: {
        id: true,
        tenantId: true,
        code: true,
        name: true,
        type: true,
        subCategory: true,
        fsMappingLevel1: true,
        fsMappingLevel2: true,
        parentAccountId: true,
        isPosting: true,
        isPostingAllowed: true,
        isControlAccount: true,
        normalBalance: true,
        hierarchyPath: true,
        isActive: true,
        isFrozen: true,
        ifrsMappingCode: true,
        isBudgetRelevant: true,
        budgetControlMode: true,
        createdAt: true,
        createdById: true,
        updatedAt: true,
      },
    });

    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async update(req: Request, id: string, dto: UpdateCoaAccountDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    await this.assertCoaNotFrozen(tenant.id);

    const existing = await this.prisma.account.findFirst({
      where: { tenantId: tenant.id, id },
      select: {
        id: true,
        code: true,
        isActive: true,
        parentAccountId: true,
        isPosting: true,
        isPostingAllowed: true,
        isControlAccount: true,
        hierarchyPath: true,
        ifrsMappingCode: true,
      },
    });
    if (!existing) throw new NotFoundException('Account not found');

    const canEditBudgetFlags = await this.prisma.userRole
      .findFirst({
        where: {
          userId: user.id,
          role: {
            tenantId: tenant.id,
            name: { in: ['ADMIN', 'FINANCE_CONTROLLER'] },
          },
        },
        select: { roleId: true },
      })
      .then(Boolean);

    const budgetFlagPatch = canEditBudgetFlags
      ? {
          isBudgetRelevant: dto.isBudgetRelevant,
          budgetControlMode: (dto.budgetControlMode as any) ?? undefined,
        }
      : {};

    if (dto.code !== undefined && dto.code !== existing.code) {
      await this.assertCoaNotLocked({
        tenantId: tenant.id,
        operation: 'update_code',
      });
    }

    if (
      dto.ifrsMappingCode !== undefined &&
      String(dto.ifrsMappingCode ?? '') !==
        String(existing.ifrsMappingCode ?? '')
    ) {
      await this.assertCoaNotLocked({
        tenantId: tenant.id,
        operation: 'update_code',
      });
    }

    const parentAccountId = dto.parentAccountId ?? undefined;

    if (parentAccountId !== undefined) {
      if (parentAccountId !== (existing.parentAccountId ?? null)) {
        await this.assertCoaNotLocked({
          tenantId: tenant.id,
          operation: 'update_hierarchy',
        });
      }
      if (parentAccountId) {
        await this.assertParentValid({ tenantId: tenant.id, parentAccountId });
        await this.assertNoCircularReference({
          tenantId: tenant.id,
          accountId: id,
          parentAccountId,
        });
      }
    }

    const requestedPosting = dto.isPostingAllowed ?? dto.isPosting;
    const nextIsPosting = requestedPosting ?? existing.isPosting;
    if (nextIsPosting) {
      await this.assertNoChildren({ tenantId: tenant.id, accountId: id });
    }

    if (dto.isActive === false && existing.isActive === true) {
      await this.assertCannotDeactivateUsedInPostedJournals({
        tenantId: tenant.id,
        accountId: id,
      });
      const isControl = dto.isControlAccount ?? existing.isControlAccount;
      if (isControl) {
        await this.assertControlAccountMayDeactivate({
          tenantId: tenant.id,
          accountId: id,
        });
      }
    }

    const oldParent = existing.parentAccountId ?? null;
    const newParent =
      parentAccountId === undefined ? oldParent : parentAccountId;
    const hierarchyChanged = newParent !== oldParent;

    const postingPatch =
      requestedPosting === undefined
        ? {}
        : {
            isPosting: requestedPosting,
            isPostingAllowed: requestedPosting,
          };

    const res = await this.prisma.account.updateMany({
      where: { id, tenantId: tenant.id },
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.accountType,
        subCategory: dto.subCategory,
        fsMappingLevel1: dto.fsMappingLevel1,
        fsMappingLevel2: dto.fsMappingLevel2,
        parentAccountId:
          parentAccountId === undefined ? undefined : parentAccountId,
        ...postingPatch,
        isControlAccount: dto.isControlAccount,
        normalBalance: (dto.normalBalance as any) ?? undefined,
        isActive: dto.isActive,
        ifrsMappingCode: dto.ifrsMappingCode,
        ...budgetFlagPatch,
      },
    });

    if (res.count !== 1) {
      throw new NotFoundException('Account not found');
    }

    const updated = await this.prisma.account.findFirst({
      where: { tenantId: tenant.id, id },
      select: { id: true, isActive: true, parentAccountId: true },
    });

    if (!updated) {
      throw new NotFoundException('Account not found');
    }

    const isDeactivate =
      dto.isActive === false &&
      existing.isActive === true &&
      updated.isActive === false;

    if (hierarchyChanged) {
      const newPath = await this.computeHierarchyPath({
        tenantId: tenant.id,
        accountId: id,
        parentAccountId: updated.parentAccountId ?? null,
      });
      await this.rebuildHierarchyPaths({
        tenantId: tenant.id,
        rootAccountId: id,
        newRootPath: newPath,
      });
    }

    const mappingChanged =
      dto.ifrsMappingCode !== undefined &&
      String(dto.ifrsMappingCode ?? '') !==
        String(existing.ifrsMappingCode ?? '');

    if (mappingChanged) {
      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'COA_UPDATE',
            entityType: 'ACCOUNT',
            entityId: updated.id,
            action: 'COA_IFRS_MAPPING_CHANGE',
            outcome: 'SUCCESS',
            reason: JSON.stringify({
              old: existing.ifrsMappingCode ?? null,
              next: dto.ifrsMappingCode ?? null,
            }),
            userId: user.id,
            permissionUsed: 'FINANCE_COA_UPDATE',
          },
        })
        .catch(() => undefined);
    }

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: hierarchyChanged
            ? 'COA_HIERARCHY_CHANGE'
            : isDeactivate
              ? 'COA_DEACTIVATE'
              : 'COA_UPDATE',
          entityType: 'ACCOUNT',
          entityId: updated.id,
          action: hierarchyChanged
            ? 'COA_HIERARCHY_CHANGE'
            : isDeactivate
              ? 'COA_DEACTIVATE'
              : 'COA_UPDATE',
          outcome: 'SUCCESS',
          userId: user.id,
          permissionUsed: 'FINANCE_COA_UPDATE',
        },
      })
      .catch(() => undefined);

    return this.get(req, updated.id);
  }

  async freeze(req: Request) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { coaFrozen: true },
      select: { id: true, coaFrozen: true },
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'COA_FREEZE',
          entityType: 'TENANT',
          entityId: updated.id,
          action: 'COA_FREEZE',
          outcome: 'SUCCESS',
          userId: user.id,
          permissionUsed: 'coa.freeze',
        },
      })
      .catch(() => undefined);

    return updated;
  }

  async unfreeze(req: Request) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { coaFrozen: false },
      select: { id: true, coaFrozen: true },
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'COA_UNFREEZE',
          entityType: 'TENANT',
          entityId: updated.id,
          action: 'COA_UNFREEZE',
          outcome: 'SUCCESS',
          userId: user.id,
          permissionUsed: 'coa.freeze',
        },
      })
      .catch(() => undefined);

    return updated;
  }

  async lock(req: Request) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { coaLockedAt: new Date() },
      select: { id: true, coaLockedAt: true },
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'COA_LOCKED',
          entityType: 'TENANT',
          entityId: updated.id,
          action: 'COA_LOCKED',
          outcome: 'SUCCESS',
          userId: user.id,
          permissionUsed: 'coa.freeze',
        },
      })
      .catch(() => undefined);

    return updated;
  }

  async unlock(req: Request) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { coaLockedAt: null },
      select: { id: true, coaLockedAt: true },
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'COA_UNLOCKED',
          entityType: 'TENANT',
          entityId: updated.id,
          action: 'COA_UNLOCKED',
          outcome: 'SUCCESS',
          userId: user.id,
          permissionUsed: 'coa.freeze',
        },
      })
      .catch(() => undefined);

    return updated;
  }
}
