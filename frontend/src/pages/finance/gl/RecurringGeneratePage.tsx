import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Alert } from '../../../components/Alert';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage } from '../../../services/api';
import { generateRecurringTemplate, listRecurringTemplates, type RecurringJournalTemplate } from '../../../services/glRecurring.ts';

function applyPlaceholders(template: string, runDateIso: string) {
  const d = new Date(`${runDateIso}T00:00:00.000Z`);
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  const year = d.getUTCFullYear().toString();
  return (template || '').replaceAll('{MONTH}', month).replaceAll('{YEAR}', year);
}

export function RecurringGeneratePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;

  const canGenerate = hasPermission(PERMISSIONS.GL.RECURRING_GENERATE);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [template, setTemplate] = useState<RecurringJournalTemplate | null>(null);
  const [runDate, setRunDate] = useState<string>('');

  useEffect(() => {
    if (authLoading) return;
    if (!canGenerate) return;
    if (!id) return;

    setLoading(true);
    setError(null);
    listRecurringTemplates()
      .then((all) => {
        const found = (all ?? []).find((t) => t.id === id) ?? null;
        if (!found) {
          setError('Recurring template not found');
          setTemplate(null);
          return;
        }
        setTemplate(found);
        setRunDate(found.nextRunDate.slice(0, 10));
      })
      .catch((e) => setError(getApiErrorMessage(e, 'Failed to load template')))
      .finally(() => setLoading(false));
  }, [authLoading, canGenerate, id]);

  const totals = useMemo(() => {
    if (!template) return { debit: 0, credit: 0 };
    const debit = (template.lines ?? []).reduce((s, l) => s + Number(l.debitAmount ?? 0), 0);
    const credit = (template.lines ?? []).reduce((s, l) => s + Number(l.creditAmount ?? 0), 0);
    return { debit, credit };
  }, [template]);

  const preview = useMemo(() => {
    if (!template || !runDate) return { reference: '', description: '' };
    const reference = applyPlaceholders(template.referenceTemplate, runDate);
    const description = template.descriptionTemplate ? applyPlaceholders(template.descriptionTemplate, runDate) : '';
    return { reference, description };
  }, [template, runDate]);

  const onConfirm = async () => {
    if (!template) return;
    setSaving(true);
    setError(null);
    try {
      const res: any = await generateRecurringTemplate(template.id, {
        runDate: new Date(`${runDate}T00:00:00.000Z`).toISOString(),
      });
      const journalId = typeof res?.id === 'string' ? res.id : typeof res?.generatedJournalId === 'string' ? res.generatedJournalId : null;
      setToast('Journal generated successfully');
      window.setTimeout(() => setToast(null), 2000);
      if (journalId) {
        navigate(`/finance/gl/journals/${journalId}`, { replace: false });
      } else {
        navigate('/finance/gl/journals');
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to generate journal'));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <div style={{ marginTop: 12, color: tokens.colors.text.muted }}>Loading…</div>;

  if (!canGenerate) {
    return (
      <div>
        <h2>Generate Journal</h2>
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Access Denied">
            You do not have permission to generate recurring journals.
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
          <h2>Generate Journal</h2>
          <div style={{ marginTop: 6, fontSize: 13, color: tokens.colors.text.muted }}>
            This will create a normal journal in Captured state. It will still require approval and posting.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link to="/finance/gl/recurring">Back to Templates</Link>
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

      {template ? (
        <div style={{ marginTop: 14, maxWidth: 720 }}>
          <div style={{ fontWeight: 750 }}>{template.name}</div>

          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <label>
              Run date
              <input type="date" value={runDate} onChange={(e) => setRunDate(e.target.value)} disabled={saving} />
            </label>
            <div style={{ alignSelf: 'end', fontSize: 13, color: tokens.colors.text.muted }}>
              Next run date will update after generation.
            </div>
          </div>

          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: '#fff' }}>
            <div style={{ fontSize: 12, color: tokens.colors.text.muted }}>Reference preview</div>
            <div style={{ fontWeight: 750 }}>{preview.reference}</div>
            {preview.description ? (
              <>
                <div style={{ marginTop: 10, fontSize: 12, color: tokens.colors.text.muted }}>Description preview</div>
                <div style={{ fontWeight: 650 }}>{preview.description}</div>
              </>
            ) : null}
          </div>

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 360, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total debit</span>
                <span style={{ fontWeight: 750 }}>{totals.debit.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total credit</span>
                <span style={{ fontWeight: 750 }}>{totals.credit.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={onConfirm} disabled={saving || !runDate || !template.isActive} style={{ fontWeight: 750 }}>
              {saving ? 'Generating…' : 'Confirm Generate'}
            </button>
            <Link to={`/finance/gl/recurring/${template.id}`}>Back to Template</Link>
          </div>

          {!template.isActive ? (
            <div style={{ marginTop: 10 }}>
              <Alert tone="warning" title="Template inactive">
                Activate the template before generating.
              </Alert>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
