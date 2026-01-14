import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '@/security/permissionCatalog';
import type { ApiError } from '../../services/api';
import { getApiErrorMessage } from '../../services/api';
import { listGlPeriods, type AccountingPeriod } from '../../services/gl';
import {
  downloadIfrsNotePdf,
  generateDisclosureNote,
  getIfrsNote,
  listIfrsNotes,
  type DisclosureNoteResponse,
  type IfrsDisclosureNoteCode,
  type IfrsDisclosureNoteDto,
  type IfrsDisclosureNotesIndexItem,
} from '../../services/disclosureNotes';

function money(n: number) {
  const v = Number(n ?? 0);
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(v));
  return v < 0 ? `(${formatted})` : formatted;
}

function formatDateValue(s: string) {
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(s.trim());
  if (!m) return s;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function formatMaybeDateString(v: unknown) {
  if (typeof v !== 'string') return v;
  const trimmed = v.trim();
  if (trimmed.includes(' to ')) {
    const [a, b] = trimmed.split(' to ').map((x) => x.trim());
    if (a && b) return `${formatDateValue(a)} to ${formatDateValue(b)}`;
  }
  return formatDateValue(trimmed);
}

function IfrsNoteTable({ t }: { t: IfrsDisclosureNoteDto['tables'][number] }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{t.title}</div>

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {t.columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align === 'right' ? 'right' : 'left',
                  borderBottom: '1px solid #ddd',
                  padding: '8px 12px',
                  fontWeight: 700,
                  lineHeight: 1.3,
                  verticalAlign: 'top',
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {t.rows.map((r, rIdx) => {
            const firstKey = t.columns[0]?.key;
            const firstVal = firstKey ? (r as any)?.[firstKey] : undefined;
            const isTotalRow =
              typeof firstVal === 'string' &&
              (firstVal.trim() === 'Total' || firstVal.trim().startsWith('Total'));
            return (
              <tr key={rIdx} style={isTotalRow ? { fontWeight: 700 } : undefined}>
                {t.columns.map((c) => {
                  const v = (r as any)?.[c.key];
                  const isNumeric = typeof v === 'number' || c.align === 'right';
                  const display = formatMaybeDateString(v);
                  return (
                    <td
                      key={c.key}
                      style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid #eee',
                        textAlign: c.align === 'right' ? 'right' : 'left',
                        verticalAlign: 'top',
                        whiteSpace: 'normal',
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                        lineHeight: 1.55,
                        fontWeight: isTotalRow ? 700 : 400,
                      }}
                    >
                      {isNumeric ? money(Number(v ?? 0)) : String(display ?? '')}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type PpeRow = {
  categoryCode: string;
  categoryName: string;
  opening: number;
  additions: number;
  disposals: number;
  depreciation: number;
  closing: number;
};

type DepRow = {
  categoryCode: string;
  categoryName: string;
  cost: number;
  depreciationForPeriod: number;
  accumulatedDepreciation: number;
};

type TaxRow = {
  taxType: string;
  openingBalance: number;
  taxCharged: number;
  taxPaid: number;
  adjustments: number;
  closingBalance: number;
};

export function DisclosureNotesPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission(PERMISSIONS.DISCLOSURE.VIEW);
  const canGenerate = hasPermission(PERMISSIONS.DISCLOSURE.GENERATE);
  const canExport = hasPermission(PERMISSIONS.REPORT.EXPORT);

  const [mode, setMode] = useState<'LEGACY' | 'IFRS'>('IFRS');

  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [selectedNote, setSelectedNote] = useState<
    'PPE_MOVEMENT' | 'DEPRECIATION' | 'TAX_RECONCILIATION'
  >('PPE_MOVEMENT');
  const [ifrsIndex, setIfrsIndex] = useState<IfrsDisclosureNotesIndexItem[]>([]);
  const [ifrsNoteCode, setIfrsNoteCode] = useState<IfrsDisclosureNoteCode>('A');
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<DisclosureNoteResponse | null>(null);
  const [ifrsNote, setIfrsNote] = useState<IfrsDisclosureNoteDto | null>(null);

  const closedPeriods = useMemo(
    () => periods.filter((p) => p.status === 'CLOSED').sort((a, b) => String(a.startDate).localeCompare(String(b.startDate))),
    [periods],
  );

  const ppeRows: PpeRow[] = useMemo(() => {
    const lines = note?.lines ?? [];
    return lines
      .map((l) => l.values as any)
      .filter(Boolean)
      .map((v) => ({
        categoryCode: String(v.categoryCode ?? ''),
        categoryName: String(v.categoryName ?? ''),
        opening: Number(v.opening ?? 0),
        additions: Number(v.additions ?? 0),
        disposals: Number(v.disposals ?? 0),
        depreciation: Number(v.depreciation ?? 0),
        closing: Number(v.closing ?? 0),
      }));
  }, [note]);

  const totals = useMemo(() => {
    return ppeRows.reduce(
      (s, r) => {
        s.opening += r.opening;
        s.additions += r.additions;
        s.disposals += r.disposals;
        s.depreciation += r.depreciation;
        s.closing += r.closing;
        return s;
      },
      { opening: 0, additions: 0, disposals: 0, depreciation: 0, closing: 0 },
    );
  }, [ppeRows]);

  const depRows: DepRow[] = useMemo(() => {
    const lines = note?.lines ?? [];
    return lines
      .map((l) => l.values as any)
      .filter(Boolean)
      .map((v) => ({
        categoryCode: String(v.categoryCode ?? ''),
        categoryName: String(v.categoryName ?? ''),
        cost: Number(v.cost ?? 0),
        depreciationForPeriod: Number(v.depreciationForPeriod ?? 0),
        accumulatedDepreciation: Number(v.accumulatedDepreciation ?? 0),
      }));
  }, [note]);

  const depTotals = useMemo(() => {
    return depRows.reduce(
      (s, r) => {
        s.cost += r.cost;
        s.depreciationForPeriod += r.depreciationForPeriod;
        s.accumulatedDepreciation += r.accumulatedDepreciation;
        return s;
      },
      { cost: 0, depreciationForPeriod: 0, accumulatedDepreciation: 0 },
    );
  }, [depRows]);

  const taxRows: TaxRow[] = useMemo(() => {
    const lines = note?.lines ?? [];
    return lines
      .map((l) => l.values as any)
      .filter(Boolean)
      .map((v) => ({
        taxType: String(v.taxType ?? ''),
        openingBalance: Number(v.openingBalance ?? 0),
        taxCharged: Number(v.taxCharged ?? 0),
        taxPaid: Number(v.taxPaid ?? 0),
        adjustments: Number(v.adjustments ?? 0),
        closingBalance: Number(v.closingBalance ?? 0),
      }))
      .filter((r) => r.taxType.length > 0);
  }, [note]);

  const taxTotals = useMemo(() => {
    return taxRows.reduce(
      (s, r) => {
        s.openingBalance += r.openingBalance;
        s.taxCharged += r.taxCharged;
        s.taxPaid += r.taxPaid;
        s.adjustments += r.adjustments;
        s.closingBalance += r.closingBalance;
        return s;
      },
      {
        openingBalance: 0,
        taxCharged: 0,
        taxPaid: 0,
        adjustments: 0,
        closingBalance: 0,
      },
    );
  }, [taxRows]);

  async function loadPeriods() {
    if (!canView) return;
    setLoadingPeriods(true);
    setError(null);
    try {
      const res = await listGlPeriods();
      setPeriods(res);
      if (!periodId) {
        const firstClosed = res.find((p) => p.status === 'CLOSED');
        if (firstClosed) setPeriodId(firstClosed.id);
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load periods'));
    } finally {
      setLoadingPeriods(false);
    }
  }

  async function loadIfrsIndex() {
    if (!canView) return;
    try {
      const res = await listIfrsNotes();
      setIfrsIndex(res);
      const hasSelected = res.some((x) => x.noteCode === ifrsNoteCode);
      if (!hasSelected && res.length > 0) {
        setIfrsNoteCode(res[0].noteCode);
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load IFRS note index'));
    }
  }

  useEffect(() => {
    void loadPeriods();
    void loadIfrsIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateSelected() {
    if (!canView || !canGenerate || !periodId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateDisclosureNote({ periodId, noteType: selectedNote });
      setNote(res);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to generate disclosure note'));
    } finally {
      setLoading(false);
    }
  }

  async function loadSelectedIfrs() {
    if (!canView || !periodId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getIfrsNote({ periodId, noteCode: ifrsNoteCode });
      setIfrsNote(res);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load IFRS disclosure note'));
    } finally {
      setLoading(false);
    }
  }

  async function exportSelectedIfrsPdf() {
    if (!canView || !canExport || !periodId) return;
    setLoading(true);
    setError(null);
    try {
      await downloadIfrsNotePdf({ periodId, noteCode: ifrsNoteCode });
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to export IFRS note'));
    } finally {
      setLoading(false);
    }
  }

  if (!canView) {
    return <div>You do not have permission to view disclosure notes (requires {PERMISSIONS.DISCLOSURE.VIEW}).</div>;
  }

  const errBody = (error as unknown as ApiError | any)?.body;
  const ifrsValidation =
    errBody && typeof errBody === 'object' && errBody.error === 'IFRS_VALIDATION_ERROR'
      ? (errBody as any)
      : null;
  const ifrsReconciliation =
    errBody && typeof errBody === 'object' && errBody.error === 'IFRS_RECONCILIATION_ERROR'
      ? (errBody as any)
      : null;

  const ifrsNoteOptions = useMemo(() => {
    return ifrsIndex
      .slice()
      .sort((a, b) => a.noteCode.localeCompare(b.noteCode))
      .map((n) => ({
        code: n.noteCode,
        label: `${n.noteCode}) ${n.title}`,
      }));
  }, [ifrsIndex]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Disclosure Notes</h2>
        <Link to="/reports">Back</Link>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'end' }}>
        <label>
          Mode
          <select
            value={mode}
            onChange={(e) => {
              const next = e.target.value as any;
              setMode(next);
              setError(null);
              setNote(null);
              setIfrsNote(null);
              setSelectedNote('PPE_MOVEMENT');
              setIfrsNoteCode('A');
            }}
          >
            <option value="IFRS">IFRS Notes (read-only)</option>
            <option value="LEGACY">Legacy Disclosure Generator</option>
          </select>
        </label>

        <label>
          Closed period
          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} disabled={loadingPeriods}>
            <option value="">Select…</option>
            {closedPeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({String(p.startDate).slice(0, 10)} – {String(p.endDate).slice(0, 10)})
              </option>
            ))}
          </select>
        </label>

        {mode === 'LEGACY' ? (
          <>
            <label>
              Note
              <select value={selectedNote} onChange={(e) => setSelectedNote(e.target.value as any)}>
                <option value="PPE_MOVEMENT">PPE Movement</option>
                <option value="DEPRECIATION">Depreciation</option>
                <option value="TAX_RECONCILIATION">Tax Reconciliation</option>
              </select>
            </label>

            <button onClick={generateSelected} disabled={!canGenerate || !periodId || loading}>
              {loading ? 'Generating…' : 'Generate'}
            </button>
          </>
        ) : (
          <>
            <label>
              IFRS note
              <select value={ifrsNoteCode} onChange={(e) => setIfrsNoteCode(e.target.value as IfrsDisclosureNoteCode)}>
                {ifrsNoteOptions.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <button onClick={loadSelectedIfrs} disabled={!periodId || loading}>
              {loading ? 'Loading…' : 'Load'}
            </button>

            <button onClick={exportSelectedIfrsPdf} disabled={!periodId || !canExport || loading || !ifrsNote}>
              Export PDF
            </button>
          </>
        )}

        <button onClick={loadPeriods} disabled={loadingPeriods}>
          {loadingPeriods ? 'Loading…' : 'Reload periods'}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #f3b2b2', background: '#fff0f0' }}>
          <div style={{ fontWeight: 700 }}>
            {ifrsValidation
              ? 'IFRS disclosures are not available'
              : ifrsReconciliation
                ? 'IFRS reconciliation failed'
                : 'Error'}
          </div>
          {ifrsValidation ? (
            <div style={{ marginTop: 8, lineHeight: 1.5 }}>
              <div>
                Complete Organisation Settings → Legal Name and Currency to enable IFRS disclosures.
              </div>
              <div style={{ marginTop: 8 }}>{String(ifrsValidation.message ?? 'IFRS validation error')}</div>
              {Array.isArray(ifrsValidation.missingFields) && ifrsValidation.missingFields.length > 0 ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Missing fields</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {ifrsValidation.missingFields.map((f: string) => (
                      <li key={f}>
                        <code>{f}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {ifrsValidation.guidance ? (
                <div style={{ marginTop: 8, color: 'rgba(11,12,30,0.75)' }}>{String(ifrsValidation.guidance)}</div>
              ) : null}
            </div>
          ) : ifrsReconciliation ? (
            <div style={{ marginTop: 8, lineHeight: 1.5 }}>
              <div>{String(ifrsReconciliation.message ?? 'IFRS reconciliation failed')}</div>
              {ifrsReconciliation.statement ? (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontWeight: 700 }}>Statement:</span> {String(ifrsReconciliation.statement)}
                </div>
              ) : null}
              {ifrsReconciliation.label ? (
                <div style={{ marginTop: 4, color: 'rgba(11,12,30,0.75)' }}>{String(ifrsReconciliation.label)}</div>
              ) : null}
            </div>
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap' }}>{typeof errBody === 'string' ? errBody : JSON.stringify(errBody ?? error, null, 2)}</pre>
          )}
        </div>
      ) : null}

        {mode === 'IFRS' && ifrsNote ? (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 8 }}>
              Note {ifrsNote.noteCode} – {ifrsNote.title}
            </h3>

            {ifrsNote.narrative ? (
              <div style={{ whiteSpace: 'pre-wrap', marginTop: 8, marginBottom: 16, lineHeight: 1.5 }}>
                {ifrsNote.narrative}
              </div>
            ) : null}

            {ifrsNote.tables.map((t, idx) => (
              <IfrsNoteTable key={`${t.title}-${idx}`} t={t} />
            ))}

            {Array.isArray(ifrsNote.footnotes) && ifrsNote.footnotes.length > 0 ? (
              <div style={{ marginTop: 16, color: 'rgba(11,12,30,0.75)', lineHeight: 1.5 }}>
                {ifrsNote.footnotes.map((f, i) => (
                  <div key={i}>{f}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

      {mode === 'LEGACY' && note?.noteType === 'TAX_RECONCILIATION' ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: 'rgba(11,12,30,0.65)' }}>
            Note generated at {String(note.generatedAt)}
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Tax Type</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Opening</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Charged</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Paid</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Adjustments</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Closing</th>
              </tr>
            </thead>
            <tbody>
              {taxRows.map((r) => (
                <tr key={r.taxType}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{r.taxType}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.openingBalance)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.taxCharged)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.taxPaid)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.adjustments)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.closingBalance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', fontWeight: 700 }}>Totals</td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(taxTotals.openingBalance)}</td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(taxTotals.taxCharged)}</td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(taxTotals.taxPaid)}</td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(taxTotals.adjustments)}</td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(taxTotals.closingBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}

      {mode === 'LEGACY' && note?.noteType === 'PPE_MOVEMENT' ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: 'rgba(11,12,30,0.65)' }}>
            Note generated at {String(note.generatedAt)}
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Category</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Opening</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Additions</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Disposals</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Depreciation</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Closing</th>
              </tr>
            </thead>
            <tbody>
              {ppeRows.map((r) => (
                <tr key={r.categoryCode}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    {r.categoryName} ({r.categoryCode})
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.opening)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.additions)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.disposals)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.depreciation)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.closing)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', fontWeight: 700 }}>Totals</td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(totals.opening)}</td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(totals.additions)}</td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(totals.disposals)}</td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(totals.depreciation)}</td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(totals.closing)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}

      {mode === 'LEGACY' && note?.noteType === 'DEPRECIATION' ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: 'rgba(11,12,30,0.65)' }}>
            Note generated at {String(note.generatedAt)}
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Category</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Cost</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Depreciation (Period)</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Accumulated Depreciation</th>
              </tr>
            </thead>
            <tbody>
              {depRows.map((r) => (
                <tr key={r.categoryCode}>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                    {r.categoryName} ({r.categoryCode})
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.cost)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.depreciationForPeriod)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: 'right' }}>{money(r.accumulatedDepreciation)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', fontWeight: 700 }}>Totals</td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(depTotals.cost)}</td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(depTotals.depreciationForPeriod)}</td>
                <td style={{ padding: 8, borderTop: '2px solid #ddd', textAlign: 'right', fontWeight: 700 }}>{money(depTotals.accumulatedDepreciation)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </div>
  );
}
