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
            id: string;
            name: string;
            createdAt: Date;
            tenantId: string;
            status: import("@prisma/client").$Enums.ForecastStatus;
            updatedAt: Date;
            createdById: string;
            fiscalYear: number;
        };
        version: {
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.ForecastStatus;
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
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        status: import("@prisma/client").$Enums.ForecastStatus;
        updatedAt: Date;
        createdBy: {
            id: string;
            email: string;
        };
        fiscalYear: number;
    }[]>;
    getForecast(req: Request, id: string): Promise<{
        forecast: {
            id: string;
            name: string;
            createdAt: Date;
            tenantId: string;
            status: import("@prisma/client").$Enums.ForecastStatus;
            updatedAt: Date;
            createdBy: {
                id: string;
                email: string;
            };
            fiscalYear: number;
        };
        versions: {
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.ForecastStatus;
            createdBy: {
                id: string;
                email: string;
            };
            forecastId: string;
            versionNumber: number;
        }[];
        latestVersion: {
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.ForecastStatus;
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
                id: string;
                name: string;
                code: string;
            };
            amount: import("@prisma/client/runtime/library").Decimal;
            accountId: string;
            month: number;
        }[];
    }>;
    submitForecast(req: Request, id: string): Promise<{
        forecast: {
            id: string;
            name: string;
            createdAt: Date;
            tenantId: string;
            status: import("@prisma/client").$Enums.ForecastStatus;
            updatedAt: Date;
            fiscalYear: number;
        };
        version: {
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.ForecastStatus;
            forecastId: string;
            versionNumber: number;
        };
    }>;
    approveForecast(req: Request, id: string): Promise<{
        forecast: {
            id: string;
            name: string;
            createdAt: Date;
            tenantId: string;
            status: import("@prisma/client").$Enums.ForecastStatus;
            updatedAt: Date;
            fiscalYear: number;
        };
        version: {
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.ForecastStatus;
            forecastId: string;
            versionNumber: number;
        };
    }>;
    updateForecastLines(req: Request, id: string, dto: UpdateForecastLinesDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        tenantId: string;
        status: import("@prisma/client").$Enums.ForecastStatus;
        updatedAt: Date;
        fiscalYear: number;
    }>;
}
