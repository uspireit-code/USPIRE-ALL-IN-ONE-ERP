# GL Runtime Validation Checklist (Governance Core)

Date: 2026-05-08

Scope: runtime validation + Prisma regeneration + typing cleanup + migration verification for the already-implemented GL governance core.

Constraints:
- No new governance features.
- This package is operational verification only.

---

## 1) Exact Command Sequence (npm)

All commands below are run from:
- `backend/uspire-erp-backend`

### 1.1 Pre-flight
1. `npm ci`
   - Use `npm install` instead if you are not using lockfile-based installs.

2. (Optional) `npm run rbac:verify-catalog`
   - Ensures permission catalog integrity before runtime tests.

### 1.2 Migration verification + application
This repo uses safe wrappers:
- `npm run prisma:migrate:apply`
- `npm run prisma:reconcile`

Recommended sequence:
1. `npm run prisma:reconcile`
   - Purpose: verifies local migration history alignment.
   - Failure condition: reconcile errors -> stop and fix migration history mismatch before apply.

2. `npm run prisma:migrate:apply`
   - Purpose: applies pending migrations using `scripts/prisma-migrate-safe.ts`.

### 1.3 Prisma client regeneration
1. `npm run prisma:generate`

### 1.4 Build / typecheck
1. `npm run build`
   - `nest build` performs TS compilation for the app.

### 1.5 Jest tests
1. `npm test`
   - Runs Jest unit tests (including Prisma middleware regression tests).

Optional:
- `npm run test:cov`

### 1.6 Targeted runtime verification (manual, controlled)
Start the backend in a dedicated terminal:
1. `npm run dev`

Then execute the runtime scenarios below via your normal API tooling (Postman/Insomnia/curl) and DB inspection.

---

## 2) Prisma Type Finalization (Post-generate)

After `npm run prisma:generate`, remove the remaining governance-related type workarounds.

### 2.1 Targets to finalize
- `JournalReviewMode` enum typing
- `JournalEntry.reviewMode` field typing
- `AuditEventType.GL_JOURNAL_SOD_VIOLATION_BLOCKED`
- Remaining `as any` casts used only because the client was stale

### 2.2 Concrete cleanup items

#### A) `src/gl/gl.service.ts`
Current (temporary):
- `reviewMode: 'MANUAL_REVIEW' as any`
- `reviewMode: 'SYSTEM_REVIEW' as any`

Post-generate replace with:
- `reviewMode: JournalReviewMode.MANUAL_REVIEW`
- `reviewMode: JournalReviewMode.SYSTEM_REVIEW`

and add import:
- `import { JournalReviewMode } from '@prisma/client';`

#### B) `src/sod/sod.service.ts`
Current (temporary):
- `((AuditEventType as any).GL_JOURNAL_SOD_VIOLATION_BLOCKED as any)`

Post-generate replace with:
- `AuditEventType.GL_JOURNAL_SOD_VIOLATION_BLOCKED`

#### C) Confirm no remaining lifecycle-audit casts
Already finalized:
- `src/prisma/prisma.service.ts` now uses `AuditEventType.GL_LIFECYCLE_BYPASS_BLOCKED` without casts.

### 2.3 Failure conditions
- If `JournalReviewMode` or `GL_JOURNAL_SOD_VIOLATION_BLOCKED` still do not appear in generated client after `prisma:generate`, stop and verify:
  - migration applied successfully
  - `schema.prisma` contains the enum
  - client generation is pointing at the correct `schema.prisma`

---

## 3) Runtime Lifecycle Verification Scenarios

### A) Lifecycle governance

#### A1) Manual review + post (happy path)
Steps:
1. Create a journal as a normal user (expect `DRAFT`).
2. Submit the journal (expect `SUBMITTED`).
3. Reviewer (different user) manually reviews (expect `REVIEWED`, `reviewMode = MANUAL_REVIEW`).
4. Poster posts (expect `POSTED`).

Expected results:
- Status transitions only via GL governed endpoints/services.
- Journal transitions appear in audit trail:
  - `GL_JOURNAL_SUBMITTED`
  - `GL_JOURNAL_REVIEWED`
  - `GL_JOURNAL_POSTED`

Failure conditions:
- Any ability to set `status = REVIEWED/POSTED` via generic update endpoints or nested writes.

#### A2) System review + post (system flow)
Steps:
1. Trigger a subledger flow that creates a journal as `SUBMITTED`.
2. Ensure it routes through `systemReviewJournal` then post.

Expected results:
- Journal reaches `REVIEWED` with `reviewMode = SYSTEM_REVIEW`.
- Audit event emitted:
  - `GL_JOURNAL_SYSTEM_REVIEWED`

#### A3) Override post
Steps:
1. Attempt to post a journal in a way that requires override (using the privileged path / override permission).

