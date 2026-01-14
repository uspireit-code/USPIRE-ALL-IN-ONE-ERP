import type { Request } from 'express';
import { ArAgingService } from './ar-aging.service';
export declare class ArAgingController {
    private readonly aging;
    constructor(aging: ArAgingService);
    get(req: Request, asOf?: string, customerId?: string): Promise<import("./ar-aging.service").ArAgingResponse>;
}
