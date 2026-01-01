/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TENANT_NAME = 'USPIRE Demo Tenant';

const DEFAULT_PERIOD_CLOSE_CHECKLIST_ITEMS = [
  { code: 'AP_REVIEWED', name: 'AP reviewed' },
  { code: 'AR_REVIEWED', name: 'AR reviewed' },
  { code: 'BANK_RECONCILED', name: 'Bank reconciled' },
];

const DEFAULT_ACCOUNTING_PERIOD_CHECKLIST_ITEMS = [
  { code: 'BANK_RECONCILIATION', label: 'Bank reconciliations completed and reviewed' },
  { code: 'AP_RECONCILIATION', label: 'AP subledger reconciled to GL' },
  { code: 'AR_RECONCILIATION', label: 'AR subledger reconciled to GL' },
  { code: 'GL_REVIEW', label: 'General ledger review completed (journals, accruals, reclasses)' },
  { code: 'REPORTING_PACKAGE', label: 'Financial statements generated and reviewed' },
];

function isoDateOnly(yyyyMmDd) {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

function spec(name, start, end) {
  return { name, startDate: isoDateOnly(start), endDate: isoDateOnly(end) };
}

function sameUtcYyyyMmDd(a, b) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

async function deletePeriodWithChecklists(tx, tenantId, periodId) {
  await tx.accountingPeriodChecklistItem.deleteMany({ where: { tenantId, periodId } });

  const checklist = await tx.periodCloseChecklist.findFirst({
    where: { tenantId, periodId },
    select: { id: true },
  });

  if (checklist) {
    await tx.periodCloseChecklistItem.deleteMany({ where: { tenantId, checklistId: checklist.id } });
    await tx.periodCloseChecklist.deleteMany({ where: { tenantId, id: checklist.id } });
  }

  await tx.accountingPeriod.deleteMany({ where: { tenantId, id: periodId } });
}

async function createPeriodWithChecklists(tx, tenantId, s) {
  const period = await tx.accountingPeriod.create({
    data: {
      tenantId,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
    },
    select: { id: true, name: true, startDate: true, endDate: true, status: true },
  });

  const checklist = await tx.periodCloseChecklist.create({
    data: {
      tenantId,
      periodId: period.id,
    },
    select: { id: true },
  });

  await tx.periodCloseChecklistItem.createMany({
    data: DEFAULT_PERIOD_CLOSE_CHECKLIST_ITEMS.map((i) => ({
      tenantId,
      checklistId: checklist.id,
      code: i.code,
      name: i.name,
      status: 'PENDING',
    })),
    skipDuplicates: true,
  });

  await tx.accountingPeriodChecklistItem.createMany({
    data: DEFAULT_ACCOUNTING_PERIOD_CHECKLIST_ITEMS.map((i) => ({
      tenantId,
      periodId: period.id,
      code: i.code,
      label: i.label,
    })),
    skipDuplicates: true,
  });

  return period;
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { name: TENANT_NAME }, select: { id: true, name: true } });
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_NAME}`);

  console.log('TENANT:', tenant);

  const desired = [
    spec('Jan 2026', '2026-01-01', '2026-01-31'),
    spec('Feb 2026', '2026-02-01', '2026-02-28'),
    spec('Mar 2026', '2026-03-01', '2026-03-31'),
    spec('Apr 2026', '2026-04-01', '2026-04-30'),
    spec('May 2026', '2026-05-01', '2026-05-31'),
  ];

  const periodsToDeleteByName = ['VERIFY-20251216-092816', 'AUDIT-VERIFY-20251216-165910'];

  for (const name of periodsToDeleteByName) {
    const found = await prisma.accountingPeriod.findFirst({
      where: { tenantId: tenant.id, name },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    if (!found) {
      console.log(`SKIP (not found): delete ${name}`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await deletePeriodWithChecklists(tx, tenant.id, found.id);
    });

    console.log(
      `DELETED: ${found.name} | ${found.startDate.toISOString().slice(0, 10)}→${found.endDate.toISOString().slice(0, 10)} (${found.id})`,
    );
  }

  let renamed = 0;
  let created = 0;
  let skipped = 0;
  let blocked = 0;

  for (const d of desired) {
    const already = await prisma.accountingPeriod.findFirst({
      where: { tenantId: tenant.id, name: d.name },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    if (already) {
      skipped += 1;
      console.log(
        `SKIP (exists): ${d.name} | ${already.startDate.toISOString().slice(0, 10)}→${already.endDate.toISOString().slice(0, 10)} (${already.id})`,
      );
      continue;
    }

    // If a period fully covers the desired date-range, rename it to the canonical month label.
    // This is tolerant of time-of-day differences (e.g. endDate at 23:59:59Z).
    const covering = await prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        startDate: { lte: d.startDate },
        endDate: { gte: d.endDate },
      },
      select: { id: true, name: true, startDate: true, endDate: true },
      orderBy: { startDate: 'asc' },
    });

    if (covering && sameUtcYyyyMmDd(covering.startDate, d.startDate) && sameUtcYyyyMmDd(covering.endDate, d.endDate)) {
      await prisma.accountingPeriod.update({ where: { id: covering.id }, data: { name: d.name } });
      renamed += 1;
      console.log(
        `RENAMED: ${covering.name} -> ${d.name} | ${covering.startDate.toISOString().slice(0, 10)}→${covering.endDate.toISOString().slice(0, 10)} (${covering.id})`,
      );
      continue;
    }

    // Special-case: allow Jan 2026 as Jan 2–31 if Opening Balances occupies Jan 1.
    if (d.name === 'Jan 2026') {
      const janAlt = spec('Jan 2026', '2026-01-02', '2026-01-31');

      const overlap = await prisma.accountingPeriod.findFirst({
        where: {
          tenantId: tenant.id,
          startDate: { lte: janAlt.endDate },
          endDate: { gte: janAlt.startDate },
        },
        select: { id: true, name: true, startDate: true, endDate: true },
      });

      if (overlap) {
        blocked += 1;
        console.log(
          `BLOCKED (overlap): ${janAlt.name} ${janAlt.startDate.toISOString().slice(0, 10)}→${janAlt.endDate
            .toISOString()
            .slice(0, 10)} overlaps ${overlap.name} (${overlap.id}) ${overlap.startDate.toISOString().slice(0, 10)}→${overlap.endDate
            .toISOString()
            .slice(0, 10)}`,
        );
        continue;
      }

      const createdPeriod = await prisma.accountingPeriod.create({
        data: {
          tenantId: tenant.id,
          name: janAlt.name,
          startDate: janAlt.startDate,
          endDate: janAlt.endDate,
        },
        select: { id: true, name: true, startDate: true, endDate: true, status: true },
      });

      created += 1;
      console.log(
        `CREATED: ${createdPeriod.name} | ${createdPeriod.startDate.toISOString().slice(0, 10)}→${createdPeriod.endDate
          .toISOString()
          .slice(0, 10)} | status=${createdPeriod.status} (${createdPeriod.id})`,
      );
      continue;
    }

    // Otherwise, we refuse to create any overlapping periods.
    const overlap = await prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        startDate: { lte: d.endDate },
        endDate: { gte: d.startDate },
      },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    if (overlap) {
      blocked += 1;
      console.log(
        `BLOCKED (overlap): ${d.name} ${d.startDate.toISOString().slice(0, 10)}→${d.endDate.toISOString().slice(0, 10)} overlaps ${overlap.name} (${overlap.id}) ${overlap.startDate.toISOString().slice(0, 10)}→${overlap.endDate.toISOString().slice(0, 10)}`,
      );
      continue;
    }

    const createdPeriod = await prisma.$transaction(async (tx) => {
      return createPeriodWithChecklists(tx, tenant.id, d);
    });

    created += 1;
    console.log(
      `CREATED: ${createdPeriod.name} | ${createdPeriod.startDate.toISOString().slice(0, 10)}→${createdPeriod.endDate
        .toISOString()
        .slice(0, 10)} | status=${createdPeriod.status} (${createdPeriod.id})`,
    );
  }

  console.log('\nDONE');
  console.log(`RENAMED_COUNT: ${renamed}`);
  console.log(`CREATED_COUNT: ${created}`);
  console.log(`SKIPPED_COUNT: ${skipped}`);
  console.log(`BLOCKED_COUNT: ${blocked}`);
}

main()
  .catch((e) => {
    console.error('FAILED:', e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma['$disconnect']();
  });
