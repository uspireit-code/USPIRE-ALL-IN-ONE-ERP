import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { Alert } from '../../../components/Alert';
import { DataTable } from '../../../components/DataTable';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import { listAllGlAccounts } from '../../../services/gl';
import {
  createRecurringTemplate,
  listRecurringTemplates,
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

  const canManage = hasPermission('FINANCE_GL_RECURRING_MANAGE');
  const canGenerate = hasPermission('FINANCE_GL_RECURRING_GENERATE');
  const canAccess = canManage || canGenerate;
  const readOnly = !canManage;

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
  const [isActive, setIsActive] = useState(true);
  const [referenceTemplate, setReferenceTemplate] = useState('');
  const [descriptionTemplate, setDescriptionTemplate] = useState('');

  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; name: string; isActive: boolean }>>([]);

  const [lines, setLines] = useState<EditableLine[]>([
    { lineOrder: 1, accountId: '', descriptionTemplate: '', debitAmount: 0, creditAmount: 0 },
    { lineOrder: 2, accountId: '', descriptionTemplate: '', debitAmount: 0, creditAmount: 0 },
  ]);

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
        setIsActive(Boolean(found.isActive));
        setReferenceTemplate(found.referenceTemplate ?? '');
        setDescriptionTemplate(found.descriptionTemplate ?? '');
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
        isActive,
        referenceTemplate: referenceTemplate.trim(),
        descriptionTemplate: descriptionTemplate.trim() ? descriptionTemplate.trim() : undefined,
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
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Access Denied">
            You do not have permission to access Recurring Journals.
          </Alert>
        </div>
      </div>
    );
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
        <div>
          <h2>{isNew ? 'New Recurring Journal Template' : readOnly ? 'View Recurring Journal Template' : 'Edit Recurring Journal Template'}</h2>
          <div style={{ marginTop: 6, fontSize: 13, color: tokens.colors.text.muted }}>
            Placeholders supported: {'{MONTH}'}, {'{YEAR}'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/finance/gl/recurring">Back to Templates</Link>
          {canGenerate && !isNew && template ? (
            <button onClick={() => navigate(`/finance/gl/recurring/${template.id}/generate`)}>Generate Journal</button>
          ) : null}
        </div>
      </div>

      {loading ? <div style={{ marginTop: 12 }}>Loading…</div> : null}
      {error ? (
        <div style={{ marginTop: 12 }}>
          <Alert tone="error" title="Error">
            {error}
          </Alert>
        </div>
      ) : null}

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        <label>
          Template name
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} />
        </label>

        <label>
          Frequency
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as any)} disabled={readOnly}>
            <option value="MONTHLY">MONTHLY</option>
            <option value="QUARTERLY">QUARTERLY</option>
            <option value="YEARLY">YEARLY</option>
          </select>
        </label>

        <label>
          Start date
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={readOnly} />
        </label>

        <label>
          End date (optional)
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={readOnly} />
        </label>

        <label>
          Next run date
          <input type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} disabled={readOnly} />
        </label>

        <label>
          Status
          <select value={isActive ? 'ACTIVE' : 'INACTIVE'} onChange={(e) => setIsActive(e.target.value === 'ACTIVE')} disabled={readOnly}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>

        <label style={{ gridColumn: '1 / -1' }}>
          Reference template
          <input value={referenceTemplate} onChange={(e) => setReferenceTemplate(e.target.value)} disabled={readOnly} />
        </label>

        <label style={{ gridColumn: '1 / -1' }}>
          Description template (optional)
          <input value={descriptionTemplate} onChange={(e) => setDescriptionTemplate(e.target.value)} disabled={readOnly} />
        </label>
      </div>

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Template lines</h3>
        {!readOnly ? <button onClick={onAddLine}>Add line</button> : null}
      </div>

      <DataTable style={{ marginTop: 10 }}>
        <DataTable.Head>
          <tr>
            <DataTable.Th style={{ width: 64 }}>#</DataTable.Th>
            <DataTable.Th>Account</DataTable.Th>
            <DataTable.Th>Description template</DataTable.Th>
            <DataTable.Th align="right">Debit</DataTable.Th>
            <DataTable.Th align="right">Credit</DataTable.Th>
            <DataTable.Th align="right">Actions</DataTable.Th>
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
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, lineOrder: Number.isFinite(v) ? v : x.lineOrder } : x)));
                    }}
                    disabled={readOnly}
                    style={{ width: 60 }}
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
                    style={{ width: '100%' }}
                  >
                    <option value="">Select account…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
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
                    style={{ width: '100%' }}
                    placeholder="Optional"
                  />
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
                    style={{ width: 120, textAlign: 'right' }}
                  />
                </DataTable.Td>
                <DataTable.Td align="right">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <input
                      type="number"
                      value={l.creditAmount}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, creditAmount: Number.isFinite(v) ? v : 0 } : x)));
                      }}
                      disabled={readOnly}
                      style={{ width: 120, textAlign: 'right' }}
                    />
                    {xorError ? <div style={{ color: 'crimson', fontSize: 12 }}>{xorError}</div> : null}
                  </div>
                </DataTable.Td>
                <DataTable.Td align="right">
                  {!readOnly ? (
                    <button onClick={() => onRemoveLine(idx)} disabled={lines.length <= 2} style={{ fontSize: 12 }}>
                      Remove
                    </button>
                  ) : null}
                </DataTable.Td>
              </DataTable.Row>
            );
          })}
        </DataTable.Body>
      </DataTable>

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: 360, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total debit</span>
            <span style={{ fontWeight: 750 }}>{totals.totalDebit.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total credit</span>
            <span style={{ fontWeight: 750 }}>{totals.totalCredit.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: balanceOk ? '#166534' : '#9a3412' }}>
            <span>{balanceOk ? 'Balanced' : 'Not balanced'}</span>
            <span style={{ fontWeight: 750 }}>{totals.net.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {canManage ? (
          <button onClick={onSave} disabled={saving || readOnly}>
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        ) : null}
        <Link to="/finance/gl/recurring">Back to Templates</Link>
      </div>
    </div>
  );
}
