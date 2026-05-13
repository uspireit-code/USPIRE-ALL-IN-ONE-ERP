# Evidence Governance Architecture

## Goals

- Enforce policy-driven evidence requirements consistently across posting, overrides, period governance actions, and uploads.
- Ensure evidence artifacts are governance-attached (domain/action/category/retention/sensitivity) rather than “generic file uploads”.
- Preserve and strengthen existing controls (SoD, lifecycle governance, escalation governance, audit traceability).
- Provide a scalable foundation for future governance domains (payroll, tax, procurement, statutory, automation evidence, intercompany).

## Key Concepts

### Evidence Governance Registry

File:
- `src/governance/evidence-governance-registry.ts`

Responsibilities:
- Defines evidence rules with:
  - rule code and display metadata
  - governance domain
  - severity / enforcement mode
  - evidence category and allowed attachment types
  - minimum evidence counts
  - justification and escalation requirements
  - retention classification and audit sensitivity
  - applicability filters (journal types, governance actions)

### Evidence Governance Engine

File:
- `src/governance/evidence-governance-engine.ts`

Entry point:
- `assertEvidenceGovernance(...)`

Responsibilities:
- Evaluate applicable rules for the provided governance context.
- Enforce:
  - minimum attachment counts
  - attachment type restrictions
  - justification requirements
  - escalation requirements
- Emit standardized governance metadata for audit traceability.

The engine is intended to be called from authoritative application workflows (posting, override, period reopen, upload) so evidence requirements cannot be bypassed by entering the system through an alternate API route.

## Data Model

### AuditEvidence

Prisma:
- `prisma/schema.prisma`

Responsibilities:
- Stores the immutable evidence artifact plus governance metadata.

Key fields (added/extended):
- `governanceDomain`
- `governanceActionType`
- `evidenceCategory`
- `retentionClassification`
- `auditSensitivity`
- `justificationText`

### AuditEvidenceLink

Prisma:
- `prisma/schema.prisma`

Responsibilities:
- Allows a single evidence artifact to be linked to multiple governed entities.
- Enables future expansion where one upload supports multiple downstream actions (batch → journals, overrides, escalations).

## Authoritative Enforcement Points

### Journal Posting / Posting Override

File:
- `src/gl/gl.service.ts`

Where:
- `postJournalCore(...)`

Behavior:
- Loads evidence linked to the journal (`AuditEvidenceLink` → `AuditEvidence`).
- Builds governance context (journal type, override, escalation signals).
- Calls `assertEvidenceGovernance(...)` before continuing with post.

### Period Reopen

File:
- `src/periods/periods.service.ts`

Behavior:
- Loads evidence linked to the accounting period (`AuditEvidenceLink`).
- Calls `assertEvidenceGovernance(...)` prior to executing reopen.

### Journal Upload

Files:
- `src/gl/gl.controller.ts`
- `src/gl/gl.service.ts`

Entity type:
- `JOURNAL_UPLOAD_BATCH` (added to `AuditEntityType`)

Behavior:
- Upload endpoint accepts optional `batchId` so evidence can be uploaded and linked to the batch before processing.
- Upload processing:
  - Loads evidence linked to the batch.
  - Calls `assertEvidenceGovernance(...)` for the upload batch prior to creating journals.
  - Propagates evidence links from the batch onto each created journal to ensure downstream posting has evidence attached.

## Upload / Evidence API

DTO updates:
- `src/audit/dto/audit-evidence-upload.dto.ts`
- `src/audit/dto/audit-evidence-query.dto.ts`

Behavior:
- Upload DTO accepts `JOURNAL_UPLOAD_BATCH` as an `entityType`.
- Upload DTO supports optional governance metadata fields to persist onto `AuditEvidence`.
- List/query reads evidence via `AuditEvidenceLink`.

## Retention & Future DMS Integration (Foundation)

- Retention and sensitivity fields are stored on the evidence artifact.
- Link table provides immutability of evidence association for audit.
- Future work can add:
  - archival workflows
  - legal hold
  - DMS offload with immutable reference

## Intercompany Evidence Foundation

- Governance actions can include intercompany-related action types.
- Rules can require specific intercompany support documentation.
- Upload-batch propagation supports attaching a shared support pack across multiple intercompany journals.
