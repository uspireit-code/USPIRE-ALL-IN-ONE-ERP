export declare class CacheService {
    private readonly entries;
    private readonly tenantKeys;
    private now;
    private touchTenantKey;
    private dropKey;
    private purgeExpired;
    getOrSet<T>(params: {
        tenantId: string;
        key: string;
        ttlMs: number;
        loader: () => Promise<T>;
    }): Promise<T>;
    clearTenant(tenantId: string): void;
    clearAll(): void;
}
