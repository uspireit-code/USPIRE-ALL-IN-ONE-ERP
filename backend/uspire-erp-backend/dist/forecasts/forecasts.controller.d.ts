import type { Request } from 'express';
import { CreateForecastDto } from './dto/create-forecast.dto';
import { UpdateForecastLinesDto } from './dto/update-forecast-lines.dto';
import { ForecastsService } from './forecasts.service';
export declare class ForecastsController {
    private readonly forecasts;
    constructor(forecasts: ForecastsService);
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
    listForecasts(req: Request, fiscalYear?: string, limit?: string, offset?: string): Promise<{
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
            accountId: string;
            id: string;
            account: {
                id: string;
                name: string;
                code: string;
            };
            amount: import("@prisma/client/runtime/library").Decimal;
            month: number;
        }[];
    }>;
    getForecastActuals(req: Request, id: string): Promise<{
        forecastId: string;
        fiscalYear: number;
        forecastVersionId: string;
        rows: {
            accountId: string;
            byMonth: Record<number, number | null>;
        }[];
    }>;
    getForecastVariance(req: Request, id: string): Promise<{
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
