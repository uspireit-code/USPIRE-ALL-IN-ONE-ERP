# Fiscal Governance Consistency Report

## Scope

This report summarizes the current implementation state of fiscal period governance hardening, with a focus on:

- Period state model and canonical semantics
- Canonical posting guard usage (`assertPeriodAllowsPosting`)
- Retro-posting governance (`assertRetroPostingWithinToleranceOrEscalated`)
- Upload/import workflow governance readiness
- Legacy status handling (`CLOSED`)

## Canonical period state model

### Canonical states

Canonical states in code are:

- `OPEN`
- `SOFT_CLOSED`
- `HARD_CLOSED`
- `ARCHIVED`

Legacy state `CLOSED` is treated as a closed state (equivalent intent to `HARD_CLOSED`) for compatibility.

### Canonical status normalization

The canonical posting guard uses period status normalization (`toStatus(...)`) so that legacy values do not bypass governance.

## Canonical posting governance

### Canonical engine

All financial posting/reversal paths are intended to be gated by:

- `src/periods/period-posting-governance.ts` → `assertPeriodAllowsPosting(...)`

Semantics:

- `OPEN`: allowed
- `SOFT_CLOSED`: blocked unless the actor has `PERMISSIONS.PERIOD.SOFT_CLOSE_POST_OVERRIDE` and provides a governance reason; an escalation record is set (`PERIOD_SOFT_CLOSE_POST_OVERRIDE`)
- `HARD_CLOSED` / `ARCHIVED`: blocked

### Legacy guard deprecation

The legacy period guard helpers in `src/periods/period-guard.ts` were deprecated by replacing them with stubs that throw and redirect usage toward the canonical engine (`assertPeriodAllowsPosting`).

## Retro-posting governance

### Canonical retro-post control

Retro-posting is enforced using:

- `src/periods/retro-posting-governance.ts` → `assertRetroPostingWithinToleranceOrEscalated(...)`

Semantics:

- If `postingDate` is older than `toleranceDays` relative to "now":
  - Block unless a governance escalation context is present/allowed
  - When permitted, an escalation is set (`RETRO_POSTING_OVERRIDE`) with governance reason

The helper is `req`-optional; without a request context it behaves conservatively and blocks overrides.

## Upload / import workflow readiness

### GL journal upload

- Endpoint: `POST /gl/journals/upload`
- Service: `GlService.uploadJournals(...)`

Controls applied:

- Period-state posting control: `assertPeriodAllowsPosting(...)` per uploaded journal date
- Retro-post tolerance control: `assertRetroPostingWithinToleranceOrEscalated(...)` per uploaded journal date
- Cutover lock control: opening balances cutover date enforcement blocks operational postings before cutover

Status: **Compliant**

### AP/AR/Payments posting flows

Transactional posting flows were updated to:

- Use `assertPeriodAllowsPosting(...)` for period-state gating
- Enforce retro-post tolerance via `assertRetroPostingWithinToleranceOrEscalated(...)`
- Attach governance override metadata to audit events via governance helpers

Status: **Compliant**

### AR invoice import

- Endpoint: `POST /finance/ar/invoices/import`
- Behavior: creates draft invoices (does not post to GL)

Controls applied:

- Enforces that the invoice date falls within an allowed period using `assertPeriodIsOpen(...)` via `assertOpenPeriodForInvoiceDate(...)`

Note:

- Import currently calls the period guard without passing `req`, which means **no SOFT_CLOSED override is possible** via headers during import creation. This is a conservative posture.

Status: **Compliant (conservative)**

### Other imports

- Customer import, Supplier import, COA import: master-data operations; do not create posted financial transactions.

Status: **Not applicable to period posting governance**

## Cutover date locking consistency

Opening Balances period cutover locking checks were hardened to treat the following as locked/closed:

- `CLOSED`
- `HARD_CLOSED`
- `ARCHIVED`

This removed multiple `status === 'CLOSED'` islands.

## Remaining risks / follow-ups

- Ensure any future bulk transaction endpoints (file-based or API-based) that *directly* create posted journals also call:
  - `assertPeriodAllowsPosting(...)`
  - `assertRetroPostingWithinToleranceOrEscalated(...)`
- Consider whether draft-creation imports should ever support SOFT_CLOSED override. If yes, pass `req` through to the guard and require governance reason headers.

## Summary

- Canonical posting governance is centralized in `assertPeriodAllowsPosting`.
- Retro-posting governance is enforced via `assertRetroPostingWithinToleranceOrEscalated`.
- Upload/import workflows were audited; GL journal upload was patched to enforce retro-post tolerance.
- Cutover lock semantics are consistent across canonical closed states.
