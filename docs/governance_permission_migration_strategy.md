# Governance Permission Migration Strategy

## Objective

Migrate from legacy module permissions and implicit admin patterns to canonical, domain-owned governance permissions.

This migration must:

- preserve behavior for existing tenants
- prevent new cross-domain leakage
- allow incremental rollout and auditing

## Canonical governance permissions

Canonical permissions are domain-scoped:

- `SYSTEM_GOVERNANCE_VIEW/MANAGE`
- `FINANCIAL_GOVERNANCE_VIEW/MANAGE`
- `SECURITY_GOVERNANCE_VIEW/MANAGE`
- ... (HR/CRM/Procurement/Inventory)

## Compatibility mapping approach

Compatibility mapping expands legacy permissions into canonical governance permissions.

Implementation:

- `backend/uspire-erp-backend/src/rbac/permissions.guard.ts`

Key properties:

- additive-only where possible
- explicit rules for visibility vs mutation authority
- `SYSTEM_VIEW_ALL` is constrained to **system governance visibility** only

## Phase plan

### Phase 0: Introduce canonical permission codes

- Add canonical permission codes to catalogs (backend + frontend).
- Add explicit escalation permissions:
  - `SUPER_ADMIN_GLOBAL`
  - `GLOBAL_GOVERNANCE_OVERRIDE`

### Phase 1: Add compatibility mapping and begin consuming canonical permissions

- Map legacy permissions to canonical domain permissions.
- Update domain-owned endpoints to accept canonical permissions.
- Remove usage of `SYSTEM_VIEW_ALL` from any finance/security authority checks.

### Phase 2: Remove mixed-domain legacy endpoints

- Deprecate mixed-domain endpoints (e.g. `PUT /settings/system`).
- Replace with domain-owned endpoints:
  - `PUT /settings/governance/system`
  - `PUT /settings/governance/financial`

### Phase 3: Seed and role cleanup

- Update seeds to assign canonical governance permissions.
- Remove legacy admin auto-grants where they introduce leakage.

### Phase 4: Governance enforcement strictness

- Enable `GOVERNANCE_STRICT_MODE=true` in staging.
- Monitor for blocked mixed-domain payloads and missing governance audit metadata.
- Promote to production after stability.

## Escalation model

Cross-domain authority is not implicit.

Only:

- `SUPER_ADMIN_GLOBAL`
- `GLOBAL_GOVERNANCE_OVERRIDE`

may authorize cross-domain operations.

All escalation operations must:

- require an explicit reason
- be audited with `CRITICAL` severity
- be visually distinguished in the UI

## Verification

Automated verification targets:

- `SYSTEM_VIEW_ALL` does not expand into finance authority (test enforced)
- mixed-domain mutations are warned/blocked
- critical governance actions emit complete governance audit metadata

Tests:

- `backend/uspire-erp-backend/src/rbac/permissions.guard.governance.spec.ts`
- `backend/uspire-erp-backend/src/governance/governance-enforcement.spec.ts`
