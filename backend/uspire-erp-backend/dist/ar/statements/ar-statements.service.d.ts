import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
export type ArStatementTransactionType = 'INVOICE' | 'RECEIPT' | 'CREDIT_NOTE';
export type ArStatementTransaction = {
    date: string;
    type: ArStatementTransactionType;
    reference: string;
    debit: number;
    credit: number;
    runningBalance: number;
};
export type ArStatementResponse = {
    customer: {
        id: string;
        name: string;
    };
    fromDate: string;
    toDate: string;
    openingBalance: number;
    transactions: ArStatementTransaction[];
    closingBalance: number;
};
export declare class ArStatementsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listCustomersForStatements(req: Request): Promise<{
        items: {
            id: any;
            name: any;
            customerCode: any;
            status: any;
        }[];
    }>;
    private round2;
    private parseDateOnlyOrThrow;
    private resolveWindowOrThrow;
    getStatement(req: Request, q: {
        customerId: string;
        fromDate?: string;
        toDate?: string;
        asOfDate?: string;
    }): Promise<ArStatementResponse>;
}
