import { apiFetch } from './api';
import type { CoaHealthResponse } from './coa';

export type { CoaHealthResponse };

export async function getCoaHealth(): Promise<CoaHealthResponse> {
  return apiFetch<CoaHealthResponse>('/finance/coa/health', { method: 'GET' });
}
