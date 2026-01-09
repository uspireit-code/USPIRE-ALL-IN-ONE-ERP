import { Prisma, PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

async function tableExists(): Promise<boolean> {
  const rows = (await prisma.$queryRaw(
    Prisma.sql`SELECT to_regclass('public."_prisma_migrations"')::text AS regclass;`,
  )) as Array<{ regclass: string | null }>;

  return Boolean(rows?.[0]?.regclass);
}

function sha256FileHex(path: string): string {
  const buf = fs.readFileSync(path);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function createLedgerTable() {
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS public."_prisma_migrations" (
  id                      TEXT PRIMARY KEY,
  checksum                TEXT NOT NULL,
  finished_at             TIMESTAMPTZ,
  migration_name          TEXT NOT NULL,
  logs                    TEXT,
  rolled_back_at          TIMESTAMPTZ,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_steps_count     INTEGER NOT NULL DEFAULT 0
);
`);

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "_prisma_migrations_migration_name_key" ON public."_prisma_migrations"(migration_name);`,
  );
}

async function upsertBaselineRow(opts: { migrationName: string; checksum: string }) {
  const existing = (await prisma.$queryRaw(
    Prisma.sql`SELECT id, checksum FROM public."_prisma_migrations" WHERE migration_name = ${opts.migrationName}`,
  )) as Array<{ id: string; checksum: string }>;

  if (existing.length === 0) {
    await prisma.$executeRaw(
      Prisma.sql`INSERT INTO public."_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
                 VALUES (${randomUUID()}, ${opts.checksum}, ${opts.migrationName}, now(), now(), 1)`,
    );
    return;
  }

  if (existing[0].checksum !== opts.checksum) {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE public."_prisma_migrations" SET checksum = ${opts.checksum} WHERE migration_name = ${opts.migrationName}`,
    );
  }
}

async function main() {
  const migrationName = '20260109_reconciliation_baseline';
  const migrationPath = 'prisma/migrations/20260109_reconciliation_baseline/migration.sql';

  const fileChecksum = sha256FileHex(migrationPath);

  const requestedChecksum = '4C4D49273DEA78376B33E4EF713847B3A6A178994326C91E374';
  const checksum = fileChecksum;
  if (requestedChecksum.length !== 64) {
    console.log(`Requested checksum is not 64-hex; using file SHA256 checksum instead: ${checksum}`);
  }

  const exists = await tableExists();
  if (!exists) {
    await createLedgerTable();
  }

  await upsertBaselineRow({ migrationName, checksum });

  console.log('Prisma migration ledger repaired successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
