# Permission Normalization Report (Phase 5/6)

## Scope
- Backend permission code normalization:
  - Replace raw permission string literals with canonical `PERMISSIONS.*` constants.
  - Ensure seed/backfill logic remains behaviorally equivalent.

## What changed
- **Canonical source of truth**: `src/rbac/permission-catalog.ts` (`PERMISSIONS`)
- **Seed/backfill normalization**:
  - `prisma/seed.ts`
  - `src/settings/settings.service.ts`
  - `src/auth/auth.service.ts`
- **Type safety improvement**:
  - `src/rbac/permissions.guard.ts` widened `includes()` arrays to `string[]` to avoid union narrowing issues.

## Verification commands
- **Build**
  - `npm run build`
- **Seed + governance verification**
  - `npm run prisma:seed`
- **Catalog/DB consistency check (Phase 6)**
  - `npm run rbac:verify-catalog`

## Expected outcomes
- `npm run build` succeeds.
- `npm run prisma:seed` succeeds and prints:
  - `Governance verification PASSED`
  - `GOVERNANCE CHECK – CREDIT NOTES & REFUNDS: PASSED`
- `npm run rbac:verify-catalog` prints:
  - `[verify-permission-catalog] OK: Catalog and DB are consistent.`

## Notes
- Non-permission string values (role names, checklist codes, tax codes, account codes) are intentionally **not** normalized.
