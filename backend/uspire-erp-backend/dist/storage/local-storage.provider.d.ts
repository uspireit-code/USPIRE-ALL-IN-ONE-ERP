import { StorageProvider } from './storage.provider';
export declare class LocalStorageProvider implements StorageProvider {
    private readonly rootDir;
    constructor();
    private resolvePath;
    put(key: string, body: Buffer): Promise<void>;
    get(key: string): Promise<Buffer>;
    exists(key: string): Promise<boolean>;
}
