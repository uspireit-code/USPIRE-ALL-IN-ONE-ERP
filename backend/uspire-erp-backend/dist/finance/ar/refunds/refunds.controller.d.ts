import type { Request } from 'express';
import type { Response } from 'express';
import { CreateCustomerRefundDto, ListRefundsQueryDto, ApproveRefundDto, PostRefundDto, SubmitRefundDto, VoidRefundDto } from './refunds.dto';
import { FinanceArRefundsService } from './refunds.service';
export declare class FinanceArRefundsController {
    private readonly refunds;
    constructor(refunds: FinanceArRefundsService);
    list(req: Request, q: ListRefundsQueryDto): Promise<{
        items: any;
        total: any;
        page: number;
        pageSize: number;
    }>;
    listRefundableCreditNotes(req: Request, customerId: string): Promise<{
        items: any;
    }>;
    listRefundableCustomers(req: Request): Promise<{
        items: any;
    }>;
    refundable(req: Request, creditNoteId: string): Promise<{
        creditNote: {
            creditNoteDate: any;
            id: any;
            creditNoteNumber: string;
            customerId: any;
            currency: string;
            exchangeRate: number;
            totalAmount: number;
        };
        refunded: number;
        refundable: number;
    }>;
    getById(req: Request, id: string): Promise<{
        id: any;
        refundNumber: any;
        refundDate: any;
        customerId: any;
        customerName: any;
        creditNoteId: any;
        creditNoteNumber: any;
        creditNoteDate: any;
        creditNoteTotalAmount: number;
        creditNoteCurrency: any;
        invoiceId: any;
        currency: any;
        exchangeRate: number;
        amount: number;
        paymentMethod: any;
        bankAccountId: any;
        status: any;
        createdById: any;
        createdAt: any;
        approvedById: any;
        approvedAt: any;
        postedById: any;
        postedAt: any;
        voidedById: any;
        voidedAt: any;
        voidReason: any;
        postedJournalId: any;
    }>;
    exportPdf(req: Request, id: string, res: Response): Promise<void>;
    create(req: Request, dto: CreateCustomerRefundDto): Promise<any>;
    submit(req: Request, id: string, _dto: SubmitRefundDto): Promise<any>;
    approve(req: Request, id: string, _dto: ApproveRefundDto): Promise<any>;
    post(req: Request, id: string, _dto: PostRefundDto): Promise<any>;
    void(req: Request, id: string, dto: VoidRefundDto): Promise<any>;
}
