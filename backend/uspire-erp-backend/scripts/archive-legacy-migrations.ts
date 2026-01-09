/// <reference types="node" />

import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
  const legacyDir = path.join(process.cwd(), 'prisma', 'migrations_legacy');

  const baselinePrefix = '20260109_reconciliation_baseline';

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Missing migrations directory: ${migrationsDir}`);
  }

  if (!fs.existsSync(legacyDir)) {
    fs.mkdirSync(legacyDir, { recursive: true });
  }

  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const name of dirs) {
    if (name === baselinePrefix) continue;

    const from = path.join(migrationsDir, name);
    const to = path.join(legacyDir, name);

    if (fs.existsSync(to)) continue;

    fs.renameSync(from, to);
    // eslint-disable-next-line no-console
    console.log(`Archived migration: ${name}`);
  }

  // eslint-disable-next-line no-console
  console.log('Migration archive complete.');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(String(e?.message ?? e));
  process.exit(1);
});
