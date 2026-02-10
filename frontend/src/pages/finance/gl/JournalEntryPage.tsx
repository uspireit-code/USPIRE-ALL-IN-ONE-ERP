import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Alert } from '../../../components/Alert';
import { AccountContextPanel } from '../../../components/AccountContextPanel';
import { DataTable } from '../../../components/DataTable';
import { JournalActionBar } from '../../../components/JournalActionBar';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import {
  createJournal,
  getJournal,
  getJournalDetail,
  listGlPeriods,
  listAllGlAccounts,
  listProjects,
  reverseJournal,
  rejectJournal,
  reviewJournal,
  submitJournal,
  updateJournal,
  getInvalidJournalDateMessage,
  type AccountingPeriod,
  type GlAccountLookup,
  type JournalEntry,
  type JournalDetailResponse,
  type JournalStatus,
  type JournalType,
  type ProjectLookup,
} from '../../../services/gl';

type EditableLine = {
  id?: string;
  lineNumber?: number;
  accountId: string;
  legalEntityId?: string | null;
  departmentId?: string | null;
  projectId?: string | null;
  fundId?: string | null;
  description?: string;
  debit: number;
  credit: number;
};

function computeTotals(lines: EditableLine[]) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const totalDebit = round2(lines.reduce((sum, l) => sum + (Number.isFinite(l.debit) ? l.debit : 0), 0));
  const totalCredit = round2(lines.reduce((sum, l) => sum + (Number.isFinite(l.credit) ? l.credit : 0), 0));
  return {
    totalDebit, totalCredit, net: round2(totalDebit - totalCredit)
  };
}

function normalizeAmount(raw: unknown) {
  const n = typeof raw === 'string' ? Number(raw) : (raw as number);
  return Number.isFinite(n) ? n : 0;
}

function RiskBadge(props: { riskScore?: number | null }) {
  const s = typeof props.riskScore === 'number' ? props.riskScore : 0;
  const band = s >= 40 ? 'HIGH' : s >= 20 ? 'MEDIUM' : 'LOW';
  const bg = band === 'HIGH' ? '#fee2e2' : band === 'MEDIUM' ? '#ffedd5' : '#e7f6ec';
  const color = band === 'HIGH' ? '#991b1b' : band === 'MEDIUM' ? '#9a3412' : '#166534';

  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 750 }}>
      {band}
    </span>
  );
}

function BudgetBadge(props: { status: string | null | undefined }) {
  const s = (props.status ?? 'OK').toUpperCase();
  const status = s === 'BLOCK' || s === 'WARN' || s === 'OK' ? s : 'OK';
  const bg = status === 'BLOCK' ? '#fee2e2' : status === 'WARN' ? '#fff7ed' : '#e7f6ec';
  const color = status === 'BLOCK' ? '#991b1b' : status === 'WARN' ? '#9a3412' : '#166534';

  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 750 }}>
      {status}
    </span>
  );
}

function normalizeLinesForTotals(lines: EditableLine[]) {
  return (lines ?? []).map((l, idx) => ({
    ...l,
    lineNumber: Number.isFinite(l.lineNumber as any) && (l.lineNumber as any) > 0 ? (l.lineNumber as number) : idx + 1,
    debit: normalizeAmount(l.debit),
    credit: normalizeAmount(l.credit),
  }));
}

function buildPayloadLinesFromState(lines: EditableLine[]) {
  const normalized = normalizeLinesForTotals(lines);

  const nonEmptyLines = normalized.filter((l) => Boolean(l.accountId) || l.debit !== 0 || l.credit !== 0);

  return nonEmptyLines.map((l) => {
    return {
      lineNumber: l.lineNumber,
      accountId: l.accountId,
      legalEntityId: l.legalEntityId ?? null,
      departmentId: l.departmentId ?? null,
      projectId: l.projectId ?? null,
      fundId: l.fundId ?? null,
      description: l.description?.trim() ? l.description.trim() : undefined,
      debit: l.debit,
      credit: l.credit,
    };
  });
}

