const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT migration_name, finished_at, rolled_back_at FROM \"_prisma_migrations\" WHERE migration_name LIKE '%BANK_RECON_MATCHING_ENGINE%' ORDER BY migration_name;",
    );
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
