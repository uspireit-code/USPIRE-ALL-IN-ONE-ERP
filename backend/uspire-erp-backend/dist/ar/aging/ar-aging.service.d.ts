import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
export type ArAgingRow = {
    customerId: string;
    customerName: string;
    current: number;
    b0_30: number;
    b31_60: number;
    b61_90: number;
    b90_plus: number;
    total: number;
};
export type ArAgingResponse = {
    asOf: string;
    buckets: Array<'CURRENT' | '0_30' | '31_60' | '61_90' | '90_PLUS'>;
    rows: ArAgingRow[];
    totals: Omit<ArAgingRow, 'customerId' | 'customerName'>;
};
export declare class ArAgingService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private round2;
    private parseAsOfOrThrow;
    getAging(req: Request, q: {
        asOf?: string;
        customerId?: string;
    }): Promise<ArAgingResponse>;
}
