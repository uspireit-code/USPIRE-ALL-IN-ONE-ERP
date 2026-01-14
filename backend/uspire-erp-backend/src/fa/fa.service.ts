import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AuditEntityType,
  AuditEventType,
  Prisma,
  type FixedAssetStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GlService } from '../gl/gl.service';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { assertCanPost } from '../periods/period-guard';
import { CreateFixedAssetCategoryDto } from './dto/create-fa-category.dto';
import { CreateFixedAssetDto } from './dto/create-fa-asset.dto';
import { CapitalizeFixedAssetDto } from './dto/capitalize-fa-asset.dto';
import { DisposeFixedAssetDto } from './dto/dispose-fa-asset.dto';

@Injectable()
export class FaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gl: GlService,
  ) {}

  async listCategories(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.prisma.fixedAssetCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: { code: 'asc' },
    });
  }

  async createCategory(req: Request, dto: CreateFixedAssetCategoryDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    await this.assertAccountsExist({
      tenantId: tenant.id,
      accountIds: [
        dto.assetAccountId,
        dto.accumDepAccountId,
        dto.depExpenseAccountId,
      ],
    });

    return this.prisma.fixedAssetCategory.create({
      data: {
        tenantId: tenant.id,
        code: dto.code,
        name: dto.name,
        defaultMethod: dto.defaultMethod,
        defaultUsefulLifeMonths: dto.defaultUsefulLifeMonths,
        defaultResidualRate: dto.defaultResidualRate
          ? new Prisma.Decimal(dto.defaultResidualRate)
          : null,
        assetAccountId: dto.assetAccountId,
        accumDepAccountId: dto.accumDepAccountId,
        depExpenseAccountId: dto.depExpenseAccountId,
      },
    });
  }

  async listAssets(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.prisma.fixedAsset.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    });
  }

  async createAsset(req: Request, dto: CreateFixedAssetDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const acquisitionDate = new Date(dto.acquisitionDate);
    if (Number.isNaN(acquisitionDate.getTime())) {
      throw new BadRequestException('Invalid acquisitionDate');
    }

    const category = await this.prisma.fixedAssetCategory.findFirst({
      where: { id: dto.categoryId, tenantId: tenant.id },
      select: {
        id: true,
        defaultMethod: true,
        defaultUsefulLifeMonths: true,
        defaultResidualRate: true,
      },
    });

    if (!category) {
      throw new BadRequestException('Category not found');
    }

    const cost = new Prisma.Decimal(dto.cost);
    const residualValue = new Prisma.Decimal(dto.residualValue);

    if (cost.lessThan(0) || residualValue.lessThan(0)) {
      throw new BadRequestException('cost and residualValue must be >= 0');
    }

    if (residualValue.greaterThan(cost)) {
      throw new BadRequestException('residualValue cannot exceed cost');
    }

    return this.prisma.fixedAsset.create({
      data: {
        tenantId: tenant.id,
        createdById: user.id,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description ?? null,
        acquisitionDate,
        cost,
        residualValue,
        usefulLifeMonths:
          dto.usefulLifeMonths || category.defaultUsefulLifeMonths,
        method: dto.method || category.defaultMethod,
        vendorId: dto.vendorId ?? null,
        apInvoiceId: dto.apInvoiceId ?? null,
        status: 'DRAFT',
      },
      include: { category: true },
    });
  }

  async capitalizeAsset(
    req: Request,
    id: string,
    dto: CapitalizeFixedAssetDto,
  ) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const capitalizationDate = new Date(dto.capitalizationDate);
    if (Number.isNaN(capitalizationDate.getTime())) {
      throw new BadRequestException('Invalid capitalizationDate');
    }

    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id, tenantId: tenant.id },
      include: { category: true },
    });

    if (!asset) throw new NotFoundException('Fixed asset not found');

    if (asset.status !== 'DRAFT') {
      throw new BadRequestException(
        `Asset must be DRAFT to capitalize (status=${asset.status})`,
      );
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        startDate: { lte: capitalizationDate },
        endDate: { gte: capitalizationDate },
      },
      select: { id: true, status: true, name: true },
    });

    if (!period) {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.FA_CAPITALIZE,
          entityType: AuditEntityType.FIXED_ASSET,
          entityId: id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'FA_ASSET_CAPITALIZE',
          permissionUsed: PERMISSIONS.FA.ASSET_CAPITALIZE,
          reason: 'No accounting period exists for the capitalization date',
          metadata: {
            periodId: null,
            periodName: null,
            periodStatus: null,
          },
        },
        this.prisma,
      ).catch(() => undefined);

      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: 'No accounting period exists for the capitalization date',
      });
    }

    try {
      assertCanPost(period.status, { periodName: period.name });
    } catch {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.FA_CAPITALIZE,
          entityType: AuditEntityType.FIXED_ASSET,
          entityId: id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'FA_ASSET_CAPITALIZE',
          permissionUsed: PERMISSIONS.FA.ASSET_CAPITALIZE,
          reason: `Accounting period is not OPEN: ${period.name}`,
          metadata: {
            periodId: period.id,
            periodName: period.name,
            periodStatus: period.status,
          },
        },
        this.prisma,
      ).catch(() => undefined);

      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: `Accounting period is not OPEN: ${period.name}`,
      });
    }

    await this.assertAccountsExist({
      tenantId: tenant.id,
      accountIds: [
        dto.assetAccountId,
        dto.accumDepAccountId,
        dto.depExpenseAccountId,
        dto.clearingAccountId,
      ],
    });

    const reference = dto.reference ?? `FA-CAP:${asset.id}`;
    const description =
      dto.description ?? `Fixed asset capitalization: ${asset.name}`;

    const journalCreatedById =
      (asset as any).createdById ??
      (await this.findGlPreparerUserId({ tenantId: tenant.id }).catch(
        () => user.id,
      ));

    const journal = await this.prisma.journalEntry.create({
      data: {
        tenantId: tenant.id,
        journalDate: capitalizationDate,
        reference,
        description,
        createdById: journalCreatedById,
        lines: {
          create: [
            { accountId: dto.assetAccountId, debit: asset.cost, credit: 0 },
            { accountId: dto.clearingAccountId, debit: 0, credit: asset.cost },
          ],
        },
      },
      select: { id: true },
    });

    const posted = await this.gl.postJournal(req, journal.id);

    const updatedAsset = await this.prisma.fixedAsset.update({
      where: { id: asset.id },
      data: {
        status: 'CAPITALIZED',
        capitalizationDate,
        assetAccountId: dto.assetAccountId,
        accumDepAccountId: dto.accumDepAccountId,
        depExpenseAccountId: dto.depExpenseAccountId,
        capitalizationJournalId: posted.id,
      },
      include: { category: true },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.FA_CAPITALIZE,
        entityType: AuditEntityType.FIXED_ASSET,
        entityId: asset.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FA_ASSET_CAPITALIZE',
        permissionUsed: PERMISSIONS.FA.ASSET_CAPITALIZE,
        metadata: {
          assetId: asset.id,
          capitalizationJournalId: posted.id,
        },
      },
      this.prisma,
    ).catch(() => undefined);

    return updatedAsset;
  }

  async runDepreciationForPeriod(req: Request, periodId: string) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!period) throw new NotFoundException('Accounting period not found');

    try {
      assertCanPost(period.status, { periodName: period.name });
    } catch {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.FA_DEPRECIATION_RUN,
          entityType: AuditEntityType.ACCOUNTING_PERIOD,
          entityId: period.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'FA_DEPRECIATION_RUN',
          permissionUsed: PERMISSIONS.FA.DEPRECIATION_RUN,
          reason: `Accounting period is not OPEN: ${period.name}`,
          metadata: {
            periodId: period.id,
            periodName: period.name,
            periodStatus: period.status,
          },
        },
        this.prisma,
      ).catch(() => undefined);

      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: `Accounting period is not OPEN: ${period.name}`,
      });
    }

    const existingRun = await this.prisma.fixedAssetDepreciationRun.findFirst({
      where: { tenantId: tenant.id, periodId: period.id },
      select: { id: true },
    });

    if (existingRun) {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.FA_DEPRECIATION_RUN,
          entityType: AuditEntityType.ACCOUNTING_PERIOD,
          entityId: period.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'FAILED' as any,
          action: 'FA_DEPRECIATION_RUN',
          permissionUsed: PERMISSIONS.FA.DEPRECIATION_RUN,
          reason: 'Depreciation already run for this period',
          metadata: {
            periodId: period.id,
            periodName: period.name,
            periodStatus: period.status,
          },
        },
        this.prisma,
      ).catch(() => undefined);

      throw new BadRequestException('Depreciation already run for this period');
    }

    const assets = await this.prisma.fixedAsset.findMany({
      where: {
        tenantId: tenant.id,
        status: 'CAPITALIZED',
        capitalizationDate: { not: null, lte: period.startDate },
      },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!assets.length) {
      const run = await this.prisma.fixedAssetDepreciationRun.create({
        data: {
          tenantId: tenant.id,
          periodId: period.id,
          postedById: user.id,
          status: 'POSTED',
        },
      });

      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.FA_DEPRECIATION_RUN,
          entityType: AuditEntityType.FIXED_ASSET_DEPRECIATION_RUN,
          entityId: run.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'SUCCESS' as any,
          action: 'FA_DEPRECIATION_RUN',
          permissionUsed: PERMISSIONS.FA.DEPRECIATION_RUN,
          reason: 'No eligible assets; recorded empty depreciation run',
          metadata: {
            periodId: period.id,
            depreciationRunId: run.id,
          },
        },
        this.prisma,
      ).catch(() => undefined);

      return { run, journalEntry: null, totals: [] as Array<any> };
    }

    // Group postings by (depExpenseAccountId, accumDepAccountId)
    const totalsByPair = new Map<
      string,
      {
        depExpenseAccountId: string;
        accumDepAccountId: string;
        amount: Prisma.Decimal;
      }
    >();

    const lineCreates: Array<{
      tenantId: string;
      runId: string;
      assetId: string;
      amount: Prisma.Decimal;
    }> = [];

    let run: { id: string; tenantId: string; periodId: string };
    try {
      run = await this.prisma.fixedAssetDepreciationRun.create({
        data: {
          tenantId: tenant.id,
          periodId: period.id,
          postedById: user.id,
          status: 'POSTED',
        },
        select: { id: true, tenantId: true, periodId: true },
      });
    } catch (e: any) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Depreciation already run for this period',
        );
      }
      throw e;
    }

    for (const a of assets) {
      if (!a.depExpenseAccountId || !a.accumDepAccountId) {
        throw new BadRequestException(
          'Capitalized asset missing depreciation accounts',
        );
      }

      const base = new Prisma.Decimal(a.cost).minus(
        new Prisma.Decimal(a.residualValue),
      );
      const monthly =
        a.usefulLifeMonths > 0
          ? base.div(new Prisma.Decimal(a.usefulLifeMonths))
          : new Prisma.Decimal(0);
      const amount = monthly;

      if (amount.lte(0)) {
        continue;
      }

      lineCreates.push({
        tenantId: tenant.id,
        runId: run.id,
        assetId: a.id,
        amount,
      });

      const key = `${a.depExpenseAccountId}::${a.accumDepAccountId}`;
      const prev = totalsByPair.get(key);
      if (!prev) {
        totalsByPair.set(key, {
          depExpenseAccountId: a.depExpenseAccountId,
          accumDepAccountId: a.accumDepAccountId,
          amount,
        });
      } else {
        prev.amount = prev.amount.plus(amount);
      }
    }

    await this.prisma.fixedAssetDepreciationLine.createMany({
      data: lineCreates,
      skipDuplicates: true,
    });

    const totals = [...totalsByPair.values()].filter((t) => t.amount.gt(0));

    if (!totals.length) {
      return { run, journalEntry: null, totals: [] as Array<any> };
    }

    await this.assertAccountsExist({
      tenantId: tenant.id,
      accountIds: totals.flatMap((t) => [
        t.depExpenseAccountId,
        t.accumDepAccountId,
      ]),
    });

    const journalDate = period.endDate;
    const reference = `FA-DEPR:${period.id}`;
    const description = `Fixed asset depreciation: ${period.name}`;

    const lines: Array<{
      accountId: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
    }> = [];

    for (const t of totals) {
      lines.push({
        accountId: t.depExpenseAccountId,
        debit: t.amount,
        credit: new Prisma.Decimal(0),
      });
      lines.push({
        accountId: t.accumDepAccountId,
        debit: new Prisma.Decimal(0),
        credit: t.amount,
      });
    }

    const preparerUserId = await this.findGlPreparerUserId({
      tenantId: tenant.id,
    });

    const journal = await this.prisma.journalEntry.create({
      data: {
        tenantId: tenant.id,
        journalDate,
        reference,
        description,
        createdById: preparerUserId,
        lines: {
          create: lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
          })),
        },
      },
      select: { id: true },
    });

    const posted = await this.gl.postJournal(req, journal.id);

    const updatedRun = await this.prisma.fixedAssetDepreciationRun.update({
      where: { id: run.id },
      data: { journalEntryId: posted.id },
      include: { lines: true },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.FA_DEPRECIATION_RUN,
        entityType: AuditEntityType.FIXED_ASSET_DEPRECIATION_RUN,
        entityId: updatedRun.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FA_DEPRECIATION_RUN',
        permissionUsed: PERMISSIONS.FA.DEPRECIATION_RUN,
        metadata: {
          periodId: period.id,
          depreciationRunId: updatedRun.id,
          journalEntryId: posted.id,
        },
      },
      this.prisma,
    ).catch(() => undefined);

    return {
      run: updatedRun,
      journalEntry: posted,
      totals: totals.map((t) => ({
        depExpenseAccountId: t.depExpenseAccountId,
        accumDepAccountId: t.accumDepAccountId,
        amount: t.amount,
      })),
    };
  }

  async listDepreciationRuns(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.prisma.fixedAssetDepreciationRun.findMany({
      where: { tenantId: tenant.id },
      orderBy: { runDate: 'desc' },
      include: { lines: true, period: true },
    });
  }

  async disposeAsset(req: Request, id: string, dto: DisposeFixedAssetDto) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const disposalDate = new Date(dto.disposalDate);
    if (Number.isNaN(disposalDate.getTime())) {
      throw new BadRequestException('Invalid disposalDate');
    }

    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        tenantId: true,
        name: true,
        status: true,
        cost: true,
        residualValue: true,
        usefulLifeMonths: true,
        assetAccountId: true,
        accumDepAccountId: true,
      },
    });

    if (!asset) throw new NotFoundException('Fixed asset not found');

    if (asset.status !== 'CAPITALIZED') {
      throw new BadRequestException('Only CAPITALIZED assets can be disposed');
    }

    if (!asset.assetAccountId || !asset.accumDepAccountId) {
      throw new BadRequestException(
        'Asset missing accounts required for disposal',
      );
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        startDate: { lte: disposalDate },
        endDate: { gte: disposalDate },
      },
      select: { id: true, status: true, name: true },
    });

    if (!period) {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.FA_DISPOSE,
          entityType: AuditEntityType.FIXED_ASSET,
          entityId: asset.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'FA_DISPOSE',
          permissionUsed: PERMISSIONS.FA.DISPOSE,
          reason: 'No accounting period exists for the disposal date',
          metadata: {
            assetId: asset.id,
            disposalDate: disposalDate.toISOString(),
            periodId: null,
            periodName: null,
            periodStatus: null,
          },
        },
        this.prisma,
      ).catch(() => undefined);

      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: 'No accounting period exists for the disposal date',
      });
    }

    try {
      assertCanPost(period.status, { periodName: period.name });
    } catch {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.FA_DISPOSE,
          entityType: AuditEntityType.FIXED_ASSET,
          entityId: asset.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'FA_DISPOSE',
          permissionUsed: PERMISSIONS.FA.DISPOSE,
          reason: `Accounting period is not OPEN for disposal date: ${period.name}`,
          metadata: {
            assetId: asset.id,
            disposalDate: disposalDate.toISOString(),
            periodId: period.id,
            periodName: period.name,
            periodStatus: period.status,
          },
        },
        this.prisma,
      ).catch(() => undefined);

      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: `Accounting period is not OPEN for disposal date: ${period.name}`,
      });
    }

    const proceeds = new Prisma.Decimal(dto.proceeds);

    const accumulatedDep = await this.getAccumulatedDepreciationToDate({
      tenantId: tenant.id,
      assetId: asset.id,
      asOf: disposalDate,
      statusFilter: 'CAPITALIZED',
    });

    const carrying = new Prisma.Decimal(asset.cost).minus(accumulatedDep);
    const gainLoss = proceeds.minus(carrying);

    await this.assertAccountsExist({
      tenantId: tenant.id,
      accountIds: [
        dto.proceedsAccountId,
        dto.gainLossAccountId,
        asset.assetAccountId,
        asset.accumDepAccountId,
      ],
    });

    const reference = dto.reference ?? `FA-DISP:${asset.id}`;
    const description =
      dto.description ?? `Fixed asset disposal: ${asset.name}`;

    const lines: Array<{
      accountId: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
    }> = [];

    // Dr proceeds
    if (proceeds.gt(0)) {
      lines.push({
        accountId: dto.proceedsAccountId,
        debit: proceeds,
        credit: new Prisma.Decimal(0),
      });
    }

    // Dr accumulated depreciation
    if (accumulatedDep.gt(0)) {
      lines.push({
        accountId: asset.accumDepAccountId,
        debit: accumulatedDep,
        credit: new Prisma.Decimal(0),
      });
    }

    // Cr asset cost
    lines.push({
      accountId: asset.assetAccountId,
      debit: new Prisma.Decimal(0),
      credit: new Prisma.Decimal(asset.cost),
    });

    // Gain/Loss
    if (gainLoss.gt(0)) {
      // Gain: credit gain/loss
      lines.push({
        accountId: dto.gainLossAccountId,
        debit: new Prisma.Decimal(0),
        credit: gainLoss,
      });
    } else if (gainLoss.lt(0)) {
      // Loss: debit gain/loss
      lines.push({
        accountId: dto.gainLossAccountId,
        debit: gainLoss.abs(),
        credit: new Prisma.Decimal(0),
      });
    }

    const preparerUserId = await this.findGlPreparerUserId({
      tenantId: tenant.id,
    });

    const journal = await this.prisma.journalEntry.create({
      data: {
        tenantId: tenant.id,
        journalDate: disposalDate,
        reference,
        description,
        createdById: preparerUserId,
        lines: {
          create: lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
          })),
        },
      },
      select: { id: true },
    });

    const posted = await this.gl.postJournal(req, journal.id);

    const updatedAsset = await this.prisma.fixedAsset.update({
      where: { id: asset.id },
      data: {
        status: 'DISPOSED',
        disposalJournalId: posted.id,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.FA_DISPOSE,
        entityType: AuditEntityType.FIXED_ASSET,
        entityId: asset.id,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'FA_DISPOSE',
        permissionUsed: PERMISSIONS.FA.DISPOSE,
        metadata: {
          assetId: asset.id,
          disposalJournalId: posted.id,
        },
      },
      this.prisma,
    ).catch(() => undefined);

    return updatedAsset;
  }

  private async findGlPreparerUserId(params: {
    tenantId: string;
  }): Promise<string> {
    const candidates = await this.prisma.user.findMany({
      where: { tenantId: params.tenantId, isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!candidates.length) {
      throw new BadRequestException('No active users found for tenant');
    }

    // Prefer a user with FINANCE_GL_CREATE and without FINANCE_GL_POST to satisfy maker/poster separation.
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId: { in: candidates.map((c) => c.id) },
        role: { tenantId: params.tenantId },
      },
      select: {
        userId: true,
        role: {
          select: {
            rolePermissions: {
              select: { permission: { select: { code: true } } },
            },
          },
        },
      },
    });

    const permsByUser = new Map<string, Set<string>>();
    for (const ur of userRoles) {
      const set = permsByUser.get(ur.userId) ?? new Set<string>();
      for (const rp of ur.role.rolePermissions) set.add(rp.permission.code);
      permsByUser.set(ur.userId, set);
    }

    for (const c of candidates) {
      const perms = permsByUser.get(c.id) ?? new Set<string>();
      if (perms.has('FINANCE_GL_CREATE') && !perms.has('FINANCE_GL_POST')) {
        return c.id;
      }
    }

    throw new ForbiddenException({
      error: 'Cannot create system journal with proper SoD separation',
      reason:
        'No active user exists with FINANCE_GL_CREATE but without FINANCE_GL_POST. Create a preparer user (e.g. GL_PREPARER).',
    });
  }

  private async assertAccountsExist(params: {
    tenantId: string;
    accountIds: string[];
  }) {
    const unique = [...new Set(params.accountIds.filter(Boolean))];
    const accounts = await this.prisma.account.findMany({
      where: { tenantId: params.tenantId, id: { in: unique } },
      select: { id: true },
    });

    if (accounts.length !== unique.length) {
      const found = new Set(accounts.map((a) => a.id));
      const missing = unique.filter((id) => !found.has(id));
      throw new BadRequestException({
        error: 'Account not found',
        missingAccountIds: missing,
      });
    }
  }

  async getAccumulatedDepreciationToDate(params: {
    tenantId: string;
    assetId: string;
    asOf: Date;
    statusFilter?: FixedAssetStatus;
  }) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: {
        id: params.assetId,
        tenantId: params.tenantId,
        ...(params.statusFilter ? { status: params.statusFilter } : {}),
      },
      select: { id: true },
    });

    if (!asset) return new Prisma.Decimal(0);

    const lines = await this.prisma.fixedAssetDepreciationLine.findMany({
      where: {
        tenantId: params.tenantId,
        assetId: params.assetId,
        run: {
          period: {
            endDate: { lte: params.asOf },
          },
        },
      },
      select: { amount: true },
    });

    return lines.reduce(
      (s, l) => s.plus(new Prisma.Decimal(l.amount)),
      new Prisma.Decimal(0),
    );
  }
}
