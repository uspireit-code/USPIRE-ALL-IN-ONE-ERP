import { useEffect, useMemo, useState } from 'react';
import { tokens } from '../designTokens';
import { getApiErrorMessage } from '../services/api';
import { getJournalDetail, type JournalDetailResponse } from '../services/gl';
import { Alert } from './Alert';
import { Button } from './Button';
import { DataTable } from './DataTable';

function money(n: number) {
  return Number(n).toFixed(2);
}

export function JournalDetailModal(props: {
  open: boolean;
  journalId: string | null;
  onBack: () => void;
  drilledFromAccountId?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<JournalDetailResponse | null>(null);

  useEffect(() => {
    if (!props.open) return;
    if (!props.journalId) return;

    setLoading(true);
    setError(null);
    setData(null);

    getJournalDetail(props.journalId)
      .then((r) => setData(r))
      .catch((e) => {
        const msg = getApiErrorMessage(e, 'Failed to load journal detail');
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [props.journalId, props.open]);

  const totals = useMemo(() => {
    const lines = data?.lines ?? [];
    const debit = lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
    const credit = lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
    return { debit, credit };
  }, [data]);

  const formatDimension = (d: null | { code: string; name: string } | undefined) => {
    if (!d) return '—';
    return `${d.code} — ${d.name}`;
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(11,12,30,0.52)',
          opacity: props.open ? 1 : 0,
          pointerEvents: props.open ? 'auto' : 'none',
          transition: `opacity ${tokens.transition.normal}`,
          zIndex: 70,
        }}
        onClick={props.onBack}
      />

      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '5vh',
          left: '50%',
          transform: props.open ? 'translate(-50%, 0)' : 'translate(-50%, 10px)',
          width: 'min(980px, calc(100vw - 32px))',
          maxHeight: '90vh',
          overflow: 'hidden',
          background: tokens.colors.white,
          borderRadius: tokens.radius.lg,
          border: `1px solid ${tokens.colors.border.subtle}`,
          boxShadow: '0 18px 80px rgba(11,12,30,0.28)',
          opacity: props.open ? 1 : 0,
          pointerEvents: props.open ? 'auto' : 'none',
          transition: `opacity ${tokens.transition.normal}, transform ${tokens.transition.normal}`,
          zIndex: 71,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: tokens.spacing.x3, borderBottom: `1px solid ${tokens.colors.border.subtle}`, background: 'linear-gradient(180deg, rgba(11,12,30,0.03), rgba(11,12,30,0))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 850, fontSize: 16, color: tokens.colors.text.primary }}>Journal Entry</div>
              <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.secondary, lineHeight: '18px' }}>
                {data ? (
                  <>
                    <span style={{ fontWeight: 650 }}>Journal No:</span> {data.journalNumber ?? '—'}
                    {'  '}|{'  '}
                    <span style={{ fontWeight: 650 }}>Status:</span> {data.status}
                    {'  '}|{'  '}
                    <span style={{ fontWeight: 650 }}>Type:</span> {data.journalType}
                    {'  '}|{'  '}
                    <span style={{ fontWeight: 650 }}>Date:</span> {String(data.journalDate).slice(0, 10)}
                  </>
                ) : (
                  'Journal detail'
                )}
              </div>
            </div>
            <Button variant="ghost" onClick={props.onBack}>
              Back
            </Button>
          </div>
        </div>

        <div style={{ padding: tokens.spacing.x3, overflow: 'auto' }}>
          {loading ? <div style={{ color: tokens.colors.text.secondary }}>Loading journal...</div> : null}

          {error ? (
            <Alert tone={error.toLowerCase().includes('403') ? 'warning' : 'error'} title={error.toLowerCase().includes('403') ? 'Access denied' : 'Journal load failed'}>
              {error}
            </Alert>
          ) : null}

          {!loading && !error && data ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>Accounting Period</div>
                  <div style={{ fontWeight: 650, marginTop: 4 }}>
                    {data.period ? `${data.period.name} (${data.period.status})` : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>Reference</div>
                  <div style={{ fontWeight: 650, marginTop: 4 }}>{data.reference ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>Description</div>
                  <div style={{ fontWeight: 650, marginTop: 4 }}>{data.description ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>Posted By</div>
                  <div style={{ fontWeight: 650, marginTop: 4 }}>{data.postedBy?.email ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>Created By</div>
                  <div style={{ fontWeight: 650, marginTop: 4 }}>{data.createdBy?.email ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>Reviewed / Approved</div>
                  <div style={{ fontWeight: 650, marginTop: 4 }}>
                    {(data.reviewedBy?.email ?? '—') + ' / ' + (data.approvedBy?.email ?? '—')}
                  </div>
                </div>
              </div>

              <DataTable>
                <DataTable.Head sticky>
                  <tr>
                    <DataTable.Th align="right" style={{ width: 80 }}>
                      Line #
                    </DataTable.Th>
                    <DataTable.Th>Account</DataTable.Th>
                    <DataTable.Th>Legal Entity</DataTable.Th>
                    <DataTable.Th>Department</DataTable.Th>
                    <DataTable.Th>Project</DataTable.Th>
                    <DataTable.Th>Fund</DataTable.Th>
                    <DataTable.Th>Description</DataTable.Th>
                    <DataTable.Th align="right">Debit</DataTable.Th>
                    <DataTable.Th align="right">Credit</DataTable.Th>
                  </tr>
                </DataTable.Head>
                <DataTable.Body>
                  {data.lines.map((l, idx) => {
                    const isDrilledLine = Boolean(props.drilledFromAccountId && l.accountId === props.drilledFromAccountId);
                    return (
                    <DataTable.Row
                      key={l.id}
                      zebra
                      index={idx}
                      style={
                        isDrilledLine
                          ? {
                              outline: `2px solid rgba(237,186,53,0.55)`,
                              outlineOffset: -2,
                              background: 'rgba(237,186,53,0.10)',
                            }
                          : undefined
                      }
                    >
                      <DataTable.Td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {l.lineNumber ?? ''}
                      </DataTable.Td>
                      <DataTable.Td>
                        {l.account.code} — {l.account.name}
                      </DataTable.Td>
                      <DataTable.Td>
                        {formatDimension(l.legalEntity)}
                      </DataTable.Td>
                      <DataTable.Td>
                        {formatDimension(l.department)}
                      </DataTable.Td>
                      <DataTable.Td>
                        {formatDimension((l as any).project)}
                      </DataTable.Td>
                      <DataTable.Td>
                        {formatDimension((l as any).fund)}
                      </DataTable.Td>
                      <DataTable.Td>{l.description ?? ''}</DataTable.Td>
                      <DataTable.Td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {money(l.debit)}
                      </DataTable.Td>
                      <DataTable.Td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {money(l.credit)}
                      </DataTable.Td>
                    </DataTable.Row>
                    );
                  })}
                </DataTable.Body>
                <DataTable.Foot>
                  <tr>
                    <DataTable.Td>{''}</DataTable.Td>
                    <DataTable.Td style={{ fontWeight: 750 }}>Totals</DataTable.Td>
                    <DataTable.Td>{''}</DataTable.Td>
                    <DataTable.Td align="right" style={{ fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>
                      {money(totals.debit)}
                    </DataTable.Td>
                    <DataTable.Td align="right" style={{ fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>
                      {money(totals.credit)}
                    </DataTable.Td>
                  </tr>
                </DataTable.Foot>
              </DataTable>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