export function JournalEntryPage() {
  const { id } = useParams();
  const isNew = id === undefined;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { state, hasPermission } = useAuth();
  const canView = hasPermission(PERMISSIONS.GL.VIEW);
  const canCreate = hasPermission(PERMISSIONS.GL.CREATE);
  const canApprove = hasPermission(PERMISSIONS.GL.APPROVE);
  const canPost = hasPermission(PERMISSIONS.GL.FINAL_POST);
  const realUserId = state.me?.user?.id ?? '';
  const actingUserId = state.me?.delegation?.actingAsUserId ?? undefined;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [legacyReversalBlocked, setLegacyReversalBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [reversalOpen, setReversalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState('');

  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);

  const [accounts, setAccounts] = useState<GlAccountLookup[]>([]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a] as const)), [accounts]);
  const [accountPickerByRow, setAccountPickerByRow] = useState<Record<number, string>>({});

  const [projects, setProjects] = useState<ProjectLookup[]>([]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p] as const)), [projects]);

  const accountInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const [accountPanel, setAccountPanel] = useState<
    | null
    | {
        rowIndex: number;
        priorLine: EditableLine;
        priorAccountPicker: string;
        account: GlAccountLookup;
      }
  >(null);

  const [journal, setJournal] = useState<JournalEntry | null>(null);
  const [journalDetail, setJournalDetail] = useState<JournalDetailResponse | null>(null);

  const [journalDate, setJournalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [journalType, setJournalType] = useState<JournalType>('STANDARD');
  const [hasLockedJournalType, setHasLockedJournalType] = useState(false);
  const [description, setDescription] = useState('');
  const [budgetOverrideJustification, setBudgetOverrideJustification] = useState('');

  const correctsJournalIdFromUrl = useMemo(() => {
    const v = (searchParams.get('correctsJournalId') ?? '').trim();
    return v || null;
  }, [searchParams]);

  const [lines, setLines] = useState<EditableLine[]>([
    { lineNumber: 1, accountId: '', debit: 0, credit: 0 },
    { lineNumber: 2, accountId: '', debit: 0, credit: 0 },
  ]);

  const status: JournalStatus = (journalDetail?.status ?? journal?.status ?? 'DRAFT') as any;
  const forcedReadOnly = searchParams.get('readonly') === '1';
  const readOnly = forcedReadOnly || (!isNew && status !== 'DRAFT' && status !== 'REJECTED');
  const fromReviewQueue = searchParams.get('from') === 'review';

  const isReversal = Boolean(!isNew && journalDetail?.journalType === 'REVERSING' && journalDetail?.reversalOfId);

  const canEditLines = canCreate && !readOnly && !isReversal;
  const canEditHeaderDescription = canCreate && !readOnly;
  const canEditJournalDate = canCreate && !readOnly;

  const budgetStatus = (journalDetail?.budgetStatus ?? journal?.budgetStatus ?? 'OK') as any;
  const budgetCheckedAt = journalDetail?.budgetCheckedAt ?? null;
  const budgetFlags = (journalDetail?.budgetFlags ?? []) as any[];
  const requiresBudgetJustification = budgetStatus === 'WARN';

  const formatDimension = (d: null | { code: string; name: string } | undefined) => {
    if (!d) return '—';
    return `${d.code} — ${d.name}`;
  };

  const cutoverDate = useMemo(() => {
    const opening = periods.find((p) => (p.name ?? '').trim().toLowerCase() === 'opening balances' && p.status === 'CLOSED');
    return opening ? opening.startDate.slice(0, 10) : null;
  }, [periods]);

  const selectedPeriod = useMemo(() => {
    const jd = (journalDate ?? '').slice(0, 10);
    if (!jd) return null;
    return (
      periods.find((p) => {
        const start = (p.startDate ?? '').slice(0, 10);
        const end = (p.endDate ?? '').slice(0, 10);
        return start <= jd && jd <= end;
      }) ?? null
    );
  }, [journalDate, periods]);

  const journalDateInfoMessage = useMemo(() => {
    if (!canCreate || readOnly) return null;
    const jd = (journalDate ?? '').slice(0, 10);
    if (!jd) return null;

    if (cutoverDate && jd < cutoverDate) {
      return 'Journal date is before system cutover. Select a later date.';
    }
    if (!selectedPeriod) {
      return 'No accounting period exists for the selected date.';
    }

    if (selectedPeriod.status !== 'OPEN') {
      return 'Selected accounting period is closed. Choose an open period.';
    }

    return null;
  }, [canCreate, cutoverDate, journalDate, readOnly, selectedPeriod]);

  const isFinanceOfficerMaker = canCreate && !canApprove && !canPost;

  const uiStatusLabel = useMemo(() => {
    if (status === 'SUBMITTED') return 'Submitted for Review';
    if (status === 'REVIEWED') return 'Approved (Pending Posting)';
    if (status === 'REJECTED') return 'Rejected';
    if (status === 'PARKED') return 'Submitted for Review';
    return status;
  }, [status]);

  const effectivePreparerId = useMemo(() => {
    return (journalDetail?.createdBy?.id ?? journal?.createdById ?? '') || '';
  }, [journal?.createdById, journalDetail?.createdBy?.id]);

  const isCreator = effectivePreparerId === realUserId;
  const submittedById = journalDetail?.submittedBy?.id ?? journal?.submittedById ?? null;
  const isSubmittedByMe = submittedById ? submittedById === realUserId : false;

  const isApproverReviewMode = fromReviewQueue && canApprove;
  const canApproveThis =
    isApproverReviewMode &&
    !isNew &&
    status === 'SUBMITTED' &&
    !isCreator &&
    !isSubmittedByMe;

  const referenceDisplay = useMemo(() => {
    const ref = (journalDetail?.reference ?? journal?.reference ?? '').trim();
    if (ref) return ref;
    return isNew ? '' : '—';
  }, [isNew, journalDetail?.reference, journal?.reference]);

  const canInitiateReversal =
    !isNew &&
    status === 'POSTED' &&
    canPost &&
    !isCreator;

  const journalTypeDisabled = useMemo(() => {
    if (!canEditLines) return true;
    if (!isNew) return true;
    return hasLockedJournalType;
  }, [canEditLines, hasLockedJournalType, isNew]);

  const normalizedLines = useMemo(() => normalizeLinesForTotals(lines), [lines]);
  const totals = useMemo(() => computeTotals(normalizedLines), [normalizedLines]);
  const balanceOk = totals.net === 0 && totals.totalDebit > 0;

  const getDepartmentRequirementMessage = (accountType: string | null | undefined) => {
    if (accountType === 'EXPENSE') return 'Department required for expense accounts';
    if (accountType === 'INCOME') return 'Department required for revenue accounts';
    if (accountType === 'EQUITY') return 'Department not applicable for equity accounts';
    return null;
  };

  const getDepartmentRequirementForAccount = (
    account: GlAccountLookup | undefined,
  ): 'REQUIRED' | 'OPTIONAL' | 'FORBIDDEN' => {
    const r = account?.departmentRequirement;
    if (r === 'REQUIRED' || r === 'OPTIONAL' || r === 'FORBIDDEN') return r;
    return 'REQUIRED';
  };

  const [changeAccountConfirm, setChangeAccountConfirm] = useState<null | { rowIndex: number }>(null);

  const lineValidationByIndex = useMemo(() => {
    const errors = new Map<
      number,
      {
        account?: string;
        description?: string;
        amount?: string;
      }
    >();

    normalizedLines.forEach((l, idx) => {
      const rowErrors: { account?: string; description?: string; amount?: string } = {};

      if (!l.accountId?.trim()) {
        rowErrors.account = 'Select an account.';
      }

      if (!l.description?.trim()) {
        rowErrors.description = 'Enter a line description.';
      }

      const hasDebit = l.debit > 0;
      const hasCredit = l.credit > 0;
      if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
        rowErrors.amount = hasDebit && hasCredit ? 'Enter either a debit or a credit (not both).' : 'Enter a debit or a credit amount.';
      }

      if (rowErrors.account || rowErrors.description || rowErrors.amount) {
        errors.set(idx, rowErrors);
      }
    });

    return errors;
  }, [normalizedLines]);

  const dimensionMissingByIndex = useMemo(() => {
    const out = new Map<number, { legalEntity?: string; department?: string; project?: string; fund?: string }>();

    // Reversal journals are system-generated; backend submission does not re-validate dimensions.
    if (isReversal) return out;

    const sourceLines:
      | Array<{
          accountId: string;
          legalEntityId?: string | null;
          departmentId?: string | null;
          projectId?: string | null;
          fundId?: string | null;
          debit: number;
          credit: number;
          lineNumber?: number | null;
        }>
      | EditableLine[] =
      normalizedLines;

    sourceLines.forEach((l, idx) => {
      const isNonEmpty = Boolean(l.accountId) || (l.debit ?? 0) !== 0 || (l.credit ?? 0) !== 0;
      if (!isNonEmpty) return;
      const e: { legalEntity?: string; department?: string; project?: string; fund?: string } = {};
      if (!l.legalEntityId) e.legalEntity = 'Legal Entity is required to submit.';
      const account = accountById.get(l.accountId);
      const deptReq = getDepartmentRequirementForAccount(account);
      if (!l.departmentId) {
        if (deptReq === 'REQUIRED') {
          const accountType = account?.type;
          e.department = getDepartmentRequirementMessage(accountType) ?? 'Department is required to submit.';
        }
      } else {
        if (deptReq === 'FORBIDDEN') {
          e.department = 'Department must not be provided for this account.';
        }
      }

      const selectedProject = l.projectId ? projectById.get(l.projectId) : undefined;
      const projectRestricted = Boolean(selectedProject?.isRestricted);
      const fundRequired = Boolean(account?.requiresFund) || projectRestricted;
      const projectRequired = Boolean(account?.requiresProject) || fundRequired;

      if (l.fundId && !l.projectId) {
        e.project = 'Project must be selected before Fund.';
      } else if (!l.projectId && projectRequired) {
        e.project = 'Project is required to submit.';
      }

      if (!l.fundId && fundRequired) {
        e.fund = projectRestricted
          ? 'Fund is required because the selected Project is restricted.'
          : 'Fund is required to submit.';
      }
      if (e.legalEntity || e.department) out.set(idx, e);
      if (e.project || e.fund) out.set(idx, e);
    });
    return out;
  }, [normalizedLines, accountById, isReversal, projectById]);

  const headerDescriptionError = useMemo(() => {
    if (!canCreate || readOnly) return null;
    return description.trim() ? null : 'Journal description is required before you can capture.';
  }, [canCreate, readOnly, description]);

  const totalsError = useMemo(() => {
    if (!canCreate || readOnly) return null;
    if (totals.totalDebit === 0 && totals.totalCredit === 0) return 'Enter at least one debit/credit amount.';
    if (totals.net !== 0) return 'Total debits must equal total credits.';
    if (totals.totalDebit <= 0) return 'Journal total must be greater than zero.';
    return null;
  }, [canCreate, readOnly, totals.totalDebit, totals.totalCredit, totals.net]);

  const captureDisabledReason =
    headerDescriptionError || lineValidationByIndex.size > 0 || totalsError || journalDateInfoMessage
      ? 'Complete all required fields and fix validation errors before capturing.'
      : null;

  const submitDisabledReason =
    !isCreator
      ? 'Only the preparer can submit this journal.'
      : journalDateInfoMessage
        ? journalDateInfoMessage
        : !isReversal && dimensionMissingByIndex.size > 0
          ? (() => {
              const parts: string[] = [];
              const indices = Array.from(dimensionMissingByIndex.keys()).sort((a, b) => a - b);
              for (const idx of indices.slice(0, 4)) {
                const miss = dimensionMissingByIndex.get(idx);
                if (!miss) continue;
                const lineNo = normalizedLines[idx]?.lineNumber ?? idx + 1;
                const missingLabels = [
                  miss.legalEntity ? 'Legal Entity' : null,
                  miss.department ? 'Department' : null,
                  miss.project ? 'Project' : null,
                  miss.fund ? 'Fund' : null,
                ].filter(Boolean);
                if (missingLabels.length > 0) {
                  parts.push(`Line ${lineNo}: ${missingLabels.join(', ')}`);
                }
              }
              return parts.length > 0
                ? `Missing required dimensions. ${parts.join(' • ')}${indices.length > 4 ? ' • …' : ''}`
                : 'Some lines are missing required dimensions.';
            })()
        : headerDescriptionError || lineValidationByIndex.size > 0 || totalsError
          ? 'Journal must be complete, balanced, and dated in an open period before submission.'
          : null;

  async function load() {
    if (!canView && !canCreate) return;
    setLoading(true);
    setError(null);
    setLegacyReversalBlocked(false);

    try {
      const [accs, ps, existing, detail] = await Promise.all([
        listAllGlAccounts(),
        listGlPeriods().catch(() => []),
        !isNew && id ? getJournal(id) : Promise.resolve(null),
        !isNew && id ? getJournalDetail(id) : Promise.resolve(null),
      ]);
      setAccounts(accs);
      setPeriods(ps);
      setProjects([]);

      if (existing) {
        setJournal(existing);
        setJournalDetail(detail);
        setJournalDate(existing.journalDate.slice(0, 10));
        setJournalType((existing.journalType ?? 'STANDARD') as JournalType);
        setDescription(existing.description ?? '');
        setBudgetOverrideJustification(String((detail as any)?.budgetOverrideJustification ?? (existing as any)?.budgetOverrideJustification ?? ''));

        setLines(
          ((detail?.lines?.length ? detail.lines : existing.lines) ?? []).map((l, idx) => ({
            id: (l as any).id,
            lineNumber: ((l as any).lineNumber ?? idx + 1) as any,
            accountId: (l as any).accountId,
            legalEntityId: (l as any).legalEntityId ?? null,
            departmentId: (l as any).departmentId ?? null,
            projectId: (l as any).projectId ?? null,
            fundId: (l as any).fundId ?? null,
            description: (l as any).description ?? undefined,
            debit: normalizeAmount((l as any).debit),
            credit: normalizeAmount((l as any).credit),
          })),
        );
      }

      if (isNew && correctsJournalIdFromUrl) {
        const source = await getJournalDetail(correctsJournalIdFromUrl);
        setJournalType('STANDARD');
        setHasLockedJournalType(true);
        setDescription(source.description ? `Correction: ${source.description}` : 'Correcting journal');
        setBudgetOverrideJustification('');
        setLines(
          (source.lines ?? []).map((l, idx) => ({
            lineNumber: l.lineNumber ?? idx + 1,
            accountId: l.accountId,
            legalEntityId: null,
            departmentId: null,
            projectId: null,
            fundId: null,
            description: l.description ?? undefined,
            debit: normalizeAmount(l.debit),
            credit: normalizeAmount(l.credit),
          })),
        );
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load journal'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canView, canCreate]);

  useEffect(() => {
    if (!canView && !canCreate) return;
    const effectiveOn = (journalDate ?? '').slice(0, 10);
    if (!effectiveOn) return;
    const needsProjects = lines.some((l) => Boolean(l.projectId));
    if (needsProjects && projects.length === 0) {
      listProjects({ effectiveOn })
        .then((ps) => setProjects(Array.isArray(ps) ? ps : []))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalDate, canView, canCreate, lines, projects.length]);

  if (!canView && !canCreate) {
    return <div>You do not have access to journals.</div>;
  }

  async function onSave() {
    if (!canCreate) return;

    if (journalDateInfoMessage) {
      setError(journalDateInfoMessage);
      return;
    }

    if (headerDescriptionError || lineValidationByIndex.size > 0 || totalsError) {
      setError('Journal is not ready to capture. Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payloadLines = buildPayloadLinesFromState(lines);

      const payload = {
        journalDate: new Date(`${journalDate}T00:00:00.000Z`).toISOString(),
        journalType,
        reference: undefined,
        description: description.trim() ? description.trim() : undefined,
        budgetOverrideJustification: budgetOverrideJustification.trim() ? budgetOverrideJustification.trim() : undefined,
        correctsJournalId: correctsJournalIdFromUrl ?? undefined,
        lines: payloadLines,
      };

      const saved = isNew ? await createJournal(payload) : await updateJournal(id as string, payload);
      setJournal(saved);
      if (!isNew) {
        const detail = await getJournalDetail(saved.id).catch(() => null);
        setJournalDetail(detail);
      }
      setToast('Journal captured successfully');
      window.setTimeout(() => setToast(null), 2500);

      // Keep the same source-of-truth lines after save, but ensure our local values stay numeric.
      // (Backend may return decimals as strings; we normalize on load.)
      setLines((prev) => normalizeLinesForTotals(prev));

      if (isNew) {
        navigate(`/finance/gl/journals/${saved.id}`, { replace: true });
      }
    } catch (e: any) {
      const mapped = getInvalidJournalDateMessage((e as any)?.body);
      const msg = mapped ?? getApiErrorMessage(e, 'Unable to capture journal. Please review your entries and try again.');
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitForReview() {
    if (!canCreate) return;
    if (isNew) {
      setError('Capture the journal first before submitting for review.');
      return;
    }

    if (status !== 'DRAFT' && status !== 'REJECTED') {
      setError('Only DRAFT or REJECTED journals can be submitted for review.');
      return;
    }

    if (!isCreator) {
      setError('Only the preparer can submit this journal.');
      return;
    }

    if (submitDisabledReason) {
      setError(submitDisabledReason);
      return;
    }

    setWorkflowBusy(true);
    setError(null);
    try {
      await submitJournal(id as string);
      setToast('Submitted for review');
      window.setTimeout(() => setToast(null), 2500);
      window.setTimeout(() => navigate('/finance/gl/journals', { replace: true }), 600);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to submit journal for review'));
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function onApprove() {
    if (!canApproveThis) return;
    setWorkflowBusy(true);
    setError(null);
    try {
      await reviewJournal(id as string);
      setToast('Journal approved');
      window.setTimeout(() => setToast(null), 2500);
      window.setTimeout(() => navigate('/finance/gl/review', { replace: true }), 600);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to approve journal'));
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function onReject() {
    if (!canApproveThis) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError('Rejection reason is required.');
      return;
    }

    setWorkflowBusy(true);
    setError(null);
    try {
      await rejectJournal(id as string, reason);
      setToast('Journal rejected');
      window.setTimeout(() => setToast(null), 2500);
      window.setTimeout(() => navigate('/finance/gl/review', { replace: true }), 600);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to reject journal'));
    } finally {
      setWorkflowBusy(false);
    }
  }

  return (
    <div>
      {toast ? (
        <div
          style={{
            position: 'sticky',
            top: 8,
            zIndex: 5,
            marginBottom: 12,
            padding: '8px 10px',
            borderRadius: 8,
            background: '#e7f6ec',
            color: '#166534',
            fontSize: 13,
            fontWeight: 650,
            border: '1px solid rgba(22, 101, 52, 0.25)',
            maxWidth: 520,
          }}
        >
          {toast}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <h2>{isNew ? 'New Journal' : 'Journal'}</h2>
          {!isNew && (journalDetail || journal) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 650,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: 'rgba(2, 132, 199, 0.10)',
                  color: '#075985',
                  border: '1px solid rgba(2, 132, 199, 0.25)',
                }}
              >
                {uiStatusLabel}
              </span>
              {(journalDetail?.journalNumber ?? journal?.journalNumber) !== null &&
              typeof (journalDetail?.journalNumber ?? journal?.journalNumber) === 'number' ? (
                <span style={{ fontSize: 12, color: tokens.colors.text.muted }}>
                  J{String(journalDetail?.journalNumber ?? journal?.journalNumber).padStart(6, '0')}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <Link to="/finance/gl/journals">Back to list</Link>
      </div>

      {!isNew && journalDetail ? (
        <div
          style={{
            marginTop: 12,
            maxWidth: 820,
            border: `1px solid ${tokens.colors.border.subtle}`,
            borderRadius: 12,
            padding: 12,
            background: tokens.colors.surface.subtle,
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 850 }}>Risk</div>
            <RiskBadge riskScore={journalDetail.riskScore ?? 0} />
          </div>

          <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>
            Score: <span style={{ fontWeight: 750, color: tokens.colors.text.primary }}>{journalDetail.riskScore ?? 0}</span>
            {journalDetail.riskComputedAt ? ` — Computed: ${String(journalDetail.riskComputedAt).slice(0, 19).replace('T', ' ')}` : ''}
          </div>

          {Array.isArray(journalDetail.riskFlags) && journalDetail.riskFlags.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {journalDetail.riskFlags.map((f) => (
                <span
                  key={f}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    border: `1px solid ${tokens.colors.border.subtle}`,
                    background: tokens.colors.white,
                    fontSize: 12,
                    fontWeight: 650,
                    color: tokens.colors.text.primary,
                  }}
                >
                  {String(f)}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>No risk flags.</div>
          )}
        </div>
      ) : null}

      {loading ? <div style={{ marginTop: 12 }}>Loading…</div> : null}

      {error ? (
        <div style={{ marginTop: 12, maxWidth: 820 }}>
          <Alert tone="warning" title="Notice">
            {error}
          </Alert>
        </div>
      ) : null}

      {!error && journalDateInfoMessage ? (
        <div style={{ marginTop: 12, maxWidth: 820 }}>
          <Alert tone="info" title="Journal date needs attention">
            {journalDateInfoMessage}
          </Alert>
        </div>
      ) : null}

      {!isNew && journalDetail && journalDetail.returnedByPosterAt && journalDetail.returnReason ? (
        <div style={{ marginTop: 12, maxWidth: 820 }}>
          <Alert tone="warning" title="Returned by Finance Controller">
            {`Returned by ${journalDetail.returnedByPoster?.email ?? '—'} — Reason: ${journalDetail.returnReason}`}
          </Alert>
        </div>
      ) : null}

      {!isNew && journalDetail && journalDetail.journalType === 'REVERSING' && journalDetail.reversalOf ? (
        <div style={{ marginTop: 12, maxWidth: 820 }}>
          <Alert tone="info" title="Reversal journal">
            This is a reversal of{' '}
            <Link to={`/finance/gl/journals/${journalDetail.reversalOf.id}`}>{journalDetail.reversalOf.reference ?? journalDetail.reversalOf.id.slice(0, 8)}</Link>.
          </Alert>
        </div>
      ) : null}

      {!isNew && journalDetail && legacyReversalBlocked ? (
        <div style={{ marginTop: 12, maxWidth: 820 }}>
          <Alert tone="warning" title="Reversal not available">
            This journal predates dimensional controls and cannot be reversed automatically. Create a correcting journal instead.
          </Alert>
        </div>
      ) : null}

      {!isNew && journalDetail && journalDetail.status === 'POSTED' && Array.isArray(journalDetail.reversedBy) && journalDetail.reversedBy.some((x) => x.status === 'POSTED') ? (
        <div style={{ marginTop: 12, maxWidth: 820 }}>
          <Alert tone="info" title="Reversed">
            Reversed by{' '}
            {journalDetail.reversedBy
              .filter((x) => x.status === 'POSTED')
              .slice(0, 1)
              .map((x) => (
                <Link key={x.id} to={`/finance/gl/journals/${x.id}`}>{x.reference ?? x.id.slice(0, 8)}</Link>
              ))}
            .
          </Alert>
        </div>
      ) : null}

      {canInitiateReversal ? (
        <div style={{ marginTop: 14, display: 'grid', gap: 8, maxWidth: 820 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => {
                setReversalReason('');
                setReversalOpen(true);
                setError(null);
              }}
              disabled={workflowBusy}
              style={{ background: tokens.colors.surface.subtle, border: `1px solid ${tokens.colors.border.subtle}` }}
            >
              Initiate Reversal
            </button>

            {legacyReversalBlocked && canCreate ? (
              <button
                onClick={() => navigate(`/finance/gl/journals/new?correctsJournalId=${encodeURIComponent(journalDetail?.id ?? '')}`)}
                disabled={workflowBusy}
                style={{ fontWeight: 750 }}
              >
                Create Correcting Journal
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!isNew && journalDetail && realUserId ? (
        !forcedReadOnly && !isFinanceOfficerMaker && !isApproverReviewMode ? (
          <JournalActionBar
            journal={journalDetail}
            realUserId={realUserId}
            actingUserId={actingUserId}
            canCreate={canCreate}
            canApprove={canApprove}
            canPost={canPost}
            onJournalUpdated={async () => {
              const detail = await getJournalDetail(journalDetail.id);
              setJournalDetail(detail);
              const base = await getJournal(journalDetail.id).catch(() => null);
              if (base) setJournal(base);
              setBudgetOverrideJustification(detail.budgetOverrideJustification ?? '');

              if (fromReviewQueue && detail.status === 'POSTED') {
                setToast('Journal posted successfully');
                window.setTimeout(() => setToast(null), 2500);
                navigate('/finance/gl/review', { replace: true });
              }

              if (!fromReviewQueue && detail.status === 'SUBMITTED') {
                setToast('Journal returned to Review.');
                window.setTimeout(() => setToast(null), 2500);
                navigate('/finance/gl/post', { replace: true });
              }
            }}
            onError={(msg) => setError(msg || null)}
          />
        ) : null
      ) : null}

      {!isNew && journalDetail ? (
        <div
          style={{
            marginTop: 14,
            padding: tokens.spacing.x3,
            borderRadius: tokens.radius.lg,
            background: tokens.colors.surface.subtle,
            border: `1px solid ${tokens.colors.border.subtle}`,
            maxWidth: 980,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 850, color: tokens.colors.text.primary }}>Budget Impact</div>
            <BudgetBadge status={budgetStatus} />
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.text.muted }}>
            Last evaluated: {budgetCheckedAt ? String(budgetCheckedAt).replace('T', ' ').slice(0, 19) : '—'}
          </div>

          {budgetStatus === 'BLOCK' ? (
            <div style={{ marginTop: 10 }}>
              <Alert tone="error" title="Budget hard block">
                One or more journal lines exceed available budget. Posting will be blocked.
              </Alert>
            </div>
          ) : null}

          {requiresBudgetJustification && !readOnly ? (
            <div style={{ marginTop: 10 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: tokens.colors.text.primary }}>
                Budget exception justification
              </label>
              <textarea
                value={budgetOverrideJustification}
                onChange={(e) => setBudgetOverrideJustification(e.target.value)}
                placeholder="Required when budget status is WARN"
                style={{ width: '100%', marginTop: 6, minHeight: 86 }}
                disabled={readOnly}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>
                This justification is required before Submit or Review.
              </div>
            </div>
          ) : null}

          {Array.isArray(budgetFlags) && budgetFlags.length ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.primary }}>Exceptions</div>
              <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                {budgetFlags.slice(0, 20).map((f, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: 12,
                      color: tokens.colors.text.secondary,
                      background: tokens.colors.white,
                      border: `1px solid ${tokens.colors.border.subtle}`,
                      borderRadius: 10,
                      padding: '8px 10px',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ fontWeight: 750, color: tokens.colors.text.primary }}>
                      Line {typeof (f as any)?.lineNumber === 'number' ? (f as any).lineNumber : '—'} — {(f as any)?.accountCode ?? ''}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      {(f as any)?.status ?? ''} {(Array.isArray((f as any)?.flags) ? (f as any).flags.join(', ') : '')}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      Amount: {Number((f as any)?.amount ?? 0).toLocaleString()} | Budget: {Number((f as any)?.availableAmount ?? 0).toLocaleString()} | Variance:{' '}
                      {Number((f as any)?.variance ?? 0).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {reversalOpen ? (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11,12,30,0.52)',
              zIndex: 70,
            }}
            onClick={() => {
              if (workflowBusy) return;
              setReversalOpen(false);
              setReversalReason('');
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: '16vh',
              left: '50%',
              transform: 'translate(-50%, 0)',
              width: 'min(700px, calc(100vw - 32px))',
              background: tokens.colors.white,
              borderRadius: 12,
              border: `1px solid ${tokens.colors.border.subtle}`,
              boxShadow: '0 18px 80px rgba(11,12,30,0.28)',
              zIndex: 71,
              padding: 16,
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 850, fontSize: 16 }}>Initiate Reversal</div>
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>
              This will create a reversal journal. The original journal will remain unchanged.
            </div>

            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Reason *
              <textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                rows={4}
                style={{ width: '100%' }}
                disabled={workflowBusy}
              />
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  if (workflowBusy) return;
                  setReversalOpen(false);
                  setReversalReason('');
                }}
                disabled={workflowBusy}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const reason = reversalReason.trim();
                  if (!reason) {
                    setError('Reversal reason is required.');
                    return;
                  }
                  setWorkflowBusy(true);
                  setError(null);
                  try {
                    const created = await reverseJournal(id as string, { reason });
                    setToast('Reversal journal created');
                    window.setTimeout(() => setToast(null), 2500);
                    setReversalOpen(false);
                    setReversalReason('');
                    setLegacyReversalBlocked(false);
                    navigate(`/finance/gl/journals/${created.id}`, { replace: true });
                  } catch (e: any) {
                    const body = (e as any)?.body;
                    const code = body?.code;
                    const statusCode = (e as any)?.status;
                    if (statusCode === 409 && code === 'LEGACY_JOURNAL_MISSING_DIMENSIONS') {
                      setLegacyReversalBlocked(true);
                      setError(null);
                      setReversalOpen(false);
                      setReversalReason('');
                      return;
                    }
                    setError(getApiErrorMessage(e, 'Failed to initiate reversal'));
                  } finally {
                    setWorkflowBusy(false);
                  }
                }}
                disabled={workflowBusy || !reversalReason.trim()}
                style={{ fontWeight: 750 }}
              >
                {workflowBusy ? 'Creating…' : 'Create Reversal'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {canApproveThis ? (
        <div style={{ marginTop: 14, display: 'grid', gap: 8, maxWidth: 820 }}>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: tokens.colors.surface.subtle,
              border: `1px solid ${tokens.colors.border.subtle}`,
              color: tokens.colors.text.primary,
              fontSize: 13,
              fontWeight: 650,
            }}
          >
            Review controls: approve or reject this journal.
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={onApprove} disabled={workflowBusy} style={{ fontWeight: 750 }}>
              {workflowBusy ? 'Approving…' : 'Approve'}
            </button>

            <button
              onClick={() => {
                setRejecting((v) => !v);
                setError(null);
              }}
              disabled={workflowBusy}
            >
              Reject
            </button>
          </div>

          {rejecting ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <label>
                Rejection reason *
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  style={{ width: '100%' }}
                  disabled={workflowBusy}
                />
              </label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={onReject} disabled={workflowBusy} style={{ fontWeight: 750 }}>
                  {workflowBusy ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
                <button
                  onClick={() => {
                    setRejecting(false);
                    setRejectReason('');
                    setError(null);
                  }}
                  disabled={workflowBusy}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {isApproverReviewMode && canApprove && !canApproveThis && status === 'SUBMITTED' ? (
        <div style={{ marginTop: 12, maxWidth: 820 }}>
          <Alert tone="info" title="Controls">
            You cannot approve a journal you prepared.
          </Alert>
        </div>
      ) : null}

      {!isNew && journalDetail && status === 'REJECTED' ? (
        <div style={{ marginTop: 12, maxWidth: 820 }}>
          <Alert tone="warning" title="Rejected">
            This journal was rejected.
            {journalDetail.rejectionReason ? ` Reason: ${journalDetail.rejectionReason}` : ''}
          </Alert>
        </div>
      ) : null}

      {!isNew && journalDetail ? (
        <div style={{ marginTop: 12, display: 'grid', gap: 6, maxWidth: 820, fontSize: 12, color: tokens.colors.text.muted }}>
          <div>
            Prepared by: {journalDetail.createdBy?.email ?? journalDetail.createdBy?.id ?? '—'}
            {journalDetail.createdAt ? ` • ${new Date(journalDetail.createdAt).toLocaleString()}` : ''}
          </div>

          <div>
            Submitted by: {journalDetail.submittedBy?.email ?? journalDetail.submittedBy?.id ?? '—'}
            {journalDetail.submittedAt ? ` • ${new Date(journalDetail.submittedAt).toLocaleString()}` : ''}
          </div>

          <div>
            Reviewed by: {journalDetail.reviewedBy?.email ?? journalDetail.reviewedBy?.id ?? '—'}
            {journalDetail.reviewedActedBy?.email || journalDetail.reviewedActedBy?.id
              ? ` (acted by ${journalDetail.reviewedActedBy?.email ?? journalDetail.reviewedActedBy?.id})`
              : ''}
            {journalDetail.reviewedAt ? ` • ${new Date(journalDetail.reviewedAt).toLocaleString()}` : ''}
          </div>

          <div>
            Rejected by: {journalDetail.rejectedBy?.email ?? journalDetail.rejectedBy?.id ?? '—'}
            {journalDetail.rejectedAt ? ` • ${new Date(journalDetail.rejectedAt).toLocaleString()}` : ''}
          </div>

          <div>
            Posted by: {journalDetail.postedBy?.email ?? journalDetail.postedBy?.id ?? '—'}
            {journalDetail.postedAt ? ` • ${new Date(journalDetail.postedAt).toLocaleString()}` : ''}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 14, maxWidth: 980 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Journal Header</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 12,
            padding: 12,
            border: `1px solid ${tokens.colors.border.subtle}`,
            borderRadius: 10,
            background: tokens.colors.surface.subtle,
          }}
        >
          <label>
            Journal Date
            <input type="date" value={journalDate} onChange={(e) => setJournalDate(e.target.value)} disabled={!canEditJournalDate} />
          </label>

          <label>
            Journal Type
            <select
              value={journalType}
              onChange={(e) => {
                setJournalType(e.target.value as any);
                if (isNew) setHasLockedJournalType(true);
              }}
              disabled={journalTypeDisabled}
            >
              <option value="STANDARD">STANDARD</option>
              <option value="ADJUSTING">ADJUSTING</option>
              <option value="ACCRUAL">ACCRUAL</option>
              <option value="REVERSING">REVERSING</option>
            </select>
            {isNew ? (
              <div style={{ marginTop: 4, fontSize: 12, color: tokens.colors.text.muted }}>
                Once selected, the journal type cannot be changed.
              </div>
            ) : null}
          </label>

          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>Reference</div>
            <div style={{ fontSize: 14, fontWeight: 650, color: tokens.colors.text.primary }}>
              {referenceDisplay || 'Reference will be generated on capture'}
            </div>
          </div>

          <label style={{ gridColumn: '1 / -1' }}>
            Journal Description (overall purpose) *
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              disabled={!canEditHeaderDescription}
              style={{ width: '100%' }}
            />
            <div style={{ marginTop: 4, fontSize: 12, color: tokens.colors.text.muted }}>
              This explains the overall reason for the journal. Each line below still needs its own reason.
            </div>
            {!readOnly && canEditHeaderDescription && headerDescriptionError ? (
              <div style={{ marginTop: 4, fontSize: 12, color: '#9a3412' }}>{headerDescriptionError}</div>
            ) : null}
          </label>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Journal Lines</div>
        <DataTable>
          <DataTable.Head>
            <tr>
              <DataTable.Th>#</DataTable.Th>
              <DataTable.Th>Account</DataTable.Th>
              {readOnly ? <DataTable.Th>Legal Entity</DataTable.Th> : null}
              {readOnly ? <DataTable.Th>Department / Cost Centre</DataTable.Th> : null}
              {readOnly ? <DataTable.Th>Project</DataTable.Th> : null}
              {readOnly ? <DataTable.Th>Fund</DataTable.Th> : null}
              <DataTable.Th>Line Description</DataTable.Th>
              <DataTable.Th align="right">Debit</DataTable.Th>
              <DataTable.Th align="right">Credit</DataTable.Th>
              {canEditLines ? <DataTable.Th>{''}</DataTable.Th> : null}
            </tr>
          </DataTable.Head>
          <DataTable.Body>
            {lines.map((l, idx) => {
              const detailLine = readOnly ? journalDetail?.lines?.find((x) => x.id === (l as any).id) ?? null : null;

              const accountDisplay = readOnly
                ? detailLine?.account
                  ? `${detailLine.account.code} — ${detailLine.account.name}`
                  : l.accountId
                    ? l.accountId
                    : '—'
                : null;

              return (
              <DataTable.Row key={idx} zebra index={idx}>
                <DataTable.Td style={{ width: 70 }}>
                  <input
                    type="number"
                    value={l.lineNumber ?? idx + 1}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, lineNumber: Number.isFinite(n) ? n : undefined } : x)));
                    }}
                    disabled={!canEditLines}
                    style={{ width: 64 }}
                  />
                </DataTable.Td>

                <DataTable.Td style={{ minWidth: readOnly ? 220 : 240 }}>
                  {readOnly ? (
                    <div style={{ fontSize: 13, fontWeight: 700, color: tokens.colors.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                      {accountDisplay}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {l.accountId && accountById.get(l.accountId) ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div
                            style={{ fontSize: 13, fontWeight: 700, color: tokens.colors.text.primary, cursor: canEditLines ? 'pointer' : 'default' }}
                            onClick={() => {
                              if (!canEditLines) return;
                              const acc = accountById.get(l.accountId);
                              if (!acc) return;
                              setAccountPanel({
                                rowIndex: idx,
                                priorLine: { ...l },
                                priorAccountPicker: accountPickerByRow[idx] ?? '',
                                account: acc,
                              });
                            }}
                            title={canEditLines ? 'Click to review or change dimensions' : undefined}
                          >
                            {accountById.get(l.accountId)?.code} — {accountById.get(l.accountId)?.name}
                          </div>

                          {canEditLines ? (
                            <button
                              onClick={() => setChangeAccountConfirm({ rowIndex: idx })}
                              style={{ fontSize: 12, fontWeight: 700 }}
                              type="button"
                            >
                              Change Account
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <input
                            ref={(el) => {
                              accountInputRefs.current[idx] = el;
                            }}
                            list={`gl-account-options-${idx}`}
                            value={accountPickerByRow[idx] ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setAccountPickerByRow((prev) => ({ ...prev, [idx]: v }));

                              const exact = accounts.find((a) => `${a.code} — ${a.name}` === v);
                              if (exact) {
                                setAccountPanel({
                                  rowIndex: idx,
                                  priorLine: { ...l },
                                  priorAccountPicker: accountPickerByRow[idx] ?? '',
                                  account: exact,
                                });
                              }
                            }}
                            onBlur={() => {
                              const label = (accountPickerByRow[idx] ?? '').trim();
                              const exact = accounts.find((a) => `${a.code} — ${a.name}` === label);
                              if (!exact) {
                                setAccountPickerByRow((prev) => ({ ...prev, [idx]: '' }));
                              }
                            }}
                            disabled={!canEditLines}
                            placeholder="Type account code or name…"
                            style={{ width: '100%' }}
                          />
                          <datalist id={`gl-account-options-${idx}`}>
                            {accounts.map((a) => (
                              <option key={a.id} value={`${a.code} — ${a.name}`} />
                            ))}
                          </datalist>
                        </>
                      )}

                      {!readOnly && canEditLines && lineValidationByIndex.get(idx)?.account ? (
                        <div style={{ fontSize: 12, color: '#9a3412' }}>{lineValidationByIndex.get(idx)?.account}</div>
                      ) : null}
                    </div>
                  )}
                </DataTable.Td>

                {readOnly ? (
                  <DataTable.Td style={{ minWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                    {formatDimension(detailLine?.legalEntity)}
                  </DataTable.Td>
                ) : null}

                {readOnly ? (
                  <DataTable.Td style={{ minWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
                    {formatDimension(detailLine?.department)}
                  </DataTable.Td>
                ) : null}

                {readOnly ? (
                  <DataTable.Td style={{ minWidth: 170, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                    {formatDimension((detailLine as any)?.project)}
                  </DataTable.Td>
                ) : null}

                {readOnly ? (
                  <DataTable.Td style={{ minWidth: 170, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                    {formatDimension((detailLine as any)?.fund)}
                  </DataTable.Td>
                ) : null}

                <DataTable.Td style={{ minWidth: 260 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <input
                      value={l.description ?? ''}
                      onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))}
                      disabled={!canEditLines}
                      style={{ width: '100%' }}
                      placeholder="Why is this account affected?"
                    />

                    {!readOnly && canEditLines && lineValidationByIndex.get(idx)?.description ? (
                      <div style={{ fontSize: 12, color: '#9a3412' }}>{lineValidationByIndex.get(idx)?.description}</div>
                    ) : null}
                  </div>
                </DataTable.Td>

                <DataTable.Td align="right" style={{ width: 160 }}>
                  <input
                    type="number"
                    value={l.debit}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, debit: Number.isFinite(v) ? v : 0 } : x)));
                    }}
                    disabled={!canEditLines}
                    style={{ width: 140, textAlign: 'right' }}
                    min={0}
                    step={0.01}
                  />
                </DataTable.Td>

                <DataTable.Td align="right" style={{ width: 160 }}>
                  <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                    <input
                      type="number"
                      value={l.credit}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, credit: Number.isFinite(v) ? v : 0 } : x)));
                      }}
                      disabled={!canEditLines}
                      style={{ width: 140, textAlign: 'right' }}
                      min={0}
                      step={0.01}
                    />

                    {!readOnly && canEditLines && lineValidationByIndex.get(idx)?.amount ? (
                      <div style={{ fontSize: 12, color: '#9a3412', textAlign: 'left', justifySelf: 'start' }}>
                        {lineValidationByIndex.get(idx)?.amount}
                      </div>
                    ) : null}
                  </div>
                </DataTable.Td>

                {canEditLines ? (
                  <DataTable.Td style={{ width: 80 }}>
                    <button
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      disabled={lines.length <= 2}
                      style={{ fontSize: 12 }}
                    >
                      Remove
                    </button>
                  </DataTable.Td>
                ) : null}
              </DataTable.Row>
              );
            })}
          </DataTable.Body>
        </DataTable>

        {canEditLines ? (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  {
                    lineNumber: (prev[prev.length - 1]?.lineNumber ?? prev.length) + 1,
                    accountId: '',
                    debit: 0,
                    credit: 0,
                  },
                ])
              }
              disabled={saving}
            >
              Add line
            </button>
          </div>
        ) : null}

        {!readOnly && accounts.length > 0 ? (
          <div style={{ marginTop: 10, fontSize: 12, color: tokens.colors.text.muted }}>
            Tip: each line must have an account, a legal entity, a department, a line description, and either a debit or a credit amount. Total debits must equal total credits.
          </div>
        ) : null}

        {!readOnly && canEditLines && totalsError ? (
          <div style={{ marginTop: 6, fontSize: 12, color: '#9a3412' }}>{totalsError}</div>
        ) : null}

        {readOnly && (journalDetail || journal) ? (
          <div style={{ marginTop: 10, fontSize: 12, color: tokens.colors.text.muted }}>
            This journal is {uiStatusLabel} and is read-only.
          </div>
        ) : null}

        {accounts.length === 0 && !loading ? (
          <div style={{ marginTop: 10, fontSize: 12, color: tokens.colors.text.muted }}>
            No GL accounts available. Ensure the Chart of Accounts is set up.
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 14, maxWidth: 980 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Footer</div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            padding: 12,
            border: `1px solid ${tokens.colors.border.subtle}`,
            borderRadius: 10,
            background: tokens.colors.surface.subtle,
          }}
        >
          <div style={{ fontSize: 13, color: balanceOk ? '#166534' : '#9a3412' }}>
            Totals: Debit {totals.totalDebit.toFixed(2)} | Credit {totals.totalCredit.toFixed(2)} | Net {totals.net.toFixed(2)}
            {balanceOk ? '' : ' (Journal must be balanced and non-zero)'}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {canCreate && canEditLines ? (
              <button
                onClick={onSave}
                disabled={
                  saving ||
                  workflowBusy ||
                  !canEditLines ||
                  Boolean(headerDescriptionError) ||
                  lineValidationByIndex.size > 0 ||
                  Boolean(totalsError)
                }
                title={captureDisabledReason ?? undefined}
              >
                {saving ? 'Capturing…' : 'Capture'}
              </button>
            ) : null}

            {canCreate && !isNew && status === 'DRAFT' && isCreator ? (
              <button
                onClick={onSubmitForReview}
                disabled={workflowBusy || Boolean(submitDisabledReason)}
                title={submitDisabledReason ?? undefined}
                style={{ fontWeight: 750 }}
              >
                Submit for Review
              </button>
            ) : null}

            {canCreate && !readOnly && canEditLines && (headerDescriptionError || lineValidationByIndex.size > 0 || totalsError || journalDateInfoMessage) ? (
              <div style={{ fontSize: 12, color: '#9a3412' }}>{captureDisabledReason}</div>
            ) : null}

            {isFinanceOfficerMaker && !isNew && status === 'DRAFT' && submitDisabledReason ? (
              <div style={{ fontSize: 12, color: '#9a3412' }}>{submitDisabledReason}</div>
            ) : null}
          </div>
        </div>
      </div>

      {!loading && lines.some((l) => l.accountId && !accountById.get(l.accountId)) ? (
        <div style={{ marginTop: 10, fontSize: 12, color: '#9a3412' }}>
          One or more selected accounts could not be loaded.
        </div>
      ) : null}

      <AccountContextPanel
        open={Boolean(accountPanel)}
        journalDate={journalDate}
        account={accountPanel?.account ?? null}
        initialValues={
          accountPanel
            ? {
                legalEntityId: accountPanel.priorLine.legalEntityId ?? null,
                departmentId: accountPanel.priorLine.departmentId ?? null,
                projectId: accountPanel.priorLine.projectId ?? null,
                fundId: accountPanel.priorLine.fundId ?? null,
              }
            : {}
        }
        onProjectsLoaded={(ps) => {
          if (projects.length === 0 && ps.length > 0) setProjects(ps);
        }}
        onApply={(values) => {
          if (!accountPanel) return;
          const idx = accountPanel.rowIndex;
          const accId = accountPanel.account.id;
          setLines((prev) =>
            prev.map((row, i) =>
              i === idx
                ? {
                    ...row,
                    accountId: accId,
                    legalEntityId: values.legalEntityId,
                    departmentId: values.departmentId,
                    projectId: values.projectId,
                    fundId: values.fundId,
                  }
                : row,
            ),
          );
          setAccountPickerByRow((prev) => ({ ...prev, [idx]: '' }));
          setAccountPanel(null);
        }}
        onCancel={() => {
          if (!accountPanel) return;
          const idx = accountPanel.rowIndex;
          const prior = accountPanel.priorLine;
          setLines((prev) => prev.map((row, i) => (i === idx ? { ...prior } : row)));
          setAccountPickerByRow((prev) => ({ ...prev, [idx]: accountPanel.priorAccountPicker }));
          setAccountPanel(null);
        }}
      />

      {changeAccountConfirm ? (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11,12,30,0.52)',
              zIndex: 90,
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: '20vh',
              left: '50%',
              transform: 'translate(-50%, 0)',
              width: 'min(520px, calc(100vw - 32px))',
              background: tokens.colors.white,
              borderRadius: tokens.radius.lg,
              border: `1px solid ${tokens.colors.border.subtle}`,
              boxShadow: '0 18px 80px rgba(11,12,30,0.28)',
              zIndex: 91,
              padding: tokens.spacing.x3,
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 850, color: tokens.colors.text.primary }}>Change Account</div>
            <div style={{ fontSize: 13, color: tokens.colors.text.secondary, lineHeight: '19px' }}>
              Changing the account will clear Legal Entity, Department, Project, and Fund selections for this line.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setChangeAccountConfirm(null)} type="button">
                Cancel
              </button>
              <button
                onClick={() => {
                  const idx = changeAccountConfirm.rowIndex;
                  setLines((prev) =>
                    prev.map((row, i) =>
                      i === idx
                        ? {
                            ...row,
                            accountId: '',
                            legalEntityId: null,
                            departmentId: null,
                            projectId: null,
                            fundId: null,
                          }
                        : row,
                    ),
                  );
                  setAccountPickerByRow((prev) => ({ ...prev, [idx]: '' }));
                  setAccountPanel(null);
                  setChangeAccountConfirm(null);
                  setTimeout(() => accountInputRefs.current[idx]?.focus(), 0);
                }}
                style={{ fontWeight: 750 }}
                type="button"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
