/// <reference types="node" />

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { prismaSafetyCheck } from './prisma-safety-check';

function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  });

  if (result.error) throw result.error;
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
}

function getLatestMigrationName(migrationsDir: string): string | null {
  if (!fs.existsSync(migrationsDir)) return null;
  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(migrationsDir, name, 'migration.sql')));
  if (dirs.length === 0) return null;

  dirs.sort((a, b) => a.localeCompare(b));
  return dirs[dirs.length - 1];
}

async function main() {
  const mode = String(process.argv[2] ?? '').trim();
  const passThroughArgs = process.argv.slice(3);
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');

  if (!mode || (mode !== 'create' && mode !== 'apply')) {
    throw new Error(
      'Usage: ts-node scripts/prisma-migrate-safe.ts <create|apply> [--name <name>]',
    );
  }

  const latestBefore = getLatestMigrationName(migrationsDir);

  if (mode === 'create') {
    prismaSafetyCheck({
      argv: ['migrate', 'dev', '--create-only', ...passThroughArgs],
      skipSqlScan: true,
    });
    run('npx', ['--no-install', 'prisma', 'migrate', 'dev', '--create-only', ...passThroughArgs]);

    const latestAfter = getLatestMigrationName(migrationsDir);
    if (latestAfter && latestAfter !== latestBefore) {
      prismaSafetyCheck({
        onlyMigrationNames: [latestAfter],
      });
    }

    return;
  }

  if (mode === 'apply') {
    const latest = getLatestMigrationName(migrationsDir);
    if (latest) {
      prismaSafetyCheck({
        argv: ['migrate', 'deploy'],
        onlyMigrationNames: [latest],
      });
    } else {
      prismaSafetyCheck({ argv: ['migrate', 'deploy'] });
    }

    run('npx', ['--no-install', 'prisma', 'migrate', 'deploy']);
    return;
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(String(e?.message ?? e));
  process.exit(1);
});
