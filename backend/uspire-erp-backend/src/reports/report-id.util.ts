import { createHash } from 'crypto';

function stableStringify(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`,
  );
  return `{${entries.join(',')}}`;
}

export function buildDeterministicReportEntityId(params: {
  reportType: 'PL' | 'BS' | 'SOCE' | 'CF';
  from?: string;
  to?: string;
  compareFrom?: string;
  compareTo?: string;
  filters?: Record<string, any>;
}): { entityId: string; canonicalString: string; hash: string } {
  const canonical = [
    `reportType=${params.reportType}`,
    `from=${params.from ?? ''}`,
    `to=${params.to ?? ''}`,
    `compareFrom=${params.compareFrom ?? ''}`,
    `compareTo=${params.compareTo ?? ''}`,
    `filters=${stableStringify(params.filters ?? {})}`,
  ].join('\n');

  const hash = createHash('sha256').update(canonical).digest('hex');
  return {
    entityId: `${params.reportType}|${hash}`,
    canonicalString: canonical,
    hash,
  };
}
