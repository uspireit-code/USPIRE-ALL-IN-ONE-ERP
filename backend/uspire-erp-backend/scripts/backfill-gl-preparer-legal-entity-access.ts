import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const legalEntityId = String(
    process.env.GL_AUTO_PROVISION_LEGAL_ENTITY_ID ??
      'e7511e8f-1e7e-4e3d-8caf-f39ddb654313',
  ).trim();

  if (!legalEntityId) {
    throw new Error('Missing GL_AUTO_PROVISION_LEGAL_ENTITY_ID');
  }

  const permissionCodes = ['FINANCE_GL_CREATE', 'gl.journal.create'];

  const roles = await prisma.role.findMany({
    where: {
      rolePermissions: {
        some: { permission: { code: { in: permissionCodes } } },
      },
    },
    select: { id: true, tenantId: true, name: true },
  });

  if (roles.length === 0) {
    console.log('[backfill-gl-le-access] No roles found granting FINANCE_GL_CREATE / gl.journal.create. Nothing to do.');
    return;
  }

  const rolesByTenant = new Map<string, Array<{ id: string; name: string }>>();
  for (const r of roles) {
    const list = rolesByTenant.get(r.tenantId) ?? [];
    list.push({ id: r.id, name: r.name });
    rolesByTenant.set(r.tenantId, list);
  }

  console.log(
    `[backfill-gl-le-access] Found roles granting GL_CREATE across tenants=${rolesByTenant.size}. legalEntityId=${legalEntityId}`,
  );

  let upserted = 0;
  let skippedNoUser = 0;

  for (const [tenantId, tenantRoles] of rolesByTenant.entries()) {
    console.log(`\n[backfill-gl-le-access] tenantId=${tenantId} roles=${tenantRoles.map((x) => x.name).join(', ')}`);

    const users = await prisma.userRole.findMany({
      where: {
        roleId: { in: tenantRoles.map((r) => r.id) },
        role: { tenantId },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    if (users.length === 0) {
      skippedNoUser++;
      console.log('[backfill-gl-le-access]  No users found for these roles.');
      continue;
    }

    for (const u of users) {
      await prisma.userLegalEntityAccess.upsert({
        where: {
          tenantId_userId_legalEntityId: {
            tenantId,
            userId: u.userId,
            legalEntityId,
          },
        },
        create: {
          tenantId,
          userId: u.userId,
          legalEntityId,
          accessLevel: 'PREPARE',
          canPost: false,
          canApprove: false,
          canOverride: false,
          expiresAt: null,
          grantedById: null,
        },
        update: {
          accessLevel: 'PREPARE',
          expiresAt: null,
        },
        select: { id: true },
      });

      upserted++;
    }

    console.log(`[backfill-gl-le-access]  upserted=${users.length}`);
  }

  console.log(`\n[backfill-gl-le-access] Done. upserted=${upserted} tenantsWithNoUsers=${skippedNoUser}`);
}

main()
  .catch((e) => {
    console.error('[backfill-gl-le-access] Failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
