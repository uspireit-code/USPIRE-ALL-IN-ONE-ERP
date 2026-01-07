import type { Request } from 'express';
import { FinancialStatementsService } from './financial-statements.service';
export type PresentedAmount = {
    value: number;
    display: string;
};
export type PresentedRow = {
    key: string;
    label: string;
    amount: PresentedAmount;
    compareAmount?: PresentedAmount;
};
export type PresentedSection = {
    key: string;
    label: string;
    rows: PresentedRow[];
    subtotal?: PresentedRow;
};
export type PresentedReport = {
    reportType: 'PL' | 'BS' | 'SOCE' | 'CF';
    title: string;
    period: {
        from?: string;
        to?: string;
        asOf?: string;
        fiscalYear?: number;
    };
    comparePeriod?: {
        from?: string;
        to?: string;
        asOf?: string;
        fiscalYear?: number;
    };
    sections: PresentedSection[];
    totals: PresentedRow[];
    compareOmittedReason?: string;
};
export declare class ReportPresentationService {
    private readonly engine;
    constructor(engine: FinancialStatementsService);
    private present;
    private addMonths;
    presentPL(req: Request, params: {
        from: string;
        to: string;
        compare?: 'prior_month' | 'prior_year';
    }): Promise<{
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
                amount: PresentedAmount;
                compareAmount: PresentedAmount | undefined;
            }[];
            subtotal: {
                key: string;
                label: string;
                amount: PresentedAmount;
                compareAmount: PresentedAmount | undefined;
            };
        }[];
        totals: {
            key: string;
            label: string;
            amount: PresentedAmount;
            compareAmount: PresentedAmount | undefined;
        }[];
    }>;
    presentBS(req: Request, params: {
        asOf: string;
        compare?: 'prior_month' | 'prior_year';
    }): Promise<{
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
        sections: PresentedSection[];
        totals: {
            key: string;
            label: string;
            amount: PresentedAmount;
            compareAmount: PresentedAmount | undefined;
        }[];
    }>;
    presentSOCE(req: Request, params: {
        from: string;
        to: string;
        compare?: 'prior_year';
    }): Promise<{
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
            rows: PresentedRow[];
            subtotal: {
                key: string;
                label: string;
                amount: PresentedAmount;
                compareAmount: PresentedAmount | undefined;
            };
        }[];
        totals: never[];
    }>;
    presentCF(req: Request, params: {
        from: string;
        to: string;
        compare?: 'prior_month' | 'prior_year';
    }): Promise<{
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
            rows: PresentedRow[];
            subtotal: {
                key: string;
                label: string;
                amount: PresentedAmount;
                compareAmount: PresentedAmount | undefined;
            };
        }[];
        totals: never[];
    }>;
}