Expected results:
- Journal posts only if override policy allows.
- Audit event emitted:
  - `GL_JOURNAL_OVERRIDE_POSTED`

Failure conditions:
- Override post without audit reason / metadata.

---

### B) Immutability enforcement

#### B1) Blocked POSTED edits (direct)
Steps:
1. Pick a `POSTED` journal.
2. Attempt to update header fields directly via any endpoint that would cause a Prisma `JournalEntry.update`.

Expected results:
- Operation blocked (`ForbiddenException`).
- Audit event emitted:
  - `GL_JOURNAL_POST_BLOCKED`

#### B2) Blocked POSTED deletes
Steps:
1. Attempt delete on a POSTED journal.

Expected results:
- Blocked (`ForbiddenException`).
- `GL_JOURNAL_POST_BLOCKED` emitted.

#### B3) Blocked nested writes (relation update)
Steps:
1. Attempt to update a non-journal entity while nested-updating `journalEntry.status = REVIEWED` or `POSTED`.

Expected results:
- Blocked (`ForbiddenException`).
- Audit event emitted:
  - `GL_LIFECYCLE_BYPASS_BLOCKED`

---

### C) SoD enforcement

#### C1) Self-approval blocked
Steps:
1. User creates + submits a journal.
2. Same real user attempts to approve/review/post (as disallowed by policy).

Expected results:
- Blocked with SoD error.
- Audit event emitted:
  - `GL_JOURNAL_SOD_VIOLATION_BLOCKED` (once Prisma client typing is finalized)

#### C2) Self-post blocked
Same as above for posting.

#### C3) Override allowed with governance
Steps:
1. Privileged user performs override where allowed.

Expected results:
- Allowed only under override permission.
- `GL_JOURNAL_OVERRIDE_POSTED` audit emitted.

---

### D) Audit verification
For each scenario above, confirm:
- audit row exists
- `tenantId`, `actorUserId`, `requestId` captured
- metadata includes lifecycle context (journalId, attempted keys for blocked events)

Required audit events to confirm in DB:
- `GL_JOURNAL_POST_BLOCKED`
- `GL_LIFECYCLE_BYPASS_BLOCKED`
- `GL_JOURNAL_OVERRIDE_POSTED`
- `GL_JOURNAL_SYSTEM_REVIEWED`
- `GL_JOURNAL_REVERSED`

---

### E) Reconciliation exception path
Purpose: confirm bank reconciliation clearance updates remain allowed even when journal is POSTED.

Steps:
1. Use a POSTED journal line tied to bank recon.
2. Perform clearance update setting only:
   - `cleared`
   - `clearedAt`
   - `bankStatementLineId`

Expected results:
- Allowed (no ForbiddenException).
- No immutability block audit is emitted for this clearance-only update.

Failure conditions:
- Clearance-only update blocked.
- Non-clearance updates allowed on POSTED lines.

---

## 4) Migration Verification Assessment (Postgres)

### 4.1 Migration ordering notes
Relevant migrations identified:
- `20260507100000_gl_sod_audit_events` (adds audit enum values: override + SoD blocked)
- `20260508101000_journal_review_mode_and_lifecycle_audit`
  - Adds enum values:
    - `ALTER TYPE "AuditEventType" ADD VALUE 'GL_JOURNAL_SYSTEM_REVIEWED'`
    - `ALTER TYPE "AuditEventType" ADD VALUE 'GL_LIFECYCLE_BYPASS_BLOCKED'`
  - Adds enum type:
    - `CREATE TYPE "JournalReviewMode" ...`
  - Adds column:
    - `ALTER TABLE "JournalEntry" ADD COLUMN "reviewMode" ...`

Ordering requirement:
- The migrations that add enum values must be applied **before** runtime code attempts to write those event types.

### 4.2 Enum expansion safety (Postgres)
- `ALTER TYPE ... ADD VALUE` is generally safe and forward-only.
- Rollback limitation: enum values are not trivially removable; rollback usually requires creating a new enum type and migrating columns.

### 4.3 Deployment sequencing requirements
Recommended operational sequencing:
1. Apply DB migrations first (`npm run prisma:migrate:apply`).
2. Regenerate Prisma client (`npm run prisma:generate`).
3. Build + tests (`npm run build`, `npm test`).
4. Deploy app runtime.

### 4.4 Prisma compatibility risks
- If Prisma client is not regenerated after schema changes, TypeScript will not reflect new enum members/fields, leading to:
  - temporary casts
  - potential runtime mismatches if code expects values not present in DB

---

## 5) Rollback Notes (Operational)

- **DB enum changes are forward-only** in typical Postgres operations.
- If a rollback is required:
  - application rollback is possible (deploy previous app), but DB will retain the expanded enums and new nullable column.
  - DB rollback requires manual enum type recreation; treat as high-risk.

Operational recommendation:
- Take a DB backup (or snapshot) prior to applying migrations in production.
