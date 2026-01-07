import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateForecastDto } from './dto/create-forecast.dto';
import { UpdateForecastLinesDto } from './dto/update-forecast-lines.dto';
export declare class ForecastsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private readonly OPENING_PERIOD_NAME;
    private round2;
    private utcDateOnly;
    private addUtcDays;
    private getCutoverDateIfLocked;
    private assertPeriodCoverage;
    private resolveFiscalYearMonthlyPeriods;
    private auditForecastView;
    private getApprovedForecastContext;
    private computeMonthlyActuals;
    getForecastActuals(req: Request, forecastId: string): Promise<{
        forecastId: string;
        fiscalYear: number;
        forecastVersionId: string;
        rows: {
            accountId: string;
            byMonth: Record<number, number | null>;
        }[];
    }>;
    getForecastVariance(req: Request, forecastId: string): Promise<{
        forecastId: string;
        fiscalYear: number;
        forecastVersionId: string;
        rows: {
            accountId: string;
            byMonth: Record<number, {
                forecastAmount: number;
                actualAmount: number | null;
                varianceAmount: number | null;
                variancePercent: number | null;
            }>;
        }[];
    }>;
    createForecast(req: Request, dto: CreateForecastDto): Promise<{
        forecast: {
            name: string;
            id: string;
            status: import("@prisma/client").$Enums.ForecastStatus;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            createdById: string;
            fiscalYear: number;
        };
        version: {
            id: string;
            status: import("@prisma/client").$Enums.ForecastStatus;
            createdAt: Date;
            createdById: string;
            forecastId: string;
            versionNumber: number;
        };
    }>;
    listForecasts(req: Request, query?: {
        fiscalYear?: number;
        limit?: number;
        offset?: number;
    }): Promise<{
        name: string;
        id: string;
        status: import("@prisma/client").$Enums.ForecastStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        createdBy: {
            id: string;
            email: string;
        };
        fiscalYear: number;
    }[]>;
    getForecast(req: Request, id: string): Promise<{
        forecast: {
            name: string;
            id: string;
            status: import("@prisma/client").$Enums.ForecastStatus;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            createdBy: {
                id: string;
                email: string;
            };
            fiscalYear: number;
        };
        versions: {
            id: string;
            status: import("@prisma/client").$Enums.ForecastStatus;
            createdAt: Date;
            createdBy: {
                id: string;
                email: string;
            };
            forecastId: string;
            versionNumber: number;
        }[];
        latestVersion: {
            id: string;
            status: import("@prisma/client").$Enums.ForecastStatus;
            createdAt: Date;
            createdBy: {
                id: string;
                email: string;
            };
            forecastId: string;
            versionNumber: number;
        };
        lines: {
            id: string;
            account: {
                name: string;
                id: string;
                code: string;
            };
            accountId: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            month: number;
        }[];
    }>;
    submitForecast(req: Request, id: string): Promise<{
        forecast: {
            name: string;
            id: string;
            status: import("@prisma/client").$Enums.ForecastStatus;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            fiscalYear: number;
        };
        version: {
            id: string;
            status: import("@prisma/client").$Enums.ForecastStatus;
            createdAt: Date;
            forecastId: string;
            versionNumber: number;
        };
    }>;
    approveForecast(req: Request, id: string): Promise<{
        forecast: {
            name: string;
            id: string;
            status: import("@prisma/client").$Enums.ForecastStatus;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            fiscalYear: number;
        };
        version: {
            id: string;
            status: import("@prisma/client").$Enums.ForecastStatus;
            createdAt: Date;
            forecastId: string;
            versionNumber: number;
        };
    }>;
    updateForecastLines(req: Request, id: string, dto: UpdateForecastLinesDto): Promise<{
        name: string;
        id: string;
        status: import("@prisma/client").$Enums.ForecastStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        fiscalYear: number;
    }>;
}
