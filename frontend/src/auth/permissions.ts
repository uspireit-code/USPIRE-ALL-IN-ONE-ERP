import type { AuthMeResponse } from './auth.types';

export function can(me: AuthMeResponse | null | undefined, permission: string) {
  const target = String(permission ?? '').trim().toLowerCase();
  if (!target) return false;
  const perms = me?.permissions ?? [];
  return perms.some((p) => String(p ?? '').trim().toLowerCase() === target);
}

export function canAny(me: AuthMeResponse | null | undefined, permissions: string[]) {
  for (const p of permissions ?? []) {
    if (can(me, p)) return true;
  }
  return false;
}
