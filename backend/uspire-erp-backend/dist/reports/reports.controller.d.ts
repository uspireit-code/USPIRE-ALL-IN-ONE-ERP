import type { Request } from 'express';
import type { Response } from 'express';
import { AgingQueryDto } from './dto/aging-query.dto';
import { BalanceSheetQueryDto } from './dto/balance-sheet-query.dto';
import { CashFlowQueryDto } from './dto/cash-flow-query.dto';
import { PnlQueryDto } from './dto/pnl-query.dto';
import { ProfitLossQueryDto } from './dto/profit-loss-query.dto';
import { ReportCompareQueryDto } from './dto/report-compare-query.dto';
import { ReportExportQueryDto } from './dto/report-export-query.dto';
import { SoceQueryDto } from './dto/soce-query.dto';
import { StatementQueryDto } from './dto/statement-query.dto';
import { VatSummaryQueryDto } from './dto/vat-summary-query.dto';
import { FinancialStatementsService } from './financial-statements.service';
import { ReportAuditService } from './report-audit.service';
import { ReportExportService } from './report-export.service';
import { ReportPresentationService } from './report-presentation.service';
import { ReportsService } from './reports.service';
export declare class ReportsController {
    private readonly reports;
    private readonly financial;
    private readonly presentation;
    private readonly exports;
    private readonly audit;
    constructor(reports: ReportsService, financial: FinancialStatementsService, presentation: ReportPresentationService, exports: ReportExportService, audit: ReportAuditService);
    private getTenantPdfMetaOrThrow;
    plPresentation(req: Request, dto: PnlQueryDto & ReportCompareQueryDto): Promise<{
        entityId: string;
        report: {
            reportType: "PL";
            title: string;
            period: {
                from: string;
                to: string;
            };
            comparePeriod: {
                from?: string;
                to?: string;
                asOf?: string;
                fiscalYear?: number;
            } | undefined;
            compareOmittedReason: string | undefined;
            sections: {
                key: string;
                label: string;
                rows: {
                    key: string;
                    label: string;
                    amount: import("./report-presentation.service").PresentedAmount;
                    compareAmount: import("./report-presentation.service").PresentedAmount | undefined;
                }[];
                subtotal: {
                    key: string;
                    label: string;
                    amount: import("./report-presentation.service").PresentedAmount;
                    compareAmount: import("./report-presentation.service").PresentedAmount | undefined;
                };
            }[];
            totals: {
                key: string;
                label: string;
                amount: import("./report-presentation.service").PresentedAmount;
                compareAmount: import("./report-presentation.service").PresentedAmount | undefined;
            }[];
        };
    }>;
    bsPresentation(req: Request, dto: BalanceSheetQueryDto & ReportCompareQueryDto): Promise<{
        entityId: string;
        report: {
            reportType: "BS";
            title: string;
            period: {
                asOf: string;
            };
            comparePeriod: {
                from?: string;
                to?: string;
                asOf?: string;
                fiscalYear?: number;
            } | undefined;
            compareOmittedReason: string | undefined;
            sections: import("./report-presentation.service").PresentedSection[];
            totals: {
                key: string;
                label: string;
                amount: import("./report-presentation.service").PresentedAmount;
                compareAmount: import("./report-presentation.service").PresentedAmount | undefined;
            }[];
        };
    }>;
    socePresentation(req: Request, dto: SoceQueryDto & ReportCompareQueryDto): Promise<{
        entityId: string;
        report: {
            reportType: "SOCE";
            title: string;
            period: {
                from: string;
                to: string;
            };
            comparePeriod: {
                from?: string;
                to?: string;
                asOf?: string;
                fiscalYear?: number;
            } | undefined;
            compareOmittedReason: string | undefined;
            sections: {
                key: string;
                label: string;
                rows: import("./report-presentation.service").PresentedRow[];
                subtotal: {
                    key: string;
                    label: string;
                    amount: import("./report-presentation.service").PresentedAmount;
                    compareAmount: import("./report-presentation.service").PresentedAmount | undefined;
                };
            }[];
            totals: never[];
        };
    }>;
    cfPresentation(req: Request, dto: CashFlowQueryDto & ReportCompareQueryDto): Promise<{
        entityId: string;
        report: {
            reportType: "CF";
            title: string;
            period: {
                from: string;
                to: string;
            };
            comparePeriod: {
                from?: string;
                to?: string;
                asOf?: string;
                fiscalYear?: number;
            } | undefined;
            compareOmittedReason: string | undefined;
            sections: {
                key: string;
                label: string;
                rows: import("./report-presentation.service").PresentedRow[];
                subtotal: {
                    key: string;
                    label: string;
                    amount: import("./report-presentation.service").PresentedAmount;
                    compareAmount: import("./report-presentation.service").PresentedAmount | undefined;
                };
            }[];
            totals: never[];
        };
    }>;
    exportPl(req: Request, dto: PnlQueryDto & ReportExportQueryDto, res: Response): Promise<void>;
    exportBs(req: Request, dto: BalanceSheetQueryDto & ReportExportQueryDto, res: Response): Promise<void>;
    exportSoce(req: Request, dto: SoceQueryDto & ReportExportQueryDto, res: Response): Promise<void>;
    exportCf(req: Request, dto: CashFlowQueryDto & ReportExportQueryDto, res: Response): Promise<void>;
    profitLossLegacy(req: Request, dto: ProfitLossQueryDto): Promise<{
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
    pnl(req: Request, dto: PnlQueryDto): Promise<{
        from: string;
        to: string;
        income: {
            total: number;
            rows: Array<{
                accountId?: string;
                accountCode: string;
                accountName: string;
                accountType?: string;
                normalBalance?: string;
                reportSection?: string;
                balance: number;
            }>;
        };
        expenses: {
            total: number;
            rows: Array<{
                accountId?: string;
                accountCode: string;
                accountName: string;
                accountType?: string;
                normalBalance?: string;
                reportSection?: string;
                balance: number;
            }>;
        };
        profitOrLoss: number;
    }>;
    balanceSheetLegacy(req: Request, dto: BalanceSheetQueryDto): Promise<{
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
    balanceSheet(req: Request, dto: BalanceSheetQueryDto): Promise<{
        asOf: string;
        assets: {
            total: number;
            rows: Array<{
                accountId?: string;
                accountCode: string;
                accountName: string;
                accountType?: string;
                normalBalance?: string;
                reportSection?: string;
                balance: number;
            }>;
        };
        liabilities: {
            total: number;
            rows: Array<{
                accountId?: string;
                accountCode: string;
                accountName: string;
                accountType?: string;
                normalBalance?: string;
                reportSection?: string;
                balance: number;
            }>;
        };
        equity: {
            total: number;
            rows: Array<{
                accountId?: string;
                accountCode: string;
                accountName: string;
                accountType?: string;
                normalBalance?: string;
                reportSection?: string;
                balance: number;
            }>;
        };
        equation: {
            assets: number;
            liabilitiesPlusEquity: number;
            balanced: boolean;
        };
    }>;
    soce(req: Request, dto: SoceQueryDto): Promise<{
        from: string;
        to: string;
        shareCapital: {
            opening: number;
            ownerContributions: number;
            dividendsOrDrawings: number;
            profitOrLoss: number;
            otherMovements: number;
            movements: number;
            closing: number;
        };
        retainedEarnings: {
            opening: number;
            ownerContributions: number;
            dividendsOrDrawings: number;
            profitOrLoss: number;
            otherMovements: number;
            movements: number;
            closing: number;
        };
        otherReserves: {
            opening: number;
            ownerContributions: number;
            dividendsOrDrawings: number;
            profitOrLoss: number;
            otherMovements: number;
            movements: number;
            closing: number;
        };
        totalEquity: {
            opening: number;
            ownerContributions: number;
            dividendsOrDrawings: number;
            profitOrLoss: number;
            otherMovements: number;
            movements: number;
            closing: number;
        };
    }>;
    cashFlow(req: Request, dto: CashFlowQueryDto): Promise<{
        from: string;
        to: string;
        operating: {
            profitBeforeTax: number;
            adjustments: Array<{
                label: string;
                amount: number;
            }>;
            workingCapital: Array<{
                label: string;
                amount: number;
            }>;
            netCashFromOperating: number;
        };
        investing: {
            rows: Array<{
                label: string;
                amount: number;
            }>;
            netCashFromInvesting: number;
        };
        financing: {
            rows: Array<{
                label: string;
                amount: number;
            }>;
            netCashFromFinancing: number;
        };
        cash: {
            openingCash: number;
            closingCash: number;
            netChangeInCash: number;
        };
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
    vatSummary(req: Request, dto: VatSummaryQueryDto): Promise<{
        from: string;
        to: string;
        totalOutputVat: number;
        totalInputVat: number;
        netVat: number;
        netPosition: string;
    }>;
}
