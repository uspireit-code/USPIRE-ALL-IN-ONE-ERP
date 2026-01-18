import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { PERMISSIONS } from '../../../auth/permission-catalog';
import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { DataTable } from '../../../components/DataTable';
import { Input } from '../../../components/Input';
import { PageLayout } from '../../../components/PageLayout';
import { tokens } from '../../../designTokens';
import { getApiErrorMessage, type ApiError } from '../../../services/api';
import { downloadAuditEvidence, uploadAuditEvidence, type AuditEvidenceRow } from '../../../services/auditEvidence';
import {
  approveImprestCase,
  getImprestCase,
  issueImprestCase,
  linkImprestEvidence,
  rejectImprestCase,
  reviewImprestCase,
  submitImprestCase,
  type ImprestCase,
  type ImprestEvidenceType,
} from '../../../services/imprest';

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function StatusPill(props: { state: string }) {
  const s = (props.state ?? '').toUpperCase();
  const bg = s === 'ISSUED' ? 'rgba(16,185,129,0.12)' : s === 'DRAFT' ? 'rgba(148,163,184,0.18)' : 'rgba(59,130,246,0.12)';
  const border = s === 'ISSUED' ? 'rgba(16,185,129,0.25)' : s === 'DRAFT' ? 'rgba(148,163,184,0.28)' : 'rgba(59,130,246,0.22)';
  const text = s === 'ISSUED' ? 'rgba(16,185,129,0.95)' : s === 'DRAFT' ? 'rgba(71,85,105,0.95)' : 'rgba(59,130,246,0.95)';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        fontSize: 12,
        fontWeight: 750,
        color: text,
        whiteSpace: 'nowrap',
      }}
    >
      {s || '—'}
    </span>
  );
}

