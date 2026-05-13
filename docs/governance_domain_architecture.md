# Governance Domain Architecture

## Objectives

This document describes the governance architecture used to prevent cross-domain authority leakage as the ERP scales into additional modules (CRM, HR, Procurement, Inventory, Payroll).

Primary goals:

- Domain ownership boundaries are explicit.
- Cross-domain authority is never implicit.
- Audit metadata is standardized and validated.
- Governance regression is detected early via automated tests.

## Governance Domains

Governance domains represent the authoritative owner for configuration, controls, and risk decisions.

Canonical domains:

- `SYSTEM_GOVERNANCE`
- `FINANCIAL_GOVERNANCE`
- `SECURITY_GOVERNANCE`
- `HR_GOVERNANCE`
- `CRM_GOVERNANCE`
- `PROCUREMENT_GOVERNANCE`
- `INVENTORY_GOVERNANCE`

Domain definitions live in:

- `backend/uspire-erp-backend/src/governance/governance-domain-registry.ts`

Each domain definition includes:

- `displayName`
- `description`
- `ownerRoles`
- `governanceScope` (`TENANT` vs `GLOBAL`)
- sensitivity indicators (`auditSensitivity`, `approvalSensitivity`)

## Permission Model

### Canonical governance permissions

Each domain has canonical view/manage permissions:

- `SYSTEM_GOVERNANCE_VIEW`, `SYSTEM_GOVERNANCE_MANAGE`
- `FINANCIAL_GOVERNANCE_VIEW`, `FINANCIAL_GOVERNANCE_MANAGE`
- `SECURITY_GOVERNANCE_VIEW`, `SECURITY_GOVERNANCE_MANAGE`
- ... (HR/CRM/Procurement/Inventory)

These are defined in:

- Backend: `src/rbac/permission-catalog.ts`
- Frontend: `frontend/src/auth/permission-catalog.ts`

### Legacy compatibility mapping

A compatibility mapping expands legacy permissions into canonical governance permissions, while preventing implicit cross-domain authority.

Key invariants:

- `SYSTEM_VIEW_ALL` is treated as **system governance visibility only**.
- `SYSTEM_VIEW_ALL` must never grant finance authority or security governance authority.
- Cross-domain authority requires explicit escalation permissions.

Mapping implementation:

- `backend/uspire-erp-backend/src/rbac/permissions.guard.ts`

## Governance Enforcement Automation

### Governance Action Registry

All critical governance actions should be registered centrally with domain and severity metadata.

Registry:

- `backend/uspire-erp-backend/src/governance/governance-action-registry.ts`

Each action defines:

- `governanceDomain`
- `severity` (`LOW|MEDIUM|HIGH|CRITICAL`)
- `requiresApproval`
- `requiresEscalation`
- `requiresReason`
- `auditSensitivity`

### Governance severity model

Severity taxonomy:

- `LOW`: branding-only / cosmetic
- `MEDIUM`: tenant/system configuration that changes UX behavior
- `HIGH`: financial controls / permissions / access model changes
- `CRITICAL`: period reopen, role-permission changes, override posting, COA unlock

Implementation:

- `backend/uspire-erp-backend/src/governance/governance-severity.ts`

### Enforcement helpers

Reusable utilities:

- `buildGovernanceAuditMetadata(...)`
- `assertGovernanceMetadataComplete(...)`
- `detectGovernanceDomainsFromPayload(...)`
- `assertNoCrossDomainMutation(...)`

Implementation:

- `backend/uspire-erp-backend/src/governance/governance-enforcement.ts`

Strictness:

- `GOVERNANCE_STRICT_MODE=true` causes missing governance metadata and cross-domain mutations to be blocked.
- Non-strict mode logs warnings in non-production environments.

## Cross-domain DTO / mutation protection

Every endpoint that mutates configuration must:

- declare or infer the governance domain(s) touched
- block mixed-domain payloads unless explicitly escalated

The initial implementation is integrated in Settings governance mutations:

- `SettingsService.updateSystemGovernance`
- `SettingsService.updateFinancialGovernance`

## Audit standard

### Required governance audit metadata

Minimum standard for governance-aware audit events:

- `governanceDomain`
- `governanceActionType`
- `severity`
- `permissionUsed`
- `actorUserId`
- `tenantId`
- `requestId`
- `changedKeys`
- `before` / `after`

Current storage:

- Governance metadata is embedded as JSON inside `AuditEvent.reason` (schema has no `metadata` column).

## Frontend consistency protections

Frontend must not imply authority that backend will deny.

Rules:

- Finance pages and routes must not be shown based on `SYSTEM_VIEW_ALL`.
- Security governance actions must require explicit permissions (user/role/delegation).
- System governance visibility is granted by canonical system governance permissions (or legacy system view permissions).

Key hardened areas:

- Navigation: `frontend/src/components/Layout.tsx`
- Route guards: `frontend/src/App.tsx`
- Settings landing gating: `frontend/src/pages/settings/SettingsPage.tsx`

## Regression protection

Governance-focused tests are expected for:

- cross-domain mutation blocking
- strict governance metadata validation
- `SYSTEM_VIEW_ALL` compatibility mapping does not expand into finance authority

Initial tests:

- `backend/uspire-erp-backend/src/governance/governance-enforcement.spec.ts`
- `backend/uspire-erp-backend/src/rbac/permissions.guard.governance.spec.ts`
