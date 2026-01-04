"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantRateLimitGuard = void 0;
const common_1 = require("@nestjs/common");
const env_util_1 = require("./env.util");
let TenantRateLimitGuard = class TenantRateLimitGuard {
    windowMs;
    maxRequests;
    scope;
    buckets = new Map();
    constructor(windowMs, maxRequests, scope) {
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
        this.scope = scope;
    }
    canActivate(context) {
        if (!(0, env_util_1.isTruthyEnv)(process.env.RATE_LIMIT_ENABLED, true)) {
            return true;
        }
        const req = context.switchToHttp().getRequest();
        if (req?.method && req.method !== 'GET') {
            return true;
        }
        const tenantId = req?.tenant?.id;
        if (!tenantId) {
            return true;
        }
        const now = Date.now();
        const key = `${tenantId}:${this.scope}`;
        const existing = this.buckets.get(key);
        if (!existing || existing.resetAtMs <= now) {
            this.buckets.set(key, { count: 1, resetAtMs: now + this.windowMs });
            return true;
        }
        existing.count += 1;
        if (existing.count > this.maxRequests) {
            const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));
            throw new common_1.HttpException({
                error: 'RATE_LIMITED',
                message: `Too many requests for tenant in ${this.scope}. Retry after ${retryAfterSeconds}s.`,
                retryAfterSeconds,
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        return true;
    }
};
exports.TenantRateLimitGuard = TenantRateLimitGuard;
exports.TenantRateLimitGuard = TenantRateLimitGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Number, Number, String])
], TenantRateLimitGuard);
//# sourceMappingURL=tenant-rate-limit.guard.js.map