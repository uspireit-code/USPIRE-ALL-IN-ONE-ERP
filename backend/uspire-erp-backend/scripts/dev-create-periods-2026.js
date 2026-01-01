/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TENANT_NAME = 'USPIRE Demo Tenant';

const DEFAULT_PERIOD_CLOSE_CHECKLIST_ITEMS = [
  { code: 'AP_REVIEWED', name: 'AP reviewed' },
  { code: 'AR_REVIEWED', name: 'AR reviewed' },
  { code: 'BANK_RECONCILED', name: 'Bank reconciled' },
] ;

const DEFAULT_ACCOUNTING_PERIOD_CHECKLIST_ITEMS = [
  { code: 'BANK_RECONCILIATION', label: 'Bank reconciliations completed and reviewed' },
  { code: 'AP_RECONCILIATION', label: 'AP subledger reconciled to GL' },
  { code: 'AR_RECONCILIATION', label: 'AR subledger reconciled to GL' },
  { code: 'GL_REVIEW', label: 'General ledger review completed (journals, accruals, reclasses)' },
  { code: 'REPORTING_PACKAGE', label: 'Financial statements generated and reviewed' },
] ;

function isoDateOnly(yyyyMmDd) {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

function periodSpec(name, start, end) {
  return { name, startDate: isoDateOnly(start), endDate: isoDateOnly(end) };
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { name: TENANT_NAME },
    select: { id: true, name: true, status: true },
  });

  if (!tenant) {
    throw new Error(`Tenant not found: ${TENANT_NAME}`);
  }

  console.log('TENANT:', tenant);

  const specs = [
    periodSpec('Jan 2026', '2026-01-01', '2026-01-31'),
    periodSpec('Feb 2026', '2026-02-01', '2026-02-28'),
    periodSpec('Mar 2026', '2026-03-01', '2026-03-31'),
    periodSpec('Apr 2026', '2026-04-01', '2026-04-30'),
    periodSpec('May 2026', '2026-05-01', '2026-05-31'),
    periodSpec('Jun 2026', '2026-06-01', '2026-06-30'),
    periodSpec('Jul 2026', '2026-07-01', '2026-07-31'),
    periodSpec('Aug 2026', '2026-08-01', '2026-08-31'),
    periodSpec('Sep 2026', '2026-09-01', '2026-09-30'),
    periodSpec('Oct 2026', '2026-10-01', '2026-10-31'),
    periodSpec('Nov 2026', '2026-11-01', '2026-11-30'),
    periodSpec('Dec 2026', '2026-12-01', '2026-12-31'),
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const s of specs) {
    const existingByName = await prisma.accountingPeriod.findFirst({
      where: { tenantId: tenant.id, name: s.name },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    if (existingByName) {
      skippedCount += 1;
      console.log(
        `SKIP (name exists): ${s.name} | existing=${existingByName.id} ${existingByName.startDate.toISOString().slice(0, 10)}→${existingByName.endDate.toISOString().slice(0, 10)}`,
      );
      continue;
    }

    const overlap = await prisma.accountingPeriod.findFirst({
      where: {
        tenantId: tenant.id,
        startDate: { lte: s.endDate },
        endDate: { gte: s.startDate },
      },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    if (overlap) {
      skippedCount += 1;
      console.log(
        `SKIP (overlap): ${s.name} ${s.startDate.toISOString().slice(0, 10)}→${s.endDate.toISOString().slice(0, 10)} overlaps ${overlap.name} (${overlap.id}) ${overlap.startDate.toISOString().slice(0, 10)}→${overlap.endDate.toISOString().slice(0, 10)}`,
      );
      continue;
    }

    const created = await prisma.$transaction(async (tx) => {
      const period = await tx.accountingPeriod.create({
        data: {
          tenantId: tenant.id,
          name: s.name,
          startDate: s.startDate,
          endDate: s.endDate,
          // status defaults to OPEN
        },
        select: { id: true, name: true, startDate: true, endDate: true, status: true },
      });

      const checklist = await tx.periodCloseChecklist.create({
        data: {
          tenantId: tenant.id,
          periodId: period.id,
        },
        select: { id: true },
      });

      await tx.periodCloseChecklistItem.createMany({
        data: DEFAULT_PERIOD_CLOSE_CHECKLIST_ITEMS.map((i) => ({
          tenantId: tenant.id,
          checklistId: checklist.id,
          code: i.code,
          name: i.name,
          status: 'PENDING',
        })),
        skipDuplicates: true,
      });

      await tx.accountingPeriodChecklistItem.createMany({
        data: DEFAULT_ACCOUNTING_PERIOD_CHECKLIST_ITEMS.map((i) => ({
          tenantId: tenant.id,
          periodId: period.id,
          code: i.code,
          label: i.label,
        })),
        skipDuplicates: true,
      });

      return period;
    });

    createdCount += 1;
    console.log(
      `CREATED: ${created.name} | ${created.startDate.toISOString().slice(0, 10)}→${created.endDate.toISOString().slice(0, 10)} | status=${created.status}`,
    );
  }

  console.log('\nDONE');
  console.log(`CREATED_COUNT: ${createdCount}`);
  console.log(`SKIPPED_COUNT: ${skippedCount}`);
}

main()
  .catch((e) => {
    console.error('FAILED:', e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
