import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

function sanitizeDatabaseUrl(raw: string) {
  try {
    const u = new URL(raw);
    const dbName = (u.pathname ?? '').replace(/^\//, '');
    return {
      ok: true as const,
      protocol: u.protocol.replace(/:$/, ''),
      host: u.hostname,
      port: u.port || '(default)',
      user: u.username || '(none)',
      db: dbName || '(unknown)',
      schema: u.searchParams.get('schema') || 'public',
    };
  } catch {
    return { ok: false as const };
  }
}

async function main() {
  const raw = String(process.env.DATABASE_URL ?? '').trim();
  if (!raw) {
    console.error('[DB CHECK] DATABASE_URL is not set');
    process.exit(1);
  }

  const parsed = sanitizeDatabaseUrl(raw);
  if (!parsed.ok) {
    console.error('[DB CHECK] DATABASE_URL is not a valid URL');
    process.exit(1);
  }

  console.log(
    `[DB CHECK] Target ${parsed.host}:${parsed.port} db=${parsed.db} schema=${parsed.schema} user=${parsed.user}`,
  );

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('[DB CHECK] ✅ Connection succeeded (SELECT 1)');
  } catch (err: any) {
    const code = String(err?.code ?? '').trim();
    const name = String(err?.name ?? '').trim();
    const msg = String(err?.message ?? '').trim();

    console.error('[DB CHECK] ❌ Connection failed');
    console.error(`[DB CHECK] Error name=${name || 'Unknown'} code=${code || 'N/A'}`);

    if (code === 'P1000') {
      console.error('[DB CHECK] Cause: invalid username/password for the target database server.');
      console.error(
        '[DB CHECK] Fix: update DATABASE_URL credentials or reset the role password in Postgres (do not drop data).',
      );
    } else if (code === 'P1001') {
      console.error('[DB CHECK] Cause: cannot reach database server (host/port).');
      console.error('[DB CHECK] Fix: start Postgres and verify the port in DATABASE_URL.');
    } else if (code === 'P1010') {
      console.error('[DB CHECK] Cause: the database user is not permitted to access the database.');
      console.error('[DB CHECK] Fix: grant privileges or use a role with access.');
    }

    console.error(`[DB CHECK] Message: ${msg.split('\n').slice(0, 6).join(' | ')}`);
    process.exit(2);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((e) => {
  console.error('[DB CHECK] Unexpected error', e);
  process.exit(99);
});
