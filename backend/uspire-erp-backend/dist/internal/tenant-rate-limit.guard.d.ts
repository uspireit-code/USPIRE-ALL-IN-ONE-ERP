import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class TenantRateLimitGuard implements CanActivate {
    private readonly windowMs;
    private readonly maxRequests;
    private readonly scope;
    private readonly buckets;
    constructor(windowMs: number, maxRequests: number, scope: string);
    canActivate(context: ExecutionContext): boolean;
}
