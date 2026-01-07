import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { GlService } from '../../../gl/gl.service';
import type { ApproveRefundDto, CreateCustomerRefundDto, VoidRefundDto } from './refunds.dto';
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
    private resolveClearingAccountId;
    create(req: Request, dto: CreateCustomerRefundDto): Promise<any>;
    approve(req: Request, id: string, _dto: ApproveRefundDto): Promise<any>;
    post(req: Request, id: string): Promise<any>;
    void(req: Request, id: string, dto: VoidRefundDto): Promise<any>;
}
