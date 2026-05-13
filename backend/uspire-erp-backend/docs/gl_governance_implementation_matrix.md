# GL Governance Implementation Matrix

Date: 2026-05-08

Columns:
- Capability
- Status
- Enforcement Layer
- Audit Coverage
- Remaining Risk
- Notes

---

| Capability | Status | Enforcement Layer | Audit Coverage | Remaining Risk | Notes |
|---|---|---|---|---|---|
| Immutability (POSTED journal header) | COMPLETE | Prisma middleware (`PrismaService`): blocks JournalEntry mutations when status is POSTED | `GL_JOURNAL_POST_BLOCKED` (blocked attempts) | Low | Immutability enforcement is centralized and regression-tested. |
| Immutability (POSTED journal lines) | COMPLETE | Prisma middleware: blocks JournalLine writes when parent JournalEntry is POSTED (clearance-only exception) | `GL_JOURNAL_POST_BLOCKED` (blocked attempts) | Low | Clearance-only fields allowed for bank recon; all other line changes blocked. |
| Lifecycle invariants (no direct REVIEWED/POSTED writes) | COMPLETE | Prisma middleware lifecycle guard + `withGlLifecycleBypass(...)` used only in governed transitions | `GL_LIFECYCLE_BYPASS_BLOCKED` (blocked attempts) | Low | Blocks create/update/upsert paths that set status to REVIEWED/POSTED without bypass. |
| Nested write protection (relation update) | COMPLETE | Prisma middleware scans nested `journalEntry` / `journalEntries` updates for status REVIEWED/POSTED | `GL_LIFECYCLE_BYPASS_BLOCKED` | Low | Newly regression-tested under `prisma-immutability.middleware.spec.ts`. |
| Transactional nested write coverage | COMPLETE | Same middleware enforcement (middleware invoked per client / tx client) | `GL_LIFECYCLE_BYPASS_BLOCKED` | Low | Spec includes invocation using a “tx client” mock to simulate transaction usage. |
| Review governance (manual review) | COMPLETE | Governed GL service lifecycle method uses `withGlLifecycleBypass` for REVIEWED transition | `GL_JOURNAL_REVIEWED` / related | Medium | Type-safety for `reviewMode` enum depends on Prisma client regeneration. |
| Review governance (system review) | COMPLETE | `GlService.systemReviewJournal(...)` sets REVIEWED under governed bypass | `GL_JOURNAL_SYSTEM_REVIEWED` | Medium | Same note: full typing cleanup post-generate. |
| Posting integrity (POSTED transition) | COMPLETE | Governed GL service post methods + middleware blocks direct POSTED writes | `GL_JOURNAL_POSTED` + block events | Low | Final sweep indicates no external direct POSTED writes remain. |
| SoD enforcement (maker-checker) | COMPLETE | Central SoD service checks (blocking conflicted lifecycle participation) | `GL_JOURNAL_SOD_VIOLATION_BLOCKED` (where available) | Medium | Enum typing still partially gated by Prisma client generation; functionality is present. |
| Override posting | PARTIAL | Governed GL service override path + permission gating | `GL_JOURNAL_OVERRIDE_POSTED` | Medium | Policy maturity (role matrix, override policy, enablement controls) not fully certified here. |
| Subledger governance routing | COMPLETE | Subledgers create SUBMITTED journals then route via `systemReviewJournal` → `postJournal` | Lifecycle and posting events | Low | Prior bypasses via direct REVIEWED creation have been removed. |
| Reversal workflows | COMPLETE | Governed GL reversal flows; immutability prevents edits to POSTED originals | Reversal events (`GL_JOURNAL_REVERSED` etc.) | Low | Reversal is the supported path for corrections to POSTED journals. |
| Audit trails (governance proof) | PARTIAL | Central audit writer + middleware emits blocked attempt events | Block events + lifecycle events | Medium | Needs runtime/UAT verification to confirm completeness of envelopes and coverage in all routes. |
| Period dependency readiness | PARTIAL | Posting/review depend on period guard/controls | Period events + lifecycle events | Medium | Period governance hardening explicitly out of scope for this certification phase. |

---

## Notes on Status Labels
- **COMPLETE**: enforcement is implemented, centralized, and regression-protected for bypass patterns.
- **PARTIAL**: core enforcement exists, but policy maturity, runtime verification, or type-safety cleanup is still pending.
- **NOT IMPLEMENTED**: no enforcement exists (none identified for core lifecycle/immutability).
