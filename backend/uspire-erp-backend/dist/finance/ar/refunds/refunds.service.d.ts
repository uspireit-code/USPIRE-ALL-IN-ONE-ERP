import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { GlService } from '../../../gl/gl.service';
import type { ApproveRefundDto, CreateCustomerRefundDto, ListRefundsQueryDto, VoidRefundDto } from './refunds.dto';
export declare class FinanceArRefundsService {
    private readonly prisma;
    private readonly gl;
    private readonly REFUND_NUMBER_SEQUENCE_NAME;
    constructor(prisma: PrismaService, gl: GlService);
    private round2;
    private normalizeMoney;
    private ensureTenant;
    private ensureUser;
    private parseYmdToDateOrNull;
    private nextRefundNumber;
    private computeCreditNoteRefundable;
    getRefundableForCreditNote(req: Request, creditNoteId: string): Promise<{
        creditNote: {
            creditNoteDate: any;
            id: any;
            creditNoteNumber: string;
            customerId: any;
            currency: string;
            totalAmount: number;
        };
        refunded: number;
        refundable: number;
    }>;
    list(req: Request, q: ListRefundsQueryDto): Promise<{
        items: any;
        total: any;
        page: number;
        pageSize: number;
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
    private resolveClearingAccountId;
    create(req: Request, dto: CreateCustomerRefundDto): Promise<any>;
    approve(req: Request, id: string, _dto: ApproveRefundDto): Promise<any>;
    post(req: Request, id: string): Promise<any>;
    void(req: Request, id: string, dto: VoidRefundDto): Promise<any>;
}
