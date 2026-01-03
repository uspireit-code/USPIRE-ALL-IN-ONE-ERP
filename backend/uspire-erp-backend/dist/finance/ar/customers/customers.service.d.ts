import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from './customers.dto';
export declare class FinanceArCustomersService {
    private readonly prisma;
    private readonly CUSTOMER_CODE_SEQUENCE_NAME;
    constructor(prisma: PrismaService);
    private ensureTenant;
    private isValidEmail;
    private validateCustomerNameEmailOrThrow;
    getById(req: Request, id: string): Promise<{
        name: string;
        id: string;
        status: import("@prisma/client").$Enums.CustomerStatus;
        createdAt: Date;
        updatedAt: Date;
        tenantId: string;
        customerCode: string | null;
        contactPerson: string | null;
        email: string | null;
        phone: string | null;
        billingAddress: string | null;
        taxNumber: string | null;
    }>;
    private normalizeHeaderKey;
    private parseCsvRows;
    private readXlsxRows;
    private nextCustomerCode;
    private ensureUniqueCustomerCode;
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
            contactPerson: string | null;
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
        contactPerson: string | null;
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
        contactPerson: string | null;
        email: string | null;
        phone: string | null;
        billingAddress: string | null;
        taxNumber: string | null;
    }>;
    private buildImportPreviewRows;
    previewImport(req: Request, file?: any): Promise<{
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
    import(req: Request, file?: any): Promise<{
        totalRows: number;
        importedCount: number;
        failedCount: number;
        failedRows: {
            rowNumber: number;
            reason: string;
        }[];
    }>;
    getCustomerImportCsvTemplate(req: Request): Promise<{
        fileName: string;
        body: string;
    }>;
    getCustomerImportXlsxTemplate(req: Request): Promise<{
        fileName: string;
        body: Buffer;
    }>;
}
