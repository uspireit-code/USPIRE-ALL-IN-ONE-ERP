const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const db = await prisma.$queryRawUnsafe(
      'SELECT current_database() AS db, current_schema() AS schema',
    );
    const cols = await prisma.$queryRawUnsafe(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'CustomerCreditNote' ORDER BY ordinal_position",
    );
    console.log(JSON.stringify({ db: db[0], columns: cols }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
