declare const CUSTOMER_STATUSES: readonly ["ACTIVE", "INACTIVE"];
type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
export declare class ListCustomersQueryDto {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: CustomerStatus;
}
export declare class CreateCustomerDto {
    name: string;
    status?: CustomerStatus;
    customerCode?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    billingAddress?: string;
    taxNumber?: string;
}
export declare class UpdateCustomerDto {
    name?: string;
    status?: CustomerStatus;
    email?: string;
    phone?: string;
    contactPerson?: string;
    billingAddress?: string;
    taxNumber?: string;
}
export {};
