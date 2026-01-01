import { useEffect, useMemo, useRef, useState } from 'react';
import { tokens } from '../designTokens';
import { getApiErrorMessage } from '../services/api';
import { getLedger, listGlPeriods, type AccountingPeriod, type LedgerResponse } from '../services/gl';
import { Alert } from './Alert';
import { Button } from './Button';
import { DataTable } from './DataTable';

function money(n: number) {
  return Number(n).toFixed(2);
}

function fmtDate(iso: string) {
  // backend returns ISO date strings
  return (iso ?? '').slice(0, 10);
}

function looksLikeUuid(v: string) {
  // lightweight guard (not a validator)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v ?? '').trim());
}

function looksLikeIsoDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '').trim());
}

export type LedgerDrilldownDrawerProps = {
  open: boolean;
  onClose: () => void;
  account: { id: string; code: string; name: string } | null;
  range:
    | { mode: 'dates'; fromDate: string; toDate: string }
    | { mode: 'period'; accountingPeriodId: string }
    | null;
  canViewJournal: boolean;
  onViewJournal: (journalEntryId: string) => void;
  sourceReport?: 'TB' | 'PL' | 'BS' | 'LEDGER';
};

export function LedgerDrilldownDrawer(props: LedgerDrilldownDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [data, setData] = useState<LedgerResponse | null>(null);

  const [resolvedPeriodId, setResolvedPeriodId] = useState<string | null>(null);

  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);

  const skipNextFetchRef = useRef(false);

  const defaultLimit = 50;
  const minLimit = 1;
  const maxLimit = 100;
  const maxOffset = 5000;

  const rows = data?.rows ?? [];

  const accountIdProp = String(props.account?.id ?? '').trim();
  const rangeMode = props.range?.mode ?? null;
  const rangeFrom = rangeMode === 'dates' ? String((props.range as any)?.fromDate ?? '').trim() : '';
  const rangeTo = rangeMode === 'dates' ? String((props.range as any)?.toDate ?? '').trim() : '';
  const rangePeriodId = rangeMode === 'period' ? String((props.range as any)?.accountingPeriodId ?? '').trim() : '';

  const title = props.account ? `${props.account.code} — ${props.account.name}` : 'Ledger';

  const subtitle = useMemo(() => {
    if (!data) return '';
    return `${data.period.fromDate} → ${data.period.toDate}`;
  }, [data]);

  useEffect(() => {
    if (!props.open) return;
    // Reset state first; fetch is not eligible until the next render.
    skipNextFetchRef.current = true;
    setOffset(0);
    setLimit(defaultLimit);
    setResolvedPeriodId(null);
    setData(null);
    setError(null);
    setNotice(null);
  }, [props.open, accountIdProp, rangeMode, rangeFrom, rangeTo, rangePeriodId]);

  const validateLedgerLimit = (v: unknown) => {
    if (typeof v !== 'number') return null;
    if (!Number.isFinite(v)) return null;
    if (!Number.isInteger(v)) return null;
    if (v < minLimit || v > maxLimit) return null;
    return v;
  };

  const validateLedgerOffset = (v: unknown) => {
    if (typeof v !== 'number') return null;
    if (!Number.isFinite(v)) return null;
    if (!Number.isInteger(v)) return null;
    if (v < 0) return null;
    return v;
  };

  const safeLimit = useMemo(() => validateLedgerLimit(limit) ?? defaultLimit, [limit]);
  const safeOffset = useMemo(() => validateLedgerOffset(offset) ?? 0, [offset]);

  const paginationReady = useMemo(() => {
    return validateLedgerLimit(limit) !== null && validateLedgerOffset(offset) !== null;
  }, [limit, offset]);

  const findEligibleClosedPeriodForRange = (periods: AccountingPeriod[], fromDate: string, toDate: string) => {
    const from = String(fromDate ?? '').slice(0, 10);
    const to = String(toDate ?? '').slice(0, 10);
    if (!looksLikeIsoDate(from) || !looksLikeIsoDate(to)) return null;
    return (
      periods.find((p) => {
        if (p.status !== 'CLOSED') return false;
        const start = String(p.startDate ?? '').slice(0, 10);
        const end = String(p.endDate ?? '').slice(0, 10);
        return start && end && start <= from && to <= end;
      }) ?? null
    );
  };

  useEffect(() => {
    if (!props.open) return;
    if (!accountIdProp || !rangeMode) return;

    // Prevent any ledger request in the same commit as the reset effect.
    // This ensures state initialization (offset/limit) has settled.
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    const accountId = accountIdProp;
    if (!looksLikeUuid(accountId)) {
      setError('Invalid accountId for ledger drill-down (expected UUID).');
      return;
    }

    const sourceReport = props.sourceReport ?? 'LEDGER';

    const run = async () => {
      setLoading(true);
      setError(null);
      setNotice(null);

      try {
        // Always anchor ledger drill-down to an eligible accounting period.
        // If the caller already provided a period id, use it.
        let periodId = rangeMode === 'period' ? rangePeriodId : resolvedPeriodId;

        if (!periodId && rangeMode === 'dates') {
          const from = rangeFrom;
          const to = rangeTo;
          if (!from || !to) return;
          if (!looksLikeIsoDate(from) || !looksLikeIsoDate(to)) return;

          const periods = await listGlPeriods();
          const p = findEligibleClosedPeriodForRange(periods, from, to);
          if (!p) {
            setNotice(
              'Ledger drill-down requires a fully CLOSED accounting period. Adjust your date range or close the period in Periods → Month-End Close.',
            );
            return;
          }
          periodId = p.id;
          setResolvedPeriodId(p.id);
        }

        if (!periodId || !looksLikeUuid(periodId)) {
          setNotice(
            'Ledger drill-down requires a fully CLOSED accounting period. Adjust your date range or close the period in Periods → Month-End Close.',
          );
          return;
        }

        if (!paginationReady) {
          // Do not fire until pagination state is guaranteed valid.
          return;
        }

        const boundedOffset = Math.min(safeOffset, maxOffset);

        const request = {
          accountId,
          accountingPeriodId: periodId,
          limit: safeLimit,
          offset: boundedOffset,
          sourceReport,
        };

        const r = await getLedger(request);
        setData(r);
      } catch (e: any) {
        setError(getApiErrorMessage(e, 'Failed to load ledger'));
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [
    offset,
    limit,
    safeLimit,
    safeOffset,
    paginationReady,
    props.open,
    accountIdProp,
    rangeMode,
    rangeFrom,
    rangeTo,
    rangePeriodId,
    resolvedPeriodId,
    props.sourceReport,
  ]);

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 720 : false;

  const canPrev = offset > 0;
  const canNext = Boolean(data?.hasMore) && offset + limit <= maxOffset;

  const safeSetOffset = (next: number) => {
    if (!Number.isFinite(next)) {
      setOffset(0);
      return;
    }
    setOffset(Math.min(maxOffset, Math.max(0, Math.trunc(next))));
  };

  const groupedRows = useMemo(() => {
    const out: Array<
      | { kind: 'group'; journalEntryId: string; journalNumber: number | null; journalDate: string }
      | { kind: 'row'; row: LedgerResponse['rows'][number] }
    > = [];

    let lastJournalEntryId: string | null = null;
    for (const r of rows) {
      if (r.journalEntryId !== lastJournalEntryId) {
        out.push({ kind: 'group', journalEntryId: r.journalEntryId, journalNumber: r.journalNumber, journalDate: r.journalDate });
        lastJournalEntryId = r.journalEntryId;
      }
      out.push({ kind: 'row', row: r });
    }
    return out;
  }, [rows]);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(11,12,30,0.44)',
          opacity: props.open ? 1 : 0,
          pointerEvents: props.open ? 'auto' : 'none',
          transition: `opacity ${tokens.transition.normal}`,
          zIndex: 60,
        }}
        onClick={props.onClose}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: isMobile ? '100vw' : 720,
          maxWidth: '100vw',
          background: tokens.colors.white,
          borderLeft: `1px solid ${tokens.colors.border.subtle}`,
          boxShadow: '0 10px 50px rgba(11,12,30,0.22)',
          transform: props.open ? 'translateX(0)' : 'translateX(110%)',
          transition: `transform ${tokens.transition.normal}`,
          zIndex: 61,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ overflow: 'auto', flex: 1 }}>
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              padding: tokens.spacing.x3,
              borderBottom: `1px solid ${tokens.colors.border.subtle}`,
              background: tokens.colors.white,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 850, fontSize: 16, color: tokens.colors.text.primary }}>{title}</div>
                {subtitle ? <div style={{ marginTop: 6, fontSize: 12, color: tokens.colors.text.secondary }}>{subtitle}</div> : null}
              </div>
              <Button variant="ghost" onClick={props.onClose}>
                Close
              </Button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>
                Opening balance: {data ? money(data.openingBalance) : '—'}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={loading || !canPrev}
                  onClick={() => safeSetOffset(offset - limit)}
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={loading || !canNext}
                  onClick={() => safeSetOffset(offset + limit)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>

          <div style={{ padding: tokens.spacing.x3 }}>
            {loading ? <div style={{ color: tokens.colors.text.secondary }}>Loading ledger...</div> : null}

            {error ? (
              <Alert tone="error" title="Ledger load failed" style={{ marginTop: 12 }}>
                {error}
              </Alert>
            ) : null}

            {!error && notice ? (
              <Alert tone="info" title="Ledger drill-down" style={{ marginTop: 12 }}>
                {notice}
              </Alert>
            ) : null}

            {!loading && !error && !notice && data && rows.length === 0 ? (
              <Alert tone="info" title="No ledger entries available." style={{ marginTop: 12 }}>
                This account has no POSTED transactions in the selected CLOSED accounting period.
              </Alert>
            ) : null}

            {!loading && !error && data && rows.length > 0 ? (
              <DataTable>
                <DataTable.Head sticky>
                  <tr>
                    <DataTable.Th>Date</DataTable.Th>
                    <DataTable.Th align="right">Journal No</DataTable.Th>
                    <DataTable.Th>Description</DataTable.Th>
                    <DataTable.Th align="right">Debit</DataTable.Th>
                    <DataTable.Th align="right">Credit</DataTable.Th>
                    <DataTable.Th align="right">Balance</DataTable.Th>
                    <DataTable.Th align="right" style={{ width: 120 }}>Actions</DataTable.Th>
                  </tr>
                </DataTable.Head>
                <DataTable.Body>
                  {groupedRows.map((it, idx) => {
                    if (it.kind === 'group') {
                      return (
                        <tr key={`g:${it.journalEntryId}`}>
                          <td
                            colSpan={7}
                            style={{
                              padding: '10px 12px',
                              background: 'rgba(11,12,30,0.02)',
                              borderBottom: `1px solid ${tokens.colors.border.subtle}`,
                              fontSize: 12,
                              color: tokens.colors.text.secondary,
                              fontWeight: 650,
                            }}
                          >
                            {fmtDate(it.journalDate)} · Journal {it.journalNumber ?? ''}
                          </td>
                        </tr>
                      );
                    }

                    const r = it.row;
                    const label = [r.reference, r.description].filter(Boolean).join(' — ');
                    return (
                      <DataTable.Row key={`${r.journalEntryId}:${idx}`} zebra index={idx}>
                        <DataTable.Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.journalDate)}</DataTable.Td>
                        <DataTable.Td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {r.journalNumber ?? ''}
                        </DataTable.Td>
                        <DataTable.Td>{label}</DataTable.Td>
                        <DataTable.Td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {money(r.debit)}
                        </DataTable.Td>
                        <DataTable.Td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {money(r.credit)}
                        </DataTable.Td>
                        <DataTable.Td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {money(r.runningBalance)}
                        </DataTable.Td>
                        <DataTable.Td align="right">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!props.canViewJournal}
                            title={props.canViewJournal ? 'View Journal' : 'Access denied'}
                            onClick={() => props.onViewJournal(r.journalEntryId)}
                          >
                            View Journal
                          </Button>
                        </DataTable.Td>
                      </DataTable.Row>
                    );
                  })}
                </DataTable.Body>
              </DataTable>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
