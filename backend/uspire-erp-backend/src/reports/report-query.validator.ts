import { BadRequestException } from '@nestjs/common';

const EXPLICITLY_UNSUPPORTED_DIMENSION_FIELDS = [
  'costCentreId',
  'costCenterId',
  'departmentId',
];

export function assertNoUnsupportedDimensions(
  query: Record<string, any>,
  allowedKeys: string[],
) {
  if (!query) return;

  for (const f of EXPLICITLY_UNSUPPORTED_DIMENSION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(query, f)) {
      throw new BadRequestException(
        `Unsupported filter: ${f} (dimension not present on postings)`,
      );
    }
  }

  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(query)) {
    if (allowed.has(key)) continue;

    // Only treat unknown *Id keys as dimensions (safe default) and reject explicitly.
    if (/Id$/.test(key)) {
      throw new BadRequestException(
        `Unsupported filter: ${key} (dimension not present on postings)`,
      );
    }
  }
}
