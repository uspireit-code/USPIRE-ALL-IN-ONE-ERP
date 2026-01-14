import { PrismaClient } from '@prisma/client';

import { PERMISSIONS } from '../src/rbac/permission-catalog';

const prisma = new PrismaClient();

type ProcessLike = {
  exit(code?: number): never;
};

declare const process: ProcessLike;

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

function sorted(values: Iterable<string>) {
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

async function main() {
  const catalogCodes = new Set<string>();
  flattenPermissionValues(PERMISSIONS, catalogCodes);

  const dbPermissions = await prisma.permission.findMany({
    select: { code: true },
  });

  const dbCodes = new Set(dbPermissions.map((p) => p.code));

  const missingInDb = sorted(Array.from(catalogCodes).filter((c) => !dbCodes.has(c)));
  const missingInCatalog = sorted(Array.from(dbCodes).filter((c) => !catalogCodes.has(c)));

  if (missingInDb.length === 0 && missingInCatalog.length === 0) {
    console.log('[verify-permission-catalog] OK: Catalog and DB are consistent.');
    return;
  }

  if (missingInDb.length > 0) {
    console.error('[verify-permission-catalog] Catalog codes missing in DB:');
    for (const c of missingInDb) console.error(`- ${c}`);
  }

  if (missingInCatalog.length > 0) {
    console.error('[verify-permission-catalog] DB permission codes missing in catalog:');
    for (const c of missingInCatalog) console.error(`- ${c}`);
  }

  console.error('[verify-permission-catalog] FAILED');
  process.exit(1);
}

main()
  .catch((e) => {
    console.error('[verify-permission-catalog] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
