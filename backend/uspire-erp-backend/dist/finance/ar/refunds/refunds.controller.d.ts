import type { Request } from 'express';
import { ApproveRefundDto, CreateCustomerRefundDto, PostRefundDto, VoidRefundDto } from './refunds.dto';
import { FinanceArRefundsService } from './refunds.service';
export declare class FinanceArRefundsController {
    private readonly refunds;
    constructor(refunds: FinanceArRefundsService);
    create(req: Request, dto: CreateCustomerRefundDto): Promise<any>;
    approve(req: Request, id: string, dto: ApproveRefundDto): Promise<any>;
    post(req: Request, id: string, _dto: PostRefundDto): Promise<any>;
    void(req: Request, id: string, dto: VoidRefundDto): Promise<any>;
}
