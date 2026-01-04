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
exports.BudgetsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let BudgetsService = class BudgetsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    OPENING_PERIOD_NAME = 'Opening Balances';
    round2(n) {
        return Math.round(n * 100) / 100;
    }
    utcDateOnly(d) {
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    addUtcDays(d, days) {
        const dd = new Date(d.getTime());
        dd.setUTCDate(dd.getUTCDate() + days);
        return dd;
    }
    async assertPeriodCoverage(params) {
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
            throw new common_1.BadRequestException('No accounting periods configured for requested date range');
        }
        const from = this.utcDateOnly(params.from);
        const to = this.utcDateOnly(params.to);
        let cursor = from;
        for (const p of periods) {
            const start = this.utcDateOnly(p.startDate);
            const end = this.utcDateOnly(p.endDate);
            if (end < cursor) {
                continue;
            }
            if (start > cursor) {
                throw new common_1.BadRequestException('Accounting period coverage gap for requested date range');
            }
            cursor = this.addUtcDays(end, 1);
            if (cursor > to) {
                return;
            }
        }
        throw new common_1.BadRequestException('Accounting period coverage gap for requested date range');
    }
    async getCutoverDateIfLocked(params) {
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
    toNum(v) {
        if (v === null || v === undefined)
            return 0;
        if (typeof v === 'number')
            return Number.isFinite(v) ? v : 0;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }
    varianceStatusFromBudgetActual(params) {
        const budget = this.round2(params.budgetAmount);
        const actual = this.round2(params.actualAmount);
        if (budget === 0) {
            return actual === 0 ? 'OK' : 'OVER';
        }
        const pct = (actual / budget) * 100;
        if (pct <= 90)
            return 'OK';
        if (pct <= 100)
            return 'WARN';
        return 'OVER';
    }
    async budgetVsActualPaged(req, query) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const fiscalYear = query?.fiscalYear;
        if (!fiscalYear || !Number.isFinite(fiscalYear)) {
            throw new common_1.BadRequestException('fiscalYear is required');
        }
        const activeBudget = await this.prisma.budget.findFirst({
            where: {
                tenantId: tenant.id,
                fiscalYear,
                status: 'ACTIVE',
            },
            orderBy: { approvedAt: 'desc' },
            select: { id: true, fiscalYear: true },
        });
        if (!activeBudget) {
            throw new common_1.NotFoundException('No ACTIVE budget found');
        }
        const revision = await this.prisma.budgetRevision.findFirst({
            where: { tenantId: tenant.id, budgetId: activeBudget.id },
            orderBy: { revisionNo: 'desc' },
            select: { id: true, revisionNo: true, createdAt: true },
        });
        if (!revision) {
            throw new common_1.BadRequestException('ACTIVE budget has no revisions');
        }
        const periodsAll = await this.prisma.accountingPeriod.findMany({
            where: { tenantId: tenant.id },
            orderBy: { startDate: 'asc' },
            select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                status: true,
            },
        });
        const periodsById = new Map(periodsAll.map((p) => [p.id, p]));
        const monthlyPeriodsAll = periodsAll.filter((p) => p.name !== this.OPENING_PERIOD_NAME);
        const periodsInYear = monthlyPeriodsAll.filter((p) => p.startDate.getUTCFullYear() === fiscalYear);
        if (periodsInYear.length === 0) {
            throw new common_1.BadRequestException('No accounting periods exist for the requested fiscal year');
        }
        const selectedPeriod = query?.periodId
            ? periodsById.get(query.periodId)
            : null;
        if (query?.periodId && !selectedPeriod) {
            throw new common_1.BadRequestException(`Period not found: ${query.periodId}`);
        }
        if (selectedPeriod && selectedPeriod.name === this.OPENING_PERIOD_NAME) {
            throw new common_1.BadRequestException('Opening Balances is not supported for budgets');
        }
        let from = new Date(periodsInYear[0].startDate.getTime());
        let to = new Date(periodsInYear[periodsInYear.length - 1].endDate.getTime());
        if (selectedPeriod) {
            from = new Date(selectedPeriod.startDate.getTime());
            to = new Date(selectedPeriod.endDate.getTime());
        }
        const cutover = await this.getCutoverDateIfLocked({ tenantId: tenant.id });
        if (cutover && to < cutover) {
            return {
                fiscalYear: activeBudget.fiscalYear,
                budgetId: activeBudget.id,
                revision: {
                    id: revision.id,
                    revisionNo: revision.revisionNo,
                    createdAt: revision.createdAt,
                },
                cutoverDate: cutover.toISOString().slice(0, 10),
                rows: [],
                total: 0,
                limit: query?.limit ?? 50,
                offset: query?.offset ?? 0,
            };
        }
        if (cutover && from < cutover) {
            from = cutover;
        }
        await this.assertPeriodCoverage({ tenantId: tenant.id, from, to });
        const budgetLinesAll = await this.prisma.budgetLine.findMany({
            where: {
                tenantId: tenant.id,
                revisionId: revision.id,
                ...(query?.periodId ? { periodId: query.periodId } : {}),
                ...(query?.accountId ? { accountId: query.accountId } : {}),
            },
            select: { accountId: true, periodId: true, amount: true },
        });
        const budgetLines = budgetLinesAll.filter((l) => {
            const p = periodsById.get(l.periodId);
            return p?.name !== this.OPENING_PERIOD_NAME;
        });
        const budgetAccountIds = [...new Set(budgetLines.map((l) => l.accountId))];
        const budgetPeriodIds = [...new Set(budgetLines.map((l) => l.periodId))];
        const accounts = await this.prisma.account.findMany({
            where: {
                tenantId: tenant.id,
                id: {
                    in: query?.accountId && budgetAccountIds.length === 0
                        ? [query.accountId]
                        : budgetAccountIds,
                },
            },
            select: { id: true, code: true, name: true, type: true },
        });
        const accountById = new Map(accounts.map((a) => [a.id, a]));
        for (const id of budgetPeriodIds) {
            const p = periodsById.get(id);
            if (!p) {
                throw new common_1.BadRequestException(`Budget period not found: ${id}`);
            }
        }
        const budgetByAccountPeriod = new Map();
        for (const l of budgetLines) {
            const k = `${l.accountId}:${l.periodId}`;
            budgetByAccountPeriod.set(k, Number(l.amount));
        }
        const sqlAccountFilter = query?.accountId
            ? client_1.Prisma.sql `AND jl."accountId" = ${query.accountId}`
            : client_1.Prisma.empty;
        const sqlPeriodFilter = query?.periodId
            ? client_1.Prisma.sql `AND ap.id = ${query.periodId}`
            : client_1.Prisma.empty;
        const actualAgg = await this.prisma.$queryRaw `
      SELECT
        jl."accountId" AS "accountId",
        ap.id AS "periodId",
        SUM(jl.debit) AS debit,
        SUM(jl.credit) AS credit
      FROM "JournalLine" jl
      JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
      JOIN "AccountingPeriod" ap
        ON ap."tenantId" = je."tenantId"
       AND je."journalDate" >= ap."startDate"
       AND je."journalDate" <= ap."endDate"
      WHERE
        je."tenantId" = ${tenant.id}
        AND je.status = 'POSTED'
        AND je."journalDate" >= ${from}
        AND je."journalDate" <= ${to}
        AND ap.name <> ${this.OPENING_PERIOD_NAME}
        ${sqlAccountFilter}
        ${sqlPeriodFilter}
      GROUP BY jl."accountId", ap.id
    `;
        const actualByAccountPeriod = new Map();
        for (const r of actualAgg) {
            const a = accountById.get(r.accountId);
            if (!a) {
                continue;
            }
            const debit = Number(r.debit ?? 0);
            const credit = Number(r.credit ?? 0);
            let actual = debit - credit;
            if (a.type === 'INCOME') {
                actual = credit - debit;
            }
            if (a.type === 'EXPENSE') {
                actual = debit - credit;
            }
            actualByAccountPeriod.set(`${r.accountId}:${r.periodId}`, this.round2(actual));
        }
        const accountIdsUnion = new Set([
            ...budgetAccountIds,
            ...Array.from(actualByAccountPeriod.keys()).map((k) => k.split(':')[0]),
        ]);
        if (query?.accountId) {
            accountIdsUnion.clear();
            accountIdsUnion.add(query.accountId);
        }
        const rowsAll = [];
        const periodList = selectedPeriod ? [selectedPeriod] : periodsInYear;
        const periodIds = periodList.map((p) => p.id);
        for (const accountId of accountIdsUnion) {
            const acc = accountById.get(accountId);
            if (!acc)
                continue;
            for (const periodId of periodIds) {
                const p = periodsById.get(periodId);
                if (!p)
                    continue;
                if (p.name === this.OPENING_PERIOD_NAME)
                    continue;
                const key = `${accountId}:${periodId}`;
                const budgetAmount = this.round2(budgetByAccountPeriod.get(key) ?? 0);
                const actualAmount = this.round2(actualByAccountPeriod.get(key) ?? 0);
                const varianceAmount = this.round2(actualAmount - budgetAmount);
                const variancePercent = budgetAmount === 0
                    ? null
                    : this.round2((actualAmount / budgetAmount) * 100);
                const varianceStatus = this.varianceStatusFromBudgetActual({
                    budgetAmount,
                    actualAmount,
                });
                rowsAll.push({
                    accountId,
                    accountCode: acc.code,
                    accountName: acc.name,
                    accountType: acc.type,
                    periodId,
                    periodName: p.name,
                    budgetAmount,
                    actualAmount,
                    varianceAmount,
                    variancePercent,
                    varianceStatus,
                });
            }
        }
        const sortByRaw = (query?.sortBy ?? '').trim();
        const sortDirRaw = (query?.sortDir ?? '').trim().toLowerCase();
        const sortDir = sortDirRaw === 'desc' ? 'desc' : 'asc';
        const sortBy = sortByRaw === 'accountCode' ||
            sortByRaw === 'accountName' ||
            sortByRaw === 'periodName' ||
            sortByRaw === 'budgetAmount' ||
            sortByRaw === 'actualAmount' ||
            sortByRaw === 'varianceAmount' ||
            sortByRaw === 'variancePercent' ||
            sortByRaw === 'varianceStatus'
            ? sortByRaw
            : 'accountCode';
        const dir = sortDir === 'desc' ? -1 : 1;
        rowsAll.sort((a, b) => {
            const cmpStr = (x, y) => x.localeCompare(y);
            const cmpNum = (x, y) => (x === y ? 0 : x < y ? -1 : 1);
            const cmpNullNum = (x, y) => {
                if (x === null && y === null)
                    return 0;
                if (x === null)
                    return 1;
                if (y === null)
                    return -1;
                return cmpNum(x, y);
            };
            let c = 0;
            switch (sortBy) {
                case 'accountName':
                    c = cmpStr(a.accountName, b.accountName);
                    break;
                case 'periodName':
                    c = cmpStr(a.periodName, b.periodName);
                    break;
                case 'budgetAmount':
                    c = cmpNum(a.budgetAmount, b.budgetAmount);
                    break;
                case 'actualAmount':
                    c = cmpNum(a.actualAmount, b.actualAmount);
                    break;
                case 'varianceAmount':
                    c = cmpNum(a.varianceAmount, b.varianceAmount);
                    break;
                case 'variancePercent':
                    c = cmpNullNum(a.variancePercent, b.variancePercent);
                    break;
                case 'varianceStatus':
                    c = cmpStr(a.varianceStatus, b.varianceStatus);
                    break;
                default:
                    c = cmpStr(a.accountCode, b.accountCode);
                    break;
            }
            if (c !== 0)
                return c * dir;
            const accCmp = a.accountCode.localeCompare(b.accountCode);
            if (accCmp !== 0)
                return accCmp;
            return a.periodName.localeCompare(b.periodName);
        });
        const limit = typeof query?.limit === 'number' && Number.isFinite(query.limit)
            ? Math.max(1, Math.min(500, query.limit))
            : 50;
        const offset = typeof query?.offset === 'number' && Number.isFinite(query.offset)
            ? Math.max(0, query.offset)
            : 0;
        const page = rowsAll.slice(offset, offset + limit);
        return {
            fiscalYear: activeBudget.fiscalYear,
            budgetId: activeBudget.id,
            revision: {
                id: revision.id,
                revisionNo: revision.revisionNo,
                createdAt: revision.createdAt,
            },
            cutoverDate: cutover ? cutover.toISOString().slice(0, 10) : null,
            rows: page,
            total: rowsAll.length,
            limit,
            offset,
        };
    }
    async budgetVsActualJournals(req, params) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const accountId = (params.accountId ?? '').trim();
        const periodId = (params.periodId ?? '').trim();
        if (!accountId)
            throw new common_1.BadRequestException('accountId is required');
        if (!periodId)
            throw new common_1.BadRequestException('periodId is required');
        const period = await this.prisma.accountingPeriod.findFirst({
            where: { tenantId: tenant.id, id: periodId },
            select: { id: true, name: true, startDate: true, endDate: true },
        });
        if (!period)
            throw new common_1.BadRequestException('Accounting period not found');
        if (period.name === this.OPENING_PERIOD_NAME) {
            throw new common_1.BadRequestException('Opening Balances is not supported for budgets');
        }
        const account = await this.prisma.account.findFirst({
            where: { tenantId: tenant.id, id: accountId },
            select: { id: true, code: true, name: true, type: true },
        });
        if (!account)
            throw new common_1.BadRequestException('Account not found');
        const cutover = await this.getCutoverDateIfLocked({ tenantId: tenant.id });
        if (cutover && period.endDate < cutover) {
            return {
                account: {
                    id: account.id,
                    code: account.code,
                    name: account.name,
                },
                period: {
                    id: period.id,
                    name: period.name,
                    startDate: period.startDate,
                    endDate: period.endDate,
                },
                rows: [],
                total: 0,
                limit: params?.limit ?? 50,
                offset: params?.offset ?? 0,
            };
        }
        const from = cutover && period.startDate < cutover ? cutover : period.startDate;
        const to = period.endDate;
        await this.assertPeriodCoverage({ tenantId: tenant.id, from, to });
        const all = await this.prisma.$queryRaw `
      SELECT
        je.id AS "journalEntryId",
        je."journalNumber" AS "journalNumber",
        je."journalDate" AS "journalDate",
        je.reference AS reference,
        je.description AS description,
        je."postedAt" AS "postedAt",
        SUM(jl.debit) AS debit,
        SUM(jl.credit) AS credit
      FROM "JournalLine" jl
      JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
      WHERE
        je."tenantId" = ${tenant.id}
        AND je.status = 'POSTED'
        AND jl."accountId" = ${accountId}
        AND je."journalDate" >= ${from}
        AND je."journalDate" <= ${to}
      GROUP BY je.id
      ORDER BY je."journalDate" DESC, je."journalNumber" DESC
    `;
        const limit = typeof params?.limit === 'number' && Number.isFinite(params.limit)
            ? Math.max(1, Math.min(200, params.limit))
            : 50;
        const offset = typeof params?.offset === 'number' && Number.isFinite(params.offset)
            ? Math.max(0, params.offset)
            : 0;
        const page = all.slice(offset, offset + limit).map((r) => {
            const debit = this.toNum(r.debit);
            const credit = this.toNum(r.credit);
            let amount = debit - credit;
            if (account.type === 'INCOME')
                amount = credit - debit;
            if (account.type === 'EXPENSE')
                amount = debit - credit;
            return {
                journalEntryId: r.journalEntryId,
                journalNumber: r.journalNumber,
                journalDate: r.journalDate,
                reference: r.reference,
                description: r.description,
                postedAt: r.postedAt,
                amount: this.round2(amount),
            };
        });
        return {
            account: {
                id: account.id,
                code: account.code,
                name: account.name,
            },
            period: {
                id: period.id,
                name: period.name,
                startDate: period.startDate,
                endDate: period.endDate,
            },
            rows: page,
            total: all.length,
            limit,
            offset,
        };
    }
    async createBudget(req, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        if (!dto.lines || dto.lines.length === 0) {
            throw new common_1.BadRequestException('Budget must include at least one line');
        }
        const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
        const periodIds = [...new Set(dto.lines.map((l) => l.periodId))];
        const [accounts, periods] = await this.prisma.$transaction([
            this.prisma.account.findMany({
                where: { tenantId: tenant.id, id: { in: accountIds } },
                select: { id: true },
            }),
            this.prisma.accountingPeriod.findMany({
                where: { tenantId: tenant.id, id: { in: periodIds } },
                select: { id: true, name: true, startDate: true, endDate: true },
            }),
        ]);
        if (accounts.length !== accountIds.length) {
            throw new common_1.BadRequestException('One or more accounts are invalid for this tenant');
        }
        if (periods.length !== periodIds.length) {
            throw new common_1.BadRequestException('One or more accounting periods are invalid for this tenant');
        }
        for (const p of periods) {
            if (p.name === this.OPENING_PERIOD_NAME) {
                throw new common_1.BadRequestException('Budget lines cannot target Opening Balances period');
            }
        }
        for (const p of periods) {
            const year = new Date(p.startDate).getUTCFullYear();
            if (year !== dto.fiscalYear) {
                throw new common_1.BadRequestException({
                    error: 'Budget periods must fall within the specified fiscal year',
                    periodId: p.id,
                    periodYear: year,
                    fiscalYear: dto.fiscalYear,
                });
            }
        }
        const created = await this.prisma.$transaction(async (tx) => {
            const budget = await tx.budget.create({
                data: {
                    tenantId: tenant.id,
                    fiscalYear: dto.fiscalYear,
                    status: 'DRAFT',
                    createdById: user.id,
                },
                select: {
                    id: true,
                    tenantId: true,
                    fiscalYear: true,
                    status: true,
                    createdById: true,
                    approvedById: true,
                    createdAt: true,
                    approvedAt: true,
                },
            });
            const revision = await tx.budgetRevision.create({
                data: {
                    tenantId: tenant.id,
                    budgetId: budget.id,
                    revisionNo: 1,
                    createdById: user.id,
                },
                select: {
                    id: true,
                    revisionNo: true,
                    createdAt: true,
                    createdById: true,
                },
            });
            await tx.budgetLine.createMany({
                data: dto.lines.map((l) => ({
                    tenantId: tenant.id,
                    budgetId: budget.id,
                    revisionId: revision.id,
                    accountId: l.accountId,
                    periodId: l.periodId,
                    legalEntityId: l.legalEntityId ?? null,
                    departmentId: l.departmentId ?? null,
                    projectId: l.projectId ?? null,
                    fundId: l.fundId ?? null,
                    amount: l.amount,
                })),
            });
            await tx.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'BUDGET_CREATE',
                    entityType: 'BUDGET',
                    entityId: budget.id,
                    action: 'BUDGET_CREATE',
                    outcome: 'SUCCESS',
                    userId: user.id,
                    permissionUsed: 'BUDGET_CREATE',
                },
            })
                .catch(() => undefined);
            return { budget, revision };
        });
        return created;
    }
    async approveBudget(req, id) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const existing = await this.prisma.budget.findFirst({
            where: { tenantId: tenant.id, id },
            select: { id: true, fiscalYear: true, status: true },
        });
        if (!existing)
            throw new common_1.NotFoundException('Budget not found');
        if (existing.status === 'ACTIVE') {
            throw new common_1.BadRequestException('Budget is already ACTIVE');
        }
        const activeForYear = await this.prisma.budget.findFirst({
            where: {
                tenantId: tenant.id,
                fiscalYear: existing.fiscalYear,
                status: 'ACTIVE',
            },
            select: { id: true },
        });
        if (activeForYear) {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'BUDGET_APPROVE',
                    entityType: 'BUDGET',
                    entityId: existing.id,
                    action: 'BUDGET_APPROVE',
                    outcome: 'BLOCKED',
                    reason: 'An ACTIVE budget already exists for this fiscal year',
                    userId: user.id,
                    permissionUsed: 'BUDGET_APPROVE',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException('An ACTIVE budget already exists for this fiscal year');
        }
        const updated = await this.prisma.budget.update({
            where: { id: existing.id },
            data: {
                status: 'ACTIVE',
                approvedById: user.id,
                approvedAt: new Date(),
            },
            select: {
                id: true,
                tenantId: true,
                fiscalYear: true,
                status: true,
                createdById: true,
                approvedById: true,
                createdAt: true,
                approvedAt: true,
            },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'BUDGET_APPROVE',
                entityType: 'BUDGET',
                entityId: updated.id,
                action: 'BUDGET_APPROVE',
                outcome: 'SUCCESS',
                userId: user.id,
                permissionUsed: 'BUDGET_APPROVE',
            },
        })
            .catch(() => undefined);
        return updated;
    }
    async listBudgets(req, query) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        return this.prisma.budget.findMany({
            where: {
                tenantId: tenant.id,
                ...(query?.fiscalYear ? { fiscalYear: query.fiscalYear } : {}),
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                tenantId: true,
                fiscalYear: true,
                status: true,
                createdAt: true,
                approvedAt: true,
                createdBy: { select: { id: true, email: true } },
                approvedBy: { select: { id: true, email: true } },
            },
        });
    }
    async getBudget(req, id) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const budget = await this.prisma.budget.findFirst({
            where: { tenantId: tenant.id, id },
            select: {
                id: true,
                tenantId: true,
                fiscalYear: true,
                status: true,
                createdAt: true,
                approvedAt: true,
                createdBy: { select: { id: true, email: true } },
                approvedBy: { select: { id: true, email: true } },
            },
        });
        if (!budget)
            throw new common_1.NotFoundException('Budget not found');
        const revisions = await this.prisma.budgetRevision.findMany({
            where: { tenantId: tenant.id, budgetId: budget.id },
            orderBy: { revisionNo: 'desc' },
            select: {
                id: true,
                revisionNo: true,
                createdAt: true,
                createdBy: { select: { id: true, email: true } },
            },
        });
        const latestRevision = revisions[0];
        const lines = latestRevision
            ? await this.prisma.budgetLine.findMany({
                where: { tenantId: tenant.id, revisionId: latestRevision.id },
                orderBy: [{ accountId: 'asc' }, { periodId: 'asc' }],
                select: {
                    id: true,
                    accountId: true,
                    periodId: true,
                    amount: true,
                    account: { select: { id: true, code: true, name: true } },
                    period: {
                        select: { id: true, name: true, startDate: true, endDate: true },
                    },
                },
            })
            : [];
        return { budget, revisions, latestRevision, lines };
    }
    async budgetVsActual(req, query) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const fiscalYear = query?.fiscalYear;
        const activeBudgets = await this.prisma.budget.findMany({
            where: {
                tenantId: tenant.id,
                status: 'ACTIVE',
                ...(fiscalYear ? { fiscalYear } : {}),
            },
            select: { id: true, fiscalYear: true },
            orderBy: { approvedAt: 'desc' },
            take: fiscalYear ? 2 : 10,
        });
        if (!fiscalYear && activeBudgets.length !== 1) {
            throw new common_1.BadRequestException('fiscalYear is required when multiple ACTIVE budgets exist');
        }
        const budget = activeBudgets[0];
        if (!budget) {
            throw new common_1.NotFoundException('No ACTIVE budget found');
        }
        const revision = await this.prisma.budgetRevision.findFirst({
            where: { tenantId: tenant.id, budgetId: budget.id },
            orderBy: { revisionNo: 'desc' },
            select: { id: true, revisionNo: true, createdAt: true },
        });
        if (!revision) {
            throw new common_1.BadRequestException('ACTIVE budget has no revisions');
        }
        const periodsAll = await this.prisma.accountingPeriod.findMany({
            where: {
                tenantId: tenant.id,
            },
            orderBy: { startDate: 'asc' },
            select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                status: true,
            },
        });
        const periodsById = new Map(periodsAll.map((p) => [p.id, p]));
        const monthlyPeriodsAll = periodsAll.filter((p) => p.name !== this.OPENING_PERIOD_NAME);
        const periodsInYear = monthlyPeriodsAll.filter((p) => p.startDate.getUTCFullYear() === budget.fiscalYear);
        if (periodsInYear.length === 0) {
            throw new common_1.BadRequestException('No accounting periods exist for the requested fiscal year');
        }
        let from = new Date(periodsInYear[0].startDate.getTime());
        const to = new Date(periodsInYear[periodsInYear.length - 1].endDate.getTime());
        const cutover = await this.getCutoverDateIfLocked({ tenantId: tenant.id });
        if (cutover && to < cutover) {
            return {
                fiscalYear: budget.fiscalYear,
                budgetId: budget.id,
                revision: {
                    id: revision.id,
                    revisionNo: revision.revisionNo,
                    createdAt: revision.createdAt,
                },
                periods: periodsInYear,
                rows: [],
                totalsByPeriodId: {},
            };
        }
        if (cutover && from < cutover) {
            from = cutover;
        }
        await this.assertPeriodCoverage({ tenantId: tenant.id, from, to });
        const budgetLinesAll = await this.prisma.budgetLine.findMany({
            where: { tenantId: tenant.id, revisionId: revision.id },
            select: { accountId: true, periodId: true, amount: true },
        });
        const budgetLines = budgetLinesAll.filter((l) => {
            const p = periodsById.get(l.periodId);
            return p?.name !== this.OPENING_PERIOD_NAME;
        });
        const budgetAccountIds = [...new Set(budgetLines.map((l) => l.accountId))];
        const budgetPeriodIds = [...new Set(budgetLines.map((l) => l.periodId))];
        const accounts = await this.prisma.account.findMany({
            where: { tenantId: tenant.id, id: { in: budgetAccountIds } },
            select: { id: true, code: true, name: true, type: true },
        });
        const accountById = new Map(accounts.map((a) => [a.id, a]));
        for (const id of budgetPeriodIds) {
            const p = periodsById.get(id);
            if (!p) {
                throw new common_1.BadRequestException(`Budget period not found: ${id}`);
            }
        }
        const budgetByAccountPeriod = new Map();
        for (const l of budgetLines) {
            const k = `${l.accountId}:${l.periodId}`;
            budgetByAccountPeriod.set(k, Number(l.amount));
        }
        const actualAgg = await this.prisma.$queryRaw `
      SELECT
        jl."accountId" AS "accountId",
        ap.id AS "periodId",
        SUM(jl.debit) AS debit,
        SUM(jl.credit) AS credit
      FROM "JournalLine" jl
      JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
      JOIN "AccountingPeriod" ap
        ON ap."tenantId" = je."tenantId"
       AND je."journalDate" >= ap."startDate"
       AND je."journalDate" <= ap."endDate"
      WHERE
        je."tenantId" = ${tenant.id}
        AND je.status = 'POSTED'
        AND je."journalDate" >= ${from}
        AND je."journalDate" <= ${to}
        AND ap.name <> ${this.OPENING_PERIOD_NAME}
      GROUP BY jl."accountId", ap.id
    `;
        const actualByAccountPeriod = new Map();
        for (const r of actualAgg) {
            const a = accountById.get(r.accountId);
            if (!a) {
                continue;
            }
            const debit = Number(r.debit ?? 0);
            const credit = Number(r.credit ?? 0);
            let actual = debit - credit;
            if (a.type === 'INCOME') {
                actual = credit - debit;
            }
            if (a.type === 'EXPENSE') {
                actual = debit - credit;
            }
            actualByAccountPeriod.set(`${r.accountId}:${r.periodId}`, this.round2(actual));
        }
        const periodList = periodsInYear.filter((p) => p.endDate >= from && p.startDate <= to);
        const rows = [];
        const totalsByPeriodId = {};
        for (const p of periodList) {
            totalsByPeriodId[p.id] = {
                budget: 0,
                actual: 0,
                variance: 0,
                variancePct: null,
            };
        }
        for (const accountId of budgetAccountIds) {
            const acc = accountById.get(accountId);
            if (!acc) {
                continue;
            }
            const byPeriodId = {};
            let totalBudget = 0;
            let totalActual = 0;
            for (const p of periodList) {
                const key = `${accountId}:${p.id}`;
                const budgetAmt = this.round2(budgetByAccountPeriod.get(key) ?? 0);
                const actualAmt = this.round2(actualByAccountPeriod.get(key) ?? 0);
                const variance = this.round2(actualAmt - budgetAmt);
                const variancePct = budgetAmt === 0 ? null : this.round2((variance / budgetAmt) * 100);
                byPeriodId[p.id] = {
                    budget: budgetAmt,
                    actual: actualAmt,
                    variance,
                    variancePct,
                };
                totalBudget += budgetAmt;
                totalActual += actualAmt;
                totalsByPeriodId[p.id].budget = this.round2(totalsByPeriodId[p.id].budget + budgetAmt);
                totalsByPeriodId[p.id].actual = this.round2(totalsByPeriodId[p.id].actual + actualAmt);
                totalsByPeriodId[p.id].variance = this.round2(totalsByPeriodId[p.id].actual - totalsByPeriodId[p.id].budget);
                totalsByPeriodId[p.id].variancePct =
                    totalsByPeriodId[p.id].budget === 0
                        ? null
                        : this.round2((totalsByPeriodId[p.id].variance /
                            totalsByPeriodId[p.id].budget) *
                            100);
            }
            const totalVariance = this.round2(totalActual - totalBudget);
            const totalVariancePct = totalBudget === 0
                ? null
                : this.round2((totalVariance / totalBudget) * 100);
            rows.push({
                accountId: acc.id,
                accountCode: acc.code,
                accountName: acc.name,
                accountType: acc.type,
                byPeriodId,
                totals: {
                    budget: this.round2(totalBudget),
                    actual: this.round2(totalActual),
                    variance: totalVariance,
                    variancePct: totalVariancePct,
                },
            });
        }
        rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
        return {
            fiscalYear: budget.fiscalYear,
            budgetId: budget.id,
            revision: {
                id: revision.id,
                revisionNo: revision.revisionNo,
                createdAt: revision.createdAt,
            },
            cutoverDate: cutover ? cutover.toISOString().slice(0, 10) : null,
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
            periods: periodList,
            rows,
            totalsByPeriodId,
        };
    }
};
exports.BudgetsService = BudgetsService;
exports.BudgetsService = BudgetsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BudgetsService);
//# sourceMappingURL=budgets.service.js.map