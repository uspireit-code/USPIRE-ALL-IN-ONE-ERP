import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS } from './permission-catalog';

export const PERMISSIONS_KEY = 'permissions';

function flattenPermissionValues(node: unknown, out: Set<string>) {
  if (typeof node === 'string') {
    out.add(node);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const v of Object.values(node as Record<string, unknown>)) {
    flattenPermissionValues(v, out);
  }
}

const CATALOG_PERMISSION_CODES = new Set<string>();
flattenPermissionValues(PERMISSIONS, CATALOG_PERMISSION_CODES);

function validatePermissionCodes(permissions: string[]) {
  if (process.env.ENFORCE_PERMISSION_CATALOG !== 'true') return;
  for (const p of permissions) {
    if (!CATALOG_PERMISSION_CODES.has(p)) {
      throw new Error(
        `Non-catalog permission code used in @Permissions decorator: ${p}`,
      );
    }
  }
}

export const Permissions = (...permissions: string[]) => {
  validatePermissionCodes(permissions);
  return SetMetadata(PERMISSIONS_KEY, permissions);
};

export const PermissionsAny = (...permissions: string[]) => {
  validatePermissionCodes(permissions);
  return SetMetadata(PERMISSIONS_KEY, {
    mode: 'any' as const,
    permissions,
  });
};
