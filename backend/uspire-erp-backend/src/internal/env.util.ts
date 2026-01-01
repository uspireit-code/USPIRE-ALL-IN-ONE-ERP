export function isTruthyEnv(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  )
    return true;
  if (
    normalized === '0' ||
    normalized === 'false' ||
    normalized === 'no' ||
    normalized === 'off'
  )
    return false;
  return defaultValue;
}

export function getFirstEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const v = process.env[key];
    if (v !== undefined && v !== '') return v;
  }
  return undefined;
}
