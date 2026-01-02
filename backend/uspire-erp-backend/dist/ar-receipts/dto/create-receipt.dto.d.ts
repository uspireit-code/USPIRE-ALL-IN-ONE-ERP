import { ReceiptLineDto } from './receipt-line.dto';
declare const PAYMENT_METHODS: readonly ["CASH", "CARD", "EFT", "CHEQUE", "OTHER"];
export declare class CreateReceiptDto {
    customerId: string;
    receiptDate: string;
    currency: string;
    totalAmount: number;
    paymentMethod: (typeof PAYMENT_METHODS)[number];
    paymentReference?: string;
    lines?: ReceiptLineDto[];
}
export {};
