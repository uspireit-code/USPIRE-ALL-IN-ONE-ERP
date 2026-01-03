import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialStatementsService } from './financial-statements.service';
import { ReportsService } from './reports.service';
import type { IfrsDisclosureNoteCode, IfrsDisclosureNoteDto, IfrsDisclosureNotesIndexItem } from './ifrs-disclosure-notes.types';
export declare class IfrsDisclosureNotesService {
    private readonly prisma;
    private readonly fs;
    private readonly reports;
    constructor(prisma: PrismaService, fs: FinancialStatementsService, reports: ReportsService);
    private validationError;
    private round2;
    private utcDateOnly;
    private addUtcDays;
    private assertTieOut;
    private getClosedPeriodOrThrow;
    private getCurrencyConfigOrThrow;
    private getEntityInfoOrThrow;
    private classifyCashAccount;
    private classifyPpeAccount;
    private classifyAccumulatedDepreciationAccount;
    private classifyAllowanceForDoubtfulDebtsAccount;
    private classifyArControlOrTradeReceivableAccount;
    private classifyDepreciationExpense;
    private balanceByAccountAsOf;
    listNotes(): IfrsDisclosureNotesIndexItem[];
    generateNote(req: Request, params: {
        periodId: string;
        noteCode: IfrsDisclosureNoteCode;
    }): Promise<IfrsDisclosureNoteDto>;
    private noteA;
    private noteB;
    private noteC;
    private noteD;
    private noteE;
    private noteF;
    private noteG;
    private noteH;
}
