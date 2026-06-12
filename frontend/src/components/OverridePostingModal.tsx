import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { tokens } from '../designTokens';
import { Button } from './Button';
import { getApiErrorMessage } from '../services/api';
import { uploadAuditEvidence } from '../services/auditEvidence';
import { postJournal, postJournalOverride } from '../services/gl';
import {
  createOverrideSession,
  getOverrideSession,
  parseOverrideRequirement,
  type GovernanceOverrideSessionRow,
  type OverrideRequirement,
} from '../services/overrideSessions';

type SessionSlot = 'retro' | 'period' | 'gl';

type ApprovedSessions = Partial<Record<SessionSlot, GovernanceOverrideSessionRow>>;

type Phase = 'request' | 'awaiting_approval' | 'posted';

function slotForOverrideCode(overrideCode: string): SessionSlot | null {
  if (overrideCode === 'RETRO_POSTING_OVERRIDE') return 'retro';
  if (overrideCode === 'PERIOD_SOFT_CLOSE_OVERRIDE') return 'period';
  if (overrideCode === 'GL_POST_OVERRIDE') return 'gl';
  return null;
}

function requirementTitle(req: OverrideRequirement): string {
  if (req.code === 'RETRO_POSTING_OVERRIDE_REQUIRED') return 'Retro posting override required';
  if (req.code === 'PERIOD_SOFT_CLOSE_OVERRIDE_REQUIRED') return 'Soft-close posting override required';
  return 'Closed-period posting override required';
}

function isoPlusHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

/**
 * Drives the end-to-end governance override workflow for a journal that was
 * blocked by retro / period posting controls:
 *   1. capture reason, justification and supporting evidence
 *   2. create a governance override session (routed for secondary approval)
 *   3. once approved, retry posting using the approved session
 *
 * Compound cases (e.g. a soft-closed period that is also a retro posting) are
 * handled by accumulating each approved session and re-prompting for the next
 * required override until the journal posts.
 */
