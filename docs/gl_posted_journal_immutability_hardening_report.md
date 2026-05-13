# GL Module — Posted Journal Immutability Hardening Report

## Objective
Enforce strict immutability of GL journals after posting. Once a journal is `POSTED`, it must be audit-safe and not editable/deletable. Corrections must be performed via governed reversal or adjustment flows, preserving permanent linkage and traceability.

## Summary of Enforcement
- Backend enforcement is implemented at the **Prisma layer** (middleware), ensuring coverage across:
  - Controllers/services
  - Upload engine
  - Recurring journal generation
  - Bank reconciliation flows
  - Any future mutation paths using Prisma

- When a blocked mutation is attempted:
  - API returns **403 Forbidden** with message:
    - `Posted journals are immutable. Use reversal or adjustment workflow.`
  - An audit event is written:
    - `AuditEventType.GL_JOURNAL_POST_BLOCKED`
    - `outcome = BLOCKED`

## Backend Controls Implemented

### 1) Prisma Immutability Middleware (authoritative)
**File:** `backend/uspire-erp-backend/src/prisma/prisma.service.ts`

Rules:
- `JournalEntry`
  - Block `update`, `delete`, `updateMany`, `deleteMany` when the target journal is `POSTED`.
- `JournalLine`
  - Block `update`, `delete`, `updateMany`, `deleteMany` when the parent journal is `POSTED`.

Exception (operational, non-financial):
- Allow `JournalLine` updates on `POSTED` journals **only if updating clearance fields**:
  - `cleared`
  - `clearedAt`
  - `bankStatementLineId`

Audit:
- Blocked attempts emit `GL_JOURNAL_POST_BLOCKED` with metadata including:
  - `model`
  - `prismaAction`
  - `attemptedKeys` (for line updates)
  - bulk scope hints for `updateMany/deleteMany`

Transaction safety:
- Middleware is **tx-aware** (uses dynamic Prisma client within `$transaction`).

### 2) Request Context Propagation (for correct audit attribution)
**Files:**
- `backend/uspire-erp-backend/src/internal/request-context.store.ts`
- `backend/uspire-erp-backend/src/tenant/tenant.middleware.ts`

Mechanism:
- Uses `AsyncLocalStorage` to make `req` available to Prisma middleware.
- Enables middleware to populate audit fields:
  - `tenantId`
  - `actorUserId`
  - `requestId`
  - `ipAddress`
  - `userAgent`

## Protected Endpoint / Mutation Matrix (GL)

### Direct GL Journal Mutations
- `POST /gl/journals` (create) — allowed
- `PUT /gl/journals/:id` (update draft) — allowed only for `DRAFT/REJECTED` by service logic; middleware prevents POSTED edits globally
- `POST /gl/journals/:id/submit` — workflow transition; not applicable to POSTED
- `POST /gl/journals/:id/review` — workflow transition; not applicable to POSTED
- `POST /gl/journals/:id/post` — sets to POSTED (allowed only from REVIEWED by service logic)
- `POST /gl/journals/:id/reverse` — creates a new reversal journal (no mutation of posted original)

### Upload / Recurring
- `POST /gl/journals/upload` — creates new journals only (no overwrite)
- Recurring generation — creates new `DRAFT` journals

### Bank Reconciliation
- Matching/unmatching updates clearance state on posted journal lines (allowed by exception).

## Journal Numbering / Posting Integrity
- Journal numbers are assigned at posting using a tenant sequence counter within a transaction.
- Prisma immutability middleware prevents any subsequent updates to `POSTED` `JournalEntry` records (protects numbering from edits).

## Known / Intentional Exceptions
- **Bank reconciliation clearance fields** on posted journal lines are mutable to support reconciliation workflows.
  - Financial fields (account/amount/dimensions) remain immutable.

## Remaining Validation (Runtime)
Manual runtime verification is still required to fully close the loop:
- Attempt to update/delete a `POSTED` journal or non-clearance line fields => expect 403 + `GL_JOURNAL_POST_BLOCKED` audit event.
- Bank recon match/unmatch => should still succeed.

## Files Changed / Added
- Added: `backend/uspire-erp-backend/src/internal/request-context.store.ts`
- Updated: `backend/uspire-erp-backend/src/tenant/tenant.middleware.ts`
- Updated: `backend/uspire-erp-backend/src/prisma/prisma.service.ts`

