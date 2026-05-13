import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const dbInfo = (await prisma.$queryRawUnsafe(
      "SELECT current_database() as db, current_schema() as schema",
    )) as any;

    const col = (await prisma.$queryRawUnsafe(
      "SELECT column_name, data_type, udt_name, is_nullable " +
        "FROM information_schema.columns " +
        "WHERE table_schema = 'public' AND table_name = 'JournalEntry' AND column_name = 'reviewMode'",
    )) as any;

    const type = (await prisma.$queryRawUnsafe(
      "SELECT t.typname as enum_name " +
        "FROM pg_type t " +
        "WHERE t.typname = 'JournalReviewMode'",
    )) as any;

    const mig = (await prisma.$queryRawUnsafe(
      "SELECT migration_name, finished_at, applied_steps_count, rolled_back_at " +
        "FROM _prisma_migrations " +
        "WHERE migration_name = '20260508101000_journal_review_mode_and_lifecycle_audit'",
    )) as any;

    console.log(JSON.stringify({ dbInfo, reviewModeColumn: col, journalReviewModeType: type, migrationRow: mig }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
