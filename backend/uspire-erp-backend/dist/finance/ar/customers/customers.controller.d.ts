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
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            status: import("@prisma/client").$Enums.CustomerStatus;
            updatedAt: Date;
            taxNumber: string | null;
            email: string | null;
            billingAddress: string | null;
            customerCode: string | null;
            phone: string | null;
            contactPerson: string | null;
        }[];
    }>;
    create(req: Request, dto: CreateCustomerDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        status: import("@prisma/client").$Enums.CustomerStatus;
        updatedAt: Date;
        taxNumber: string | null;
        email: string | null;
        billingAddress: string | null;
        customerCode: string | null;
        phone: string | null;
        contactPerson: string | null;
    }>;
    update(req: Request, id: string, dto: UpdateCustomerDto): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        status: import("@prisma/client").$Enums.CustomerStatus;
        updatedAt: Date;
        taxNumber: string | null;
        email: string | null;
        billingAddress: string | null;
        customerCode: string | null;
        phone: string | null;
        contactPerson: string | null;
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
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        status: import("@prisma/client").$Enums.CustomerStatus;
        updatedAt: Date;
        taxNumber: string | null;
        email: string | null;
        billingAddress: string | null;
        customerCode: string | null;
        phone: string | null;
        contactPerson: string | null;
    }>;
}
