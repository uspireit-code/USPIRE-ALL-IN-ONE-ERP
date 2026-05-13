import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from 'express';

export type RequestContextStore = {
  req?: Request;
  tenantId?: string | null;
  actorUserId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  glLifecycleBypass?: boolean;
};

const als = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext(req: Request, fn: () => void) {
  const tenantId = typeof (req as any)?.tenant?.id === 'string' ? (req as any).tenant.id : null;
  const actorUserId = typeof (req as any)?.user?.id === 'string' ? (req as any).user.id : null;
  const requestId = typeof (req as any)?.requestId === 'string' ? (req as any).requestId : null;
  const ipAddress = typeof (req as any)?.ip === 'string' ? (req as any).ip : null;
  const userAgent =
    typeof (req as any)?.headers?.['user-agent'] === 'string'
      ? (req as any).headers['user-agent']
      : null;

  return als.run(
    {
      req,
      tenantId,
      actorUserId,
      requestId,
      ipAddress,
      userAgent,
    },
    fn,
  );
}

export function runWithSystemContext(
  ctx: {
    tenantId: string;
    actorUserId?: string;
    requestId?: string;
  },
  fn: () => void,
) {
  return als.run(
    {
      tenantId: ctx.tenantId,
      actorUserId: ctx.actorUserId ?? 'SYSTEM',
      requestId: ctx.requestId ?? 'BACKGROUND_JOB',
    },
    fn,
  );
}

export function getActorOrSystem(ctx?: RequestContextStore) {
  const actorUserId = ctx?.actorUserId ?? (typeof (ctx as any)?.req?.user?.id === 'string' ? (ctx as any).req.user.id : null);
  return actorUserId ?? 'SYSTEM';
}

export function getRequestIdOrSystem(ctx?: RequestContextStore) {
  const requestId = ctx?.requestId ?? (typeof (ctx as any)?.req?.requestId === 'string' ? (ctx as any).req.requestId : null);
  return requestId ?? 'BACKGROUND_JOB';
}

export function getTenantIdOrNull(ctx?: RequestContextStore) {
  const tenantId = ctx?.tenantId ?? (typeof (ctx as any)?.req?.tenant?.id === 'string' ? (ctx as any).req.tenant.id : null);
  return tenantId ?? null;
}

export function getRequestContext(): RequestContextStore | undefined {
  return als.getStore();
}

export async function withGlLifecycleBypass<T>(fn: () => Promise<T> | T) {
  const ctx = als.getStore();
  if (!ctx) {
    return await fn();
  }
  const prev = ctx.glLifecycleBypass;
  ctx.glLifecycleBypass = true;
  try {
    return await fn();
  } finally {
    ctx.glLifecycleBypass = prev;
  }
}
