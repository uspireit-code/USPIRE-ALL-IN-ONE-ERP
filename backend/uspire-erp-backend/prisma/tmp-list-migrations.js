const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query(
    "SELECT migration_name, finished_at, rolled_back_at FROM \"_prisma_migrations\" WHERE migration_name LIKE '%BANK_RECON_MATCHING_ENGINE%' ORDER BY migration_name;",
  );
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
