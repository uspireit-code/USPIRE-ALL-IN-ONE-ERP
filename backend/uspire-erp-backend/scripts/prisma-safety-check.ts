/// <reference types="node" />

import * as fs from 'fs';
import * as path from 'path';

const FORBIDDEN_SQL = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+TYPE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bTRUNCATE\b/i,
];

const PROTECTED_OBJECTS = [
  'CustomerCreditNote',
  'CustomerRefund',
  'ArReminderRule',
  'ArReminderLog',
  'ArReminderTemplate',
  'AuditEvent',
  'JournalEntry',
  'JournalLine',
];

function listMigrationSqlFiles(params: {
  migrationsDir: string;
  onlyMigrationNames?: string[];
}): string[] {
  const { migrationsDir, onlyMigrationNames } = params;
  if (!fs.existsSync(migrationsDir)) return [];

  const allow =
    onlyMigrationNames && onlyMigrationNames.length > 0
      ? new Set(onlyMigrationNames)
      : null;

  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => (allow ? allow.has(d.name) : true))
    .map((d) => path.join(migrationsDir, d.name, 'migration.sql'))
    .filter((p) => fs.existsSync(p));
}

function scanSqlFile(filePath: string) {
  const sql = fs.readFileSync(filePath, 'utf8');

  for (const re of FORBIDDEN_SQL) {
    if (re.test(sql)) {
      throw new Error(
        `Unsafe migration detected. Forbidden SQL pattern ${re} found in ${filePath}. ` +
          `Database resets/destructive migrations are forbidden.`,
      );
    }
  }

  for (const name of PROTECTED_OBJECTS) {
    // Guard against attempts to drop protected business-critical objects.
    // Note: Prisma migration SQL varies in quoting and casing.
    const dropRe = new RegExp(
      `\\bDROP\\s+(TABLE|TYPE)\\s+(IF\\s+EXISTS\\s+)?("?${name}"?)\\b`,
      'i',
    );
    if (dropRe.test(sql)) {
      throw new Error(
        `Unsafe migration detected. Attempted DROP of protected object '${name}' in ${filePath}.`,
      );
    }
  }
}

export function prismaSafetyCheck(params: {
  migrationsDir?: string;
  argv?: string[];
  onlyMigrationNames?: string[];
  skipSqlScan?: boolean;
}) {
  const argv = params.argv ?? process.argv.slice(2);
  const joined = argv.join(' ').toLowerCase();

  if (joined.includes('migrate reset') || argv.includes('reset')) {
    throw new Error(
      'prisma migrate reset is forbidden. Database resets/destructive workflows are not allowed.',
    );
  }

  const migrationsDir =
    params.migrationsDir ?? path.join(process.cwd(), 'prisma', 'migrations');

  if (params.skipSqlScan) return;

  const migrationSqlFiles = listMigrationSqlFiles({
    migrationsDir,
    onlyMigrationNames: params.onlyMigrationNames,
  });
  for (const filePath of migrationSqlFiles) {
    scanSqlFile(filePath);
  }
}

if (require.main === module) {
  try {
    prismaSafetyCheck({});
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error(String(e?.message ?? e));
    process.exit(1);
  }
}
