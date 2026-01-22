import { apiFetch } from './api';

export type GlobalSearchResultType = 'ROUTE' | 'JOURNAL' | 'BANK_STATEMENT' | 'IMPREST';

export type GlobalSearchResultItem = {
  type: GlobalSearchResultType;
  label: string;
  targetUrl: string;
};

export type GlobalSearchResponse = {
  q: string;
  results: GlobalSearchResultItem[];
};

export function globalSearch(q: string) {
  return apiFetch<GlobalSearchResponse>(`/search?q=${encodeURIComponent(q)}`, { method: 'GET' });
}
