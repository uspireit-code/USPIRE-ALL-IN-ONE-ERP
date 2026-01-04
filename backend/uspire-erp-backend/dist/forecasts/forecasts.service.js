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
exports.ForecastsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ForecastsService = class ForecastsService {
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
    async resolveFiscalYearMonthlyPeriods(params) {
        const periodsAll = await this.prisma.accountingPeriod.findMany({
            where: {
                tenantId: params.tenantId,
                name: { not: this.OPENING_PERIOD_NAME },
            },
            orderBy: { startDate: 'asc' },
            select: { id: true, name: true, startDate: true, endDate: true },
        });
        const periodsInYear = periodsAll.filter((p) => p.startDate.getUTCFullYear() === params.fiscalYear);
        if (periodsInYear.length === 0) {
            throw new common_1.BadRequestException('No accounting periods exist for the requested fiscal year');
        }
        const from = new Date(periodsInYear[0].startDate.getTime());
        const to = new Date(periodsInYear[periodsInYear.length - 1].endDate.getTime());
        return { periodsInYear, from, to };
    }
    async auditForecastView(params) {
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: params.tenantId,
                eventType: 'FORECAST_VIEW',
                entityType: 'FORECAST',
                entityId: params.forecastId,
                action: 'FORECAST_VIEW',
                outcome: 'SUCCESS',
                reason: `endpoint=${params.endpoint}; fiscalYear=${params.fiscalYear}; forecastVersionId=${params.forecastVersionId}`,
                userId: params.userId,
                permissionUsed: 'forecast.view',
                forecastId: params.forecastId,
                forecastVersionId: params.forecastVersionId,
            },
        })
            .catch(() => undefined);
    }
    async getApprovedForecastContext(req, forecastId) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const forecast = await this.prisma.forecast.findFirst({
            where: { tenantId: tenant.id, id: forecastId },
            select: { id: true, tenantId: true, fiscalYear: true, status: true },
        });
        if (!forecast)
            throw new common_1.NotFoundException('Forecast not found');
        if (forecast.status !== 'APPROVED') {
            throw new common_1.ForbiddenException('Forecast must be APPROVED to access actuals/variance');
        }
        const version = await this.prisma.forecastVersion.findFirst({
            where: { forecastId: forecast.id, status: 'APPROVED' },
            orderBy: { versionNumber: 'desc' },
            select: { id: true, forecastId: true, versionNumber: true, status: true },
        });
        if (!version) {
            throw new common_1.BadRequestException('No APPROVED forecast version exists');
        }
        return { tenant, user, forecast, version };
    }
    async computeMonthlyActuals(params) {
        const { periodsInYear, from, to } = await this.resolveFiscalYearMonthlyPeriods({
            tenantId: params.tenantId,
            fiscalYear: params.fiscalYear,
        });
        const cutover = await this.getCutoverDateIfLocked({
            tenantId: params.tenantId,
        });
        if (cutover && to < cutover) {
            return {
                periodsInYear,
                cutover,
                from,
                to,
                byMonth: {},
            };
        }
        let normFrom = from;
        const normTo = to;
        if (cutover && normFrom < cutover) {
            normFrom = cutover;
        }
        await this.assertPeriodCoverage({
            tenantId: params.tenantId,
            from: normFrom,
            to: normTo,
        });
        const actualAgg = await this.prisma.$queryRaw `
      SELECT
        EXTRACT(MONTH FROM ap."startDate")::int AS month,
        SUM(jl.debit) AS debit,
        SUM(jl.credit) AS credit
      FROM "JournalLine" jl
      JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
      JOIN "AccountingPeriod" ap
        ON ap."tenantId" = je."tenantId"
       AND je."journalDate" >= ap."startDate"
       AND je."journalDate" <= ap."endDate"
      WHERE
        je."tenantId" = ${params.tenantId}
        AND je.status = 'POSTED'
        AND jl."accountId" = ${params.accountId}
        AND ap.name <> ${this.OPENING_PERIOD_NAME}
        AND ap."startDate" >= ${from}
        AND ap."endDate" <= ${to}
        AND je."journalDate" >= ${normFrom}
        AND je."journalDate" <= ${normTo}
      GROUP BY month
    `;
        const now = new Date();
        const byMonth = {};
        for (const p of periodsInYear) {
            const m = p.startDate.getUTCMonth() + 1;
            const isFuture = p.startDate.getTime() > now.getTime();
            byMonth[m] = isFuture ? null : 0;
        }
        for (const r of actualAgg) {
            const debit = Number(r.debit ?? 0);
            const credit = Number(r.credit ?? 0);
            const value = this.round2(debit - credit);
            if (byMonth[r.month] === null) {
                continue;
            }
            byMonth[r.month] = this.round2((byMonth[r.month] ?? 0) + value);
        }
        return {
            periodsInYear,
            cutover,
            from,
            to,
            byMonth,
        };
    }
    async getForecastActuals(req, forecastId) {
        const ctx = await this.getApprovedForecastContext(req, forecastId);
        const lines = await this.prisma.forecastLine.findMany({
            where: { forecastVersionId: ctx.version.id },
            select: { accountId: true },
        });
        const accountIds = [...new Set(lines.map((l) => l.accountId))];
        const rows = [];
        for (const accountId of accountIds) {
            const actuals = await this.computeMonthlyActuals({
                tenantId: ctx.tenant.id,
                fiscalYear: ctx.forecast.fiscalYear,
                accountId,
            });
            rows.push({ accountId, byMonth: actuals.byMonth });
        }
        await this.auditForecastView({
            tenantId: ctx.tenant.id,
            userId: ctx.user.id,
            forecastId: ctx.forecast.id,
            forecastVersionId: ctx.version.id,
            fiscalYear: ctx.forecast.fiscalYear,
            endpoint: '/forecasts/:forecastId/actuals',
        });
        return {
            forecastId: ctx.forecast.id,
            fiscalYear: ctx.forecast.fiscalYear,
            forecastVersionId: ctx.version.id,
            rows,
        };
    }
    async getForecastVariance(req, forecastId) {
        const ctx = await this.getApprovedForecastContext(req, forecastId);
        const forecastLines = await this.prisma.forecastLine.findMany({
            where: { forecastVersionId: ctx.version.id },
            select: {
                accountId: true,
                month: true,
                amount: true,
            },
        });
        const accountIds = [...new Set(forecastLines.map((l) => l.accountId))];
        const actualsByAccount = new Map();
        for (const accountId of accountIds) {
            const actuals = await this.computeMonthlyActuals({
                tenantId: ctx.tenant.id,
                fiscalYear: ctx.forecast.fiscalYear,
                accountId,
            });
            actualsByAccount.set(accountId, actuals.byMonth);
        }
        const forecastByAccountMonth = new Map();
        for (const l of forecastLines) {
            forecastByAccountMonth.set(`${l.accountId}:${l.month}`, Number(l.amount));
        }
        const rows = [];
        for (const accountId of accountIds) {
            const byMonth = {};
            const actualByMonth = actualsByAccount.get(accountId) ?? {};
            for (let month = 1; month <= 12; month++) {
                const forecastAmount = this.round2(forecastByAccountMonth.get(`${accountId}:${month}`) ?? 0);
                const actualAmount = actualByMonth[month] ?? 0;
                if (actualAmount === null) {
                    byMonth[month] = {
                        forecastAmount,
                        actualAmount: null,
                        varianceAmount: null,
                        variancePercent: null,
                    };
                    continue;
                }
                const varianceAmount = this.round2(actualAmount - forecastAmount);
                const variancePercent = forecastAmount === 0
                    ? null
                    : this.round2((varianceAmount / forecastAmount) * 100);
                byMonth[month] = {
                    forecastAmount,
                    actualAmount: this.round2(actualAmount),
                    varianceAmount,
                    variancePercent,
                };
            }
            rows.push({ accountId, byMonth });
        }
        await this.auditForecastView({
            tenantId: ctx.tenant.id,
            userId: ctx.user.id,
            forecastId: ctx.forecast.id,
            forecastVersionId: ctx.version.id,
            fiscalYear: ctx.forecast.fiscalYear,
            endpoint: '/forecasts/:forecastId/variance',
        });
        return {
            forecastId: ctx.forecast.id,
            fiscalYear: ctx.forecast.fiscalYear,
            forecastVersionId: ctx.version.id,
            rows,
        };
    }
    async createForecast(req, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const existing = await this.prisma.forecast.findFirst({
            where: { tenantId: tenant.id, fiscalYear: dto.fiscalYear },
            select: { id: true },
        });
        if (existing) {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'FORECAST_CREATE',
                    entityType: 'FORECAST',
                    entityId: existing.id,
                    action: 'FORECAST_CREATE',
                    outcome: 'BLOCKED',
                    reason: 'A forecast already exists for this fiscal year',
                    userId: user.id,
                    permissionUsed: 'forecast.create',
                    forecastId: existing.id,
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException('A forecast already exists for this fiscal year');
        }
        const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
        const accounts = await this.prisma.account.findMany({
            where: { tenantId: tenant.id, id: { in: accountIds } },
            select: { id: true },
        });
        if (accounts.length !== accountIds.length) {
            throw new common_1.BadRequestException('One or more accounts are invalid for this tenant');
        }
        const created = await this.prisma.$transaction(async (tx) => {
            const forecast = await tx.forecast.create({
                data: {
                    tenantId: tenant.id,
                    fiscalYear: dto.fiscalYear,
                    name: dto.name,
                    status: 'DRAFT',
                    createdById: user.id,
                },
                select: {
                    id: true,
                    tenantId: true,
                    fiscalYear: true,
                    name: true,
                    status: true,
                    createdById: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            const version = await tx.forecastVersion.create({
                data: {
                    forecastId: forecast.id,
                    versionNumber: 1,
                    status: 'DRAFT',
                    createdById: user.id,
                },
                select: {
                    id: true,
                    forecastId: true,
                    versionNumber: true,
                    status: true,
                    createdAt: true,
                    createdById: true,
                },
            });
            if (dto.lines.length > 0) {
                await tx.forecastLine.createMany({
                    data: dto.lines.map((l) => ({
                        forecastVersionId: version.id,
                        accountId: l.accountId,
                        month: l.month,
                        amount: l.amount,
                    })),
                });
            }
            await tx.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'FORECAST_CREATE',
                    entityType: 'FORECAST',
                    entityId: forecast.id,
                    action: 'FORECAST_CREATE',
                    outcome: 'SUCCESS',
                    userId: user.id,
                    permissionUsed: 'forecast.create',
                    forecastId: forecast.id,
                    forecastVersionId: version.id,
                },
            })
                .catch(() => undefined);
            return { forecast, version };
        });
        return created;
    }
    async listForecasts(req, query) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const limit = query?.limit ?? 50;
        const offset = query?.offset ?? 0;
        if (limit < 1 || limit > 200) {
            throw new common_1.BadRequestException('Invalid limit. Limit must be between 1 and 200.');
        }
        if (offset < 0) {
            throw new common_1.BadRequestException('Invalid offset. Offset must be greater than or equal to 0.');
        }
        const rows = await this.prisma.forecast.findMany({
            where: {
                tenantId: tenant.id,
                ...(query?.fiscalYear ? { fiscalYear: query.fiscalYear } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            select: {
                id: true,
                tenantId: true,
                fiscalYear: true,
                name: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                createdBy: { select: { id: true, email: true } },
            },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'FORECAST_VIEW',
                entityType: 'FORECAST',
                entityId: query?.fiscalYear ? String(query.fiscalYear) : 'LIST',
                action: 'FORECAST_VIEW',
                outcome: 'SUCCESS',
                userId: user.id,
                permissionUsed: 'forecast.view',
            },
        })
            .catch(() => undefined);
        return rows;
    }
    async getForecast(req, id) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const forecast = await this.prisma.forecast.findFirst({
            where: { tenantId: tenant.id, id },
            select: {
                id: true,
                tenantId: true,
                fiscalYear: true,
                name: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                createdBy: { select: { id: true, email: true } },
            },
        });
        if (!forecast)
            throw new common_1.NotFoundException('Forecast not found');
        const versions = await this.prisma.forecastVersion.findMany({
            where: { forecastId: forecast.id },
            orderBy: { versionNumber: 'desc' },
            select: {
                id: true,
                forecastId: true,
                versionNumber: true,
                status: true,
                createdAt: true,
                createdBy: { select: { id: true, email: true } },
            },
        });
        const latestVersion = versions[0];
        const lines = latestVersion
            ? await this.prisma.forecastLine.findMany({
                where: { forecastVersionId: latestVersion.id },
                orderBy: [{ accountId: 'asc' }, { month: 'asc' }],
                select: {
                    id: true,
                    accountId: true,
                    month: true,
                    amount: true,
                    account: { select: { id: true, code: true, name: true } },
                },
            })
            : [];
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'FORECAST_VIEW',
                entityType: 'FORECAST',
                entityId: forecast.id,
                action: 'FORECAST_VIEW',
                outcome: 'SUCCESS',
                userId: user.id,
                permissionUsed: 'forecast.view',
                forecastId: forecast.id,
                forecastVersionId: latestVersion?.id,
            },
        })
            .catch(() => undefined);
        return { forecast, versions, latestVersion, lines };
    }
    async submitForecast(req, id) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const forecast = await this.prisma.forecast.findFirst({
            where: { tenantId: tenant.id, id },
            select: { id: true, status: true },
        });
        if (!forecast)
            throw new common_1.NotFoundException('Forecast not found');
        if (forecast.status === 'APPROVED')
            throw new common_1.BadRequestException('Approved forecasts are read-only');
        if (forecast.status === 'SUPERSEDED')
            throw new common_1.BadRequestException('Superseded forecasts are read-only');
        const version = await this.prisma.forecastVersion.findFirst({
            where: { forecastId: forecast.id },
            orderBy: { versionNumber: 'desc' },
            select: { id: true, status: true },
        });
        if (!version)
            throw new common_1.BadRequestException('Forecast has no versions');
        if (version.status !== 'DRAFT')
            throw new common_1.BadRequestException('Only DRAFT versions can be submitted');
        const updated = await this.prisma.$transaction(async (tx) => {
            const v = await tx.forecastVersion.update({
                where: { id: version.id },
                data: { status: 'SUBMITTED' },
                select: {
                    id: true,
                    forecastId: true,
                    versionNumber: true,
                    status: true,
                    createdAt: true,
                },
            });
            const f = await tx.forecast.update({
                where: { id: forecast.id },
                data: { status: 'SUBMITTED' },
                select: {
                    id: true,
                    tenantId: true,
                    fiscalYear: true,
                    name: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            await tx.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'FORECAST_SUBMIT',
                    entityType: 'FORECAST',
                    entityId: f.id,
                    action: 'FORECAST_SUBMIT',
                    outcome: 'SUCCESS',
                    userId: user.id,
                    permissionUsed: 'forecast.submit',
                    forecastId: f.id,
                    forecastVersionId: v.id,
                },
            })
                .catch(() => undefined);
            await tx.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'FORECAST_UPDATE',
                    entityType: 'FORECAST',
                    entityId: f.id,
                    action: 'FORECAST_UPDATE',
                    outcome: 'SUCCESS',
                    userId: user.id,
                    permissionUsed: 'forecast.submit',
                    forecastId: f.id,
                    forecastVersionId: v.id,
                },
            })
                .catch(() => undefined);
            return { forecast: f, version: v };
        });
        return updated;
    }
    async approveForecast(req, id) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const forecast = await this.prisma.forecast.findFirst({
            where: { tenantId: tenant.id, id },
            select: { id: true, createdById: true, status: true },
        });
        if (!forecast)
            throw new common_1.NotFoundException('Forecast not found');
        if (forecast.createdById === user.id) {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'FORECAST_APPROVE',
                    entityType: 'FORECAST',
                    entityId: forecast.id,
                    action: 'FORECAST_APPROVE',
                    outcome: 'BLOCKED',
                    reason: 'Creator cannot approve',
                    userId: user.id,
                    permissionUsed: 'forecast.approve',
                    forecastId: forecast.id,
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException('Creator cannot approve');
        }
        const toApprove = await this.prisma.forecastVersion.findFirst({
            where: { forecastId: forecast.id },
            orderBy: { versionNumber: 'desc' },
            select: { id: true, status: true },
        });
        if (!toApprove)
            throw new common_1.BadRequestException('Forecast has no versions');
        if (toApprove.status !== 'SUBMITTED')
            throw new common_1.BadRequestException('Only SUBMITTED versions can be approved');
        const updated = await this.prisma.$transaction(async (tx) => {
            const existingApproved = await tx.forecastVersion.findFirst({
                where: { forecastId: forecast.id, status: 'APPROVED' },
                select: { id: true },
            });
            if (existingApproved) {
                await tx.forecastVersion.update({
                    where: { id: existingApproved.id },
                    data: { status: 'SUPERSEDED' },
                });
                await tx.auditEvent
                    .create({
                    data: {
                        tenantId: tenant.id,
                        eventType: 'FORECAST_SUPERSEDE',
                        entityType: 'FORECAST',
                        entityId: forecast.id,
                        action: 'FORECAST_SUPERSEDE',
                        outcome: 'SUCCESS',
                        userId: user.id,
                        permissionUsed: 'forecast.approve',
                        forecastId: forecast.id,
                        forecastVersionId: existingApproved.id,
                    },
                })
                    .catch(() => undefined);
                await tx.auditEvent
                    .create({
                    data: {
                        tenantId: tenant.id,
                        eventType: 'FORECAST_UPDATE',
                        entityType: 'FORECAST',
                        entityId: forecast.id,
                        action: 'FORECAST_UPDATE',
                        outcome: 'SUCCESS',
                        userId: user.id,
                        permissionUsed: 'forecast.approve',
                        forecastId: forecast.id,
                        forecastVersionId: existingApproved.id,
                    },
                })
                    .catch(() => undefined);
            }
            const v = await tx.forecastVersion.update({
                where: { id: toApprove.id },
                data: { status: 'APPROVED' },
                select: {
                    id: true,
                    forecastId: true,
                    versionNumber: true,
                    status: true,
                    createdAt: true,
                },
            });
            const f = await tx.forecast.update({
                where: { id: forecast.id },
                data: { status: 'APPROVED' },
                select: {
                    id: true,
                    tenantId: true,
                    fiscalYear: true,
                    name: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            await tx.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'FORECAST_APPROVE',
                    entityType: 'FORECAST',
                    entityId: f.id,
                    action: 'FORECAST_APPROVE',
                    outcome: 'SUCCESS',
                    userId: user.id,
                    permissionUsed: 'forecast.approve',
                    forecastId: f.id,
                    forecastVersionId: v.id,
                },
            })
                .catch(() => undefined);
            await tx.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'FORECAST_UPDATE',
                    entityType: 'FORECAST',
                    entityId: f.id,
                    action: 'FORECAST_UPDATE',
                    outcome: 'SUCCESS',
                    userId: user.id,
                    permissionUsed: 'forecast.approve',
                    forecastId: f.id,
                    forecastVersionId: v.id,
                },
            })
                .catch(() => undefined);
            return { forecast: f, version: v };
        });
        return updated;
    }
    async updateForecastLines(req, id, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const forecast = await this.prisma.forecast.findFirst({
            where: { tenantId: tenant.id, id },
            select: { id: true, status: true },
        });
        if (!forecast)
            throw new common_1.NotFoundException('Forecast not found');
        if (forecast.status !== 'DRAFT') {
            throw new common_1.BadRequestException('Only DRAFT forecasts can be edited');
        }
        const version = await this.prisma.forecastVersion.findFirst({
            where: { forecastId: forecast.id },
            orderBy: { versionNumber: 'desc' },
            select: { id: true, status: true },
        });
        if (!version)
            throw new common_1.BadRequestException('Forecast has no versions');
        if (version.status !== 'DRAFT')
            throw new common_1.BadRequestException('Only DRAFT versions can be edited');
        const lines = dto.lines ?? [];
        if (lines.length === 0) {
            throw new common_1.BadRequestException('Forecast lines cannot be empty');
        }
        const invalidMonth = lines.find((l) => !Number.isInteger(l.month) || l.month < 1 || l.month > 12);
        if (invalidMonth) {
            throw new common_1.BadRequestException('Forecast line month must be an integer between 1 and 12');
        }
        const accountIds = [...new Set(lines.map((l) => l.accountId))];
        const accounts = await this.prisma.account.findMany({
            where: { tenantId: tenant.id, id: { in: accountIds } },
            select: { id: true },
        });
        if (accounts.length !== accountIds.length) {
            throw new common_1.BadRequestException('One or more accounts are invalid for this tenant');
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.forecastLine.deleteMany({
                where: { forecastVersionId: version.id },
            });
            await tx.forecastLine.createMany({
                data: lines.map((l) => ({
                    forecastVersionId: version.id,
                    accountId: l.accountId,
                    month: l.month,
                    amount: l.amount,
                })),
            });
            const f = await tx.forecast.update({
                where: { id: forecast.id },
                data: { updatedAt: new Date() },
                select: {
                    id: true,
                    tenantId: true,
                    fiscalYear: true,
                    name: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            await tx.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'FORECAST_UPDATE',
                    entityType: 'FORECAST',
                    entityId: f.id,
                    action: 'FORECAST_UPDATE',
                    outcome: 'SUCCESS',
                    userId: user.id,
                    permissionUsed: 'forecast.edit',
                    forecastId: f.id,
                    forecastVersionId: version.id,
                },
            })
                .catch(() => undefined);
            return f;
        });
        return updated;
    }
};
exports.ForecastsService = ForecastsService;
exports.ForecastsService = ForecastsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ForecastsService);
//# sourceMappingURL=forecasts.service.js.map