# Automation Governance UX Architecture

## Purpose
This document defines the enterprise Automation Governance UX architecture for USPIRE ERP.

The objective is **governance-transparent automation operations UX** where automation remains:

- Reviewable
- Auditable
- Suspension-aware
- Escalation-aware
- Override-aware
- Evidence-aware
- Operationally transparent

This UX layer must remain compatible with future:

- AI-assisted automation
- Supervisory review
- Anomaly analytics
- Automation approval workflows
- Governance dashboards
- Automation observability
- Enterprise operations monitoring

This architecture explicitly avoids:

- Simplistic scheduler pages
- Hidden automation behavior
- Generic cron-style dashboards
- Convenience-first automation UI

## Guiding Principles

### 1) Governance is authoritative
The UI **does not decide governance**. It renders governance state and submits supervised requests.

- Governance decisions are enforced by backend governance engines and policies.
- UI actions are always traceable (audit events, execution sessions, schedule lifecycle transitions).

### 2) Supervised orchestration only
The UX provides explicit controls for supervised orchestration and prevents accidental mass execution.

- Dry-run mode first
- Explicit execution confirmation
- Clear display of governance eligibility + violations

### 3) Lifecycle-governed schedules are operational entities
Schedules are not cron entries. They are lifecycle entities with:

- Status
- Timing
- Failure counters
- Suspension state
- Expiry and revocation
- Execution history

### 4) Execution sessions are the observability unit
Execution sessions are the audit-defensible record of:

- Who triggered the automation (actor type)
- When it started/completed
- Result payload and/or failure
- Governance metadata
- Evidence linkage
- Override linkage
- Escalation metadata

### 5) Governance isolation
Automation governance pages must be gated strictly by:

- `GOVERNANCE.FINANCIAL.VIEW`
- `GOVERNANCE.FINANCIAL.MANAGE`

Visibility must **not** be granted by:

- SYSTEM-level view permissions
- Generic admin visibility
- Unrelated finance permissions

## Information Architecture

### Routes
Primary routes:

- `/settings/governance/automation`
  - Central dashboard
  - Cross-linked schedules + executions
  - Supervised sweep orchestration

- `/settings/governance/automation/schedules/:id`
  - Lifecycle schedule detail
  - Actions: suspend/resume/revoke/execute
  - Execution history
  - Governance metadata + schedule config

- `/settings/governance/automation/executions/:id`
  - Execution drill-down
  - Timeline, evidence/override/escalation
  - Governance metadata
  - Execution result payload

### Page Responsibilities

#### Automation Governance Dashboard
Primary goals:

- Show schedule state distribution
- Show execution activity distribution
- Surface failures and suspensions
- Surface pending reviews
- Surface override/evidence linkage
- Surface expirations
- Provide supervised sweep orchestration UI

Key components:

- Overview summary cards
- Schedules table (status, timing, failures)
- Recent execution activity table (severity, status, indicators)
- Sweep panel (dry-run + execute)

#### Schedule Management UX
Primary goals:

- Make lifecycle state visible and actionable
- Ensure actions are supervised, auditable, and permission-scoped

Required data:

- `scheduleStatus` and lifecycle timestamps
- `consecutiveFailureCount`, `lastFailureReason`
- `nextRunAt`, `lastRunAt`, `expiresAt`
- `automationCode`, target identifiers
- `scheduleConfig`

Actions:

- Suspend (audited reason)
- Resume
- Revoke (audited reason)
- Execute manually (supervised)
- Inspect execution history

#### Execution Session Visibility UX
Primary goals:

- Make executions observable
- Provide drill-down to the exact captured metadata

Required data:

- `executionStatus`, `startedAt`, `completedAt`
- `overrideSessionId`
- `evidenceMetadata`
- `escalationType`, `escalationReason`
- `governanceMetadata`
- `executionResult`

Filtering model (future-ready):

- automationCode
- severity
- status
- schedule
- governance domain
- date range

## Governance Severity & Escalation UX

### Severity
Severity must be visually obvious:

- LOW
- MODERATE
- HIGH
- CRITICAL

Critical events must be prominent:

- High-contrast badge
- Strong weight typography
- Warning and confirmation messaging for supervised execution

### Escalation
Escalation must never be hidden:

- Explicit indicator pills
- Drill-down to escalation type/reason

## Override & Evidence Visibility

### Override visibility
Override usage must remain audit-defensible:

- Presence indicator on dashboards
- Drill-down to `overrideSessionId`
- Explicit labeling (override-linked execution)

### Evidence visibility
Evidence requirements must remain visible:

- Presence indicator on dashboards
- Drill-down into evidence metadata payload

## Supervised Sweep UX

### Endpoint
- `POST /governance/automation-schedules/sweep-due`

### UX requirements

- Dry-run mode by default
- Explicit execute toggle gated by manage permission
- Confirmation prompt for execute mode
- Clear list of:
  - Due schedules
  - Governance eligible vs blocked
  - Violation details
  - Execution outcome summaries

### Failure handling

- No silent failures
- Errors presented immediately
- Results persisted in the UI until refresh

## Data Integration

### Frontend services
- `src/services/automationSchedules.ts`
- `src/services/automationExecutions.ts`

### Core backend endpoints
Schedules:

- `GET /governance/automation-schedules`
- `GET /governance/automation-schedules/:id`
- `POST /governance/automation-schedules/:id/suspend`
- `POST /governance/automation-schedules/:id/resume`
- `POST /governance/automation-schedules/:id/revoke`
- `POST /governance/automation-schedules/:id/execute`

Executions:

- `GET /governance/automation-executions`
- `GET /governance/automation-executions/:id`

Sweep:

- `POST /governance/automation-schedules/sweep-due`

## Permissions Model

### Route gating
All automation governance pages must use frontend route guards requiring:

- `GOVERNANCE.FINANCIAL.VIEW` OR `GOVERNANCE.FINANCIAL.MANAGE`

### Action gating
Mutation actions require:

- `GOVERNANCE.FINANCIAL.MANAGE`

Includes:

- Suspend
- Resume
- Revoke
- Execute
- Sweep execute mode

## Future-readiness

The architecture is designed for:

- AI advisory overlays (non-authoritative)
- anomaly detection panels (read-only insights)
- approval workflows (review-required state transitions)
- governance dashboards (aggregations by severity/domain)
- automation observability (trend analytics, heatmaps)

## Non-negotiables

This UX must not weaken:

- Lifecycle governance
- Override governance
- Evidence governance
- Fiscal governance
- Intercompany governance
- Audit traceability
- Governance isolation
- Supervised orchestration
