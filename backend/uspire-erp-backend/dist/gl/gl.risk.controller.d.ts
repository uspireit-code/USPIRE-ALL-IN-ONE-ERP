import type { Request } from 'express';
import { GlService } from './gl.service';
export declare class GlRiskController {
    private readonly gl;
    constructor(gl: GlService);
    overview(req: Request, periodId?: string, dateFrom?: string, dateTo?: string, legalEntityId?: string, departmentId?: string, projectId?: string, fundId?: string): Promise<{
        total: number;
        avgRiskScore: number;
        highRiskPct: number;
        distribution: {
            LOW: number;
            MEDIUM: number;
            HIGH: number;
        };
    }>;
    users(req: Request, periodId?: string, dateFrom?: string, dateTo?: string): Promise<{
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
    accounts(req: Request, periodId?: string, dateFrom?: string, dateTo?: string, legalEntityId?: string, departmentId?: string, projectId?: string, fundId?: string): Promise<{
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
    organisation(req: Request, periodId?: string, dateFrom?: string, dateTo?: string): Promise<{
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
    periods(req: Request, periodId?: string, dateFrom?: string, dateTo?: string): Promise<{
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
}
