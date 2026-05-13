import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotImplementedException,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash, randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import {
  AuditEntityType,
  AuditEventType,
  COAApprovalRequestType,
  CoaImportBatchStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { CoaRootCategoriesService } from './coa-root-categories.service';
import { CreateCoaAccountDto, UpdateCoaAccountDto } from './coa.dto';
import { CoaNamingPolicyService } from './coa-naming-policy.service';
import { CoaStructuralResolverService } from './coa-structural-resolver.service';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { buildGovernanceAuditMetadata } from '../governance/governance-enforcement';

type RequestContext = Request;

@Injectable()
export class CoaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly namingPolicy: CoaNamingPolicyService,
    private readonly rootCategories: CoaRootCategoriesService,
    private readonly structuralResolver: CoaStructuralResolverService,
    private readonly notifications: NotificationService,
  ) {}

  async getIndustryImportTemplate(
    req: Request,
    params: { industry: string; format?: string },
  ) {
    void params.industry;
    return this.getImportTemplate(req, { format: params.format });
  }

  async validateImport(req: Request, file?: any) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');
    if (!file) throw new BadRequestException('Missing file');
    if (!file.originalname) throw new BadRequestException('Missing file name');
    if (!file.buffer) throw new BadRequestException('Missing file buffer');

    const fileName = String(file.originalname);
    const lower = fileName.toLowerCase();
    const isXlsx = lower.endsWith('.xlsx');
    const isCsv = lower.endsWith('.csv');
    if (!isXlsx && !isCsv) {
      throw new BadRequestException(
        'Unsupported file type. Please upload .xlsx or .csv',
      );
    }

    type ImportRow = {
      rowNumber: number;
      accountCode: string;
      accountName: string;
      parentCode?: string | null;
      accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
      normalBalance: 'DEBIT' | 'CREDIT';
      ifrsCode?: string | null;
      fsMappingLevel1?: string | null;
      fsMappingLevel2?: string | null;
      status: 'VALID' | 'ERROR';
      message?: string | null;
    };

    type ImportError = { row: number; column: string; message: string };
    const errors: ImportError[] = [];
    const rows: ImportRow[] = [];

    if (isCsv) {
      const parsed = this.parseCsvRows(file.buffer);
      for (const r of parsed.rows) {
        const code = String(this.pickField(r.row, ['accountcode', 'code']) ?? '').trim();
        const name = String(this.pickField(r.row, ['accountname', 'name']) ?? '').trim();
        const parentCode =
          String(this.pickField(r.row, ['parentcode', 'parent', 'parentaccountcode']) ?? '').trim() ||
          null;
        const accountType = this.mapCategoryStrict(
          String(this.pickField(r.row, ['accounttype', 'type']) ?? '').trim(),
        );
        const normalBalance = this.mapNormalBalanceStrict(
          String(this.pickField(r.row, ['normalbalance', 'balance']) ?? '').trim(),
        );
        const ifrsCode =
          String(this.pickField(r.row, ['ifrscode', 'ifrs']) ?? '').trim() || null;
        const fsMappingLevel1 =
          String(this.pickField(r.row, ['fsmappinglevel1', 'fslevel1']) ?? '').trim() || null;
        const fsMappingLevel2 =
          String(this.pickField(r.row, ['fsmappinglevel2', 'fslevel2']) ?? '').trim() || null;

        let status: 'VALID' | 'ERROR' = 'VALID';
        const msgs: string[] = [];
        if (!code) {
          status = 'ERROR';
          msgs.push('accountCode is required');
        }
        if (!name) {
          status = 'ERROR';
          msgs.push('accountName is required');
        }
        if (!accountType) {
          status = 'ERROR';
          msgs.push('accountType is required');
        }
        if (!normalBalance) {
          status = 'ERROR';
          msgs.push('normalBalance must be DEBIT or CREDIT');
        }
        if (!parentCode) {
          status = 'ERROR';
          msgs.push('parentCode is required');
        }
        if (!fsMappingLevel1) {
          status = 'ERROR';
          msgs.push('fsMappingLevel1 is required');
        }

        rows.push({
          rowNumber: r.rowNumber,
          accountCode: code,
          accountName: name,
          parentCode,
          accountType: (accountType ?? 'ASSET') as any,
          normalBalance: (normalBalance ?? 'DEBIT') as any,
          ifrsCode,
          fsMappingLevel1,
          fsMappingLevel2,
          status,
          message: msgs.length > 0 ? msgs.join('; ') : null,
        });
      }
    } else {
      const wb = new ExcelJS.Workbook();
      await (wb.xlsx as any).load(file.buffer);
      const ws = wb.worksheets[0];
      if (!ws) throw new BadRequestException('No worksheet found');

      const headerRow = ws.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = this.normalizeHeaderKey(
          (cell.value as any)?.text ?? cell.value,
        );
      });

      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const obj: Record<string, any> = {};
        headers.forEach((h, idx) => {
          const cell = row.getCell(idx + 1);
          const raw = (cell.value as any)?.text ?? cell.value;
          obj[h] = raw;
        });
        const hasAny = Object.values(obj).some((v) => String(v ?? '').trim() !== '');
        if (!hasAny) continue;

        const code = String(this.pickField(obj, ['accountcode', 'code']) ?? '').trim();
        const name = String(this.pickField(obj, ['accountname', 'name']) ?? '').trim();
        const parentCode =
          String(this.pickField(obj, ['parentcode', 'parent', 'parentaccountcode']) ?? '').trim() ||
          null;
        const accountType = this.mapCategoryStrict(
          String(this.pickField(obj, ['accounttype', 'type']) ?? '').trim(),
        );
        const normalBalance = this.mapNormalBalanceStrict(
          String(this.pickField(obj, ['normalbalance', 'balance']) ?? '').trim(),
        );
        const ifrsCode =
          String(this.pickField(obj, ['ifrscode', 'ifrs']) ?? '').trim() || null;
        const fsMappingLevel1 =
          String(this.pickField(obj, ['fsmappinglevel1', 'fslevel1']) ?? '').trim() || null;
        const fsMappingLevel2 =
          String(this.pickField(obj, ['fsmappinglevel2', 'fslevel2']) ?? '').trim() || null;

        let status: 'VALID' | 'ERROR' = 'VALID';
        const msgs: string[] = [];
        if (!code) {
          status = 'ERROR';
          msgs.push('accountCode is required');
        }
        if (!name) {
          status = 'ERROR';
          msgs.push('accountName is required');
        }
        if (!accountType) {
          status = 'ERROR';
          msgs.push('accountType is required');
        }
        if (!normalBalance) {
          status = 'ERROR';
          msgs.push('normalBalance must be DEBIT or CREDIT');
        }
        if (!parentCode) {
          status = 'ERROR';
          msgs.push('parentCode is required');
        }

        rows.push({
          rowNumber: r,
          accountCode: code,
          accountName: name,
          parentCode,
          accountType: (accountType ?? 'ASSET') as any,
          normalBalance: (normalBalance ?? 'DEBIT') as any,
          ifrsCode,
          fsMappingLevel1,
          fsMappingLevel2,
          status,
          message: msgs.length > 0 ? msgs.join('; ') : null,
        });
      }
    }

    const normalizedCode = (v: any) => String(v ?? '').trim().toLowerCase();
    const importedRowCodes = Array.from(
      new Set(rows.map((r) => String(r.accountCode ?? '').trim()).filter(Boolean)),
    );
    if (importedRowCodes.length > 0) {
      const existingCodes = await this.prisma.account.findMany({
        where: {
          tenantId: tenant.id,
          code: { in: importedRowCodes },
        },
        select: { code: true },
      });

      const existingSet = new Set(
        (existingCodes ?? []).map((a) => normalizedCode((a as any).code)),
      );

      for (const r of rows) {
        const codeKey = normalizedCode((r as any).accountCode);
        if (!codeKey) continue;
        if (!existingSet.has(codeKey)) continue;

        r.status = 'ERROR';
        const prevMsg = String((r as any).message ?? '').trim();
        const duplicateMsg = 'Account code already exists';
        (r as any).message = prevMsg ? `${prevMsg}; ${duplicateMsg}` : duplicateMsg;
      }
    }
    const importCodes = new Set(rows.map((r) => normalizedCode(r.accountCode)).filter(Boolean));
    const parentCodesInFile = new Set(
      rows
        .map((r) => normalizedCode(r.parentCode))
        .filter((c) => c && c !== normalizedCode(null)),
    );

    const parentsLookupCodes = Array.from(parentCodesInFile).filter((c) => !importCodes.has(c));
    const existingParents = parentsLookupCodes.length
      ? await this.prisma.account.findMany({
          where: { tenantId: tenant.id, code: { in: parentsLookupCodes } },
          select: { id: true, code: true, isPosting: true },
        })
      : [];
    const existingParentByCode = new Map(
      existingParents.map((p) => [normalizedCode(p.code), p]),
    );

    const distinctIfrsCodes = Array.from(
      new Set(rows.map((r) => String((r as any).ifrsCode ?? '').trim()).filter(Boolean)),
    );
    const existingIfrs = distinctIfrsCodes.length
      ? await this.prisma.ifrsNode.findMany({
          where: { tenantId: tenant.id, code: { in: distinctIfrsCodes } },
          select: { id: true, code: true },
        })
      : [];
    const ifrsByCode = new Map(
      existingIfrs
        .filter((n) => String((n as any).code ?? '').trim())
        .map((n) => [String((n as any).code).trim(), n]),
    );

    for (const r of rows) {
      const msgs: string[] = [];
      let status: 'VALID' | 'ERROR' = r.status;
      if (status === 'ERROR' && r.message) {
        msgs.push(String(r.message));
      }

      const codeKey = normalizedCode(r.accountCode);
      const parentKey = normalizedCode(r.parentCode);
      const isParentInFile = Boolean(parentKey) && importCodes.has(parentKey);
      const parentExisting = parentKey ? existingParentByCode.get(parentKey) : null;

      if (parentKey) {
        if (!isParentInFile && !parentExisting) {
          status = 'ERROR';
          msgs.push('Invalid parent account');
        }
        if (parentExisting && Boolean((parentExisting as any).isPosting)) {
          status = 'ERROR';
          msgs.push('Parent account cannot be a posting account');
        }
      }

      const isPosting = codeKey ? !parentCodesInFile.has(codeKey) : true;
      const ifrsCode = String((r as any).ifrsCode ?? '').trim();
      if (isPosting) {
        if (!ifrsCode) {
          status = 'ERROR';
          msgs.push('IFRS code is required for posting accounts');
        } else if (!ifrsByCode.has(ifrsCode)) {
          status = 'ERROR';
          msgs.push('Invalid IFRS code');
        }
      }

      const fs1 = String((r as any).fsMappingLevel1 ?? '').trim();
      if (!fs1) {
        status = 'ERROR';
        msgs.push('FS Mapping Level 1 is required');
      }

      r.status = status;
      r.message = msgs.length > 0 ? Array.from(new Set(msgs)).join('; ') : null;
    }

    for (const r of rows) {
      if (r.status === 'ERROR' && r.message) {
        errors.push({ row: r.rowNumber, column: '', message: r.message });
      }
    }

    const validRows = rows.filter((r) => r.status === 'VALID').length;
    const errorRows = rows.filter((r) => r.status === 'ERROR').length;
    return {
      fileName,
      totalRows: rows.length,
      validRows,
      errorRows,
      rows,
      errors,
    };
  }

  async commitImport(
    req: Request,
    dto: {
      sourceFileName?: string | null;
      rows: Array<{
        rowNumber: number;
        accountCode: string;
        accountName: string;
        parentCode?: string | null;
        accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
        normalBalance: 'DEBIT' | 'CREDIT';
        ifrsCode?: string | null;
        fsMappingLevel1?: string | null;
        fsMappingLevel2?: string | null;
        status: 'VALID' | 'ERROR';
        message?: string | null;
      }>;
    },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    await this.assertCoaNotFrozen(tenant.id);
    await this.assertCoaNotLocked({ tenantId: tenant.id, operation: 'create' });

    const validRows = (dto.rows ?? []).filter(
      (r) => String((r as any)?.status ?? '').toUpperCase() === 'VALID',
    );
    if (validRows.length === 0) {
      throw new BadRequestException('No valid rows to import');
    }

    const batchId = randomUUID();
    const sourceFileName = dto.sourceFileName ?? null;

    const createdAccountIds: string[] = [];

    const normalizedCode = (v: any) => String(v ?? '').trim().toLowerCase();
    const importCodes = new Set(validRows.map((r) => normalizedCode(r.accountCode)).filter(Boolean));
    const parentCodesInFile = new Set(
      validRows
        .map((r) => normalizedCode(r.parentCode))
        .filter((c) => c && c !== normalizedCode(null)),
    );
    const parentCodesReferenced = new Set(
      validRows
        .map((r) => normalizedCode(r.parentCode))
        .filter(Boolean),
    );

    const distinctIfrsCodes = Array.from(
      new Set(validRows.map((r) => String((r as any).ifrsCode ?? '').trim()).filter(Boolean)),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.coaImportBatch.create({
        data: {
          batchId,
          tenantId: tenant.id,
          createdByUserId: user.id,
          status: CoaImportBatchStatus.DRAFT,
          accountCount: validRows.length,
          sourceFileName,
        },
        select: { id: true },
      });

      const existing = await tx.account.findMany({
        where: { tenantId: tenant.id, code: { in: validRows.map((r) => r.accountCode) } },
        select: { code: true },
      });
      if (existing.length > 0) {
        throw new ConflictException({
          message: 'Some account codes already exist',
          existingCodes: existing.map((e) => e.code),
        });
      }

      const ifrsNodes = distinctIfrsCodes.length
        ? await tx.ifrsNode.findMany({
            where: { tenantId: tenant.id, code: { in: distinctIfrsCodes } },
            select: { id: true, code: true },
          })
        : [];
      const ifrsIdByCode = new Map(
        ifrsNodes
          .filter((n) => String((n as any).code ?? '').trim())
          .map((n) => [String((n as any).code).trim(), String((n as any).id)]),
      );

      const parentCodesToLookup = Array.from(parentCodesReferenced).filter(
        (c) => c && !importCodes.has(c),
      );
      const existingParents = parentCodesToLookup.length
        ? await tx.account.findMany({
            where: { tenantId: tenant.id, code: { in: parentCodesToLookup } },
            select: { id: true, code: true, isPosting: true },
          })
        : [];
      const existingParentByCode = new Map(
        existingParents.map((p) => [normalizedCode(p.code), p]),
      );

      const accountIdByCode = new Map<string, string>();
      for (const r of validRows) {
        const code = String(r.accountCode ?? '').trim();
        const name = String(r.accountName ?? '').trim();
        const parentCode = String(r.parentCode ?? '').trim();
        const accountType = String(r.accountType ?? '').trim();
        const normalBalance = String(r.normalBalance ?? '').trim().toUpperCase();
        const ifrsCode = String((r as any).ifrsCode ?? '').trim();
        const fsMappingLevel1 = String((r as any).fsMappingLevel1 ?? '').trim() || null;
        const fsMappingLevel2 = String((r as any).fsMappingLevel2 ?? '').trim() || null;

        if (!code) throw new BadRequestException('Account code is required');
        if (!name) throw new BadRequestException('Account name is required');
        if (!accountType) throw new BadRequestException('Account type is required');
        if (!parentCode) throw new BadRequestException('Parent account is required');
        if (!fsMappingLevel1)
          throw new BadRequestException('FS Mapping Level 1 is required');

        const codeKey = normalizedCode(code);
        const isPosting = codeKey ? !parentCodesInFile.has(codeKey) : true;
        if (isPosting) {
          if (!ifrsCode) {
            throw new BadRequestException(
              'IFRS code is required for posting accounts',
            );
          }
          const resolved = ifrsIdByCode.get(ifrsCode) ?? null;
          if (!resolved) {
            throw new BadRequestException('Invalid IFRS code');
          }
        }

        const resolvedIfrsNodeId = isPosting ? (ifrsIdByCode.get(ifrsCode) ?? null) : null;

        const created = await tx.account.create({
          data: {
            tenantId: tenant.id,
            code,
            name,
            type: accountType as any,
            normalBalance: normalBalance as any,
            parentAccountId: null,
            isPosting,
            isPostingAllowed: isPosting,
            isControlAccount: false,
            ifrsNodeId: resolvedIfrsNodeId,
            fsMappingLevel1,
            fsMappingLevel2,
            status: 'DRAFT' as any,
            isActive: true,
            createdById: user.id,
            importBatchId: batchId,
          },
          select: { id: true },
        });
        createdAccountIds.push(created.id);
        accountIdByCode.set(code.toLowerCase(), created.id);
      }

      for (const r of validRows) {
        const parentCode = String(r.parentCode ?? '').trim();
        if (!parentCode) {
          throw new BadRequestException('Parent account is required');
        }
        const childId = accountIdByCode.get(r.accountCode.toLowerCase());
        if (!childId) continue;

        const parentIdFromImport = accountIdByCode.get(parentCode.toLowerCase());
        const parentExisting = parentIdFromImport
          ? null
          : existingParentByCode.get(normalizedCode(parentCode)) ?? null;
        if (parentExisting && Boolean((parentExisting as any).isPosting)) {
          throw new BadRequestException(
            'Parent account cannot be a posting account',
          );
        }
        const parentId = parentIdFromImport ?? parentExisting?.id ?? null;
        if (!parentId) throw new BadRequestException('Invalid parent account');
        await tx.account.updateMany({
          where: { tenantId: tenant.id, id: childId },
          data: { parentAccountId: parentId },
        });
      }

      const createdNodes = await tx.account.findMany({
        where: { tenantId: tenant.id, importBatchId: batchId },
        select: { id: true, parentAccountId: true },
      });

      for (const n of createdNodes) {
        const hierarchyPath = await this.computeHierarchyPath({
          tenantId: tenant.id,
          accountId: n.id,
          parentAccountId: n.parentAccountId ?? null,
        });
        await tx.account.updateMany({
          where: { tenantId: tenant.id, id: n.id },
          data: { hierarchyPath },
        });
      }

      await tx.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: AuditEventType.COA_IMPORTED,
            entityType: AuditEntityType.CHART_OF_ACCOUNTS,
            entityId: batchId,
            action: 'COA_IMPORT_BATCH_COMMITTED',
            outcome: 'SUCCESS',
            reason: JSON.stringify({ batchId, sourceFileName, accountCount: validRows.length }),
            userId: user.id,
            permissionUsed: PERMISSIONS.COA.DRAFT_CREATE,
          },
        })
        .catch(() => undefined);
    });

    const importedRows = createdAccountIds.length;
    const failedRows = validRows.length - importedRows;

    return {
      importedRows,
      failedRows,
      message: `${importedRows} draft accounts created successfully`,

      // Backward compatibility for older frontend response parsing
      imported: importedRows,
      skipped: 0,
      submissionId: null,

      batchId,
      status: 'DRAFT',
      accountCount: validRows.length,
      createdAccountCount: importedRows,
    };
  }

  async submitAccount(req: Request, accountId: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const account = await this.prisma.account.findFirst({
      where: { tenantId: tenant.id, id: accountId },
      select: {
        id: true,
        status: true,
        createdById: true,
        code: true,
        name: true,
        type: true,
        isPosting: true,
        isPostingAllowed: true,
        ifrsMappingCode: true,
        ifrsNodeId: true,
        parentAccountId: true,
        fsMappingLevel1: true,
        updatedAt: true,
      } as any,
    });
    if (!account) throw new NotFoundException('Account not found');

    console.log('SUBMIT ACCOUNT DATA:', {
      id: (account as any).id,
      status: (account as any).status,
      createdById: (account as any).createdById,
      code: (account as any).code,
      name: (account as any).name,
      type: (account as any).type,
      isPosting: (account as any).isPosting,
      isPostingAllowed: (account as any).isPostingAllowed,
      ifrsNodeId: (account as any).ifrsNodeId,
      ifrsMappingCode: (account as any).ifrsMappingCode,
      parentAccountId: (account as any).parentAccountId,
      updatedAt: (account as any).updatedAt,
    });

    if (String((account as any).status) !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT accounts can be submitted');
    }

    if (String((account as any).createdById ?? '') !== String(user.id)) {
      throw new ForbiddenException('Only the creator can submit this draft');
    }

    const code = String((account as any).code ?? '').trim();
    if (!code) {
      throw new BadRequestException('Account code is required');
    }
    const name = String((account as any).name ?? '').trim();
    if (!name) {
      throw new BadRequestException('Account name is required');
    }
    const type = String((account as any).type ?? '').trim();
    if (!type) {
      throw new BadRequestException('Account type is required');
    }

    if (Boolean((account as any).isPosting)) {
      const ifrsNodeId = String((account as any).ifrsNodeId ?? '').trim();
      if (!ifrsNodeId) {
        throw new BadRequestException(
          'IFRS mapping is required for posting accounts',
        );
      }
    }

    const fs1 = String((account as any).fsMappingLevel1 ?? '').trim();
    if (!fs1) {
      throw new BadRequestException(
        'FS Mapping Level 1 is required before submission',
      );
    }

    const parentAccountId = String((account as any).parentAccountId ?? '').trim();
    if (!parentAccountId) {
      throw new BadRequestException('Parent account is required');
    }

    const existingPending = await this.prisma.cOAApprovalRequest.findFirst({
      where: {
        tenantId: tenant.id,
        entityType: AuditEntityType.ACCOUNT,
        entityId: accountId,
        status: 'PENDING' as any,
      },
      select: { id: true },
    });

    if (existingPending) {
      throw new BadRequestException('Account is already pending approval');
    }

    const approval = await this.prisma.cOAApprovalRequest.create({
      data: {
        tenantId: tenant.id,
        requestType: COAApprovalRequestType.CREATE_ACCOUNT,
        entityType: AuditEntityType.ACCOUNT,
        entityId: accountId,
        payloadJson: { accountId },
        requestedById: user.id,
      },
      select: { id: true, status: true },
    });

    return { ok: true, requestId: approval.id, status: approval.status };
  }

  async bulkSubmitAccounts(req: Request, ids: string[]) {
    const success: string[] = [];
    const failed: Array<{ id: string; message: string }> = [];

    const cleanIds = Array.from(
      new Set((ids ?? []).map((x) => String(x ?? '').trim()).filter(Boolean)),
    );
    const chunkSize = 5;

    const getReasonMessage = (reason: any) => {
      if (!reason) return 'Submission failed';
      if (typeof reason?.response?.message === 'string') return reason.response.message;
      if (Array.isArray(reason?.response?.message)) return reason.response.message.join('; ');
      if (typeof reason?.message === 'string') return reason.message;
      return 'Submission failed';
    };

    for (let i = 0; i < cleanIds.length; i += chunkSize) {
      const chunk = cleanIds.slice(i, i + chunkSize);

      const results = await Promise.allSettled(
        chunk.map((id) => this.submitAccount(req, id)),
      );

      results.forEach((res, index) => {
        const id = chunk[index];
        if (!id) return;
        if (res.status === 'fulfilled') {
          success.push(id);
        } else {
          failed.push({ id, message: getReasonMessage((res as any).reason) });
        }
      });
    }

    return { success, failed };
  }

  async bulkApproveAccounts(req: Request, ids: string[], dto?: { comment?: string }) {
    const success: string[] = [];
    const failed: Array<{ id: string; message: string }> = [];

    const cleanIds = Array.from(
      new Set((ids ?? []).map((x) => String(x ?? '').trim()).filter(Boolean)),
    );
    const chunkSize = 5;

    const getReasonMessage = (reason: any) => {
      if (!reason) return 'Approval failed';
      if (typeof reason?.response?.message === 'string') return reason.response.message;
      if (Array.isArray(reason?.response?.message)) return reason.response.message.join('; ');
      if (typeof reason?.message === 'string') return reason.message;
      return 'Approval failed';
    };

    for (let i = 0; i < cleanIds.length; i += chunkSize) {
      const chunk = cleanIds.slice(i, i + chunkSize);
      const results = await Promise.allSettled(
        chunk.map((id) => this.approveRequest(req, id, dto)),
      );
      results.forEach((res, index) => {
        const id = chunk[index];
        if (!id) return;
        if (res.status === 'fulfilled') {
          success.push(id);
        } else {
          failed.push({ id, message: getReasonMessage((res as any).reason) });
        }
      });
    }

    return { success, failed };
  }

  async bulkRejectAccounts(req: Request, ids: string[], dto?: { rejectionReason?: string }) {
    const success: string[] = [];
    const failed: Array<{ id: string; message: string }> = [];

    const cleanIds = Array.from(
      new Set((ids ?? []).map((x) => String(x ?? '').trim()).filter(Boolean)),
    );
    const chunkSize = 5;

    const getReasonMessage = (reason: any) => {
      if (!reason) return 'Rejection failed';
      if (typeof reason?.response?.message === 'string') return reason.response.message;
      if (Array.isArray(reason?.response?.message)) return reason.response.message.join('; ');
      if (typeof reason?.message === 'string') return reason.message;
      return 'Rejection failed';
    };

    for (let i = 0; i < cleanIds.length; i += chunkSize) {
      const chunk = cleanIds.slice(i, i + chunkSize);
      const results = await Promise.allSettled(
        chunk.map((id) => this.rejectRequest(req, id, dto)),
      );
      results.forEach((res, index) => {
        const id = chunk[index];
        if (!id) return;
        if (res.status === 'fulfilled') {
          success.push(id);
        } else {
          failed.push({ id, message: getReasonMessage((res as any).reason) });
        }
      });
    }

    return { success, failed };
  }

  async listApprovalQueue(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const requests = await this.prisma.cOAApprovalRequest.findMany({
      where: { tenantId: tenant.id, status: 'PENDING' as any },
      orderBy: [{ requestedAt: 'desc' }],
      select: {
        id: true,
        requestType: true,
        entityType: true,
        entityId: true,
        payloadJson: true,
        requestedAt: true,
        requestedById: true,
        requestedBy: {
          select: { id: true, email: true, name: true },
        },
        status: true,
      },
    });

    const accountIds = Array.from(
      new Set(
        (requests ?? [])
          .filter((r: any) => String(r?.entityType) === String(AuditEntityType.ACCOUNT))
          .map((r: any) => String(r?.entityId ?? '').trim())
          .filter(Boolean),
      ),
    );

    const accounts = accountIds.length
      ? await this.prisma.account.findMany({
          where: { tenantId: tenant.id, id: { in: accountIds } },
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            status: true as any,
            isPosting: true,
            normalBalance: true,
            parentAccountId: true,
            parentAccount: { select: { id: true, code: true } },
            ifrsMappingCode: true,
            ifrsNode: { select: { id: true, code: true } },
            fsMappingLevel1: true,
            fsMappingLevel2: true,
          },
        })
      : [];

    const byAccountId: Record<string, any> = {};
    for (const a of accounts ?? []) {
      const ifrsCode = String((a as any)?.ifrsNode?.code ?? '').trim() || String((a as any)?.ifrsMappingCode ?? '').trim() || null;
      byAccountId[String((a as any).id)] = {
        id: String((a as any).id),
        code: String((a as any).code ?? ''),
        name: String((a as any).name ?? ''),
        accountType: (a as any).type,
        parentCode: String((a as any)?.parentAccount?.code ?? ''),
        parentAccountId: (a as any).parentAccountId ?? null,
        normalBalance: (a as any).normalBalance,
        ifrsCode,
        fsMappingLevel1: (a as any).fsMappingLevel1 ?? null,
        fsMappingLevel2: (a as any).fsMappingLevel2 ?? null,
        isPosting: Boolean((a as any).isPosting),
        status: (a as any).status,
      };
    }

    const hydrated = (requests ?? []).map((r: any) => {
      if (String(r?.entityType) !== String(AuditEntityType.ACCOUNT)) return r;
      const account = byAccountId[String(r?.entityId ?? '')] ?? null;
      return { ...r, account };
    });

    return { requests: hydrated };
  }

  async approveRequest(req: Request, requestId: string, dto?: { comment?: string }) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const existing = await this.prisma.cOAApprovalRequest.findFirst({
      where: { tenantId: tenant.id, id: requestId },
      select: {
        id: true,
        status: true,
        requestType: true,
        entityType: true,
        entityId: true,
        payloadJson: true,
        requestedById: true,
      },
    });
    if (!existing) throw new NotFoundException('Approval request not found');
    if (String(existing.status) !== 'PENDING') {
      throw new BadRequestException('Only PENDING requests can be approved');
    }

    if (String(existing.requestedById) === String(user.id)) {
      throw new ForbiddenException('Maker-checker rule: requester cannot approve');
    }

    const now = new Date();

    const notifyPayload: { title: string; message: string; type: string; entityType?: string; entityId?: string } = {
      title: 'Request Approved',
      message: 'Your request was approved',
      type: 'APPROVAL',
    };

    await this.prisma.$transaction(async (tx) => {
      const rt = String(existing.requestType);
      const isAccountRequest = String(existing.entityType) === String(AuditEntityType.ACCOUNT);

      if (isAccountRequest && (rt === String(COAApprovalRequestType.CREATE_ACCOUNT) || rt === String(COAApprovalRequestType.UPDATE_ACCOUNT))) {
        const account = await tx.account.findFirst({
          where: { tenantId: tenant.id, id: existing.entityId },
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            isPosting: true,
            parentAccountId: true,
            parentAccount: { select: { id: true, code: true } },
            ifrsMappingCode: true,
            ifrsNodeId: true,
            ifrsNode: { select: { id: true, code: true } },
            fsMappingLevel1: true,
            fsMappingLevel2: true,
          },
        });

        if (!account) throw new NotFoundException('Account not found');

        notifyPayload.title = 'Account Approved';
        notifyPayload.message = `Account ${String((account as any).code ?? '')} - ${String((account as any).name ?? '')} approved`;
        notifyPayload.type = 'APPROVAL';
        notifyPayload.entityType = 'ACCOUNT';
        notifyPayload.entityId = String((account as any).id);

        const code = String((account as any).code ?? '').trim();
        const name = String((account as any).name ?? '').trim();
        const accountType = String((account as any).type ?? '').trim();
        const parentAccountId = String((account as any).parentAccountId ?? '').trim();

        if (!code) throw new BadRequestException('Account code is required');
        if (!name) throw new BadRequestException('Account name is required');
        if (!accountType) throw new BadRequestException('Account type is required');
        if (!parentAccountId) throw new BadRequestException('Parent account is required');

        const duplicate = await tx.account.findFirst({
          where: {
            tenantId: tenant.id,
            code,
            id: { not: String((account as any).id) },
          },
          select: { id: true },
        });
        if (duplicate) throw new BadRequestException('Account code already exists');

        const parent = await tx.account.findFirst({
          where: { tenantId: tenant.id, id: parentAccountId },
          select: { id: true, isPosting: true },
        });
        if (!parent) throw new BadRequestException('Parent account does not exist');
        if (parent.isPosting) {
          throw new BadRequestException('Parent account cannot be a posting account');
        }

        const isPosting = Boolean((account as any).isPosting);
        const ifrsCode = String((account as any)?.ifrsNode?.code ?? '').trim() || String((account as any)?.ifrsMappingCode ?? '').trim();
        const fs1 = String((account as any)?.fsMappingLevel1 ?? '').trim();

        if (isPosting) {
          if (!ifrsCode) throw new BadRequestException('IFRS mapping is required for posting accounts');
          if (!fs1) throw new BadRequestException('FS Mapping Level 1 is required');

          const ifrs = await tx.ifrsNode.findFirst({
            where: { tenantId: tenant.id, code: ifrsCode },
            select: { id: true },
          });
          if (!ifrs) throw new BadRequestException('Invalid IFRS mapping');
        }
      }

      await tx.cOAApprovalRequest.update({
        where: { id: existing.id },
        data: {
          status: 'APPROVED' as any,
          approvedById: user.id,
          approvedAt: now,
          rejectionReason: null,
          payloadJson: {
            ...(existing.payloadJson as any),
            approvalComment: dto?.comment ?? null,
          },
        },
      });

      if (rt === String(COAApprovalRequestType.CREATE_ACCOUNT) || rt === String(COAApprovalRequestType.UPDATE_ACCOUNT)) {
        await tx.account.updateMany({
          where: { tenantId: tenant.id, id: existing.entityId },
          data: {
            status: 'ACTIVE' as any,
            isActive: true,
            approvedAt: now as any,
            approvedById: user.id,
          },
        });
      }

      if (rt === String(COAApprovalRequestType.STATUS_CHANGE)) {
        const nextStatus = String((existing.payloadJson as any)?.nextStatus ?? '').trim();
        if (!nextStatus) throw new BadRequestException('Missing nextStatus on approval payload');
        await tx.account.updateMany({
          where: { tenantId: tenant.id, id: existing.entityId },
          data: {
            status: nextStatus as any,
            ...(nextStatus === 'BLOCKED'
              ? { blockedAt: now as any, blockedById: user.id }
              : nextStatus === 'RETIRED'
                ? { retiredAt: now as any, retiredById: user.id }
                : nextStatus === 'ACTIVE'
                  ? { approvedAt: now as any, approvedById: user.id }
                  : {}),
          } as any,
        });
      }

      if (rt === String(COAApprovalRequestType.RECLASSIFICATION)) {
        await tx.cOAReclassification.updateMany({
          where: { tenantId: tenant.id, id: existing.entityId },
          data: {
            status: 'APPROVED' as any,
            approvedAt: now as any,
            approvedById: user.id,
          } as any,
        });

        const reclass = await tx.cOAReclassification.findFirst({
          where: { tenantId: tenant.id, id: existing.entityId },
          select: {
            accountId: true,
            newParentAccountId: true,
            newIfrsMappingCode: true,
            newFsMappingLevel1: true,
            newFsMappingLevel2: true,
          } as any,
        });

        if (reclass) {
          await this.assertCoaStructureNotFrozen({
            tenantId: tenant.id,
            userId: user.id,
            permissionUsed: PERMISSIONS.COA.APPROVE,
            action: 'COA_RECLASS_APPROVE',
            reason: { reclassificationId: existing.entityId },
          });

          await tx.account.updateMany({
            where: { tenantId: tenant.id, id: String((reclass as any).accountId) },
            data: {
              ...(reclass.newParentAccountId !== undefined
                ? { parentAccountId: reclass.newParentAccountId ?? null }
                : {}),
              ...(reclass.newIfrsMappingCode !== undefined
                ? { ifrsMappingCode: reclass.newIfrsMappingCode ?? null }
                : {}),
              ...(reclass.newFsMappingLevel1 !== undefined
                ? { fsMappingLevel1: reclass.newFsMappingLevel1 ?? null }
                : {}),
              ...(reclass.newFsMappingLevel2 !== undefined
                ? { fsMappingLevel2: reclass.newFsMappingLevel2 ?? null }
                : {}),
            } as any,
          });
        }
      }
    });

    try {
      await this.notifications.create({
        tenantId: String(tenant.id),
        userId: String(existing.requestedById),
        title: notifyPayload.title,
        message: notifyPayload.message,
        type: notifyPayload.type,
        entityType: notifyPayload.entityType,
        entityId: notifyPayload.entityId,
      });
    } catch {
      // swallow notification errors
    }

    return { ok: true, requestId };
  }

  async rejectRequest(
    req: Request,
    requestId: string,
    dto?: { rejectionReason?: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const existing = await this.prisma.cOAApprovalRequest.findFirst({
      where: { tenantId: tenant.id, id: requestId },
      select: { id: true, status: true, requestedById: true, entityId: true, requestType: true },
    });
    if (!existing) throw new NotFoundException('Approval request not found');
    if (String(existing.status) !== 'PENDING') {
      throw new BadRequestException('Only PENDING requests can be rejected');
    }

    if (String(existing.requestedById) === String(user.id)) {
      throw new ForbiddenException('Maker-checker rule: requester cannot reject');
    }

    let rejectTitle = 'Request Rejected';
    let rejectMessage = `Your request was rejected${dto?.rejectionReason ? `: ${dto.rejectionReason}` : ''}`;
    let rejectEntityType: string | undefined;
    let rejectEntityId: string | undefined;

    if (String(existing.requestType) === String(COAApprovalRequestType.CREATE_ACCOUNT)
      || String(existing.requestType) === String(COAApprovalRequestType.UPDATE_ACCOUNT)
      || String(existing.requestType) === String(COAApprovalRequestType.STATUS_CHANGE)) {
      const acct = await this.prisma.account.findFirst({
        where: { tenantId: tenant.id, id: existing.entityId },
        select: { id: true, code: true, name: true },
      });
      if (acct) {
        rejectTitle = 'Account Rejected';
        rejectMessage = `Account ${String((acct as any).code ?? '')} - ${String((acct as any).name ?? '')} was rejected${dto?.rejectionReason ? `: ${dto.rejectionReason}` : ''}`;
        rejectEntityType = 'ACCOUNT';
        rejectEntityId = String((acct as any).id);
      }
    }

    const now = new Date();
    await this.prisma.cOAApprovalRequest.update({
      where: { id: existing.id },
      data: {
        status: 'REJECTED' as any,
        rejectedById: user.id,
        rejectedAt: now,
        rejectionReason: dto?.rejectionReason ?? null,
      },
    });

    if (String(existing.requestType) === String(COAApprovalRequestType.RECLASSIFICATION)) {
      await this.prisma.cOAReclassification.updateMany({
        where: { tenantId: tenant.id, id: existing.entityId },
        data: {
          status: 'REJECTED' as any,
          rejectedAt: now as any,
          rejectedById: user.id,
          rejectionReason: dto?.rejectionReason ?? null,
        } as any,
      });
    }

    try {
      await this.notifications.create({
        tenantId: String(tenant.id),
        userId: String(existing.requestedById),
        title: rejectTitle,
        message: rejectMessage,
        type: 'REJECTION',
        entityType: rejectEntityType,
        entityId: rejectEntityId,
      });
    } catch {
      // swallow notification errors
    }

    return { ok: true, requestId };
  }

  async listReclassifications(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const rows = await this.prisma.cOAReclassification.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ requestedAt: 'desc' }],
    } as any);
    return { reclassifications: rows };
  }

  async createReclassification(
    req: Request,
    dto: {
      accountId: string;
      newParentAccountId?: string | null;
      newIfrsMappingCode?: string | null;
      newFsMappingLevel1?: string | null;
      newFsMappingLevel2?: string | null;
      effectiveStartDate: string;
      reason?: string | null;
    },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const account = await this.prisma.account.findFirst({
      where: { tenantId: tenant.id, id: dto.accountId },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Account not found');

    const created = await this.prisma.cOAReclassification.create({
      data: {
        tenantId: tenant.id,
        accountId: dto.accountId,
        newParentAccountId: dto.newParentAccountId ?? null,
        newIfrsMappingCode: dto.newIfrsMappingCode ?? null,
        newFsMappingLevel1: dto.newFsMappingLevel1 ?? null,
        newFsMappingLevel2: dto.newFsMappingLevel2 ?? null,
        effectiveStartDate: new Date(dto.effectiveStartDate),
        reason: dto.reason ?? null,
        requestedById: user.id,
        status: 'DRAFT' as any,
      } as any,
    });

    return created;
  }

  async submitReclassification(req: Request, id: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const existing = await this.prisma.cOAReclassification.findFirst({
      where: { tenantId: tenant.id, id },
      select: { id: true, status: true, requestedById: true },
    } as any);
    if (!existing) throw new NotFoundException('Reclassification not found');
    if (String((existing as any).status) !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT reclassifications can be submitted');
    }
    if (String((existing as any).requestedById) !== String(user.id)) {
      throw new ForbiddenException('Only the requester can submit this draft');
    }

    const now = new Date();
    await this.prisma.cOAReclassification.update({
      where: { id },
      data: { status: 'PENDING' as any, requestedAt: now as any } as any,
    } as any);

    const approval = await this.prisma.cOAApprovalRequest.create({
      data: {
        tenantId: tenant.id,
        requestType: COAApprovalRequestType.RECLASSIFICATION,
        entityType: AuditEntityType.COA_RECLASSIFICATION,
        entityId: id,
        payloadJson: { reclassificationId: id },
        requestedById: user.id,
      },
      select: { id: true, status: true },
    });

    return { ok: true, reclassificationId: id, approvalRequestId: approval.id, status: approval.status };
  }

  async approveReclassification(req: Request, id: string, dto?: { comment?: string }) {
    void dto;
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const approval = await this.prisma.cOAApprovalRequest.findFirst({
      where: {
        tenantId: tenant.id,
        requestType: COAApprovalRequestType.RECLASSIFICATION,
        entityType: AuditEntityType.COA_RECLASSIFICATION,
        entityId: id,
        status: 'PENDING' as any,
      },
      orderBy: { requestedAt: 'desc' },
      select: { id: true },
    });

    if (!approval) throw new NotFoundException('Approval request not found');
    return this.approveRequest(req, approval.id, dto);
  }

  async rejectReclassification(req: Request, id: string, dto?: { rejectionReason?: string }) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const approval = await this.prisma.cOAApprovalRequest.findFirst({
      where: {
        tenantId: tenant.id,
        requestType: COAApprovalRequestType.RECLASSIFICATION,
        entityType: AuditEntityType.COA_RECLASSIFICATION,
        entityId: id,
        status: 'PENDING' as any,
      },
      orderBy: { requestedAt: 'desc' },
      select: { id: true },
    });

    if (!approval) throw new NotFoundException('Approval request not found');
    return this.rejectRequest(req, approval.id, dto);
  }

  async getDraftImportBatch(req: Request) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    let batch = await this.prisma.coaImportBatch.findFirst({
      where: {
        tenantId: tenant.id,
        status: CoaImportBatchStatus.DRAFT,
        createdByUserId: user.id,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        batchId: true,
        status: true,
        accountCount: true,
        sourceFileName: true,
        createdAt: true,
      },
    });

    if (!batch) {
      const batchId = randomUUID();
      batch = await this.prisma.coaImportBatch.create({
        data: {
          batchId,
          tenantId: tenant.id,
          createdByUserId: user.id,
          status: CoaImportBatchStatus.DRAFT,
          accountCount: 0,
        },
        select: {
          batchId: true,
          status: true,
          accountCount: true,
          sourceFileName: true,
          createdAt: true,
        },
      });
    }

    return batch;
  }

  async listImportBatchAccounts(req: Request, batchId: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const batch = await this.prisma.coaImportBatch.findFirst({
      where: { tenantId: tenant.id, batchId },
      select: { batchId: true, status: true },
    });
    if (!batch) throw new NotFoundException('Import batch not found');

    const accounts = await this.prisma.account.findMany({
      where: { tenantId: tenant.id, importBatchId: batchId },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        type: true,
        parentAccountId: true,
        isPosting: true,
        ifrsNodeId: true,
      },
      orderBy: [{ code: 'asc' }],
    });

    return { batch, accounts };
  }

  async submitImportBatch(req: Request, batchId: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.coaImportBatch.findFirst({
        where: { tenantId: tenant.id, batchId },
        select: { status: true, accountCount: true },
      });
      if (!batch) throw new NotFoundException('Import batch not found');
      if (batch.status !== CoaImportBatchStatus.DRAFT) {
        throw new ConflictException('Only DRAFT batches can be submitted');
      }

      await tx.coaImportBatch.updateMany({
        where: { tenantId: tenant.id, batchId },
        data: {
          status: CoaImportBatchStatus.PENDING_APPROVAL,
          submittedAt: new Date(),
          submittedByUserId: user.id,
        },
      });

      const approval = await tx.cOAApprovalRequest.create({
        data: {
          tenantId: tenant.id,
          requestType: COAApprovalRequestType.IMPORT_BATCH,
          entityType: AuditEntityType.CHART_OF_ACCOUNTS,
          entityId: batchId,
          payloadJson: { batchId, accountCount: batch.accountCount },
          requestedById: user.id,
        },
        select: { id: true, status: true },
      });

      return { ok: true, batchId, approvalRequestId: approval.id, status: approval.status };
    });
  }

  async cancelImportBatch(req: Request, batchId: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.coaImportBatch.findFirst({
        where: { tenantId: tenant.id, batchId },
        select: { status: true },
      });
      if (!batch) throw new NotFoundException('Import batch not found');
      if (batch.status !== CoaImportBatchStatus.DRAFT) {
        throw new ConflictException('Only DRAFT batches can be cancelled');
      }

      await tx.coaImportBatch.updateMany({
        where: { tenantId: tenant.id, batchId },
        data: { status: CoaImportBatchStatus.CANCELLED },
      });

      await tx.account.updateMany({
        where: { tenantId: tenant.id, importBatchId: batchId },
        data: { importBatchId: null },
      });

      await tx.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: AuditEventType.COA_IMPORTED,
            entityType: AuditEntityType.CHART_OF_ACCOUNTS,
            entityId: batchId,
            action: 'COA_IMPORT_BATCH_CANCELLED',
            outcome: 'SUCCESS',
            reason: JSON.stringify({ batchId }),
            userId: user.id,
            permissionUsed: PERMISSIONS.COA.DRAFT_CREATE,
          },
        })
        .catch(() => undefined);

      return { ok: true, batchId };
    });
  }

  async reviewImportBatch(req: Request, batchId: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    await this.prisma.coaImportBatch.updateMany({
      where: { tenantId: tenant.id, batchId },
      data: { reviewedAt: new Date(), reviewedByUserId: user.id },
    });

    return { ok: true, batchId };
  }

  async approveImportBatch(req: Request, batchId: string, dto: { comment?: string }) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.coaImportBatch.findFirst({
        where: { tenantId: tenant.id, batchId },
        select: { status: true },
      });
      if (!batch) throw new NotFoundException('Import batch not found');
      if (batch.status !== CoaImportBatchStatus.PENDING_APPROVAL) {
        throw new ConflictException('Only PENDING_APPROVAL batches can be approved');
      }

      await tx.coaImportBatch.updateMany({
        where: { tenantId: tenant.id, batchId },
        data: {
          status: CoaImportBatchStatus.APPROVED,
          approvedAt: new Date(),
          approvedByUserId: user.id,
        },
      });

      await tx.account.updateMany({
        where: { tenantId: tenant.id, importBatchId: batchId, status: 'DRAFT' as any },
        data: {
          status: 'ACTIVE' as any,
          approvedAt: new Date(),
          approvedById: user.id,
        },
      });

      await tx.cOAApprovalRequest.updateMany({
        where: {
          tenantId: tenant.id,
          requestType: COAApprovalRequestType.IMPORT_BATCH,
          entityType: AuditEntityType.CHART_OF_ACCOUNTS,
          entityId: batchId,
          status: 'PENDING' as any,
        },
        data: {
          status: 'APPROVED' as any,
          approvedById: user.id,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      });

      await tx.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: AuditEventType.COA_IMPORTED,
            entityType: AuditEntityType.CHART_OF_ACCOUNTS,
            entityId: batchId,
            action: 'COA_IMPORT_BATCH_APPROVED',
            outcome: 'SUCCESS',
            reason: JSON.stringify({ batchId, comment: dto?.comment ?? null }),
            userId: user.id,
            permissionUsed: PERMISSIONS.COA.APPROVE,
          },
        })
        .catch(() => undefined);

      return { ok: true, batchId };
    });
  }

  async rejectImportBatch(
    req: Request,
    batchId: string,
    dto: { rejectionReason: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.coaImportBatch.findFirst({
        where: { tenantId: tenant.id, batchId },
        select: { status: true },
      });
      if (!batch) throw new NotFoundException('Import batch not found');
      if (batch.status !== CoaImportBatchStatus.PENDING_APPROVAL) {
        throw new ConflictException('Only PENDING_APPROVAL batches can be rejected');
      }

      await tx.coaImportBatch.updateMany({
        where: { tenantId: tenant.id, batchId },
        data: {
          status: CoaImportBatchStatus.REJECTED,
          rejectionReason: dto.rejectionReason,
        },
      });

      await tx.account.updateMany({
        where: { tenantId: tenant.id, importBatchId: batchId },
        data: { importBatchId: null },
      });

      await tx.cOAApprovalRequest.updateMany({
        where: {
          tenantId: tenant.id,
          requestType: COAApprovalRequestType.IMPORT_BATCH,
          entityType: AuditEntityType.CHART_OF_ACCOUNTS,
          entityId: batchId,
          status: 'PENDING' as any,
        },
        data: {
          status: 'REJECTED' as any,
          rejectedById: user.id,
          rejectedAt: new Date(),
          rejectionReason: dto.rejectionReason,
        },
      });

      await tx.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: AuditEventType.COA_IMPORTED,
            entityType: AuditEntityType.CHART_OF_ACCOUNTS,
            entityId: batchId,
            action: 'COA_IMPORT_BATCH_REJECTED',
            outcome: 'SUCCESS',
            reason: JSON.stringify({ batchId, rejectionReason: dto.rejectionReason }),
            userId: user.id,
            permissionUsed: PERMISSIONS.COA.REJECT,
          },
        })
        .catch(() => undefined);

      return { ok: true, batchId };
    });
  }

  async requestStatusChange(
    req: Request,
    accountId: string,
    dto: { nextStatus: 'ACTIVE' | 'BLOCKED' | 'RETIRED'; reason?: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const account = await this.prisma.account.findFirst({
      where: { tenantId: tenant.id, id: accountId },
      select: { id: true, status: true },
    });
    if (!account) throw new NotFoundException('Account not found');

    const approval = await this.prisma.cOAApprovalRequest.create({
      data: {
        tenantId: tenant.id,
        requestType: COAApprovalRequestType.STATUS_CHANGE,
        entityType: AuditEntityType.ACCOUNT,
        entityId: accountId,
        payloadJson: {
          accountId,
          currentStatus: account.status,
          nextStatus: dto.nextStatus,
          reason: dto.reason ?? null,
        },
        requestedById: user.id,
      },
      select: { id: true, status: true },
    });

    return { requestId: approval.id, status: approval.status };
  }

  private normalizeHeader(v: any) {
    return String(v ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
  }

  async setupTopLevelCategories(req: Request) {
    return this.rootCategories.setupDefault(req);
  }

  async resetTenantCoa(req: Request) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    await this.assertCoaNotFrozen(tenant.id);
    await this.assertCoaStructureNotFrozen({
      tenantId: tenant.id,
      userId: user.id,
      permissionUsed: PERMISSIONS.FINANCE.CONFIG_CHANGE,
      action: 'COA_RESET_TENANT_COA',
      reason: { action: 'COA_RESET_TENANT_COA' },
    });
    await this.assertCoaNotLocked({ tenantId: tenant.id, operation: 'create' });

    await this.rootCategories.setupDefault(req);

    const rows = await this.prisma.account.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, parentAccountId: true },
    });

    const childrenByParentId = new Map<string, string[]>();
    const parentById = new Map<string, string | null>();

    for (const r of rows) {
      const parentId = r.parentAccountId ?? null;
      parentById.set(r.id, parentId);
      if (parentId) {
        const list = childrenByParentId.get(parentId) ?? [];
        list.push(r.id);
        childrenByParentId.set(parentId, list);
      }
    }

    const roots = rows
      .filter((r) => {
        const p = r.parentAccountId ?? null;
        return !p || !parentById.has(p);
      })
      .map((r) => r.id);

    const updates: Array<{ id: string; hierarchyPath: string }> = [];
    const visited = new Set<string>();
    const walk = (id: string, path: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      updates.push({ id, hierarchyPath: path });
      for (const c of childrenByParentId.get(id) ?? []) {
        walk(c, `${path}/${c}`);
      }
    };

    for (const rootId of roots) {
      walk(rootId, rootId);
    }

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.account.updateMany({
          where: { tenantId: tenant.id, id: u.id },
          data: { hierarchyPath: u.hierarchyPath },
        }),
      ),
    );

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'COA_UPDATE' as any,
          entityType: 'TENANT' as any,
          entityId: tenant.id,
          action: 'COA_RESET_TENANT_COA',
          outcome: 'SUCCESS' as any,
          reason: JSON.stringify({
            action: 'COA_RESET_TENANT_COA',
            repairedCount: updates.length,
            rootCategoriesEnsured: true,
            timestamp: new Date().toISOString(),
          }),
          userId: user.id,
          permissionUsed: PERMISSIONS.FINANCE.CONFIG_CHANGE,
        } as any,
      })
      .catch(() => undefined);

    return { ok: true, repairedCount: updates.length, rootCategoriesEnsured: true };
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
      select: {
        coaFrozen: true,
        coaLockedAt: true,
        coaStructureFrozen: true as any,
        coaStructureFrozenAt: true as any,
        coaStructureFrozenByUserId: true as any,
        coaStructureFreezeEffectiveDate: true as any,
      },
    });
    if (!t) throw new BadRequestException('Missing tenant context');
    return {
      coaFrozen: Boolean(t.coaFrozen),
      coaLockedAt: t.coaLockedAt,
      structureFreeze: {
        coaStructureFrozen: Boolean((t as any).coaStructureFrozen),
        coaStructureFrozenAt: (t as any).coaStructureFrozenAt ?? null,
        coaStructureFrozenByUserId: (t as any).coaStructureFrozenByUserId ?? null,
        coaStructureFreezeEffectiveDate: (t as any).coaStructureFreezeEffectiveDate ?? null,
      },
    };
  }

  async importCanonical(req: Request, file?: any, opts?: { autoSubmit?: boolean }) {
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
            permissionUsed: PERMISSIONS.COA.UPDATE,
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
      autoSubmit: Boolean(opts?.autoSubmit),
    };
  }

  async getImportTemplate(req: Request, params: { format?: string }) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const format = (params.format ?? 'csv').toLowerCase();
    const headers = [
      'accountCode',
      'accountName',
      'parentCode',
      'accountType',
      'normalBalance',
      'ifrsCode',
      'fsMappingLevel1',
      'fsMappingLevel2',
    ];

    const sampleRows = [
      {
        accountCode: '1000',
        accountName: 'Cash on Hand',
        parentCode: '100',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        ifrsCode: 'IFRS_CODE_HERE',
        fsMappingLevel1: 'Current Assets',
        fsMappingLevel2: 'Cash and cash equivalents',
      },
      {
        accountCode: '2000',
        accountName: 'Accounts Payable',
        parentCode: '200',
        accountType: 'LIABILITY',
        normalBalance: 'CREDIT',
        ifrsCode: 'IFRS_CODE_HERE',
        fsMappingLevel1: 'Current Liabilities',
        fsMappingLevel2: 'Trade and other payables',
      },
      {
        accountCode: '4000',
        accountName: 'Sales Revenue',
        parentCode: '400',
        accountType: 'INCOME',
        normalBalance: 'CREDIT',
        ifrsCode: 'IFRS_CODE_HERE',
        fsMappingLevel1: 'Revenue',
        fsMappingLevel2: 'Sales',
      },
    ];

    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('COA Import Template');
      ws.addRow(headers);
      for (const r of sampleRows) {
        ws.addRow(headers.map((h) => (r as any)[h] ?? ''));
      }

      const refWs = wb.addWorksheet('IFRS Reference');
      refWs.addRow(['ifrsCode', 'ifrsName']);
      const ifrsNodes = await this.prisma.ifrsNode.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
          code: {
            notIn: [''],
          },
        } as any,
        orderBy: [{ code: 'asc' }],
        select: { code: true, name: true },
      });
      for (const n of ifrsNodes) {
        const code = String((n as any).code ?? '').trim();
        if (!code) continue;
        refWs.addRow([code, String((n as any).name ?? '')]);
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

    await this.assertCoaStructureNotFrozen({
      tenantId: tenant.id,
      userId: user.id,
      permissionUsed: PERMISSIONS.COA.UPDATE,
      action: 'COA_CLEANUP_NON_CANONICAL',
      reason: {
        action: 'COA_CLEANUP_NON_CANONICAL',
        canonicalHash: dto.canonicalHash ?? null,
        dryRun: dto.dryRun ?? null,
      },
    });

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
          permissionUsed: PERMISSIONS.COA.UPDATE,
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

  private async assertCoaStructureNotFrozen(params: {
    tenantId: string;
    userId: string;
    permissionUsed: string;
    action: string;
    reason?: Record<string, any>;
  }) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { coaStructureFrozen: true } as any,
    });

    const frozen = Boolean((t as any)?.coaStructureFrozen);
    if (!frozen) return;

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: params.tenantId,
          eventType: 'COA_STRUCTURE_CHANGE_BLOCKED' as any,
          entityType: 'TENANT' as any,
          entityId: params.tenantId,
          action: params.action,
          outcome: 'BLOCKED' as any,
          reason: params.reason ? JSON.stringify(params.reason) : undefined,
          userId: params.userId,
          permissionUsed: params.permissionUsed as any,
        } as any,
      })
      .catch(() => undefined);

    throw new ForbiddenException(
      'COA structure is frozen. Submit a controlled change request to modify structure.',
    );
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

  async list(req: Request, query?: { asOfDate?: string }) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const asOfDate = String(query?.asOfDate ?? '').trim() || new Date();

    const [accounts, t] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where: { tenantId: tenant.id, status: 'ACTIVE' as any },
        orderBy: [{ code: 'asc' }],
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
          ifrsNodeId: true,
          isBudgetRelevant: true,
          budgetControlMode: true,
          status: true as any,
          createdAt: true,
          createdById: true,
          updatedAt: true,
        },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: {
          coaFrozen: true,
          coaLockedAt: true,
          coaStructureFrozen: true as any,
          coaStructureFrozenAt: true as any,
          coaStructureFrozenByUserId: true as any,
          coaStructureFreezeEffectiveDate: true as any,
        },
      }),
    ]);

    const resolvedAccounts = await this.structuralResolver.applyOverrides({
      tenantId: tenant.id,
      accounts: accounts as any,
      asOfDate,
    });

    return {
      coaFrozen: Boolean(t?.coaFrozen),
      coaLockedAt: t?.coaLockedAt ?? null,
      structureFreeze: {
        coaStructureFrozen: Boolean((t as any)?.coaStructureFrozen),
        coaStructureFrozenAt: (t as any)?.coaStructureFrozenAt ?? null,
        coaStructureFrozenByUserId: (t as any)?.coaStructureFrozenByUserId ?? null,
        coaStructureFreezeEffectiveDate: (t as any)?.coaStructureFreezeEffectiveDate ?? null,
      },
      accounts: resolvedAccounts,
    };
  }

  async listSubmissions(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const user = req.user;
    if (!user) throw new BadRequestException('Missing user context');

    const asOfDate = new Date();

    const [accounts, pendingRequests, t] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where: {
          tenantId: tenant.id,
          createdById: user.id,
          status: { in: ['DRAFT' as any] } as any,
        },
        orderBy: [{ updatedAt: 'desc' }, { code: 'asc' }],
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
          ifrsNodeId: true,
          ifrsNode: {
            select: {
              code: true,
            },
          },
          isBudgetRelevant: true,
          budgetControlMode: true,
          status: true as any,
          createdAt: true,
          createdById: true,
          updatedAt: true,
        } as any,
      }),
      this.prisma.cOAApprovalRequest.findMany({
        where: {
          tenantId: tenant.id,
          entityType: AuditEntityType.ACCOUNT,
          status: 'PENDING' as any,
        },
        select: {
          id: true,
          entityId: true,
          requestType: true,
          requestedAt: true,
        },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: {
          coaFrozen: true,
          coaLockedAt: true,
          coaStructureFrozen: true as any,
          coaStructureFrozenAt: true as any,
          coaStructureFrozenByUserId: true as any,
          coaStructureFreezeEffectiveDate: true as any,
        },
      }),
    ]);

    const pendingByAccountId = new Set(
      (pendingRequests ?? []).map((r: any) => String(r.entityId)),
    );

    const accountsWithApprovalState = (accounts ?? []).map((a: any) => {
      const approvalState = pendingByAccountId.has(String(a.id))
        ? 'PENDING_APPROVAL'
        : 'DRAFT';
      const ifrsCode = String((a as any)?.ifrsNode?.code ?? '').trim() || null;
      return {
        ...a,
        ifrsCode,
        fsMappingLevel1: (a as any)?.fsMappingLevel1 ?? null,
        fsMappingLevel2: (a as any)?.fsMappingLevel2 ?? null,
        approvalState,
      };
    });

    const resolvedAccounts = await this.structuralResolver.applyOverrides({
      tenantId: tenant.id,
      accounts: accountsWithApprovalState as any,
      asOfDate,
    });

    return {
      coaFrozen: Boolean(t?.coaFrozen),
      coaLockedAt: t?.coaLockedAt ?? null,
      structureFreeze: {
        coaStructureFrozen: Boolean((t as any)?.coaStructureFrozen),
        coaStructureFrozenAt: (t as any)?.coaStructureFrozenAt ?? null,
        coaStructureFrozenByUserId: (t as any)?.coaStructureFrozenByUserId ?? null,
        coaStructureFreezeEffectiveDate: (t as any)?.coaStructureFreezeEffectiveDate ?? null,
      },
      accounts: resolvedAccounts,
      data: resolvedAccounts,
      total: Array.isArray(resolvedAccounts) ? resolvedAccounts.length : 0,
    };
  }

  async listParentOptions(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const parents = await this.prisma.account.findMany({
      where: {
        tenantId: tenant.id,
        status: 'ACTIVE' as any,
        isActive: true,
        isPosting: false,
      },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    return { parents };
  }

  async tree(req: Request, query?: { asOfDate?: string }) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const asOfDate = String(query?.asOfDate ?? '').trim() || new Date();

    const [rows, t] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where: { tenantId: tenant.id },
        orderBy: [{ code: 'asc' }],
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
          ifrsNodeId: true,
        },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: {
          coaFrozen: true,
          coaLockedAt: true,
          coaStructureFrozen: true as any,
          coaStructureFrozenAt: true as any,
          coaStructureFrozenByUserId: true as any,
          coaStructureFreezeEffectiveDate: true as any,
        },
      }),
    ]);

    const resolvedRows = await this.structuralResolver.applyOverrides({
      tenantId: tenant.id,
      accounts: rows as any,
      asOfDate,
    });

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

    for (const r of resolvedRows as any[]) {
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
      structureFreeze: {
        coaStructureFrozen: Boolean((t as any)?.coaStructureFrozen),
        coaStructureFrozenAt: (t as any)?.coaStructureFrozenAt ?? null,
        coaStructureFrozenByUserId: (t as any)?.coaStructureFrozenByUserId ?? null,
        coaStructureFreezeEffectiveDate: (t as any)?.coaStructureFreezeEffectiveDate ?? null,
      },
      tree: roots,
    };
  }

  async create(
    req: Request,
    dto: CreateCoaAccountDto,
    opts?: { bypassStructureFreeze?: boolean },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    await this.assertCoaNotFrozen(tenant.id);
    if (!opts?.bypassStructureFreeze) {
      await this.assertCoaStructureNotFrozen({
        tenantId: tenant.id,
        userId: user.id,
        permissionUsed: PERMISSIONS.COA.DRAFT_CREATE,
        action: 'COA_CREATE',
        reason: {
          action: 'COA_CREATE',
          code: dto.code ?? null,
          name: dto.name ?? null,
          accountType: dto.accountType ?? null,
          parentAccountId: dto.parentAccountId ?? null,
        },
      });
    }
    await this.assertCoaNotLocked({ tenantId: tenant.id, operation: 'create' });

    const naming = await this.namingPolicy.validateAccountNamingPolicy({
      tenantId: tenant.id,
      code: dto.code,
      name: dto.name,
    });

    if (naming.issues.length > 0) {
      throw new BadRequestException({
        message: 'Invalid account naming',
        issues: naming.issues,
      } as any);
    }

    const fs1 = String(dto.fsMappingLevel1 ?? '').trim();
    if (!fs1) {
      throw new BadRequestException('FS Mapping Level 1 is required');
    }

    const ifrsCode = dto.ifrsCode ? String(dto.ifrsCode).trim() : null;
    const legacyIfrsNodeId = dto.ifrsNodeId ? String(dto.ifrsNodeId).trim() : null;
    const ifrsNodeId = ifrsCode
      ? await this.prisma.ifrsNode
          .findFirst({
            where: { tenantId: tenant.id, code: ifrsCode },
            select: { id: true },
          })
          .then((n) => (n ? String((n as any).id) : null))
      : legacyIfrsNodeId;

    if (ifrsCode && !ifrsNodeId) {
      throw new BadRequestException('IFRS code not found');
    }
    if (!ifrsCode && legacyIfrsNodeId) {
      const node = await this.prisma.ifrsNode.findFirst({
        where: { tenantId: tenant.id, id: legacyIfrsNodeId },
        select: { id: true },
      });
      if (!node) throw new BadRequestException('IFRS node not found');
    }

    const parentAccountId = dto.parentAccountId ?? null;
    if (parentAccountId) {
      await this.assertParentValid({ tenantId: tenant.id, parentAccountId });
    }

    const isPosting = dto.isPostingAllowed ?? dto.isPosting ?? true;

    if (isPosting && !ifrsNodeId) {
      throw new BadRequestException(
        'IFRS code is required for posting accounts',
      );
    }

    const created = await this.prisma.account.create({
      data: {
        tenantId: tenant.id,
        code: naming.normalizedCode,
        name: naming.normalizedName,
        type: dto.accountType,
        subCategory: dto.subCategory,
        fsMappingLevel1: fs1,
        fsMappingLevel2: dto.fsMappingLevel2,
        ifrsNodeId,
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
            code: naming.normalizedCode,
            name: naming.normalizedName,
            accountType: dto.accountType,
          }),
          userId: user.id,
          permissionUsed: PERMISSIONS.COA.UPDATE,
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
    await this.assertCoaStructureNotFrozen({
      tenantId: tenant.id,
      userId: user.id,
      permissionUsed: PERMISSIONS.COA.UPDATE,
      action: 'COA_SETUP_TAX_CONTROL_ACCOUNTS',
      reason: { action: 'COA_SETUP_TAX_CONTROL_ACCOUNTS' },
    });
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
              permissionUsed: PERMISSIONS.COA.UPDATE,
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
        ifrsNodeId: true,
        fsMappingLevel1: true,
      },
    });
    if (!existing) throw new NotFoundException('Account not found');

    const nextFsMappingLevel1 =
      dto.fsMappingLevel1 === undefined
        ? String((existing as any).fsMappingLevel1 ?? '').trim()
        : String(dto.fsMappingLevel1 ?? '').trim();
    if (!nextFsMappingLevel1) {
      throw new BadRequestException('FS Mapping Level 1 is required');
    }

    const ifrsCode =
      dto.ifrsCode === undefined || dto.ifrsCode === null
        ? null
        : String(dto.ifrsCode).trim();
    const legacyIfrsNodeId =
      dto.ifrsNodeId === undefined || dto.ifrsNodeId === null
        ? null
        : String(dto.ifrsNodeId).trim();
    const resolvedIfrsNodeId = ifrsCode
      ? await this.prisma.ifrsNode
          .findFirst({
            where: { tenantId: tenant.id, code: ifrsCode },
            select: { id: true },
          })
          .then((n) => (n ? String((n as any).id) : null))
      : legacyIfrsNodeId;
    if (ifrsCode && !resolvedIfrsNodeId) {
      throw new BadRequestException('IFRS code not found');
    }
    if (!ifrsCode && legacyIfrsNodeId) {
      const node = await this.prisma.ifrsNode.findFirst({
        where: { tenantId: tenant.id, id: legacyIfrsNodeId },
        select: { id: true },
      });
      if (!node) throw new BadRequestException('IFRS node not found');
    }

    const wantsStructuralChange =
      (dto.code !== undefined && String(dto.code ?? '') !== String(existing.code ?? '')) ||
      (dto.accountType !== undefined &&
        String(dto.accountType ?? '') !== String((existing as any).type ?? '')) ||
      (dto.parentAccountId !== undefined &&
        String(dto.parentAccountId ?? '') !==
          String((existing as any).parentAccountId ?? '')) ||
      (dto.ifrsMappingCode !== undefined &&
        String(dto.ifrsMappingCode ?? '') !==
          String((existing as any).ifrsMappingCode ?? '')) ||
      (dto.ifrsNodeId !== undefined &&
        String(dto.ifrsNodeId ?? '') !== String((existing as any).ifrsNodeId ?? '')) ||
      (dto.ifrsCode !== undefined && dto.ifrsCode !== null) ||
      (dto.fsMappingLevel1 !== undefined &&
        String(dto.fsMappingLevel1 ?? '') !==
          String((existing as any).fsMappingLevel1 ?? '')) ||
      (dto.fsMappingLevel2 !== undefined &&
        String(dto.fsMappingLevel2 ?? '') !==
          String((existing as any).fsMappingLevel2 ?? ''));

    if (wantsStructuralChange) {
      await this.assertCoaStructureNotFrozen({
        tenantId: tenant.id,
        userId: user.id,
        permissionUsed: PERMISSIONS.COA.DRAFT_EDIT,
        action: 'COA_UPDATE',
        reason: {
          action: 'COA_UPDATE',
          accountId: id,
          patch: {
            code: dto.code,
            accountType: dto.accountType,
            parentAccountId: dto.parentAccountId,
            ifrsMappingCode: dto.ifrsMappingCode,
            fsMappingLevel1: dto.fsMappingLevel1,
            fsMappingLevel2: dto.fsMappingLevel2,
          },
        },
      });
    }

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

    const nextIfrsNodeId =
      dto.ifrsCode !== undefined
        ? resolvedIfrsNodeId
        : dto.ifrsNodeId !== undefined
          ? resolvedIfrsNodeId
          : String((existing as any).ifrsNodeId ?? '').trim() || null;
    if (nextIsPosting && !nextIfrsNodeId) {
      throw new BadRequestException('IFRS code is required for posting accounts');
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
        fsMappingLevel1:
          dto.fsMappingLevel1 === undefined ? undefined : nextFsMappingLevel1,
        fsMappingLevel2: dto.fsMappingLevel2,
        parentAccountId:
          parentAccountId === undefined ? undefined : parentAccountId,
        ...postingPatch,
        isControlAccount: dto.isControlAccount,
        normalBalance: (dto.normalBalance as any) ?? undefined,
        isActive: dto.isActive,
        ifrsMappingCode: dto.ifrsMappingCode,
        ifrsNodeId:
          dto.ifrsCode !== undefined || dto.ifrsNodeId !== undefined
            ? nextIfrsNodeId
            : undefined,
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
            permissionUsed: PERMISSIONS.COA.UPDATE,
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
          permissionUsed: PERMISSIONS.COA.UPDATE,
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
          permissionUsed: PERMISSIONS.COA.FREEZE,
        },
      })
      .catch(() => undefined);

    return updated;
  }

  async structureFreeze(req: Request, dto?: { effectiveDate?: string | Date }) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const now = new Date();
    const effectiveDateRaw = dto?.effectiveDate;
    const effectiveDate = effectiveDateRaw ? new Date(effectiveDateRaw as any) : now;

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        coaStructureFrozen: true as any,
        coaStructureFrozenAt: now as any,
        coaStructureFrozenByUserId: user.id as any,
        coaStructureFreezeEffectiveDate: effectiveDate as any,
      } as any,
      select: {
        id: true,
        coaStructureFrozen: true,
        coaStructureFrozenAt: true,
        coaStructureFrozenByUserId: true,
        coaStructureFreezeEffectiveDate: true,
      } as any,
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'COA_STRUCTURE_FREEZE' as any,
          entityType: 'TENANT' as any,
          entityId: updated.id,
          action: 'COA_STRUCTURE_FREEZE',
          outcome: 'SUCCESS' as any,
          reason: JSON.stringify({
            action: 'COA_STRUCTURE_FREEZE',
            effectiveDate: effectiveDate.toISOString(),
            timestamp: now.toISOString(),
          }),
          userId: user.id,
          permissionUsed: PERMISSIONS.COA.FREEZE,
        } as any,
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
          permissionUsed: PERMISSIONS.COA.FREEZE,
        },
      })
      .catch(() => undefined);

    return updated;
  }

  async structureUnfreeze(req: Request) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const now = new Date();
    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        coaStructureFrozen: false as any,
        coaStructureFrozenAt: null as any,
        coaStructureFrozenByUserId: user.id as any,
      } as any,
      select: {
        id: true,
        coaStructureFrozen: true,
        coaStructureFrozenAt: true,
        coaStructureFrozenByUserId: true,
        coaStructureFreezeEffectiveDate: true,
      } as any,
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'COA_STRUCTURE_UNFREEZE' as any,
          entityType: 'TENANT' as any,
          entityId: updated.id,
          action: 'COA_STRUCTURE_UNFREEZE',
          outcome: 'SUCCESS' as any,
          reason: JSON.stringify({
            action: 'COA_STRUCTURE_UNFREEZE',
            timestamp: now.toISOString(),
          }),
          userId: user.id,
          permissionUsed: PERMISSIONS.COA.FREEZE,
        } as any,
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

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: 'COA_LOCKED' as any,
        entityType: 'TENANT' as any,
        entityId: updated.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'COA_LOCKED',
        permissionUsed: PERMISSIONS.COA.UNLOCK,
        metadata: {
          governance: buildGovernanceAuditMetadata({
            actionType: 'COA_LOCK',
            permissionUsed: PERMISSIONS.COA.UNLOCK,
            actorUserId: user.id,
            tenantId: tenant.id,
            req,
            changedKeys: ['coaLockedAt'],
            before: { coaLockedAt: 'LOCKED' },
            after: updated,
            escalation: (req as any)?.governanceEscalation ?? undefined,
          }),
        },
      },
      this.prisma,
    );

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

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: 'COA_UNLOCKED' as any,
        entityType: 'TENANT' as any,
        entityId: updated.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'COA_UNLOCKED',
        permissionUsed: PERMISSIONS.COA.UNLOCK,
        metadata: {
          governance: buildGovernanceAuditMetadata({
            actionType: 'COA_UNLOCK',
            permissionUsed: PERMISSIONS.COA.UNLOCK,
            actorUserId: user.id,
            tenantId: tenant.id,
            req,
            changedKeys: ['coaLockedAt'],
            before: { coaLockedAt: 'LOCKED' },
            after: updated,
            escalation: (req as any)?.governanceEscalation ?? undefined,
          }),
        },
      },
      this.prisma,
    );

    return updated;
  }
}
