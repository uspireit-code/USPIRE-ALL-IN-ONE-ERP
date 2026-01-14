import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateInvoiceCategoryDto, UpdateInvoiceCategoryDto } from './invoice-categories.dto';
export declare class InvoiceCategoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private ensureTenant;
    private ensureUser;
    private assertRevenueAccountValid;
    list(req: Request): Promise<{
        items: any;
    }>;
    getById(req: Request, id: string): Promise<any>;
    create(req: Request, dto: CreateInvoiceCategoryDto): Promise<any>;
    update(req: Request, id: string, dto: UpdateInvoiceCategoryDto): Promise<any>;
    setActive(req: Request, id: string, isActive: boolean): Promise<any>;
}
