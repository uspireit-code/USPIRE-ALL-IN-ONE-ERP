import type { Request } from 'express';
import { CreateInvoiceCategoryDto, UpdateInvoiceCategoryDto } from './invoice-categories.dto';
import { InvoiceCategoryService } from './invoice-category.service';
export declare class InvoiceCategoriesController {
    private readonly categories;
    constructor(categories: InvoiceCategoryService);
    list(req: Request): Promise<{
        items: any;
    }>;
    getById(req: Request, id: string): Promise<any>;
    create(req: Request, dto: CreateInvoiceCategoryDto): Promise<any>;
    update(req: Request, id: string, dto: UpdateInvoiceCategoryDto): Promise<any>;
    setActive(req: Request, id: string, body: {
        isActive: boolean;
    }): Promise<any>;
}
