import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');

  const throughIdx = process.argv.findIndex((a) => a === '--through');
  const through = throughIdx >= 0 ? process.argv[throughIdx + 1] : undefined;
  if (!through) {
    throw new Error(
      'Usage: ts-node scripts/reconcile-migrations.ts --through <migration_folder_name>',
    );
  }

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Missing migrations directory: ${migrationsDir}`);
  }

  const migrationNames = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  const throughPos = migrationNames.indexOf(through);
  if (throughPos < 0) {
    throw new Error(
      `Cutoff migration '${through}' was not found in ${migrationsDir}.`,
    );
  }

  const toResolve = migrationNames.slice(0, throughPos + 1);

  const total = toResolve.length;
  let processed = 0;

  for (const name of toResolve) {
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
