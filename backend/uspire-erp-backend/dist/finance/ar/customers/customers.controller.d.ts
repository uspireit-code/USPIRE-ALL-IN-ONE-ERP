import type { Request } from 'express';
import type { Response } from 'express';
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
            status: import("@prisma/client").$Enums.CustomerStatus;
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            customerCode: string | null;
            email: string | null;
            taxNumber: string | null;
            contactPerson: string | null;
            phone: string | null;
            billingAddress: string | null;
        }[];
    }>;
    create(req: Request, dto: CreateCustomerDto): Promise<{
        status: import("@prisma/client").$Enums.CustomerStatus;
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        customerCode: string | null;
        email: string | null;
        taxNumber: string | null;
        contactPerson: string | null;
        phone: string | null;
        billingAddress: string | null;
    }>;
    update(req: Request, id: string, dto: UpdateCustomerDto): Promise<{
        status: import("@prisma/client").$Enums.CustomerStatus;
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        customerCode: string | null;
        email: string | null;
        taxNumber: string | null;
        contactPerson: string | null;
        phone: string | null;
        billingAddress: string | null;
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
    previewImport(req: Request, file: any): Promise<{
        totalRows: number;
        validCount: number;
        invalidCount: number;
        rows: {
            rowNumber: number;
            customerCode?: string;
            name: string;
            email: string;
            contactPerson?: string;
            phone?: string;
            billingAddress?: string;
            status?: "ACTIVE" | "INACTIVE";
            errors: string[];
        }[];
    }>;
    downloadImportCsvTemplate(req: Request, res: Response): Promise<void>;
    downloadImportXlsxTemplate(req: Request, res: Response): Promise<void>;
    getById(req: Request, id: string): Promise<{
        status: import("@prisma/client").$Enums.CustomerStatus;
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        customerCode: string | null;
        email: string | null;
        taxNumber: string | null;
        contactPerson: string | null;
        phone: string | null;
        billingAddress: string | null;
    }>;
}
