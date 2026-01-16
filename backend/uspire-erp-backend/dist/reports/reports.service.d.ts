import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AgingQueryDto } from './dto/aging-query.dto';
import { ProfitLossQueryDto } from './dto/profit-loss-query.dto';
import { BalanceSheetQueryDto } from './dto/balance-sheet-query.dto';
import { StatementQueryDto } from './dto/statement-query.dto';
import { VatSummaryQueryDto } from './dto/vat-summary-query.dto';
export declare class ReportsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private readonly OPENING_PERIOD_NAME;
    private readonly agingBuckets;
    private parseDateOnly;
    vatSummary(req: Request, dto: VatSummaryQueryDto): Promise<{
        from: string;
        to: string;
        totalOutputVat: number;
        totalInputVat: number;
        netVat: number;
        netPosition: string;
    }>;
    private round2;
    private daysBetween;
    profitLoss(req: Request, dto: ProfitLossQueryDto): Promise<{
        from: string;
        to: string;
        income: {
            total: number;
            rows: {
                accountCode: string;
                accountName: string;
                balance: number;
            }[];
        };
        expenses: {
            total: number;
            rows: {
                accountCode: string;
                accountName: string;
                balance: number;
            }[];
        };
        profitOrLoss: number;
    }>;
    apAging(req: Request, dto: AgingQueryDto): Promise<{
        asOf: string;
        buckets: {
            code: "0_30" | "31_60" | "61_90" | "90_PLUS";
            label: "0–30" | "31–60" | "61–90" | "90+";
        }[];
        grandTotalsByBucket: Record<string, number>;
        grandTotalOutstanding: number;
        suppliers: {
            supplierId: string;
            supplierName: string;
            totalsByBucket: Record<string, number>;
            totalOutstanding: number;
            invoices: {
                invoiceId: string;
                invoiceNumber: string;
                invoiceDate: string;
                dueDate: string;
                daysPastDue: number;
                totalAmount: number;
                paidToDate: number;
                outstanding: number;
                bucket: string;
            }[];
        }[];
    }>;
    arAging(req: Request, dto: AgingQueryDto): Promise<{
        asOf: string;
        buckets: {
            code: "0_30" | "31_60" | "61_90" | "90_PLUS";
            label: "0–30" | "31–60" | "61–90" | "90+";
        }[];
        grandTotalsByBucket: Record<string, number>;
        grandTotalOutstanding: number;
        customers: {
            customerId: string;
            customerName: string;
            totalsByBucket: Record<string, number>;
            totalOutstanding: number;
            invoices: {
                invoiceId: string;
                invoiceNumber: string;
                invoiceDate: string;
                dueDate: string;
                daysPastDue: number;
                totalAmount: number;
                receivedToDate: number;
                outstanding: number;
                bucket: string;
            }[];
        }[];
    }>;
    supplierStatement(req: Request, supplierId: string, dto: StatementQueryDto): Promise<{
        supplierId: string;
        supplierName: string;
        from: string;
        to: string;
        openingBalance: number;
        lines: {
            date: string;
            type: "INVOICE" | "PAYMENT";
            reference: string;
            debit: number;
            credit: number;
            runningBalance: number;
        }[];
        closingBalance: number;
    }>;
    customerStatement(req: Request, customerId: string, dto: StatementQueryDto): Promise<{
        customerId: string;
        customerName: string;
        from: string;
        to: string;
        openingBalance: number;
        lines: {
            date: string;
            type: "INVOICE" | "RECEIPT";
            reference: string;
            debit: number;
            credit: number;
            runningBalance: number;
        }[];
        closingBalance: number;
    }>;
    balanceSheet(req: Request, dto: BalanceSheetQueryDto): Promise<{
        asOf: string;
        assets: {
            total: number;
            rows: {
                accountCode: string;
                accountName: string;
                balance: number;
            }[];
        };
        liabilities: {
            total: number;
            rows: {
                accountCode: string;
                accountName: string;
                balance: number;
            }[];
        };
        equity: {
            total: number;
            rows: {
                accountCode: string;
                accountName: string;
                balance: number;
            }[];
        };
        equation: {
            assets: number;
            liabilitiesPlusEquity: number;
            balanced: boolean;
        };
    }>;
    private retainedEarnings;
    private assertPeriodCoverage;
    private getCutoverDateIfLocked;
}
