import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';
import { CreateJournalDto } from './dto/create-journal.dto';
import { CreateRecurringTemplateDto } from './dto/create-recurring-template.dto';
import { GenerateRecurringTemplateDto } from './dto/generate-recurring-template.dto';
import { OpeningBalancesQueryDto } from './dto/opening-balances-query.dto';
import { ReturnToReviewDto } from './dto/return-to-review.dto';
import { ReverseJournalDto } from './dto/reverse-journal.dto';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';
import { UpdateRecurringTemplateDto } from './dto/update-recurring-template.dto';
import { UpsertOpeningBalancesJournalDto } from './dto/upsert-opening-balances-journal.dto';
export declare enum DepartmentRequirement {
    REQUIRED = "REQUIRED",
    OPTIONAL = "OPTIONAL",
    FORBIDDEN = "FORBIDDEN"
}
export declare class GlService {
    private readonly prisma;
    private readonly cache;
    constructor(prisma: PrismaService, cache: CacheService);
    private parseOptionalYmd;
    private riskBandFromScore;
    private toNum;
    private round2;
    private startOfUtcDay;
    private addUtcDays;
    private resolveOpenPeriodForDate;
    private computeJournalBudgetImpact;
    private persistJournalBudgetImpact;
    private auditJournalBudgetEvaluated;
    private getBudgetRepeatWarnUplift;
    private buildJournalRiskWhereSql;
    private buildLineDimensionWhereSql;
    getJournalRiskOverview(req: Request, filters: {
        periodId?: string;
        dateFrom?: string;
        dateTo?: string;
        legalEntityId?: string;
        departmentId?: string;
        projectId?: string;
        fundId?: string;
    }): Promise<{
        total: number;
        avgRiskScore: number;
        highRiskPct: number;
        distribution: {
            LOW: number;
            MEDIUM: number;
            HIGH: number;
        };
    }>;
    getJournalRiskUsers(req: Request, filters: {
        periodId?: string;
        dateFrom?: string;
        dateTo?: string;
    }): Promise<{
        user: {
            id: string;
            email: string | null;
            name: string | null;
        };
        totals: {
            journals: number;
            avgRiskScore: number;
            byBand: {
                LOW: number;
                MEDIUM: number;
                HIGH: number;
            };
        };
        flaggedCounts: {
            late_posting: number;
            reversal: number;
            override: number;
            high_value: number;
            unusual_account: number;
        };
    }[]>;
    getJournalRiskAccounts(req: Request, filters: {
        periodId?: string;
        dateFrom?: string;
        dateTo?: string;
        legalEntityId?: string;
        departmentId?: string;
        projectId?: string;
        fundId?: string;
    }): Promise<{
        account: {
            id: string;
            code: string;
            name: string;
        };
        journalCount: number;
        avgRiskScore: number;
        highRiskPct: number;
        topRiskFlags: string[];
    }[]>;
    getJournalRiskOrganisation(req: Request, filters: {
        periodId?: string;
        dateFrom?: string;
        dateTo?: string;
    }): Promise<{
        legalEntities: {
            dimension: {
                id: string;
                code: any;
                name: any;
            };
            journalCount: number;
            avgRiskScore: number;
            highRiskCount: number;
        }[];
        departments: {
            dimension: {
                id: string;
                code: any;
                name: any;
            };
            journalCount: number;
            avgRiskScore: number;
            highRiskCount: number;
        }[];
        projects: {
            dimension: {
                id: string;
                code: any;
                name: any;
            };
            journalCount: number;
            avgRiskScore: number;
            highRiskCount: number;
        }[];
        funds: {
            dimension: {
                id: string;
                code: any;
                name: any;
            };
            journalCount: number;
            avgRiskScore: number;
            highRiskCount: number;
        }[];
    }>;
    getJournalRiskPeriods(req: Request, filters: {
        periodId?: string;
        dateFrom?: string;
        dateTo?: string;
    }): Promise<{
        period: {
            id: string;
            name: string | null;
            startDate: string | null;
            endDate: string | null;
        } | null;
        journalCount: number;
        avgRiskScore: number;
        reversalCount: number;
        highRiskCount: number;
        topRiskFlags: string[];
    }[]>;
    private readonly JOURNAL_RISK_HIGH_VALUE_THRESHOLD;
    private readonly JOURNAL_RISK_MANUAL_JOURNAL_POINTS;
    private readonly JOURNAL_RISK_HIGH_VALUE_POINTS;
    private readonly JOURNAL_RISK_BACKDATED_POINTS;
    private readonly JOURNAL_RISK_LATE_POSTING_POINTS;
    private readonly JOURNAL_RISK_REVERSAL_POINTS;
    private readonly JOURNAL_RISK_CORRECTING_POINTS;
    private readonly JOURNAL_RISK_SENSITIVE_ACCOUNT_POINTS;
    private readonly JOURNAL_RISK_OVERRIDE_USED_POINTS;
    private readonly JOURNAL_RISK_SENSITIVE_ACCOUNT_CODES;
    private computeJournalRisk;
    private persistJournalRisk;
    private getDepartmentRequirement;
    private getDepartmentRequirementMessage;
    listLegalEntities(req: Request, params?: {
        effectiveOn?: string;
    }): Promise<{
        id: string;
        name: string;
        code: string;
        isActive: boolean;
        effectiveFrom: Date;
        effectiveTo: Date | null;
    }[]>;
    listDepartments(req: Request, params?: {
        effectiveOn?: string;
    }): Promise<{
        id: string;
        name: string;
        code: string;
        isActive: boolean;
        effectiveFrom: Date;
        effectiveTo: Date | null;
    }[]>;
    private getUserAuthz;
    private formatRecurringPlaceholders;
    private computeNextRunDate;
    createRecurringTemplate(req: Request, dto: CreateRecurringTemplateDto): Promise<{
        lines: {
            id: string;
            accountId: string;
            templateId: string;
            descriptionTemplate: string | null;
            debitAmount: Prisma.Decimal;
            creditAmount: Prisma.Decimal;
            lineOrder: number;
        }[];
    } & {
        id: string;
        tenantId: string;
        name: string;
        createdAt: Date;
        isActive: boolean;
        createdById: string;
        journalType: import("@prisma/client").$Enums.JournalType;
        startDate: Date;
        endDate: Date | null;
        descriptionTemplate: string | null;
        referenceTemplate: string;
        frequency: import("@prisma/client").$Enums.RecurringJournalFrequency;
        nextRunDate: Date;
    }>;
    uploadJournals(req: Request, file?: any): Promise<{
        fileName: string;
        journalsCreated: number;
        items: {
            journalKey: string;
            journalId: string;
        }[];
    }>;
    getJournalUploadCsvTemplate(req: Request): Promise<{
        fileName: string;
        body: string;
    }>;
    getJournalUploadXlsxTemplate(req: Request): Promise<{
        fileName: string;
        body: Buffer;
    }>;
    listRecurringTemplates(req: Request): Promise<({
        lines: {
            id: string;
            accountId: string;
            templateId: string;
            descriptionTemplate: string | null;
            debitAmount: Prisma.Decimal;
            creditAmount: Prisma.Decimal;
            lineOrder: number;
        }[];
    } & {
        id: string;
        tenantId: string;
        name: string;
        createdAt: Date;
        isActive: boolean;
        createdById: string;
        journalType: import("@prisma/client").$Enums.JournalType;
        startDate: Date;
        endDate: Date | null;
        descriptionTemplate: string | null;
        referenceTemplate: string;
        frequency: import("@prisma/client").$Enums.RecurringJournalFrequency;
        nextRunDate: Date;
    })[]>;
    updateRecurringTemplate(req: Request, id: string, dto: UpdateRecurringTemplateDto): Promise<{
        lines: {
            id: string;
            accountId: string;
            templateId: string;
            descriptionTemplate: string | null;
            debitAmount: Prisma.Decimal;
            creditAmount: Prisma.Decimal;
            lineOrder: number;
        }[];
    } & {
        id: string;
        tenantId: string;
        name: string;
        createdAt: Date;
        isActive: boolean;
        createdById: string;
        journalType: import("@prisma/client").$Enums.JournalType;
        startDate: Date;
        endDate: Date | null;
        descriptionTemplate: string | null;
        referenceTemplate: string;
        frequency: import("@prisma/client").$Enums.RecurringJournalFrequency;
        nextRunDate: Date;
    }>;
    generateJournalFromRecurringTemplate(req: Request, id: string, dto: GenerateRecurringTemplateDto): Promise<{
        lines: {
            id: string;
            description: string | null;
            accountId: string;
            lineNumber: number | null;
            debit: Prisma.Decimal;
            credit: Prisma.Decimal;
            legalEntityId: string | null;
            departmentId: string | null;
            projectId: string | null;
            fundId: string | null;
            journalEntryId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.JournalStatus;
        createdAt: Date;
        description: string | null;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        journalNumber: number | null;
        journalType: import("@prisma/client").$Enums.JournalType;
        periodId: string | null;
        reference: string | null;
        journalDate: Date;
        correctsJournalId: string | null;
        riskScore: number;
        riskFlags: Prisma.JsonValue;
        riskComputedAt: Date | null;
        budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
        budgetFlags: Prisma.JsonValue | null;
        budgetCheckedAt: Date | null;
        budgetOverrideJustification: string | null;
        reversalInitiatedById: string | null;
        reversalInitiatedAt: Date | null;
        reversalPreparedById: string | null;
        submittedById: string | null;
        submittedAt: Date | null;
        reviewedById: string | null;
        reviewedAt: Date | null;
        rejectedById: string | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        returnedByPosterId: string | null;
        returnedByPosterAt: Date | null;
        returnReason: string | null;
        reversalOfId: string | null;
        reversalReason: string | null;
    }>;
    getRecurringTemplateHistory(req: Request, id: string): Promise<{
        id: string;
        createdAt: Date;
        generatedBy: {
            id: string;
            email: string;
            name: string;
        };
        runDate: Date;
        generatedJournal: {
            id: string;
            status: import("@prisma/client").$Enums.JournalStatus;
            description: string | null;
            journalNumber: number | null;
            reference: string | null;
            journalDate: Date;
        };
    }[]>;
    listJournalReviewQueue(req: Request): Promise<any>;
    listJournalPostQueue(req: Request): Promise<any>;
    private readonly OPENING_PERIOD_NAME;
    private readonly OPENING_REF_PREFIX;
    private readonly OPENING_DESC_PREFIX;
    private readonly DEFAULT_PERIOD_CLOSE_CHECKLIST_ITEMS;
    private readonly JOURNAL_NUMBER_SEQUENCE_NAME;
    private ensureMinimalBalanceSheetCoaForTenant;
    createAccount(req: Request, dto: CreateAccountDto): Promise<{
        id: string;
        tenantId: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        isActive: boolean;
        type: import("@prisma/client").$Enums.AccountType;
        subCategory: string | null;
        fsMappingLevel1: string | null;
        fsMappingLevel2: string | null;
        isCashEquivalent: boolean;
        requiresDepartment: boolean;
        requiresProject: boolean;
        requiresFund: boolean;
        isBudgetRelevant: boolean;
        budgetControlMode: import("@prisma/client").$Enums.BudgetControlMode;
        parentAccountId: string | null;
        isPosting: boolean;
        isPostingAllowed: boolean;
        isControlAccount: boolean;
        normalBalance: import("@prisma/client").$Enums.NormalBalance;
        hierarchyPath: string | null;
        isFrozen: boolean;
        ifrsMappingCode: string | null;
        createdById: string | null;
    }>;
    listAccounts(req: Request, options?: {
        balanceSheetOnly?: boolean;
    }): Promise<{
        id: string;
        code: string;
        name: string;
        type: import("@prisma/client").$Enums.AccountType;
        isActive: boolean;
        requiresDepartment: any;
        requiresProject: boolean;
        requiresFund: boolean;
        departmentRequirement: DepartmentRequirement;
    }[]>;
    createAccountingPeriod(req: Request, dto: CreateAccountingPeriodDto): Promise<{
        id: string;
        tenantId: string;
        name: string;
        status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        createdAt: Date;
        startDate: Date;
        endDate: Date;
        closedById: string | null;
        closedAt: Date | null;
    }>;
    getAccountingPeriodChecklist(req: Request, periodId: string): Promise<{
        period: {
            id: string;
            name: string;
            status: import("@prisma/client").$Enums.AccountingPeriodStatus;
            startDate: Date;
            endDate: Date;
            closedAt: Date | null;
            closedBy: {
                id: string;
                email: string;
            } | null;
        };
        items: {
            id: string;
            createdAt: Date;
            code: string;
            label: string;
            completed: boolean;
            completedAt: Date | null;
            completedBy: {
                id: string;
                email: string;
            } | null;
        }[];
    }>;
    completeAccountingPeriodChecklistItem(req: Request, params: {
        periodId: string;
        itemId: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        code: string;
        label: string;
        completed: boolean;
        completedAt: Date | null;
        completedBy: {
            id: string;
            email: string;
        } | null;
    }>;
    listAccountingPeriods(req: Request): Promise<{
        id: string;
        tenantId: string;
        name: string;
        status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        createdAt: Date;
        startDate: Date;
        endDate: Date;
        closedById: string | null;
        closedAt: Date | null;
    }[]>;
    listProjects(req: Request, params?: {
        effectiveOn?: string;
    }): Promise<{
        id: string;
        name: string;
        code: string;
        isRestricted: boolean;
    }[]>;
    listFunds(req: Request, params?: {
        effectiveOn?: string;
        projectId?: string;
    }): Promise<{
        id: string;
        name: string;
        code: string;
        projectId: string;
    }[]>;
    closeAccountingPeriod(req: Request, id: string): Promise<{
        id: string;
        tenantId: string;
        name: string;
        status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        createdAt: Date;
        startDate: Date;
        endDate: Date;
        closedById: string | null;
        closedAt: Date | null;
    }>;
    getAccountingPeriodSummary(req: Request, id: string): Promise<{
        period: {
            id: string;
            name: string;
            status: import("@prisma/client").$Enums.AccountingPeriodStatus;
            startDate: Date;
            endDate: Date;
        };
        journals: {
            countsByStatus: Record<"DRAFT" | "POSTED" | "PARKED", number>;
            totals: {
                totalDebit: number;
                totalCredit: number;
            };
        };
    }>;
    reopenAccountingPeriod(req: Request, id: string, dto: {
        reason?: string;
    }): Promise<{
        id: string;
        tenantId: string;
        name: string;
        status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        createdAt: Date;
        startDate: Date;
        endDate: Date;
        closedById: string | null;
        closedAt: Date | null;
    }>;
    trialBalance(req: Request, dto: TrialBalanceQueryDto): Promise<{
        from: string;
        to: string;
        totals: {
            totalDebit: number;
            totalCredit: number;
            net: number;
        };
        rows: {
            accountId: string;
            accountCode: string;
            accountName: string;
            accountType: string;
            normalBalance: import("@prisma/client").$Enums.NormalBalance;
            totalDebit: number;
            totalCredit: number;
            net: number;
        }[];
    }>;
    ledger(req: Request, dto: LedgerQueryDto): Promise<{
        account: {
            id: string;
            name: string;
            code: string;
            type: import("@prisma/client").$Enums.AccountType;
            normalBalance: import("@prisma/client").$Enums.NormalBalance;
        };
        period: {
            fromDate: string;
            toDate: string;
        };
        openingBalance: number;
        rows: {
            journalEntryId: string;
            journalNumber: number | null;
            journalDate: Date;
            reference: string | null;
            description: string | null;
            debit: number;
            credit: number;
            runningBalance: number;
        }[];
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    }>;
    getJournalDetail(req: Request, id: string): Promise<{
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.JournalStatus;
        createdAt: Date;
        description: string | null;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        journalNumber: number | null;
        journalType: import("@prisma/client").$Enums.JournalType;
        periodId: string | null;
        reference: string | null;
        journalDate: Date;
        correctsJournalId: string | null;
        riskScore: number;
        riskFlags: Prisma.JsonValue;
        riskComputedAt: Date | null;
        budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
        budgetFlags: Prisma.JsonValue | null;
        budgetCheckedAt: Date | null;
        budgetOverrideJustification: string | null;
        reversalInitiatedById: string | null;
        reversalInitiatedAt: Date | null;
        reversalPreparedById: string | null;
        submittedById: string | null;
        submittedAt: Date | null;
        reviewedById: string | null;
        reviewedAt: Date | null;
        rejectedById: string | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        returnedByPosterId: string | null;
        returnedByPosterAt: Date | null;
        returnReason: string | null;
        reversalOfId: string | null;
        reversalReason: string | null;
    }>;
    returnJournalToReview(req: Request, id: string, dto: ReturnToReviewDto): Promise<{
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.JournalStatus;
        createdAt: Date;
        description: string | null;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        journalNumber: number | null;
        journalType: import("@prisma/client").$Enums.JournalType;
        periodId: string | null;
        reference: string | null;
        journalDate: Date;
        correctsJournalId: string | null;
        riskScore: number;
        riskFlags: Prisma.JsonValue;
        riskComputedAt: Date | null;
        budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
        budgetFlags: Prisma.JsonValue | null;
        budgetCheckedAt: Date | null;
        budgetOverrideJustification: string | null;
        reversalInitiatedById: string | null;
        reversalInitiatedAt: Date | null;
        reversalPreparedById: string | null;
        submittedById: string | null;
        submittedAt: Date | null;
        reviewedById: string | null;
        reviewedAt: Date | null;
        rejectedById: string | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        returnedByPosterId: string | null;
        returnedByPosterAt: Date | null;
        returnReason: string | null;
        reversalOfId: string | null;
        reversalReason: string | null;
    }>;
    createDraftJournal(req: Request, dto: CreateJournalDto): Promise<{
        lines: {
            id: string;
            description: string | null;
            accountId: string;
            lineNumber: number | null;
            debit: Prisma.Decimal;
            credit: Prisma.Decimal;
            legalEntityId: string | null;
            departmentId: string | null;
            projectId: string | null;
            fundId: string | null;
            journalEntryId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.JournalStatus;
        createdAt: Date;
        description: string | null;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        journalNumber: number | null;
        journalType: import("@prisma/client").$Enums.JournalType;
        periodId: string | null;
        reference: string | null;
        journalDate: Date;
        correctsJournalId: string | null;
        riskScore: number;
        riskFlags: Prisma.JsonValue;
        riskComputedAt: Date | null;
        budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
        budgetFlags: Prisma.JsonValue | null;
        budgetCheckedAt: Date | null;
        budgetOverrideJustification: string | null;
        reversalInitiatedById: string | null;
        reversalInitiatedAt: Date | null;
        reversalPreparedById: string | null;
        submittedById: string | null;
        submittedAt: Date | null;
        reviewedById: string | null;
        reviewedAt: Date | null;
        rejectedById: string | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        returnedByPosterId: string | null;
        returnedByPosterAt: Date | null;
        returnReason: string | null;
        reversalOfId: string | null;
        reversalReason: string | null;
    }>;
    getJournal(req: Request, id: string): Promise<{
        lines: {
            id: string;
            description: string | null;
            accountId: string;
            lineNumber: number | null;
            debit: Prisma.Decimal;
            credit: Prisma.Decimal;
            legalEntityId: string | null;
            departmentId: string | null;
            projectId: string | null;
            fundId: string | null;
            journalEntryId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.JournalStatus;
        createdAt: Date;
        description: string | null;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        journalNumber: number | null;
        journalType: import("@prisma/client").$Enums.JournalType;
        periodId: string | null;
        reference: string | null;
        journalDate: Date;
        correctsJournalId: string | null;
        riskScore: number;
        riskFlags: Prisma.JsonValue;
        riskComputedAt: Date | null;
        budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
        budgetFlags: Prisma.JsonValue | null;
        budgetCheckedAt: Date | null;
        budgetOverrideJustification: string | null;
        reversalInitiatedById: string | null;
        reversalInitiatedAt: Date | null;
        reversalPreparedById: string | null;
        submittedById: string | null;
        submittedAt: Date | null;
        reviewedById: string | null;
        reviewedAt: Date | null;
        rejectedById: string | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        returnedByPosterId: string | null;
        returnedByPosterAt: Date | null;
        returnReason: string | null;
        reversalOfId: string | null;
        reversalReason: string | null;
    }>;
    updateDraftJournal(req: Request, id: string, dto: UpdateJournalDto): Promise<{
        lines: {
            id: string;
            description: string | null;
            accountId: string;
            lineNumber: number | null;
            debit: Prisma.Decimal;
            credit: Prisma.Decimal;
            legalEntityId: string | null;
            departmentId: string | null;
            projectId: string | null;
            fundId: string | null;
            journalEntryId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.JournalStatus;
        createdAt: Date;
        description: string | null;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        journalNumber: number | null;
        journalType: import("@prisma/client").$Enums.JournalType;
        periodId: string | null;
        reference: string | null;
        journalDate: Date;
        correctsJournalId: string | null;
        riskScore: number;
        riskFlags: Prisma.JsonValue;
        riskComputedAt: Date | null;
        budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
        budgetFlags: Prisma.JsonValue | null;
        budgetCheckedAt: Date | null;
        budgetOverrideJustification: string | null;
        reversalInitiatedById: string | null;
        reversalInitiatedAt: Date | null;
        reversalPreparedById: string | null;
        submittedById: string | null;
        submittedAt: Date | null;
        reviewedById: string | null;
        reviewedAt: Date | null;
        rejectedById: string | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        returnedByPosterId: string | null;
        returnedByPosterAt: Date | null;
        returnReason: string | null;
        reversalOfId: string | null;
        reversalReason: string | null;
    }>;
    parkJournal(req: Request, id: string): Promise<{
        lines: {
            id: string;
            description: string | null;
            accountId: string;
            lineNumber: number | null;
            debit: Prisma.Decimal;
            credit: Prisma.Decimal;
            legalEntityId: string | null;
            departmentId: string | null;
            projectId: string | null;
            fundId: string | null;
            journalEntryId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.JournalStatus;
        createdAt: Date;
        description: string | null;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        journalNumber: number | null;
        journalType: import("@prisma/client").$Enums.JournalType;
        periodId: string | null;
        reference: string | null;
        journalDate: Date;
        correctsJournalId: string | null;
        riskScore: number;
        riskFlags: Prisma.JsonValue;
        riskComputedAt: Date | null;
        budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
        budgetFlags: Prisma.JsonValue | null;
        budgetCheckedAt: Date | null;
        budgetOverrideJustification: string | null;
        reversalInitiatedById: string | null;
        reversalInitiatedAt: Date | null;
        reversalPreparedById: string | null;
        submittedById: string | null;
        submittedAt: Date | null;
        reviewedById: string | null;
        reviewedAt: Date | null;
        rejectedById: string | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        returnedByPosterId: string | null;
        returnedByPosterAt: Date | null;
        returnReason: string | null;
        reversalOfId: string | null;
        reversalReason: string | null;
    }>;
    submitJournal(req: Request, id: string): Promise<{
        lines: {
            id: string;
            description: string | null;
            accountId: string;
            lineNumber: number | null;
            debit: Prisma.Decimal;
            credit: Prisma.Decimal;
            legalEntityId: string | null;
            departmentId: string | null;
            projectId: string | null;
            fundId: string | null;
            journalEntryId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.JournalStatus;
        createdAt: Date;
        description: string | null;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        journalNumber: number | null;
        journalType: import("@prisma/client").$Enums.JournalType;
        periodId: string | null;
        reference: string | null;
        journalDate: Date;
        correctsJournalId: string | null;
        riskScore: number;
        riskFlags: Prisma.JsonValue;
        riskComputedAt: Date | null;
        budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
        budgetFlags: Prisma.JsonValue | null;
        budgetCheckedAt: Date | null;
        budgetOverrideJustification: string | null;
        reversalInitiatedById: string | null;
        reversalInitiatedAt: Date | null;
        reversalPreparedById: string | null;
        submittedById: string | null;
        submittedAt: Date | null;
        reviewedById: string | null;
        reviewedAt: Date | null;
        rejectedById: string | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        returnedByPosterId: string | null;
        returnedByPosterAt: Date | null;
        returnReason: string | null;
        reversalOfId: string | null;
        reversalReason: string | null;
    }>;
    reviewJournal(req: Request, id: string): Promise<{
        lines: {
            id: string;
            description: string | null;
            accountId: string;
            lineNumber: number | null;
            debit: Prisma.Decimal;
            credit: Prisma.Decimal;
            legalEntityId: string | null;
            departmentId: string | null;
            projectId: string | null;
            fundId: string | null;
            journalEntryId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.JournalStatus;
        createdAt: Date;
        description: string | null;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        journalNumber: number | null;
        journalType: import("@prisma/client").$Enums.JournalType;
        periodId: string | null;
        reference: string | null;
        journalDate: Date;
        correctsJournalId: string | null;
        riskScore: number;
        riskFlags: Prisma.JsonValue;
        riskComputedAt: Date | null;
        budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
        budgetFlags: Prisma.JsonValue | null;
        budgetCheckedAt: Date | null;
        budgetOverrideJustification: string | null;
        reversalInitiatedById: string | null;
        reversalInitiatedAt: Date | null;
        reversalPreparedById: string | null;
        submittedById: string | null;
        submittedAt: Date | null;
        reviewedById: string | null;
        reviewedAt: Date | null;
        rejectedById: string | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        returnedByPosterId: string | null;
        returnedByPosterAt: Date | null;
        returnReason: string | null;
        reversalOfId: string | null;
        reversalReason: string | null;
    }>;
    rejectJournal(req: Request, id: string, dto: {
        reason?: string;
    }): Promise<{
        lines: {
            id: string;
            description: string | null;
            accountId: string;
            lineNumber: number | null;
            debit: Prisma.Decimal;
            credit: Prisma.Decimal;
            legalEntityId: string | null;
            departmentId: string | null;
            projectId: string | null;
            fundId: string | null;
            journalEntryId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.JournalStatus;
        createdAt: Date;
        description: string | null;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        journalNumber: number | null;
        journalType: import("@prisma/client").$Enums.JournalType;
        periodId: string | null;
        reference: string | null;
        journalDate: Date;
        correctsJournalId: string | null;
        riskScore: number;
        riskFlags: Prisma.JsonValue;
        riskComputedAt: Date | null;
        budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
        budgetFlags: Prisma.JsonValue | null;
        budgetCheckedAt: Date | null;
        budgetOverrideJustification: string | null;
        reversalInitiatedById: string | null;
        reversalInitiatedAt: Date | null;
        reversalPreparedById: string | null;
        submittedById: string | null;
        submittedAt: Date | null;
        reviewedById: string | null;
        reviewedAt: Date | null;
        rejectedById: string | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        returnedByPosterId: string | null;
        returnedByPosterAt: Date | null;
        returnReason: string | null;
        reversalOfId: string | null;
        reversalReason: string | null;
    }>;
    reversePostedJournal(req: Request, id: string, dto: ReverseJournalDto): Promise<{
        lines: {
            id: string;
            description: string | null;
            accountId: string;
            lineNumber: number | null;
            debit: Prisma.Decimal;
            credit: Prisma.Decimal;
            legalEntityId: string | null;
            departmentId: string | null;
            projectId: string | null;
            fundId: string | null;
            journalEntryId: string;
        }[];
    } & {
        id: string;
        tenantId: string;
        status: import("@prisma/client").$Enums.JournalStatus;
        createdAt: Date;
        description: string | null;
        createdById: string;
        approvedAt: Date | null;
        postedAt: Date | null;
        approvedById: string | null;
        postedById: string | null;
        journalNumber: number | null;
        journalType: import("@prisma/client").$Enums.JournalType;
        periodId: string | null;
        reference: string | null;
        journalDate: Date;
        correctsJournalId: string | null;
        riskScore: number;
        riskFlags: Prisma.JsonValue;
        riskComputedAt: Date | null;
        budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
        budgetFlags: Prisma.JsonValue | null;
        budgetCheckedAt: Date | null;
        budgetOverrideJustification: string | null;
        reversalInitiatedById: string | null;
        reversalInitiatedAt: Date | null;
        reversalPreparedById: string | null;
        submittedById: string | null;
        submittedAt: Date | null;
        reviewedById: string | null;
        reviewedAt: Date | null;
        rejectedById: string | null;
        rejectedAt: Date | null;
        rejectionReason: string | null;
        returnedByPosterId: string | null;
        returnedByPosterAt: Date | null;
        returnReason: string | null;
        reversalOfId: string | null;
        reversalReason: string | null;
    }>;
    postJournal(req: Request, id: string): Promise<any>;
    getOpeningBalances(req: Request, dto: OpeningBalancesQueryDto): Promise<{
        cutoverDate: string;
        openingPeriod: {
            id: string;
            name: string;
            status: import("@prisma/client").$Enums.AccountingPeriodStatus;
            startDate: Date;
            endDate: Date;
        } | null;
        journal: ({
            lines: {
                id: string;
                description: string | null;
                accountId: string;
                lineNumber: number | null;
                debit: Prisma.Decimal;
                credit: Prisma.Decimal;
                legalEntityId: string | null;
                departmentId: string | null;
                projectId: string | null;
                fundId: string | null;
                journalEntryId: string;
            }[];
        } & {
            id: string;
            tenantId: string;
            status: import("@prisma/client").$Enums.JournalStatus;
            createdAt: Date;
            description: string | null;
            createdById: string;
            approvedAt: Date | null;
            postedAt: Date | null;
            approvedById: string | null;
            postedById: string | null;
            journalNumber: number | null;
            journalType: import("@prisma/client").$Enums.JournalType;
            periodId: string | null;
            reference: string | null;
            journalDate: Date;
            correctsJournalId: string | null;
            riskScore: number;
            riskFlags: Prisma.JsonValue;
            riskComputedAt: Date | null;
            budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
            budgetFlags: Prisma.JsonValue | null;
            budgetCheckedAt: Date | null;
            budgetOverrideJustification: string | null;
            reversalInitiatedById: string | null;
            reversalInitiatedAt: Date | null;
            reversalPreparedById: string | null;
            submittedById: string | null;
            submittedAt: Date | null;
            reviewedById: string | null;
            reviewedAt: Date | null;
            rejectedById: string | null;
            rejectedAt: Date | null;
            rejectionReason: string | null;
            returnedByPosterId: string | null;
            returnedByPosterAt: Date | null;
            returnReason: string | null;
            reversalOfId: string | null;
            reversalReason: string | null;
        }) | null;
        cutoverLocked: boolean;
    }>;
    upsertOpeningBalances(req: Request, dto: UpsertOpeningBalancesJournalDto): Promise<{
        openingPeriod: {
            id: string;
            status: import("@prisma/client").$Enums.AccountingPeriodStatus;
        };
        journal: {
            lines: {
                id: string;
                description: string | null;
                accountId: string;
                lineNumber: number | null;
                debit: Prisma.Decimal;
                credit: Prisma.Decimal;
                legalEntityId: string | null;
                departmentId: string | null;
                projectId: string | null;
                fundId: string | null;
                journalEntryId: string;
            }[];
        } & {
            id: string;
            tenantId: string;
            status: import("@prisma/client").$Enums.JournalStatus;
            createdAt: Date;
            description: string | null;
            createdById: string;
            approvedAt: Date | null;
            postedAt: Date | null;
            approvedById: string | null;
            postedById: string | null;
            journalNumber: number | null;
            journalType: import("@prisma/client").$Enums.JournalType;
            periodId: string | null;
            reference: string | null;
            journalDate: Date;
            correctsJournalId: string | null;
            riskScore: number;
            riskFlags: Prisma.JsonValue;
            riskComputedAt: Date | null;
            budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
            budgetFlags: Prisma.JsonValue | null;
            budgetCheckedAt: Date | null;
            budgetOverrideJustification: string | null;
            reversalInitiatedById: string | null;
            reversalInitiatedAt: Date | null;
            reversalPreparedById: string | null;
            submittedById: string | null;
            submittedAt: Date | null;
            reviewedById: string | null;
            reviewedAt: Date | null;
            rejectedById: string | null;
            rejectedAt: Date | null;
            rejectionReason: string | null;
            returnedByPosterId: string | null;
            returnedByPosterAt: Date | null;
            returnReason: string | null;
            reversalOfId: string | null;
            reversalReason: string | null;
        };
    }>;
    postOpeningBalances(req: Request, dto: OpeningBalancesQueryDto): Promise<{
        journal: {
            lines: {
                id: string;
                description: string | null;
                accountId: string;
                lineNumber: number | null;
                debit: Prisma.Decimal;
                credit: Prisma.Decimal;
                legalEntityId: string | null;
                departmentId: string | null;
                projectId: string | null;
                fundId: string | null;
                journalEntryId: string;
            }[];
        } & {
            id: string;
            tenantId: string;
            status: import("@prisma/client").$Enums.JournalStatus;
            createdAt: Date;
            description: string | null;
            createdById: string;
            approvedAt: Date | null;
            postedAt: Date | null;
            approvedById: string | null;
            postedById: string | null;
            journalNumber: number | null;
            journalType: import("@prisma/client").$Enums.JournalType;
            periodId: string | null;
            reference: string | null;
            journalDate: Date;
            correctsJournalId: string | null;
            riskScore: number;
            riskFlags: Prisma.JsonValue;
            riskComputedAt: Date | null;
            budgetStatus: import("@prisma/client").$Enums.JournalBudgetStatus;
            budgetFlags: Prisma.JsonValue | null;
            budgetCheckedAt: Date | null;
            budgetOverrideJustification: string | null;
            reversalInitiatedById: string | null;
            reversalInitiatedAt: Date | null;
            reversalPreparedById: string | null;
            submittedById: string | null;
            submittedAt: Date | null;
            reviewedById: string | null;
            reviewedAt: Date | null;
            rejectedById: string | null;
            rejectedAt: Date | null;
            rejectionReason: string | null;
            returnedByPosterId: string | null;
            returnedByPosterAt: Date | null;
            returnReason: string | null;
            reversalOfId: string | null;
            reversalReason: string | null;
        };
        openingPeriodClosed: boolean;
    }>;
    listJournals(req: Request, paramsOrLimit?: {
        limit?: number;
        offset?: number;
        status?: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'REJECTED' | 'PARKED' | 'POSTED';
        budgetStatus?: 'OK' | 'WARN' | 'BLOCK';
        drilldown?: boolean;
        workbench?: boolean;
        periodId?: string;
        fromDate?: string;
        toDate?: string;
        accountId?: string;
        legalEntityId?: string;
        departmentId?: string;
        projectId?: string;
        fundId?: string;
        riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
        minRiskScore?: number;
        maxRiskScore?: number;
        createdById?: string;
        reviewedById?: string;
        postedById?: string;
    } | number, offsetLegacy?: number, statusLegacy?: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'REJECTED' | 'PARKED' | 'POSTED'): Promise<{
        items: {
            id: any;
            reference: any;
            journalDate: any;
            description: any;
            totalDebit: number;
            totalCredit: number;
            riskScore: any;
            riskFlags: any;
            budgetStatus: any;
            status: any;
            createdBy: {
                id: any;
                name: any;
            } | null;
            reviewedBy: {
                id: any;
                name: any;
            } | null;
            postedBy: {
                id: any;
                name: any;
            } | null;
        }[];
        total: number;
        limit: number;
        offset: number;
    }>;
    private assertLinesBasicValid;
    private assertBalanced;
    private parseCutoverDate;
    private isOpeningBalanceJournal;
    private getCutoverDateIfLocked;
    private assertOpeningBalanceAccountsAllowed;
}
