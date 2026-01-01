/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, status: true },
    orderBy: { name: 'asc' },
  });

  console.log('TENANTS (id, name, status):');
  for (const t of tenants) {
    console.log(`- ${t.id} | ${t.name} | ${t.status}`);
  }

  if (!tenants.length) {
    throw new Error('No tenants found');
  }

  const tenant = tenants.find((t) => t.status === 'ACTIVE') ?? tenants[0];
  console.log('\nUSING_TENANT_FOR_TEST_LOGIN:');
  console.log(`${tenant.id} | ${tenant.name} | ${tenant.status}`);

  const knownPassword = 'Test123!';
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || '12');
  const passwordHash = await bcrypt.hash(knownPassword, rounds);

  const targetEmail = 'finuspire@gmail.com'.toLowerCase();
  const existingUsers = await prisma.user.findMany({
    where: { email: targetEmail },
    select: { id: true, email: true, tenantId: true, isActive: true },
  });

  let user;
  let chosenTenantId = tenant.id;

  if (existingUsers.length) {
    // Prefer a user already in the selected tenant, otherwise take the first and use its tenant.
    const match = existingUsers.find((u) => u.tenantId === tenant.id) ?? existingUsers[0];
    user = await prisma.user.update({
      where: { id: match.id },
      data: { passwordHash, isActive: true },
      select: { id: true, email: true, tenantId: true },
    });
    chosenTenantId = user.tenantId;

    console.log('\nFOUND_USER: finuspire@gmail.com');
    console.log(`- userId=${user.id}`);
    console.log(`- tenantId=${user.tenantId}`);
    console.log('ACTION: password reset + ensured active');
  } else {
    const fallbackEmail = 'test@uspire.local';

    user = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: chosenTenantId,
          email: fallbackEmail.toLowerCase(),
        },
      },
      select: { id: true, email: true, tenantId: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { tenantId: chosenTenantId, email: fallbackEmail.toLowerCase(), passwordHash, isActive: true },
        select: { id: true, email: true, tenantId: true },
      });
      console.log('\nCREATED_USER: test@uspire.local');
      console.log(`- userId=${user.id}`);
      console.log(`- tenantId=${user.tenantId}`);
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, isActive: true },
        select: { id: true, email: true, tenantId: true },
      });
      console.log('\nFOUND_EXISTING_USER: test@uspire.local');
      console.log('ACTION: password reset + ensured active');
    }

    const adminRole = await prisma.role.findFirst({
      where: { tenantId: chosenTenantId, name: 'ADMIN' },
      select: { id: true, name: true },
    });

    if (!adminRole) {
      const roles = await prisma.role.findMany({
        where: { tenantId: chosenTenantId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

      console.log('\nAVAILABLE_ROLES_FOR_TENANT:');
      for (const r of roles) console.log(`- ${r.id} | ${r.name}`);
      throw new Error('ADMIN role not found for tenant; cannot assign test user to ADMIN');
    }

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      update: {},
      create: { userId: user.id, roleId: adminRole.id },
    });
    console.log(`ENSURED_ROLE: ${adminRole.name}`);
  }

  console.log('\nCREDENTIALS_TO_USE (frontend login):');
  console.log(`Tenant ID: ${chosenTenantId}`);
  console.log(`Email: ${user.email}`);
  console.log(`Password: ${knownPassword}`);

  // Verify HTTP login/me if backend is running.
  console.log('\nVERIFYING_HTTP_FLOW against http://localhost:3000 ...');
  try {
    const loginRes = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': chosenTenantId,
      },
      body: JSON.stringify({ email: user.email, password: knownPassword }),
    });

    const loginBody = await loginRes.json().catch(() => null);

    console.log('POST /auth/login status:', loginRes.status);

    if (!loginRes.ok) {
      console.log('POST /auth/login body:', loginBody);
      throw new Error('Login failed');
    }

    if (!loginBody?.accessToken) {
      console.log('POST /auth/login body:', loginBody);
      throw new Error('Login succeeded but accessToken missing');
    }

    const meRes = await fetch('http://localhost:3000/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${loginBody.accessToken}`,
        'x-tenant-id': chosenTenantId,
      },
    });

    const meBody = await meRes.json().catch(() => null);
    console.log('GET /auth/me status:', meRes.status);

    if (!meRes.ok) {
      console.log('GET /auth/me body:', meBody);
      throw new Error('Me failed');
    }

    console.log('GET /auth/me ok. permissions count:', Array.isArray(meBody?.permissions) ? meBody.permissions.length : 'n/a');
  } catch (e) {
    console.log('HTTP verification failed (is backend running?):', e.message);
    process.exitCode = 2;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
