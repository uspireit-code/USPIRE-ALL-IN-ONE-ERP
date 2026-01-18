const { PrismaClient } = require('@prisma/client');

const LOCK_ID = 72707369;

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT a.pid,
              a.usename,
              a.application_name,
              a.client_addr,
              a.state,
              a.query_start,
              left(a.query,200) AS query
       FROM pg_locks l
       JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE l.locktype = 'advisory'
         AND l.classid = 0
         AND l.objid = ${LOCK_ID};`,
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      // eslint-disable-next-line no-console
      console.log('No advisory lock holders found for', LOCK_ID);
      return;
    }

    // eslint-disable-next-line no-console
    console.log('Advisory lock holders:', rows);

    for (const r of rows) {
      const pid = Number(r.pid);
      if (!Number.isFinite(pid)) continue;

      // eslint-disable-next-line no-console
      console.log('Terminating PID', pid);

      const res = await prisma.$queryRawUnsafe(
        `SELECT pg_terminate_backend(${pid}) AS terminated;`,
      );

      // eslint-disable-next-line no-console
      console.log('Terminate result for PID', pid, ':', res);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
