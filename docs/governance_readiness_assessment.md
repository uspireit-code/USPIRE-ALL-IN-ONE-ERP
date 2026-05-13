# Governance Readiness Assessment

## Scope

This report assesses readiness for:

- Period Governance Hardening
- CRM module expansion
- HR module expansion
- Procurement module expansion
- Inventory module expansion

## Current strengths

- Domain boundary concept introduced and centralized in a Governance Domain Registry.
- Canonical governance permissions exist across backend and frontend catalogs.
- `SYSTEM_VIEW_ALL` semantics constrained in backend compatibility mapping.
- Domain-owned endpoints exist for system and financial governance.
- Mixed-domain legacy endpoint (`PUT /settings/system`) locked down behind explicit global override and env flag.
- Governance enforcement utilities added (metadata validation, cross-domain mutation detection).
- Frontend navigation and route guards hardened to remove finance/security authority inference from `SYSTEM_VIEW_ALL`.
- Governance regression tests exist for:
  - compatibility mapping constraint
  - governance enforcement strictness

## Remaining leakage risks

- Backend still contains `SYSTEM_VIEW_ALL` usage for read-only endpoints; acceptable but should be consistently treated as system governance visibility only.
- Escalation model is not yet enforced uniformly (mandatory reason + elevated audit severity for all cross-domain override usage).
- Audit metadata standard is implemented for settings governance but not yet pervasive across all modules (GL, period workflows, delegations, unlock flows).

## Architectural blockers

- AuditEvent persistence schema has no dedicated JSON `metadata` column; governance metadata is currently embedded inside `reason` JSON.
  - This is workable for now.
  - For compliance analytics and reporting at scale, first-class indexed fields may be needed later.

## Scalability risks

- Without a mandatory governance action registry adoption pattern for new modules, developers may reintroduce convenience endpoints and mixed-domain DTOs.
- Without a standard escalation UI pattern, operators may not understand when they are performing cross-domain actions.

## Readiness for Period Governance Hardening

Status: **GOOD with conditions**

Conditions to proceed:

- Period close/reopen/correct operations must emit standardized governance audit metadata (`PERIOD_CLOSE`, `PERIOD_REOPEN` actions).
- Period reopen must be treated as `CRITICAL`, requiring explicit reason and (future) approval workflows.

## Readiness for CRM / HR / Procurement / Inventory

Status: **MODERATE**

Required before expansion:

- Each module must declare:
  - governance domain ownership
  - canonical permissions
  - action registry entries with severity
  - lifecycle model
  - SoD implications
  - audit metadata standard adoption

## Governance Readiness Gate (module onboarding checklist)

Every new module PR should include:

- Domain assignment (`SYSTEM/FINANCIAL/SECURITY/HR/CRM/PROCUREMENT/INVENTORY`)
- Owner roles and escalation roles
- Canonical permissions (VIEW/MANAGE)
- Governance action registry entries for all privileged actions
- Audit metadata coverage for privileged actions
- Mixed-domain DTO protection (assertions/validators)
- Explicit escalation handling where required
- SoD checks for lifecycle-critical transitions
- Regression tests covering:
  - unauthorized access
  - attempted cross-domain mutation
  - missing governance metadata in strict mode

## Recommendation

Proceed with Period Governance Hardening after:

- period service audit metadata standardization is implemented
- escalation reason requirement is enforced for reopen/correct paths

Do not expand into additional enterprise modules until the Governance Readiness Gate is adopted as a release requirement.
