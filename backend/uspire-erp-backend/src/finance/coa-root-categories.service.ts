import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/permission-catalog';

type RequestContext = Request;

@Injectable()
export class CoaRootCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCoaNotFrozen(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { coaFrozen: true },
    });
    if (t?.coaFrozen) throw new ForbiddenException('Chart of Accounts is frozen');
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
    operation: 'create' | 'update';
  }) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { coaLockedAt: true },
    });
    if (!t?.coaLockedAt) return;

    if (params.operation === 'create') {
      throw new ForbiddenException(
        'Chart of Accounts is locked: cannot create root categories',
      );
    }
    throw new ForbiddenException(
      'Chart of Accounts is locked: cannot update root categories',
    );
  }

  private assertNumericCode(code: string) {
    const c = String(code ?? '').trim();
    if (!c) throw new BadRequestException('code is required');
    if (!/^[0-9]+$/.test(c)) {
      throw new BadRequestException('code must be a numeric string');
    }
  }

  private resolveNormalBalance(accountType: string) {
    const t = String(accountType ?? '').trim().toUpperCase();
    if (t === 'ASSET' || t === 'EXPENSE') return 'DEBIT';
    return 'CREDIT';
  }

  async list(req: RequestContext) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const rows = await (this.prisma as any).coaRootCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ code: 'asc' }],
    });

    return { rootCategories: rows };
  }

  async create(
    req: RequestContext,
    dto: {
      code: string;
      name: string;
      accountType: any;
      ifrsMappingCode?: string | null;
      fsMappingLevel1?: string | null;
      fsMappingLevel2?: string | null;
    },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    await this.assertCoaNotFrozen(tenant.id);
    await this.assertCoaStructureNotFrozen({
      tenantId: tenant.id,
      userId: user.id,
      permissionUsed: PERMISSIONS.COA.UNLOCK,
      action: 'COA_ROOT_CATEGORY_CREATE',
      reason: {
        action: 'COA_ROOT_CATEGORY_CREATE',
        code: dto.code ?? null,
        name: dto.name ?? null,
      },
    });
    await this.assertCoaNotLocked({ tenantId: tenant.id, operation: 'create' });

    const code = String(dto.code ?? '').trim();
    const name = String(dto.name ?? '').trim();
    this.assertNumericCode(code);
    if (!name) throw new BadRequestException('name is required');

    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await (tx as any).coaRootCategory.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [{ code }, { name }],
        },
        select: { id: true, code: true, name: true },
      });
      if (existing) {
        throw new ConflictException(
          `Root category already exists (code '${existing.code}' / name '${existing.name}')`,
        );
      }

      const existingAccountByCode = await tx.account.findFirst({
        where: { tenantId: tenant.id, code },
        select: { id: true },
      });
      if (existingAccountByCode) {
        throw new ConflictException(
          `Account code '${code}' already exists; cannot create root category`,
        );
      }

      const root = await (tx as any).coaRootCategory.create({
        data: {
          tenantId: tenant.id,
          code,
          name,
          accountType: dto.accountType,
          ifrsMappingCode: dto.ifrsMappingCode ?? null,
          fsMappingLevel1: dto.fsMappingLevel1 ?? null,
          fsMappingLevel2: dto.fsMappingLevel2 ?? null,
          isActive: true,
          createdById: user.id,
        },
      });

      const account = await tx.account.create({
        data: {
          tenantId: tenant.id,
          code,
          name,
          type: dto.accountType,
          status: 'ACTIVE' as any,
          approvedAt: new Date() as any,
          approvedById: user.id,
          createdById: user.id,
          parentAccountId: null,
          isPosting: false,
          isPostingAllowed: false,
          isControlAccount: false,
          normalBalance: this.resolveNormalBalance(dto.accountType) as any,
          isBudgetRelevant: false,
          budgetControlMode: 'NONE' as any,
          ifrsMappingCode: dto.ifrsMappingCode ?? null,
          fsMappingLevel1: dto.fsMappingLevel1 ?? null,
          fsMappingLevel2: dto.fsMappingLevel2 ?? null,
          hierarchyPath: undefined,
        } as any,
        select: { id: true },
      });

      await tx.account.updateMany({
        where: { tenantId: tenant.id, id: account.id },
        data: { hierarchyPath: account.id },
      });

      await tx.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'COA_ROOT_CATEGORY_CREATED' as any,
            entityType: 'ACCOUNT' as any,
            entityId: account.id,
            action: 'COA_ROOT_CATEGORY_CREATED',
            outcome: 'SUCCESS',
            reason: JSON.stringify({
              action: 'COA_ROOT_CATEGORY_CREATED',
              rootCategoryId: root.id,
              accountId: account.id,
              code,
              timestamp: new Date().toISOString(),
            }),
            userId: user.id,
            permissionUsed: PERMISSIONS.COA.UNLOCK,
          },
        })
        .catch(() => undefined);

      return { root, accountId: account.id };
    });

    const account = await this.prisma.account.findFirst({
      where: { tenantId: tenant.id, id: created.accountId },
    });

    return { rootCategory: created.root, account };
  }

  async update(
    req: RequestContext,
    id: string,
    dto: {
      name?: string;
      ifrsMappingCode?: string | null;
      fsMappingLevel1?: string | null;
      fsMappingLevel2?: string | null;
    },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    await this.assertCoaNotFrozen(tenant.id);
    await this.assertCoaStructureNotFrozen({
      tenantId: tenant.id,
      userId: user.id,
      permissionUsed: PERMISSIONS.COA.UNLOCK,
      action: 'COA_ROOT_CATEGORY_UPDATE',
      reason: { action: 'COA_ROOT_CATEGORY_UPDATE', rootCategoryId: id, patch: dto },
    });
    await this.assertCoaNotLocked({ tenantId: tenant.id, operation: 'update' });

    const row = await (this.prisma as any).coaRootCategory.findFirst({
      where: { tenantId: tenant.id, id },
    });
    if (!row) throw new NotFoundException('Root category not found');

    const nextName = dto.name === undefined ? row.name : String(dto.name ?? '').trim();
    if (!nextName) throw new BadRequestException('name is required');

    const updated = await this.prisma.$transaction(async (tx) => {
      if (nextName !== row.name) {
        const conflict = await (tx as any).coaRootCategory.findFirst({
          where: { tenantId: tenant.id, name: nextName, id: { not: row.id } },
          select: { id: true },
        });
        if (conflict) throw new ConflictException('Root category name must be unique');
      }

      const root = await (tx as any).coaRootCategory.update({
        where: { id: row.id },
        data: {
          name: nextName,
          ifrsMappingCode:
            dto.ifrsMappingCode === undefined ? row.ifrsMappingCode : (dto.ifrsMappingCode ?? null),
          fsMappingLevel1:
            dto.fsMappingLevel1 === undefined ? row.fsMappingLevel1 : (dto.fsMappingLevel1 ?? null),
          fsMappingLevel2:
            dto.fsMappingLevel2 === undefined ? row.fsMappingLevel2 : (dto.fsMappingLevel2 ?? null),
        },
      });

      const account = await tx.account.findFirst({
        where: { tenantId: tenant.id, code: row.code },
        select: { id: true },
      });
      if (!account) {
        throw new NotFoundException(
          `Linked account for root category code '${row.code}' not found`,
        );
      }

      await tx.account.updateMany({
        where: { tenantId: tenant.id, id: account.id },
        data: {
          name: nextName,
          ifrsMappingCode: root.ifrsMappingCode,
          fsMappingLevel1: root.fsMappingLevel1,
          fsMappingLevel2: root.fsMappingLevel2,
        } as any,
      });

      await tx.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'COA_ROOT_CATEGORY_UPDATED' as any,
            entityType: 'ACCOUNT' as any,
            entityId: account.id,
            action: 'COA_ROOT_CATEGORY_UPDATED',
            outcome: 'SUCCESS',
            reason: JSON.stringify({
              action: 'COA_ROOT_CATEGORY_UPDATED',
              rootCategoryId: root.id,
              accountId: account.id,
              timestamp: new Date().toISOString(),
            }),
            userId: user.id,
            permissionUsed: PERMISSIONS.COA.UNLOCK,
          },
        })
        .catch(() => undefined);

      return { root, accountId: account.id };
    });

    const account = await this.prisma.account.findFirst({
      where: { tenantId: tenant.id, code: row.code },
    });

    return { rootCategory: updated.root, account };
  }

  async disable(req: RequestContext, id: string, dto: { force?: boolean }) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    await this.assertCoaNotFrozen(tenant.id);
    await this.assertCoaStructureNotFrozen({
      tenantId: tenant.id,
      userId: user.id,
      permissionUsed: PERMISSIONS.COA.UNLOCK,
      action: 'COA_ROOT_CATEGORY_DISABLE',
      reason: {
        action: 'COA_ROOT_CATEGORY_DISABLE',
        rootCategoryId: id,
        force: dto.force ?? false,
      },
    });
    await this.assertCoaNotLocked({ tenantId: tenant.id, operation: 'update' });

    const row = await (this.prisma as any).coaRootCategory.findFirst({
      where: { tenantId: tenant.id, id },
    });
    if (!row) throw new NotFoundException('Root category not found');

    const force = Boolean(dto?.force);

    const account = await this.prisma.account.findFirst({
      where: { tenantId: tenant.id, code: row.code },
      select: { id: true },
    });
    if (!account) {
      throw new NotFoundException(
        `Linked account for root category code '${row.code}' not found`,
      );
    }

    const child = await this.prisma.account.findFirst({
      where: { tenantId: tenant.id, parentAccountId: account.id },
      select: { id: true },
    });
    if (child && !force) {
      throw new BadRequestException(
        'Cannot disable a root category that has child accounts',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).coaRootCategory.update({
        where: { id: row.id },
        data: { isActive: false },
      });

      // Governance choice: BLOCK the linked account (keeps history and prevents posting).
      await tx.account.updateMany({
        where: { tenantId: tenant.id, id: account.id },
        data: {
          status: 'BLOCKED' as any,
          blockedAt: new Date() as any,
          blockedById: user.id,
          isActive: false,
        } as any,
      });

      await tx.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'COA_ROOT_CATEGORY_DISABLED' as any,
            entityType: 'ACCOUNT' as any,
            entityId: account.id,
            action: 'COA_ROOT_CATEGORY_DISABLED',
            outcome: 'SUCCESS',
            reason: JSON.stringify({
              action: 'COA_ROOT_CATEGORY_DISABLED',
              rootCategoryId: row.id,
              accountId: account.id,
              force,
              timestamp: new Date().toISOString(),
            }),
            userId: user.id,
            permissionUsed: PERMISSIONS.COA.UNLOCK,
          },
        })
        .catch(() => undefined);
    });

    return { ok: true };
  }

  async setupDefault(req: RequestContext) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    await this.assertCoaNotFrozen(tenant.id);
    await this.assertCoaStructureNotFrozen({
      tenantId: tenant.id,
      userId: user.id,
      permissionUsed: PERMISSIONS.COA.UNLOCK,
      action: 'COA_ROOT_CATEGORY_SETUP_DEFAULT',
      reason: { action: 'COA_ROOT_CATEGORY_SETUP_DEFAULT' },
    });
    await this.assertCoaNotLocked({ tenantId: tenant.id, operation: 'create' });

    const defaults = [
      { code: '10000', name: 'Assets', accountType: 'ASSET' as const },
      { code: '20000', name: 'Liabilities', accountType: 'LIABILITY' as const },
      { code: '30000', name: 'Equity', accountType: 'EQUITY' as const },
      { code: '40000', name: 'Income', accountType: 'INCOME' as const },
      { code: '50000', name: 'Cost of Sales', accountType: 'EXPENSE' as const },
      { code: '60000', name: 'Operating Expenses', accountType: 'EXPENSE' as const },
      { code: '70000', name: 'Other Income', accountType: 'INCOME' as const },
      { code: '80000', name: 'Other Expenses', accountType: 'EXPENSE' as const },
    ];

    const createdRoots: any[] = [];
    let createdCount = 0;
    let skippedCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const d of defaults) {
        const existing = await (tx as any).coaRootCategory.findFirst({
          where: { tenantId: tenant.id, code: d.code },
          select: { id: true },
        });
        if (existing) {
          skippedCount += 1;
          continue;
        }

        const existingAccountByCode = await tx.account.findFirst({
          where: { tenantId: tenant.id, code: d.code },
          select: { id: true, name: true, type: true },
        });

        const root = await (tx as any).coaRootCategory.create({
          data: {
            tenantId: tenant.id,
            code: d.code,
            name: String(existingAccountByCode?.name ?? d.name),
            accountType: (existingAccountByCode?.type ?? d.accountType) as any,
            isActive: true,
            createdById: user.id,
          },
        });

        if (existingAccountByCode) {
          await tx.account.updateMany({
            where: { tenantId: tenant.id, id: existingAccountByCode.id },
            data: {
              parentAccountId: null,
              isPosting: false,
              isPostingAllowed: false,
              normalBalance: this.resolveNormalBalance(root.accountType) as any,
            } as any,
          });

          createdRoots.push({ rootCategory: root, accountId: existingAccountByCode.id });
          createdCount += 1;
          continue;
        }

        const account = await tx.account.create({
          data: {
            tenantId: tenant.id,
            code: d.code,
            name: d.name,
            type: d.accountType as any,
            status: 'ACTIVE' as any,
            approvedAt: new Date() as any,
            approvedById: user.id,
            createdById: user.id,
            parentAccountId: null,
            isPosting: false,
            isPostingAllowed: false,
            isControlAccount: false,
            normalBalance: this.resolveNormalBalance(d.accountType) as any,
            isBudgetRelevant: false,
            budgetControlMode: 'NONE' as any,
          } as any,
          select: { id: true },
        });

        await tx.account.updateMany({
          where: { tenantId: tenant.id, id: account.id },
          data: { hierarchyPath: account.id },
        });

        createdRoots.push({ rootCategory: root, accountId: account.id });
        createdCount += 1;
      }

      await tx.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'COA_ROOT_CATEGORY_SETUP_DEFAULT' as any,
            entityType: 'TENANT' as any,
            entityId: tenant.id,
            action: 'COA_ROOT_CATEGORY_SETUP_DEFAULT',
            outcome: 'SUCCESS',
            reason: JSON.stringify({
              action: 'COA_ROOT_CATEGORY_SETUP_DEFAULT',
              createdCount,
              skippedCount,
              timestamp: new Date().toISOString(),
            }),
            userId: user.id,
            permissionUsed: PERMISSIONS.COA.UNLOCK,
          },
        })
        .catch(() => undefined);
    });

    return { createdCount, skippedCount, createdRoots };
  }
}
