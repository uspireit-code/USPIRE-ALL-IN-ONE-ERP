# Intercompany Governance Architecture

This document describes the centralized intercompany governance enforcement implemented in the backend. The goal is to enforce legal entity segregation and intercompany accounting invariants consistently across all authoritative GL entry points.

## Objectives

- Centralize all intercompany validation in a single enforcement engine.
- Enforce explicit legal entity segregation using an auditable, per-user allowlist model.
- Enforce entity-level balancing and due-to / due-from mirrored positioning.
- Enforce elimination-ready reference requirements to support downstream reconciliation/elimination workflows.
- Produce standardized governance metadata for auditability and future escalation/override workflows.

## Core Components

## Intercompany Governance Registry

- **File**: `src/governance/intercompany-governance-registry.ts`
- **Role**: Declarative rule registry for intercompany governance.

The registry defines rule codes and their associated governance metadata, including:

- Applicable journal types / action types
- Severity and enforcement mode
- Balancing requirements
- Evidence / approval placeholders for future extension

Current rule codes:

- `ENTITY_PAIR_REQUIRED`
- `LEGAL_ENTITY_SCOPE_REQUIRED`
- `ENTITY_LEVEL_BALANCE`
- `DUE_TO_DUE_FROM_REQUIRED`
- `ELIMINATION_REFERENCE_REQUIRED`

## Intercompany Governance Engine

- **File**: `src/governance/intercompany-governance-engine.ts`
- **Entry point**: `assertIntercompanyGovernance(ctx)`

The engine:

- Applies registry rules based on the passed context.
- Emits standardized governance metadata via `buildGovernanceAuditMetadata(...)`.
- Throws `BadRequestException` with `code: INTERCOMPANY_GOVERNANCE_VIOLATION` when enforcement fails.

### Context contract

The engine accepts an `IntercompanyGovernanceContext` including:

- `tenantId`, `actorUserId`, `permissionUsed`
- `mode` (CREATE_DRAFT / UPDATE_DRAFT / UPLOAD / POST / REVERSE)
- `entityType`, `entityId`
- `journalType`, `reference`
- `governanceActions`
- `escalation`, `justificationText`
- `actorLegalEntityAccess` (explicit allowlist assignments)
- `lines[]` (each line includes `legalEntityId`, debit/credit, and intercompany account metadata)

### Explicit legal entity scope (segregation)

- **Authoritative model**: `UserLegalEntityAccess` (Prisma)
- **Enforcement rule**: `LEGAL_ENTITY_SCOPE_REQUIRED`

The engine validates that the actor has a non-expired `UserLegalEntityAccess` assignment for every `legalEntityId` used in the journal lines. If any are missing and no escalation is present, the engine blocks with a governance violation.

### Balancing invariants

The engine enforces:

- **Entity-level balancing**: each legal entity must net to zero.
- **Due-to / due-from mirrored positions**: due-to and due-from balances must mirror by entity based on COA intercompany role metadata.

### Elimination-ready foundation hooks

The engine computes and returns an `eliminationReady` payload (foundation hooks only):

- `reference`
- `reconciliationKey` (derived from reference if sufficiently stable)
- `distinctLegalEntityIds`
- `hasDueTo`, `hasDueFrom`

This does not implement consolidation/elimination workflows; it provides metadata for downstream processes.

## Governance Action Registry Integration

- **File**: `src/governance/governance-action-registry.ts`

Intercompany enforcement uses explicit action types so severity/escalation requirements are uniform:

- `INTERCOMPANY_BALANCE_VIOLATION`
- `INTERCOMPANY_LEGAL_ENTITY_SCOPE_VIOLATION`
- `INTERCOMPANY_ELIMINATION_REFERENCE_VIOLATION`

`buildGovernanceAuditMetadata(...)` uses this registry to populate:

- governance domain
- severity
- audit sensitivity
- escalation semantics

## Evidence Governance Integration

- **Files**:
  - `src/governance/evidence-governance-registry.ts`
  - `src/governance/evidence-governance-engine.ts`

Evidence governance already includes an intercompany rule:

- `INTERCOMPANY_JOURNAL`

This rule requires evidence and enforces evidence tagging via `evidenceCategory = INTERCOMPANY_SUPPORT`.

## Authoritative Enforcement Points

Intercompany governance is invoked from the GL service across all authoritative entry points, ensuring no bypass via alternative flows:

- Draft create
- Draft update
- Upload
- Recurring generation
- Reversal generation
- Final post
- Override post

- **File**: `src/gl/gl.service.ts`

`gl.service.ts` is responsible for assembling the context and loading `actorLegalEntityAccess` from Prisma, but does not implement intercompany rule logic itself.

## Data Model

- **Prisma schema**: `prisma/schema.prisma`

`UserLegalEntityAccess` is the authoritative, auditable model governing which legal entities a user can act upon:

- `tenantId`, `userId`, `legalEntityId`
- `accessLevel`
- `canPost`, `canApprove`, `canOverride`
- `grantedById`, `grantedAt`, `expiresAt`

## Operational Notes

- Enforcement is centralized in the governance engine; callers should not duplicate rule logic.
- Escalation/override is represented via `req.governanceEscalation` and is emitted into governance metadata.
- The system is designed to scale to delegation and automation by adjusting how actor context and legal entity access assignments are resolved.
