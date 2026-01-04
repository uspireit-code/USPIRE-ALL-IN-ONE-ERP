"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const common_1 = require("@nestjs/common");
const env_util_1 = require("../internal/env.util");
let CacheService = class CacheService {
    entries = new Map();
    tenantKeys = new Map();
    now() {
        return Date.now();
    }
    touchTenantKey(tenantId, key) {
        const set = this.tenantKeys.get(tenantId) ?? new Set();
        set.add(key);
        this.tenantKeys.set(tenantId, set);
    }
    dropKey(key) {
        const entry = this.entries.get(key);
        if (!entry)
            return;
        const set = this.tenantKeys.get(entry.tenantId);
        if (set) {
            set.delete(key);
            if (set.size === 0)
                this.tenantKeys.delete(entry.tenantId);
        }
        this.entries.delete(key);
    }
    purgeExpired() {
        const now = this.now();
        for (const [key, entry] of this.entries.entries()) {
            if (entry.expiresAt <= now) {
                this.dropKey(key);
            }
        }
    }
    async getOrSet(params) {
        if (!(0, env_util_1.isTruthyEnv)(process.env.CACHE_ENABLED, true)) {
            return params.loader();
        }
        this.purgeExpired();
        const existing = this.entries.get(params.key);
        if (existing && existing.expiresAt > this.now()) {
            return existing.value;
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
    clearTenant(tenantId) {
        const keys = this.tenantKeys.get(tenantId);
        if (!keys)
            return;
        for (const key of keys) {
            this.entries.delete(key);
        }
        this.tenantKeys.delete(tenantId);
    }
    clearAll() {
        this.entries.clear();
        this.tenantKeys.clear();
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = __decorate([
    (0, common_1.Injectable)()
], CacheService);
//# sourceMappingURL=cache.service.js.map