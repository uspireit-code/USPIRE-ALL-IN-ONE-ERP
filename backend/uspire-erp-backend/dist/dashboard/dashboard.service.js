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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../cache/cache.service");
const prisma_service_1 = require("../prisma/prisma.service");
const financial_statements_service_1 = require("../reports/financial-statements.service");
const reports_service_1 = require("../reports/reports.service");
const budgets_service_1 = require("../budgets/budgets.service");
const forecasts_service_1 = require("../forecasts/forecasts.service");
let DashboardService = class DashboardService {
    prisma;
    cache;
    financial;
    reports;
    budgets;
    forecasts;
    constructor(prisma, cache, financial, reports, budgets, forecasts) {
        this.prisma = prisma;
        this.cache = cache;
        this.financial = financial;
        this.reports = reports;
        this.budgets = budgets;
        this.forecasts = forecasts;
    }
    OPENING_PERIOD_NAME = 'Opening Balances';
    round2(n) {
        return Math.round(n * 100) / 100;
    }
    dateOnlyIso(d) {
        return d.toISOString().slice(0, 10);
    }
    parseAsOf(asOf) {
        if (!asOf)
            return new Date();
        const d = new Date(asOf);
        if (Number.isNaN(d.getTime()))
            throw new common_1.BadRequestException('Invalid asOf date');
        return d;
    }
    async resolveContext(req, params) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const asOf = this.parseAsOf(params.asOf);
        const currentPeriod = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                name: { not: this.OPENING_PERIOD_NAME },
                startDate: { lte: asOf },
                endDate: { gte: asOf },
            },
            select: { startDate: true, endDate: true },
        });
        if (!currentPeriod) {
            throw new common_1.BadRequestException('No accounting period exists for asOf date');
        }
        const inferredFiscalYear = currentPeriod.startDate.getUTCFullYear();
        const fiscalYear = params.fiscalYear ?? inferredFiscalYear;
        const fyStartPeriod = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                name: { not: this.OPENING_PERIOD_NAME },
                startDate: {
                    gte: new Date(Date.UTC(fiscalYear, 0, 1)),
                    lt: new Date(Date.UTC(fiscalYear + 1, 0, 1)),
                },
            },
            orderBy: { startDate: 'asc' },
            select: { startDate: true },
        });
        if (!fyStartPeriod) {
            throw new common_1.BadRequestException('No accounting periods exist for the requested fiscalYear');
        }
        return {
            tenantId: tenant.id,
            userId: user.id,
            asOf,
            fiscalYear,
            fyStart: fyStartPeriod.startDate,
            mtdStart: currentPeriod.startDate,
            mtdEnd: currentPeriod.endDate,
        };
    }
    async auditDashboardView(req, params) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            return;
        const entityId = `DASHBOARD:${params.dashboardType}:${params.context.fiscalYear}:${params.context.asOf}`;
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'DASHBOARD_VIEW',
                entityType: 'REPORT',
                entityId,
                action: 'DASHBOARD_VIEW',
                outcome: 'SUCCESS',
                reason: JSON.stringify({
                    dashboardType: params.dashboardType,
                    ...params.context,
                }),
                userId: user.id,
                permissionUsed: 'dashboard.view',
            },
        })
            .catch(() => undefined);
    }
    async computeCashBalance(params) {
        const cashAccounts = await this.prisma.account.findMany({
            where: {
                tenantId: params.tenantId,
                type: 'ASSET',
                isCashEquivalent: true,
                isActive: true,
            },
            select: { id: true },
        });
        if (cashAccounts.length === 0) {
            return 0;
        }
        const grouped = await this.prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
                accountId: { in: cashAccounts.map((a) => a.id) },
                journalEntry: {
                    tenantId: params.tenantId,
                    status: 'POSTED',
                    journalDate: { lte: params.asOf },
                },
            },
            _sum: { debit: true, credit: true },
        });
        let total = 0;
        for (const g of grouped) {
            const debit = Number(g._sum?.debit ?? 0);
            const credit = Number(g._sum?.credit ?? 0);
            total += debit - credit;
        }
        return this.round2(total);
    }
    async computeForecastVsActualYtd(req, ctx) {
        const forecast = await this.prisma.forecast.findFirst({
            where: {
                tenantId: ctx.tenantId,
                fiscalYear: ctx.fiscalYear,
                status: 'APPROVED',
            },
            select: { id: true },
        });
        if (!forecast) {
            return {
                forecastId: null,
                forecastTotalYtd: null,
                actualTotalYtd: null,
                varianceAmountYtd: null,
                variancePercentYtd: null,
            };
        }
        const variance = await this.forecasts.getForecastVariance(req, forecast.id);
        const monthCutoff = ctx.asOf.getUTCMonth() + 1;
        let forecastTotal = 0;
        let actualTotal = 0;
        for (const row of variance.rows) {
            for (let m = 1; m <= monthCutoff; m++) {
                const cell = row.byMonth[m];
                if (!cell)
                    continue;
                if (cell.actualAmount === null)
                    continue;
                forecastTotal += cell.forecastAmount;
                actualTotal += cell.actualAmount;
            }
        }
        const f = this.round2(forecastTotal);
        const a = this.round2(actualTotal);
        const varianceAmountYtd = this.round2(a - f);
        const variancePercentYtd = f === 0 ? null : this.round2((varianceAmountYtd / f) * 100);
        return {
            forecastId: forecast.id,
            forecastTotalYtd: f,
            actualTotalYtd: a,
            varianceAmountYtd,
            variancePercentYtd,
        };
    }
    async computeBudgetVsActualYtd(req, ctx) {
        const bva = await this.budgets.budgetVsActual(req, {
            fiscalYear: ctx.fiscalYear,
        });
        const ytdPeriodIds = bva.periods
            .filter((p) => p.startDate <= ctx.asOf)
            .map((p) => p.id);
        let budgetTotal = 0;
        let actualTotal = 0;
        for (const pid of ytdPeriodIds) {
            const totals = bva.totalsByPeriodId[pid];
            if (!totals)
                continue;
            budgetTotal += Number(totals.budget ?? 0);
            actualTotal += Number(totals.actual ?? 0);
        }
        const budgetYtd = this.round2(budgetTotal);
        const actualYtd = this.round2(actualTotal);
        const varianceAmountYtd = this.round2(actualYtd - budgetYtd);
        const variancePercentYtd = budgetYtd === 0
            ? null
            : this.round2((varianceAmountYtd / budgetYtd) * 100);
        return {
            budgetId: bva.budgetId,
            budgetTotalYtd: budgetYtd,
            actualTotalYtd: actualYtd,
            varianceAmountYtd,
            variancePercentYtd,
        };
    }
    async getKpis(req, query) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const asOfKey = query.asOf ?? '';
        const fyKey = query.fiscalYear ?? '';
        const key = `dashboard:kpis:${tenant.id}:${asOfKey}:${fyKey}`;
        return this.cache.getOrSet({
            tenantId: tenant.id,
            key,
            ttlMs: 60_000,
            loader: async () => {
                const ctx = await this.resolveContext(req, query);
                const ytdPl = await this.financial.computeProfitAndLoss(req, {
                    from: this.dateOnlyIso(ctx.fyStart),
                    to: this.dateOnlyIso(ctx.asOf),
                });
                const mtdPl = await this.financial.computeProfitAndLoss(req, {
                    from: this.dateOnlyIso(ctx.mtdStart),
                    to: this.dateOnlyIso(ctx.mtdEnd < ctx.asOf ? ctx.mtdEnd : ctx.asOf),
                });
                const cash = await this.computeCashBalance({
                    tenantId: ctx.tenantId,
                    asOf: ctx.asOf,
                });
                const ar = await this.reports.arAging(req, {
                    asOf: this.dateOnlyIso(ctx.asOf),
                });
                const ap = await this.reports.apAging(req, {
                    asOf: this.dateOnlyIso(ctx.asOf),
                });
                const budgetVsActualYtd = await this.computeBudgetVsActualYtd(req, ctx).catch((e) => {
                    if (e instanceof common_1.NotFoundException) {
                        return {
                            budgetId: null,
                            budgetTotalYtd: null,
                            actualTotalYtd: null,
                            varianceAmountYtd: null,
                            variancePercentYtd: null,
                        };
                    }
                    throw e;
                });
                const forecastVsActualYtd = await this.computeForecastVsActualYtd(req, ctx);
                return {
                    context: {
                        asOf: this.dateOnlyIso(ctx.asOf),
                        fiscalYear: ctx.fiscalYear,
                    },
                    kpis: {
                        revenue: {
                            ytd: ytdPl.income.total,
                            mtd: mtdPl.income.total,
                        },
                        expenses: {
                            ytd: ytdPl.expenses.total,
                            mtd: mtdPl.expenses.total,
                        },
                        netProfit: {
                            ytd: ytdPl.profitOrLoss,
                            mtd: mtdPl.profitOrLoss,
                        },
                        budgetVsActualYtd,
                        forecastVsActualYtd,
                        cashBalance: cash,
                        arBalance: ar.grandTotalOutstanding ?? 0,
                        apBalance: ap.grandTotalOutstanding ?? 0,
                    },
                };
            },
        });
    }
    async getTrends(req, query) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const asOfKey = query.asOf ?? '';
        const fyKey = query.fiscalYear ?? '';
        const limitKey = query.limit ?? '';
        const offsetKey = query.offset ?? '';
        const key = `dashboard:trends:${tenant.id}:${asOfKey}:${fyKey}:${limitKey}:${offsetKey}`;
        return this.cache.getOrSet({
            tenantId: tenant.id,
            key,
            ttlMs: 60_000,
            loader: async () => {
                const ctx = await this.resolveContext(req, query);
                const limit = query.limit ?? 50;
                const offset = query.offset ?? 0;
                if (limit < 1 || limit > 200)
                    throw new common_1.BadRequestException('Invalid limit. Limit must be between 1 and 200.');
                if (offset < 0)
                    throw new common_1.BadRequestException('Invalid offset. Offset must be greater than or equal to 0.');
                const periods = await this.prisma.accountingPeriod.findMany({
                    where: {
                        tenantId: ctx.tenantId,
                        name: { not: this.OPENING_PERIOD_NAME },
                        startDate: {
                            gte: new Date(Date.UTC(ctx.fiscalYear, 0, 1)),
                            lt: new Date(Date.UTC(ctx.fiscalYear + 1, 0, 1)),
                        },
                    },
                    orderBy: { startDate: 'asc' },
                    select: { startDate: true, endDate: true },
                });
                if (periods.length === 0) {
                    throw new common_1.BadRequestException('No accounting periods exist for the requested fiscalYear');
                }
                const monthCutoff = ctx.asOf.getUTCMonth() + 1;
                const byMonth = [];
                for (const p of periods) {
                    const month = p.startDate.getUTCMonth() + 1;
                    if (month > 12)
                        continue;
                    if (month > monthCutoff) {
                        byMonth.push({
                            month,
                            revenue: null,
                            expenses: null,
                            profit: null,
                        });
                        continue;
                    }
                    const pl = await this.financial.computeProfitAndLoss(req, {
                        from: this.dateOnlyIso(p.startDate),
                        to: this.dateOnlyIso(p.endDate),
                    });
                    byMonth.push({
                        month,
                        revenue: pl.income.total,
                        expenses: pl.expenses.total,
                        profit: pl.profitOrLoss,
                    });
                }
                byMonth.sort((a, b) => a.month - b.month);
                const paged = byMonth.slice(offset, offset + limit);
                return {
                    context: {
                        asOf: this.dateOnlyIso(ctx.asOf),
                        fiscalYear: ctx.fiscalYear,
                    },
                    byMonth: paged,
                };
            },
        });
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        financial_statements_service_1.FinancialStatementsService,
        reports_service_1.ReportsService,
        budgets_service_1.BudgetsService,
        forecasts_service_1.ForecastsService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map