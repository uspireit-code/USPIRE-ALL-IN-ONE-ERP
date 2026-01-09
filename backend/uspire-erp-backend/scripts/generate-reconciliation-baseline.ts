/// <reference types="node" />

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const migrationName = '20260109_reconciliation_baseline';
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const migrationSqlPath = path.join(
    process.cwd(),
    'prisma',
    'migrations',
    migrationName,
    'migration.sql',
  );

  fs.mkdirSync(path.dirname(migrationSqlPath), { recursive: true });

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Missing prisma schema: ${schemaPath}`);
  }

  // Generate SQL to create the *current* Prisma schema from an empty database.
  // This is non-destructive (CREATE-only) and becomes the new baseline.
  const result = (() => {
    const prismaEntry = path.join(
      process.cwd(),
      'node_modules',
      'prisma',
      'build',
      'index.js',
    );

    return spawnSync(
      process.execPath,
      [
        prismaEntry,
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema-datamodel',
        schemaPath,
        '--script',
      ],
      {
        stdio: 'pipe',
        shell: false,
        cwd: process.cwd(),
        encoding: 'utf8',
      } as any,
    );
  })();

  if (result.error) throw result.error;
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(result.stderr || `prisma migrate diff failed (code ${result.status})`);
  }

  const sql = String(result.stdout ?? '').trim();
  if (!sql) {
    throw new Error('Generated baseline SQL is empty. Aborting.');
  }

  const header = `-- Reconciliation baseline migration\n--\n-- Generated via: prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script\n--\n-- Governance: Database resets are forbidden. Forward-only migrations only.\n\n`;

  fs.writeFileSync(migrationSqlPath, header + sql + '\n', 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Wrote reconciliation baseline SQL to ${migrationSqlPath}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(String(e?.message ?? e));
  process.exit(1);
});
