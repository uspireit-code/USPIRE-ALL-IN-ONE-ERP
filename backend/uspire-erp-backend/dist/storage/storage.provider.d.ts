import type { Buffer } from 'node:buffer';
export interface StorageProvider {
    put(key: string, body: Buffer): Promise<void>;
    get(key: string): Promise<Buffer>;
    exists(key: string): Promise<boolean>;
}
export declare const STORAGE_PROVIDER = "STORAGE_PROVIDER";
