const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const tenant =
    (await prisma.tenant.findFirst({ where: { status: 'ACTIVE' }, select: { id: true, name: true, status: true } })) ||
    (await prisma.tenant.findFirst({ select: { id: true, name: true, status: true } }));

  if (!tenant) {
    throw new Error('No tenant found');
  }

  const desiredPermCodes = ['FINANCE_GL_VIEW', 'FINANCE_GL_CREATE'];

  const perms = await prisma.permission.findMany({
    where: { code: { in: desiredPermCodes } },
    select: { id: true, code: true },
  });

  const missing = desiredPermCodes.filter((c) => !perms.find((p) => p.code === c));
  if (missing.length) {
    throw new Error(`Missing Permission rows: ${missing.join(', ')} (run prisma seed first)`);
  }

  const role = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'GL_PREPARER',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'GL_PREPARER',
      description: 'GL preparer (view + create only)',
    },
    update: {},
    select: { id: true, name: true },
  });

  await prisma.rolePermission.deleteMany({
    where: {
      roleId: role.id,
      permission: { code: { notIn: desiredPermCodes } },
    },
  });

  await prisma.rolePermission.createMany({
    data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || '12');
  const passwordHash = await bcrypt.hash('Temp123!', rounds);

  const email = 'gl.preparer@uspire.local';

  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    create: { tenantId: tenant.id, email, passwordHash, isActive: true },
    update: { passwordHash, isActive: true },
    select: { id: true, email: true, tenantId: true, isActive: true },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {},
  });

  const finalPerms = await prisma.rolePermission.findMany({
    where: { roleId: role.id },
    select: { permission: { select: { code: true } } },
    orderBy: { permission: { code: 'asc' } },
  });

  console.log('OK');
  console.log('TENANT:', tenant);
  console.log('ROLE:', role);
  console.log('ROLE_PERMISSIONS:', finalPerms.map((rp) => rp.permission.code));
  console.log('USER:', user);
  console.log('LOGIN:', { tenantId: tenant.id, email, password: 'Temp123!' });
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
