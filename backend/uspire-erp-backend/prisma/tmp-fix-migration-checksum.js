const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const migrationName = '20260121211906_BANK_RECON_MATCHING_ENGINE';
    const migrationSqlPath = path.join(__dirname, 'migrations', migrationName, 'migration.sql');
    const sql = fs.readFileSync(migrationSqlPath);
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    const rows = await prisma.$queryRawUnsafe(
      `SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name = '${migrationName}'`,
    );

    console.log('Before:', JSON.stringify(rows, null, 2));

    const updated = await prisma.$executeRawUnsafe(
      `UPDATE "_prisma_migrations" SET checksum = '${checksum}' WHERE migration_name = '${migrationName}'`,
    );

    const rowsAfter = await prisma.$queryRawUnsafe(
      `SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name = '${migrationName}'`,
    );

    console.log('UpdatedRows:', updated);
    console.log('After:', JSON.stringify(rowsAfter, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
