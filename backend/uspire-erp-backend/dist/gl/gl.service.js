"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlService = exports.DepartmentRequirement = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const ExcelJS = __importStar(require("exceljs"));
const cache_service_1 = require("../cache/cache.service");
const prisma_service_1 = require("../prisma/prisma.service");
const finance_authz_helpers_1 = require("../rbac/finance-authz.helpers");
var DepartmentRequirement;
(function (DepartmentRequirement) {
    DepartmentRequirement["REQUIRED"] = "REQUIRED";
    DepartmentRequirement["OPTIONAL"] = "OPTIONAL";
    DepartmentRequirement["FORBIDDEN"] = "FORBIDDEN";
})(DepartmentRequirement || (exports.DepartmentRequirement = DepartmentRequirement = {}));
let GlService = class GlService {
    prisma;
    cache;
    constructor(prisma, cache) {
        this.prisma = prisma;
        this.cache = cache;
    }
    parseOptionalYmd(s) {
        const v = (s ?? '').trim();
        if (!v)
            return null;
        const d = new Date(v);
        if (Number.isNaN(d.getTime()))
            return null;
        return d;
    }
    riskBandFromScore(score) {
        if (score >= 40)
            return 'HIGH';
        if (score >= 20)
            return 'MEDIUM';
        return 'LOW';
    }
    toNum(v) {
        if (v === null || v === undefined)
            return 0;
        if (typeof v === 'number')
            return Number.isFinite(v) ? v : 0;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }
    round2(n) {
        return Math.round(n * 100) / 100;
    }
    startOfUtcDay(d) {
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    addUtcDays(d, days) {
        const dd = new Date(d.getTime());
        dd.setUTCDate(dd.getUTCDate() + days);
        return dd;
    }
    async resolveOpenPeriodForDate(params) {
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: params.tenantId,
                startDate: { lte: params.journalDate },
                endDate: { gte: params.journalDate },
            },
            select: {
                id: true,
                status: true,
                name: true,
                startDate: true,
                endDate: true,
            },
        });
        if (!period) {
            throw new common_1.BadRequestException({
                code: 'INVALID_JOURNAL_DATE',
                reason: 'NO_PERIOD',
                message: 'No accounting period exists for the selected date.',
            });
        }
        if (period.status !== 'OPEN') {
            throw new common_1.BadRequestException({
                code: 'INVALID_JOURNAL_DATE',
                reason: 'PERIOD_CLOSED',
                message: 'Selected accounting period is closed. Choose an open period.',
            });
        }
        return period;
    }
    async computeJournalBudgetImpact(params) {
        const period = await this.resolveOpenPeriodForDate({
            tenantId: params.tenantId,
            journalDate: params.entry.journalDate,
        });
        const fiscalYear = new Date(period.startDate).getUTCFullYear();
        const activeBudget = await this.prisma.budget.findFirst({
            where: {
                tenantId: params.tenantId,
                fiscalYear,
                status: 'ACTIVE',
            },
            orderBy: { approvedAt: 'desc' },
            select: { id: true },
        });
        const revision = activeBudget
            ? await this.prisma.budgetRevision.findFirst({
                where: { tenantId: params.tenantId, budgetId: activeBudget.id },
                orderBy: { revisionNo: 'desc' },
                select: { id: true },
            })
            : null;
        const accountIds = [
            ...new Set(params.lines.map((l) => l.accountId).filter(Boolean)),
        ];
        const accounts = await this.prisma.account.findMany({
            where: { tenantId: params.tenantId, id: { in: accountIds } },
            select: {
                id: true,
                code: true,
                isBudgetRelevant: true,
                budgetControlMode: true,
            },
        });
        const accountById = new Map(accounts.map((a) => [a.id, a]));
        const budgetLines = revision
            ? await this.prisma.budgetLine.findMany({
                where: {
                    tenantId: params.tenantId,
                    revisionId: revision.id,
                    periodId: period.id,
                    accountId: { in: accountIds },
                },
                select: {
                    id: true,
                    accountId: true,
                    periodId: true,
                    legalEntityId: true,
                    departmentId: true,
                    projectId: true,
                    fundId: true,
                    amount: true,
                },
            })
            : [];
        const byKey = new Map();
        for (const bl of budgetLines) {
            const k = `${bl.accountId}:${bl.periodId}:${bl.legalEntityId ?? ''}:${bl.departmentId ?? ''}:${bl.projectId ?? ''}:${bl.fundId ?? ''}`;
            byKey.set(k, bl);
        }
        const lineImpacts = [];
        for (const l of params.lines) {
            const account = accountById.get(l.accountId);
            const lineAmount = Math.max(this.toNum(l.debit), this.toNum(l.credit));
            const flags = [];
            let status = 'OK';
            let matchedBudgetLine = null;
            let budgetedAmount = null;
            let availableAmount = null;
            let variance = null;
            const isBudgetRelevant = Boolean(account?.isBudgetRelevant);
            if (!isBudgetRelevant) {
                lineImpacts.push({
                    lineId: l.id,
                    lineNumber: l.lineNumber ?? null,
                    accountId: l.accountId,
                    accountCode: account?.code ?? null,
                    lineAmount,
                    legalEntityId: l.legalEntityId,
                    departmentId: l.departmentId,
                    projectId: l.projectId,
                    fundId: l.fundId,
                    matchedBudgetLine: null,
                    budgetedAmount: null,
                    availableAmount: null,
                    variance: null,
                    status: 'OK',
                    flags: [],
                });
                continue;
            }
            const kExact = `${l.accountId}:${period.id}:${l.legalEntityId ?? ''}:${l.departmentId ?? ''}:${l.projectId ?? ''}:${l.fundId ?? ''}`;
            const kFallback = `${l.accountId}:${period.id}::::`;
            const blExact = byKey.get(kExact);
            const blFallback = byKey.get(kFallback);
            const bl = blExact ?? blFallback;
            if (!bl) {
                status = 'WARN';
                flags.push('NO_BUDGET_LINE_FOUND');
            }
            else {
                const blAmount = this.toNum(bl.amount);
                matchedBudgetLine = {
                    id: bl.id,
                    amount: blAmount,
                    matchType: blExact ? 'EXACT' : 'FALLBACK',
                };
                budgetedAmount = blAmount;
                availableAmount = blAmount;
                variance = this.round2(lineAmount - availableAmount);
                if (availableAmount !== null && lineAmount > availableAmount) {
                    flags.push('BUDGET_EXCEEDED');
                    const mode = (account?.budgetControlMode ?? 'WARN');
                    status = mode === 'BLOCK' ? 'BLOCK' : 'WARN';
                }
            }
            lineImpacts.push({
                lineId: l.id,
                lineNumber: l.lineNumber ?? null,
                accountId: l.accountId,
                accountCode: account?.code ?? null,
                lineAmount,
                legalEntityId: l.legalEntityId,
                departmentId: l.departmentId,
                projectId: l.projectId,
                fundId: l.fundId,
                matchedBudgetLine,
                budgetedAmount,
                availableAmount,
                variance,
                status,
                flags,
            });
        }
        const budgetStatus = lineImpacts.some((l) => l.status === 'BLOCK')
            ? 'BLOCK'
            : lineImpacts.some((l) => l.status === 'WARN')
                ? 'WARN'
                : 'OK';
        const budgetFlags = lineImpacts
            .filter((l) => l.status !== 'OK' || (l.flags ?? []).length)
            .map((l) => ({
            type: 'LINE',
            lineId: l.lineId,
            lineNumber: l.lineNumber,
            accountId: l.accountId,
            accountCode: l.accountCode,
            amount: l.lineAmount,
            legalEntityId: l.legalEntityId,
            departmentId: l.departmentId,
            projectId: l.projectId,
            fundId: l.fundId,
            status: l.status,
            flags: l.flags,
            budgetedAmount: l.budgetedAmount,
            availableAmount: l.availableAmount,
            variance: l.variance,
            matchedBudgetLine: l.matchedBudgetLine,
        }));
        return { budgetStatus, budgetFlags, lineImpacts };
    }
    async persistJournalBudgetImpact(params) {
        await this.prisma.journalEntry
            .update({
            where: { id: params.journalId },
            data: {
                budgetStatus: params.budgetStatus,
                budgetFlags: params.budgetFlags,
                budgetCheckedAt: params.computedAt,
            },
            select: { id: true },
        })
            .catch(() => undefined);
    }
    async auditJournalBudgetEvaluated(params) {
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: params.tenantId,
                eventType: 'GL_JOURNAL_BUDGET_EVALUATED',
                entityType: 'JOURNAL_ENTRY',
                entityId: params.journalId,
                action: params.permissionUsed,
                outcome: 'SUCCESS',
                reason: JSON.stringify({
                    journalId: params.journalId,
                    budgetStatus: params.budgetStatus,
                    budgetFlags: params.budgetFlags,
                    computedAt: params.computedAt.toISOString(),
                    lifecycleStage: params.stage,
                }),
                userId: params.userId,
                permissionUsed: params.permissionUsed,
            },
        })
            .catch(() => undefined);
    }
    async getBudgetRepeatWarnUplift(params) {
        const from = this.startOfUtcDay(this.addUtcDays(params.now, -30));
        const priorWarnCount = await this.prisma.journalEntry.count({
            where: {
                tenantId: params.tenantId,
                createdById: params.createdById,
                id: { not: params.excludeJournalId },
                budgetStatus: 'WARN',
                budgetCheckedAt: { gte: from },
            },
        });
        const points = Math.min(priorWarnCount * 5, 20);
        return {
            priorWarnCount,
            points,
        };
    }
    buildJournalRiskWhereSql(params) {
        const where = [
            client_1.Prisma.sql `je."tenantId" = ${params.tenantId}`,
        ];
        const from = this.parseOptionalYmd(params.dateFrom);
        const to = this.parseOptionalYmd(params.dateTo);
        if (from)
            where.push(client_1.Prisma.sql `je."journalDate" >= ${from}`);
        if (to)
            where.push(client_1.Prisma.sql `je."journalDate" <= ${to}`);
        const periodId = (params.periodId ?? '').trim();
        if (periodId)
            where.push(client_1.Prisma.sql `je."periodId" = ${periodId}`);
        where.push(client_1.Prisma.sql `je."riskScore" IS NOT NULL`);
        return client_1.Prisma.join(where, ' AND ');
    }
    buildLineDimensionWhereSql(params) {
        const where = [];
        const legalEntityId = (params.legalEntityId ?? '').trim();
        const departmentId = (params.departmentId ?? '').trim();
        const projectId = (params.projectId ?? '').trim();
        const fundId = (params.fundId ?? '').trim();
        if (legalEntityId)
            where.push(client_1.Prisma.sql `jl."legalEntityId" = ${legalEntityId}`);
        if (departmentId)
            where.push(client_1.Prisma.sql `jl."departmentId" = ${departmentId}`);
        if (projectId)
            where.push(client_1.Prisma.sql `jl."projectId" = ${projectId}`);
        if (fundId)
            where.push(client_1.Prisma.sql `jl."fundId" = ${fundId}`);
        return where.length
            ? client_1.Prisma.sql ` AND ${client_1.Prisma.join(where, ' AND ')}`
            : client_1.Prisma.sql ``;
    }
    async getJournalRiskOverview(req, filters) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_VIEW');
        const whereJe = this.buildJournalRiskWhereSql({
            tenantId: authz.tenantId,
            periodId: filters.periodId,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
        });
        const lineDimWhere = this.buildLineDimensionWhereSql(filters);
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      WITH scoped AS (
        SELECT je.id, je."riskScore"
        FROM "JournalEntry" je
        WHERE ${whereJe}
        AND (
          ${client_1.Prisma.sql `${filters.legalEntityId ||
            filters.departmentId ||
            filters.projectId ||
            filters.fundId
            ? client_1.Prisma.sql `
            EXISTS (
              SELECT 1
              FROM "JournalLine" jl
              WHERE jl."journalEntryId" = je.id
              ${lineDimWhere}
            )
          `
            : client_1.Prisma.sql `TRUE`}`}
        )
      )
      SELECT
        COUNT(*)::int AS "total",
        AVG(scoped."riskScore")::float AS "avgRisk",
        SUM(CASE WHEN scoped."riskScore" < 20 THEN 1 ELSE 0 END)::int AS "lowCount",
        SUM(CASE WHEN scoped."riskScore" >= 20 AND scoped."riskScore" < 40 THEN 1 ELSE 0 END)::int AS "medCount",
        SUM(CASE WHEN scoped."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount"
      FROM scoped;
    `);
        const r = rows?.[0] ?? {
            total: 0,
            avgRisk: null,
            lowCount: 0,
            medCount: 0,
            highCount: 0,
        };
        const total = Number(r.total ?? 0);
        const highCount = Number(r.highCount ?? 0);
        const highPct = total > 0 ? Math.round((highCount / total) * 1000) / 10 : 0;
        return {
            total,
            avgRiskScore: r.avgRisk === null ? 0 : Number(r.avgRisk),
            highRiskPct: highPct,
            distribution: {
                LOW: Number(r.lowCount ?? 0),
                MEDIUM: Number(r.medCount ?? 0),
                HIGH: Number(r.highCount ?? 0),
            },
        };
    }
    async getJournalRiskUsers(req, filters) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_VIEW');
        const whereJe = this.buildJournalRiskWhereSql({
            tenantId: authz.tenantId,
            periodId: filters.periodId,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
        });
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT
        u.id AS "userId",
        u.email AS "userEmail",
        u.name AS "userName",
        COUNT(je.id)::int AS "total",
        AVG(je."riskScore")::float AS "avgRisk",
        SUM(CASE WHEN je."riskScore" < 20 THEN 1 ELSE 0 END)::int AS "lowCount",
        SUM(CASE WHEN je."riskScore" >= 20 AND je."riskScore" < 40 THEN 1 ELSE 0 END)::int AS "medCount",
        SUM(CASE WHEN je."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount",
        SUM(CASE WHEN je."riskFlags" @> '["LATE_POSTING"]'::jsonb THEN 1 ELSE 0 END)::int AS "latePostingCount",
        SUM(CASE WHEN je."riskFlags" @> '["REVERSAL"]'::jsonb THEN 1 ELSE 0 END)::int AS "reversalCount",
        SUM(CASE WHEN je."riskFlags" @> '["OVERRIDE_USED"]'::jsonb THEN 1 ELSE 0 END)::int AS "overrideCount",
        SUM(CASE WHEN je."riskFlags" @> '["HIGH_VALUE"]'::jsonb THEN 1 ELSE 0 END)::int AS "highValueCount",
        SUM(CASE WHEN je."riskFlags" @> '["SENSITIVE_ACCOUNT"]'::jsonb THEN 1 ELSE 0 END)::int AS "unusualAccountCount"
      FROM "JournalEntry" je
      JOIN "User" u ON u.id = je."submittedById"
      WHERE ${whereJe}
      GROUP BY u.id, u.email, u.name
      ORDER BY "highCount" DESC, "avgRisk" DESC NULLS LAST, "total" DESC;
    `);
        return rows.map((r) => {
            const total = Number(r.total ?? 0);
            return {
                user: {
                    id: r.userId,
                    email: r.userEmail,
                    name: r.userName,
                },
                totals: {
                    journals: total,
                    avgRiskScore: r.avgRisk === null ? 0 : Number(r.avgRisk),
                    byBand: {
                        LOW: Number(r.lowCount ?? 0),
                        MEDIUM: Number(r.medCount ?? 0),
                        HIGH: Number(r.highCount ?? 0),
                    },
                },
                flaggedCounts: {
                    late_posting: Number(r.latePostingCount ?? 0),
                    reversal: Number(r.reversalCount ?? 0),
                    override: Number(r.overrideCount ?? 0),
                    high_value: Number(r.highValueCount ?? 0),
                    unusual_account: Number(r.unusualAccountCount ?? 0),
                },
            };
        });
    }
    async getJournalRiskAccounts(req, filters) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_VIEW');
        const whereJe = this.buildJournalRiskWhereSql({
            tenantId: authz.tenantId,
            periodId: filters.periodId,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
        });
        const lineDimWhere = this.buildLineDimensionWhereSql(filters);
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      WITH scoped_lines AS (
        SELECT DISTINCT
          jl."journalEntryId" AS "journalEntryId",
          jl."accountId" AS "accountId"
        FROM "JournalLine" jl
        JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
        WHERE ${whereJe}
        ${lineDimWhere}
      ),
      base AS (
        SELECT
          sl."accountId",
          je."riskScore"::int AS "riskScore",
          je."riskFlags" AS "riskFlags"
        FROM scoped_lines sl
        JOIN "JournalEntry" je ON je.id = sl."journalEntryId"
      ),
      flag_counts AS (
        SELECT
          b."accountId" AS "accountId",
          f.flag AS flag,
          COUNT(*)::int AS cnt
        FROM base b
        LEFT JOIN LATERAL jsonb_array_elements_text(COALESCE(b."riskFlags", '[]'::jsonb)) AS f(flag) ON TRUE
        GROUP BY b."accountId", f.flag
      ),
      flag_ranked AS (
        SELECT
          fc.accountId,
          jsonb_agg(fc.flag ORDER BY fc.cnt DESC, fc.flag ASC) FILTER (WHERE fc.flag IS NOT NULL) AS flags
        FROM flag_counts fc
        GROUP BY fc.accountId
      )
      SELECT
        a.id AS "accountId",
        a.code AS "accountCode",
        a.name AS "accountName",
        COUNT(*)::int AS "journalCount",
        AVG(b."riskScore")::float AS "avgRisk",
        (SUM(CASE WHEN b."riskScore" >= 40 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)::float) * 100.0 AS "highRiskPct",
        COALESCE(fr.flags, '[]'::jsonb) AS "topFlags"
      FROM base b
      JOIN "Account" a ON a.id = b."accountId"
      LEFT JOIN flag_ranked fr ON fr.accountId = a.id
      WHERE a."tenantId" = ${authz.tenantId}
      GROUP BY a.id, a.code, a.name, fr.flags
      ORDER BY "avgRisk" DESC NULLS LAST, "journalCount" DESC, a.code ASC
      LIMIT 250;
    `);
        return rows.map((r) => {
            const flags = Array.isArray(r.topFlags)
                ? r.topFlags
                : (r.topFlags?.flags ?? r.topFlags);
            const topFlags = Array.isArray(flags)
                ? flags.slice(0, 5).map(String)
                : [];
            return {
                account: {
                    id: r.accountId,
                    code: r.accountCode,
                    name: r.accountName,
                },
                journalCount: Number(r.journalCount ?? 0),
                avgRiskScore: r.avgRisk === null ? 0 : Number(r.avgRisk),
                highRiskPct: r.highRiskPct === null
                    ? 0
                    : Math.round(Number(r.highRiskPct) * 10) / 10,
                topRiskFlags: topFlags,
            };
        });
    }
    async getJournalRiskOrganisation(req, filters) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_VIEW');
        const whereJe = this.buildJournalRiskWhereSql({
            tenantId: authz.tenantId,
            periodId: filters.periodId,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
        });
        const [legalEntities, departments, projects, funds] = await Promise.all([
            this.prisma.$queryRaw(client_1.Prisma.sql `
        WITH d AS (
          SELECT DISTINCT jl."journalEntryId" AS "journalEntryId", jl."legalEntityId" AS dimId
          FROM "JournalLine" jl
          JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
          WHERE ${whereJe} AND jl."legalEntityId" IS NOT NULL
        )
        SELECT
          le.id,
          le.code,
          le.name,
          COUNT(*)::int AS "journalCount",
          AVG(je."riskScore")::float AS "avgRisk",
          SUM(CASE WHEN je."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount"
        FROM d
        JOIN "JournalEntry" je ON je.id = d."journalEntryId"
        JOIN "LegalEntity" le ON le.id = d.dimId
        WHERE le."tenantId" = ${authz.tenantId}
        GROUP BY le.id, le.code, le.name
        ORDER BY "avgRisk" DESC NULLS LAST, "journalCount" DESC
        LIMIT 250;
      `),
            this.prisma.$queryRaw(client_1.Prisma.sql `
        WITH d AS (
          SELECT DISTINCT jl."journalEntryId" AS "journalEntryId", jl."departmentId" AS dimId
          FROM "JournalLine" jl
          JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
          WHERE ${whereJe} AND jl."departmentId" IS NOT NULL
        )
        SELECT
          dep.id,
          dep.code,
          dep.name,
          COUNT(*)::int AS "journalCount",
          AVG(je."riskScore")::float AS "avgRisk",
          SUM(CASE WHEN je."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount"
        FROM d
        JOIN "JournalEntry" je ON je.id = d."journalEntryId"
        JOIN "Department" dep ON dep.id = d.dimId
        WHERE dep."tenantId" = ${authz.tenantId}
        GROUP BY dep.id, dep.code, dep.name
        ORDER BY "avgRisk" DESC NULLS LAST, "journalCount" DESC
        LIMIT 250;
      `),
            this.prisma.$queryRaw(client_1.Prisma.sql `
        WITH d AS (
          SELECT DISTINCT jl."journalEntryId" AS "journalEntryId", jl."projectId" AS dimId
          FROM "JournalLine" jl
          JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
          WHERE ${whereJe} AND jl."projectId" IS NOT NULL
        )
        SELECT
          p.id,
          p.code,
          p.name,
          COUNT(*)::int AS "journalCount",
          AVG(je."riskScore")::float AS "avgRisk",
          SUM(CASE WHEN je."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount"
        FROM d
        JOIN "JournalEntry" je ON je.id = d."journalEntryId"
        JOIN "Project" p ON p.id = d.dimId
        WHERE p."tenantId" = ${authz.tenantId}
        GROUP BY p.id, p.code, p.name
        ORDER BY "avgRisk" DESC NULLS LAST, "journalCount" DESC
        LIMIT 250;
      `),
            this.prisma.$queryRaw(client_1.Prisma.sql `
        WITH d AS (
          SELECT DISTINCT jl."journalEntryId" AS "journalEntryId", jl."fundId" AS dimId
          FROM "JournalLine" jl
          JOIN "JournalEntry" je ON je.id = jl."journalEntryId"
          WHERE ${whereJe} AND jl."fundId" IS NOT NULL
        )
        SELECT
          f.id,
          f.code,
          f.name,
          COUNT(*)::int AS "journalCount",
          AVG(je."riskScore")::float AS "avgRisk",
          SUM(CASE WHEN je."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount"
        FROM d
        JOIN "JournalEntry" je ON je.id = d."journalEntryId"
        JOIN "Fund" f ON f.id = d.dimId
        WHERE f."tenantId" = ${authz.tenantId}
        GROUP BY f.id, f.code, f.name
        ORDER BY "avgRisk" DESC NULLS LAST, "journalCount" DESC
        LIMIT 250;
      `),
        ]);
        const mapRows = (rows) => rows.map((r) => ({
            dimension: { id: r.id, code: r.code ?? null, name: r.name ?? null },
            journalCount: Number(r.journalCount ?? 0),
            avgRiskScore: r.avgRisk === null ? 0 : Number(r.avgRisk),
            highRiskCount: Number(r.highCount ?? 0),
        }));
        return {
            legalEntities: mapRows(legalEntities),
            departments: mapRows(departments),
            projects: mapRows(projects),
            funds: mapRows(funds),
        };
    }
    async getJournalRiskPeriods(req, filters) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_VIEW');
        const whereJe = this.buildJournalRiskWhereSql({
            tenantId: authz.tenantId,
            periodId: filters.periodId,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
        });
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      WITH base AS (
        SELECT
          je.id,
          je."periodId",
          je."riskScore"::int AS "riskScore",
          je."riskFlags" AS "riskFlags",
          CASE WHEN (je."journalType" = 'REVERSING' OR je."reversalOfId" IS NOT NULL) THEN 1 ELSE 0 END AS is_reversal
        FROM "JournalEntry" je
        WHERE ${whereJe}
      ),
      flag_counts AS (
        SELECT
          b."periodId" AS "periodId",
          f.flag AS flag,
          COUNT(*)::int AS cnt
        FROM base b
        LEFT JOIN LATERAL jsonb_array_elements_text(COALESCE(b."riskFlags", '[]'::jsonb)) AS f(flag) ON TRUE
        GROUP BY b."periodId", f.flag
      ),
      flag_ranked AS (
        SELECT
          fc."periodId" AS "periodId",
          jsonb_agg(fc.flag ORDER BY fc.cnt DESC, fc.flag ASC) FILTER (WHERE fc.flag IS NOT NULL) AS flags
        FROM flag_counts fc
        GROUP BY fc."periodId"
      )
      SELECT
        p.id AS "periodId",
        p.name AS "periodName",
        p."startDate" AS "startDate",
        p."endDate" AS "endDate",
        COUNT(b.id)::int AS "journalCount",
        AVG(b."riskScore")::float AS "avgRisk",
        SUM(CASE WHEN b."riskScore" >= 40 THEN 1 ELSE 0 END)::int AS "highCount",
        SUM(b.is_reversal)::int AS "reversalCount",
        COALESCE(fr.flags, '[]'::jsonb) AS "topFlags"
      FROM base b
      LEFT JOIN "AccountingPeriod" p ON p.id = b."periodId"
      LEFT JOIN flag_ranked fr ON fr."periodId" = b."periodId"
      WHERE (p."tenantId" = ${authz.tenantId} OR b."periodId" IS NULL)
      GROUP BY p.id, p.name, p."startDate", p."endDate", fr.flags
      ORDER BY p."startDate" DESC NULLS LAST, "journalCount" DESC
      LIMIT 60;
    `);
        return rows.map((r) => {
            const flags = Array.isArray(r.topFlags)
                ? r.topFlags
                : (r.topFlags?.flags ?? r.topFlags);
            const topFlags = Array.isArray(flags)
                ? flags.slice(0, 5).map(String)
                : [];
            return {
                period: r.periodId
                    ? {
                        id: r.periodId,
                        name: r.periodName,
                        startDate: r.startDate ? r.startDate.toISOString() : null,
                        endDate: r.endDate ? r.endDate.toISOString() : null,
                    }
                    : null,
                journalCount: Number(r.journalCount ?? 0),
                avgRiskScore: r.avgRisk === null ? 0 : Number(r.avgRisk),
                reversalCount: Number(r.reversalCount ?? 0),
                highRiskCount: Number(r.highCount ?? 0),
                topRiskFlags: topFlags,
            };
        });
    }
    JOURNAL_RISK_HIGH_VALUE_THRESHOLD = 100000;
    JOURNAL_RISK_MANUAL_JOURNAL_POINTS = 10;
    JOURNAL_RISK_HIGH_VALUE_POINTS = 15;
    JOURNAL_RISK_BACKDATED_POINTS = 10;
    JOURNAL_RISK_LATE_POSTING_POINTS = 10;
    JOURNAL_RISK_REVERSAL_POINTS = 20;
    JOURNAL_RISK_CORRECTING_POINTS = 15;
    JOURNAL_RISK_SENSITIVE_ACCOUNT_POINTS = 15;
    JOURNAL_RISK_OVERRIDE_USED_POINTS = 20;
    JOURNAL_RISK_SENSITIVE_ACCOUNT_CODES = new Set([
        'RETAINED_EARNINGS',
        '3000',
        'SUSPENSE',
        'TAX',
    ]);
    computeJournalRisk(params) {
        const flags = [];
        let score = 0;
        const totalAbs = params.lines.reduce((sum, l) => sum + Math.max(this.toNum(l.debit), this.toNum(l.credit)), 0);
        const isReversal = params.journal.journalType === 'REVERSING' ||
            Boolean(params.journal.reversalOfId);
        const isCorrecting = Boolean(params.journal.correctsJournalId);
        if (!isReversal) {
            flags.push('MANUAL_JOURNAL');
            score += this.JOURNAL_RISK_MANUAL_JOURNAL_POINTS;
        }
        if (isReversal) {
            flags.push('REVERSAL');
            score += this.JOURNAL_RISK_REVERSAL_POINTS;
        }
        if (isCorrecting) {
            flags.push('CORRECTING');
            score += this.JOURNAL_RISK_CORRECTING_POINTS;
        }
        if (totalAbs >= this.JOURNAL_RISK_HIGH_VALUE_THRESHOLD) {
            flags.push('HIGH_VALUE');
            score += this.JOURNAL_RISK_HIGH_VALUE_POINTS;
        }
        const createdYmd = params.journal.createdAt.toISOString().slice(0, 10);
        const journalYmd = params.journal.journalDate.toISOString().slice(0, 10);
        if (journalYmd < createdYmd) {
            flags.push('BACKDATED');
            score += this.JOURNAL_RISK_BACKDATED_POINTS;
        }
        if (params.stage === 'POST' && params.postingPeriod?.endDate) {
            const endYmd = params.postingPeriod.endDate.toISOString().slice(0, 10);
            const postYmd = params.computedAt.toISOString().slice(0, 10);
            if (postYmd > endYmd) {
                flags.push('LATE_POSTING');
                score += this.JOURNAL_RISK_LATE_POSTING_POINTS;
            }
        }
        const sensitiveUsed = params.lines.some((l) => {
            const code = (l.account?.code ?? '').trim();
            return code ? this.JOURNAL_RISK_SENSITIVE_ACCOUNT_CODES.has(code) : false;
        });
        if (sensitiveUsed) {
            flags.push('SENSITIVE_ACCOUNT');
            score += this.JOURNAL_RISK_SENSITIVE_ACCOUNT_POINTS;
        }
        const overrideUsed = false;
        if (overrideUsed) {
            flags.push('OVERRIDE_USED');
            score += this.JOURNAL_RISK_OVERRIDE_USED_POINTS;
        }
        if ((params.budget?.budgetStatus ?? null) === 'WARN') {
            flags.push('BUDGET_EXCEPTION');
            score += 15;
            const repeat = typeof params.budget?.warnRepeatUpliftPoints === 'number' &&
                Number.isFinite(params.budget?.warnRepeatUpliftPoints)
                ? Math.max(0, params.budget.warnRepeatUpliftPoints)
                : 0;
            if (repeat > 0) {
                flags.push('BUDGET_REPEAT_EXCEPTION');
                score += repeat;
            }
        }
        return { score, flags };
    }
    async persistJournalRisk(params) {
        await this.prisma.journalEntry
            .update({
            where: { id: params.journalId },
            data: {
                riskScore: params.score,
                riskFlags: params.flags,
                riskComputedAt: params.computedAt,
            },
            select: { id: true },
        })
            .catch(() => undefined);
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: params.tenantId,
                eventType: 'GL_JOURNAL_RISK_COMPUTED',
                entityType: 'JOURNAL_ENTRY',
                entityId: params.journalId,
                action: params.permissionUsed,
                outcome: 'SUCCESS',
                reason: JSON.stringify({
                    journalId: params.journalId,
                    riskScore: params.score,
                    riskFlags: params.flags,
                    computedAt: params.computedAt.toISOString(),
                    lifecycleStage: params.stage,
                }),
                userId: params.userId,
                permissionUsed: params.permissionUsed,
            },
        })
            .catch(() => undefined);
    }
    getDepartmentRequirement(account) {
        if (account.isControlAccount)
            return DepartmentRequirement.FORBIDDEN;
        if (account.type === 'INCOME' || account.type === 'EXPENSE')
            return DepartmentRequirement.REQUIRED;
        if (account.type === 'ASSET' ||
            account.type === 'LIABILITY' ||
            account.type === 'EQUITY') {
            return DepartmentRequirement.OPTIONAL;
        }
        return DepartmentRequirement.REQUIRED;
    }
    getDepartmentRequirementMessage(params) {
        if (params.requirement === DepartmentRequirement.FORBIDDEN) {
            return 'Department must not be provided for this account.';
        }
        if (params.requirement === DepartmentRequirement.OPTIONAL) {
            return 'Department is optional for this account.';
        }
        if (params.accountType === 'EXPENSE')
            return 'Department is required for expense accounts';
        if (params.accountType === 'INCOME')
            return 'Department is required for revenue accounts';
        return 'Department is required for this account type';
    }
    async listLegalEntities(req, params) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const effectiveOn = params?.effectiveOn
            ? new Date(params.effectiveOn)
            : new Date();
        if (Number.isNaN(effectiveOn.getTime())) {
            throw new common_1.BadRequestException('Invalid effectiveOn date');
        }
        return this.prisma.legalEntity.findMany({
            where: {
                tenantId: tenant.id,
                isActive: true,
                effectiveFrom: { lte: effectiveOn },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveOn } }],
            },
            orderBy: [{ code: 'asc' }],
            select: {
                id: true,
                code: true,
                name: true,
                isActive: true,
                effectiveFrom: true,
                effectiveTo: true,
            },
        });
    }
    async listDepartments(req, params) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const effectiveOn = params?.effectiveOn
            ? new Date(params.effectiveOn)
            : new Date();
        if (Number.isNaN(effectiveOn.getTime())) {
            throw new common_1.BadRequestException('Invalid effectiveOn date');
        }
        return this.prisma.department.findMany({
            where: {
                tenantId: tenant.id,
                isActive: true,
                effectiveFrom: { lte: effectiveOn },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveOn } }],
            },
            orderBy: [{ code: 'asc' }],
            select: {
                id: true,
                code: true,
                name: true,
                isActive: true,
                effectiveFrom: true,
                effectiveTo: true,
            },
        });
    }
    async getUserAuthz(req) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const userRoles = await this.prisma.userRole.findMany({
            where: {
                userId: user.id,
                role: { tenantId: tenant.id },
            },
            select: {
                role: {
                    select: {
                        rolePermissions: {
                            select: {
                                permission: { select: { code: true } },
                            },
                        },
                    },
                },
            },
        });
        const permissionCodes = new Set();
        for (const ur of userRoles) {
            for (const rp of ur.role.rolePermissions) {
                permissionCodes.add(rp.permission.code);
            }
        }
        return { tenantId: tenant.id, id: user.id, permissionCodes };
    }
    formatRecurringPlaceholders(template, runDate) {
        const month = runDate.toLocaleDateString('en-US', { month: 'long' });
        const year = runDate.getUTCFullYear().toString();
        return (template || '')
            .replaceAll('{MONTH}', month)
            .replaceAll('{YEAR}', year);
    }
    computeNextRunDate(params) {
        const monthsToAdd = params.frequency === 'MONTHLY'
            ? 1
            : params.frequency === 'QUARTERLY'
                ? 3
                : 12;
        const d = new Date(params.runDate);
        const day = d.getUTCDate();
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() + monthsToAdd);
        const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
        d.setUTCDate(Math.min(day, maxDay));
        return d;
    }
    async createRecurringTemplate(req, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        if ((dto.journalType ?? 'STANDARD') !== 'STANDARD') {
            throw new common_1.BadRequestException('Recurring templates support journalType STANDARD only');
        }
        const xorErrors = dto.lines.filter((l) => (l.debitAmount > 0 ? 1 : 0) + (l.creditAmount > 0 ? 1 : 0) !== 1);
        if (xorErrors.length > 0) {
            throw new common_1.BadRequestException('Each recurring template line must have either a debitAmount or a creditAmount (not both)');
        }
        this.assertBalanced(dto.lines.map((l) => ({ debit: l.debitAmount, credit: l.creditAmount })));
        const created = await this.prisma.recurringJournalTemplate.create({
            data: {
                tenantId: tenant.id,
                name: dto.name,
                journalType: 'STANDARD',
                referenceTemplate: dto.referenceTemplate,
                descriptionTemplate: dto.descriptionTemplate,
                frequency: dto.frequency,
                startDate: new Date(dto.startDate),
                endDate: dto.endDate ? new Date(dto.endDate) : null,
                nextRunDate: new Date(dto.nextRunDate),
                isActive: dto.isActive ?? true,
                createdById: user.id,
                lines: {
                    create: dto.lines
                        .slice()
                        .sort((a, b) => a.lineOrder - b.lineOrder)
                        .map((l) => ({
                        accountId: l.accountId,
                        descriptionTemplate: l.descriptionTemplate,
                        debitAmount: new client_1.Prisma.Decimal(l.debitAmount),
                        creditAmount: new client_1.Prisma.Decimal(l.creditAmount),
                        lineOrder: l.lineOrder,
                    })),
                },
            },
            include: { lines: true },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'RECURRING_TEMPLATE_CREATE',
                entityType: 'RECURRING_JOURNAL_TEMPLATE',
                entityId: created.id,
                action: 'FINANCE_GL_RECURRING_MANAGE',
                outcome: 'SUCCESS',
                userId: user.id,
                permissionUsed: 'FINANCE_GL_RECURRING_MANAGE',
            },
        })
            .catch(() => undefined);
        return created;
    }
    async uploadJournals(req, file) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        if (!file)
            throw new common_1.BadRequestException('Missing file');
        if (!file.originalname)
            throw new common_1.BadRequestException('Missing file name');
        if (!file.buffer)
            throw new common_1.BadRequestException('Missing file buffer');
        const fileName = String(file.originalname);
        const lower = fileName.toLowerCase();
        const isXlsx = lower.endsWith('.xlsx');
        const isCsv = lower.endsWith('.csv');
        if (!isXlsx && !isCsv) {
            throw new common_1.BadRequestException('Unsupported file type. Please upload .xlsx or .csv');
        }
        const errors = [];
        const journalsByKey = new Map();
        const linesByKey = new Map();
        const toNum = (v) => {
            if (v === null || v === undefined || v === '')
                return 0;
            const n = typeof v === 'number' ? v : Number(String(v).trim());
            return Number.isFinite(n) ? n : NaN;
        };
        const normalizeKey = (v) => String(v ?? '').trim();
        const normalizeHeader = (v) => String(v ?? '')
            .trim()
            .toLowerCase();
        const parseCsvRows = (buf) => {
            const text = buf.toString('utf8');
            const lines = text
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .split('\n')
                .filter((l) => l.trim().length > 0);
            if (lines.length === 0)
                return [];
            const parseLine = (line) => {
                const out = [];
                let cur = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const ch = line[i];
                    if (ch === '"') {
                        if (inQuotes && line[i + 1] === '"') {
                            cur += '"';
                            i++;
                        }
                        else {
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
                return out.map((s) => s.trim());
            };
            const headers = parseLine(lines[0]).map((h) => normalizeHeader(h));
            const rows = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = parseLine(lines[i]);
                const row = {};
                for (let j = 0; j < headers.length; j++) {
                    row[headers[j]] = cols[j] ?? '';
                }
                rows.push(row);
            }
            return rows;
        };
        const readXlsxSheetRows = async (buf, sheetName) => {
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(buf);
            const ws = wb.worksheets.find((s) => s.name.trim().toLowerCase() === sheetName.toLowerCase());
            if (!ws) {
                return { headers: [], rows: [] };
            }
            const headerRow = ws.getRow(1);
            const headers = [];
            headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const v = normalizeHeader(cell.value);
                headers[colNumber - 1] = v;
            });
            const rows = [];
            for (let r = 2; r <= ws.rowCount; r++) {
                const row = ws.getRow(r);
                const obj = {};
                headers.forEach((h, idx) => {
                    const cell = row.getCell(idx + 1);
                    const raw = cell.value?.text ?? cell.value;
                    obj[h] = raw;
                });
                const hasAny = Object.values(obj).some((v) => String(v ?? '').trim() !== '');
                if (hasAny)
                    rows.push({ __rowNumber: r, ...obj });
            }
            return { headers, rows };
        };
        try {
            if (isXlsx) {
                const journalsSheet = await readXlsxSheetRows(file.buffer, 'Journals');
                const linesSheet = await readXlsxSheetRows(file.buffer, 'JournalLines');
                if (journalsSheet.rows.length === 0) {
                    errors.push({
                        sheet: 'Journals',
                        message: 'Journals sheet is missing or empty',
                    });
                }
                if (linesSheet.rows.length === 0) {
                    errors.push({
                        sheet: 'JournalLines',
                        message: 'JournalLines sheet is missing or empty',
                    });
                }
                for (const r of journalsSheet.rows) {
                    const rowNumber = Number(r.__rowNumber) || 0;
                    const journalKey = normalizeKey(r['journalkey'] ?? r['journal_key'] ?? r['key']);
                    if (!journalKey) {
                        errors.push({
                            sheet: 'Journals',
                            rowNumber,
                            field: 'journalKey',
                            message: 'journalKey is required',
                        });
                        continue;
                    }
                    const journalType = String(r['journaltype'] ?? r['journal_type'] ?? 'STANDARD').trim();
                    if (journalType && journalType !== 'STANDARD') {
                        errors.push({
                            sheet: 'Journals',
                            rowNumber,
                            journalKey,
                            field: 'journalType',
                            message: 'journalType must be STANDARD for upload',
                        });
                    }
                    const jdRaw = r['journaldate'] ?? r['journal_date'];
                    const jd = jdRaw instanceof Date
                        ? jdRaw
                        : new Date(String(jdRaw ?? '').trim());
                    if (!jdRaw || Number.isNaN(jd.getTime())) {
                        errors.push({
                            sheet: 'Journals',
                            rowNumber,
                            journalKey,
                            field: 'journalDate',
                            message: 'journalDate is required and must be a valid date',
                        });
                        continue;
                    }
                    journalsByKey.set(journalKey, {
                        journalKey,
                        journalDate: jd,
                        journalType: 'STANDARD',
                        reference: String(r['reference'] ?? '').trim() || undefined,
                        description: String(r['description'] ?? '').trim() || undefined,
                    });
                }
                for (const r of linesSheet.rows) {
                    const rowNumber = Number(r.__rowNumber) || 0;
                    const journalKey = normalizeKey(r['journalkey'] ?? r['journal_key'] ?? r['key']);
                    if (!journalKey) {
                        errors.push({
                            sheet: 'JournalLines',
                            rowNumber,
                            field: 'journalKey',
                            message: 'journalKey is required',
                        });
                        continue;
                    }
                    const accountCode = String(r['accountcode'] ?? r['account_code'] ?? '').trim();
                    if (!accountCode) {
                        errors.push({
                            sheet: 'JournalLines',
                            rowNumber,
                            journalKey,
                            field: 'accountCode',
                            message: 'accountCode is required',
                        });
                    }
                    const legalEntityCode = String(r['legalentitycode'] ?? r['legal_entity_code'] ?? '').trim();
                    if (!legalEntityCode) {
                        errors.push({
                            sheet: 'JournalLines',
                            rowNumber,
                            journalKey,
                            field: 'legalEntityCode',
                            message: 'legalEntityCode is required',
                        });
                    }
                    const departmentCode = String(r['departmentcode'] ??
                        r['department_code'] ??
                        r['costcentrecode'] ??
                        r['cost_centre_code'] ??
                        '').trim();
                    const projectCode = String(r['projectcode'] ?? r['project_code'] ?? '').trim();
                    const fundCode = String(r['fundcode'] ?? r['fund_code'] ?? '').trim();
                    const debit = toNum(r['debit']);
                    const credit = toNum(r['credit']);
                    if (Number.isNaN(debit) || Number.isNaN(credit)) {
                        errors.push({
                            sheet: 'JournalLines',
                            rowNumber,
                            journalKey,
                            field: 'debit/credit',
                            message: 'debit and credit must be numeric',
                        });
                    }
                    const lineNumberRaw = r['linenumber'] ?? r['line_number'];
                    const lineNumber = lineNumberRaw === undefined ||
                        lineNumberRaw === null ||
                        String(lineNumberRaw).trim() === ''
                        ? undefined
                        : Number(lineNumberRaw);
                    const line = {
                        journalKey,
                        rowNumber,
                        lineNumber: Number.isFinite(lineNumber)
                            ? lineNumber
                            : undefined,
                        accountCode,
                        legalEntityCode: legalEntityCode || undefined,
                        departmentCode: departmentCode || undefined,
                        projectCode: projectCode || undefined,
                        fundCode: fundCode || undefined,
                        debit: Number.isFinite(debit) ? debit : 0,
                        credit: Number.isFinite(credit) ? credit : 0,
                        lineDescription: String(r['linedescription'] ?? r['line_description'] ?? '').trim() || undefined,
                    };
                    const arr = linesByKey.get(journalKey) ?? [];
                    arr.push(line);
                    linesByKey.set(journalKey, arr);
                }
            }
            if (isCsv) {
                const rows = parseCsvRows(file.buffer);
                if (rows.length === 0) {
                    errors.push({ sheet: 'CSV', message: 'CSV file is empty' });
                }
                for (let i = 0; i < rows.length; i++) {
                    const rowNumber = i + 2;
                    const r = rows[i];
                    const journalKey = normalizeKey(r['journalkey'] ?? r['journal_key'] ?? r['key']);
                    if (!journalKey) {
                        errors.push({
                            sheet: 'CSV',
                            rowNumber,
                            field: 'journalKey',
                            message: 'journalKey is required',
                        });
                        continue;
                    }
                    const jdRaw = r['journaldate'] ?? r['journal_date'];
                    const jd = new Date(String(jdRaw ?? '').trim());
                    if (!jdRaw || Number.isNaN(jd.getTime())) {
                        errors.push({
                            sheet: 'CSV',
                            rowNumber,
                            journalKey,
                            field: 'journalDate',
                            message: 'journalDate is required and must be a valid date',
                        });
                    }
                    const jt = String(r['journaltype'] ?? r['journal_type'] ?? 'STANDARD').trim();
                    if (jt && jt !== 'STANDARD') {
                        errors.push({
                            sheet: 'CSV',
                            rowNumber,
                            journalKey,
                            field: 'journalType',
                            message: 'journalType must be STANDARD for upload',
                        });
                    }
                    if (!journalsByKey.has(journalKey) &&
                        jdRaw &&
                        !Number.isNaN(jd.getTime())) {
                        journalsByKey.set(journalKey, {
                            journalKey,
                            journalDate: jd,
                            journalType: 'STANDARD',
                            reference: String(r['reference'] ?? '').trim() || undefined,
                            description: String(r['description'] ?? '').trim() || undefined,
                        });
                    }
                    const accountCode = String(r['accountcode'] ?? r['account_code'] ?? '').trim();
                    if (!accountCode) {
                        errors.push({
                            sheet: 'CSV',
                            rowNumber,
                            journalKey,
                            field: 'accountCode',
                            message: 'accountCode is required',
                        });
                    }
                    const legalEntityCode = String(r['legalentitycode'] ?? r['legal_entity_code'] ?? '').trim();
                    if (!legalEntityCode) {
                        errors.push({
                            sheet: 'CSV',
                            rowNumber,
                            journalKey,
                            field: 'legalEntityCode',
                            message: 'legalEntityCode is required',
                        });
                    }
                    const departmentCode = String(r['departmentcode'] ??
                        r['department_code'] ??
                        r['costcentrecode'] ??
                        r['cost_centre_code'] ??
                        '').trim();
                    const projectCode = String(r['projectcode'] ?? r['project_code'] ?? '').trim();
                    const fundCode = String(r['fundcode'] ?? r['fund_code'] ?? '').trim();
                    const debit = toNum(r['debit']);
                    const credit = toNum(r['credit']);
                    if (Number.isNaN(debit) || Number.isNaN(credit)) {
                        errors.push({
                            sheet: 'CSV',
                            rowNumber,
                            journalKey,
                            field: 'debit/credit',
                            message: 'debit and credit must be numeric',
                        });
                    }
                    const lineNumberRaw = r['linenumber'] ?? r['line_number'];
                    const lineNumber = lineNumberRaw ? Number(lineNumberRaw) : undefined;
                    const line = {
                        journalKey,
                        rowNumber,
                        lineNumber: Number.isFinite(lineNumber)
                            ? lineNumber
                            : undefined,
                        accountCode,
                        legalEntityCode: legalEntityCode || undefined,
                        departmentCode: departmentCode || undefined,
                        projectCode: projectCode || undefined,
                        fundCode: fundCode || undefined,
                        debit: Number.isFinite(debit) ? debit : 0,
                        credit: Number.isFinite(credit) ? credit : 0,
                        lineDescription: String(r['linedescription'] ?? r['line_description'] ?? '').trim() || undefined,
                    };
                    const arr = linesByKey.get(journalKey) ?? [];
                    arr.push(line);
                    linesByKey.set(journalKey, arr);
                }
            }
        }
        catch (e) {
            errors.push({
                message: `Failed to parse file: ${e?.message ?? String(e)}`,
            });
        }
        for (const [key] of linesByKey) {
            if (!journalsByKey.has(key)) {
                errors.push({
                    journalKey: key,
                    sheet: isXlsx ? 'JournalLines' : 'CSV',
                    message: 'journalKey exists in lines but not in Journals',
                });
            }
        }
        const keys = [...journalsByKey.keys()];
        if (keys.length === 0) {
            errors.push({ message: 'No journals found in upload' });
        }
        const allAccountCodes = [
            ...new Set([...linesByKey.values()]
                .flat()
                .map((l) => l.accountCode)
                .filter(Boolean)),
        ];
        const accounts = await this.prisma.account.findMany({
            where: { tenantId: tenant.id, code: { in: allAccountCodes } },
            select: {
                id: true,
                code: true,
                type: true,
                isActive: true,
                isPostingAllowed: true,
                isControlAccount: true,
            },
        });
        const accountByCode = new Map(accounts.map((a) => [a.code, a]));
        const allLegalEntityCodes = [
            ...new Set([...linesByKey.values()]
                .flat()
                .map((l) => l.legalEntityCode)
                .filter(Boolean)),
        ];
        const legalEntities = await this.prisma.legalEntity.findMany({
            where: { tenantId: tenant.id, code: { in: allLegalEntityCodes } },
            select: {
                id: true,
                code: true,
                isActive: true,
                effectiveFrom: true,
                effectiveTo: true,
            },
        });
        const legalEntityByCode = new Map(legalEntities.map((e) => [e.code, e]));
        const allDepartmentCodes = [
            ...new Set([...linesByKey.values()]
                .flat()
                .map((l) => l.departmentCode)
                .filter(Boolean)),
        ];
        const departments = await this.prisma.department.findMany({
            where: { tenantId: tenant.id, code: { in: allDepartmentCodes } },
            select: {
                id: true,
                code: true,
                isActive: true,
                effectiveFrom: true,
                effectiveTo: true,
            },
        });
        const departmentByCode = new Map(departments.map((d) => [d.code, d]));
        const allProjectCodes = [
            ...new Set([...linesByKey.values()]
                .flat()
                .map((l) => l.projectCode)
                .filter(Boolean)),
        ];
        const projects = await this.prisma.project.findMany({
            where: { tenantId: tenant.id, code: { in: allProjectCodes } },
            select: {
                id: true,
                code: true,
                isActive: true,
                effectiveFrom: true,
                effectiveTo: true,
            },
        });
        const projectByCode = new Map(projects.map((p) => [p.code, p]));
        const allFundCodes = [
            ...new Set([...linesByKey.values()]
                .flat()
                .map((l) => l.fundCode)
                .filter(Boolean)),
        ];
        const funds = await this.prisma.fund.findMany({
            where: { tenantId: tenant.id, code: { in: allFundCodes } },
            select: {
                id: true,
                code: true,
                projectId: true,
                isActive: true,
                effectiveFrom: true,
                effectiveTo: true,
            },
        });
        const fundByCode = new Map(funds.map((f) => [f.code, f]));
        const cutover = await this.getCutoverDateIfLocked({ tenantId: tenant.id });
        for (const key of keys) {
            const j = journalsByKey.get(key);
            const lines = (linesByKey.get(key) ?? [])
                .slice()
                .sort((a, b) => (a.lineNumber ?? 0) - (b.lineNumber ?? 0));
            if (lines.length < 2) {
                errors.push({
                    journalKey: key,
                    message: 'Journal must have at least 2 lines',
                });
                continue;
            }
            if (cutover && j.journalDate < cutover) {
                errors.push({
                    journalKey: key,
                    message: `Journal date is before cutover lock (${cutover.toISOString().slice(0, 10)})`,
                });
            }
            const period = await this.prisma.accountingPeriod.findFirst({
                where: {
                    tenantId: tenant.id,
                    startDate: { lte: j.journalDate },
                    endDate: { gte: j.journalDate },
                },
                select: { id: true, status: true, name: true },
            });
            if (!period || period.status !== 'OPEN') {
                errors.push({
                    journalKey: key,
                    message: !period
                        ? 'No accounting period exists for journalDate'
                        : `Accounting period is not OPEN: ${period.name}`,
                });
            }
            const hasAnyDebit = lines.some((l) => (l.debit ?? 0) > 0);
            const hasAnyCredit = lines.some((l) => (l.credit ?? 0) > 0);
            if (!hasAnyDebit || !hasAnyCredit) {
                errors.push({
                    journalKey: key,
                    message: 'Journal must contain at least one debit line and one credit line',
                });
            }
            const xorErrors = lines.filter((l) => ((l.debit ?? 0) > 0 ? 1 : 0) + ((l.credit ?? 0) > 0 ? 1 : 0) !== 1);
            if (xorErrors.length > 0) {
                for (const l of xorErrors) {
                    errors.push({
                        journalKey: key,
                        sheet: isXlsx ? 'JournalLines' : 'CSV',
                        rowNumber: l.rowNumber,
                        field: 'debit/credit',
                        message: 'Debit XOR Credit rule violated',
                    });
                }
            }
            try {
                this.assertBalanced(lines.map((l) => ({ debit: l.debit, credit: l.credit })));
            }
            catch (e) {
                const totalDebit = Math.round(lines.reduce((sum, l) => sum + (l.debit ?? 0), 0) * 100) /
                    100;
                const totalCredit = Math.round(lines.reduce((sum, l) => sum + (l.credit ?? 0), 0) * 100) /
                    100;
                const msg = typeof e?.message === 'string'
                    ? e.message
                    : typeof e?.response?.error === 'string'
                        ? e.response.error
                        : 'Journal is not balanced';
                errors.push({
                    journalKey: key,
                    field: 'totals',
                    message: `${msg} (totalDebit=${totalDebit}, totalCredit=${totalCredit})`,
                });
            }
            for (const l of lines) {
                const acc = accountByCode.get(l.accountCode);
                if (!acc) {
                    errors.push({
                        journalKey: key,
                        sheet: isXlsx ? 'JournalLines' : 'CSV',
                        rowNumber: l.rowNumber,
                        field: 'accountCode',
                        message: `Invalid account code: ${l.accountCode}`,
                    });
                    continue;
                }
                if (!acc.isActive) {
                    errors.push({
                        journalKey: key,
                        sheet: isXlsx ? 'JournalLines' : 'CSV',
                        rowNumber: l.rowNumber,
                        field: 'accountCode',
                        message: `Account is inactive: ${l.accountCode}`,
                    });
                }
                if (!acc.isPostingAllowed) {
                    errors.push({
                        journalKey: key,
                        sheet: isXlsx ? 'JournalLines' : 'CSV',
                        rowNumber: l.rowNumber,
                        field: 'accountCode',
                        message: `Account is non-posting and cannot be used in journals: ${l.accountCode}`,
                    });
                }
                if (!l.legalEntityCode) {
                    errors.push({
                        journalKey: key,
                        sheet: isXlsx ? 'JournalLines' : 'CSV',
                        rowNumber: l.rowNumber,
                        field: 'legalEntityCode',
                        message: 'legalEntityCode is required',
                    });
                }
                else {
                    const le = legalEntityByCode.get(l.legalEntityCode);
                    if (!le) {
                        errors.push({
                            journalKey: key,
                            sheet: isXlsx ? 'JournalLines' : 'CSV',
                            rowNumber: l.rowNumber,
                            field: 'legalEntityCode',
                            message: `Invalid legalEntityCode: ${l.legalEntityCode}`,
                        });
                    }
                    else {
                        const effective = le.effectiveFrom <= j.journalDate &&
                            (le.effectiveTo === null || le.effectiveTo >= j.journalDate);
                        if (!le.isActive) {
                            errors.push({
                                journalKey: key,
                                sheet: isXlsx ? 'JournalLines' : 'CSV',
                                rowNumber: l.rowNumber,
                                field: 'legalEntityCode',
                                message: `Legal Entity is inactive: ${l.legalEntityCode}`,
                            });
                        }
                        if (!effective) {
                            errors.push({
                                journalKey: key,
                                sheet: isXlsx ? 'JournalLines' : 'CSV',
                                rowNumber: l.rowNumber,
                                field: 'legalEntityCode',
                                message: `Legal Entity is not effective for journalDate: ${l.legalEntityCode}`,
                            });
                        }
                    }
                }
                const departmentRequirement = this.getDepartmentRequirement(acc);
                if (!l.departmentCode) {
                    if (departmentRequirement === DepartmentRequirement.REQUIRED) {
                        errors.push({
                            journalKey: key,
                            sheet: isXlsx ? 'JournalLines' : 'CSV',
                            rowNumber: l.rowNumber,
                            field: 'departmentCode',
                            message: this.getDepartmentRequirementMessage({
                                requirement: departmentRequirement,
                                accountType: acc.type,
                            }),
                        });
                    }
                }
                else {
                    if (departmentRequirement === DepartmentRequirement.FORBIDDEN) {
                        errors.push({
                            journalKey: key,
                            sheet: isXlsx ? 'JournalLines' : 'CSV',
                            rowNumber: l.rowNumber,
                            field: 'departmentCode',
                            message: this.getDepartmentRequirementMessage({
                                requirement: departmentRequirement,
                                accountType: acc.type,
                            }),
                        });
                    }
                    const d = departmentByCode.get(l.departmentCode);
                    if (!d) {
                        errors.push({
                            journalKey: key,
                            sheet: isXlsx ? 'JournalLines' : 'CSV',
                            rowNumber: l.rowNumber,
                            field: 'departmentCode',
                            message: `Invalid departmentCode: ${l.departmentCode}`,
                        });
                    }
                    else {
                        const effective = d.effectiveFrom <= j.journalDate &&
                            (d.effectiveTo === null || d.effectiveTo >= j.journalDate);
                        if (!d.isActive) {
                            errors.push({
                                journalKey: key,
                                sheet: isXlsx ? 'JournalLines' : 'CSV',
                                rowNumber: l.rowNumber,
                                field: 'departmentCode',
                                message: `Department is inactive: ${l.departmentCode}`,
                            });
                        }
                        if (!effective) {
                            errors.push({
                                journalKey: key,
                                sheet: isXlsx ? 'JournalLines' : 'CSV',
                                rowNumber: l.rowNumber,
                                field: 'departmentCode',
                                message: `Department is not effective for journalDate: ${l.departmentCode}`,
                            });
                        }
                    }
                }
                if (l.fundCode && !l.projectCode) {
                    errors.push({
                        journalKey: key,
                        sheet: isXlsx ? 'JournalLines' : 'CSV',
                        rowNumber: l.rowNumber,
                        field: 'fundCode',
                        message: 'fundCode requires projectCode',
                    });
                }
                let projectId = null;
                if (l.projectCode) {
                    const p = projectByCode.get(l.projectCode);
                    if (!p) {
                        errors.push({
                            journalKey: key,
                            sheet: isXlsx ? 'JournalLines' : 'CSV',
                            rowNumber: l.rowNumber,
                            field: 'projectCode',
                            message: `Invalid projectCode: ${l.projectCode}`,
                        });
                    }
                    else {
                        const effective = p.effectiveFrom <= j.journalDate &&
                            (p.effectiveTo === null || p.effectiveTo >= j.journalDate);
                        if (!p.isActive) {
                            errors.push({
                                journalKey: key,
                                sheet: isXlsx ? 'JournalLines' : 'CSV',
                                rowNumber: l.rowNumber,
                                field: 'projectCode',
                                message: `Project is inactive: ${l.projectCode}`,
                            });
                        }
                        if (!effective) {
                            errors.push({
                                journalKey: key,
                                sheet: isXlsx ? 'JournalLines' : 'CSV',
                                rowNumber: l.rowNumber,
                                field: 'projectCode',
                                message: `Project is not effective for journalDate: ${l.projectCode}`,
                            });
                        }
                        projectId = p.id;
                    }
                }
                if (l.fundCode) {
                    const f = fundByCode.get(l.fundCode);
                    if (!f) {
                        errors.push({
                            journalKey: key,
                            sheet: isXlsx ? 'JournalLines' : 'CSV',
                            rowNumber: l.rowNumber,
                            field: 'fundCode',
                            message: `Invalid fundCode: ${l.fundCode}`,
                        });
                    }
                    else {
                        const effective = f.effectiveFrom <= j.journalDate &&
                            (f.effectiveTo === null || f.effectiveTo >= j.journalDate);
                        if (!f.isActive) {
                            errors.push({
                                journalKey: key,
                                sheet: isXlsx ? 'JournalLines' : 'CSV',
                                rowNumber: l.rowNumber,
                                field: 'fundCode',
                                message: `Fund is inactive: ${l.fundCode}`,
                            });
                        }
                        if (!effective) {
                            errors.push({
                                journalKey: key,
                                sheet: isXlsx ? 'JournalLines' : 'CSV',
                                rowNumber: l.rowNumber,
                                field: 'fundCode',
                                message: `Fund is not effective for journalDate: ${l.fundCode}`,
                            });
                        }
                        if (projectId && f.projectId !== projectId) {
                            errors.push({
                                journalKey: key,
                                sheet: isXlsx ? 'JournalLines' : 'CSV',
                                rowNumber: l.rowNumber,
                                field: 'fundCode',
                                message: `fundCode does not belong to projectCode (fundCode=${l.fundCode}, projectCode=${l.projectCode})`,
                            });
                        }
                    }
                }
            }
        }
        if (errors.length > 0) {
            const batchId = (0, crypto_1.randomUUID)();
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'JOURNAL_UPLOAD_FAILED',
                    entityType: 'JOURNAL_ENTRY',
                    entityId: batchId,
                    action: 'FINANCE_GL_CREATE',
                    outcome: 'FAILED',
                    reason: `Upload rejected (${fileName}). Errors: ${errors.length}`,
                    userId: user.id,
                    permissionUsed: 'FINANCE_GL_CREATE',
                },
            })
                .catch(() => undefined);
            throw new common_1.BadRequestException({
                error: 'Upload rejected',
                fileName,
                errorCount: errors.length,
                errors,
            });
        }
        const created = await this.prisma.$transaction(async (tx) => {
            const out = [];
            for (const key of keys) {
                const j = journalsByKey.get(key);
                const lines = (linesByKey.get(key) ?? [])
                    .slice()
                    .sort((a, b) => (a.lineNumber ?? 0) - (b.lineNumber ?? 0));
                const createdJournal = await tx.journalEntry.create({
                    data: {
                        tenantId: tenant.id,
                        journalDate: j.journalDate,
                        journalType: 'STANDARD',
                        reference: j.reference,
                        description: j.description,
                        createdById: user.id,
                        lines: {
                            create: lines
                                .slice()
                                .sort((a, b) => (a.lineNumber ?? 0) - (b.lineNumber ?? 0))
                                .map((l) => ({
                                accountId: accountByCode.get(l.accountCode).id,
                                lineNumber: l.lineNumber,
                                description: l.lineDescription,
                                legalEntityId: legalEntityByCode.get(l.legalEntityCode).id,
                                departmentId: l.departmentCode
                                    ? departmentByCode.get(l.departmentCode).id
                                    : null,
                                projectId: l.projectCode
                                    ? (projectByCode.get(l.projectCode)?.id ?? null)
                                    : null,
                                fundId: l.fundCode
                                    ? (fundByCode.get(l.fundCode)?.id ?? null)
                                    : null,
                                debit: l.debit,
                                credit: l.credit,
                            })),
                        },
                    },
                    select: { id: true },
                });
                out.push({ journalKey: key, journalId: createdJournal.id });
            }
            return out;
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'JOURNAL_UPLOAD',
                entityType: 'JOURNAL_ENTRY',
                entityId: created[0]?.journalId ?? (0, crypto_1.randomUUID)(),
                action: 'FINANCE_GL_CREATE',
                outcome: 'SUCCESS',
                reason: `Uploaded journals (${fileName}). Journals created: ${created.length}`,
                userId: user.id,
                permissionUsed: 'FINANCE_GL_CREATE',
            },
        })
            .catch(() => undefined);
        return {
            fileName,
            journalsCreated: created.length,
            items: created,
        };
    }
    async getJournalUploadCsvTemplate(req) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const headers = [
            'journalKey',
            'journalDate',
            'journalType',
            'reference',
            'description',
            'lineNumber',
            'accountCode',
            'legalEntityCode',
            'departmentCode',
            'projectCode',
            'fundCode',
            'debit',
            'credit',
            'lineDescription',
        ];
        const sample = [
            [
                'J1',
                new Date().toISOString().slice(0, 10),
                'STANDARD',
                'Bulk upload test',
                'Example journal upload',
                '1',
                '1000',
                'LE-001',
                'D-001',
                'P-001',
                'F-001',
                '100.00',
                '0.00',
                'Debit line',
            ],
            [
                'J1',
                new Date().toISOString().slice(0, 10),
                'STANDARD',
                'Bulk upload test',
                'Example journal upload',
                '2',
                '2000',
                'LE-001',
                'D-001',
                'P-001',
                'F-001',
                '0.00',
                '100.00',
                'Credit line',
            ],
        ];
        const escape = (v) => {
            const s = String(v ?? '');
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replaceAll('"', '""')}"`;
            }
            return s;
        };
        const body = [headers.join(','), ...sample.map((r) => r.map(escape).join(','))].join('\n') + '\n';
        return { fileName: 'journal_upload_template.csv', body };
    }
    async getJournalUploadXlsxTemplate(req) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const wb = new ExcelJS.Workbook();
        const wsJ = wb.addWorksheet('Journals');
        wsJ.addRow([
            'journalKey',
            'journalDate',
            'journalType',
            'reference',
            'description',
        ]);
        wsJ.addRow([
            'J1',
            new Date().toISOString().slice(0, 10),
            'STANDARD',
            'Bulk upload test',
            'Example journal upload',
        ]);
        wsJ.getRow(1).font = { bold: true };
        wsJ.columns.forEach((c) => (c.width = 18));
        const wsL = wb.addWorksheet('JournalLines');
        wsL.addRow([
            'journalKey',
            'lineNumber',
            'accountCode',
            'legalEntityCode',
            'departmentCode',
            'projectCode',
            'fundCode',
            'debit',
            'credit',
            'lineDescription',
        ]);
        wsL.addRow([
            'J1',
            1,
            '1000',
            'LE-001',
            'D-001',
            'P-001',
            'F-001',
            100.0,
            0.0,
            'Debit line',
        ]);
        wsL.addRow([
            'J1',
            2,
            '2000',
            'LE-001',
            'D-001',
            'P-001',
            'F-001',
            0.0,
            100.0,
            'Credit line',
        ]);
        wsL.getRow(1).font = { bold: true };
        wsL.columns.forEach((c) => (c.width = 18));
        const buf = await wb.xlsx.writeBuffer();
        return {
            fileName: 'journal_upload_template.xlsx',
            body: Buffer.from(buf),
        };
    }
    async listRecurringTemplates(req) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        return this.prisma.recurringJournalTemplate.findMany({
            where: { tenantId: tenant.id },
            orderBy: { name: 'asc' },
            include: {
                lines: { orderBy: { lineOrder: 'asc' } },
            },
        });
    }
    async updateRecurringTemplate(req, id, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const existing = await this.prisma.recurringJournalTemplate.findFirst({
            where: { id, tenantId: tenant.id },
            include: { lines: true },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Recurring template not found');
        }
        if (dto.journalType && dto.journalType !== 'STANDARD') {
            throw new common_1.BadRequestException('Recurring templates support journalType STANDARD only');
        }
        const linesToValidate = dto.lines ??
            existing.lines.map((l) => ({
                accountId: l.accountId,
                descriptionTemplate: l.descriptionTemplate ?? undefined,
                debitAmount: Number(l.debitAmount),
                creditAmount: Number(l.creditAmount),
                lineOrder: l.lineOrder,
            }));
        const xorErrors = linesToValidate.filter((l) => (l.debitAmount > 0 ? 1 : 0) + (l.creditAmount > 0 ? 1 : 0) !== 1);
        if (xorErrors.length > 0) {
            throw new common_1.BadRequestException('Each recurring template line must have either a debitAmount or a creditAmount (not both)');
        }
        this.assertBalanced(linesToValidate.map((l) => ({
            debit: l.debitAmount,
            credit: l.creditAmount,
        })));
        const updated = await this.prisma.recurringJournalTemplate.update({
            where: { id: existing.id },
            data: {
                name: dto.name ?? existing.name,
                journalType: 'STANDARD',
                referenceTemplate: dto.referenceTemplate ?? existing.referenceTemplate,
                descriptionTemplate: dto.descriptionTemplate !== undefined
                    ? dto.descriptionTemplate
                    : existing.descriptionTemplate,
                frequency: dto.frequency ?? existing.frequency,
                startDate: dto.startDate ? new Date(dto.startDate) : existing.startDate,
                endDate: dto.endDate !== undefined
                    ? dto.endDate
                        ? new Date(dto.endDate)
                        : null
                    : existing.endDate,
                nextRunDate: dto.nextRunDate
                    ? new Date(dto.nextRunDate)
                    : existing.nextRunDate,
                isActive: dto.isActive ?? existing.isActive,
                lines: dto.lines
                    ? {
                        deleteMany: { templateId: existing.id },
                        create: dto.lines
                            .slice()
                            .sort((a, b) => a.lineOrder - b.lineOrder)
                            .map((l) => ({
                            accountId: l.accountId,
                            descriptionTemplate: l.descriptionTemplate,
                            debitAmount: new client_1.Prisma.Decimal(l.debitAmount),
                            creditAmount: new client_1.Prisma.Decimal(l.creditAmount),
                            lineOrder: l.lineOrder,
                        })),
                    }
                    : undefined,
            },
            include: { lines: { orderBy: { lineOrder: 'asc' } } },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'RECURRING_TEMPLATE_UPDATE',
                entityType: 'RECURRING_JOURNAL_TEMPLATE',
                entityId: existing.id,
                action: 'FINANCE_GL_RECURRING_MANAGE',
                outcome: 'SUCCESS',
                userId: user.id,
                permissionUsed: 'FINANCE_GL_RECURRING_MANAGE',
            },
        })
            .catch(() => undefined);
        return updated;
    }
    async generateJournalFromRecurringTemplate(req, id, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const template = await this.prisma.recurringJournalTemplate.findFirst({
            where: { id, tenantId: tenant.id },
            include: { lines: { orderBy: { lineOrder: 'asc' } } },
        });
        if (!template) {
            throw new common_1.NotFoundException('Recurring template not found');
        }
        if (!template.isActive) {
            throw new common_1.BadRequestException('Recurring template is inactive');
        }
        const runDate = dto.runDate
            ? new Date(dto.runDate)
            : new Date(template.nextRunDate);
        if (Number.isNaN(runDate.getTime())) {
            throw new common_1.BadRequestException('Invalid runDate');
        }
        if (runDate < template.startDate) {
            throw new common_1.BadRequestException('runDate is before template startDate');
        }
        if (template.endDate && runDate > template.endDate) {
            throw new common_1.BadRequestException('runDate is after template endDate');
        }
        const cutover = await this.getCutoverDateIfLocked({ tenantId: tenant.id });
        if (cutover && runDate < cutover) {
            throw new common_1.ForbiddenException({
                error: 'Generation blocked by cutover lock',
                reason: `Generating dated before cutover is not allowed (cutover: ${cutover.toISOString().slice(0, 10)})`,
            });
        }
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                startDate: { lte: runDate },
                endDate: { gte: runDate },
            },
            select: { id: true, status: true, name: true },
        });
        if (!period || period.status !== 'OPEN') {
            throw new common_1.ForbiddenException({
                error: 'Generation blocked by accounting period control',
                reason: !period
                    ? 'No accounting period exists for the run date'
                    : `Accounting period is not OPEN: ${period.name}`,
            });
        }
        const reference = this.formatRecurringPlaceholders(template.referenceTemplate, runDate);
        const description = template.descriptionTemplate
            ? this.formatRecurringPlaceholders(template.descriptionTemplate, runDate)
            : undefined;
        const created = await this.prisma.$transaction(async (tx) => {
            const journal = await tx.journalEntry.create({
                data: {
                    tenantId: tenant.id,
                    journalDate: runDate,
                    journalType: 'STANDARD',
                    reference,
                    description,
                    createdById: user.id,
                    status: 'DRAFT',
                    lines: {
                        create: template.lines.map((l) => ({
                            accountId: l.accountId,
                            lineNumber: l.lineOrder,
                            description: l.descriptionTemplate
                                ? this.formatRecurringPlaceholders(l.descriptionTemplate, runDate)
                                : undefined,
                            debit: l.debitAmount,
                            credit: l.creditAmount,
                        })),
                    },
                },
                include: { lines: true },
            });
            await tx.recurringJournalGeneration.create({
                data: {
                    tenantId: tenant.id,
                    templateId: template.id,
                    generatedJournalId: journal.id,
                    runDate,
                    generatedById: user.id,
                },
            });
            const nextRunDate = this.computeNextRunDate({
                frequency: template.frequency,
                runDate,
            });
            const shouldDeactivate = Boolean(template.endDate && nextRunDate > template.endDate);
            await tx.recurringJournalTemplate.update({
                where: { id: template.id },
                data: {
                    nextRunDate,
                    isActive: shouldDeactivate ? false : template.isActive,
                },
                select: { id: true },
            });
            return journal;
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'RECURRING_JOURNAL_GENERATED',
                entityType: 'RECURRING_JOURNAL_TEMPLATE',
                entityId: template.id,
                action: 'FINANCE_GL_RECURRING_GENERATE',
                outcome: 'SUCCESS',
                reason: `Generated journal ${created.id}`,
                userId: user.id,
                permissionUsed: 'FINANCE_GL_RECURRING_GENERATE',
            },
        })
            .catch(() => undefined);
        return created;
    }
    async getRecurringTemplateHistory(req, id) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const template = await this.prisma.recurringJournalTemplate.findFirst({
            where: { id, tenantId: tenant.id },
            select: { id: true },
        });
        if (!template) {
            throw new common_1.NotFoundException('Recurring template not found');
        }
        return this.prisma.recurringJournalGeneration.findMany({
            where: { tenantId: tenant.id, templateId: template.id },
            orderBy: { runDate: 'desc' },
            select: {
                id: true,
                runDate: true,
                createdAt: true,
                generatedBy: { select: { id: true, name: true, email: true } },
                generatedJournal: {
                    select: {
                        id: true,
                        journalNumber: true,
                        journalDate: true,
                        status: true,
                        reference: true,
                        description: true,
                    },
                },
            },
        });
    }
    async listJournalReviewQueue(req) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const items = await this.prisma.journalEntry.findMany({
            where: {
                tenantId: tenant.id,
                status: 'SUBMITTED',
                createdById: { not: user.id },
            },
            orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                journalNumber: true,
                journalDate: true,
                reference: true,
                description: true,
                journalType: true,
                riskScore: true,
                createdAt: true,
                submittedAt: true,
                createdBy: { select: { id: true, name: true, email: true } },
                period: {
                    select: { id: true, name: true, startDate: true, endDate: true },
                },
                lines: { select: { debit: true, credit: true } },
            },
        });
        const round2 = (n) => Math.round(n * 100) / 100;
        return items.map((j) => {
            const toNum = (v) => {
                if (v === null || v === undefined)
                    return 0;
                if (typeof v === 'number')
                    return Number.isFinite(v) ? v : 0;
                const n = Number(v);
                return Number.isFinite(n) ? n : 0;
            };
            const totalDebit = round2(j.lines.reduce((sum, l) => sum + toNum(l.debit), 0));
            const totalCredit = round2(j.lines.reduce((sum, l) => sum + toNum(l.credit), 0));
            const periodLabel = j.period?.name
                ? j.period.name
                : j.journalDate
                    ? new Date(j.journalDate).toLocaleDateString(undefined, {
                        month: 'short',
                        year: 'numeric',
                    })
                    : null;
            return {
                id: j.id,
                journalNumber: j.journalNumber,
                journalDate: j.journalDate,
                reference: j.reference,
                description: j.description,
                journalType: j.journalType,
                riskScore: j.riskScore ?? 0,
                totalDebit,
                totalCredit,
                createdAt: j.createdAt,
                createdBy: j.createdBy,
                period: j.period
                    ? {
                        id: j.period.id,
                        name: j.period.name,
                        startDate: j.period.startDate,
                        endDate: j.period.endDate,
                        label: periodLabel,
                    }
                    : {
                        id: null,
                        name: null,
                        startDate: null,
                        endDate: null,
                        label: periodLabel,
                    },
            };
        });
    }
    async listJournalPostQueue(req) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const items = await this.prisma.journalEntry.findMany({
            where: {
                tenantId: tenant.id,
                status: 'REVIEWED',
            },
            orderBy: [{ reviewedAt: 'asc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                journalNumber: true,
                journalDate: true,
                reference: true,
                description: true,
                journalType: true,
                riskScore: true,
                createdAt: true,
                reviewedAt: true,
                createdBy: { select: { id: true, name: true, email: true } },
                reviewedBy: { select: { id: true, name: true, email: true } },
                period: {
                    select: { id: true, name: true, startDate: true, endDate: true },
                },
                lines: { select: { debit: true, credit: true } },
            },
        });
        const round2 = (n) => Math.round(n * 100) / 100;
        return items.map((j) => {
            const toNum = (v) => {
                if (v === null || v === undefined)
                    return 0;
                if (typeof v === 'number')
                    return Number.isFinite(v) ? v : 0;
                const n = Number(v);
                return Number.isFinite(n) ? n : 0;
            };
            const totalDebit = round2(j.lines.reduce((sum, l) => sum + toNum(l.debit), 0));
            const totalCredit = round2(j.lines.reduce((sum, l) => sum + toNum(l.credit), 0));
            const periodLabel = j.period?.name
                ? j.period.name
                : j.journalDate
                    ? new Date(j.journalDate).toLocaleDateString(undefined, {
                        month: 'short',
                        year: 'numeric',
                    })
                    : null;
            return {
                id: j.id,
                journalNumber: j.journalNumber,
                journalDate: j.journalDate,
                reference: j.reference,
                description: j.description,
                journalType: j.journalType,
                riskScore: j.riskScore ?? 0,
                totalDebit,
                totalCredit,
                createdAt: j.createdAt,
                reviewedAt: j.reviewedAt,
                createdBy: j.createdBy,
                reviewedBy: j.reviewedBy,
                period: j.period
                    ? {
                        id: j.period.id,
                        name: j.period.name,
                        startDate: j.period.startDate,
                        endDate: j.period.endDate,
                        label: periodLabel,
                    }
                    : {
                        id: null,
                        name: null,
                        startDate: null,
                        endDate: null,
                        label: periodLabel,
                    },
            };
        });
    }
    OPENING_PERIOD_NAME = 'Opening Balances';
    OPENING_REF_PREFIX = 'OPENING_BALANCES:';
    OPENING_DESC_PREFIX = 'Opening balances as at ';
    DEFAULT_PERIOD_CLOSE_CHECKLIST_ITEMS = [
        { code: 'AP_REVIEWED', name: 'AP reviewed' },
        { code: 'AR_REVIEWED', name: 'AR reviewed' },
        { code: 'BANK_RECONCILED', name: 'Bank reconciled' },
        { code: 'FA_DEPRECIATION_RUN', name: 'FA depreciation run' },
        { code: 'VAT_REVIEWED', name: 'VAT reviewed' },
        { code: 'TRIAL_BALANCE_REVIEWED', name: 'Trial balance reviewed' },
    ];
    JOURNAL_NUMBER_SEQUENCE_NAME = 'JOURNAL_ENTRY';
    async ensureMinimalBalanceSheetCoaForTenant(tenantId) {
        const existingCount = await this.prisma.account.count({
            where: { tenantId },
        });
        if (existingCount > 0)
            return;
        await this.prisma.account.createMany({
            data: [
                {
                    tenantId,
                    code: '1000',
                    name: 'Cash / Bank',
                    type: 'ASSET',
                    isActive: true,
                },
                {
                    tenantId,
                    code: '1100',
                    name: 'Accounts Receivable Control',
                    type: 'ASSET',
                    isActive: true,
                },
                {
                    tenantId,
                    code: '2000',
                    name: 'Accounts Payable Control',
                    type: 'LIABILITY',
                    isActive: true,
                },
                {
                    tenantId,
                    code: '3000',
                    name: 'Retained Earnings',
                    type: 'EQUITY',
                    isActive: true,
                },
            ],
            skipDuplicates: true,
        });
    }
    async createAccount(req, dto) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const t = await this.prisma.tenant.findUnique({
            where: { id: tenant.id },
            select: { coaFrozen: true },
        });
        if (t?.coaFrozen) {
            throw new common_1.ForbiddenException('Chart of Accounts is frozen');
        }
        return this.prisma.account.create({
            data: {
                tenantId: tenant.id,
                code: dto.code,
                name: dto.name,
                type: dto.type,
                isActive: dto.isActive ?? true,
            },
        });
    }
    async listAccounts(req, options) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        await this.ensureMinimalBalanceSheetCoaForTenant(tenant.id);
        const balanceSheetOnly = Boolean(options?.balanceSheetOnly);
        return this.prisma.account
            .findMany({
            where: {
                tenantId: tenant.id,
                isActive: true,
                ...(balanceSheetOnly
                    ? { type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } }
                    : {}),
            },
            orderBy: { code: 'asc' },
            select: {
                id: true,
                code: true,
                name: true,
                type: true,
                isActive: true,
                isControlAccount: true,
                requiresDepartment: true,
                requiresProject: true,
                requiresFund: true,
            },
        })
            .then((rows) => rows.map((a) => ({
            id: a.id,
            code: a.code,
            name: a.name,
            type: a.type,
            isActive: a.isActive,
            requiresDepartment: a.requiresDepartment,
            requiresProject: a.requiresProject,
            requiresFund: a.requiresFund,
            departmentRequirement: this.getDepartmentRequirement(a),
        })));
    }
    async createAccountingPeriod(req, dto) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);
        if (startDate > endDate) {
            throw new common_1.BadRequestException('startDate must be less than or equal to endDate');
        }
        const overlap = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                startDate: { lte: endDate },
                endDate: { gte: startDate },
            },
            select: { id: true, name: true, startDate: true, endDate: true },
        });
        if (overlap) {
            throw new common_1.BadRequestException({
                error: 'Accounting periods cannot overlap',
                overlappingPeriod: {
                    id: overlap.id,
                    name: overlap.name,
                    startDate: overlap.startDate,
                    endDate: overlap.endDate,
                },
            });
        }
        return this.prisma.$transaction(async (tx) => {
            const period = await tx.accountingPeriod.create({
                data: {
                    tenantId: tenant.id,
                    name: dto.name,
                    startDate,
                    endDate,
                },
            });
            const checklist = await tx.periodCloseChecklist.create({
                data: {
                    tenantId: tenant.id,
                    periodId: period.id,
                },
            });
            await tx.periodCloseChecklistItem.createMany({
                data: this.DEFAULT_PERIOD_CLOSE_CHECKLIST_ITEMS.map((i) => ({
                    tenantId: tenant.id,
                    checklistId: checklist.id,
                    code: i.code,
                    name: i.name,
                    status: 'PENDING',
                })),
                skipDuplicates: true,
            });
            await tx.accountingPeriodChecklistItem.createMany({
                data: [
                    {
                        tenantId: tenant.id,
                        periodId: period.id,
                        code: 'BANK_RECONCILIATION',
                        label: 'Bank reconciliations completed and reviewed',
                    },
                    {
                        tenantId: tenant.id,
                        periodId: period.id,
                        code: 'AP_RECONCILIATION',
                        label: 'AP subledger reconciled to GL',
                    },
                    {
                        tenantId: tenant.id,
                        periodId: period.id,
                        code: 'AR_RECONCILIATION',
                        label: 'AR subledger reconciled to GL',
                    },
                    {
                        tenantId: tenant.id,
                        periodId: period.id,
                        code: 'GL_REVIEW',
                        label: 'General ledger review completed (journals, accruals, reclasses)',
                    },
                    {
                        tenantId: tenant.id,
                        periodId: period.id,
                        code: 'REPORTING_PACKAGE',
                        label: 'Financial statements generated and reviewed',
                    },
                ],
                skipDuplicates: true,
            });
            return period;
        });
    }
    async getAccountingPeriodChecklist(req, periodId) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const period = await this.prisma.accountingPeriod.findFirst({
            where: { id: periodId, tenantId: tenant.id },
            select: {
                id: true,
                name: true,
                status: true,
                startDate: true,
                endDate: true,
                closedAt: true,
                closedBy: { select: { id: true, email: true } },
            },
        });
        if (!period)
            throw new common_1.NotFoundException('Accounting period not found');
        const items = await this.prisma.accountingPeriodChecklistItem.findMany({
            where: { tenantId: tenant.id, periodId: period.id },
            orderBy: [{ completed: 'asc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                code: true,
                label: true,
                completed: true,
                completedAt: true,
                completedBy: { select: { id: true, email: true } },
                createdAt: true,
            },
        });
        return { period, items };
    }
    async completeAccountingPeriodChecklistItem(req, params) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const period = await this.prisma.accountingPeriod.findFirst({
            where: { id: params.periodId, tenantId: tenant.id },
            select: { id: true, status: true, name: true },
        });
        if (!period)
            throw new common_1.NotFoundException('Accounting period not found');
        if (period.status !== 'OPEN') {
            await this.prisma.accountingPeriodCloseLog.create({
                data: {
                    tenantId: tenant.id,
                    periodId: period.id,
                    userId: user.id,
                    action: 'CHECKLIST_ITEM_COMPLETE',
                    outcome: 'DENIED',
                    message: `Accounting period is not OPEN: ${period.name}`,
                    itemId: params.itemId,
                },
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'PERIOD_CHECKLIST_COMPLETE',
                    entityType: 'ACCOUNTING_PERIOD',
                    entityId: period.id,
                    action: 'FINANCE_PERIOD_CHECKLIST_COMPLETE',
                    outcome: 'BLOCKED',
                    reason: `Accounting period is not OPEN: ${period.name}`,
                    userId: user.id,
                    permissionUsed: 'FINANCE_PERIOD_CHECKLIST_COMPLETE',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Checklist completion blocked by accounting period control',
                reason: `Accounting period is not OPEN: ${period.name}`,
            });
        }
        const item = await this.prisma.accountingPeriodChecklistItem.findFirst({
            where: {
                id: params.itemId,
                tenantId: tenant.id,
                periodId: period.id,
            },
            select: { id: true, completed: true },
        });
        if (!item) {
            await this.prisma.accountingPeriodCloseLog.create({
                data: {
                    tenantId: tenant.id,
                    periodId: period.id,
                    userId: user.id,
                    action: 'CHECKLIST_ITEM_COMPLETE',
                    outcome: 'NOT_FOUND',
                    message: 'Checklist item not found',
                    itemId: params.itemId,
                },
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'PERIOD_CHECKLIST_COMPLETE',
                    entityType: 'ACCOUNTING_PERIOD_CHECKLIST_ITEM',
                    entityId: params.itemId,
                    action: 'FINANCE_PERIOD_CHECKLIST_COMPLETE',
                    outcome: 'FAILED',
                    reason: 'Checklist item not found',
                    userId: user.id,
                    permissionUsed: 'FINANCE_PERIOD_CHECKLIST_COMPLETE',
                },
            })
                .catch(() => undefined);
            throw new common_1.NotFoundException('Checklist item not found');
        }
        if (item.completed) {
            await this.prisma.accountingPeriodCloseLog.create({
                data: {
                    tenantId: tenant.id,
                    periodId: period.id,
                    userId: user.id,
                    action: 'CHECKLIST_ITEM_COMPLETE',
                    outcome: 'NOOP',
                    message: 'Checklist item is already completed',
                    itemId: item.id,
                },
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'PERIOD_CHECKLIST_COMPLETE',
                    entityType: 'ACCOUNTING_PERIOD_CHECKLIST_ITEM',
                    entityId: item.id,
                    action: 'FINANCE_PERIOD_CHECKLIST_COMPLETE',
                    outcome: 'FAILED',
                    reason: 'Checklist item is already completed',
                    userId: user.id,
                    permissionUsed: 'FINANCE_PERIOD_CHECKLIST_COMPLETE',
                },
            })
                .catch(() => undefined);
            throw new common_1.BadRequestException('Checklist item is already completed');
        }
        const updated = await this.prisma.accountingPeriodChecklistItem.update({
            where: { id: item.id },
            data: {
                completed: true,
                completedById: user.id,
                completedAt: new Date(),
            },
            select: {
                id: true,
                code: true,
                label: true,
                completed: true,
                completedAt: true,
                completedBy: { select: { id: true, email: true } },
                createdAt: true,
            },
        });
        await this.prisma.accountingPeriodCloseLog.create({
            data: {
                tenantId: tenant.id,
                periodId: period.id,
                userId: user.id,
                action: 'CHECKLIST_ITEM_COMPLETE',
                outcome: 'SUCCESS',
                itemId: updated.id,
            },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'PERIOD_CHECKLIST_COMPLETE',
                entityType: 'ACCOUNTING_PERIOD_CHECKLIST_ITEM',
                entityId: updated.id,
                action: 'FINANCE_PERIOD_CHECKLIST_COMPLETE',
                outcome: 'SUCCESS',
                userId: user.id,
                permissionUsed: 'FINANCE_PERIOD_CHECKLIST_COMPLETE',
            },
        })
            .catch(() => undefined);
        return updated;
    }
    async listAccountingPeriods(req) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        return this.prisma.accountingPeriod.findMany({
            where: { tenantId: tenant.id },
            orderBy: { startDate: 'asc' },
        });
    }
    async listProjects(req, params) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const effectiveOn = params?.effectiveOn
            ? new Date(params.effectiveOn)
            : null;
        if (params?.effectiveOn && Number.isNaN(effectiveOn?.getTime())) {
            throw new common_1.BadRequestException('effectiveOn must be a valid date');
        }
        return this.prisma.project.findMany({
            where: {
                tenantId: tenant.id,
                ...(effectiveOn
                    ? {
                        isActive: true,
                        effectiveFrom: { lte: effectiveOn },
                        OR: [
                            { effectiveTo: null },
                            { effectiveTo: { gte: effectiveOn } },
                        ],
                    }
                    : {}),
            },
            select: { id: true, code: true, name: true, isRestricted: true },
            orderBy: [{ code: 'asc' }, { name: 'asc' }],
        });
    }
    async listFunds(req, params) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const effectiveOn = params?.effectiveOn
            ? new Date(params.effectiveOn)
            : null;
        if (params?.effectiveOn && Number.isNaN(effectiveOn?.getTime())) {
            throw new common_1.BadRequestException('effectiveOn must be a valid date');
        }
        const projectId = params?.projectId
            ? String(params.projectId).trim()
            : undefined;
        if (params?.projectId && !projectId) {
            throw new common_1.BadRequestException('projectId must not be empty');
        }
        return this.prisma.fund.findMany({
            where: {
                tenantId: tenant.id,
                ...(projectId ? { projectId } : {}),
                ...(effectiveOn
                    ? {
                        isActive: true,
                        effectiveFrom: { lte: effectiveOn },
                        OR: [
                            { effectiveTo: null },
                            { effectiveTo: { gte: effectiveOn } },
                        ],
                    }
                    : {}),
            },
            select: { id: true, code: true, name: true, projectId: true },
            orderBy: [{ code: 'asc' }, { name: 'asc' }],
        });
    }
    async closeAccountingPeriod(req, id) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const period = await this.prisma.accountingPeriod.findFirst({
            where: { id, tenantId: tenant.id },
            select: { id: true, status: true },
        });
        if (!period) {
            throw new common_1.NotFoundException('Accounting period not found');
        }
        if (period.status === 'CLOSED') {
            throw new common_1.BadRequestException('Accounting period is already closed');
        }
        const journalCounts = await this.prisma.journalEntry.groupBy({
            by: ['status'],
            where: { tenantId: tenant.id, periodId: period.id },
            _count: { _all: true },
        });
        const countByStatus = new Map(journalCounts.map((g) => [g.status, g._count._all]));
        const draftCount = countByStatus.get('DRAFT') ?? 0;
        const parkedCount = countByStatus.get('PARKED') ?? 0;
        if (draftCount > 0 || parkedCount > 0) {
            const reason = `Unposted journals exist in the period (draft=${draftCount}, parked=${parkedCount})`;
            await this.prisma.accountingPeriodCloseLog.create({
                data: {
                    tenantId: tenant.id,
                    periodId: period.id,
                    userId: user.id,
                    action: 'PERIOD_CLOSE',
                    outcome: 'DENIED',
                    message: reason,
                },
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'PERIOD_CLOSE',
                    entityType: 'ACCOUNTING_PERIOD',
                    entityId: period.id,
                    action: 'FINANCE_PERIOD_CLOSE_APPROVE',
                    outcome: 'BLOCKED',
                    reason,
                    userId: user.id,
                    permissionUsed: 'FINANCE_PERIOD_CLOSE_APPROVE',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Period close blocked by journal control',
                reason,
                draftCount,
                parkedCount,
            });
        }
        const items = await this.prisma.accountingPeriodChecklistItem.findMany({
            where: { tenantId: tenant.id, periodId: period.id },
            select: { id: true, completed: true, completedById: true },
        });
        const incomplete = items.filter((i) => !i.completed);
        if (incomplete.length > 0) {
            await this.prisma.accountingPeriodCloseLog.create({
                data: {
                    tenantId: tenant.id,
                    periodId: period.id,
                    userId: user.id,
                    action: 'PERIOD_CLOSE',
                    outcome: 'DENIED',
                    message: `Checklist incomplete: ${incomplete.length} item(s) not completed`,
                },
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'PERIOD_CLOSE',
                    entityType: 'ACCOUNTING_PERIOD',
                    entityId: period.id,
                    action: 'FINANCE_PERIOD_CLOSE_APPROVE',
                    outcome: 'BLOCKED',
                    reason: `Checklist incomplete: ${incomplete.length} item(s) not completed`,
                    userId: user.id,
                    permissionUsed: 'FINANCE_PERIOD_CLOSE_APPROVE',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Period close blocked by checklist control',
                reason: 'All checklist items must be completed before closing an accounting period',
                incompleteCount: incomplete.length,
            });
        }
        const completedByThisUser = items.some((i) => i.completedById === user.id);
        if (completedByThisUser) {
            await this.prisma.accountingPeriodCloseLog.create({
                data: {
                    tenantId: tenant.id,
                    periodId: period.id,
                    userId: user.id,
                    action: 'PERIOD_CLOSE',
                    outcome: 'DENIED_SOD',
                    message: 'User who completed checklist items cannot close the accounting period',
                },
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'PERIOD_CLOSE',
                    entityType: 'ACCOUNTING_PERIOD',
                    entityId: period.id,
                    action: 'FINANCE_PERIOD_CLOSE_APPROVE',
                    outcome: 'BLOCKED',
                    reason: 'User who completed checklist items cannot close the accounting period',
                    userId: user.id,
                    permissionUsed: 'FINANCE_PERIOD_CLOSE_APPROVE',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Action blocked by Segregation of Duties (SoD)',
                reason: 'User who completed checklist items cannot close the accounting period',
            });
        }
        const closed = await this.prisma.accountingPeriod.update({
            where: { id },
            data: {
                status: 'CLOSED',
                closedById: user.id,
                closedAt: new Date(),
            },
        });
        await this.prisma.accountingPeriodCloseLog.create({
            data: {
                tenantId: tenant.id,
                periodId: period.id,
                userId: user.id,
                action: 'PERIOD_CLOSE',
                outcome: 'SUCCESS',
            },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'PERIOD_CLOSE',
                entityType: 'ACCOUNTING_PERIOD',
                entityId: period.id,
                action: 'FINANCE_PERIOD_CLOSE_APPROVE',
                outcome: 'SUCCESS',
                userId: user.id,
                permissionUsed: 'FINANCE_PERIOD_CLOSE_APPROVE',
            },
        })
            .catch(() => undefined);
        this.cache.clearTenant(tenant.id);
        return closed;
    }
    async getAccountingPeriodSummary(req, id) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const period = await this.prisma.accountingPeriod.findFirst({
            where: { id, tenantId: tenant.id },
            select: {
                id: true,
                name: true,
                status: true,
                startDate: true,
                endDate: true,
            },
        });
        if (!period) {
            throw new common_1.NotFoundException('Accounting period not found');
        }
        const grouped = await this.prisma.journalEntry.groupBy({
            by: ['status'],
            where: { tenantId: tenant.id, periodId: period.id },
            _count: { _all: true },
        });
        const countByStatus = {
            DRAFT: 0,
            PARKED: 0,
            POSTED: 0,
        };
        for (const g of grouped) {
            if (g.status === 'DRAFT' ||
                g.status === 'PARKED' ||
                g.status === 'POSTED') {
                countByStatus[g.status] = g._count._all;
            }
        }
        const postedTotals = await this.prisma.journalLine.aggregate({
            where: {
                journalEntry: {
                    tenantId: tenant.id,
                    periodId: period.id,
                    status: 'POSTED',
                },
            },
            _sum: { debit: true, credit: true },
        });
        return {
            period,
            journals: {
                countsByStatus: countByStatus,
                totals: {
                    totalDebit: Number(postedTotals._sum.debit ?? 0),
                    totalCredit: Number(postedTotals._sum.credit ?? 0),
                },
            },
        };
    }
    async reopenAccountingPeriod(req, id, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const period = await this.prisma.accountingPeriod.findFirst({
            where: { id, tenantId: tenant.id },
            select: { id: true, status: true, closedAt: true },
        });
        if (!period) {
            throw new common_1.NotFoundException('Accounting period not found');
        }
        if (period.status !== 'CLOSED') {
            throw new common_1.BadRequestException('Accounting period is not closed');
        }
        const latestClosed = await this.prisma.accountingPeriod.findFirst({
            where: { tenantId: tenant.id, status: 'CLOSED' },
            orderBy: [{ endDate: 'desc' }, { closedAt: 'desc' }],
            select: { id: true },
        });
        if (!latestClosed || latestClosed.id !== period.id) {
            const reason = 'Only the latest closed accounting period can be reopened';
            await this.prisma.accountingPeriodCloseLog.create({
                data: {
                    tenantId: tenant.id,
                    periodId: period.id,
                    userId: user.id,
                    action: 'PERIOD_REOPEN',
                    outcome: 'DENIED',
                    message: reason,
                },
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'PERIOD_REOPEN',
                    entityType: 'ACCOUNTING_PERIOD',
                    entityId: period.id,
                    action: 'FINANCE_PERIOD_REOPEN',
                    outcome: 'BLOCKED',
                    reason,
                    userId: user.id,
                    permissionUsed: 'FINANCE_PERIOD_REOPEN',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Reopen blocked by period control',
                reason,
            });
        }
        const reopenReason = String(dto?.reason ?? '').trim();
        if (!reopenReason) {
            throw new common_1.BadRequestException('reason is required');
        }
        const updated = await this.prisma.accountingPeriod.update({
            where: { id: period.id },
            data: {
                status: 'OPEN',
                closedAt: null,
                closedById: null,
            },
        });
        await this.prisma.accountingPeriodCloseLog.create({
            data: {
                tenantId: tenant.id,
                periodId: period.id,
                userId: user.id,
                action: 'PERIOD_REOPEN',
                outcome: 'SUCCESS',
                message: reopenReason,
            },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'PERIOD_REOPEN',
                entityType: 'ACCOUNTING_PERIOD',
                entityId: period.id,
                action: 'FINANCE_PERIOD_REOPEN',
                outcome: 'SUCCESS',
                reason: reopenReason,
                userId: user.id,
                permissionUsed: 'FINANCE_PERIOD_REOPEN',
            },
        })
            .catch(() => undefined);
        this.cache.clearTenant(tenant.id);
        return updated;
    }
    async trialBalance(req, dto) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        if (dto.entityId) {
            throw new common_1.BadRequestException('entityId filtering is not supported yet (journals are not entity-scoped)');
        }
        let from = new Date(dto.from);
        const to = new Date(dto.to);
        if (from > to) {
            throw new common_1.BadRequestException('from must be less than or equal to to');
        }
        const cutover = await this.getCutoverDateIfLocked({ tenantId: tenant.id });
        if (cutover && to < cutover) {
            return {
                from: dto.from,
                to: dto.to,
                totals: { totalDebit: 0, totalCredit: 0, net: 0 },
                rows: [],
            };
        }
        if (cutover && from < cutover) {
            from = cutover;
        }
        const grouped = await this.prisma.journalLine.groupBy({
            by: ['accountId'],
            where: {
                journalEntry: {
                    tenantId: tenant.id,
                    status: 'POSTED',
                    journalDate: {
                        gte: from,
                        lte: to,
                    },
                },
            },
            _sum: {
                debit: true,
                credit: true,
            },
        });
        const accountIds = grouped.map((g) => g.accountId);
        const accounts = await this.prisma.account.findMany({
            where: {
                tenantId: tenant.id,
                id: { in: accountIds },
            },
            select: {
                id: true,
                code: true,
                name: true,
                type: true,
                normalBalance: true,
            },
        });
        const accountMap = new Map(accounts.map((a) => [a.id, a]));
        const rows = grouped
            .map((g) => {
            const a = accountMap.get(g.accountId);
            const totalDebit = Number(g._sum.debit ?? 0);
            const totalCredit = Number(g._sum.credit ?? 0);
            return {
                accountId: g.accountId,
                accountCode: a?.code ?? 'UNKNOWN',
                accountName: a?.name ?? 'Unknown account',
                accountType: a?.type ?? 'UNKNOWN',
                normalBalance: a?.normalBalance ?? 'DEBIT',
                totalDebit,
                totalCredit,
                net: totalDebit - totalCredit,
            };
        })
            .sort((x, y) => x.accountCode.localeCompare(y.accountCode));
        const round2 = (n) => Math.round(n * 100) / 100;
        return {
            from: cutover && new Date(dto.from) < cutover
                ? cutover.toISOString().slice(0, 10)
                : dto.from,
            to: dto.to,
            totals: {
                totalDebit: round2(rows.reduce((sum, r) => sum + r.totalDebit, 0)),
                totalCredit: round2(rows.reduce((sum, r) => sum + r.totalCredit, 0)),
                net: round2(rows.reduce((sum, r) => sum + r.net, 0)),
            },
            rows,
        };
    }
    async ledger(req, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const limit = dto.limit ?? 50;
        const offset = dto.offset ?? 0;
        if (limit < 1 || limit > 100)
            throw new common_1.BadRequestException('limit must be between 1 and 100');
        if (offset < 0)
            throw new common_1.BadRequestException('offset must be >= 0');
        if (offset > 5000)
            throw new common_1.BadRequestException('offset too large');
        const hasPeriod = Boolean(dto.accountingPeriodId);
        const hasDates = Boolean(dto.fromDate || dto.toDate);
        if (hasPeriod && hasDates) {
            throw new common_1.BadRequestException('accountingPeriodId is mutually exclusive with fromDate/toDate');
        }
        let from;
        let to;
        let reportSource = 'LEDGER';
        const sourceReport = dto.sourceReport ?? 'LEDGER';
        if (dto.accountingPeriodId) {
            const p = await this.prisma.accountingPeriod.findFirst({
                where: { id: dto.accountingPeriodId, tenantId: tenant.id },
                select: { id: true, startDate: true, endDate: true },
            });
            if (!p)
                throw new common_1.NotFoundException('Accounting period not found');
            from = new Date(p.startDate.getTime());
            to = new Date(p.endDate.getTime());
            reportSource = 'LEDGER';
        }
        else {
            if (!dto.fromDate || !dto.toDate)
                throw new common_1.BadRequestException('fromDate and toDate are required');
            from = new Date(dto.fromDate);
            to = new Date(dto.toDate);
            if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
                throw new common_1.BadRequestException('Invalid date');
            if (from > to)
                throw new common_1.BadRequestException('fromDate must be <= toDate');
        }
        const cutover = await this.getCutoverDateIfLocked({ tenantId: tenant.id });
        if (cutover && to < cutover) {
            const account = await this.prisma.account.findFirst({
                where: { id: dto.accountId, tenantId: tenant.id },
                select: {
                    id: true,
                    code: true,
                    name: true,
                    type: true,
                    normalBalance: true,
                },
            });
            if (!account)
                throw new common_1.NotFoundException('Account not found');
            if (offset === 0) {
                await this.prisma.auditEvent
                    .create({
                    data: {
                        tenantId: tenant.id,
                        eventType: 'REPORT_VIEW',
                        entityType: 'ACCOUNT',
                        entityId: dto.accountId,
                        action: 'LEDGER_VIEW',
                        outcome: 'SUCCESS',
                        reason: JSON.stringify({
                            reportSource,
                            sourceReport,
                            account: {
                                id: account.id,
                                code: account.code,
                                name: account.name,
                            },
                            dateRange: {
                                fromDate: dto.fromDate ?? from.toISOString().slice(0, 10),
                                toDate: dto.toDate ?? to.toISOString().slice(0, 10),
                            },
                            cutover: cutover.toISOString().slice(0, 10),
                            pagination: { offset, limit },
                        }),
                        userId: user.id,
                        permissionUsed: 'FINANCE_GL_VIEW',
                    },
                })
                    .catch(() => undefined);
            }
            return {
                account,
                period: {
                    fromDate: dto.fromDate ?? from.toISOString().slice(0, 10),
                    toDate: dto.toDate ?? to.toISOString().slice(0, 10),
                },
                openingBalance: 0,
                rows: [],
                total: 0,
                limit,
                offset,
                hasMore: false,
            };
        }
        if (cutover && from < cutover) {
            from = cutover;
        }
        const account = await this.prisma.account.findFirst({
            where: { id: dto.accountId, tenantId: tenant.id },
            select: {
                id: true,
                code: true,
                name: true,
                type: true,
                normalBalance: true,
            },
        });
        if (!account)
            throw new common_1.NotFoundException('Account not found');
        const openingAgg = await this.prisma.journalLine.aggregate({
            where: {
                accountId: dto.accountId,
                journalEntry: {
                    tenantId: tenant.id,
                    status: 'POSTED',
                    journalDate: {
                        lt: from,
                    },
                },
            },
            _sum: {
                debit: true,
                credit: true,
            },
        });
        const openingDebit = Number(openingAgg._sum.debit ?? 0);
        const openingCredit = Number(openingAgg._sum.credit ?? 0);
        const openingBalance = openingDebit - openingCredit;
        const total = await this.prisma.journalLine.count({
            where: {
                accountId: dto.accountId,
                journalEntry: {
                    tenantId: tenant.id,
                    status: 'POSTED',
                    journalDate: {
                        gte: from,
                        lte: to,
                    },
                },
            },
        });
        const fetchCount = Math.min(offset + limit, 5100);
        const linesWindow = await this.prisma.journalLine.findMany({
            where: {
                accountId: dto.accountId,
                journalEntry: {
                    tenantId: tenant.id,
                    status: 'POSTED',
                    journalDate: {
                        gte: from,
                        lte: to,
                    },
                },
            },
            orderBy: [
                { journalEntry: { journalDate: 'asc' } },
                { journalEntryId: 'asc' },
                { lineNumber: 'asc' },
                { id: 'asc' },
            ],
            take: fetchCount,
            select: {
                id: true,
                journalEntryId: true,
                debit: true,
                credit: true,
                lineNumber: true,
                journalEntry: {
                    select: {
                        id: true,
                        journalNumber: true,
                        journalDate: true,
                        reference: true,
                        description: true,
                    },
                },
            },
        });
        let runningBalance = openingBalance;
        const windowWithBalance = linesWindow.map((l) => {
            const debit = Number(l.debit ?? 0);
            const credit = Number(l.credit ?? 0);
            runningBalance += debit - credit;
            return {
                id: l.id,
                journalEntryId: l.journalEntryId,
                debit,
                credit,
                lineNumber: l.lineNumber,
                journalEntry: l.journalEntry,
                runningBalance,
            };
        });
        const windowPage = windowWithBalance.slice(offset, offset + limit);
        const rows = windowPage.map((l) => {
            return {
                journalEntryId: l.journalEntryId,
                journalNumber: l.journalEntry.journalNumber,
                journalDate: l.journalEntry.journalDate,
                reference: l.journalEntry.reference,
                description: l.journalEntry.description,
                debit: l.debit,
                credit: l.credit,
                runningBalance: l.runningBalance,
            };
        });
        if (offset === 0) {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'REPORT_VIEW',
                    entityType: 'ACCOUNT',
                    entityId: dto.accountId,
                    action: 'LEDGER_VIEW',
                    outcome: 'SUCCESS',
                    reason: JSON.stringify({
                        reportSource,
                        sourceReport,
                        account: {
                            id: account.id,
                            code: account.code,
                            name: account.name,
                        },
                        dateRange: {
                            fromDate: from.toISOString().slice(0, 10),
                            toDate: to.toISOString().slice(0, 10),
                        },
                        pagination: { offset, limit },
                    }),
                    userId: user.id,
                    permissionUsed: 'FINANCE_GL_VIEW',
                },
            })
                .catch(() => undefined);
        }
        return {
            account,
            period: {
                fromDate: from.toISOString().slice(0, 10),
                toDate: to.toISOString().slice(0, 10),
            },
            openingBalance,
            rows,
            total,
            limit,
            offset,
            hasMore: offset + rows.length < total,
        };
    }
    async getJournalDetail(req, id) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const entry = await this.prisma.journalEntry.findFirst({
            where: { id, tenantId: tenant.id },
            select: {
                id: true,
                tenantId: true,
                journalNumber: true,
                journalType: true,
                reference: true,
                description: true,
                journalDate: true,
                status: true,
                createdById: true,
                correctsJournalId: true,
                riskScore: true,
                riskFlags: true,
                riskComputedAt: true,
                budgetStatus: true,
                budgetFlags: true,
                budgetCheckedAt: true,
                budgetOverrideJustification: true,
                reversalInitiatedById: true,
                reversalInitiatedAt: true,
                reversalPreparedById: true,
                submittedById: true,
                submittedAt: true,
                reviewedById: true,
                reviewedAt: true,
                rejectedById: true,
                rejectedAt: true,
                rejectionReason: true,
                approvedById: true,
                approvedAt: true,
                postedById: true,
                postedAt: true,
                returnedByPosterId: true,
                returnedByPosterAt: true,
                returnReason: true,
                reversalOfId: true,
                reversalReason: true,
                periodId: true,
                createdAt: true,
                createdBy: { select: { id: true, email: true } },
                reversalInitiatedBy: { select: { id: true, email: true } },
                reversalPreparedBy: { select: { id: true, email: true } },
                submittedBy: { select: { id: true, email: true } },
                reviewedBy: { select: { id: true, email: true } },
                rejectedBy: { select: { id: true, email: true } },
                approvedBy: { select: { id: true, email: true } },
                postedBy: { select: { id: true, email: true } },
                returnedByPoster: { select: { id: true, email: true } },
                reversalOf: {
                    select: {
                        id: true,
                        journalNumber: true,
                        reference: true,
                        status: true,
                    },
                },
                reversedBy: {
                    select: {
                        id: true,
                        journalNumber: true,
                        reference: true,
                        status: true,
                    },
                },
                period: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        startDate: true,
                        endDate: true,
                    },
                },
                lines: {
                    orderBy: [{ lineNumber: 'asc' }, { id: 'asc' }],
                    select: {
                        id: true,
                        journalEntryId: true,
                        lineNumber: true,
                        description: true,
                        accountId: true,
                        legalEntityId: true,
                        departmentId: true,
                        projectId: true,
                        fundId: true,
                        debit: true,
                        credit: true,
                        account: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                                type: true,
                                normalBalance: true,
                            },
                        },
                        legalEntity: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                            },
                        },
                        department: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                            },
                        },
                        project: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                            },
                        },
                        fund: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });
        if (!entry)
            throw new common_1.NotFoundException('Journal entry not found');
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'REPORT_VIEW',
                entityType: 'JOURNAL_ENTRY',
                entityId: entry.id,
                action: 'JOURNAL_VIEW_DETAIL',
                outcome: 'SUCCESS',
                reason: JSON.stringify({
                    reportSource: 'LEDGER',
                    journalEntryId: entry.id,
                }),
                userId: user.id,
                permissionUsed: 'FINANCE_GL_VIEW',
            },
        })
            .catch(() => undefined);
        return entry;
    }
    async returnJournalToReview(req, id, dto) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_FINAL_POST');
        const reason = (dto?.reason ?? '').trim();
        if (!reason || reason.length < 3) {
            throw new common_1.BadRequestException('Return reason is required');
        }
        const entry = await this.prisma.journalEntry.findFirst({
            where: { id, tenantId: authz.tenantId },
            select: {
                id: true,
                status: true,
                createdById: true,
                reviewedById: true,
                reviewedAt: true,
            },
        });
        if (!entry) {
            throw new common_1.NotFoundException('Journal entry not found');
        }
        if (entry.status !== 'REVIEWED') {
            throw new common_1.BadRequestException(`Journal entry cannot be returned from status: ${entry.status}`);
        }
        try {
            (0, finance_authz_helpers_1.requireSoDSeparation)({
                label: 'posterId != createdById',
                aUserId: authz.id,
                bUserId: entry.createdById,
            });
            (0, finance_authz_helpers_1.requireSoDSeparation)({
                label: 'posterId != reviewedById',
                aUserId: authz.id,
                bUserId: entry.reviewedById,
            });
        }
        catch (e) {
            throw e;
        }
        const now = new Date();
        const previousReviewerId = entry.reviewedById ?? null;
        const updated = await this.prisma.journalEntry.update({
            where: { id: entry.id },
            data: {
                status: 'SUBMITTED',
                reviewedById: null,
                reviewedAt: null,
                returnedByPosterId: authz.id,
                returnedByPosterAt: now,
                returnReason: reason,
            },
            include: { lines: true },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: authz.tenantId,
                eventType: 'GL_JOURNAL_RETURNED_BY_POSTER',
                entityType: 'JOURNAL_ENTRY',
                entityId: entry.id,
                action: 'FINANCE_GL_FINAL_POST',
                outcome: 'SUCCESS',
                reason: JSON.stringify({
                    journalId: entry.id,
                    returnedByPosterId: authz.id,
                    previousReviewerId,
                    reason,
                    timestamp: now.toISOString(),
                }),
                userId: authz.id,
                permissionUsed: 'FINANCE_GL_FINAL_POST',
            },
        })
            .catch(() => undefined);
        this.cache.clearTenant(authz.tenantId);
        return updated;
    }
    async createDraftJournal(req, dto) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_CREATE');
        this.assertLinesBasicValid(dto.lines);
        const journalDate = new Date(dto.journalDate);
        if (Number.isNaN(journalDate.getTime())) {
            throw new common_1.BadRequestException({
                code: 'INVALID_JOURNAL_DATE',
                reason: 'NO_PERIOD',
                message: 'No accounting period exists for the selected date.',
            });
        }
        const cutover = await this.getCutoverDateIfLocked({
            tenantId: authz.tenantId,
        });
        if (cutover && journalDate < cutover) {
            throw new common_1.BadRequestException({
                code: 'INVALID_JOURNAL_DATE',
                reason: 'CUTOVER_VIOLATION',
                message: 'Journal date is before system cutover. Select a later date.',
            });
        }
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: authz.tenantId,
                startDate: { lte: journalDate },
                endDate: { gte: journalDate },
            },
            select: { id: true, status: true },
        });
        if (!period) {
            throw new common_1.BadRequestException({
                code: 'INVALID_JOURNAL_DATE',
                reason: 'NO_PERIOD',
                message: 'No accounting period exists for the selected date.',
            });
        }
        if (period.status !== 'OPEN') {
            throw new common_1.BadRequestException({
                code: 'INVALID_JOURNAL_DATE',
                reason: 'PERIOD_CLOSED',
                message: 'Selected accounting period is closed. Choose an open period.',
            });
        }
        const accounts = await this.prisma.account.findMany({
            where: {
                tenantId: authz.tenantId,
                id: { in: dto.lines.map((l) => l.accountId) },
            },
            select: { id: true, isActive: true, isPostingAllowed: true },
        });
        const accountMap = new Map(accounts.map((a) => [a.id, a]));
        for (const line of dto.lines) {
            const account = accountMap.get(line.accountId);
            if (!account) {
                throw new common_1.BadRequestException(`Account not found: ${line.accountId}`);
            }
            if (!account.isActive) {
                throw new common_1.BadRequestException(`Account is inactive: ${line.accountId}`);
            }
            if (!account.isPostingAllowed) {
                throw new common_1.BadRequestException(`Account is non-posting and cannot be used in journals: ${line.accountId}`);
            }
        }
        const created = await this.prisma.journalEntry.create({
            data: {
                tenantId: authz.tenantId,
                journalDate,
                journalType: dto.journalType ?? 'STANDARD',
                reference: dto.reference,
                description: dto.description,
                correctsJournalId: dto.correctsJournalId ?? null,
                createdById: authz.id,
                lines: {
                    create: dto.lines.map((l) => ({
                        accountId: l.accountId,
                        lineNumber: l.lineNumber,
                        description: l.description,
                        legalEntityId: l.legalEntityId ?? null,
                        departmentId: l.departmentId ?? null,
                        projectId: l.projectId,
                        fundId: l.fundId,
                        debit: l.debit,
                        credit: l.credit,
                    })),
                },
            },
            include: { lines: true },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: authz.tenantId,
                eventType: 'JOURNAL_CREATE',
                entityType: 'JOURNAL_ENTRY',
                entityId: created.id,
                action: 'FINANCE_GL_CREATE',
                outcome: 'SUCCESS',
                userId: authz.id,
                permissionUsed: 'FINANCE_GL_CREATE',
            },
        })
            .catch(() => undefined);
        return created;
    }
    async getJournal(req, id) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const entry = await this.prisma.journalEntry.findFirst({
            where: { id, tenantId: tenant.id },
            include: { lines: true },
        });
        if (!entry) {
            throw new common_1.NotFoundException('Journal entry not found');
        }
        return entry;
    }
    async updateDraftJournal(req, id, dto) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_CREATE');
        const entry = await this.prisma.journalEntry.findFirst({
            where: { id, tenantId: authz.tenantId },
            include: { lines: true },
        });
        if (!entry) {
            throw new common_1.NotFoundException('Journal entry not found');
        }
        if (entry.status !== 'DRAFT' && entry.status !== 'REJECTED') {
            throw new common_1.ForbiddenException('Only DRAFT or REJECTED journals can be edited');
        }
        const isReversal = entry.journalType === 'REVERSING' && !!entry.reversalOfId;
        if (isReversal) {
            (0, finance_authz_helpers_1.requireOwnership)({ createdById: entry.createdById, userId: authz.id });
        }
        else {
            (0, finance_authz_helpers_1.requireOwnership)({ createdById: entry.createdById, userId: authz.id });
        }
        if (isReversal) {
            const now = new Date();
            const proposedDate = new Date(dto.journalDate);
            if (Number.isNaN(proposedDate.getTime())) {
                throw new common_1.BadRequestException('Invalid journalDate');
            }
            const cutover = await this.getCutoverDateIfLocked({
                tenantId: authz.tenantId,
            });
            if (cutover && proposedDate < cutover) {
                throw new common_1.BadRequestException('Journal date is before system cutover. Select a later date.');
            }
            const period = await this.prisma.accountingPeriod.findFirst({
                where: {
                    tenantId: authz.tenantId,
                    startDate: { lte: proposedDate },
                    endDate: { gte: proposedDate },
                },
                select: { id: true, status: true, name: true },
            });
            if (!period || period.status !== 'OPEN') {
                throw new common_1.BadRequestException('Journal date is not in an OPEN accounting period.');
            }
            if (period.name === this.OPENING_PERIOD_NAME) {
                const original = await this.prisma.journalEntry.findFirst({
                    where: { id: entry.reversalOfId, tenantId: authz.tenantId },
                    select: { reference: true, description: true },
                });
                const isOpening = original
                    ? this.isOpeningBalanceJournal(original.reference, original.description)
                    : false;
                if (!isOpening) {
                    throw new common_1.BadRequestException('Only opening balance journals can be posted into the Opening Balances period');
                }
            }
            const updated = await this.prisma.journalEntry.update({
                where: { id: entry.id },
                data: {
                    journalDate: proposedDate,
                    description: dto.description,
                    ...(entry.status === 'REJECTED'
                        ? {
                            rejectedById: null,
                            rejectedAt: null,
                            rejectionReason: null,
                        }
                        : {}),
                },
                include: { lines: true },
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: authz.tenantId,
                    eventType: 'JOURNAL_UPDATE',
                    entityType: 'JOURNAL_ENTRY',
                    entityId: updated.id,
                    action: 'FINANCE_GL_CREATE',
                    outcome: 'SUCCESS',
                    userId: authz.id,
                    permissionUsed: 'FINANCE_GL_CREATE',
                    reason: JSON.stringify({
                        mode: 'REVERSAL_HEADER_ONLY',
                        journalDate: proposedDate.toISOString(),
                        updatedAt: now.toISOString(),
                    }),
                },
            })
                .catch(() => undefined);
            return updated;
        }
        this.assertLinesBasicValid(dto.lines);
        const accounts = await this.prisma.account.findMany({
            where: {
                tenantId: authz.tenantId,
                id: { in: dto.lines.map((l) => l.accountId) },
            },
            select: { id: true, code: true, isActive: true, isPostingAllowed: true },
        });
        const accountMap = new Map(accounts.map((a) => [a.id, a]));
        for (const line of dto.lines) {
            const account = accountMap.get(line.accountId);
            if (!account) {
                throw new common_1.BadRequestException(`Account not found: ${line.accountId}`);
            }
            if (!account.isActive) {
                throw new common_1.BadRequestException(`Account is inactive: ${line.accountId}`);
            }
            if (!account.isPostingAllowed) {
                throw new common_1.BadRequestException(`Account is non-posting and cannot be used in journals: ${line.accountId}`);
            }
        }
        const updated = await this.prisma.journalEntry.update({
            where: { id: entry.id },
            data: {
                journalDate: new Date(dto.journalDate),
                journalType: dto.journalType ?? entry.journalType,
                reference: dto.reference,
                description: dto.description,
                budgetOverrideJustification: typeof dto.budgetOverrideJustification === 'string'
                    ? (dto.budgetOverrideJustification ?? null)
                    : (entry.budgetOverrideJustification ?? null),
                ...(entry.status === 'REJECTED'
                    ? {
                        rejectedById: null,
                        rejectedAt: null,
                        rejectionReason: null,
                    }
                    : {}),
                lines: {
                    deleteMany: { journalEntryId: entry.id },
                    create: dto.lines.map((l) => ({
                        accountId: l.accountId,
                        lineNumber: l.lineNumber,
                        description: l.description,
                        legalEntityId: l.legalEntityId ?? null,
                        departmentId: l.departmentId ?? null,
                        projectId: l.projectId ?? null,
                        fundId: l.fundId ?? null,
                        debit: l.debit,
                        credit: l.credit,
                    })),
                },
            },
            include: { lines: true },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: authz.tenantId,
                eventType: 'JOURNAL_UPDATE',
                entityType: 'JOURNAL_ENTRY',
                entityId: updated.id,
                action: 'FINANCE_GL_CREATE',
                outcome: 'SUCCESS',
                userId: authz.id,
                permissionUsed: 'FINANCE_GL_CREATE',
            },
        })
            .catch(() => undefined);
        return updated;
    }
    async parkJournal(req, id) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_CREATE');
        const entry = await this.prisma.journalEntry.findFirst({
            where: { id, tenantId: authz.tenantId },
            include: { lines: true },
        });
        if (!entry) {
            throw new common_1.NotFoundException('Journal entry not found');
        }
        if (entry.status !== 'DRAFT') {
            throw new common_1.ForbiddenException('Only DRAFT journals can be parked');
        }
        (0, finance_authz_helpers_1.requireOwnership)({ createdById: entry.createdById, userId: authz.id });
        const linesForValidation = entry.lines.map((l) => ({
            debit: Number(l.debit),
            credit: Number(l.credit),
        }));
        this.assertLinesBasicValid(linesForValidation);
        this.assertBalanced(linesForValidation);
        const parked = await this.prisma.journalEntry.update({
            where: { id: entry.id },
            data: { status: 'PARKED' },
            include: { lines: true },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: authz.tenantId,
                eventType: 'JOURNAL_PARK',
                entityType: 'JOURNAL_ENTRY',
                entityId: parked.id,
                action: 'FINANCE_GL_CREATE',
                outcome: 'SUCCESS',
                userId: authz.id,
                permissionUsed: 'FINANCE_GL_CREATE',
            },
        })
            .catch(() => undefined);
        return parked;
    }
    async submitJournal(req, id) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_CREATE');
        const entry = await this.prisma.journalEntry.findFirst({
            where: { id, tenantId: authz.tenantId },
            include: { lines: true },
        });
        if (!entry) {
            throw new common_1.NotFoundException('Journal entry not found');
        }
        if (entry.status !== 'DRAFT' && entry.status !== 'REJECTED') {
            throw new common_1.BadRequestException(`Journal entry cannot be submitted from status: ${entry.status}`);
        }
        if (entry.createdById !== authz.id) {
            throw new common_1.ForbiddenException({
                error: 'Submission blocked',
                message: 'Only the journal creator can submit this journal.',
                createdById: entry.createdById,
                currentUserId: authz.id,
            });
        }
        const journalDate = new Date(entry.journalDate);
        if (Number.isNaN(journalDate.getTime())) {
            throw new common_1.BadRequestException('Invalid journalDate');
        }
        const cutover = await this.getCutoverDateIfLocked({
            tenantId: authz.tenantId,
        });
        if (cutover && journalDate < cutover) {
            throw new common_1.BadRequestException('Journal date is before system cutover. Select a later date.');
        }
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: authz.tenantId,
                startDate: { lte: journalDate },
                endDate: { gte: journalDate },
            },
            select: { id: true, status: true, name: true },
        });
        if (!period || period.status !== 'OPEN') {
            throw new common_1.BadRequestException('Journal date is not in an OPEN accounting period.');
        }
        const linesForValidation = entry.lines.map((l) => ({
            debit: Number(l.debit),
            credit: Number(l.credit),
        }));
        this.assertLinesBasicValid(linesForValidation);
        this.assertBalanced(linesForValidation);
        const submitErrors = [];
        const accountIds = [
            ...new Set(entry.lines.map((l) => l.accountId).filter(Boolean)),
        ];
        const accounts = await this.prisma.account.findMany({
            where: {
                tenantId: authz.tenantId,
                id: { in: accountIds },
            },
            select: {
                id: true,
                code: true,
                type: true,
                isControlAccount: true,
                requiresProject: true,
                requiresFund: true,
            },
        });
        const accountById = new Map(accounts.map((a) => [a.id, a]));
        const legalEntityIds = [
            ...new Set(entry.lines.map((l) => l.legalEntityId).filter(Boolean)),
        ];
        const departmentIds = [
            ...new Set(entry.lines.map((l) => l.departmentId).filter(Boolean)),
        ];
        const projectIds = [
            ...new Set(entry.lines.map((l) => l.projectId).filter(Boolean)),
        ];
        const fundIds = [
            ...new Set(entry.lines.map((l) => l.fundId).filter(Boolean)),
        ];
        const [legalEntities, departments, projects, funds] = await Promise.all([
            this.prisma.legalEntity.findMany({
                where: { tenantId: authz.tenantId, id: { in: legalEntityIds } },
                select: {
                    id: true,
                    tenantId: true,
                    isActive: true,
                    effectiveFrom: true,
                    effectiveTo: true,
                },
            }),
            this.prisma.department.findMany({
                where: { tenantId: authz.tenantId, id: { in: departmentIds } },
                select: {
                    id: true,
                    tenantId: true,
                    isActive: true,
                    effectiveFrom: true,
                    effectiveTo: true,
                },
            }),
            this.prisma.project.findMany({
                where: { tenantId: authz.tenantId, id: { in: projectIds } },
                select: {
                    id: true,
                    tenantId: true,
                    isActive: true,
                    isRestricted: true,
                    effectiveFrom: true,
                    effectiveTo: true,
                },
            }),
            this.prisma.fund.findMany({
                where: { tenantId: authz.tenantId, id: { in: fundIds } },
                select: {
                    id: true,
                    tenantId: true,
                    projectId: true,
                    isActive: true,
                    effectiveFrom: true,
                    effectiveTo: true,
                },
            }),
        ]);
        const legalEntityById = new Map(legalEntities.map((e) => [e.id, e]));
        const departmentById = new Map(departments.map((d) => [d.id, d]));
        const projectById = new Map(projects.map((p) => [p.id, p]));
        const fundById = new Map(funds.map((f) => [f.id, f]));
        for (const l of entry.lines) {
            const account = accountById.get(l.accountId);
            const accountType = account?.type;
            if (!l.legalEntityId) {
                submitErrors.push({
                    lineId: l.id,
                    lineNumber: l.lineNumber ?? null,
                    field: 'legalEntityId',
                    message: 'Legal Entity is required',
                });
            }
            else {
                const le = legalEntityById.get(l.legalEntityId);
                if (!le) {
                    submitErrors.push({
                        lineId: l.id,
                        lineNumber: l.lineNumber ?? null,
                        field: 'legalEntityId',
                        message: 'Legal Entity is invalid for this tenant',
                    });
                }
                else {
                    const effective = le.effectiveFrom <= journalDate &&
                        (le.effectiveTo === null || le.effectiveTo >= journalDate);
                    if (!le.isActive) {
                        submitErrors.push({
                            lineId: l.id,
                            lineNumber: l.lineNumber ?? null,
                            field: 'legalEntityId',
                            message: 'Legal Entity is inactive',
                        });
                    }
                    if (!effective) {
                        submitErrors.push({
                            lineId: l.id,
                            lineNumber: l.lineNumber ?? null,
                            field: 'legalEntityId',
                            message: 'Legal Entity is not effective for journal date',
                        });
                    }
                }
            }
            const departmentRequirement = account
                ? this.getDepartmentRequirement(account)
                : DepartmentRequirement.REQUIRED;
            if (!l.departmentId) {
                if (departmentRequirement === DepartmentRequirement.REQUIRED) {
                    submitErrors.push({
                        lineId: l.id,
                        lineNumber: l.lineNumber ?? null,
                        field: 'departmentId',
                        message: this.getDepartmentRequirementMessage({
                            requirement: departmentRequirement,
                            accountType,
                        }),
                    });
                }
            }
            else {
                if (departmentRequirement === DepartmentRequirement.FORBIDDEN) {
                    submitErrors.push({
                        lineId: l.id,
                        lineNumber: l.lineNumber ?? null,
                        field: 'departmentId',
                        message: this.getDepartmentRequirementMessage({
                            requirement: departmentRequirement,
                            accountType,
                        }),
                    });
                }
                const d = departmentById.get(l.departmentId);
                if (!d) {
                    submitErrors.push({
                        lineId: l.id,
                        lineNumber: l.lineNumber ?? null,
                        field: 'departmentId',
                        message: 'Department is invalid for this tenant',
                    });
                }
                else {
                    const effective = d.effectiveFrom <= journalDate &&
                        (d.effectiveTo === null || d.effectiveTo >= journalDate);
                    if (!d.isActive) {
                        submitErrors.push({
                            lineId: l.id,
                            lineNumber: l.lineNumber ?? null,
                            field: 'departmentId',
                            message: 'Department is inactive',
                        });
                    }
                    if (!effective) {
                        submitErrors.push({
                            lineId: l.id,
                            lineNumber: l.lineNumber ?? null,
                            field: 'departmentId',
                            message: 'Department is not effective for journal date',
                        });
                    }
                }
            }
            const projectId = l.projectId;
            const fundId = l.fundId;
            const selectedProject = projectId
                ? projectById.get(projectId)
                : undefined;
            const isRestrictedProject = Boolean(selectedProject?.isRestricted);
            const fundRequired = Boolean(account?.requiresFund) || isRestrictedProject;
            const projectRequired = Boolean(account?.requiresProject) || fundRequired;
            if (fundId && !projectId) {
                submitErrors.push({
                    lineId: l.id,
                    lineNumber: l.lineNumber ?? null,
                    field: 'projectId',
                    message: 'Project must be selected before Fund',
                });
            }
            if (!projectId && projectRequired) {
                submitErrors.push({
                    lineId: l.id,
                    lineNumber: l.lineNumber ?? null,
                    field: 'projectId',
                    message: 'Project is required',
                });
            }
            if (!fundId && fundRequired) {
                submitErrors.push({
                    lineId: l.id,
                    lineNumber: l.lineNumber ?? null,
                    field: 'fundId',
                    message: isRestrictedProject
                        ? 'Fund is required because the selected Project is restricted'
                        : 'Fund is required',
                });
            }
            if (projectId) {
                const p = projectById.get(projectId);
                if (!p) {
                    submitErrors.push({
                        lineId: l.id,
                        lineNumber: l.lineNumber ?? null,
                        field: 'projectId',
                        message: 'Project is invalid for this tenant',
                    });
                }
                else {
                    const effective = p.effectiveFrom <= journalDate &&
                        (p.effectiveTo === null || p.effectiveTo >= journalDate);
                    if (!p.isActive) {
                        submitErrors.push({
                            lineId: l.id,
                            lineNumber: l.lineNumber ?? null,
                            field: 'projectId',
                            message: 'Project is inactive',
                        });
                    }
                    if (!effective) {
                        submitErrors.push({
                            lineId: l.id,
                            lineNumber: l.lineNumber ?? null,
                            field: 'projectId',
                            message: 'Project is not effective for journal date',
                        });
                    }
                }
            }
            if (fundId) {
                const f = fundById.get(fundId);
                if (!f) {
                    submitErrors.push({
                        lineId: l.id,
                        lineNumber: l.lineNumber ?? null,
                        field: 'fundId',
                        message: 'Fund is invalid for this tenant',
                    });
                }
                else {
                    const effective = f.effectiveFrom <= journalDate &&
                        (f.effectiveTo === null || f.effectiveTo >= journalDate);
                    if (!f.isActive) {
                        submitErrors.push({
                            lineId: l.id,
                            lineNumber: l.lineNumber ?? null,
                            field: 'fundId',
                            message: 'Fund is inactive',
                        });
                    }
                    if (!effective) {
                        submitErrors.push({
                            lineId: l.id,
                            lineNumber: l.lineNumber ?? null,
                            field: 'fundId',
                            message: 'Fund is not effective for journal date',
                        });
                    }
                    if (projectId && f.projectId && f.projectId !== projectId) {
                        submitErrors.push({
                            lineId: l.id,
                            lineNumber: l.lineNumber ?? null,
                            field: 'fundId',
                            message: 'Fund does not belong to selected Project',
                        });
                    }
                }
            }
        }
        if (submitErrors.length > 0) {
            throw new common_1.BadRequestException({
                error: 'Submission blocked',
                message: 'Some journal lines are missing required dimensions.',
                errors: submitErrors,
            });
        }
        const now = new Date();
        const budgetImpact = await this.computeJournalBudgetImpact({
            tenantId: authz.tenantId,
            entry: {
                id: entry.id,
                journalDate: new Date(entry.journalDate),
                createdById: entry.createdById,
                budgetOverrideJustification: entry.budgetOverrideJustification ?? null,
            },
            lines: (entry.lines ?? []).map((l) => ({
                id: l.id,
                lineNumber: l.lineNumber ?? null,
                accountId: l.accountId,
                debit: l.debit,
                credit: l.credit,
                legalEntityId: l.legalEntityId ?? null,
                departmentId: l.departmentId ?? null,
                projectId: l.projectId ?? null,
                fundId: l.fundId ?? null,
            })),
            stage: 'SUBMIT',
            computedAt: now,
        });
        await this.persistJournalBudgetImpact({
            tenantId: authz.tenantId,
            journalId: entry.id,
            computedAt: now,
            budgetStatus: budgetImpact.budgetStatus,
            budgetFlags: budgetImpact.budgetFlags,
        });
        await this.auditJournalBudgetEvaluated({
            tenantId: authz.tenantId,
            journalId: entry.id,
            userId: authz.id,
            permissionUsed: 'FINANCE_GL_CREATE',
            stage: 'SUBMIT',
            computedAt: now,
            budgetStatus: budgetImpact.budgetStatus,
            budgetFlags: budgetImpact.budgetFlags,
        });
        if (budgetImpact.budgetStatus === 'BLOCK') {
            throw new common_1.ConflictException({
                code: 'BUDGET_BLOCKED',
                stage: 'SUBMIT',
                message: 'Journal exceeds available budget for one or more lines.',
                budgetFlags: budgetImpact.budgetFlags,
            });
        }
        if (budgetImpact.budgetStatus === 'WARN') {
            const justification = String(entry.budgetOverrideJustification ?? '').trim();
            if (!justification) {
                throw new common_1.BadRequestException({
                    code: 'BUDGET_JUSTIFICATION_REQUIRED',
                    stage: 'SUBMIT',
                    message: 'Budget exception justification is required to submit this journal.',
                });
            }
        }
        const submitted = await this.prisma.journalEntry.update({
            where: { id: entry.id },
            data: {
                status: 'SUBMITTED',
                submittedById: authz.id,
                submittedAt: now,
                reviewedById: null,
                reviewedAt: null,
                rejectedById: null,
                rejectedAt: null,
                rejectionReason: null,
            },
            include: { lines: true },
        });
        const submitAccounts = await this.prisma.account.findMany({
            where: {
                tenantId: authz.tenantId,
                id: { in: [...new Set(submitted.lines.map((l) => l.accountId))] },
            },
            select: { id: true, code: true },
        });
        const submitAccountCodeById = new Map(submitAccounts.map((a) => [a.id, a.code]));
        const submitRisk = this.computeJournalRisk({
            journal: {
                id: submitted.id,
                journalType: submitted.journalType ?? null,
                journalDate: new Date(submitted.journalDate),
                createdAt: new Date(submitted.createdAt),
                correctsJournalId: submitted.correctsJournalId ?? null,
                reversalOfId: submitted.reversalOfId ?? null,
                reference: submitted.reference ?? null,
                returnReason: submitted.returnReason ?? null,
            },
            lines: (submitted.lines ?? []).map((l) => ({
                debit: l.debit,
                credit: l.credit,
                account: { code: submitAccountCodeById.get(l.accountId) ?? null },
            })),
            stage: 'SUBMIT',
            computedAt: now,
            postingPeriod: null,
            budget: budgetImpact.budgetStatus === 'WARN'
                ? {
                    budgetStatus: 'WARN',
                    warnRepeatUpliftPoints: (await this.getBudgetRepeatWarnUplift({
                        tenantId: authz.tenantId,
                        createdById: entry.createdById,
                        excludeJournalId: entry.id,
                        now,
                    })).points,
                }
                : { budgetStatus: budgetImpact.budgetStatus },
        });
        await this.persistJournalRisk({
            tenantId: authz.tenantId,
            journalId: submitted.id,
            computedAt: now,
            score: submitRisk.score,
            flags: submitRisk.flags,
            stage: 'SUBMIT',
            userId: authz.id,
            permissionUsed: 'FINANCE_GL_CREATE',
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: authz.tenantId,
                eventType: 'GL_JOURNAL_SUBMITTED',
                entityType: 'JOURNAL_ENTRY',
                entityId: submitted.id,
                action: 'FINANCE_GL_CREATE',
                outcome: 'SUCCESS',
                userId: authz.id,
                permissionUsed: 'FINANCE_GL_CREATE',
            },
        })
            .catch(() => undefined);
        return submitted;
    }
    async reviewJournal(req, id) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_APPROVE');
        const entry = await this.prisma.journalEntry.findFirst({
            where: { id, tenantId: authz.tenantId },
            include: { lines: true },
        });
        if (!entry) {
            throw new common_1.NotFoundException('Journal entry not found');
        }
        if (entry.status !== 'SUBMITTED') {
            throw new common_1.BadRequestException(`Journal entry cannot be reviewed from status: ${entry.status}`);
        }
        if (!entry.submittedById || !entry.submittedAt) {
            throw new common_1.BadRequestException({
                error: 'Corrupted workflow state',
                message: 'Submitted journal is missing submission metadata (submittedById/submittedAt).',
            });
        }
        if (entry.reviewedById || entry.reviewedAt) {
            throw new common_1.BadRequestException({
                error: 'Corrupted workflow state',
                message: 'Submitted journal has review metadata already set (reviewedById/reviewedAt).',
            });
        }
        const reversalInitiatorId = entry.journalType === 'REVERSING'
            ? (entry.reversalInitiatedById ?? null)
            : null;
        if (authz.id === entry.createdById ||
            authz.id === entry.submittedById ||
            (reversalInitiatorId && authz.id === reversalInitiatorId)) {
            throw new common_1.ForbiddenException({
                error: 'Action blocked by Segregation of Duties (SoD)',
                message: 'You cannot review a journal you prepared, submitted, or initiated for reversal.',
                createdById: entry.createdById,
                submittedById: entry.submittedById,
                reviewedById: entry.reviewedById ?? null,
            });
        }
        const journalDate = new Date(entry.journalDate);
        if (Number.isNaN(journalDate.getTime())) {
            throw new common_1.BadRequestException('Invalid journalDate');
        }
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: authz.tenantId,
                startDate: { lte: journalDate },
                endDate: { gte: journalDate },
            },
            select: { id: true, status: true },
        });
        if (!period || period.status !== 'OPEN') {
            throw new common_1.BadRequestException('Journal date is not in an OPEN accounting period.');
        }
        const now = new Date();
        const budgetImpact = await this.computeJournalBudgetImpact({
            tenantId: authz.tenantId,
            entry: {
                id: entry.id,
                journalDate,
                createdById: entry.createdById,
                budgetOverrideJustification: entry.budgetOverrideJustification ?? null,
            },
            lines: (entry.lines ?? []).map((l) => ({
                id: l.id,
                lineNumber: l.lineNumber ?? null,
                accountId: l.accountId,
                debit: l.debit,
                credit: l.credit,
                legalEntityId: l.legalEntityId ?? null,
                departmentId: l.departmentId ?? null,
                projectId: l.projectId ?? null,
                fundId: l.fundId ?? null,
            })),
            stage: 'REVIEW',
            computedAt: now,
        });
        await this.persistJournalBudgetImpact({
            tenantId: authz.tenantId,
            journalId: entry.id,
            computedAt: now,
            budgetStatus: budgetImpact.budgetStatus,
            budgetFlags: budgetImpact.budgetFlags,
        });
        await this.auditJournalBudgetEvaluated({
            tenantId: authz.tenantId,
            journalId: entry.id,
            userId: authz.id,
            permissionUsed: 'FINANCE_GL_APPROVE',
            stage: 'REVIEW',
            computedAt: now,
            budgetStatus: budgetImpact.budgetStatus,
            budgetFlags: budgetImpact.budgetFlags,
        });
        if (budgetImpact.budgetStatus === 'BLOCK') {
            throw new common_1.ConflictException({
                code: 'BUDGET_BLOCKED',
                stage: 'REVIEW',
                message: 'Journal exceeds available budget for one or more lines.',
                budgetFlags: budgetImpact.budgetFlags,
            });
        }
        if (budgetImpact.budgetStatus === 'WARN') {
            const justification = String(entry.budgetOverrideJustification ?? '').trim();
            if (!justification) {
                throw new common_1.BadRequestException({
                    code: 'BUDGET_JUSTIFICATION_REQUIRED',
                    stage: 'REVIEW',
                    message: 'Budget exception justification is required to review this journal.',
                });
            }
        }
        const reviewed = await this.prisma.journalEntry.update({
            where: { id: entry.id },
            data: {
                status: 'REVIEWED',
                reviewedById: authz.id,
                reviewedAt: now,
            },
            include: { lines: true },
        });
        const reviewAccounts = await this.prisma.account.findMany({
            where: {
                tenantId: authz.tenantId,
                id: { in: [...new Set(reviewed.lines.map((l) => l.accountId))] },
            },
            select: { id: true, code: true },
        });
        const reviewAccountCodeById = new Map(reviewAccounts.map((a) => [a.id, a.code]));
        const reviewRisk = this.computeJournalRisk({
            journal: {
                id: reviewed.id,
                journalType: reviewed.journalType ?? null,
                journalDate: new Date(reviewed.journalDate),
                createdAt: new Date(reviewed.createdAt),
                correctsJournalId: reviewed.correctsJournalId ?? null,
                reversalOfId: reviewed.reversalOfId ?? null,
                reference: reviewed.reference ?? null,
                returnReason: reviewed.returnReason ?? null,
            },
            lines: (reviewed.lines ?? []).map((l) => ({
                debit: l.debit,
                credit: l.credit,
                account: { code: reviewAccountCodeById.get(l.accountId) ?? null },
            })),
            stage: 'REVIEW',
            computedAt: now,
            postingPeriod: null,
            budget: budgetImpact.budgetStatus === 'WARN'
                ? {
                    budgetStatus: 'WARN',
                    warnRepeatUpliftPoints: (await this.getBudgetRepeatWarnUplift({
                        tenantId: authz.tenantId,
                        createdById: entry.createdById,
                        excludeJournalId: entry.id,
                        now,
                    })).points,
                }
                : { budgetStatus: budgetImpact.budgetStatus },
        });
        await this.persistJournalRisk({
            tenantId: authz.tenantId,
            journalId: reviewed.id,
            computedAt: now,
            score: reviewRisk.score,
            flags: reviewRisk.flags,
            stage: 'REVIEW',
            userId: authz.id,
            permissionUsed: 'FINANCE_GL_APPROVE',
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: authz.tenantId,
                eventType: 'GL_JOURNAL_REVIEWED',
                entityType: 'JOURNAL_ENTRY',
                entityId: reviewed.id,
                action: 'FINANCE_GL_APPROVE',
                outcome: 'SUCCESS',
                userId: authz.id,
                permissionUsed: 'FINANCE_GL_APPROVE',
            },
        })
            .catch(() => undefined);
        if (reviewed.journalType === 'REVERSING') {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: authz.tenantId,
                    eventType: 'GL_JOURNAL_REVERSAL_APPROVED',
                    entityType: 'JOURNAL_ENTRY',
                    entityId: reviewed.id,
                    action: 'FINANCE_GL_APPROVE',
                    outcome: 'SUCCESS',
                    reason: JSON.stringify({
                        reversalJournalId: reviewed.id,
                        reversalOfId: reviewed.reversalOfId ?? null,
                        reviewedById: authz.id,
                        reviewedAt: now.toISOString(),
                    }),
                    userId: authz.id,
                    permissionUsed: 'FINANCE_GL_APPROVE',
                },
            })
                .catch(() => undefined);
        }
        return reviewed;
    }
    async rejectJournal(req, id, dto) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_APPROVE');
        const reason = (dto?.reason ?? '').trim();
        if (!reason) {
            throw new common_1.BadRequestException('Rejection reason is required');
        }
        const entry = await this.prisma.journalEntry.findFirst({
            where: { id, tenantId: authz.tenantId },
            include: { lines: true },
        });
        if (!entry) {
            throw new common_1.NotFoundException('Journal entry not found');
        }
        if (entry.status !== 'SUBMITTED') {
            throw new common_1.BadRequestException(`Journal entry cannot be rejected from status: ${entry.status}`);
        }
        if (!entry.submittedById || !entry.submittedAt) {
            throw new common_1.BadRequestException({
                error: 'Corrupted workflow state',
                message: 'Submitted journal is missing submission metadata (submittedById/submittedAt).',
            });
        }
        const reversalInitiatorId = entry.journalType === 'REVERSING'
            ? (entry.reversalInitiatedById ?? null)
            : null;
        if (authz.id === entry.createdById ||
            authz.id === entry.submittedById ||
            (reversalInitiatorId && authz.id === reversalInitiatorId)) {
            throw new common_1.ForbiddenException({
                error: 'Action blocked by Segregation of Duties (SoD)',
                message: 'You cannot reject a journal you prepared, submitted, or initiated for reversal.',
            });
        }
        const now = new Date();
        const updated = await this.prisma.journalEntry.update({
            where: { id: entry.id },
            data: {
                status: 'REJECTED',
                rejectedById: authz.id,
                rejectedAt: now,
                rejectionReason: reason,
                reviewedById: null,
                reviewedAt: null,
            },
            include: { lines: true },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: authz.tenantId,
                eventType: 'GL_JOURNAL_REJECTED',
                entityType: 'JOURNAL_ENTRY',
                entityId: updated.id,
                action: 'FINANCE_GL_APPROVE',
                outcome: 'SUCCESS',
                reason,
                userId: authz.id,
                permissionUsed: 'FINANCE_GL_APPROVE',
            },
        })
            .catch(() => undefined);
        return updated;
    }
    async reversePostedJournal(req, id, dto) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_FINAL_POST');
        const original = await this.prisma.journalEntry.findFirst({
            where: { id, tenantId: authz.tenantId },
            include: {
                lines: true,
                reversedBy: { select: { id: true, status: true } },
            },
        });
        if (!original) {
            throw new common_1.NotFoundException('Journal entry not found');
        }
        if (original.status !== 'POSTED') {
            throw new common_1.BadRequestException('Only POSTED journals can be reversed');
        }
        const existingReversal = original.reversedBy?.find((j) => j && j.status !== 'REJECTED') ?? null;
        if (existingReversal) {
            throw new common_1.BadRequestException('This journal already has a reversal journal.');
        }
        try {
            (0, finance_authz_helpers_1.requireSoDSeparation)({
                label: 'reverserId != createdById',
                aUserId: authz.id,
                bUserId: original.createdById,
            });
        }
        catch (e) {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: authz.tenantId,
                    eventType: 'GL_JOURNAL_POST_BLOCKED',
                    entityType: 'JOURNAL_ENTRY',
                    entityId: original.id,
                    action: 'FINANCE_GL_FINAL_POST',
                    outcome: 'BLOCKED',
                    reason: 'Journal creator cannot reverse the journal',
                    userId: authz.id,
                    permissionUsed: 'FINANCE_GL_FINAL_POST',
                },
            })
                .catch(() => undefined);
            throw e;
        }
        const suggestedDate = dto.journalDate
            ? new Date(dto.journalDate)
            : new Date(original.journalDate);
        if (Number.isNaN(suggestedDate.getTime())) {
            throw new common_1.BadRequestException('Invalid journalDate');
        }
        const cutover = await this.getCutoverDateIfLocked({
            tenantId: authz.tenantId,
        });
        if (cutover && suggestedDate < cutover) {
            throw new common_1.ForbiddenException({
                error: 'Reversal blocked by cutover lock',
                reason: `Reversal dated before cutover is not allowed (cutover: ${cutover.toISOString().slice(0, 10)})`,
            });
        }
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: authz.tenantId,
                startDate: { lte: suggestedDate },
                endDate: { gte: suggestedDate },
            },
            select: {
                id: true,
                status: true,
                name: true,
                startDate: true,
                endDate: true,
            },
        });
        let reversalDate = suggestedDate;
        if (!period || period.status !== 'OPEN') {
            const nextOpen = await this.prisma.accountingPeriod.findFirst({
                where: {
                    tenantId: authz.tenantId,
                    status: 'OPEN',
                    startDate: { gte: suggestedDate },
                },
                orderBy: { startDate: 'asc' },
                select: { startDate: true },
            });
            if (!nextOpen) {
                throw new common_1.ForbiddenException({
                    error: 'Reversal blocked by accounting period control',
                    reason: 'No OPEN accounting period exists for the reversal date or after it',
                });
            }
            reversalDate = nextOpen.startDate;
        }
        const effectivePeriod = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: authz.tenantId,
                startDate: { lte: reversalDate },
                endDate: { gte: reversalDate },
            },
            select: { id: true, status: true, name: true },
        });
        if (!effectivePeriod || effectivePeriod.status !== 'OPEN') {
            throw new common_1.ForbiddenException({
                error: 'Reversal blocked by accounting period control',
                reason: 'Reversal journal date is not in an OPEN accounting period',
            });
        }
        const isOpening = this.isOpeningBalanceJournal(original.reference, original.description);
        if (effectivePeriod.name === this.OPENING_PERIOD_NAME && !isOpening) {
            throw new common_1.ForbiddenException({
                error: 'Reversal blocked by opening balances control period',
                reason: 'Only opening balance journals can be posted into the Opening Balances period',
            });
        }
        const accountIds = [
            ...new Set(original.lines.map((l) => l.accountId).filter(Boolean)),
        ];
        const projectIds = [
            ...new Set(original.lines.map((l) => l.projectId).filter(Boolean)),
        ];
        const [accounts, projects] = await Promise.all([
            this.prisma.account.findMany({
                where: { tenantId: authz.tenantId, id: { in: accountIds } },
                select: {
                    id: true,
                    type: true,
                    isControlAccount: true,
                    requiresProject: true,
                    requiresFund: true,
                },
            }),
            projectIds.length
                ? this.prisma.project.findMany({
                    where: { tenantId: authz.tenantId, id: { in: projectIds } },
                    select: { id: true, isRestricted: true },
                })
                : Promise.resolve([]),
        ]);
        const accountById = new Map(accounts.map((a) => [a.id, a]));
        const projectById = new Map(projects.map((p) => [p.id, p]));
        const reversalLines = original.lines.map((l) => {
            const legalEntityId = l.legalEntityId ?? null;
            const departmentId = l.departmentId ?? null;
            const projectId = l.projectId ?? null;
            const fundId = l.fundId ?? null;
            const account = accountById.get(l.accountId);
            const departmentRequirement = account
                ? this.getDepartmentRequirement(account)
                : DepartmentRequirement.REQUIRED;
            const selectedProject = projectId
                ? projectById.get(projectId)
                : undefined;
            const isRestrictedProject = Boolean(selectedProject?.isRestricted);
            const legalEntityRequired = true;
            const fundRequired = Boolean(account?.requiresFund) || isRestrictedProject;
            const projectRequired = Boolean(account?.requiresProject) || fundRequired;
            const missingRequiredDimension = (legalEntityRequired && !legalEntityId) ||
                (departmentRequirement === DepartmentRequirement.REQUIRED &&
                    !departmentId) ||
                (projectRequired && !projectId) ||
                (fundRequired && !fundId);
            if (missingRequiredDimension) {
                throw new common_1.ConflictException({
                    code: 'LEGACY_JOURNAL_MISSING_DIMENSIONS',
                    message: 'This journal was posted before dimension enforcement. It cannot be reversed automatically. A correcting journal is required.',
                });
            }
            return {
                accountId: l.accountId,
                lineNumber: l.lineNumber ?? undefined,
                description: l.description ?? undefined,
                legalEntityId,
                departmentId,
                projectId,
                fundId,
                debit: Number(l.credit),
                credit: Number(l.debit),
            };
        });
        this.assertBalanced(reversalLines.map((l) => ({
            debit: Number(l.debit),
            credit: Number(l.credit),
        })));
        const reason = (dto?.reason ?? '').trim();
        if (!reason) {
            throw new common_1.BadRequestException('Reversal reason is required');
        }
        const now = new Date();
        const created = await this.prisma.journalEntry.create({
            data: {
                tenantId: authz.tenantId,
                journalDate: reversalDate,
                journalType: 'REVERSING',
                reference: dto.reference ??
                    (original.journalNumber
                        ? `REVERSAL_OF:${original.journalNumber}`
                        : `REVERSAL_OF:${original.id}`),
                description: dto.description ??
                    (original.description
                        ? `Reversal: ${original.description}`
                        : 'Reversal journal'),
                createdById: original.createdById,
                reversalInitiatedById: authz.id,
                reversalInitiatedAt: now,
                reversalOfId: original.id,
                reversalReason: reason,
                lines: { create: reversalLines },
            },
            include: { lines: true },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: authz.tenantId,
                eventType: 'GL_JOURNAL_REVERSAL_ASSIGNED',
                entityType: 'JOURNAL_ENTRY',
                entityId: created.id,
                action: 'FINANCE_GL_FINAL_POST',
                outcome: 'SUCCESS',
                reason: JSON.stringify({
                    originalJournalId: original.id,
                    initiatedById: authz.id,
                    preparedById: original.createdById,
                    assignedAt: now.toISOString(),
                }),
                userId: authz.id,
                permissionUsed: 'FINANCE_GL_FINAL_POST',
            },
        })
            .catch(() => undefined);
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: authz.tenantId,
                eventType: 'GL_JOURNAL_REVERSED',
                entityType: 'JOURNAL_ENTRY',
                entityId: created.id,
                action: 'FINANCE_GL_FINAL_POST',
                outcome: 'SUCCESS',
                reason,
                userId: authz.id,
                permissionUsed: 'FINANCE_GL_FINAL_POST',
            },
        })
            .catch(() => undefined);
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: authz.tenantId,
                eventType: 'GL_JOURNAL_REVERSAL_INITIATED',
                entityType: 'JOURNAL_ENTRY',
                entityId: created.id,
                action: 'FINANCE_GL_FINAL_POST',
                outcome: 'SUCCESS',
                reason: JSON.stringify({
                    reversalJournalId: created.id,
                    reversalOfId: original.id,
                    reversalReason: reason,
                    reversalInitiatedById: authz.id,
                    reversalInitiatedAt: now.toISOString(),
                    reversalDate: reversalDate.toISOString(),
                }),
                userId: authz.id,
                permissionUsed: 'FINANCE_GL_FINAL_POST',
            },
        })
            .catch(() => undefined);
        return created;
    }
    async postJournal(req, id) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_FINAL_POST');
        const entry = await this.prisma.journalEntry.findFirst({
            where: {
                id,
                tenantId: authz.tenantId,
            },
            include: { lines: true },
        });
        if (!entry) {
            throw new common_1.NotFoundException('Journal entry not found');
        }
        if (entry.status === 'POSTED') {
            throw new common_1.BadRequestException('Journal entry is already posted');
        }
        if (entry.status !== 'REVIEWED') {
            throw new common_1.BadRequestException(`Journal entry cannot be posted from status: ${entry.status}`);
        }
        const isReversal = entry.journalType === 'REVERSING' && !!entry.reversalOfId;
        const reversalInitiatorId = isReversal
            ? (entry.reversalInitiatedById ?? entry.createdById ?? null)
            : null;
        try {
            if (isReversal && reversalInitiatorId) {
                (0, finance_authz_helpers_1.requireSoDSeparation)({
                    label: 'posterId != reversalInitiatorId',
                    aUserId: authz.id,
                    bUserId: reversalInitiatorId,
                });
            }
            (0, finance_authz_helpers_1.requireSoDSeparation)({
                label: 'approverId != createdById',
                aUserId: authz.id,
                bUserId: entry.createdById,
            });
            (0, finance_authz_helpers_1.requireSoDSeparation)({
                label: 'approverId != reviewedById',
                aUserId: authz.id,
                bUserId: entry.reviewedById,
            });
        }
        catch (e) {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: authz.tenantId,
                    eventType: 'GL_JOURNAL_POST_BLOCKED',
                    entityType: 'JOURNAL_ENTRY',
                    entityId: entry.id,
                    action: 'FINANCE_GL_FINAL_POST',
                    outcome: 'BLOCKED',
                    reason: 'Posting blocked by Segregation of Duties (SoD)',
                    userId: authz.id,
                    permissionUsed: 'FINANCE_GL_FINAL_POST',
                },
            })
                .catch(() => undefined);
            throw e;
        }
        this.assertBalanced(entry.lines.map((l) => ({
            debit: Number(l.debit),
            credit: Number(l.credit),
        })));
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: authz.tenantId,
                startDate: { lte: entry.journalDate },
                endDate: { gte: entry.journalDate },
            },
            select: { id: true, status: true, name: true, endDate: true },
        });
        if (!period || period.status !== 'OPEN') {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: authz.tenantId,
                    eventType: 'GL_JOURNAL_POST_BLOCKED',
                    entityType: 'JOURNAL_ENTRY',
                    entityId: entry.id,
                    action: 'FINANCE_GL_FINAL_POST',
                    outcome: 'BLOCKED',
                    reason: !period
                        ? 'No accounting period exists for the journal date'
                        : `Accounting period is not OPEN: ${period.name}`,
                    userId: authz.id,
                    permissionUsed: 'FINANCE_GL_FINAL_POST',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by accounting period control',
                reason: !period
                    ? 'No accounting period exists for the journal date'
                    : `Accounting period is not OPEN: ${period.name}`,
            });
        }
        const cutover = await this.getCutoverDateIfLocked({
            tenantId: authz.tenantId,
        });
        if (cutover && entry.journalDate < cutover) {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: authz.tenantId,
                    eventType: 'GL_JOURNAL_POST_BLOCKED',
                    entityType: 'JOURNAL_ENTRY',
                    entityId: entry.id,
                    action: 'FINANCE_GL_FINAL_POST',
                    outcome: 'BLOCKED',
                    reason: `Posting dated before cutover is not allowed (cutover: ${cutover.toISOString().slice(0, 10)})`,
                    userId: authz.id,
                    permissionUsed: 'FINANCE_GL_FINAL_POST',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by cutover lock',
                reason: `Posting dated before cutover is not allowed (cutover: ${cutover.toISOString().slice(0, 10)})`,
            });
        }
        const isOpening = this.isOpeningBalanceJournal(entry.reference, entry.description);
        if (period.name === this.OPENING_PERIOD_NAME && !isOpening) {
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by opening balances control period',
                reason: 'Only opening balance journals can be posted into the Opening Balances period',
            });
        }
        const now = new Date();
        const budgetImpact = await this.computeJournalBudgetImpact({
            tenantId: authz.tenantId,
            entry: {
                id: entry.id,
                journalDate: new Date(entry.journalDate),
                createdById: entry.createdById,
                budgetOverrideJustification: entry.budgetOverrideJustification ?? null,
            },
            lines: (entry.lines ?? []).map((l) => ({
                id: l.id,
                lineNumber: l.lineNumber ?? null,
                accountId: l.accountId,
                debit: l.debit,
                credit: l.credit,
                legalEntityId: l.legalEntityId ?? null,
                departmentId: l.departmentId ?? null,
                projectId: l.projectId ?? null,
                fundId: l.fundId ?? null,
            })),
            stage: 'POST',
            computedAt: now,
        });
        await this.persistJournalBudgetImpact({
            tenantId: authz.tenantId,
            journalId: entry.id,
            computedAt: now,
            budgetStatus: budgetImpact.budgetStatus,
            budgetFlags: budgetImpact.budgetFlags,
        });
        await this.auditJournalBudgetEvaluated({
            tenantId: authz.tenantId,
            journalId: entry.id,
            userId: authz.id,
            permissionUsed: 'FINANCE_GL_FINAL_POST',
            stage: 'POST',
            computedAt: now,
            budgetStatus: budgetImpact.budgetStatus,
            budgetFlags: budgetImpact.budgetFlags,
        });
        if (budgetImpact.budgetStatus === 'BLOCK') {
            throw new common_1.ConflictException({
                code: 'BUDGET_BLOCKED',
                stage: 'POST',
                message: 'Posting blocked: one or more journal lines exceed available budget.',
                budgetFlags: budgetImpact.budgetFlags,
            });
        }
        const accountsForRisk = await this.prisma.account.findMany({
            where: {
                tenantId: authz.tenantId,
                id: { in: [...new Set(entry.lines.map((l) => l.accountId))] },
            },
            select: { id: true, code: true },
        });
        const accountCodeById = new Map(accountsForRisk.map((a) => [a.id, a.code]));
        const postRisk = this.computeJournalRisk({
            journal: {
                id: entry.id,
                journalType: entry.journalType ?? null,
                journalDate: new Date(entry.journalDate),
                createdAt: new Date(entry.createdAt),
                correctsJournalId: entry.correctsJournalId ?? null,
                reversalOfId: entry.reversalOfId ?? null,
                reference: entry.reference ?? null,
                returnReason: entry.returnReason ?? null,
            },
            lines: (entry.lines ?? []).map((l) => ({
                debit: l.debit,
                credit: l.credit,
                account: { code: accountCodeById.get(l.accountId) ?? null },
            })),
            stage: 'POST',
            computedAt: now,
            postingPeriod: period ? { endDate: period.endDate } : null,
            budget: budgetImpact.budgetStatus === 'WARN'
                ? {
                    budgetStatus: 'WARN',
                    warnRepeatUpliftPoints: (await this.getBudgetRepeatWarnUplift({
                        tenantId: authz.tenantId,
                        createdById: entry.createdById,
                        excludeJournalId: entry.id,
                        now,
                    })).points,
                }
                : { budgetStatus: budgetImpact.budgetStatus },
        });
        const updated = await this.prisma.$transaction(async (tx) => {
            const counter = await tx.tenantSequenceCounter.upsert({
                where: {
                    tenantId_name: {
                        tenantId: authz.tenantId,
                        name: this.JOURNAL_NUMBER_SEQUENCE_NAME,
                    },
                },
                create: {
                    tenantId: authz.tenantId,
                    name: this.JOURNAL_NUMBER_SEQUENCE_NAME,
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
            return tx.journalEntry.update({
                where: { id: entry.id },
                data: {
                    status: 'POSTED',
                    postedById: authz.id,
                    postedAt: now,
                    periodId: period.id,
                    journalNumber: bumped.value,
                    riskScore: postRisk.score,
                    riskFlags: postRisk.flags,
                    riskComputedAt: now,
                },
                include: { lines: true },
            });
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: authz.tenantId,
                eventType: 'GL_JOURNAL_RISK_COMPUTED',
                entityType: 'JOURNAL_ENTRY',
                entityId: entry.id,
                action: 'FINANCE_GL_FINAL_POST',
                outcome: 'SUCCESS',
                reason: JSON.stringify({
                    journalId: entry.id,
                    riskScore: postRisk.score,
                    riskFlags: postRisk.flags,
                    computedAt: now.toISOString(),
                    lifecycleStage: 'POST',
                }),
                userId: authz.id,
                permissionUsed: 'FINANCE_GL_FINAL_POST',
            },
        })
            .catch(() => undefined);
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: authz.tenantId,
                eventType: 'GL_JOURNAL_POSTED',
                entityType: 'JOURNAL_ENTRY',
                entityId: entry.id,
                action: 'FINANCE_GL_FINAL_POST',
                outcome: 'SUCCESS',
                reason: JSON.stringify({
                    journalId: entry.id,
                    postedById: authz.id,
                    postedAt: now.toISOString(),
                    periodId: period.id,
                }),
                userId: authz.id,
                permissionUsed: 'FINANCE_GL_FINAL_POST',
            },
        })
            .catch(() => undefined);
        if (isReversal) {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: authz.tenantId,
                    eventType: 'GL_JOURNAL_REVERSAL_POSTED',
                    entityType: 'JOURNAL_ENTRY',
                    entityId: entry.id,
                    action: 'FINANCE_GL_FINAL_POST',
                    outcome: 'SUCCESS',
                    reason: JSON.stringify({
                        reversalJournalId: entry.id,
                        reversalOfId: entry.reversalOfId ?? null,
                        postedById: authz.id,
                        postedAt: now.toISOString(),
                        periodId: period.id,
                    }),
                    userId: authz.id,
                    permissionUsed: 'FINANCE_GL_FINAL_POST',
                },
            })
                .catch(() => undefined);
        }
        this.cache.clearTenant(authz.tenantId);
        return updated;
    }
    async getOpeningBalances(req, dto) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const cutoverDate = this.parseCutoverDate(dto.cutoverDate);
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                name: this.OPENING_PERIOD_NAME,
                startDate: cutoverDate,
                endDate: cutoverDate,
            },
            select: {
                id: true,
                status: true,
                name: true,
                startDate: true,
                endDate: true,
            },
        });
        const journal = await this.prisma.journalEntry.findFirst({
            where: {
                tenantId: tenant.id,
                journalDate: cutoverDate,
                reference: { startsWith: this.OPENING_REF_PREFIX },
            },
            include: { lines: true },
            orderBy: { createdAt: 'desc' },
        });
        const cutoverLocked = !!(period && period.status === 'CLOSED');
        return {
            cutoverDate: dto.cutoverDate,
            openingPeriod: period,
            journal,
            cutoverLocked,
        };
    }
    async upsertOpeningBalances(req, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const cutoverDate = this.parseCutoverDate(dto.cutoverDate);
        const existingPeriod = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                name: this.OPENING_PERIOD_NAME,
                startDate: cutoverDate,
                endDate: cutoverDate,
            },
            select: { id: true, status: true },
        });
        if (existingPeriod?.status === 'CLOSED') {
            throw new common_1.ForbiddenException('Opening balances period is CLOSED; opening balances are locked');
        }
        let period = existingPeriod;
        if (!period) {
            try {
                period = await this.prisma.accountingPeriod.create({
                    data: {
                        tenantId: tenant.id,
                        name: this.OPENING_PERIOD_NAME,
                        startDate: cutoverDate,
                        endDate: cutoverDate,
                    },
                    select: { id: true, status: true },
                });
            }
            catch (e) {
                if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                    e.code === 'P2002') {
                    throw new common_1.BadRequestException({
                        error: 'Opening Balances period already exists for this tenant',
                        reason: 'This tenant can only have one Opening Balances period (schema constraint). Use the existing cutoverDate or create a new tenant for a fresh demo.',
                    });
                }
                throw e;
            }
        }
        const existingJournal = await this.prisma.journalEntry.findFirst({
            where: {
                tenantId: tenant.id,
                journalDate: cutoverDate,
                reference: { startsWith: this.OPENING_REF_PREFIX },
            },
            include: { lines: true },
            orderBy: { createdAt: 'desc' },
        });
        if (existingJournal?.status === 'POSTED') {
            throw new common_1.ForbiddenException('Opening balance journal is already POSTED and cannot be edited');
        }
        const lines = dto.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
        }));
        this.assertLinesBasicValid(lines);
        this.assertBalanced(lines);
        await this.assertOpeningBalanceAccountsAllowed({
            tenantId: tenant.id,
            lines: dto.lines,
        });
        const reference = `${this.OPENING_REF_PREFIX}${dto.cutoverDate}`;
        const description = `${this.OPENING_DESC_PREFIX}${dto.cutoverDate}`;
        if (!existingJournal) {
            const created = await this.prisma.journalEntry.create({
                data: {
                    tenantId: tenant.id,
                    journalDate: cutoverDate,
                    reference,
                    description,
                    createdById: user.id,
                    lines: {
                        create: dto.lines.map((l) => ({
                            accountId: l.accountId,
                            debit: l.debit,
                            credit: l.credit,
                        })),
                    },
                },
                include: { lines: true },
            });
            return { openingPeriod: period, journal: created };
        }
        const updated = await this.prisma.journalEntry.update({
            where: { id: existingJournal.id },
            data: {
                reference,
                description,
                lines: {
                    deleteMany: { journalEntryId: existingJournal.id },
                    create: dto.lines.map((l) => ({
                        accountId: l.accountId,
                        debit: l.debit,
                        credit: l.credit,
                    })),
                },
            },
            include: { lines: true },
        });
        return { openingPeriod: period, journal: updated };
    }
    async postOpeningBalances(req, dto) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_FINAL_POST');
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const cutoverDate = this.parseCutoverDate(dto.cutoverDate);
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                name: this.OPENING_PERIOD_NAME,
                startDate: cutoverDate,
                endDate: cutoverDate,
            },
            select: { id: true, status: true },
        });
        if (!period) {
            throw new common_1.BadRequestException('Opening Balances accounting period does not exist for cutoverDate');
        }
        if (period.status !== 'OPEN') {
            throw new common_1.ForbiddenException('Opening Balances accounting period is not OPEN');
        }
        const journal = await this.prisma.journalEntry.findFirst({
            where: {
                tenantId: tenant.id,
                journalDate: cutoverDate,
                reference: { startsWith: this.OPENING_REF_PREFIX },
            },
            include: { lines: true },
            orderBy: { createdAt: 'desc' },
        });
        if (!journal) {
            throw new common_1.BadRequestException('No opening balance journal exists for cutoverDate');
        }
        if (journal.status === 'POSTED') {
            throw new common_1.BadRequestException('Opening balance journal is already POSTED');
        }
        if (journal.createdById === user.id) {
            await this.prisma.soDViolationLog.create({
                data: {
                    tenantId: tenant.id,
                    userId: user.id,
                    permissionAttempted: 'FINANCE_GL_FINAL_POST',
                    conflictingPermission: 'FINANCE_GL_CREATE',
                },
            });
            throw new common_1.ForbiddenException({
                error: 'Action blocked by Segregation of Duties (SoD)',
                reason: 'Maker cannot post own opening balance journal',
            });
        }
        this.assertBalanced(journal.lines.map((l) => ({
            debit: Number(l.debit),
            credit: Number(l.credit),
        })));
        await this.assertOpeningBalanceAccountsAllowed({
            tenantId: tenant.id,
            lines: journal.lines.map((l) => ({
                accountId: l.accountId,
                debit: Number(l.debit),
                credit: Number(l.credit),
            })),
        });
        const posted = await this.prisma.journalEntry.update({
            where: { id: journal.id },
            data: {
                status: 'POSTED',
                postedById: user.id,
                postedAt: new Date(),
            },
            include: { lines: true },
        });
        await this.prisma.accountingPeriod.update({
            where: { id: period.id },
            data: {
                status: 'CLOSED',
                closedById: user.id,
                closedAt: new Date(),
            },
        });
        this.cache.clearTenant(tenant.id);
        return { journal: posted, openingPeriodClosed: true };
    }
    async listJournals(req, paramsOrLimit, offsetLegacy, statusLegacy) {
        const authz = await this.getUserAuthz(req);
        (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_VIEW');
        const params = typeof paramsOrLimit === 'number'
            ? { limit: paramsOrLimit, offset: offsetLegacy, status: statusLegacy }
            : (paramsOrLimit ?? {});
        const limit = params.limit ?? 50;
        const offset = params.offset ?? 0;
        if (limit < 1 || limit > 200) {
            throw new common_1.BadRequestException('Invalid limit. Limit must be between 1 and 200.');
        }
        if (offset < 0) {
            throw new common_1.BadRequestException('Invalid offset. Offset must be greater than or equal to 0.');
        }
        const drilldown = Boolean(params.drilldown);
        const workbench = Boolean(params.workbench);
        const budgetStatus = params.budgetStatus;
        if (workbench) {
            (0, finance_authz_helpers_1.requirePermission)(authz, 'FINANCE_GL_CREATE');
            const where = {
                tenantId: authz.tenantId,
                createdById: authz.id,
                status: { in: ['DRAFT', 'REJECTED'] },
                ...(budgetStatus ? { budgetStatus } : {}),
            };
            const [items, total] = await Promise.all([
                this.prisma.journalEntry.findMany({
                    where,
                    orderBy: [{ createdAt: 'desc' }],
                    take: limit,
                    skip: offset,
                    select: {
                        id: true,
                        reference: true,
                        journalDate: true,
                        description: true,
                        riskScore: true,
                        riskFlags: true,
                        budgetStatus: true,
                        status: true,
                        createdAt: true,
                        createdBy: { select: { id: true, name: true } },
                        reviewedBy: { select: { id: true, name: true } },
                        postedBy: { select: { id: true, name: true } },
                        lines: { select: { debit: true, credit: true } },
                    },
                }),
                this.prisma.journalEntry.count({ where }),
            ]);
            const toNum = (v) => {
                if (v === null || v === undefined)
                    return 0;
                if (typeof v === 'number')
                    return Number.isFinite(v) ? v : 0;
                const n = Number(v);
                return Number.isFinite(n) ? n : 0;
            };
            const summaryItems = (items ?? []).map((j) => {
                const lines = Array.isArray(j.lines) ? j.lines : [];
                const totalDebit = Math.round(lines.reduce((sum, l) => sum + toNum(l.debit), 0) *
                    100) / 100;
                const totalCredit = Math.round(lines.reduce((sum, l) => sum + toNum(l.credit), 0) *
                    100) / 100;
                return {
                    id: j.id,
                    reference: j.reference,
                    journalDate: j.journalDate,
                    description: j.description,
                    totalDebit,
                    totalCredit,
                    riskScore: j.riskScore,
                    riskFlags: j.riskFlags,
                    budgetStatus: j.budgetStatus ?? 'OK',
                    status: j.status,
                    createdBy: j.createdBy
                        ? { id: j.createdBy.id, name: j.createdBy.name }
                        : null,
                    reviewedBy: j.reviewedBy
                        ? { id: j.reviewedBy.id, name: j.reviewedBy.name }
                        : null,
                    postedBy: j.postedBy
                        ? { id: j.postedBy.id, name: j.postedBy.name }
                        : null,
                };
            });
            return {
                items: summaryItems,
                total,
                limit,
                offset,
            };
        }
        const status = params.status;
        const scopedStatus = drilldown
            ? status === 'REVIEWED' || status === 'POSTED'
                ? status
                : undefined
            : status;
        const periodId = (params.periodId ?? '').trim();
        const accountId = (params.accountId ?? '').trim();
        const legalEntityId = (params.legalEntityId ?? '').trim();
        const departmentId = (params.departmentId ?? '').trim();
        const projectId = (params.projectId ?? '').trim();
        const fundId = (params.fundId ?? '').trim();
        const createdById = (params.createdById ?? '').trim();
        const reviewedById = (params.reviewedById ?? '').trim();
        const postedById = (params.postedById ?? '').trim();
        const from = this.parseOptionalYmd(params.fromDate);
        const to = this.parseOptionalYmd(params.toDate);
        const riskLevel = params.riskLevel;
        const minRiskScore = typeof params.minRiskScore === 'number' &&
            Number.isFinite(params.minRiskScore)
            ? params.minRiskScore
            : undefined;
        const maxRiskScore = typeof params.maxRiskScore === 'number' &&
            Number.isFinite(params.maxRiskScore)
            ? params.maxRiskScore
            : undefined;
        const riskRange = (() => {
            if (riskLevel === 'LOW')
                return { gte: 0, lt: 20 };
            if (riskLevel === 'MEDIUM')
                return { gte: 20, lt: 40 };
            if (riskLevel === 'HIGH')
                return { gte: 40 };
            return null;
        })();
        const needsRiskScore = Boolean(riskLevel || minRiskScore !== undefined || maxRiskScore !== undefined);
        const where = {
            tenantId: authz.tenantId,
            ...(scopedStatus
                ? { status: scopedStatus }
                : drilldown
                    ? { status: { in: ['REVIEWED', 'POSTED'] } }
                    : {}),
            ...(periodId ? { periodId } : {}),
            ...(from ? { journalDate: { gte: from } } : {}),
            ...(to
                ? { journalDate: { ...(from ? { gte: from } : {}), lte: to } }
                : {}),
            ...(createdById ? { createdById } : {}),
            ...(reviewedById ? { reviewedById } : {}),
            ...(postedById ? { postedById } : {}),
            ...(needsRiskScore ? { riskScore: { not: null } } : {}),
            ...(budgetStatus ? { budgetStatus } : {}),
        };
        if (needsRiskScore) {
            where.riskScore = {
                ...(where.riskScore ?? {}),
                ...(riskRange ? riskRange : {}),
                ...(minRiskScore !== undefined ? { gte: minRiskScore } : {}),
                ...(maxRiskScore !== undefined ? { lte: maxRiskScore } : {}),
            };
        }
        const lineFilters = [];
        if (accountId)
            lineFilters.push({ accountId });
        if (legalEntityId)
            lineFilters.push({ legalEntityId });
        if (departmentId)
            lineFilters.push({ departmentId });
        if (projectId)
            lineFilters.push({ projectId });
        if (fundId)
            lineFilters.push({ fundId });
        if (lineFilters.length) {
            where.lines = { some: { AND: lineFilters } };
        }
        const [items, total] = await Promise.all([
            this.prisma.journalEntry.findMany({
                where,
                orderBy: [{ journalDate: 'desc' }, { createdAt: 'desc' }],
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    reference: true,
                    journalDate: true,
                    description: true,
                    riskScore: true,
                    riskFlags: true,
                    budgetStatus: true,
                    status: true,
                    createdAt: true,
                    createdBy: { select: { id: true, name: true } },
                    reviewedBy: { select: { id: true, name: true } },
                    postedBy: { select: { id: true, name: true } },
                    lines: { select: { debit: true, credit: true } },
                },
            }),
            this.prisma.journalEntry.count({ where }),
        ]);
        const toNum = (v) => {
            if (v === null || v === undefined)
                return 0;
            if (typeof v === 'number')
                return Number.isFinite(v) ? v : 0;
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        };
        const summaryItems = (items ?? []).map((j) => {
            const lines = Array.isArray(j.lines) ? j.lines : [];
            const totalDebit = Math.round(lines.reduce((sum, l) => sum + toNum(l.debit), 0) * 100) / 100;
            const totalCredit = Math.round(lines.reduce((sum, l) => sum + toNum(l.credit), 0) * 100) / 100;
            return {
                id: j.id,
                reference: j.reference,
                journalDate: j.journalDate,
                description: j.description,
                totalDebit,
                totalCredit,
                riskScore: j.riskScore,
                riskFlags: j.riskFlags,
                budgetStatus: j.budgetStatus ?? 'OK',
                status: j.status,
                createdBy: j.createdBy
                    ? { id: j.createdBy.id, name: j.createdBy.name }
                    : null,
                reviewedBy: j.reviewedBy
                    ? { id: j.reviewedBy.id, name: j.reviewedBy.name }
                    : null,
                postedBy: j.postedBy
                    ? { id: j.postedBy.id, name: j.postedBy.name }
                    : null,
            };
        });
        return {
            items: summaryItems,
            total,
            limit,
            offset,
        };
    }
    assertLinesBasicValid(lines) {
        if (!lines || lines.length < 2) {
            throw new common_1.BadRequestException('Journal must have at least 2 lines');
        }
        for (const l of lines) {
            if ((l.debit ?? 0) < 0 || (l.credit ?? 0) < 0) {
                throw new common_1.BadRequestException('Debit/credit cannot be negative');
            }
            const hasDebit = (l.debit ?? 0) > 0;
            const hasCredit = (l.credit ?? 0) > 0;
            if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
                throw new common_1.BadRequestException('Each line must have either a debit or a credit amount');
            }
        }
    }
    assertBalanced(lines) {
        const round2 = (n) => Math.round(n * 100) / 100;
        const totalDebit = round2(lines.reduce((sum, l) => sum + (l.debit ?? 0), 0));
        const totalCredit = round2(lines.reduce((sum, l) => sum + (l.credit ?? 0), 0));
        if (totalDebit !== totalCredit) {
            throw new common_1.BadRequestException({
                error: 'Journal is not balanced',
                totalDebit,
                totalCredit,
            });
        }
        if (totalDebit <= 0) {
            throw new common_1.BadRequestException('Journal total must be greater than zero');
        }
    }
    parseCutoverDate(iso) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) {
            throw new common_1.BadRequestException('Invalid cutoverDate');
        }
        const yyyyMmDd = iso.slice(0, 10);
        const normalized = new Date(`${yyyyMmDd}T00:00:00.000Z`);
        if (Number.isNaN(normalized.getTime())) {
            throw new common_1.BadRequestException('Invalid cutoverDate');
        }
        return normalized;
    }
    isOpeningBalanceJournal(reference, description) {
        return ((reference ?? '').startsWith(this.OPENING_REF_PREFIX) ||
            (description ?? '').startsWith(this.OPENING_DESC_PREFIX));
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
    async assertOpeningBalanceAccountsAllowed(params) {
        const accountIds = [...new Set(params.lines.map((l) => l.accountId))];
        const accounts = await this.prisma.account.findMany({
            where: { tenantId: params.tenantId, id: { in: accountIds } },
            select: {
                id: true,
                code: true,
                type: true,
                isActive: true,
                isPosting: true,
            },
        });
        const byId = new Map(accounts.map((a) => [a.id, a]));
        for (const id of accountIds) {
            const a = byId.get(id);
            if (!a) {
                throw new common_1.BadRequestException(`Account not found: ${id}`);
            }
            if (!a.isActive) {
                throw new common_1.BadRequestException(`Account is inactive: ${id}`);
            }
            if (!a.isPosting) {
                throw new common_1.BadRequestException(`Account is non-posting and cannot be used in journals: ${id}`);
            }
            const isRetainedEarnings = a.code === 'RETAINED_EARNINGS';
            const isBalanceSheet = a.type === 'ASSET' || a.type === 'LIABILITY' || a.type === 'EQUITY';
            if (!isBalanceSheet && !isRetainedEarnings) {
                throw new common_1.BadRequestException({
                    error: 'Opening balance journal contains invalid account type',
                    accountId: a.id,
                    accountType: a.type,
                    accountCode: a.code,
                    reason: 'Only balance sheet accounts and retained earnings are allowed',
                });
            }
        }
    }
};
exports.GlService = GlService;
exports.GlService = GlService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService])
], GlService);
//# sourceMappingURL=gl.service.js.map