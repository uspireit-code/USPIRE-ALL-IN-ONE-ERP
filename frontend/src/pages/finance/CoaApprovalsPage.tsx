import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permission-catalog';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { tokens } from '../../designTokens';
import { getApiErrorMessage } from '../../services/api';
import {
  approveCoaRequest,
  bulkApproveCoaRequests,
  bulkRejectCoaRequests,
  listOfficialCoa,
  listCoaApprovalQueue,
  listCoaImportBatchAccounts,
  listIfrsNodeReference,
  rejectCoaRequest,
  type CoaImportBatch,
  type CoaImportBatchAccount,
  type IfrsNodeReferenceOption,
  type CoaApprovalQueueItem,
} from '../../services/coa';

import './CoaSubmissionsPage.css';
import './CoaApprovalsPage.css';

function formatDateTime(v: any) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function resolveRequestTypeLabel(v: any) {
  const s = String(v ?? '').trim().toUpperCase();
  if (!s) return '—';
  if (s === 'CREATE_ACCOUNT') return 'CREATE_ACCOUNT';
  if (s === 'UPDATE_ACCOUNT') return 'UPDATE_ACCOUNT';
  if (s === 'STATUS_CHANGE') return 'STATUS_CHANGE';
  return s;
}

export function CoaApprovalsPage() {
  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;

  const canApprove = hasPermission(PERMISSIONS.COA.APPROVE);
  const canReject = hasPermission(PERMISSIONS.COA.REJECT);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [items, setItems] = useState<CoaApprovalQueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<string[]>([]);

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<null | { success: string[]; failed: Array<{ id: string; message: string }> }>(null);
  const [bulkFailureById, setBulkFailureById] = useState<Record<string, string>>({});

  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');

  const [activeAccountsById, setActiveAccountsById] = useState<Record<string, { code: string; name: string }>>({});

  const [ifrsById, setIfrsById] = useState<Record<string, IfrsNodeReferenceOption>>({});

  const [batchLoading, setBatchLoading] = useState(false);
  const [batch, setBatch] = useState<CoaImportBatch | null>(null);
  const [batchAccounts, setBatchAccounts] = useState<CoaImportBatchAccount[]>([]);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const pendingAccountRequests = useMemo(() => {
    return (items ?? []).filter((r) => {
      const rt = String((r as any)?.requestType ?? '').toUpperCase();
      const et = String((r as any)?.entityType ?? '').toUpperCase();
      if (!rt || !et) return false;
      if (rt === 'IMPORT_BATCH') return false;
      if (et !== 'ACCOUNT') return false;
      return true;
    });
  }, [items]);

  const groupFailures = (failed: Array<{ id: string; message: string }>) => {
    const map: Record<string, number> = {};
    for (const f of failed ?? []) {
      const msg = String(f?.message ?? '').trim() || 'Unknown error';
      map[msg] = (map[msg] ?? 0) + 1;
    }
    return map;
  };

  const requestPreviewForRow = (r: CoaApprovalQueueItem) => {
    if ((r as any)?.account) return (r as any).account;
    const before = (r.payloadJson as any)?.before ?? null;
    const after = (r.payloadJson as any)?.after ?? null;
    return after ?? before ?? null;
  };

  const requestIssuesForRow = (r: CoaApprovalQueueItem) => {
    const preview = requestPreviewForRow(r);
    if (!preview) return [] as string[];
    const issues: string[] = [];

    const code = String(preview?.code ?? '').trim();
    const name = String(preview?.name ?? '').trim();
    const type = String(preview?.accountType ?? preview?.type ?? '').trim();
    const parentAccountId = String(preview?.parentAccountId ?? '').trim();
    const fs1 = String(preview?.fsMappingLevel1 ?? '').trim();
    const isPosting = Boolean(preview?.isPosting);
    const ifrsNodeId = String(preview?.ifrsNodeId ?? preview?.ifrsCode ?? '').trim();

    if (!code) issues.push('Missing account code');
    if (!name) issues.push('Missing account name');
    if (!type) issues.push('Missing account type');
    if (!parentAccountId) issues.push('Missing parent account');
    if (!fs1) issues.push('Missing FS Mapping Level 1');
    if (isPosting && !ifrsNodeId) issues.push('Missing IFRS mapping for posting account');

    return issues;
  };

  const realUserId = state.me?.delegation?.realUserId ?? state.me?.user?.id ?? '';
  const selectedRequestedById = String((selected as any)?.requestedBy?.id ?? (selected as any)?.requestedById ?? '');
  const isSelfApprovalAttempt = Boolean(realUserId) && Boolean(selectedRequestedById) && String(realUserId) === String(selectedRequestedById);

  const [approveBusy, setApproveBusy] = useState(false);
  const [comment, setComment] = useState('');

  const [approveConfirmingId, setApproveConfirmingId] = useState<string | null>(null);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  const bulkActionDisabled = loading || approveBusy || rejectBusy || bulkBusy;

  async function refresh() {
    if (!canApprove) return;
    try {
      setLoading(true);
      setError(null);
      const [res, official, ifrs] = await Promise.all([
        listCoaApprovalQueue(),
        listOfficialCoa(),
        listIfrsNodeReference().catch(() => [] as IfrsNodeReferenceOption[]),
      ]);

      setItems(Array.isArray(res?.requests) ? res.requests : []);

      const dict: Record<string, { code: string; name: string }> = {};
      for (const a of official?.accounts ?? []) {
        dict[String(a.id)] = { code: String(a.code ?? ''), name: String(a.name ?? '') };
      }
      setActiveAccountsById(dict);

      const ifrsDict: Record<string, IfrsNodeReferenceOption> = {};
      for (const o of Array.isArray(ifrs) ? ifrs : []) {
        if (o && (o as any).id) ifrsDict[String((o as any).id)] = o;
      }
      setIfrsById(ifrsDict);

      setSelectedId((prev) => {
        if (!prev) return res?.requests?.[0]?.id ?? null;
        return res?.requests?.some((r) => r.id === prev) ? prev : (res?.requests?.[0]?.id ?? null);
      });

      setSelectedApprovalIds((prev) => {
        if (!prev || prev.length === 0) return prev;
        const allowed = new Set((res?.requests ?? []).map((x: any) => String(x?.id ?? '')));
        return prev.filter((id) => allowed.has(String(id)));
      });
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to load COA approvals queue'));
      setItems([]);
      setSelectedId(null);
      setSelectedApprovalIds([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkApprove() {
    if (!canApprove) return;
    if (bulkBusy) return;
    if (!selectedApprovalIds || selectedApprovalIds.length === 0) return;

    setBulkBusy(true);
    setError(null);
    setValidationMessages([]);
    setBulkResult(null);

    try {
      const res = await bulkApproveCoaRequests(selectedApprovalIds, { comment: comment.trim() || undefined });
      setBulkResult(res);

      const byId: Record<string, string> = {};
      for (const f of res.failed ?? []) {
        byId[String(f.id)] = String(f.message ?? 'Approval failed');
      }
      setBulkFailureById(byId);

      const okCount = (res.success ?? []).length;
      const failCount = (res.failed ?? []).length;
      setToast(`${okCount} approved${failCount ? `, ${failCount} failed` : ''}`);
      window.setTimeout(() => setToast(null), 3000);

      setItems((prev) => prev.filter((x) => !(res.success ?? []).includes(String(x.id))));
      setSelectedApprovalIds((prev) => prev.filter((id) => !(res.success ?? []).includes(String(id))));

      const grouped = groupFailures(res.failed ?? []);
      const msg = Object.entries(grouped)
        .map(([m, count]) => `${count} → ${m}`)
        .join('\n');
      if (msg) setError(msg);

      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Bulk approve failed'));
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkReject() {
    if (!canReject) return;
    if (bulkBusy) return;
    if (!selectedApprovalIds || selectedApprovalIds.length === 0) return;
    const reason = bulkRejectReason.trim();
    if (!reason) {
      setError('Rejection reason is required.');
      return;
    }

    setBulkBusy(true);
    setError(null);
    setValidationMessages([]);
    setBulkResult(null);

    try {
      const res = await bulkRejectCoaRequests(selectedApprovalIds, { rejectionReason: reason });
      setBulkResult(res);

      const byId: Record<string, string> = {};
      for (const f of res.failed ?? []) {
        byId[String(f.id)] = String(f.message ?? 'Rejection failed');
      }
      setBulkFailureById(byId);

      const okCount = (res.success ?? []).length;
      const failCount = (res.failed ?? []).length;
      setToast(`${okCount} rejected${failCount ? `, ${failCount} failed` : ''}`);
      window.setTimeout(() => setToast(null), 3000);

      setItems((prev) => prev.filter((x) => !(res.success ?? []).includes(String(x.id))));
      setSelectedApprovalIds((prev) => prev.filter((id) => !(res.success ?? []).includes(String(id))));

      const grouped = groupFailures(res.failed ?? []);
      const msg = Object.entries(grouped)
        .map(([m, count]) => `${count} → ${m}`)
        .join('\n');
      if (msg) setError(msg);

      setBulkRejecting(false);
      setBulkRejectReason('');
      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Bulk reject failed'));
    } finally {
      setBulkBusy(false);
    }
  }

  async function onConfirmApprove() {
    if (!selected) return;
    if (isSelfApprovalAttempt) return;
    setApproveBusy(true);
    setError(null);
    setValidationMessages([]);
    try {
      await approveCoaRequest(selected.id, { comment: comment.trim() || undefined });
      setItems((prev) => prev.filter((x) => x.id !== selected.id));
      setToast('Request approved');
      window.setTimeout(() => setToast(null), 2500);
      setComment('');
      setApproveConfirmingId(null);
      setBatch(null);
      setBatchAccounts([]);
      setSelectedId((prev) => {
        if (!prev) return null;
        const remaining = items.filter((x) => x.id !== selected.id);
        return remaining[0]?.id ?? null;
      });
      await refresh();
    } catch (e: any) {
      const body = (e as any)?.body;
      const missing = Array.isArray(body?.missingFields) ? (body.missingFields as Array<{ field: string; message: string }>) : [];
      if (missing.length > 0) {
        setValidationMessages(missing.map((m) => m.message).filter(Boolean));
        setError(body?.message || 'Account is not ready for approval.');
      } else if (Array.isArray(body?.issues) && body.issues.length > 0) {
        const msgs = (body.issues as any[])
          .map((i) => String(i?.message ?? '').trim())
          .filter(Boolean);
        setValidationMessages(msgs);
        setError(String(body?.message ?? 'Approval blocked due to COA naming conflicts.'));
      } else {
        setError(getApiErrorMessage(e, 'Failed to approve request'));
      }
    } finally {
      setApproveBusy(false);
    }
  }

  async function onConfirmReject() {
    if (!canReject) return;
    if (!rejectingId) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError('Rejection reason is required.');
      return;
    }
    setRejectBusy(true);
    setError(null);
    try {
      await rejectCoaRequest(rejectingId, { rejectionReason: reason });
      setItems((prev) => prev.filter((x) => x.id !== rejectingId));
      setToast('Request rejected');
      window.setTimeout(() => setToast(null), 2500);
      setRejectingId(null);
      setRejectReason('');
      setSelectedId((prev) => {
        if (!prev) return null;
        const remaining = items.filter((x) => x.id !== rejectingId);
        return remaining[0]?.id ?? null;
      });
      await refresh();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to reject request'));
    } finally {
      setRejectBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canApprove]);

  useEffect(() => {
    if (!selected) return;
    // eslint-disable-next-line no-console
    console.log('APPROVAL DATA:', selected);
    // eslint-disable-next-line no-console
    console.log('ACCOUNT OBJECT:', (selected as any)?.account);
  }, [selected?.id]);

  useEffect(() => {
    let cancelled = false;
    const isBatch =
      String((selected as any)?.requestType ?? '').toUpperCase() === 'IMPORT_BATCH' &&
      String((selected as any)?.entityType ?? '').toUpperCase() === 'CHART_OF_ACCOUNTS';

    if (!isBatch || !selected) {
      setBatch(null);
      setBatchAccounts([]);
      return;
    }

    const bid = String((selected as any)?.entityId ?? (selected as any)?.payloadJson?.batchId ?? '').trim();
    if (!bid) {
      setBatch(null);
      setBatchAccounts([]);
      return;
    }

    (async () => {
      setBatchLoading(true);
      try {
        const res = await listCoaImportBatchAccounts(bid);
        if (cancelled) return;
        setBatch((res as any)?.batch ?? null);
        setBatchAccounts(Array.isArray((res as any)?.accounts) ? ((res as any).accounts as any) : []);
      } catch {
        if (cancelled) return;
        setBatch(null);
        setBatchAccounts([]);
      } finally {
        if (cancelled) return;
        setBatchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  if (authLoading) {
    return <div style={{ marginTop: 12, color: tokens.colors.text.muted }}>Loading…</div>;
  }

  if (!canApprove) {
    return (
      <div>
        <h2>COA Approvals</h2>
        <div style={{ marginTop: 14 }}>
          <Alert tone="error" title="Access Denied">
            You do not have permission to access COA approvals.
          </Alert>
        </div>
      </div>
    );
  }

  const isImportBatchRequest =
    String((selected as any)?.requestType ?? '').toUpperCase() === 'IMPORT_BATCH' &&
    String((selected as any)?.entityType ?? '').toUpperCase() === 'CHART_OF_ACCOUNTS';

  const selectedBatchId = isImportBatchRequest
    ? String((selected as any)?.entityId ?? (selected as any)?.payloadJson?.batchId ?? '').trim()
    : '';

  const account = (selected as any)?.account ?? {};
  const payload = (selected as any)?.payloadJson ?? {};
  const payloadData = (payload as any)?.after ?? (payload as any)?.before ?? payload;

  const data = {
    code: (account as any)?.code ?? (payloadData as any)?.code ?? '',
    name: (account as any)?.name ?? (payloadData as any)?.name ?? '',

    accountType:
      (account as any)?.accountType ??
      (account as any)?.type ??
      (payloadData as any)?.accountType ??
      (payloadData as any)?.type ??
      '',

    parentCode:
      (account as any)?.parentCode ??
      (account as any)?.parent?.code ??
      (payloadData as any)?.parentCode ??
      '',

    parentLabel: (account as any)?.parent?.name ?? '',

    normalBalance: (account as any)?.normalBalance ?? (payloadData as any)?.normalBalance ?? '',

    ifrsCode:
      (account as any)?.ifrsCode ??
      (account as any)?.ifrsNode?.code ??
      (payloadData as any)?.ifrsCode ??
      '',

    fsMappingLevel1: (account as any)?.fsMappingLevel1 ?? (payloadData as any)?.fsMappingLevel1 ?? '',
    fsMappingLevel2: (account as any)?.fsMappingLevel2 ?? (payloadData as any)?.fsMappingLevel2 ?? '',
    isPosting: (account as any)?.isPosting ?? (payloadData as any)?.isPosting ?? false,
    isControlAccount: (payloadData as any)?.isControlAccount ?? false,
    isBudgetRelevant: (payloadData as any)?.isBudgetRelevant ?? false,
    budgetControlMode: (payloadData as any)?.budgetControlMode ?? '',
    parentAccountId: (account as any)?.parentAccountId ?? (payloadData as any)?.parentAccountId ?? null,
  };

  const selectedAccountCode = String(data.code ?? '').trim();
  const selectedAccountName = String(data.name ?? '').trim();

  const selectedAccountLabel = (() => {
    if (!selected) return '';
    if (isImportBatchRequest) {
      const bid = String((selected as any)?.entityId ?? (selected as any)?.payloadJson?.batchId ?? '').trim();
      return bid ? `Batch ${bid}` : 'Batch';
    }
    return `${selectedAccountCode}${selectedAccountCode && selectedAccountName ? ' - ' : ''}${selectedAccountName}`.trim();
  })();

  const allSelected = pendingAccountRequests.length > 0 && selectedApprovalIds.length === pendingAccountRequests.length;

  const toggleSelectAll = () => {
    setSelectedApprovalIds(allSelected ? [] : pendingAccountRequests.map((r) => r.id));
  };

  return (
    <div
      className="financePage"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0, overflow: 'hidden' }}
    >
      {toast ? (
        <div
          style={{
            position: 'sticky',
            top: 8,
            zIndex: 5,
            marginBottom: 4,
            padding: '8px 10px',
            borderRadius: 10,
            border: `1px solid ${tokens.colors.border.subtle}`,
            background: '#e7f6ec',
            color: '#166534',
            fontWeight: 650,
            maxWidth: 920,
          }}
        >
          {toast}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 850 }}>COA Approvals</div>
          <div style={{ marginTop: 6, fontSize: 13, color: tokens.colors.text.secondary }}>
            Pending COA governance requests.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {canApprove ? (
            <Button
              onClick={handleBulkApprove}
              disabled={bulkActionDisabled || selectedApprovalIds.length === 0}
            >
              {bulkBusy ? 'Working…' : `Approve Selected (${selectedApprovalIds.length})`}
            </Button>
          ) : null}
          {canReject ? (
            <Button
              variant="destructive"
              onClick={() => {
                if (bulkActionDisabled) return;
                setBulkRejecting(true);
                setBulkRejectReason('');
                setError(null);
              }}
              disabled={bulkActionDisabled || selectedApprovalIds.length === 0}
            >
              {bulkBusy ? 'Working…' : `Reject Selected (${selectedApprovalIds.length})`}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={refresh} disabled={loading || approveBusy || rejectBusy}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Alert tone="error" title="Error">
          <div>{error}</div>
          {validationMessages.length > 0 ? (
            <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
              {validationMessages.map((m, idx) => (
                <div key={idx} style={{ fontSize: 13 }}>
                  - {m}
                </div>
              ))}
            </div>
          ) : null}
        </Alert>
      ) : null}

      {bulkResult ? (
        <Alert tone={(bulkResult.failed?.length ?? 0) > 0 ? 'warning' : 'success'} title="Bulk action summary">
          <div style={{ display: 'grid', gap: 6, fontSize: 13, color: tokens.colors.text.secondary }}>
            <div>{(bulkResult.success ?? []).length} succeeded</div>
            <div>{(bulkResult.failed ?? []).length} failed</div>
          </div>
        </Alert>
      ) : null}

      <div className="coa-layout">
        <div className="coa-left">
          <div style={{ fontWeight: 850, padding: 4 }}>
            Pending Approval ({pendingAccountRequests.length})
          </div>

          {loading ? <div style={{ color: tokens.colors.text.muted, padding: '8px 4px' }}>Loading…</div> : null}
          {!loading && pendingAccountRequests.length === 0 ? (
            <div style={{ color: tokens.colors.text.muted, padding: '8px 4px' }}>No pending approvals.</div>
          ) : null}

          {!loading && pendingAccountRequests.length > 0 ? (
            <div className="coa-list" role="table" aria-label="COA approvals">
              <div className="approvals-card">
                <div className="approval-grid approval-header" role="row">
                  <div role="columnheader" className="cell-checkbox">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                  </div>
                  <div role="columnheader" className="cell-code">Code</div>
                  <div role="columnheader" className="cell-name">Name</div>
                  <div role="columnheader" className="cell-status">Status</div>
                </div>

                <div className="approvals-scroll">
                  {pendingAccountRequests.map((r) => {
                    const isSelected = selectedId === r.id;
                    if (import.meta.env.DEV) console.log('ROW DATA:', r);

                    const rawPayloadJson: any = (r as any)?.payloadJson;
                    let payloadObj: any = null;
                    if (rawPayloadJson && typeof rawPayloadJson === 'object') payloadObj = rawPayloadJson;
                    else if (typeof rawPayloadJson === 'string') {
                      try {
                        payloadObj = JSON.parse(rawPayloadJson);
                      } catch {
                        payloadObj = null;
                      }
                    }

                    const code = String((r as any)?.account?.code ?? payloadObj?.code ?? '').trim();
                    const name = String((r as any)?.account?.name ?? payloadObj?.name ?? '').trim();

                    const approvalType = String(
                      (r as any)?.approvalType ?? resolveRequestTypeLabel(r.requestType) ?? ''
                    ).trim();
                    const requestedAt = formatDateTime(r.requestedAt);

                    const issues = requestIssuesForRow(r);
                    const failureMsg = bulkFailureById[String(r.id)] ?? '';
                    const rowHasIssues = issues.length > 0 || Boolean(failureMsg);

                    const issueLabel = failureMsg
                      ? failureMsg
                      : issues.length > 0
                        ? issues.slice(0, 1).join('')
                        : '';

                    return (
                      <div
                        key={r.id}
                        role="row"
                        className="approval-grid approval-row"
                        data-selected={isSelected ? 'true' : 'false'}
                        onClick={() => setSelectedId(r.id)}
                        style={{
                          cursor: 'pointer',
                          ...(rowHasIssues ? { borderLeft: '3px solid #f56565' } : {}),
                        }}
                      >
                        <div role="cell" className="cell-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedApprovalIds.includes(r.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedApprovalIds((prev) =>
                                  prev.includes(r.id) ? prev : [...prev, r.id]
                                );
                              } else {
                                setSelectedApprovalIds((prev) => prev.filter((id) => id !== r.id));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        <div
                          role="cell"
                          className="cell-code"
                          style={{
                            fontFamily:
                              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={code}
                        >
                          {code ?? ''}
                        </div>

                        <div role="cell" className="cell-name approval-name" title={name}>
                          {name ?? ''}
                        </div>

                        <div role="cell" className="cell-status status-cell" title={issueLabel}>
                          <div className="status">{approvalType ?? ''}</div>
                          <div className="date">{requestedAt ?? ''}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="coa-right">
          <div style={{ padding: 14, borderBottom: `1px solid ${tokens.colors.border.subtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 850 }}>Preview</div>
              {selectedAccountLabel ? <div style={{ marginTop: 4, fontSize: 12, color: tokens.colors.text.muted }}>{selectedAccountLabel}</div> : null}
            </div>
            {selected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 360, flex: 1, justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, maxWidth: 420 }}>
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Optional comment"
                    disabled={approveBusy || rejectBusy}
                    style={{
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
                      opacity: approveBusy || rejectBusy ? 0.6 : 1,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = tokens.focusRing.borderColor;
                      e.currentTarget.style.boxShadow = tokens.focusRing.ring;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = tokens.colors.border.default;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  {isSelfApprovalAttempt ? (
                    <div style={{ fontSize: 12, color: tokens.colors.text.muted, fontWeight: 650 }}>
                      You cannot approve a request you created.
                    </div>
                  ) : null}
                </div>

                <Button
                  onClick={() => {
                    if (!selected) return;
                    setApproveConfirmingId(selected.id);
                    setError(null);
                  }}
                  disabled={approveBusy || rejectBusy || isSelfApprovalAttempt || isImportBatchRequest}
                  style={{ height: 40 }}
                >
                  {approveBusy ? 'Approving…' : isImportBatchRequest ? 'Approve Batch' : 'Approve'}
                </Button>
                {canReject ? (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setRejectingId(selected.id);
                      setRejectReason('');
                      setError(null);
                    }}
                    disabled={approveBusy || rejectBusy || isImportBatchRequest}
                    style={{ height: 40 }}
                  >
                    Reject
                  </Button>
                ) : null}
                {isImportBatchRequest && selectedBatchId ? (
                  <Link
                    to={`/finance/coa/import-batches/${encodeURIComponent(selectedBatchId)}/review`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Button variant="accent" style={{ height: 40 }}>
                      Review Batch
                    </Button>
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div className="coaPreviewScroll">
              {!selected ? (
                <div style={{ color: tokens.colors.text.muted }}>Select a request to view details.</div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {isImportBatchRequest ? (
                    <>
                      <div style={{ border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: 12, background: '#f8fafc', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontWeight: 850 }}>
                          Batch Summary
                        </div>
                        <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: 8, columnGap: 12, fontSize: 13 }}>
                          <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Batch ID</div>
                          <div style={{ fontWeight: 750 }}>{batch?.batchId || String((selected as any)?.entityId ?? '—')}</div>

                          <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Submitted By</div>
                          <div style={{ fontWeight: 650 }}>{selected.requestedBy?.name || selected.requestedBy?.email || '—'}</div>

                          <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Submission Date</div>
                          <div>{batch?.submittedAt ? formatDateTime(batch.submittedAt) : formatDateTime(selected.requestedAt)}</div>

                          <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Account Count</div>
                          <div style={{ fontWeight: 650 }}>{batch?.accountCount ?? (selected as any)?.payloadJson?.accountCount ?? batchAccounts.length ?? '—'}</div>

                          <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Status</div>
                          <div style={{ fontWeight: 650 }}>{String(batch?.status ?? 'PENDING_APPROVAL').replaceAll('_', ' ')}</div>
                        </div>
                      </div>

                      <div style={{ border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: 12, background: '#f8fafc', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontWeight: 850 }}>
                          Batch Accounts
                        </div>
                        <div style={{ padding: 12 }}>
                          {batchLoading ? <div style={{ color: tokens.colors.text.muted }}>Loading batch…</div> : null}
                          {!batchLoading ? (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: 'left', fontSize: 12, padding: '8px 10px', borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>Account Code</th>
                                    <th style={{ textAlign: 'left', fontSize: 12, padding: '8px 10px', borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>Account Name</th>
                                    <th style={{ textAlign: 'left', fontSize: 12, padding: '8px 10px', borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>Parent Code</th>
                                    <th style={{ textAlign: 'left', fontSize: 12, padding: '8px 10px', borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>Account Type</th>
                                    <th style={{ textAlign: 'left', fontSize: 12, padding: '8px 10px', borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>IFRS Node</th>
                                    <th style={{ textAlign: 'left', fontSize: 12, padding: '8px 10px', borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>Description</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {batchAccounts.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} style={{ padding: '10px', fontSize: 12, color: tokens.colors.text.muted }}>
                                        No accounts found for this batch.
                                      </td>
                                    </tr>
                                  ) : null}
                                  {batchAccounts.map((a) => {
                                    const parentId = String((a as any)?.parentAccountId ?? '');
                                    const parentCode = parentId && activeAccountsById[parentId] ? activeAccountsById[parentId].code : parentId ? parentId : '—';
                                    const ifrsId = String((a as any)?.ifrsNodeId ?? '').trim();
                                    const ifrsLabel = ifrsId && ifrsById[ifrsId] ? String((ifrsById[ifrsId] as any).fullPath ?? ifrsId) : ifrsId || '—';
                                    return (
                                      <tr key={a.id}>
                                        <td style={{ padding: '10px', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12 }}>
                                          {a.code}
                                        </td>
                                        <td style={{ padding: '10px', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontSize: 12 }}>{a.name}</td>
                                        <td style={{ padding: '10px', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontSize: 12 }}>{parentCode}</td>
                                        <td style={{ padding: '10px', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontSize: 12 }}>{String((a as any)?.type ?? '—')}</td>
                                        <td style={{ padding: '10px', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontSize: 12 }}>{ifrsLabel}</td>
                                        <td style={{ padding: '10px', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontSize: 12, color: tokens.colors.text.secondary }}>{String((a as any)?.description ?? '').trim() || '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </>
                  ) : null}

                  <div style={{ border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: 12, background: '#f8fafc', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontWeight: 850 }}>
                      Request Summary
                    </div>
                    <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: 8, columnGap: 12, fontSize: 13 }}>
                      <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Approval Type</div>
                      <div style={{ fontWeight: 750 }}>{resolveRequestTypeLabel(selected.requestType)}</div>

                      <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Requested By</div>
                      <div style={{ fontWeight: 650 }}>{selected.requestedBy?.name || selected.requestedBy?.email || '—'}</div>

                      <div style={{ color: tokens.colors.text.muted, fontWeight: 750 }}>Requested At</div>
                      <div>{formatDateTime(selected.requestedAt)}</div>
                    </div>
                  </div>

                  {!isImportBatchRequest ? (
                    <div className="coa-card">
                      <div style={{ padding: 12, background: '#f8fafc', borderBottom: `1px solid ${tokens.colors.border.subtle}`, fontWeight: 850 }}>
                        Account Details
                      </div>

                      <div style={{ padding: 12 }}>
                        <div className="coa-card-body">
                          <div className="label">Account Code</div>
                          <div className="value">{String(data.code || '—')}</div>

                          <div className="label">Account Name</div>
                          <div className="value">{String(data.name || '—')}</div>

                          <div className="label">Account Type</div>
                          <div className="value">{String(data.accountType || '—')}</div>

                          <div className="label">Parent Account</div>
                          <div className="value">{String((data as any).parentLabel || data.parentCode || '—')}</div>

                          <div className="label">Posting Account</div>
                          <div className="value">{Boolean(data.isPosting) ? 'Yes' : 'No'}</div>

                          <div className="label">Normal Balance</div>
                          <div className="value">{String(data.normalBalance || '—')}</div>

                          <div className="label">IFRS Mapping</div>
                          <div className="value">{String(data.ifrsCode || '—')}</div>

                          <div className="label">FS Mapping Level 1</div>
                          <div className="value">{String(data.fsMappingLevel1 || '—')}</div>

                          <div className="label">FS Mapping Level 2</div>
                          <div className="value">{String(data.fsMappingLevel2 || '—')}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {approveConfirmingId && selected ? (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(11,12,30,0.52)', zIndex: 70 }}
            onClick={() => {
              if (approveBusy) return;
              setApproveConfirmingId(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: '18vh',
              left: '50%',
              transform: 'translate(-50%, 0)',
              width: 'min(640px, calc(100vw - 32px))',
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
            <div style={{ fontWeight: 850, fontSize: 16 }}>{isImportBatchRequest ? 'Approve Batch' : 'Approve Request'}</div>
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>
              {isImportBatchRequest
                ? 'Approving this batch will activate all accounts in the batch.'
                : 'Approving this request will apply the proposed changes.'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button
                variant="secondary"
                onClick={() => {
                  if (approveBusy) return;
                  setApproveConfirmingId(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={onConfirmApprove} disabled={approveBusy || rejectBusy || isSelfApprovalAttempt}>
                {approveBusy ? 'Approving…' : isImportBatchRequest ? 'Approve Batch' : 'Approve'}
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {rejectingId && canReject ? (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(11,12,30,0.52)', zIndex: 70 }}
            onClick={() => {
              if (rejectBusy) return;
              setRejectingId(null);
              setRejectReason('');
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: '18vh',
              left: '50%',
              transform: 'translate(-50%, 0)',
              width: 'min(640px, calc(100vw - 32px))',
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
            <div style={{ fontWeight: 850, fontSize: 16 }}>{isImportBatchRequest ? 'Reject Batch' : 'Reject Request'}</div>
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>A rejection reason is required.</div>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Reason *
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                disabled={rejectBusy}
                style={{
                  width: '100%',
                  borderRadius: 12,
                  border: `1px solid ${tokens.colors.border.subtle}`,
                  padding: 10,
                  fontFamily: 'inherit',
                  fontSize: 13,
                }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button
                variant="secondary"
                onClick={() => {
                  if (rejectBusy) return;
                  setRejectingId(null);
                  setRejectReason('');
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={onConfirmReject} disabled={rejectBusy}>
                {rejectBusy ? 'Rejecting…' : isImportBatchRequest ? 'Reject Batch' : 'Reject'}
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {bulkRejecting && canReject ? (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(11,12,30,0.52)', zIndex: 70 }}
            onClick={() => {
              if (bulkBusy) return;
              setBulkRejecting(false);
              setBulkRejectReason('');
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: '18vh',
              left: '50%',
              transform: 'translate(-50%, 0)',
              width: 'min(640px, calc(100vw - 32px))',
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
            <div style={{ fontWeight: 850, fontSize: 16 }}>Reject Selected</div>
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>A rejection reason is required.</div>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Reason *
              <textarea
                value={bulkRejectReason}
                onChange={(e) => setBulkRejectReason(e.target.value)}
                rows={4}
                disabled={bulkBusy}
                style={{
                  width: '100%',
                  borderRadius: 12,
                  border: `1px solid ${tokens.colors.border.subtle}`,
                  padding: 10,
                  fontFamily: 'inherit',
                  fontSize: 13,
                }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button
                variant="secondary"
                onClick={() => {
                  if (bulkBusy) return;
                  setBulkRejecting(false);
                  setBulkRejectReason('');
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleBulkReject} disabled={bulkBusy}>
                {bulkBusy ? 'Rejecting…' : 'Reject Selected'}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
