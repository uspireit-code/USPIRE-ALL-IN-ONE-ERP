import type { Request } from 'express';
import { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from './customers.dto';
import { FinanceArCustomersService } from './customers.service';
export declare class FinanceArCustomersController {
    private readonly customers;
    constructor(customers: FinanceArCustomersService);
    list(req: Request, q: ListCustomersQueryDto): Promise<{
        page: number;
        pageSize: number;
        total: number;
        items: {
            name: string;
            id: string;
            status: import("@prisma/client").$Enums.CustomerStatus;
            createdAt: Date;
            updatedAt: Date;
            tenantId: string;
            customerCode: string | null;
            email: string | null;
            phone: string | null;
            billingAddress: string | null;
            taxNumber: string | null;
        }[];
    }>;
    create(req: Request, dto: CreateCustomerDto): Promise<{
        name: string;
        id: string;
        status: import("@prisma/client").$Enums.CustomerStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        customerCode: string | null;
        email: string | null;
        phone: string | null;
        billingAddress: string | null;
        taxNumber: string | null;
    }>;
    update(req: Request, id: string, dto: UpdateCustomerDto): Promise<{
        name: string;
        id: string;
        status: import("@prisma/client").$Enums.CustomerStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        customerCode: string | null;
        email: string | null;
        phone: string | null;
        billingAddress: string | null;
        taxNumber: string | null;
    }>;
    import(req: Request, file: any): Promise<{
        totalRows: number;
        importedCount: number;
        failedCount: number;
        failedRows: {
            rowNumber: number;
            reason: string;
        }[];
    }>;
}
