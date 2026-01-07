import { ReceiptLineDto } from './receipt-line.dto';
declare const PAYMENT_METHODS: readonly ["CASH", "CARD", "EFT", "CHEQUE", "OTHER"];
export declare class UpdateReceiptDto {
    customerId?: string;
    receiptDate?: string;
    currency?: string;
    exchangeRate?: number;
    totalAmount?: number;
    paymentMethod?: (typeof PAYMENT_METHODS)[number];
    paymentReference?: string;
    reference?: string;
    lines?: ReceiptLineDto[];
}
export {};
