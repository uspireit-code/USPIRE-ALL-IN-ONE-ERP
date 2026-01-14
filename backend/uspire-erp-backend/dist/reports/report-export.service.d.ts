import type { PresentedReport } from './report-presentation.service';
import type { IfrsDisclosureNoteDto } from './ifrs-disclosure-notes.types';
type PdfHeaderBlock = {
    entityLegalName: string;
    reportName: string;
    periodLine: string;
    currencyIsoCode: string;
    headerFooterLine?: string;
};
export declare class ReportExportService {
    private formatMoney;
    private ensurePdfKit;
    private pageWidth;
    private x0;
    private yMax;
    private ensureSpace;
    private renderHeaderBlock;
    private renderTwoColumnRow;
    creditNoteToPdf(params: {
        creditNote: any;
        header: PdfHeaderBlock;
    }): Promise<Buffer>;
    refundToPdf(params: {
        refund: any;
        header: PdfHeaderBlock;
    }): Promise<Buffer>;
    private csvEscape;
    toCsv(report: PresentedReport): Buffer;
    toXlsx(report: PresentedReport): Promise<Buffer>;
    toPdf(params: {
        report: PresentedReport;
        header: PdfHeaderBlock;
    }): Promise<Buffer>;
    toSocePdf(params: {
        soce: {
            from: string;
            to: string;
            shareCapital: {
                opening: number;
                movements: number;
                closing: number;
            };
            retainedEarnings: {
                opening: number;
                movements: number;
                closing: number;
            };
            otherReserves: {
                opening: number;
                movements: number;
                closing: number;
            };
            totalEquity: {
                opening: number;
                movements: number;
                closing: number;
            };
        };
        header: PdfHeaderBlock;
    }): Promise<Buffer>;
    trialBalanceToXlsx(params: {
        title: string;
        from: string;
        to: string;
        rows: Array<{
            accountCode: string;
            accountName: string;
            totalDebit: number;
            totalCredit: number;
            net: number;
        }>;
    }): Promise<Buffer>;
    trialBalanceToPdf(params: {
        title: string;
        header: PdfHeaderBlock;
        from: string;
        to: string;
        rows: Array<{
            accountCode: string;
            accountName: string;
            totalDebit: number;
            totalCredit: number;
            net: number;
        }>;
        totals: {
            totalDebit: number;
            totalCredit: number;
            net: number;
        };
    }): Promise<Buffer>;
    ifrsDisclosureNoteToPdf(params: {
        note: IfrsDisclosureNoteDto;
        header: PdfHeaderBlock;
    }): Promise<Buffer>;
}
export {};