export function OverridePostingModal(props: {
  journal: { id: string; journalNumber?: number | null; reference?: string | null };
  requirement: OverrideRequirement;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [requirement, setRequirement] = useState<OverrideRequirement>(props.requirement);
  const [phase, setPhase] = useState<Phase>('request');

  const [reason, setReason] = useState('');
  const [justification, setJustification] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const [sessions, setSessions] = useState<ApprovedSessions>({});
  const [activeSession, setActiveSession] = useState<GovernanceOverrideSessionRow | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const journalLabel = useMemo(() => {
    const n = props.journal.journalNumber;
    const base = n ? `J${String(n).padStart(6, '0')}` : props.journal.id.slice(0, 8);
    return props.journal.reference ? `${base} • ${props.journal.reference}` : base;
  }, [props.journal]);

  async function retryPost(current: ApprovedSessions) {
    if (current.gl) {
      return postJournalOverride(props.journal.id, current.gl.id);
    }
    return postJournal(props.journal.id, {
      governanceReason:
        reason.trim() || current.retro?.reason || current.period?.reason || undefined,
      retroOverrideSessionId: current.retro?.id,
      periodOverrideSessionId: current.period?.id,
    });
  }

  async function attemptPostWith(current: ApprovedSessions) {
    try {
      await retryPost(current);
      setPhase('posted');
      setInfo('Journal posted under approved governance override.');
      props.onPosted();
      return;
    } catch (e) {
      const nextReq = parseOverrideRequirement(e);
      if (nextReq) {
        const slot = slotForOverrideCode(nextReq.overrideCode);
        // A further, different override is required (compound governance).
        if (slot && !current[slot]) {
          setRequirement(nextReq);
          setActiveSession(null);
          setEvidenceFile(null);
          setPhase('request');
          setError(null);
          setInfo(
            `An additional governance override is required: ${nextReq.reason || nextReq.code}`,
          );
          return;
        }
      }
      setError(getApiErrorMessage(e, 'Failed to post journal under override'));
    }
  }

  async function onSubmitRequest() {
    const r = reason.trim();
    const j = justification.trim();
    if (r.length < 3) {
      setError('Reason is required (minimum 3 characters).');
      return;
    }
    if (j.length < 3) {
      setError('Justification is required (minimum 3 characters).');
      return;
    }
    if (!evidenceFile) {
      setError('Supporting evidence is required for a governance override.');
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await uploadAuditEvidence({
        entityType: 'JOURNAL_ENTRY',
        entityId: props.journal.id,
        file: evidenceFile,
      });

      const session = await createOverrideSession({
        overrideCode: requirement.overrideCode,
        entryPoint: requirement.entryPoint,
        reason: r,
        justification: j,
        expiresAt: isoPlusHours(24),
        escalationType: requirement.code,
        escalationReason: r,
        entityType: 'JOURNAL_ENTRY',
        entityId: props.journal.id,
      });

      setActiveSession(session);
      setPhase('awaiting_approval');
      setInfo('Override request created and routed for secondary approval.');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to create override request'));
    } finally {
      setBusy(false);
    }
  }

  async function onRefreshApproval() {
    if (!activeSession) return;
    setBusy(true);
    setError(null);
    try {
      const latest = await getOverrideSession(activeSession.id);
      setActiveSession(latest);
      if (latest.status === 'REJECTED') {
        setError('This override request was rejected by the approver.');
      } else if (latest.status === 'REVOKED') {
        setError('This override request was revoked.');
      } else if (latest.status === 'EXPIRED') {
        setError('This override request has expired. Create a new request.');
      } else if (latest.status !== 'APPROVED') {
        setInfo('Still awaiting secondary approval.');
      } else {
        setInfo('Override approved. You can now post the journal.');
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to refresh override status'));
    } finally {
      setBusy(false);
    }
  }

  async function onPostWithOverride() {
    if (!activeSession || activeSession.status !== 'APPROVED') return;
    const slot = slotForOverrideCode(activeSession.overrideCode);
    if (!slot) {
      setError(`Unsupported override code: ${activeSession.overrideCode}`);
      return;
    }
    const next: ApprovedSessions = { ...sessions, [slot]: activeSession };
    setSessions(next);

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await attemptPostWith(next);
    } finally {
      setBusy(false);
    }
  }

  const approved = activeSession?.status === 'APPROVED';

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(11,12,30,0.52)', zIndex: 80 }}
        onClick={() => {
          if (busy) return;
          props.onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '12vh',
          left: '50%',
          transform: 'translate(-50%, 0)',
          width: 'min(680px, calc(100vw - 32px))',
          maxHeight: '80vh',
          overflowY: 'auto',
          background: tokens.colors.white,
          borderRadius: 12,
          border: `1px solid ${tokens.colors.border.subtle}`,
          boxShadow: '0 18px 80px rgba(11,12,30,0.28)',
          zIndex: 81,
          padding: 18,
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 850, fontSize: 16 }}>{requirementTitle(requirement)}</div>
        <div style={{ fontSize: 13, color: tokens.colors.text.secondary }}>
          Journal {journalLabel}
        </div>
        {requirement.reason ? (
          <div
            style={{
              fontSize: 12,
              lineHeight: '18px',
              color: tokens.colors.text.secondary,
              background: tokens.colors.surface.subtle,
              border: `1px solid ${tokens.colors.border.subtle}`,
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            {requirement.reason}
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              fontSize: 13,
              color: '#991b1b',
              background: '#fee2e2',
              border: '1px solid rgba(153,27,27,0.25)',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            {error}
          </div>
        ) : null}
        {info && !error ? (
          <div
            style={{
              fontSize: 13,
              color: '#166534',
              background: '#e7f6ec',
              border: '1px solid rgba(22,101,52,0.2)',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            {info}
          </div>
        ) : null}

        {phase === 'request' ? (
          <>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Reason *
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
                placeholder="e.g. Month-end late adjustment"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tokens.colors.border.default}` }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Justification *
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
                disabled={busy}
                placeholder="Explain why this back-dated / closed-period posting is required"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tokens.colors.border.default}` }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Supporting evidence *
              <input
                type="file"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                disabled={busy}
                style={{ fontSize: 13 }}
              />
              <span style={{ fontSize: 12, color: tokens.colors.text.muted }}>
                Required by governance. Attached to the journal audit trail.
              </span>
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button size="sm" variant="secondary" onClick={props.onClose} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" variant="accent" onClick={onSubmitRequest} disabled={busy}>
                {busy ? 'Submitting…' : 'Submit override request'}
              </Button>
            </div>
          </>
        ) : null}

        {phase === 'awaiting_approval' && activeSession ? (
          <>
            <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              <div>
                <strong>Override code:</strong> {activeSession.overrideCode}
              </div>
              <div>
                <strong>Session:</strong> {activeSession.id}
              </div>
              <div>
                <strong>Status:</strong>{' '}
                <span style={{ fontWeight: 750 }}>{activeSession.status}</span>
              </div>
            </div>
            <div style={{ fontSize: 12, lineHeight: '18px', color: tokens.colors.text.secondary }}>
              This request must be approved by a second authorised governance approver. Approvals are
              managed on the{' '}
              <Link to="/settings/governance/override-sessions">Override Sessions</Link> page. Once
              approved, return here and post the journal.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button size="sm" variant="secondary" onClick={props.onClose} disabled={busy}>
                Close
              </Button>
              <Button size="sm" variant="secondary" onClick={onRefreshApproval} disabled={busy}>
                {busy ? 'Checking…' : 'Refresh status'}
              </Button>
              <Button size="sm" variant="accent" onClick={onPostWithOverride} disabled={busy || !approved}>
                {busy ? 'Posting…' : 'Post with approved override'}
              </Button>
            </div>
          </>
        ) : null}

        {phase === 'posted' ? (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button size="sm" variant="accent" onClick={props.onClose}>
              Done
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
