import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateTaxRateDto, TaxSummaryQueryDto, UpdateTaxRateDto, UpdateTenantTaxConfigDto } from './tax.dto';
export declare class FinanceTaxService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private ensureTenant;
    private ensureUser;
    private round2;
    private assertPeriodCoverage;
    private assertVatAccountValid;
    listRates(req: Request): Promise<{
        items: any;
    }>;
    getRateById(req: Request, id: string): Promise<any>;
    createRate(req: Request, dto: CreateTaxRateDto): Promise<any>;
    updateRate(req: Request, id: string, dto: UpdateTaxRateDto): Promise<any>;
    setRateActive(req: Request, id: string, isActive: boolean): Promise<any>;
    getConfig(req: Request): Promise<any>;
    updateConfig(req: Request, dto: UpdateTenantTaxConfigDto): Promise<any>;
    outputSummary(req: Request, dto: TaxSummaryQueryDto): Promise<{
        from: string;
        to: string;
        taxableSales: number;
        vatCharged: number;
    }>;
    inputSummary(req: Request, dto: TaxSummaryQueryDto): Promise<{
        from: string;
        to: string;
        vatPaid: number;
    }>;
}
