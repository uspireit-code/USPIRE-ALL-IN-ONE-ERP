# GL Posted Journal Immutability — Final Freeze Verification Report

## Executive Summary
The GL posting model is now hardened to enforce **strict immutability** once a journal is `POSTED`.

Backend enforcement is centralized in the Prisma middleware and blocks all write mutations against `POSTED` journals and their lines across:
- direct service calls
- bulk operations (`updateMany`/`deleteMany`)
- transactions (`$transaction`)
- nested writes (`lines: { deleteMany/create }` patterns)
- upserts (`upsert`) (NEW)

The only permitted mutation on a `POSTED` journal is the **operational bank reconciliation clearance** update on `JournalLine`:
- `cleared`
- `clearedAt`
- `bankStatementLineId`

All blocked attempts:
- throw `ForbiddenException`
- write `AuditEventType.GL_JOURNAL_POST_BLOCKED` with `outcome=BLOCKED`
- include enriched attempted-mutation metadata (NEW)
- capture actor attribution even for non-HTTP executions (NEW)

## Changes Implemented (Freeze Phase)

### 1) Prisma `upsert` protection (NEW)
**File:** `backend/uspire-erp-backend/src/prisma/prisma.service.ts`

- Added `upsert` to the middleware write-action set.
- `JournalEntry.upsert`
  - Checks the target record; if existing status is `POSTED` => deny.
- `JournalLine.upsert`
  - Checks the targeted line (if exists) and its parent journal status.
  - If parent is `POSTED`:
    - allow only clearance-only updates
    - otherwise deny.

This closes the primary bypass class identified in the penetration audit.

### 2) Blocked mutation audit payload enrichment (NEW)
**File:** `backend/uspire-erp-backend/src/prisma/prisma.service.ts`

All `GL_JOURNAL_POST_BLOCKED` audit events now include:
- `model`
- `prismaAction`
- `where`
- `attemptedData` (for `update`, `updateMany`, and `upsert` update-branch)
- `attemptedKeys`

Notes:
- Accounting mutation values are not redacted.
- Audit writer stores this metadata in `AuditEvent.reason` as JSON.

### 3) Non-HTTP execution context support (NEW)
**File:** `backend/uspire-erp-backend/src/internal/request-context.store.ts`

- Expanded AsyncLocalStorage context to also carry:
  - `tenantId`, `actorUserId`, `requestId`, `ipAddress`, `userAgent`
- Added helper `runWithSystemContext({ tenantId, actorUserId?, requestId? }, fn)`
- Prisma middleware now uses fallbacks:
  - `actorUserId`: `SYSTEM`
  - `requestId`: `BACKGROUND_JOB`

This ensures blocked mutations originating from jobs/scripts/workers can still be audited with a consistent actor identity.

### 4) Immutability regression tests (NEW)
**File:** `backend/uspire-erp-backend/src/prisma/prisma-immutability.middleware.spec.ts`

Test coverage includes:
- `JournalEntry.update` blocked when `POSTED` + audit event created
- `JournalEntry.upsert` blocked when `POSTED`
- `JournalEntry.updateMany` blocked if filter would match any `POSTED`
- `JournalLine.update` clearance-only allowed on posted parent
- `JournalLine.upsert` blocked on posted parent when attempting non-clearance mutation + audit event created

## Test Results
Executed:
- `npm test`

Result:
- All tests passed (`5/5` suites, `19/19` tests).

## Coverage Matrix

### JournalEntry
- `update` => blocked if `POSTED` (middleware)
- `updateMany` => blocked if filter matches any `POSTED` (middleware; proactive probe)
- `delete` => blocked if `POSTED` (middleware)
- `deleteMany` => blocked if filter matches any `POSTED` (middleware; proactive probe)
- `upsert` => blocked if existing record is `POSTED` (NEW)

### JournalLine
- `update` => blocked if parent journal is `POSTED` unless clearance-only (middleware)
- `updateMany` => blocked if filter matches any line whose parent is `POSTED` (middleware)
- `delete` => blocked if parent journal is `POSTED` (middleware)
- `deleteMany` => blocked if filter matches any line whose parent is `POSTED` (middleware)
- `upsert` => blocked if targeted existing line’s parent is `POSTED` unless clearance-only (NEW)

### Transaction & nested write coverage
- `$transaction` => covered (middleware uses tx client)
- nested writes (`lines: { deleteMany/create }`) => covered (JournalEntry write denied when posted)

## Remaining Mutation Risks (Post-Freeze)

### Residual risks (Low)
- **Direct Prisma clients outside PrismaService** (e.g. scripts using `new PrismaClient()`):
  - This is structurally a bypass of middleware.
  - Current seed scripts do not appear to mutate journals.
  - Recommendation: enforce policy and/or a shared client factory for scripts.

### Residual risks (Operational)
- If future bulk reconciliation is implemented via `journalLine.updateMany` with clearance fields, current middleware will block it (it errs on safety). This is not a vulnerability; it is a future functional consideration.

## Final Confidence Assessment
**High confidence** that `POSTED` journals are immutable across all Prisma-based write paths, including:
- bulk operations
- nested writes
- transactions
- upserts

The system now provides:
- centralized enforcement
- explicit error behavior (`ForbiddenException`)
- consistent audit events with enriched attempted-mutation metadata
- actor attribution even in non-HTTP execution contexts

## Next Governance Work (Not Started)
Recommended next build sequence (post-freeze):
1. SoD hardening
2. Period governance
3. Upload governance
4. Journal-type validation engine

