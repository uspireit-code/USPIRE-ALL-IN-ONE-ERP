# Combination Governance Architecture

## Objective
Build a **centralized, policy-driven Combination Governance Engine** that enforces enterprise-grade restrictions on:
- Account combinations
- Dimension combinations
- Entity combinations
- Journal-context restrictions (journal type, module, source)
- Operational segregation rules
- Intercompany combination foundations
- Tax/account relationships (foundation)
- Governance-sensitive pairings

**Non-goals (this phase)**:
- Full intercompany workflows (due-to/due-from generation, settlement flows)
- Evidence attachment framework
- Advanced analytics

The design must be reusable across:
- Manual journals
- Uploads
- Recurring journals
- Reversals
- System/integration generated postings

And it must not weaken:
- Immutability
- Lifecycle governance
- SoD
- Fiscal governance
- Journal-type governance
- Audit traceability
- Escalation governance

## Architecture Overview
The combination governance architecture mirrors the journal-type governance pattern:

- **Registry**: defines the canonical set of combination rules and their policy metadata.
- **Engine**: enforces rules using a single entry point `assertCombinationGovernance(...)`.
- **Integration points**: all journal creation/posting entry points call the engine.
- **Governance metadata**: violations emit standardized governance metadata for audit and escalation.

## 1) Combination Governance Registry
**File**: `src/gl/combination-governance-registry.ts`

The registry is the canonical catalog for governed combinations.

### Rule structure
Each `CombinationGovernanceRuleDefinition` contains:
- `ruleCode`
- `displayName`
- `description`
- `governanceSensitivity`
- `applicableJournalTypes` (Prisma `JournalType` or `ANY`)
- `applicableJournalPolicyTypes` (canonical policy types resolved via journal-type engine) or `ANY`
- `applicableModules` (`GL`, `AP`, `AR`, etc.) or `ANY`
- `allowedCombinations` (reserved for future expansion)
- `prohibitedCombinations` (selector-based prohibition)
- `requiredDimensions` / `restrictedDimensions`
- `enforcementMode` (`BLOCK` | `ESCALATE`)
- `severity`
- `escalationAllowed`

### Canonical rules (current)
This phase establishes the architecture and a minimal set of enforced rules:
- `RESTRICT_CONTROL_ACCOUNT_MANUAL_USE`
- `FUND_REQUIRES_PROJECT`
- `ACCOUNT_REQUIRES_DIMENSIONS`
- `INTERCOMPANY_ENTITY_PAIRING_REQUIRED` (foundation hook)

## 2) Centralized Validation Engine
**File**: `src/gl/combination-governance-engine.ts`

### Entry point
`assertCombinationGovernance(ctx)`

The engine:
- Resolves the canonical journal policy type using `resolveJournalPolicyType(...)` from `journal-type-policy-engine.ts`.
- Selects applicable combination rules from the registry.
- Enforces prohibited combinations and rule-specific logic.
- Emits standardized governance metadata via `buildGovernanceAuditMetadata(...)`.

### Context model
`CombinationGovernanceContext` is explicit and audit-friendly:
- Actor and permission context
  - `tenantId`
  - `actorUserId`
  - `permissionUsed`
  - `req?`
- Workflow mode
  - `mode`: `CREATE_DRAFT | UPDATE_DRAFT | UPLOAD | REVERSE | POST`
  - `module`: `GL | AP | AR | ...`
- Journal attributes
  - `journalDate`
  - `prismaJournalType`
  - `periodType?`
  - `reversalOfId?`
  - `reference?`, `description?`
  - `sourceType?`, `sourceId?`
- Line attributes
  - `accountId`, `accountCode`, `accountType`
  - `isControlAccount`, `isCashEquivalent`
  - `requiresDepartment`, `requiresProject`, `requiresFund`
  - `debit`, `credit`
  - `legalEntityId`, `departmentId`, `projectId`, `fundId`

### Governance action types
Combination violations map to governance action types in:
- **File**: `src/governance/governance-action-registry.ts`

Added action types:
- `INVALID_ACCOUNT_COMBINATION`
- `PROHIBITED_DIMENSION_PAIRING`
- `INTERCOMPANY_BALANCE_VIOLATION`
- `RESTRICTED_CONTROL_ACCOUNT_USAGE`
- `MISSING_REQUIRED_DIMENSION_COMBINATION`
- `COMBINATION_OVERRIDE_REQUESTED`

## 3) Account Combination Governance (current foundation)
Implemented centrally in the engine:
- **Control account restrictions**
  - Blocks control accounts for manual and upload-originated contexts (`CREATE_DRAFT`, `UPDATE_DRAFT`, `UPLOAD`).
  - This complements (does not replace) existing per-line lifecycle/posting checks.

Planned expansions:
- Retained earnings restrictions
- Suspense restrictions
- Payroll-sensitive account restrictions
- Cash/bank combination restrictions
- Debit/credit pairing constraints

## 4) Dimension Combination Governance (current)
Implemented centrally:
- `FUND_REQUIRES_PROJECT`
- `ACCOUNT_REQUIRES_DIMENSIONS` (based on COA flags: `requiresDepartment`, `requiresProject`, `requiresFund`)

Planned expansions:
- Branch/entity segregation rules
- Department-account restrictions
- Project-account restrictions
- Statutory dimension enforcement for tax journals

## 5) Journal-Type-Aware Combination Governance
Combination rules can be scoped by:
- Prisma journal type (`applicableJournalTypes`)
- Canonical journal policy type (`applicableJournalPolicyTypes`)
- Module (`applicableModules`)

This allows rules such as:
- “Adjustment journals may allow restricted combinations only with escalation”
- “System-generated journals may bypass certain operational restrictions”
- “Reversal journals must mirror original combinations”

## 6) Severity + Escalation Integration
Violations emit governance metadata:
- `actionType`
- `permissionUsed`
- `actorUserId`
- `tenantId`
- request metadata (if `req` is provided)
- enforcement context: mode, module, journal attributes, ruleCode, severity

This enables a future **central escalation workflow** to:
- request override (`COMBINATION_OVERRIDE_REQUESTED`)
- approve/deny based on severity and governance domain

## 7) Upload Governance Integration
Uploads validate:
- Journal-type policies (`assertJournalTypePolicy`)
- Combination governance (`assertCombinationGovernance`)

Uploads collect violations as upload errors, preventing commits.

## 8) Intercompany Governance Foundation
Current foundation rule:
- `INTERCOMPANY_ENTITY_PAIRING_REQUIRED`

Current enforcement:
- Requires every line to have `legalEntityId`
- Requires at least two distinct legal entities

This is an architectural hook for future phases:
- Due-to/due-from account validation
- Intercompany balancing
- Entity-pair governance matrices

## 9) Integration Points
The engine is called from `GlService` at the same enforcement points as journal-type policy:
- `createDraftJournal`
- `updateDraftJournal`
- `uploadJournals`
- `generateJournalFromRecurringTemplate`
- `reversePostedJournal`

## Notes / Known gaps
- Some combination rule definitions are placeholders for future expansion.
- Evidence/approval workflows are not implemented here; the metadata is emitted so those systems can be added without refactoring enforcement call sites.
