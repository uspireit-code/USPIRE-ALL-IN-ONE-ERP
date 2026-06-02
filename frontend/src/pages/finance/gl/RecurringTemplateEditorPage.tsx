import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { DataTable } from '../../../components/DataTable';
import { Input } from '../../../components/Input';
import { NoticeCard } from '../../../components/NoticeCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import { listAllGlAccounts } from '../../../services/gl';
import {
  approveRecurringTemplate,
  archiveRecurringTemplate,
  createRecurringTemplate,
  listRecurringTemplates,
  reactivateRecurringTemplate,
  submitRecurringTemplate,
  suspendRecurringTemplate,
  updateRecurringTemplate,
  type RecurringJournalFrequency,
  type RecurringJournalTemplate,
  type RecurringJournalTemplateLine,
} from '../../../services/glRecurring.ts';

type EditableLine = {
  accountId: string;
  descriptionTemplate: string;
  debitAmount: number;
  creditAmount: number;
  lineOrder: number;
};

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function RecurringTemplateEditorPage() {
  const { id } = useParams();
  const isNew = id === undefined;
  const navigate = useNavigate();

  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;

  const canManage = hasPermission(PERMISSIONS.GL.RECURRING_MANAGE);
  const canGenerate = hasPermission(PERMISSIONS.GL.RECURRING_GENERATE);
  const canApprove = hasPermission(PERMISSIONS.GL.APPROVE);
  const canAccess = canManage || canGenerate;
  const readOnly = !canManage;

  const actorUserId = state.me?.actingUser?.id ?? state.me?.user?.id ?? null;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [template, setTemplate] = useState<RecurringJournalTemplate | null>(null);

  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<RecurringJournalFrequency>('MONTHLY');
  const [startDate, setStartDate] = useState(toIsoDate(new Date()));
  const [endDate, setEndDate] = useState<string>('');
  const [nextRunDate, setNextRunDate] = useState(toIsoDate(new Date()));
  const [referenceTemplate, setReferenceTemplate] = useState('');
  const [descriptionTemplate, setDescriptionTemplate] = useState('');

  const [intent, setIntent] = useState('OPERATIONAL');
  const [intentNotes, setIntentNotes] = useState('');
  const [intentReference, setIntentReference] = useState('');

  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; name: string; isActive: boolean }>>([]);

  const [lines, setLines] = useState<EditableLine[]>([
    { lineOrder: 1, accountId: '', descriptionTemplate: '', debitAmount: 0, creditAmount: 0 },
    { lineOrder: 2, accountId: '', descriptionTemplate: '', debitAmount: 0, creditAmount: 0 },
  ]);

  const lifecycleStatus = useMemo(() => {
    if (!template) return 'DRAFT';
    return (template as any).status ?? (template.isActive ? 'APPROVED' : 'SUSPENDED');
  }, [template]);

  const isSelfCreatedTemplate = useMemo(() => {
    if (!template) return false;
    if (!actorUserId) return false;
    return String((template as any).createdById ?? '') === String(actorUserId);
  }, [template, actorUserId]);

  const canGenerateNow = useMemo(() => {
    return Boolean(canGenerate && !isNew && template && String(lifecycleStatus) === 'APPROVED');
  }, [canGenerate, isNew, template, lifecycleStatus]);

  const [confirmAction, setConfirmAction] = useState<
    | null
    | {
        type: 'SUBMIT' | 'APPROVE' | 'SUSPEND' | 'ARCHIVE' | 'REACTIVATE';
        title: string;
        subtitle: string;
      }
  >(null);
  const [actionReason, setActionReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  function ModalShell(props: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: number;
  }) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(11,12,30,0.38)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 50,
        }}
        onMouseDown={(e) => {
          if (e.currentTarget === e.target) props.onClose();
        }}
      >
        <div
          style={{
            width: props.width ?? 560,
            maxWidth: '96vw',
            maxHeight: '85vh',
            background: '#fff',
            borderRadius: 16,
            border: '1px solid rgba(11,12,30,0.08)',
            boxShadow: '0 10px 30px rgba(11,12,30,0.20)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: 16,
              borderBottom: '1px solid rgba(11,12,30,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: tokens.colors.text.primary }}>{props.title}</div>
              {props.subtitle ? <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(11,12,30,0.62)' }}>{props.subtitle}</div> : null}
            </div>
            <Button variant="ghost" size="sm" onClick={props.onClose}>
              Close
            </Button>
          </div>
          <div style={{ padding: 16, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>{props.children}</div>
          {props.footer ? (
            <div
              style={{
                padding: 16,
                borderTop: '1px solid rgba(11,12,30,0.08)',
                boxShadow: '0 -8px 20px rgba(11,12,30,0.06)',
                background: '#fff',
              }}
            >
              {props.footer}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const lineXorErrorsByIndex = useMemo(() => {
    const errors = new Map<number, string>();
    lines.forEach((l, idx) => {
      const debit = Number.isFinite(l.debitAmount) ? l.debitAmount : 0;
      const credit = Number.isFinite(l.creditAmount) ? l.creditAmount : 0;
      if (debit > 0 && credit > 0) errors.set(idx, 'Enter either a debit or a credit, not both.');
      if (debit === 0 && credit === 0) errors.set(idx, 'Enter a debit or a credit.');
    });
    return errors;
  }, [lines]);

  const totals = useMemo(() => {
    const totalDebit = lines.reduce((s, l) => s + (Number.isFinite(l.debitAmount) ? l.debitAmount : 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (Number.isFinite(l.creditAmount) ? l.creditAmount : 0), 0);
    const net = Math.round((totalDebit - totalCredit) * 100) / 100;
    return { totalDebit, totalCredit, net };
  }, [lines]);

  const balanceOk = totals.net === 0 && totals.totalDebit > 0;

  const pageMaxWidth = 1100;
  const controlLabelStyle: React.CSSProperties = {
    display: 'grid',
    gap: 6,
  };

  const runLifecycleAction = async () => {
    if (!template || !confirmAction) return;
    setActionBusy(true);
    setError(null);
    try {
      const reason = actionReason.trim() ? actionReason.trim() : undefined;
      const next =
        confirmAction.type === 'SUBMIT'
          ? await submitRecurringTemplate(template.id, { reason })
          : confirmAction.type === 'APPROVE'
            ? await approveRecurringTemplate(template.id, { reason })
            : confirmAction.type === 'SUSPEND'
              ? await suspendRecurringTemplate(template.id, { reason })
              : confirmAction.type === 'ARCHIVE'
                ? await archiveRecurringTemplate(template.id, { reason })
                : await reactivateRecurringTemplate(template.id, { reason });

      setTemplate(next);
      setToast('Status updated');
      window.setTimeout(() => setToast(null), 2500);
      setConfirmAction(null);
      setActionReason('');
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to update status'));
    } finally {
      setActionBusy(false);
    }
  };
  const labelTextStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 750,
    color: tokens.colors.text.primary,
  };
  const helperTextStyle: React.CSSProperties = {
    fontSize: 12,
    color: tokens.colors.text.muted,
    lineHeight: '16px',
  };
  const selectStyle: React.CSSProperties = {
    width: '100%',
    height: 40,
    padding: '0 12px',
    borderRadius: tokens.radius.sm,
    border: `1px solid ${tokens.colors.border.default}`,
    background: tokens.colors.white,
    color: tokens.colors.text.primary,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };
  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 72,
    padding: '10px 12px',
    borderRadius: tokens.radius.sm,
    border: `1px solid ${tokens.colors.border.default}`,
    background: tokens.colors.white,
    color: tokens.colors.text.primary,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
  };
  const lineNumberInputStyle: React.CSSProperties = {
    width: 64,
    height: 38,
    padding: '0 10px',
    borderRadius: tokens.radius.sm,
    border: `1px solid ${tokens.colors.border.default}`,
    background: tokens.colors.white,
    color: tokens.colors.text.primary,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };
  const amountInputStyle: React.CSSProperties = {
    width: 132,
    height: 38,
    padding: '0 10px',
    borderRadius: tokens.radius.sm,
    border: `1px solid ${tokens.colors.border.default}`,
    background: tokens.colors.white,
    color: tokens.colors.text.primary,
    fontSize: 14,
    fontVariantNumeric: 'tabular-nums',
    outline: 'none',
    boxSizing: 'border-box',
    textAlign: 'right',
  };

  useEffect(() => {
    if (!canAccess) return;
    listAllGlAccounts()
      .then((a) => setAccounts((a ?? []).map((x) => ({ id: x.id, code: x.code, name: x.name, isActive: x.isActive }))))
      .catch(() => undefined);
  }, [canAccess]);

  useEffect(() => {
    if (authLoading) return;
    if (!canAccess) return;
    if (isNew) return;

    setLoading(true);
    setError(null);
    listRecurringTemplates()
      .then((all) => {
        const found = (all ?? []).find((t) => t.id === id) ?? null;
        if (!found) {
          setTemplate(null);
          setError('Recurring template not found');
          return;
        }
        setTemplate(found);
        setName(found.name);
        setFrequency(found.frequency);
        setStartDate(found.startDate.slice(0, 10));
        setEndDate(found.endDate ? found.endDate.slice(0, 10) : '');
        setNextRunDate(found.nextRunDate.slice(0, 10));
        setReferenceTemplate(found.referenceTemplate ?? '');
        setDescriptionTemplate(found.descriptionTemplate ?? '');
        setIntent(String((found as any).intent ?? 'OPERATIONAL'));
        setIntentNotes(String((found as any).intentNotes ?? ''));
        setIntentReference(String((found as any).intentReference ?? ''));
        const loadedLines: EditableLine[] = (found.lines ?? [])
          .slice()
          .sort((a, b) => a.lineOrder - b.lineOrder)
          .map((l: RecurringJournalTemplateLine) => ({
            lineOrder: l.lineOrder,
            accountId: l.accountId,
            descriptionTemplate: (l.descriptionTemplate ?? '') as string,
            debitAmount: Number(l.debitAmount ?? 0),
            creditAmount: Number(l.creditAmount ?? 0),
          }));
        setLines(loadedLines.length > 0 ? loadedLines : lines);
      })
      .catch((e) => setError(getApiErrorMessage(e, 'Failed to load template')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canAccess, isNew, id]);

  const onAddLine = () => {
    setLines((prev) => {
      const nextOrder = prev.length > 0 ? Math.max(...prev.map((l) => l.lineOrder)) + 1 : 1;
      return [...prev, { lineOrder: nextOrder, accountId: '', descriptionTemplate: '', debitAmount: 0, creditAmount: 0 }];
    });
  };

  const onRemoveLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSave = async () => {
    if (!canManage) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        journalType: 'STANDARD' as const,
        frequency,
        startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
        endDate: endDate.trim() ? new Date(`${endDate}T00:00:00.000Z`).toISOString() : undefined,
        nextRunDate: new Date(`${nextRunDate}T00:00:00.000Z`).toISOString(),
        referenceTemplate: referenceTemplate.trim(),
        descriptionTemplate: descriptionTemplate.trim() ? descriptionTemplate.trim() : undefined,
        intent: String(intent ?? '').trim(),
        intentNotes: intentNotes.trim() ? intentNotes.trim() : undefined,
        intentReference: intentReference.trim() ? intentReference.trim() : undefined,
        lines: lines
          .slice()
          .sort((a, b) => a.lineOrder - b.lineOrder)
          .map((l) => ({
            accountId: l.accountId,
            descriptionTemplate: l.descriptionTemplate.trim() ? l.descriptionTemplate.trim() : undefined,
            debitAmount: Number.isFinite(l.debitAmount) ? l.debitAmount : 0,
            creditAmount: Number.isFinite(l.creditAmount) ? l.creditAmount : 0,
            lineOrder: l.lineOrder,
          })),
      };

      if (!payload.name) throw new Error('Template name is required');
      if (!payload.referenceTemplate) throw new Error('Reference template is required');
      if (!payload.intent) throw new Error('Intent is required');
      if (payload.lines.length < 2) throw new Error('At least 2 lines are required');
      if (!balanceOk) throw new Error('Template must be balanced and non-zero');
      if (lineXorErrorsByIndex.size > 0) throw new Error('Fix line debit/credit issues before saving');

      const saved = isNew ? await createRecurringTemplate(payload) : await updateRecurringTemplate(id as string, payload);
      setTemplate(saved);
      setToast('Template saved successfully');
      window.setTimeout(() => setToast(null), 2500);
      if (isNew) {
        navigate(`/finance/gl/recurring/${saved.id}`, { replace: true });
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to save template'));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <div style={{ marginTop: 12, color: tokens.colors.text.muted }}>Loading…</div>;
  }

  if (!canAccess) {
    return (
      <div>
        <h2>Recurring Journal Template</h2>
        <div style={{ marginTop: 14, maxWidth: 820 }}>
          <NoticeCard kind="permission" title="Access restricted">
            You do not have permission to access recurring journal templates.
          </NoticeCard>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: pageMaxWidth }}>
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

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
          paddingBottom: 8,
          borderBottom: `1px solid ${tokens.colors.border.subtle}`,
        }}
      >
        <div style={{ minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="ghost" size="sm" onClick={() => navigate('/finance/gl/recurring')}>
              Back
            </Button>
            <h2 style={{ margin: 0 }}>
              {isNew
                ? 'New Recurring Journal Template'
                : readOnly
                  ? 'View Recurring Journal Template'
                  : 'Edit Recurring Journal Template'}
            </h2>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: tokens.colors.text.muted, maxWidth: 820 }}>
            Configure a controlled recurring journal template. Generated journals still pass through approval governance and audit controls.
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.muted }}>
            Placeholders supported in reference/description: {'{MONTH}'}, {'{YEAR}'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {!isNew && template ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <StatusBadge state={String(lifecycleStatus)} />
              {canGenerate ? (
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/finance/gl/recurring/${template.id}/generate`)}
                  disabled={!canGenerateNow}
                >
                  Generate Journal
                </Button>
              ) : null}
            </div>
          ) : null}

          {!isNew && template ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {canManage && String(lifecycleStatus) === 'DRAFT' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setConfirmAction({
                      type: 'SUBMIT',
                      title: 'Submit for approval?',
                      subtitle: 'This will lock the template for editing until approved.',
                    })
                  }
                >
                  Submit
                </Button>
              ) : null}

              {canApprove && String(lifecycleStatus) === 'PENDING_APPROVAL' ? (
                isSelfCreatedTemplate ? (
                  <div style={{ fontSize: 12, color: tokens.colors.text.muted, fontWeight: 650, maxWidth: 240 }}>
                    Maker-checker: you cannot approve a template you created.
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() =>
                      setConfirmAction({
                        type: 'APPROVE',
                        title: 'Approve template?',
                        subtitle:
                          'Approval enables generation. This action is audit recorded and does not bypass journal approval workflow.',
                      })
                    }
                  >
                    Approve
                  </Button>
                )
              ) : null}

              {canApprove && String(lifecycleStatus) === 'APPROVED' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setConfirmAction({
                      type: 'SUSPEND',
                      title: 'Suspend template?',
                      subtitle: 'Suspended templates cannot be generated until reactivated.',
                    })
                  }
                >
                  Suspend
                </Button>
              ) : null}

              {canApprove && String(lifecycleStatus) === 'SUSPENDED' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setConfirmAction({
                      type: 'REACTIVATE',
                      title: 'Reactivate template?',
                      subtitle: 'Reactivated templates return to Approved status.',
                    })
                  }
                >
                  Reactivate
                </Button>
              ) : null}

              {canApprove && (String(lifecycleStatus) === 'APPROVED' || String(lifecycleStatus) === 'SUSPENDED') ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    setConfirmAction({
                      type: 'ARCHIVE',
                      title: 'Archive template?',
                      subtitle: 'Archived templates cannot be transitioned and cannot be generated.',
                    })
                  }
                >
                  Archive
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {loading ? <div style={{ marginTop: 12 }}>Loading…</div> : null}
      {error ? (
        <div style={{ marginTop: 12, maxWidth: 820 }}>
          <NoticeCard kind="system" title="Unable to load template">
            {error}
          </NoticeCard>
        </div>
      ) : null}

      <div style={{ marginTop: 12, maxWidth: 820 }}>
        <NoticeCard kind="info" title="Governance notice">
          Recurring journal generation does not bypass journal approval or posting controls. Generated journals still enter the standard GL governance workflow.
        </NoticeCard>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
        <Card
          title="Template setup"
          subtitle="Define scheduling, activation, and reference metadata used when journals are generated."
          style={{ padding: tokens.spacing.x2 }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 10,
              alignItems: 'start',
            }}
          >
            <label style={controlLabelStyle}>
              <div style={labelTextStyle}>Template name</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} placeholder="e.g. Monthly rent accrual" />
              <div style={helperTextStyle}>Unique per tenant. Use an operationally recognizable name.</div>
            </label>

            <label style={controlLabelStyle}>
              <div style={labelTextStyle}>Frequency</div>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)} disabled={readOnly} style={selectStyle}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </select>
              <div style={helperTextStyle}>Controls how scheduling dates are interpreted operationally.</div>
            </label>

            <div style={controlLabelStyle}>
              <div style={labelTextStyle}>Lifecycle status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}>
                <StatusBadge state={String(lifecycleStatus)} />
                <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>
                  Templates must be approved before generation.
                </div>
              </div>
              <div style={helperTextStyle}>Use the lifecycle actions in the header to submit, approve, suspend, archive, or reactivate.</div>
            </div>

            <label style={controlLabelStyle}>
              <div style={labelTextStyle}>Start date</div>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={readOnly} />
              <div style={helperTextStyle}>The earliest date the schedule is considered valid.</div>
            </label>

            <label style={controlLabelStyle}>
              <div style={labelTextStyle}>End date</div>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={readOnly} placeholder="Optional" />
              <div style={helperTextStyle}>Optional. Leave blank for an indefinite schedule.</div>
            </label>

            <label style={controlLabelStyle}>
              <div style={labelTextStyle}>Next run date</div>
              <Input type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} disabled={readOnly} />
              <div style={helperTextStyle}>Used to track the next planned generation point.</div>
            </label>

            <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 12, marginTop: 2 }}>
              <label style={controlLabelStyle}>
                <div style={labelTextStyle}>Reference template</div>
                <Input
                  value={referenceTemplate}
                  onChange={(e) => setReferenceTemplate(e.target.value)}
                  disabled={readOnly}
                  placeholder="e.g. RENT-{MONTH}-{YEAR}"
                />
                <div style={helperTextStyle}>
                  Required. This becomes the generated journal reference (supports {'{MONTH}'}, {'{YEAR}'}).
                </div>
              </label>
            </div>
          </div>
        </Card>

        <Card
          title="Governance & intent"
          subtitle="Capture intent metadata for audit, governance reviews, and downstream controls."
          style={{ padding: tokens.spacing.x2 }}
        >
          <div style={{ marginBottom: 10, maxWidth: 920 }}>
            <NoticeCard kind="governance" tone="info" title="Governance reminder">
              Generated journals still pass through approval governance and audit controls.
            </NoticeCard>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 10,
              alignItems: 'start',
            }}
          >
            <label style={controlLabelStyle}>
              <div style={labelTextStyle}>Intent</div>
              <select value={intent} onChange={(e) => setIntent(e.target.value)} disabled={readOnly} style={selectStyle}>
                <option value="OPERATIONAL">Operational</option>
                <option value="ACCRUAL">Accrual</option>
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="CORRECTION">Correction</option>
                <option value="REVERSAL">Reversal</option>
                <option value="RECLASSIFICATION">Reclassification</option>
                <option value="OPENING_BALANCE">Opening balance</option>
                <option value="CLOSING">Closing</option>
                <option value="TAX">Tax</option>
                <option value="INTERCOMPANY">Intercompany</option>
                <option value="AUDIT_ADJUSTMENT">Audit adjustment</option>
                <option value="SYSTEM_GENERATED">System generated</option>
              </select>
              <div style={helperTextStyle}>Required. Used for audit classification and governance reporting.</div>
            </label>

            <label style={{ ...controlLabelStyle, gridColumn: '1 / -1' }}>
              <div style={labelTextStyle}>Intent notes</div>
              <textarea value={intentNotes} onChange={(e) => setIntentNotes(e.target.value)} disabled={readOnly} style={textareaStyle} />
              <div style={helperTextStyle}>Optional operator guidance and governance context (who/what/why).</div>
            </label>

            <label style={{ ...controlLabelStyle, gridColumn: '1 / -1' }}>
              <div style={labelTextStyle}>Intent reference</div>
              <Input
                value={intentReference}
                onChange={(e) => setIntentReference(e.target.value)}
                disabled={readOnly}
                placeholder="Policy ID, memo ref, ticket, or supporting document ID"
              />
              <div style={helperTextStyle}>Optional. Links the template to an external control, policy, or decision record.</div>
            </label>

            <label style={{ ...controlLabelStyle, gridColumn: '1 / -1' }}>
              <div style={labelTextStyle}>Description template</div>
              <Input
                value={descriptionTemplate}
                onChange={(e) => setDescriptionTemplate(e.target.value)}
                disabled={readOnly}
                placeholder="Optional. Appears on the generated journal description"
              />
              <div style={helperTextStyle}>Optional. Supports {'{MONTH}'}, {'{YEAR}'}.</div>
            </label>
          </div>
        </Card>

        <Card
          title="Template lines"
          subtitle="Define the balanced journal lines to generate. Each line must have either a debit or a credit."
          style={{ padding: tokens.spacing.x2 }}
        >
          <DataTable style={{ marginTop: 6 }}>
            <DataTable.Head>
              <tr>
                <DataTable.Th style={{ width: 72 }}>#</DataTable.Th>
                <DataTable.Th style={{ minWidth: 260 }}>Account</DataTable.Th>
                <DataTable.Th>Description template</DataTable.Th>
                <DataTable.Th align="right" style={{ width: 150 }}>
                  Debit
                </DataTable.Th>
                <DataTable.Th align="right" style={{ width: 150 }}>
                  Credit
                </DataTable.Th>
                <DataTable.Th align="right" style={{ width: 148 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                    {!readOnly ? (
                      <Button size="sm" variant="secondary" onClick={onAddLine}>
                        Add line
                      </Button>
                    ) : null}
                  </div>
                </DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {lines.map((l, idx) => {
                const xorError = lineXorErrorsByIndex.get(idx);
                return (
                  <DataTable.Row key={`${l.lineOrder}-${idx}`} zebra index={idx}>
                    <DataTable.Td>
                      <input
                        type="number"
                        value={l.lineOrder}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setLines((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, lineOrder: Number.isFinite(v) ? v : x.lineOrder } : x)),
                          );
                        }}
                        disabled={readOnly}
                        style={lineNumberInputStyle}
                      />
                    </DataTable.Td>
                    <DataTable.Td>
                      <select
                        value={l.accountId}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, accountId: v } : x)));
                        }}
                        disabled={readOnly}
                        style={{ ...selectStyle, height: 38 }}
                      >
                        <option value="">Select account…</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}{a.isActive ? '' : ' (inactive)'}
                          </option>
                        ))}
                      </select>
                    </DataTable.Td>
                    <DataTable.Td>
                      <input
                        value={l.descriptionTemplate}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, descriptionTemplate: v } : x)));
                        }}
                        disabled={readOnly}
                        style={{ ...lineNumberInputStyle, width: '100%' }}
                        placeholder="Optional"
                      />
                      {xorError ? (
                        <div style={{ marginTop: 4, color: '#b91c1c', fontSize: 12, fontWeight: 650 }}>{xorError}</div>
                      ) : null}
                    </DataTable.Td>
                    <DataTable.Td align="right">
                      <input
                        type="number"
                        value={l.debitAmount}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, debitAmount: Number.isFinite(v) ? v : 0 } : x)));
                        }}
                        disabled={readOnly}
                        style={amountInputStyle}
                      />
                    </DataTable.Td>
                    <DataTable.Td align="right">
                      <input
                        type="number"
                        value={l.creditAmount}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, creditAmount: Number.isFinite(v) ? v : 0 } : x)));
                        }}
                        disabled={readOnly}
                        style={amountInputStyle}
                      />
                    </DataTable.Td>
                    <DataTable.Td align="right">
                      {!readOnly ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveLine(idx)}
                          disabled={lines.length <= 2}
                          title="Remove line"
                          style={{ padding: '7px 10px', minWidth: 0 }}
                        >
                          ×
                        </Button>
                      ) : null}
                    </DataTable.Td>
                  </DataTable.Row>
                );
              })}
            </DataTable.Body>
          </DataTable>

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <div
              style={{
                width: 420,
                border: `1px solid ${tokens.colors.border.subtle}`,
                borderRadius: tokens.radius.md,
                padding: 12,
                background: tokens.colors.surface.subtle,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: tokens.colors.text.muted, fontWeight: 650 }}>Total debit</span>
                <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{totals.totalDebit.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
                <span style={{ color: tokens.colors.text.muted, fontWeight: 650 }}>Total credit</span>
                <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{totals.totalCredit.toFixed(2)}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: `1px solid ${tokens.colors.border.subtle}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 800,
                      border: `1px solid ${balanceOk ? 'rgba(22,101,52,0.25)' : 'rgba(154,52,18,0.30)'}`,
                      background: balanceOk ? 'rgba(22,101,52,0.08)' : 'rgba(154,52,18,0.08)',
                      color: balanceOk ? '#166534' : '#9a3412',
                    }}
                  >
                    {balanceOk ? 'Balanced' : 'Not balanced'}
                  </span>
                  <span style={{ fontSize: 12, color: tokens.colors.text.muted, fontWeight: 650 }}>
                    Net
                  </span>
                </div>
                <div style={{ fontWeight: 900, color: balanceOk ? '#166534' : '#9a3412' }}>{totals.net.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          paddingTop: 12,
          borderTop: `1px solid ${tokens.colors.border.subtle}`,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => navigate('/finance/gl/recurring')}>
            Cancel / Back
          </Button>
          {!balanceOk ? (
            <div style={{ fontSize: 12, color: tokens.colors.text.muted, fontWeight: 650 }}>
              Resolve balance issues before saving.
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {canManage ? (
            <Button variant="primary" onClick={onSave} disabled={saving || readOnly}>
              {saving ? 'Saving…' : 'Save Draft'}
            </Button>
          ) : null}
        </div>
      </div>

      {confirmAction && template ? (
        <ModalShell
          title={confirmAction.title}
          subtitle={confirmAction.subtitle}
          onClose={() => (actionBusy ? undefined : setConfirmAction(null))}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => setConfirmAction(null)} disabled={actionBusy}>
                Cancel
              </Button>
              <Button variant="primary" onClick={runLifecycleAction} disabled={actionBusy}>
                {actionBusy ? 'Working…' : 'Confirm'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'grid', gap: 10 }}>
            {confirmAction.type === 'APPROVE' ? (
              <div style={{ fontSize: 13, color: tokens.colors.text.secondary, lineHeight: '18px' }}>
                Approval enables controlled generation from this template. Generated journals still require review, approval, and posting under normal GL governance.
              </div>
            ) : null}
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>
              Reason (optional)
            </div>
            <Input value={actionReason} onChange={(e) => setActionReason(e.target.value)} disabled={actionBusy} placeholder="Optional reason for audit trail" />
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
