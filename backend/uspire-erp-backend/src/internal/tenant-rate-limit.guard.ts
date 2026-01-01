import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { isTruthyEnv } from './env.util';

type Bucket = {
  count: number;
  resetAtMs: number;
};

@Injectable()
export class TenantRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
    private readonly scope: string,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!isTruthyEnv(process.env.RATE_LIMIT_ENABLED, true)) {
      return true;
    }

    const req = context.switchToHttp().getRequest<any>();

    if (req?.method && req.method !== 'GET') {
      return true;
    }

    const tenantId: string | undefined = req?.tenant?.id;
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
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existing.resetAtMs - now) / 1000),
      );
      throw new HttpException(
        {
          error: 'RATE_LIMITED',
          message: `Too many requests for tenant in ${this.scope}. Retry after ${retryAfterSeconds}s.`,
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
