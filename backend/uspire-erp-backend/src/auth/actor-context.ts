import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

export type ActorContext = {
  tenantId: string;
  realUserId: string;
  actingAsUserId?: string;
  delegationId?: string;
};

export function getEffectiveActorContext(req: Request): ActorContext {
  const tenantId = String((req as any)?.tenant?.id ?? (req as any)?.user?.tenantId ?? '').trim();
  const user: any = (req as any)?.user ?? {};

  const realUserId = String(user?.realUserId ?? user?.id ?? '').trim();
  const actingAsUserId = String(user?.actingAsUserId ?? '').trim() || undefined;
  const delegationId = String(user?.delegationId ?? '').trim() || undefined;

  if (!tenantId || !realUserId) {
    throw new ForbiddenException('Missing tenant or user context');
  }

  return {
    tenantId,
    realUserId,
    actingAsUserId,
    delegationId,
  };
}
