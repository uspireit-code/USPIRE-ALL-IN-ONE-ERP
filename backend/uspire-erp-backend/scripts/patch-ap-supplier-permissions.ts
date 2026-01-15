import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SUPPLIER_PERMISSION_CODES = [
  'AP_SUPPLIER_CREATE',
  'AP_SUPPLIER_VIEW',
  'AP_SUPPLIER_IMPORT',
] as const;

type SupplierPermCode = (typeof SUPPLIER_PERMISSION_CODES)[number];

async function ensurePermissionsExist() {
  await prisma.permission.createMany({
    data: [
      { code: 'AP_SUPPLIER_CREATE', description: 'Create suppliers' },
      { code: 'AP_SUPPLIER_VIEW', description: 'View suppliers' },
      { code: 'AP_SUPPLIER_IMPORT', description: 'Import suppliers in bulk' },
    ],
    skipDuplicates: true,
  });

  const perms = await prisma.permission.findMany({
    where: { code: { in: [...SUPPLIER_PERMISSION_CODES] } },
    select: { id: true, code: true },
  });

  const idByCode = new Map<SupplierPermCode, string>();
  for (const p of perms) {
    if (SUPPLIER_PERMISSION_CODES.includes(p.code as SupplierPermCode)) {
      idByCode.set(p.code as SupplierPermCode, p.id);
    }
  }

  for (const code of SUPPLIER_PERMISSION_CODES) {
    if (!idByCode.get(code)) {
      throw new Error(`Missing Permission row for code=${code}. Seed/catalog mismatch?`);
    }
  }

  return idByCode;
}

async function assignToRole(roleId: string, permissionIds: string[]) {
  await prisma.rolePermission.createMany({
    data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    skipDuplicates: true,
  });
}

async function printFinanceOfficerPermissions(tenantId: string) {
  const officer = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId, name: 'FINANCE_OFFICER' } },
    select: {
      id: true,
      name: true,
      rolePermissions: {
        select: { permission: { select: { code: true } } },
      },
    },
  });

  if (!officer) {
    console.log(`[patch-ap-supplier-permissions] tenantId=${tenantId} FINANCE_OFFICER role not found`);
    return;
  }

  const codes = officer.rolePermissions
    .map((rp) => rp.permission.code)
    .sort((a, b) => a.localeCompare(b));

  console.log(`[patch-ap-supplier-permissions] tenantId=${tenantId} role=${officer.name} permissions=`);
  for (const c of codes) console.log(`  - ${c}`);
}

async function main() {
  console.log('[patch-ap-supplier-permissions] Starting patch…');

  const permissionIdByCode = await ensurePermissionsExist();
  const permIds = SUPPLIER_PERMISSION_CODES.map((c) => permissionIdByCode.get(c) as string);

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  if (tenants.length === 0) {
    console.log('[patch-ap-supplier-permissions] No tenants found. Nothing to do.');
    return;
  }

  for (const t of tenants) {
    const financeOfficer = await prisma.role.findUnique({
      where: { tenantId_name: { tenantId: t.id, name: 'FINANCE_OFFICER' } },
      select: { id: true },
    });

    const financeManager = await prisma.role.findUnique({
      where: { tenantId_name: { tenantId: t.id, name: 'FINANCE_MANAGER' } },
      select: { id: true },
    });

    if (financeOfficer?.id) {
      await assignToRole(financeOfficer.id, permIds);
    }

    if (financeManager?.id) {
      await assignToRole(financeManager.id, permIds);
    }

    await printFinanceOfficerPermissions(t.id);
  }

  console.log('[patch-ap-supplier-permissions] Patch completed.');
}

main()
  .catch((e) => {
    console.error('[patch-ap-supplier-permissions] Failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
