import { PrismaClient } from '@prisma/client';

declare const process: any;

const prisma = new PrismaClient();

/**
 * Roles expected to exist in DB (per tenant):
 *  - FINANCE_OFFICER
 *  - FINANCE_MANAGER
 *  - FINANCE_CONTROLLER
 *  - SYSTEM_ADMIN
 *  - SUPER_ADMIN
 *
 * Permissions expected to exist in permission catalog (global):
 *  AP_SUPPLIER_CREATE
 *  AP_SUPPLIER_VIEW
 *  AP_INVOICE_CREATE
 *  AP_INVOICE_VIEW
 *  AP_INVOICE_SUBMIT
 *  AP_INVOICE_APPROVE
 *  AP_INVOICE_POST
 *  PAYMENT_CREATE
 *  PAYMENT_APPROVE
 *  PAYMENT_POST
 */

const ROLE_NAMES = {
  OFFICER: 'FINANCE_OFFICER',
  MANAGER: 'FINANCE_MANAGER',
  CONTROLLER: 'FINANCE_CONTROLLER',
  SYS_ADMIN: 'SYSTEM_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

const PERMISSIONS = {
  AP_INVOICE_VIEW: ['AP_INVOICE_VIEW'],
  AP_INVOICE_CREATE: ['AP_INVOICE_CREATE'],
  AP_INVOICE_SUBMIT: ['AP_INVOICE_SUBMIT'],
  AP_INVOICE_APPROVE: ['AP_INVOICE_APPROVE'],
  AP_INVOICE_POST: ['AP_INVOICE_POST'],
  PAYMENTS: ['PAYMENT_CREATE', 'PAYMENT_APPROVE', 'PAYMENT_POST'],
} as const;

const ROLE_MATRIX: Record<string, string[]> = {
  [ROLE_NAMES.OFFICER]: [...PERMISSIONS.AP_INVOICE_VIEW, ...PERMISSIONS.AP_INVOICE_CREATE],

  [ROLE_NAMES.MANAGER]: [
    ...PERMISSIONS.AP_INVOICE_VIEW,
    ...PERMISSIONS.AP_INVOICE_CREATE,
    ...PERMISSIONS.AP_INVOICE_SUBMIT,
  ],

  [ROLE_NAMES.CONTROLLER]: [
    ...PERMISSIONS.AP_INVOICE_VIEW,
    ...PERMISSIONS.AP_INVOICE_APPROVE,
    ...PERMISSIONS.AP_INVOICE_POST,
  ],

  [ROLE_NAMES.SYS_ADMIN]: [
    ...PERMISSIONS.AP_INVOICE_VIEW,
    ...PERMISSIONS.AP_INVOICE_CREATE,
    ...PERMISSIONS.AP_INVOICE_SUBMIT,
    ...PERMISSIONS.AP_INVOICE_APPROVE,
    ...PERMISSIONS.AP_INVOICE_POST,
    ...PERMISSIONS.PAYMENTS,
  ],

  [ROLE_NAMES.SUPER_ADMIN]: [
    ...PERMISSIONS.AP_INVOICE_VIEW,
    ...PERMISSIONS.AP_INVOICE_CREATE,
    ...PERMISSIONS.AP_INVOICE_SUBMIT,
    ...PERMISSIONS.AP_INVOICE_APPROVE,
    ...PERMISSIONS.AP_INVOICE_POST,
    ...PERMISSIONS.PAYMENTS,
  ],
};

async function main() {
  console.log('[bootstrap-ap-permissions] Bootstrapping AP permissions…');

  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  if (tenants.length === 0) {
    console.log('[bootstrap-ap-permissions] No tenants found. No changes applied.');
    return;
  }

  const permissionCodes = Array.from(new Set(Object.values(ROLE_MATRIX).flat()));
  const permissions = await prisma.permission.findMany({
    where: { code: { in: permissionCodes } },
    select: { id: true, code: true },
  });
  const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));

  for (const missingCode of permissionCodes.filter((c) => !permissionIdByCode.has(c))) {
    console.warn(`[bootstrap-ap-permissions] Permission not found: ${missingCode} — will be skipped`);
  }

  for (const t of tenants) {
    console.log(`[bootstrap-ap-permissions] tenantId=${t.id} starting…`);

    let insertedTotal = 0;

    for (const [roleName, permissionList] of Object.entries(ROLE_MATRIX)) {
      const role = await prisma.role.findUnique({
        where: { tenantId_name: { tenantId: t.id, name: roleName } },
        select: { id: true },
      });

      if (!role) {
        console.warn(
          `[bootstrap-ap-permissions] tenantId=${t.id} role not found: ${roleName} — skipping role assignments`,
        );
        continue;
      }

      const permissionIds = permissionList
        .map((code) => permissionIdByCode.get(code))
        .filter((id): id is string => Boolean(id));

      if (permissionIds.length === 0) {
        console.warn(
          `[bootstrap-ap-permissions] tenantId=${t.id} role=${roleName} no valid permissions resolved — skipping`,
        );
        continue;
      }

      const res = await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });

      insertedTotal += res.count;
      console.log(
        `[bootstrap-ap-permissions] tenantId=${t.id} ✓ assigned AP permissions to role=${roleName} rowsInserted=${res.count}`,
      );
    }

    console.log(`[bootstrap-ap-permissions] tenantId=${t.id} completed rowsInserted=${insertedTotal}`);
  }

  console.log('[bootstrap-ap-permissions] AP permission bootstrap completed.');
}

main()
  .catch((e) => {
    console.error('[bootstrap-ap-permissions] Failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
