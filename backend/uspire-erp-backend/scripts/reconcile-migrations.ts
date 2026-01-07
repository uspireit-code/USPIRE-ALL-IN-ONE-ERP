import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Missing migrations directory: ${migrationsDir}`);
  }

  const migrationNames = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  const total = migrationNames.length;
  let processed = 0;

  for (const name of migrationNames) {
    processed++;

    const result = spawnSync(
      'npx',
      ['--no-install', 'prisma', 'migrate', 'resolve', '--applied', name],
      {
        stdio: 'ignore',
        shell: true,
        cwd: process.cwd(),
      },
    );

    // Idempotent: resolve may fail if already applied (P3008), but we keep going.
    // Suppress output; progress is reported below.
    if (processed % 10 === 0 || processed === total) {
      console.log(`Resolved ${processed}/${total}`);
    }

    // If npx itself fails catastrophically, stop.
    if (result.error) {
      throw result.error;
    }
  }

  console.log('Migration reconcile complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => undefined);
