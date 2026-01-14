import type { Request } from 'express';
import { CreateTaxRateDto, SetTaxRateActiveDto, TaxSummaryQueryDto, UpdateTaxRateDto, UpdateTenantTaxConfigDto } from './tax.dto';
import { FinanceTaxService } from './tax.service';
export declare class FinanceTaxController {
    private readonly tax;
    constructor(tax: FinanceTaxService);
    listRates(req: Request): Promise<{
        items: any;
    }>;
    getRateById(req: Request, id: string): Promise<any>;
    createRate(req: Request, dto: CreateTaxRateDto): Promise<any>;
    updateRate(req: Request, id: string, dto: UpdateTaxRateDto): Promise<any>;
    setRateActive(req: Request, id: string, dto: SetTaxRateActiveDto): Promise<any>;
    getConfig(req: Request): Promise<any>;
    updateConfig(req: Request, dto: UpdateTenantTaxConfigDto): Promise<any>;
    outputSummary(req: Request, q: TaxSummaryQueryDto): Promise<{
        from: string;
        to: string;
        taxableSales: number;
        vatCharged: number;
    }>;
    inputSummary(req: Request, q: TaxSummaryQueryDto): Promise<{
        from: string;
        to: string;
        vatPaid: number;
    }>;
}
