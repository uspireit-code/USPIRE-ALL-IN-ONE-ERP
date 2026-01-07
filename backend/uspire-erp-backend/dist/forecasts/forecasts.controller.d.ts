import type { Request } from 'express';
import { CreateForecastDto } from './dto/create-forecast.dto';
import { UpdateForecastLinesDto } from './dto/update-forecast-lines.dto';
import { ForecastsService } from './forecasts.service';
export declare class ForecastsController {
    private readonly forecasts;
    constructor(forecasts: ForecastsService);
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
    listForecasts(req: Request, fiscalYear?: string, limit?: string, offset?: string): Promise<{
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
