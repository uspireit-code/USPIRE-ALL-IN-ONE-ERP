import { PERMISSIONS } from './permission-catalog';
import { resolveCompatibilityPermissionsForUser } from './permissions.guard';

describe('PermissionsGuard governance compatibility', () => {
  it('SYSTEM_VIEW_ALL does not expand to finance authority', () => {
    const codes = new Set<string>([PERMISSIONS.SYSTEM.VIEW_ALL]);
    const expanded = resolveCompatibilityPermissionsForUser({ userPermissionCodes: codes });

    // Allowed: system governance visibility
    expect(expanded.has(PERMISSIONS.GOVERNANCE.SYSTEM.VIEW)).toBe(true);

    // Not allowed: finance authority via SYSTEM_VIEW_ALL
    expect(expanded.has(PERMISSIONS.FINANCE.VIEW_ALL)).toBe(false);
    expect(expanded.has(PERMISSIONS.FINANCE.CONFIG_VIEW)).toBe(false);
    expect(expanded.has(PERMISSIONS.FINANCE.CONFIG_UPDATE)).toBe(false);
    expect(expanded.has(PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW)).toBe(false);
    expect(expanded.has(PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE)).toBe(false);
  });
});
