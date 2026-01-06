import { PrismaClient, type InvoiceType } from '@prisma/client';

const prisma = new PrismaClient();

type DefaultCategorySeed = {
  code: string;
  name: string;
  invoiceType: InvoiceType;
  revenueAccountCode: string;
  requiresProject: boolean;
  requiresFund: boolean;
  requiresDepartment: boolean;
};

const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  {
    code: 'TRAINING',
    name: 'Training',
    invoiceType: 'TRAINING',
    revenueAccountCode: '40160',
    requiresProject: true,
    requiresFund: false,
    requiresDepartment: false,
  },
  {
    code: 'CONSULTING',
    name: 'Consulting',
    invoiceType: 'CONSULTING',
    revenueAccountCode: '40120',
    requiresProject: true,
    requiresFund: false,
    requiresDepartment: false,
  },
  {
    code: 'SYSTEMS',
    name: 'Systems',
    invoiceType: 'SYSTEMS',
    revenueAccountCode: '40180',
    requiresProject: true,
    requiresFund: false,
    requiresDepartment: false,
  },
  {
    code: 'PUBLISHING',
    name: 'Publishing',
    invoiceType: 'PUBLISHING',
    revenueAccountCode: '40200',
    requiresProject: false,
    requiresFund: false,
    requiresDepartment: false,
  },
  {
    code: 'DONATION',
    name: 'Donation',
    invoiceType: 'DONATION',
    revenueAccountCode: '70140',
    requiresProject: false,
    requiresFund: false,
    requiresDepartment: false,
  },
  {
    code: 'OTHER',
    name: 'Other',
    invoiceType: 'OTHER',
    revenueAccountCode: '40200',
    requiresProject: false,
    requiresFund: false,
    requiresDepartment: false,
  },
];

async function upsertCategoriesForTenant(tenantId: string) {
  const createdOrUpdated: Array<{ code: string; id: string; revenueAccountId: string }>=[];
  const skipped: Array<{ code: string; reason: string }>=[];

  for (const c of DEFAULT_CATEGORIES) {
    const revenueAccount = await prisma.account.findFirst({
      where: {
        tenantId,
        code: c.revenueAccountCode,
        isActive: true,
        type: 'INCOME',
      },
      select: { id: true, code: true },
    });

    if (!revenueAccount) {
      skipped.push({
        code: c.code,
        reason: `Revenue account not found/active/INCOME for code=${c.revenueAccountCode}`,
      });
      continue;
    }

    const cat = await prisma.invoiceCategory.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      create: {
        tenantId,
        code: c.code,
        name: c.name,
        isActive: true,
        revenueAccountId: revenueAccount.id,
        requiresProject: c.requiresProject,
        requiresFund: c.requiresFund,
        requiresDepartment: c.requiresDepartment,
      },
      update: {
        name: c.name,
        revenueAccountId: revenueAccount.id,
        requiresProject: c.requiresProject,
        requiresFund: c.requiresFund,
        requiresDepartment: c.requiresDepartment,
      },
      select: { id: true, code: true, revenueAccountId: true },
    });

    createdOrUpdated.push({ code: cat.code, id: cat.id, revenueAccountId: cat.revenueAccountId });
  }

  return { createdOrUpdated, skipped };
}

async function migrateInvoicesForTenant(params: {
  tenantId: string;
  categoryIdByInvoiceType: Record<string, string>;
}) {
  const invoiceTypes = Object.keys(params.categoryIdByInvoiceType);

  const counts: Array<{ invoiceType: string; updatedCount: number }>=[];

  for (const invoiceType of invoiceTypes) {
    const invoiceCategoryId = params.categoryIdByInvoiceType[invoiceType];
    const res = await prisma.customerInvoice.updateMany({
      where: {
        tenantId: params.tenantId,
        invoiceCategoryId: null,
        invoiceType: invoiceType as any,
      } as any,
      data: {
        invoiceCategoryId,
      } as any,
    });
    counts.push({ invoiceType, updatedCount: res.count });
  }

  return counts;
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  if (tenants.length === 0) {
    console.log('[backfill-invoice-categories] No tenants found. No changes applied.');
    return;
  }

  console.log(`[backfill-invoice-categories] Starting. Tenants=${tenants.length}`);

  for (const t of tenants) {
    console.log(`\n[backfill-invoice-categories] tenant=${t.name} (${t.id})`);

    const seed = await upsertCategoriesForTenant(t.id);
    console.log(`[backfill-invoice-categories] categories upserted=${seed.createdOrUpdated.length} skipped=${seed.skipped.length}`);
    for (const s of seed.skipped) {
      console.log(`[backfill-invoice-categories]  skipped code=${s.code} reason=${s.reason}`);
    }

    const categoryIdByInvoiceType: Record<string, string> = {};
    for (const def of DEFAULT_CATEGORIES) {
      const hit = seed.createdOrUpdated.find((x) => x.code === def.code);
      if (!hit) continue;
      categoryIdByInvoiceType[String(def.invoiceType)] = hit.id;
    }

    const migrated = await migrateInvoicesForTenant({
      tenantId: t.id,
      categoryIdByInvoiceType,
    });

    const totalUpdated = migrated.reduce((s, r) => s + r.updatedCount, 0);
    console.log(`[backfill-invoice-categories] invoices migrated totalUpdated=${totalUpdated}`);
    for (const row of migrated) {
      console.log(`[backfill-invoice-categories]  invoiceType=${row.invoiceType} updated=${row.updatedCount}`);
    }

    const remaining = await prisma.customerInvoice.count({
      where: {
        tenantId: t.id,
        invoiceType: { not: null } as any,
        invoiceCategoryId: null,
      } as any,
    });
    if (remaining > 0) {
      console.log(`[backfill-invoice-categories] WARNING remaining invoices with invoiceType but no invoiceCategoryId: ${remaining}`);
    }
  }

  console.log('\n[backfill-invoice-categories] Done.');
}

main()
  .catch((e) => {
    console.error('[backfill-invoice-categories] Failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
