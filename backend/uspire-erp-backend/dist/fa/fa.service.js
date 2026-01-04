"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const gl_service_1 = require("../gl/gl.service");
let FaService = class FaService {
    prisma;
    gl;
    constructor(prisma, gl) {
        this.prisma = prisma;
        this.gl = gl;
    }
    async listCategories(req) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        return this.prisma.fixedAssetCategory.findMany({
            where: { tenantId: tenant.id },
            orderBy: { code: 'asc' },
        });
    }
    async createCategory(req, dto) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
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
                    ? new client_1.Prisma.Decimal(dto.defaultResidualRate)
                    : null,
                assetAccountId: dto.assetAccountId,
                accumDepAccountId: dto.accumDepAccountId,
                depExpenseAccountId: dto.depExpenseAccountId,
            },
        });
    }
    async listAssets(req) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        return this.prisma.fixedAsset.findMany({
            where: { tenantId: tenant.id },
            orderBy: { createdAt: 'desc' },
            include: { category: true },
        });
    }
    async createAsset(req, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const acquisitionDate = new Date(dto.acquisitionDate);
        if (Number.isNaN(acquisitionDate.getTime())) {
            throw new common_1.BadRequestException('Invalid acquisitionDate');
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
            throw new common_1.BadRequestException('Category not found');
        }
        const cost = new client_1.Prisma.Decimal(dto.cost);
        const residualValue = new client_1.Prisma.Decimal(dto.residualValue);
        if (cost.lessThan(0) || residualValue.lessThan(0)) {
            throw new common_1.BadRequestException('cost and residualValue must be >= 0');
        }
        if (residualValue.greaterThan(cost)) {
            throw new common_1.BadRequestException('residualValue cannot exceed cost');
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
                usefulLifeMonths: dto.usefulLifeMonths || category.defaultUsefulLifeMonths,
                method: dto.method || category.defaultMethod,
                vendorId: dto.vendorId ?? null,
                apInvoiceId: dto.apInvoiceId ?? null,
                status: 'DRAFT',
            },
            include: { category: true },
        });
    }
    async capitalizeAsset(req, id, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const capitalizationDate = new Date(dto.capitalizationDate);
        if (Number.isNaN(capitalizationDate.getTime())) {
            throw new common_1.BadRequestException('Invalid capitalizationDate');
        }
        const asset = await this.prisma.fixedAsset.findFirst({
            where: { id, tenantId: tenant.id },
            include: { category: true },
        });
        if (!asset)
            throw new common_1.NotFoundException('Fixed asset not found');
        if (asset.status !== 'DRAFT') {
            throw new common_1.BadRequestException(`Asset must be DRAFT to capitalize (status=${asset.status})`);
        }
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                startDate: { lte: capitalizationDate },
                endDate: { gte: capitalizationDate },
            },
            select: { id: true, status: true, name: true },
        });
        if (!period || period.status !== 'OPEN') {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'FA_CAPITALIZE',
                    entityType: 'FIXED_ASSET',
                    entityId: id,
                    action: 'FA_ASSET_CAPITALIZE',
                    outcome: 'BLOCKED',
                    reason: !period
                        ? 'No accounting period exists for the capitalization date'
                        : `Accounting period is not OPEN: ${period.name}`,
                    userId: user.id,
                    permissionUsed: 'FA_ASSET_CAPITALIZE',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by accounting period control',
                reason: !period
                    ? 'No accounting period exists for the capitalization date'
                    : `Accounting period is not OPEN: ${period.name}`,
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
        const description = dto.description ?? `Fixed asset capitalization: ${asset.name}`;
        const journalCreatedById = asset.createdById ??
            (await this.findGlPreparerUserId({ tenantId: tenant.id }).catch(() => user.id));
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
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'FA_CAPITALIZE',
                entityType: 'FIXED_ASSET',
                entityId: asset.id,
                action: 'FA_ASSET_CAPITALIZE',
                outcome: 'SUCCESS',
                userId: user.id,
                permissionUsed: 'FA_ASSET_CAPITALIZE',
            },
        })
            .catch(() => undefined);
        return updatedAsset;
    }
    async runDepreciationForPeriod(req, periodId) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
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
        if (!period)
            throw new common_1.NotFoundException('Accounting period not found');
        if (period.status !== 'OPEN') {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'FA_DEPRECIATION_RUN',
                    entityType: 'ACCOUNTING_PERIOD',
                    entityId: period.id,
                    action: 'FA_DEPRECIATION_RUN',
                    outcome: 'BLOCKED',
                    reason: `Accounting period is not OPEN: ${period.name}`,
                    userId: user.id,
                    permissionUsed: 'FA_DEPRECIATION_RUN',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by accounting period control',
                reason: `Accounting period is not OPEN: ${period.name}`,
            });
        }
        const existingRun = await this.prisma.fixedAssetDepreciationRun.findFirst({
            where: { tenantId: tenant.id, periodId: period.id },
            select: { id: true },
        });
        if (existingRun) {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'FA_DEPRECIATION_RUN',
                    entityType: 'ACCOUNTING_PERIOD',
                    entityId: period.id,
                    action: 'FA_DEPRECIATION_RUN',
                    outcome: 'FAILED',
                    reason: 'Depreciation already run for this period',
                    userId: user.id,
                    permissionUsed: 'FA_DEPRECIATION_RUN',
                },
            })
                .catch(() => undefined);
            throw new common_1.BadRequestException('Depreciation already run for this period');
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
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'FA_DEPRECIATION_RUN',
                    entityType: 'FIXED_ASSET_DEPRECIATION_RUN',
                    entityId: run.id,
                    action: 'FA_DEPRECIATION_RUN',
                    outcome: 'SUCCESS',
                    reason: 'No eligible assets; recorded empty depreciation run',
                    userId: user.id,
                    permissionUsed: 'FA_DEPRECIATION_RUN',
                },
            })
                .catch(() => undefined);
            return { run, journalEntry: null, totals: [] };
        }
        const totalsByPair = new Map();
        const lineCreates = [];
        let run;
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
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002') {
                throw new common_1.BadRequestException('Depreciation already run for this period');
            }
            throw e;
        }
        for (const a of assets) {
            if (!a.depExpenseAccountId || !a.accumDepAccountId) {
                throw new common_1.BadRequestException('Capitalized asset missing depreciation accounts');
            }
            const base = new client_1.Prisma.Decimal(a.cost).minus(new client_1.Prisma.Decimal(a.residualValue));
            const monthly = a.usefulLifeMonths > 0
                ? base.div(new client_1.Prisma.Decimal(a.usefulLifeMonths))
                : new client_1.Prisma.Decimal(0);
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
            }
            else {
                prev.amount = prev.amount.plus(amount);
            }
        }
        await this.prisma.fixedAssetDepreciationLine.createMany({
            data: lineCreates,
            skipDuplicates: true,
        });
        const totals = [...totalsByPair.values()].filter((t) => t.amount.gt(0));
        if (!totals.length) {
            return { run, journalEntry: null, totals: [] };
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
        const lines = [];
        for (const t of totals) {
            lines.push({
                accountId: t.depExpenseAccountId,
                debit: t.amount,
                credit: new client_1.Prisma.Decimal(0),
            });
            lines.push({
                accountId: t.accumDepAccountId,
                debit: new client_1.Prisma.Decimal(0),
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
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'FA_DEPRECIATION_RUN',
                entityType: 'FIXED_ASSET_DEPRECIATION_RUN',
                entityId: updatedRun.id,
                action: 'FA_DEPRECIATION_RUN',
                outcome: 'SUCCESS',
                userId: user.id,
                permissionUsed: 'FA_DEPRECIATION_RUN',
            },
        })
            .catch(() => undefined);
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
    async listDepreciationRuns(req) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        return this.prisma.fixedAssetDepreciationRun.findMany({
            where: { tenantId: tenant.id },
            orderBy: { runDate: 'desc' },
            include: { lines: true, period: true },
        });
    }
    async disposeAsset(req, id, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const disposalDate = new Date(dto.disposalDate);
        if (Number.isNaN(disposalDate.getTime())) {
            throw new common_1.BadRequestException('Invalid disposalDate');
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
        if (!asset)
            throw new common_1.NotFoundException('Fixed asset not found');
        if (asset.status !== 'CAPITALIZED') {
            throw new common_1.BadRequestException('Only CAPITALIZED assets can be disposed');
        }
        if (!asset.assetAccountId || !asset.accumDepAccountId) {
            throw new common_1.BadRequestException('Asset missing accounts required for disposal');
        }
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                startDate: { lte: disposalDate },
                endDate: { gte: disposalDate },
            },
            select: { id: true, status: true, name: true },
        });
        if (!period || period.status !== 'OPEN') {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'FA_DISPOSE',
                    entityType: 'FIXED_ASSET',
                    entityId: asset.id,
                    action: 'FA_DISPOSE',
                    outcome: 'BLOCKED',
                    reason: !period
                        ? 'No accounting period exists for the disposal date'
                        : `Accounting period is not OPEN for disposal date: ${period.name}`,
                    userId: user.id,
                    permissionUsed: 'FA_DISPOSE',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by accounting period control',
                reason: !period
                    ? 'No accounting period exists for the disposal date'
                    : `Accounting period is not OPEN for disposal date: ${period.name}`,
            });
        }
        const proceeds = new client_1.Prisma.Decimal(dto.proceeds);
        const accumulatedDep = await this.getAccumulatedDepreciationToDate({
            tenantId: tenant.id,
            assetId: asset.id,
            asOf: disposalDate,
            statusFilter: 'CAPITALIZED',
        });
        const carrying = new client_1.Prisma.Decimal(asset.cost).minus(accumulatedDep);
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
        const description = dto.description ?? `Fixed asset disposal: ${asset.name}`;
        const lines = [];
        if (proceeds.gt(0)) {
            lines.push({
                accountId: dto.proceedsAccountId,
                debit: proceeds,
                credit: new client_1.Prisma.Decimal(0),
            });
        }
        if (accumulatedDep.gt(0)) {
            lines.push({
                accountId: asset.accumDepAccountId,
                debit: accumulatedDep,
                credit: new client_1.Prisma.Decimal(0),
            });
        }
        lines.push({
            accountId: asset.assetAccountId,
            debit: new client_1.Prisma.Decimal(0),
            credit: new client_1.Prisma.Decimal(asset.cost),
        });
        if (gainLoss.gt(0)) {
            lines.push({
                accountId: dto.gainLossAccountId,
                debit: new client_1.Prisma.Decimal(0),
                credit: gainLoss,
            });
        }
        else if (gainLoss.lt(0)) {
            lines.push({
                accountId: dto.gainLossAccountId,
                debit: gainLoss.abs(),
                credit: new client_1.Prisma.Decimal(0),
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
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'FA_DISPOSE',
                entityType: 'FIXED_ASSET',
                entityId: asset.id,
                action: 'FA_DISPOSE',
                outcome: 'SUCCESS',
                userId: user.id,
                permissionUsed: 'FA_DISPOSE',
            },
        })
            .catch(() => undefined);
        return updatedAsset;
    }
    async findGlPreparerUserId(params) {
        const candidates = await this.prisma.user.findMany({
            where: { tenantId: params.tenantId, isActive: true },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
        });
        if (!candidates.length) {
            throw new common_1.BadRequestException('No active users found for tenant');
        }
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
        const permsByUser = new Map();
        for (const ur of userRoles) {
            const set = permsByUser.get(ur.userId) ?? new Set();
            for (const rp of ur.role.rolePermissions)
                set.add(rp.permission.code);
            permsByUser.set(ur.userId, set);
        }
        for (const c of candidates) {
            const perms = permsByUser.get(c.id) ?? new Set();
            if (perms.has('FINANCE_GL_CREATE') && !perms.has('FINANCE_GL_POST')) {
                return c.id;
            }
        }
        throw new common_1.ForbiddenException({
            error: 'Cannot create system journal with proper SoD separation',
            reason: 'No active user exists with FINANCE_GL_CREATE but without FINANCE_GL_POST. Create a preparer user (e.g. GL_PREPARER).',
        });
    }
    async assertAccountsExist(params) {
        const unique = [...new Set(params.accountIds.filter(Boolean))];
        const accounts = await this.prisma.account.findMany({
            where: { tenantId: params.tenantId, id: { in: unique } },
            select: { id: true },
        });
        if (accounts.length !== unique.length) {
            const found = new Set(accounts.map((a) => a.id));
            const missing = unique.filter((id) => !found.has(id));
            throw new common_1.BadRequestException({
                error: 'Account not found',
                missingAccountIds: missing,
            });
        }
    }
    async getAccumulatedDepreciationToDate(params) {
        const asset = await this.prisma.fixedAsset.findFirst({
            where: {
                id: params.assetId,
                tenantId: params.tenantId,
                ...(params.statusFilter ? { status: params.statusFilter } : {}),
            },
            select: { id: true },
        });
        if (!asset)
            return new client_1.Prisma.Decimal(0);
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
        return lines.reduce((s, l) => s.plus(new client_1.Prisma.Decimal(l.amount)), new client_1.Prisma.Decimal(0));
    }
};
exports.FaService = FaService;
exports.FaService = FaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gl_service_1.GlService])
], FaService);
//# sourceMappingURL=fa.service.js.map