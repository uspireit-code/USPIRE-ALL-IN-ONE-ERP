# Governance KPI Engine Architecture

## Purpose
This document defines the **governance KPI engine + governance analytics foundation** for USPIRE ERP.

The intent is to build **analyzable governance infrastructure** (not superficial dashboards) where governance controls, automation, overrides, evidence, and operational risk become:

- measurable
- trendable
- drillable
- severity-aware
- governance-domain aware
- explainable and traceable to source entities

This infrastructure is explicitly designed to support future **AI advisory** features, without delegating governance authority to AI.

## Non-negotiables

This architecture must not weaken:

- governance isolation
- lifecycle governance
- override governance
- evidence governance
- audit traceability
- supervised orchestration
- entity segregation

## High-level Architecture

### Components

1. **KPI Registry** (declarative definitions)
   - `backend/uspire-erp-backend/src/governance/kpi-governance-registry.ts`

2. **KPI Compute Engine** (central calculation)
   - `backend/uspire-erp-backend/src/governance/governance-kpi-engine.ts`

3. **Governance Analytics API Layer**
   - `backend/uspire-erp-backend/src/governance/governance-analytics.controller.ts`
   - `backend/uspire-erp-backend/src/governance/governance-analytics.service.ts`

4. **Frontend Governance Analytics UX**
   - `frontend/src/pages/settings/governance/GovernanceAnalyticsPage.tsx`
   - `frontend/src/services/governanceAnalytics.ts`

### Design intent

- KPIs are **defined once** (registry) and **computed centrally** (engine).
- The API layer is a **thin orchestration and access-control boundary**, not a metrics logic layer.
- Drill-through is not a “detail widget”; it is the **traceability contract** that explains KPI values.

## KPI Registry

### Registry responsibilities

Each KPI definition declares:

- `kpiCode`: stable identifier
- `displayName`: human readable name
- `governanceDomain`: domain code or `CROSS_DOMAIN`
- `severity`: LOW/MEDIUM/HIGH/CRITICAL
- `calculationStrategy`: COUNT/RATE/DURATION_AVG/LATENCY_AVG/WEIGHTED_RATE
- `aggregationStrategy`: TOTAL / BY_* / BY_AGING_BAND
- `trendSupport`: boolean
- `drillThroughSupported`: boolean
- `drillThroughTarget`: dataset type (JOURNALS, OVERRIDE_SESSIONS, etc.)
- `alertThresholds`: warn/critical thresholds where meaningful
- `visibilityRules`: required permissions; governance isolation by permission
- `retentionScope`: suggested retention strategy to keep analytics aligned with audit obligations

### Registry patterns

- KPIs must be additive: new KPI codes can be added without breaking existing clients.
- KPI definitions are stable contracts; calculation improvements should not change the meaning of a KPI.

## KPI Compute Engine

### Compute responsibilities

The compute engine performs:

- **windowed computation**: all KPIs accept `from` and `to`
- **trend computation**: recompute per bucket (DAY/WEEK/MONTH)
- **aggregation**: grouped breakdowns for explainability
- **aging band computation**: backlog analytics are broken down into aging bands
- **drill-through spec generation**: define the authoritative dataset used to explain the KPI

### Review analytics separation (Option C)

Review analytics explicitly include two separate KPIs:

1. **Review Turnaround Time**
   - Measures: `submittedAt → reviewedAt`
   - Meaning: workflow responsiveness and review throughput

2. **Decision Resolution Time**
   - Measures: `submittedAt → approvedAt/rejectedAt`
   - Meaning: terminal governance resolution latency and bottleneck detection

These must remain distinct because review and terminal decision latency represent different governance behaviors.

## Backlog Analytics

### Separated backlog KPIs

Backlog KPIs are not aggregated into one bucket. They remain separated by governance state:

- pending review
- pending approval
- pending override approval
- pending evidence completion

### Aging bands

Backlog KPIs support aging-band breakdowns:

- `< 1 day`
- `1–3 days`
- `3–7 days`
- `> 7 days`

Aging is computed relative to `asOf = to`.

## Drill-through model

### Why drill-through is required
A KPI value is not governance intelligence unless it can be explained.

Drill-through provides:

- the exact entity rows behind the KPI
- the ability to audit the KPI computation
- traceability back to lifecycle state and evidence/override linkage

### Drill-through targets
The backend uses explicit dataset targets:

- `JOURNALS`
- `OVERRIDE_SESSIONS`
- `AUTOMATION_EXECUTION_SESSIONS`
- `AUTOMATION_SCHEDULES`
- `AUDIT_EVENTS`
- `AUDIT_EVIDENCE`

Drill-through returns rows ordered by the most relevant timestamp for investigation.

## Governance severity analytics

Severity is treated as a first-class dimension:

- KPI definitions declare severity.
- Client UX renders severity clearly.
- Future: severity-weighted calculations can be introduced without altering KPI meaning.

## Governance isolation and access control

- Backend endpoints under `/governance/analytics/*` require:
  - `GOVERNANCE.FINANCIAL.VIEW` or `GOVERNANCE.FINANCIAL.MANAGE`
- KPI registry visibility rules are aligned with these permissions.
- No KPI is exposed via generic system/admin permissions.

## AI-readiness strategy

This KPI engine is AI-ready because it produces:

- consistent KPI definitions
- stable identifiers (`kpiCode`)
- drillable datasets for explainability
- time-windowed trends
- severity-aware labels

AI advisory can later:

- detect anomalies in KPI trends
- summarize drill-through evidence
- propose remediation actions

But:

- AI must not bypass governance enforcement
- AI outputs remain non-authoritative
- supervised orchestration remains mandatory

## Operational notes

- KPI computations are currently performed via Prisma queries over governed entities.
- For performance at scale, the compute engine can be extended with:
  - materialized views
  - pre-aggregations
  - scheduled rollups
  - partitioning/retention policies

These optimizations must not remove drill-through traceability.
