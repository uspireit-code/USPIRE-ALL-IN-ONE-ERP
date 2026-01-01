import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const glFinalPostCode = 'FINANCE_GL_FINAL_POST';

  const finalPostPerm = await prisma.permission.upsert({
    where: { code: glFinalPostCode },
    create: {
      code: glFinalPostCode,
      description: 'Final post General Ledger entries (controller)',
    },
    update: {},
  });

  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  if (tenants.length === 0) {
    console.log('[rbac-repair] No tenants found. No changes applied.');
    return;
  }

  // Ensure FINANCE_CONTROLLER role exists per tenant and has FINAL_POST
  const controllerRoleByTenant: Array<{ tenantId: string; roleId: string }> = [];
  for (const t of tenants) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: t.id, name: 'FINANCE_CONTROLLER' } },
      create: {
        tenantId: t.id,
        name: 'FINANCE_CONTROLLER',
        description: 'Finance controller role (final posting)',
      },
      update: {
        description: 'Finance controller role (final posting)',
      },
      select: { id: true },
    });
    controllerRoleByTenant.push({ tenantId: t.id, roleId: role.id });
  }

  const controllerInsert = await prisma.rolePermission.createMany({
    data: controllerRoleByTenant.map(({ roleId }) => ({
      roleId: roleId,
      permissionId: finalPostPerm.id,
    })),
    skipDuplicates: true,
  });

  const controllerRoleIds = controllerRoleByTenant.map((x) => x.roleId);
  const controllerMappings = await prisma.rolePermission.findMany({
    where: {
      roleId: { in: controllerRoleIds },
      permissionId: finalPostPerm.id,
    },
    select: { roleId: true },
  });
  const mappedRoleIds = new Set(controllerMappings.map((x) => x.roleId));

  console.log(
    `[rbac-repair] Ensured FINANCE_CONTROLLER has ${glFinalPostCode}. Tenants=${tenants.length}, rows inserted=${controllerInsert.count}.`,
  );
  for (const row of controllerRoleByTenant) {
    console.log(
      `[rbac-repair] tenantId=${row.tenantId} financeControllerRoleId=${row.roleId} hasFinalPost=${mappedRoleIds.has(row.roleId)}`,
    );
  }
}

main()
  .catch((e) => {
    console.error('[rbac-repair] Failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