function SectionCard(props: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${tokens.colors.border.subtle}`,
        borderRadius: tokens.radius.lg,
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: 14,
          borderBottom: `1px solid ${tokens.colors.border.subtle}`,
          background: tokens.colors.surface.subtle,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontWeight: 850, color: tokens.colors.text.primary }}>{props.title}</div>
          {props.subtitle ? <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.secondary }}>{props.subtitle}</div> : null}
        </div>
        {props.right ? <div>{props.right}</div> : null}
      </div>
      <div style={{ padding: 14 }}>{props.children}</div>
    </div>
  );
}

function EvidenceTypePill(props: { t: ImprestEvidenceType; ok: boolean }) {
  const bg = props.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)';
  const border = props.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.22)';
  const text = props.ok ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.85)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        fontSize: 12,
        fontWeight: 750,
        color: text,
        whiteSpace: 'nowrap',
      }}
    >
      {props.t}
    </span>
  );
}

export function ImprestCaseDetailsPage() {
  const { id } = useParams();
  const caseId = String(id ?? '').trim();

  const { state, hasPermission } = useAuth();
  const authLoading = Boolean(state.isAuthenticated) && !state.me;

  const canView = hasPermission(PERMISSIONS.IMPREST.CASE_VIEW);
  const canSubmitPermission = hasPermission(PERMISSIONS.IMPREST.CASE_SUBMIT);
  const canReview = hasPermission(PERMISSIONS.IMPREST.CASE_REVIEW);
  const canApprove = hasPermission(PERMISSIONS.IMPREST.CASE_APPROVE);
  const canReject = hasPermission(PERMISSIONS.IMPREST.CASE_REJECT);
  const canIssue = hasPermission(PERMISSIONS.IMPREST.CASE_ISSUE);

  const navigate = useNavigate();

  const [row, setRow] = useState<ImprestCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [acting, setActing] = useState(false);

  const [notes, setNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const [uploading, setUploading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const [selectedEvidenceType, setSelectedEvidenceType] = useState<ImprestEvidenceType>('REQUEST_SUPPORTING_DOC');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!canView) return;
    if (!caseId) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, caseId]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const c = await getImprestCase(caseId);
      setRow(c);
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to load imprest case'));
    } finally {
      setLoading(false);
    }
  }

  const stateCode = (row?.state ?? '').toUpperCase();

  const evidenceLinks = row?.evidence ?? [];
  const evidenceTypesPresent = useMemo(() => {
    const s = new Set<string>();
    for (const l of evidenceLinks ?? []) s.add(String(l.type ?? '').toUpperCase());
    return s;
  }, [evidenceLinks]);

  const hasSupportingDoc = evidenceTypesPresent.has('REQUEST_SUPPORTING_DOC');
  const hasFundingProof = evidenceTypesPresent.has('FUNDING_PROOF');

  const canDoReview = ['SUBMITTED', 'IN_REVIEW'].includes(stateCode);
  const canDoApprove = ['IN_REVIEW', 'APPROVED'].includes(stateCode);
  const canDoIssue = ['APPROVED', 'ISSUANCE_PENDING_EVIDENCE'].includes(stateCode);

  const submitBlockedReason = !canSubmitPermission
    ? 'Submit blocked: missing permission IMPREST_CASE_SUBMIT.'
    : !hasSupportingDoc
      ? 'Submit blocked: supporting documents are required.'
      : '';
  const issueBlockedReason = !hasFundingProof ? 'Issue blocked: funding proof is required.' : '';

  async function doSubmit() {
    setActing(true);
    setError('');
    setSuccess('');
    try {
      if (!canSubmitPermission || !hasSupportingDoc) {
        setError(submitBlockedReason || 'Submit blocked.');
        return;
      }
      await submitImprestCase(caseId, notes.trim() ? { notes: notes.trim() } : undefined);
      setSuccess('Submitted');
      setNotes('');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to submit'));
    } finally {
      setActing(false);
    }
  }

  async function doReview() {
    setActing(true);
    setError('');
    setSuccess('');
    try {
      await reviewImprestCase(caseId, notes.trim() ? { notes: notes.trim() } : undefined);
      setSuccess('Reviewed');
      setNotes('');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to review'));
    } finally {
      setActing(false);
    }
  }

  async function doApprove() {
    setActing(true);
    setError('');
    setSuccess('');
    try {
      await approveImprestCase(caseId, notes.trim() ? { notes: notes.trim() } : undefined);
      setSuccess('Approved');
      setNotes('');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to approve'));
    } finally {
      setActing(false);
    }
  }

  async function doReject() {
    setActing(true);
    setError('');
    setSuccess('');
    try {
      if (!canReject) {
        setError('Reject blocked: missing permission IMPREST_CASE_REJECT.');
        return;
      }
      if (!rejectReason.trim()) {
        setError('Rejection reason is required');
        return;
      }
      await rejectImprestCase(caseId, { reason: rejectReason.trim() });
      setSuccess('Rejected');
      setRejectReason('');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to reject'));
    } finally {
      setActing(false);
    }
  }

  async function doIssue() {
    setActing(true);
    setError('');
    setSuccess('');
    try {
      if (!hasFundingProof) {
        setError(issueBlockedReason);
        return;
      }
      await issueImprestCase(caseId, { issueDate: new Date().toISOString(), notes: notes.trim() ? notes.trim() : undefined });
      setSuccess('Issued (journal should be POSTED)');
      setNotes('');
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e as ApiError, 'Failed to issue'));
    } finally {
      setActing(false);
    }
  }

  async function onUploadAndLink() {
    setEvidenceError('');
    setSuccess('');
    if (!selectedFile) {
      setEvidenceError('Choose a file first');
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadAuditEvidence({ entityType: 'IMPREST_CASE', entityId: caseId, file: selectedFile });
      await linkImprestEvidence(caseId, { evidenceId: uploaded.id, type: selectedEvidenceType });
      setSelectedFile(null);
      setSuccess('Evidence uploaded and linked');
      await refresh();
    } catch (e) {
      setEvidenceError(getApiErrorMessage(e as ApiError, 'Failed to upload/link evidence'));
    } finally {
      setUploading(false);
    }
  }

  async function onDownload(e: AuditEvidenceRow | any) {
    const evidenceId = String(e?.id ?? '').trim();
    if (!evidenceId) return;
    try {
      const { blob, fileName } = await downloadAuditEvidence(evidenceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiErrorMessage(err as ApiError, 'Failed to download evidence'));
    }
  }

  if (authLoading) {
    return <div style={{ padding: 18 }}>Loading…</div>;
  }

  if (!canView) {
    return (
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0 }}>Imprest Case</h2>
        <div style={{ marginTop: 10, color: '#b00020' }}>Access denied.</div>
      </div>
    );
  }

  if (!caseId) {
    return (
      <div style={{ padding: 18 }}>
        <h2 style={{ margin: 0 }}>Imprest Case</h2>
        <div style={{ marginTop: 10, color: '#b00020' }}>Missing case id.</div>
      </div>
    );
  }

  const transitions = [...(row?.transitions ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <PageLayout
      title={row ? `Imprest Case: ${row.reference}` : 'Imprest Case'}
      description="Governance detail: evidence gates + immutable lifecycle transitions."
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => navigate('/finance/imprest/cases')}>Back to Cases</Button>
          {row?.issuedJournalId ? (
            <Button onClick={() => navigate(`/finance/gl/journals/${encodeURIComponent(row.issuedJournalId!)}`)}>View Journal</Button>
          ) : null}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error ? <Alert tone="error" title="Error">{error}</Alert> : null}
        {success ? <Alert tone="success" title="Success">{success}</Alert> : null}

        {loading ? <div>Loading…</div> : null}

        {row ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SectionCard
                title="Summary"
                subtitle={`ID: ${row.id}`}
                right={<StatusPill state={row.state} />}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>Purpose</div>
                    <div style={{ marginTop: 4, fontWeight: 800 }}>{row.purpose}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>Requested</div>
                    <div style={{ marginTop: 4, fontWeight: 900 }}>{row.requestedAmount} {row.currency}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>Period</div>
                    <div style={{ marginTop: 4, fontWeight: 800 }}>{formatDate(row.periodFrom)} → {formatDate(row.periodTo)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>Expected Settlement</div>
                    <div style={{ marginTop: 4, fontWeight: 800 }}>{formatDate(row.expectedSettlementDate)}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: tokens.colors.text.secondary }}>Justification</div>
                    <div style={{ marginTop: 4 }}>{row.justification}</div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Evidence"
                subtitle="Upload to audit evidence store, then link to the case evidence gate."
              >
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <EvidenceTypePill t="REQUEST_SUPPORTING_DOC" ok={hasSupportingDoc} />
                  <EvidenceTypePill t="FUNDING_PROOF" ok={hasFundingProof} />
                </div>

                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '0.5fr 0.5fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.primary }}>Evidence Type</div>
                    <select
                      value={selectedEvidenceType}
                      onChange={(e) => setSelectedEvidenceType(e.target.value as any)}
                      style={{
                        width: '100%',
                        height: 40,
                        padding: '0 10px',
                        borderRadius: tokens.radius.sm,
                        border: `1px solid ${tokens.colors.border.default}`,
                        background: tokens.colors.white,
                        color: tokens.colors.text.primary,
                        fontSize: 14,
                        outline: 'none',
                        boxSizing: 'border-box',
                        marginTop: 6,
                      }}
                    >
                      <option value="REQUEST_SUPPORTING_DOC">REQUEST_SUPPORTING_DOC</option>
                      <option value="FUNDING_PROOF">FUNDING_PROOF</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.primary }}>File</div>
                    <input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                      style={{ marginTop: 10 }}
                    />
                  </div>
                </div>

                {evidenceError ? (
                  <div style={{ marginTop: 12 }}>
                    <Alert tone="error" title="Evidence error">{evidenceError}</Alert>
                  </div>
                ) : null}

                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <Button variant="accent" disabled={uploading || !selectedFile} onClick={onUploadAndLink}>
                    {uploading ? 'Uploading…' : 'Upload & Link'}
                  </Button>
                  <Button variant="secondary" onClick={refresh}>
                    Refresh
                  </Button>
                </div>

                <div style={{ marginTop: 14 }}>
                  <DataTable>
                    <DataTable.Head>
                      <DataTable.Row>
                        <DataTable.Th>Type</DataTable.Th>
                        <DataTable.Th>File</DataTable.Th>
                        <DataTable.Th>Uploaded</DataTable.Th>
                        <DataTable.Th>Actions</DataTable.Th>
                      </DataTable.Row>
                    </DataTable.Head>
                    <DataTable.Body>
                      {(evidenceLinks ?? []).length === 0 ? <DataTable.Empty colSpan={4} title="No linked evidence" /> : null}
                      {(evidenceLinks ?? []).map((l, idx) => (
                        <DataTable.Row key={l.id} zebra index={idx}>
                          <DataTable.Td>{l.type}</DataTable.Td>
                          <DataTable.Td>
                            <div style={{ fontWeight: 800 }}>{String(l.evidence?.fileName ?? l.evidenceId)}</div>
                            <div style={{ marginTop: 2, fontSize: 12, color: tokens.colors.text.secondary }}>{l.evidenceId}</div>
                          </DataTable.Td>
                          <DataTable.Td>{formatDateTime(l.createdAt)}</DataTable.Td>
                          <DataTable.Td>
                            <Button size="sm" onClick={() => onDownload(l.evidence ?? { id: l.evidenceId })}>
                              Download
                            </Button>
                          </DataTable.Td>
                        </DataTable.Row>
                      ))}
                    </DataTable.Body>
                  </DataTable>
                </div>
              </SectionCard>

              <SectionCard title="Timeline" subtitle="Lifecycle transitions are non-bypassable and fully auditable.">
                <DataTable>
                  <DataTable.Head>
                    <DataTable.Row>
                      <DataTable.Th>From</DataTable.Th>
                      <DataTable.Th>To</DataTable.Th>
                      <DataTable.Th>Actor</DataTable.Th>
                      <DataTable.Th>Notes</DataTable.Th>
                      <DataTable.Th>At</DataTable.Th>
                    </DataTable.Row>
                  </DataTable.Head>
                  <DataTable.Body>
                    {transitions.length === 0 ? <DataTable.Empty colSpan={5} title="No transitions recorded" /> : null}
                    {transitions.map((t, idx) => (
                      <DataTable.Row key={t.id} zebra index={idx}>
                        <DataTable.Td>{t.fromState}</DataTable.Td>
                        <DataTable.Td>
                          <div style={{ fontWeight: 850 }}>{t.toState}</div>
                        </DataTable.Td>
                        <DataTable.Td>{t.actorUserId}</DataTable.Td>
                        <DataTable.Td>{t.notes ?? '—'}</DataTable.Td>
                        <DataTable.Td>{formatDateTime(t.createdAt)}</DataTable.Td>
                      </DataTable.Row>
                    ))}
                  </DataTable.Body>
                </DataTable>
              </SectionCard>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SectionCard title="Actions" subtitle="Buttons are permission + state gated. Block reasons are explicit.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.primary }}>Notes (optional)</div>
                    <div style={{ marginTop: 6 }}>
                      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for audit trail" disabled={acting} />
                    </div>
                  </div>

                  {stateCode === 'DRAFT' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Button
                        variant="accent"
                        disabled={acting || !canSubmitPermission || !hasSupportingDoc}
                        title={submitBlockedReason}
                        onClick={doSubmit}
                      >
                        Submit
                      </Button>
                      {!canSubmitPermission || !hasSupportingDoc ? (
                        <div style={{ fontSize: 12, color: '#b00020' }}>{submitBlockedReason}</div>
                      ) : null}
                    </div>
                  ) : null}

                  {canDoReview ? (
                    <Button variant="secondary" disabled={acting || !canReview} title={!canReview ? 'Missing permission: IMPREST_CASE_REVIEW' : ''} onClick={doReview}>
                      Review
                    </Button>
                  ) : null}

                  {canDoApprove ? (
                    <Button variant="secondary" disabled={acting || !canApprove} title={!canApprove ? 'Missing permission: IMPREST_CASE_APPROVE' : ''} onClick={doApprove}>
                      Approve
                    </Button>
                  ) : null}

                  {canDoIssue ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Button variant="accent" disabled={acting || !canIssue || !hasFundingProof} title={!hasFundingProof ? issueBlockedReason : !canIssue ? 'Missing permission: IMPREST_CASE_ISSUE' : ''} onClick={doIssue}>
                        Issue
                      </Button>
                      {!hasFundingProof ? <div style={{ fontSize: 12, color: '#b00020' }}>{issueBlockedReason}</div> : null}
                    </div>
                  ) : null}

                  {(canDoReview || canDoApprove) ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 750, color: tokens.colors.text.primary }}>Reject reason</div>
                      <div style={{ marginTop: 6 }}>
                        <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection" disabled={acting} />
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <Button
                          variant="destructive"
                          disabled={acting || !canReject || !rejectReason.trim()}
                          title={!canReject ? 'Missing permission: IMPREST_CASE_REJECT' : ''}
                          onClick={doReject}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {row.issuedJournalId ? (
                    <Alert tone="info" title="Journal">
                      Issued journal: {row.issuedJournalId}. Use "View Journal" to verify it is POSTED.
                    </Alert>
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard title="Governance checks" subtitle="What is blocking progress right now?">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 750 }}>Required to Submit</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <EvidenceTypePill t="REQUEST_SUPPORTING_DOC" ok={hasSupportingDoc} />
                    {!hasSupportingDoc ? <span style={{ fontSize: 12, color: '#b00020' }}>Blocked</span> : <span style={{ fontSize: 12, color: 'rgba(16,185,129,0.95)' }}>OK</span>}
                  </div>

                  <div style={{ height: 1, background: 'rgba(11,12,30,0.08)', margin: '6px 0' }} />

                  <div style={{ fontSize: 13, fontWeight: 750 }}>Required to Issue</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <EvidenceTypePill t="FUNDING_PROOF" ok={hasFundingProof} />
                    {!hasFundingProof ? <span style={{ fontSize: 12, color: '#b00020' }}>Blocked</span> : <span style={{ fontSize: 12, color: 'rgba(16,185,129,0.95)' }}>OK</span>}
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        ) : null}
      </div>
    </PageLayout>
  );
}
