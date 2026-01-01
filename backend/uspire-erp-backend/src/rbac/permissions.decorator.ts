import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const PermissionsAny = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, {
    mode: 'any' as const,
    permissions,
  });
