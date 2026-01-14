import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { PERMISSIONS } from '../auth/permission-catalog';
import type { ApiError } from '../services/api';
import { getOpeningBalances, listGlAccounts, postOpeningBalances, upsertOpeningBalances } from '../services/gl';
import { Card } from '../components/Card';
import { DataTable } from '../components/DataTable';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

const DEFAULT_CUTOVER_DATE = '2026-01-01';

type UiLine = { accountId: string; debit: string; credit: string };

export function OpeningBalancesPage() {
  const { hasPermission } = useAuth();

  const COLORS = {
    navy: '#0B0C1E',
    gold: '#EDBA35',
    white: '#FCFCFC',
  };

  const canView = hasPermission(PERMISSIONS.GL.VIEW);
  const canCreate = hasPermission(PERMISSIONS.GL.CREATE);
  const canPost = hasPermission(PERMISSIONS.GL.FINAL_POST);

  const [cutoverDate, setCutoverDate] = useState(DEFAULT_CUTOVER_DATE);
  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; name: string; type: string; isActive: boolean }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<any>(null);
  const [data, setData] = useState<any>(null);

  const [lines, setLines] = useState<UiLine[]>([
    { accountId: '', debit: '', credit: '' },
    { accountId: '', debit: '', credit: '' },
  ]);

  const isLocked = Boolean(data?.cutoverLocked) || data?.openingPeriod?.status === 'CLOSED' || data?.journal?.status === 'POSTED';

  const totalDebit = useMemo(() => {
    return lines.reduce((s, l) => s + (Number(l.debit || 0) || 0), 0);
  }, [lines]);

  const totalCredit = useMemo(() => {
    return lines.reduce((s, l) => s + (Number(l.credit || 0) || 0), 0);
  }, [lines]);

  async function load() {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const [a, ob] = await Promise.all([listGlAccounts(), getOpeningBalances(cutoverDate)]);
      setAccounts(a);
      setData(ob);

      if (ob?.journal?.lines?.length) {
        setLines(
          ob.journal.lines.map((l: any) => ({
            accountId: l.accountId,
            debit: String(l.debit ?? ''),
            credit: String(l.credit ?? ''),
          })),
        );
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canView) {
    return <div>You do not have permission to view opening balances.</div>;
  }

  async function onSave() {
    if (!canCreate || isLocked) return;
    setSaving(true);
    setError(null);
    try {
      const payloadLines = lines
        .filter((l) => l.accountId)
        .map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit || 0) || 0,
          credit: Number(l.credit || 0) || 0,
        }));

      await upsertOpeningBalances({ cutoverDate, lines: payloadLines });
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

  async function onPost() {
    if (!canPost || isLocked) return;
    setPosting(true);
    setError(null);
    try {
      await postOpeningBalances(cutoverDate);
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setPosting(false);
    }
  }

  function setLine(idx: number, patch: Partial<UiLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { accountId: '', debit: '', credit: '' }]);
  }

  const errBody = (error as ApiError | any)?.body;

  return (
    <div>
      <h2>Opening Balances</h2>

      <div style={{ marginTop: 12 }}>
        <Alert tone="warning" title="Posting is irreversible">
          Posting opening balances cannot be undone. After posting:
          <div style={{ marginTop: 6 }}>
            - The Opening Balances period will be closed automatically
          </div>
          <div>- Posting dated before cutover will be blocked</div>
        </Alert>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: '#666' }}>Cutover date</div>
          <div style={{ marginTop: 6, width: 220 }}>
            <Input
              type="date"
              value={cutoverDate}
              disabled={loading || saving || posting || isLocked}
              onChange={(e) => setCutoverDate(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={load} disabled={loading} variant="secondary">
          {loading ? 'Loading…' : 'Reload'}
        </Button>

        <div style={{ fontSize: 12, color: '#666' }}>
          Status: <b>{data?.journal?.status ?? 'NO JOURNAL'}</b> / Period:{' '}
          <b>{data?.openingPeriod?.status ?? 'NOT CREATED'}</b>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="error" title="Unable to load or save opening balances">
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(errBody ?? error, null, 2)}</pre>
          </Alert>
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <Card
          title="Journal lines"
          subtitle={isLocked ? 'This set is locked.' : 'Add accounts and balances. Debit / Credit are right-aligned.'}
          actions={!isLocked ? <Button onClick={addLine} variant="secondary" size="sm">Add line</Button> : null}
        >
          <DataTable>
            <DataTable.Head sticky>
              <tr>
                <DataTable.Th>Account</DataTable.Th>
                <DataTable.Th align="right">Debit</DataTable.Th>
                <DataTable.Th align="right">Credit</DataTable.Th>
              </tr>
            </DataTable.Head>

            <DataTable.Body>
              {!lines.length ? (
                <DataTable.Empty
                  colSpan={3}
                  title="No journal lines yet"
                  action={!isLocked ? <Button onClick={addLine} variant="primary">Add your first line</Button> : null}
                />
              ) : null}

              {lines.map((l, idx) => (
                <DataTable.Row key={idx} zebra index={idx}>
                  <DataTable.Td>
                    <select
                      value={l.accountId}
                      disabled={isLocked}
                      onChange={(e) => setLine(idx, { accountId: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(11,12,30,0.14)', background: COLORS.white }}
                    >
                      <option value="">Select account…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  </DataTable.Td>
                  <DataTable.Td align="right">
                    <div style={{ width: 160, marginLeft: 'auto' }}>
                      <Input
                        type="number"
                        step="0.01"
                        value={l.debit}
                        disabled={isLocked}
                        onChange={(e) => setLine(idx, { debit: e.target.value })}
                        style={{ textAlign: 'right' }}
                      />
                    </div>
                  </DataTable.Td>
                  <DataTable.Td align="right">
                    <div style={{ width: 160, marginLeft: 'auto' }}>
                      <Input
                        type="number"
                        step="0.01"
                        value={l.credit}
                        disabled={isLocked}
                        onChange={(e) => setLine(idx, { credit: e.target.value })}
                        style={{ textAlign: 'right' }}
                      />
                    </div>
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>

            <DataTable.Foot>
              <tr>
                <DataTable.Td align="right" style={{ fontWeight: 800, background: 'rgba(237,186,53,0.06)', borderBottom: '1px solid rgba(11,12,30,0.10)' }}>
                  Totals
                </DataTable.Td>
                <DataTable.Td align="right" style={{ fontWeight: 800, background: 'rgba(237,186,53,0.06)', borderBottom: '1px solid rgba(11,12,30,0.10)' }}>
                  {totalDebit.toFixed(2)}
                </DataTable.Td>
                <DataTable.Td align="right" style={{ fontWeight: 800, background: 'rgba(237,186,53,0.06)', borderBottom: '1px solid rgba(11,12,30,0.10)' }}>
                  {totalCredit.toFixed(2)}
                </DataTable.Td>
              </tr>
            </DataTable.Foot>
          </DataTable>
        </Card>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <Button onClick={onSave} disabled={!canCreate || isLocked || saving} variant="primary">
          {saving ? 'Saving…' : 'Save Draft'}
        </Button>
        <Button onClick={onPost} disabled={!canPost || isLocked || posting} variant="secondary">
          {posting ? 'Posting…' : 'Post (irreversible)'}
        </Button>
      </div>

      {isLocked ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="info" title="Locked">
            This opening balances set is locked (journal posted and/or period closed).
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
