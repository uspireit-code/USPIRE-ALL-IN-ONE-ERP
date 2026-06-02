export type JournalNavigationOrigin = 'review' | 'post' | 'browser' | null;

export type JournalRouteState = {
  journalId: string | null;
  isNew: boolean;
  readonly: boolean;
  origin: JournalNavigationOrigin;
  correctsJournalId: string | null;
};

export function buildJournalRouteState(params: {
  idParam: string | undefined;
  searchParams: URLSearchParams;
}): JournalRouteState {
  const rawId = (params.idParam ?? '').trim();
  const journalId = rawId ? rawId : null;

  const isNew = !journalId;

  const readonly = params.searchParams.get('readonly') === '1';

  const originRaw = (params.searchParams.get('from') ?? '').trim().toLowerCase();
  const origin: JournalNavigationOrigin =
    originRaw === 'review' ? 'review' : originRaw === 'post' ? 'post' : originRaw === 'browser' ? 'browser' : null;

  const correctsJournalId = (params.searchParams.get('correctsJournalId') ?? '').trim() || null;

  return {
    journalId,
    isNew,
    readonly,
    origin,
    correctsJournalId,
  };
}
