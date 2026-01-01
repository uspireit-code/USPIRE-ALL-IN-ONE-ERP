import { Injectable } from '@nestjs/common';
import { isTruthyEnv } from '../internal/env.util';

type CacheEntry = {
  tenantId: string;
  expiresAt: number;
  value: unknown;
};

@Injectable()
export class CacheService {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly tenantKeys = new Map<string, Set<string>>();

  private now() {
    return Date.now();
  }

  private touchTenantKey(tenantId: string, key: string) {
    const set = this.tenantKeys.get(tenantId) ?? new Set<string>();
    set.add(key);
    this.tenantKeys.set(tenantId, set);
  }

  private dropKey(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return;

    const set = this.tenantKeys.get(entry.tenantId);
    if (set) {
      set.delete(key);
      if (set.size === 0) this.tenantKeys.delete(entry.tenantId);
    }

    this.entries.delete(key);
  }

  private purgeExpired() {
    const now = this.now();
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        this.dropKey(key);
      }
    }
  }

  async getOrSet<T>(params: {
    tenantId: string;
    key: string;
    ttlMs: number;
    loader: () => Promise<T>;
  }): Promise<T> {
    if (!isTruthyEnv(process.env.CACHE_ENABLED, true)) {
      return params.loader();
    }

    this.purgeExpired();

    const existing = this.entries.get(params.key);
    if (existing && existing.expiresAt > this.now()) {
      return existing.value as T;
    }

    const value = await params.loader();

    this.entries.set(params.key, {
      tenantId: params.tenantId,
      expiresAt: this.now() + params.ttlMs,
      value,
    });
    this.touchTenantKey(params.tenantId, params.key);

    return value;
  }

  clearTenant(tenantId: string) {
    const keys = this.tenantKeys.get(tenantId);
    if (!keys) return;

    for (const key of keys) {
      this.entries.delete(key);
    }

    this.tenantKeys.delete(tenantId);
  }

  clearAll() {
    this.entries.clear();
    this.tenantKeys.clear();
  }
}
