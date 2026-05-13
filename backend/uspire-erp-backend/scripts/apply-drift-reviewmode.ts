import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  const statements: string[] = [
    // AuditEventType variants (idempotent)
    "ALTER TYPE \"AuditEventType\" ADD VALUE IF NOT EXISTS 'GL_JOURNAL_OVERRIDE_POSTED'",
    "ALTER TYPE \"AuditEventType\" ADD VALUE IF NOT EXISTS 'GL_JOURNAL_SOD_VIOLATION_BLOCKED'",
    "ALTER TYPE \"AuditEventType\" ADD VALUE IF NOT EXISTS 'GL_JOURNAL_SYSTEM_REVIEWED'",
    "ALTER TYPE \"AuditEventType\" ADD VALUE IF NOT EXISTS 'GL_LIFECYCLE_BYPASS_BLOCKED'",

    // JournalReviewMode type (idempotent)
    "DO $$ BEGIN CREATE TYPE \"JournalReviewMode\" AS ENUM ('MANUAL_REVIEW', 'SYSTEM_REVIEW', 'OVERRIDE_REVIEW'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;",

    // Column add (idempotent)
    'ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "reviewMode" "JournalReviewMode"',
  ];

  try {
    for (const sql of statements) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (e: any) {
        // If the enum type doesn't exist at all (highly unlikely here) or statement is incompatible,
        // surface the error so we don't silently skip required schema repairs.
        // eslint-disable-next-line no-console
        console.error('Failed SQL:', sql);
        throw e;
      }
    }

    // eslint-disable-next-line no-console
    console.log('Drift patch applied successfully');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
