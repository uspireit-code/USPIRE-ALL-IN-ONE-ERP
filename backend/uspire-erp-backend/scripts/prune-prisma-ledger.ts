/// <reference types="node" />

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const keep = String(process.argv[2] ?? '').trim();
  if (!keep) {
    throw new Error(
      'Usage: ts-node scripts/prune-prisma-ledger.ts <migration_name_to_keep>',
    );
  }

  // Ensure the ledger exists; if it doesn't, nothing to prune.
  const exists = (await prisma.$queryRaw(
    Prisma.sql`SELECT to_regclass('public."_prisma_migrations"')::text AS regclass;`,
  )) as Array<{ regclass: string | null }>;

  if (!exists?.[0]?.regclass) {
    console.log('No _prisma_migrations table found; nothing to prune.');
    return;
  }

  const before = (await prisma.$queryRaw(
    Prisma.sql`SELECT COUNT(*)::int AS c FROM public."_prisma_migrations";`,
  )) as Array<{ c: number }>;

  await prisma.$executeRaw(
    Prisma.sql`DELETE FROM public."_prisma_migrations" WHERE migration_name <> ${keep};`,
  );

  const after = (await prisma.$queryRaw(
    Prisma.sql`SELECT COUNT(*)::int AS c FROM public."_prisma_migrations";`,
  )) as Array<{ c: number }>;

  console.log(
    `Pruned _prisma_migrations rows. Before=${before?.[0]?.c ?? 0} After=${after?.[0]?.c ?? 0}. Kept='${keep}'.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
