import { PERMISSIONS } from './permission-catalog';
import type { Request } from 'express';

function applyEscalationCheck(params: {
  required: string[];
  codes: Set<string>;
  method: string;
  reason?: string;
}) {
  const routeRequiresGlobalOverride = params.required.some(
    (p) =>
      p === PERMISSIONS.GOVERNANCE.GLOBAL_OVERRIDE.SUPER_ADMIN_GLOBAL ||
      p === PERMISSIONS.GOVERNANCE.GLOBAL_OVERRIDE.GOVERNANCE_OVERRIDE,
  );
  const hasGlobalOverride =
    params.codes.has(PERMISSIONS.GOVERNANCE.GLOBAL_OVERRIDE.SUPER_ADMIN_GLOBAL) ||
    params.codes.has(PERMISSIONS.GOVERNANCE.GLOBAL_OVERRIDE.GOVERNANCE_OVERRIDE);

  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(params.method.toUpperCase());
  if (!routeRequiresGlobalOverride || !hasGlobalOverride || !isMutating) return { ok: true };

  const reason = String(params.reason ?? '').trim();
  if (reason.length < 3) return { ok: false };
  return { ok: true };
}

describe('Governance escalation reason enforcement (route-required)', () => {
  it('requires reason when route requires global override', () => {
    const res = applyEscalationCheck({
      required: [PERMISSIONS.GOVERNANCE.GLOBAL_OVERRIDE.GOVERNANCE_OVERRIDE],
      codes: new Set([PERMISSIONS.GOVERNANCE.GLOBAL_OVERRIDE.GOVERNANCE_OVERRIDE]),
      method: 'PUT',
      reason: '',
    });
    expect(res.ok).toBe(false);
  });

  it('does not require reason when route does not require global override', () => {
    const res = applyEscalationCheck({
      required: [PERMISSIONS.SYSTEM.CONFIG_UPDATE],
      codes: new Set([PERMISSIONS.GOVERNANCE.GLOBAL_OVERRIDE.GOVERNANCE_OVERRIDE]),
      method: 'PUT',
      reason: '',
    });
    expect(res.ok).toBe(true);
  });
});
