# Journal Type Governance Architecture

## Goal
Establish a centralized, policy-driven journal-type validation engine that enforces governance rules consistently across *all* journal entry points (manual draft creation, draft update, uploads, recurring generation, and reversals).

Key objectives:
- A canonical registry defining governance behavior per journal policy type.
- A single enforcement function (`assertJournalTypePolicy(...)`) invoked from every relevant workflow.
- Standardized governance metadata emitted for auditability and future escalation workflows.
- A scalable design that can expand policy types without immediate database migrations.

## Key Building Blocks

### 1) Prisma Journal Type (database enum)
The database uses Prisma enum `JournalType` on `JournalEntry.journalType`.

This enum is a *persistence* concern and may remain relatively small.

### 2) Canonical Journal-Type Registry (`JOURNAL_TYPE_REGISTRY`)
**File**: `src/gl/journal-type-registry.ts`

This registry defines *policy types* (`JournalPolicyTypeCode`) and their governance rules.

A policy definition (`JournalTypePolicyDefinition`) currently contains:
- `code`, `displayName`, `description`
- `governanceSensitivity`
- `sourceModule`
- `automationAllowed`
- `requiredDimensions`
- `requiredEvidence`
- `reversalRules`
- `postingRules` (e.g. opening period allowance)
- `approvalRequirements`

**Important**: `JournalPolicyTypeCode` is the canonical governance taxonomy. It is intentionally decoupled from the Prisma `JournalType` enum to allow governance expansion over time.

### 3) Journal-Type Policy Engine (`assertJournalTypePolicy`)
**File**: `src/gl/journal-type-policy-engine.ts`

The engine provides:
- `resolveJournalPolicyType(...)`
  - Maps a journal’s runtime attributes to a canonical `JournalPolicyTypeCode`.
  - Current mapping inputs:
    - `prismaJournalType` (Prisma `JournalType`)
    - `periodType` (e.g. `OPENING`)
    - `reversalOfId`
    - `reference`
    - `sourceType`

- `assertJournalTypePolicy(ctx)`
  - Central enforcement entry point.
  - Throws a `BadRequestException` with:
    - `code: 'JOURNAL_TYPE_POLICY_VIOLATION'`
    - a human readable `message`
    - a `governance` object returned by `buildGovernanceAuditMetadata(...)`

#### Policy assertion context
The `JournalTypePolicyContext` is intentionally explicit so all enforcement calls are traceable:
- Actor and authorization metadata
  - `tenantId`
  - `actorUserId`
  - `permissionUsed`
  - `req?` (optional, enables enriched governance metadata)
- Mode / entry-point metadata
  - `mode`: `CREATE_DRAFT | UPDATE_DRAFT | UPLOAD | REVERSE | POST`
- Journal attributes
  - `journalDate`
  - `prismaJournalType`
  - `periodType?`
  - `reversalOfId?`
  - `reference?`, `description?`
  - `sourceType?`, `sourceId?`
- Posting surface
  - `lines[]` with `accountId` and dimensions (`legalEntityId`, `departmentId`, `projectId`, `fundId`)

#### What is enforced (current)
- **Reversal integrity**
  - Reversal policy requires `reversalOfId`.
  - Reversal policy requires `journalType = REVERSING`.
- **Opening period restrictions**
  - If `periodType === 'OPENING'`, policy must explicitly allow opening period posting.
- **Required dimensions**
  - Enforces missing dimension checks for:
    - `LEGAL_ENTITY`, `DEPARTMENT`, `PROJECT`, `FUND`
- **Evidence hooks (placeholder enforcement)**
  - If policy indicates evidence is required, enforcement currently blocks with a clear message.
  - This is a governance hook until an evidence subsystem is fully integrated.
- **Upload source restrictions**
  - Upload cannot produce `SYSTEM_GENERATED_JOURNAL`.

## Integration Points (GlService)
**File**: `src/gl/gl.service.ts`

`assertJournalTypePolicy(...)` is invoked in the following paths:

### Manual journal draft creation
- **Method**: `createDraftJournal`
- **Mode**: `CREATE_DRAFT`
- **Notes**:
  - Runs after cutover and period posting validation.
  - Uses `dto.journalType ?? 'STANDARD'`.

### Manual draft update
- **Method**: `updateDraftJournal`
- **Mode**: `UPDATE_DRAFT`
- **Notes**:
  - Validates proposed date (falls back to existing date when not supplied).
  - Enforces cutover + period posting governance for the proposed date.
  - Enforces opening-balance account restrictions when applicable.
  - Applies `assertJournalTypePolicy` before persisting updates.

### Upload journals
- **Method**: `uploadJournals`
- **Mode**: `UPLOAD`
- **Notes**:
  - Upload parsing accepts Prisma journal types (not hardcoded to `STANDARD`).
  - Policy violations are collected into the upload error list and block commit.

### Reverse posted journal
- **Method**: `reversePostedJournal`
- **Mode**: `REVERSE`
- **Notes**:
  - Enforces reversal policy (must be `REVERSING`, must reference original).
  - Enforces dimension completeness on reversal lines.

### Recurring generation
- **Method**: `generateJournalFromRecurringTemplate`
- **Mode**: `POST`
- **Notes**:
  - Recurring templates currently generate `STANDARD` journals.
  - Enforces period posting governance and journal-type policy for the run date.

## Governance Metadata & Auditability
Policy violations are raised via `throwPolicyViolation(...)`, which wraps:
- A governance action type (from `src/governance/governance-action-registry.ts`)
- Enriched metadata via `buildGovernanceAuditMetadata(...)`

This standardizes:
- Who acted
- Under what permission
- In which workflow mode
- What journal attributes were being asserted
- Which policy type and sensitivity applied

## Extensibility Model
This design supports incremental expansion:
- Add new canonical policy types in `JournalPolicyTypeCode` + `JOURNAL_TYPE_REGISTRY`.
- Extend `resolveJournalPolicyType(...)` to map additional runtime signals to those policy types (e.g., `sourceType`, `sourceId`, posting module).
- Add deeper policy enforcement without changing workflow call sites (call sites only provide context).

## Known Gaps / Future Work
- Evidence/attachments subsystem integration (replace the current enforcement placeholder with actual evidence checks).
- Approval sensitivity integration (policy defines approval requirements, but enforcement is not yet wired into approval workflows).
- Dimension requirements per module / per account category (registry allows it; enforcement can be expanded).
- Additional journal policy types mapped from `sourceType` / module-originated postings.
