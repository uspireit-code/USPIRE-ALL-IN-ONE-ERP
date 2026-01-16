export declare enum WithholdingProfile {
    NONE = "NONE",
    STANDARD = "STANDARD",
    SPECIAL = "SPECIAL"
}
export declare class CreateSupplierDto {
    name: string;
    taxNumber?: string;
    registrationNumber?: string;
    vatRegistered?: boolean;
    defaultPaymentTerms?: string;
    defaultCurrency?: string;
    withholdingProfile?: WithholdingProfile;
    email?: string;
    phone?: string;
    address?: string;
}
