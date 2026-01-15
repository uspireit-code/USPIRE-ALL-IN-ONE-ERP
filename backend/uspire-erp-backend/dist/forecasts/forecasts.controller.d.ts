import type { Request } from 'express';
import { CreateForecastDto } from './dto/create-forecast.dto';
import { UpdateForecastLinesDto } from './dto/update-forecast-lines.dto';
import { ForecastsService } from './forecasts.service';
export declare class ForecastsController {
    private readonly forecasts;
    constructor(forecasts: ForecastsService);
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
    listForecasts(req: Request, fiscalYear?: string, limit?: string, offset?: string): Promise<{
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
