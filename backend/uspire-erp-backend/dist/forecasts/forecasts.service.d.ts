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
            status: import("@prisma/client").$Enums.ForecastStatus;
            id: string;
            tenantId: string;
            createdById: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            fiscalYear: number;
        };
        version: {
            status: import("@prisma/client").$Enums.ForecastStatus;
            id: string;
            createdById: string;
            createdAt: Date;
            forecastId: string;
            versionNumber: number;
        };
    }>;
    listForecasts(req: Request, query?: {
        fiscalYear?: number;
        limit?: number;
        offset?: number;
    }): Promise<{
        status: import("@prisma/client").$Enums.ForecastStatus;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdBy: {
            id: string;
            email: string;
        };
        name: string;
        updatedAt: Date;
        fiscalYear: number;
    }[]>;
    getForecast(req: Request, id: string): Promise<{
        forecast: {
            status: import("@prisma/client").$Enums.ForecastStatus;
            id: string;
            tenantId: string;
            createdAt: Date;
            createdBy: {
                id: string;
                email: string;
            };
            name: string;
            updatedAt: Date;
            fiscalYear: number;
        };
        versions: {
            status: import("@prisma/client").$Enums.ForecastStatus;
            id: string;
            createdAt: Date;
            createdBy: {
                id: string;
                email: string;
            };
            forecastId: string;
            versionNumber: number;
        }[];
        latestVersion: {
            status: import("@prisma/client").$Enums.ForecastStatus;
            id: string;
            createdAt: Date;
            createdBy: {
                id: string;
                email: string;
            };
            forecastId: string;
            versionNumber: number;
        };
        lines: {
            account: {
                id: string;
                name: string;
                code: string;
            };
            accountId: string;
            id: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            month: number;
        }[];
    }>;
    submitForecast(req: Request, id: string): Promise<{
        forecast: {
            status: import("@prisma/client").$Enums.ForecastStatus;
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            fiscalYear: number;
        };
        version: {
            status: import("@prisma/client").$Enums.ForecastStatus;
            id: string;
            createdAt: Date;
            forecastId: string;
            versionNumber: number;
        };
    }>;
    approveForecast(req: Request, id: string): Promise<{
        forecast: {
            status: import("@prisma/client").$Enums.ForecastStatus;
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            fiscalYear: number;
        };
        version: {
            status: import("@prisma/client").$Enums.ForecastStatus;
            id: string;
            createdAt: Date;
            forecastId: string;
            versionNumber: number;
        };
    }>;
    updateForecastLines(req: Request, id: string, dto: UpdateForecastLinesDto): Promise<{
        status: import("@prisma/client").$Enums.ForecastStatus;
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        fiscalYear: number;
    }>;
}
