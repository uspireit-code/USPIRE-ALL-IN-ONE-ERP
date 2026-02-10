import { useMemo, useState } from 'react';
import { tokens } from '../designTokens';
import { getApiErrorMessage } from '../services/api';
import type { JournalDetailResponse } from '../services/gl';
import {
  postJournal,
  returnJournalToReview,
  reviewJournal,
  submitJournal,
} from '../services/gl';

export function JournalActionBar(props: {
  journal: JournalDetailResponse;
  realUserId: string;
  actingUserId?: string;
  canCreate: boolean;
  canApprove: boolean;
  canPost: boolean;
  onJournalUpdated: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmPostOpen, setConfirmPostOpen] = useState(false);
  const [confirmReturnOpen, setConfirmReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  const status = props.journal.status;
  const creatorId = props.journal.createdBy?.id ?? null;
  const reviewerId = props.journal.reviewedBy?.id ?? null;
  const periodStatus = props.journal.period?.status ?? null;

  const actorId = props.actingUserId ?? props.realUserId;

  const isCreator = creatorId === props.realUserId;
  const isReviewer = reviewerId === actorId;

  const blockedByClosedPeriod = periodStatus === 'CLOSED';

  const budgetStatus = String((props.journal as any).budgetStatus ?? 'OK').toUpperCase();
  const budgetJustification = String((props.journal as any).budgetOverrideJustification ?? '').trim();
  const budgetWarnNeedsJustification = budgetStatus === 'WARN' && !budgetJustification;
  const budgetBlock = budgetStatus === 'BLOCK';

  const canSubmit =
    props.canCreate &&
    status === 'DRAFT' &&
    isCreator &&
    !blockedByClosedPeriod;

  const canReview =
    props.canApprove &&
    status === 'SUBMITTED' &&
    !isCreator &&
    !blockedByClosedPeriod;

  const canPostAction =
    props.canPost &&
    status === 'REVIEWED' &&
    !isCreator &&
    !isReviewer &&
    !blockedByClosedPeriod;

  const infoMessage = useMemo(() => {
    if (blockedByClosedPeriod) {
      return 'This journal belongs to a CLOSED accounting period and cannot be modified.';
    }

    if (budgetWarnNeedsJustification) {
      return 'Budget status is WARN. Provide a budget exception justification before Submit or Review.';
    }

    if (budgetBlock) {
      return 'Budget status is BLOCK. Posting is not permitted until the journal is adjusted.';
    }

    if (status === 'DRAFT' && props.canCreate && !isCreator) {
      return 'Only the creator can submit this journal for review.';
    }

    if (status === 'SUBMITTED' && props.canApprove && isCreator) {
      return 'You cannot review this journal because you prepared it.';
    }

    if (status === 'REVIEWED' && props.canPost && (isCreator || isReviewer)) {
      return 'You cannot post this journal because you prepared or reviewed it.';
    }

    return null;
  }, [blockedByClosedPeriod, budgetBlock, budgetWarnNeedsJustification, isCreator, isReviewer, props.canApprove, props.canCreate, props.canPost, status]);

  async function wrap(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    props.onError('');
    try {
      await action();
      await props.onJournalUpdated();
    } catch (e: any) {
      const statusCode = (e as any)?.status;
      const body = (e as any)?.body;
      const msgFromBody =
        body && typeof body === 'object'
          ? typeof body.error === 'string'
            ? body.error
            : typeof body.message === 'string'
              ? body.message
              : typeof body.reason === 'string'
                ? body.reason
                : null
          : null;

      if (statusCode === 403) {
        props.onError(msgFromBody ?? 'This action is blocked by finance controls.');
        return;
      }

      props.onError(msgFromBody ?? getApiErrorMessage(e, fallback));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
      {infoMessage ? (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: tokens.colors.surface.subtle,
            border: `1px solid ${tokens.colors.border.subtle}`,
            color: tokens.colors.text.primary,
            fontSize: 13,
            fontWeight: 650,
            maxWidth: 820,
          }}
        >
          {infoMessage}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {canSubmit ? (
          <button
            onClick={() => wrap(() => submitJournal(props.journal.id), 'Failed to submit journal')}
            disabled={busy || budgetWarnNeedsJustification}
          >
            {busy ? 'Submitting…' : 'Submit for Review'}
          </button>
        ) : null}

        {canReview ? (
          <button
            onClick={() => wrap(() => reviewJournal(props.journal.id), 'Failed to review journal')}
            disabled={busy || budgetWarnNeedsJustification}
          >
            {busy ? 'Reviewing…' : 'Review'}
          </button>
        ) : null}

        {canPostAction ? (
          <>
            <button onClick={() => setConfirmPostOpen(true)} disabled={busy || budgetBlock}>
              Post
            </button>
            <button
              onClick={() => {
                setReturnReason('');
                setConfirmReturnOpen(true);
              }}
              disabled={busy}
              style={{ background: tokens.colors.surface.subtle, border: `1px solid ${tokens.colors.border.subtle}` }}
            >
              Return to Review
            </button>
          </>
        ) : null}
      </div>

      {confirmPostOpen ? (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11,12,30,0.52)',
              zIndex: 70,
            }}
            onClick={() => {
              if (busy) return;
              setConfirmPostOpen(false);
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
            <div style={{ fontWeight: 850, fontSize: 16 }}>Confirm Posting</div>
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>
              Posting will permanently record this journal to the ledger. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  if (busy) return;
                  setConfirmPostOpen(false);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  wrap(() => postJournal(props.journal.id), 'Failed to post journal').finally(() => setConfirmPostOpen(false))
                }
                disabled={busy}
                style={{ fontWeight: 750 }}
              >
                {busy ? 'Posting…' : 'Confirm Post'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {confirmReturnOpen ? (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11,12,30,0.52)',
              zIndex: 70,
            }}
            onClick={() => {
              if (busy) return;
              setConfirmReturnOpen(false);
              setReturnReason('');
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: '16vh',
              left: '50%',
              transform: 'translate(-50%, 0)',
              width: 'min(700px, calc(100vw - 32px))',
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
            <div style={{ fontWeight: 850, fontSize: 16 }}>Return to Review</div>
            <div style={{ fontSize: 13, color: tokens.colors.text.muted }}>
              This will return the journal to Review. The reviewer must approve again before posting.
            </div>

            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Reason for returning to review *
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={4}
                style={{ width: '100%' }}
                disabled={busy}
              />
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  if (busy) return;
                  setConfirmReturnOpen(false);
                  setReturnReason('');
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  wrap(
                    () => returnJournalToReview(props.journal.id, returnReason.trim()),
                    'Failed to return journal to review',
                  ).finally(() => {
                    setConfirmReturnOpen(false);
                    setReturnReason('');
                  })
                }
                disabled={busy || !returnReason.trim()}
                style={{ fontWeight: 750 }}
              >
                {busy ? 'Returning…' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
