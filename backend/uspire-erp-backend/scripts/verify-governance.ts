import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type RoleSummary = {
  name: string;
  permissionCodes: string[];
};

type UserSummary = {
  email: string;
  roles: RoleSummary[];
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function flattenUserPermissions(user: UserSummary): string[] {
  return uniqueSorted(user.roles.flatMap((r) => r.permissionCodes));
}

function requireExactSubset(have: string[], expected: string[], prefix: string, label: string): { missing: string[]; extra: string[] } {
  const haveScoped = have.filter((p) => p.startsWith(prefix));
  const expectedSorted = uniqueSorted(expected);
  const haveSorted = uniqueSorted(haveScoped);

  const haveSet = new Set(haveSorted);
  const expectedSet = new Set(expectedSorted);

  const missing = expectedSorted.filter((p) => !haveSet.has(p));
  const extra = haveSorted.filter((p) => !expectedSet.has(p));

  if (missing.length > 0) {
    console.error(`${label} missing expected ${prefix} permissions:`);
    for (const p of missing) console.error(`- ${p}`);
  }
  if (extra.length > 0) {
    console.error(`${label} has unexpected ${prefix} permissions:`);
    for (const p of extra) console.error(`- ${p}`);
  }

  return { missing, extra };
}

function requireAll(have: string[], required: string[], label: string): string[] {
  const haveSet = new Set(have);
  const missing = required.filter((p) => !haveSet.has(p));
  if (missing.length > 0) {
    console.error(`${label} missing required permissions:`);
    for (const p of missing) console.error(`- ${p}`);
  }
  return missing;
}

function requireNone(have: string[], forbidden: string[], label: string): string[] {
  const haveSet = new Set(have);
  const present = forbidden.filter((p) => haveSet.has(p));
  if (present.length > 0) {
    console.error(`${label} has forbidden permissions:`);
    for (const p of present) console.error(`- ${p}`);
  }
  return present;
}

async function loadUserSummary(tenantId: string, email: string): Promise<UserSummary | null> {
  const user = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId,
        email,
      },
    },
    select: {
      email: true,
      userRoles: {
        select: {
          role: {
            select: {
              name: true,
              rolePermissions: {
                select: {
                  permission: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  const roles: RoleSummary[] = user.userRoles.map((ur) => ({
    name: ur.role.name,
    permissionCodes: uniqueSorted(ur.role.rolePermissions.map((rp) => rp.permission.code)),
  }));

  return {
    email: user.email,
    roles: roles.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  if (!tenant) {
    console.error('No tenant found');
    process.exit(1);
  }

  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  const emails = [
    'superadmin@uspire.local',
    'sysadmin@uspire.local',
    'controller@uspire.local',
    'manager@uspire.local',
    'officer@uspire.local',
  ];

  const summaries: Record<string, UserSummary> = {};
  let hasFailure = false;

  for (const email of emails) {
    const summary = await loadUserSummary(tenant.id, email);
    if (!summary) {
      console.error(`Missing seeded user: ${email}`);
      hasFailure = true;
      continue;
    }

    summaries[email] = summary;

    console.log(`\nUser: ${email}`);
    if (summary.roles.length === 0) {
      console.log('Roles: (none)');
    } else {
      for (const role of summary.roles) {
        console.log(`Role: ${role.name} (permCount=${role.permissionCodes.length})`);
      }
    }
  }

  const forbiddenForAdminLike = [
    'FINANCE_GL_POST',
    'FINANCE_GL_FINAL_POST',
    'FINANCE_GL_APPROVE',
    'AR_INVOICE_POST',
    'AR_INVOICE_APPROVE',
    'AP_INVOICE_POST',
    'AP_INVOICE_APPROVE',
    'PAYMENT_POST',
    'PAYMENT_APPROVE',
    'FINANCE_PERIOD_CLOSE_APPROVE',
  ];

  const expectedController = [
    'FINANCE_GL_FINAL_POST',
    'AR_INVOICE_POST',
    'AP_INVOICE_POST',
    'PAYMENT_POST',
    'FINANCE_PERIOD_CLOSE_APPROVE',
  ];

  const forbiddenController = ['FINANCE_GL_POST'];

  const expectedManager = [
    'FINANCE_GL_APPROVE',
    'AR_INVOICE_APPROVE',
    'AP_INVOICE_APPROVE',
    'PAYMENT_APPROVE',
    'FINANCE_PERIOD_CLOSE',
  ];

  const forbiddenManager = ['FINANCE_GL_FINAL_POST', 'FINANCE_PERIOD_CLOSE_APPROVE', 'AR_INVOICE_POST', 'AP_INVOICE_POST', 'PAYMENT_POST'];

  const expectedOfficer = ['FINANCE_GL_CREATE', 'AR_INVOICE_CREATE', 'AP_INVOICE_CREATE', 'PAYMENT_CREATE', 'CREDIT_NOTE_CREATE'];

  const forbiddenOfficer = [
    'FINANCE_GL_APPROVE',
    'FINANCE_GL_POST',
    'FINANCE_GL_FINAL_POST',
    'AR_INVOICE_APPROVE',
    'AR_INVOICE_POST',
    'AP_INVOICE_APPROVE',
    'AP_INVOICE_POST',
    'PAYMENT_APPROVE',
    'PAYMENT_POST',
    'FINANCE_PERIOD_CLOSE',
    'FINANCE_PERIOD_CLOSE_APPROVE',
  ];

  const superadmin = summaries['superadmin@uspire.local'];
  const sysadmin = summaries['sysadmin@uspire.local'];
  const controller = summaries['controller@uspire.local'];
  const manager = summaries['manager@uspire.local'];
  const officer = summaries['officer@uspire.local'];

  if (superadmin) {
    const perms = flattenUserPermissions(superadmin);
    const present = requireNone(perms, forbiddenForAdminLike, 'SUPERADMIN');
    if (present.length > 0) hasFailure = true;
  }

  if (sysadmin) {
    const perms = flattenUserPermissions(sysadmin);
    const present = requireNone(perms, forbiddenForAdminLike, 'SYSTEM_ADMIN');
    if (present.length > 0) hasFailure = true;
  }

  if (controller) {
    const perms = flattenUserPermissions(controller);
    const missing = requireAll(perms, expectedController, 'FINANCE_CONTROLLER');
    if (missing.length > 0) hasFailure = true;

    const present = requireNone(perms, forbiddenController, 'FINANCE_CONTROLLER');
    if (present.length > 0) hasFailure = true;
  }

  if (manager) {
    const perms = flattenUserPermissions(manager);
    const missing = requireAll(perms, expectedManager, 'FINANCE_MANAGER');
    if (missing.length > 0) hasFailure = true;

    const present = requireNone(perms, forbiddenManager, 'FINANCE_MANAGER');
    if (present.length > 0) hasFailure = true;
  }

  if (officer) {
    const perms = flattenUserPermissions(officer);
    const missing = requireAll(perms, expectedOfficer, 'FINANCE_OFFICER');
    if (missing.length > 0) hasFailure = true;

    const present = requireNone(perms, forbiddenOfficer, 'FINANCE_OFFICER');
    if (present.length > 0) hasFailure = true;
  }

  if (hasFailure) {
    console.error('\nGovernance verification FAILED');
    process.exit(1);
  }

  console.log('\nGovernance verification PASSED');

  const creditRefundForbiddenAdmin = [
    'AR_CREDIT_NOTE_CREATE',
    'AR_CREDIT_NOTE_APPROVE',
    'AR_CREDIT_NOTE_POST',
    'AR_REFUND_CREATE',
    'AR_REFUND_APPROVE',
    'AR_REFUND_POST',
  ];

  const expectedOfficerCreditNote = ['AR_CREDIT_NOTE_CREATE'];
  const expectedOfficerRefund = ['AR_REFUND_CREATE'];

  const expectedManagerCreditNote = ['AR_CREDIT_NOTE_APPROVE'];
  const expectedManagerRefund = ['AR_REFUND_APPROVE'];

  const expectedControllerCreditNote = ['AR_CREDIT_NOTE_POST'];
  const expectedControllerRefund = ['AR_REFUND_POST'];

  let hasCreditRefundFailure = false;

  if (superadmin) {
    const perms = flattenUserPermissions(superadmin);
    const present = requireNone(perms, creditRefundForbiddenAdmin, 'SUPERADMIN');
    if (present.length > 0) hasCreditRefundFailure = true;
  }
  if (sysadmin) {
    const perms = flattenUserPermissions(sysadmin);
    const present = requireNone(perms, creditRefundForbiddenAdmin, 'SYSTEM_ADMIN');
    if (present.length > 0) hasCreditRefundFailure = true;
  }

  if (officer) {
    const perms = flattenUserPermissions(officer);
    const r1 = requireExactSubset(perms, expectedOfficerCreditNote, 'AR_CREDIT_NOTE_', 'FINANCE_OFFICER');
    const r2 = requireExactSubset(perms, expectedOfficerRefund, 'AR_REFUND_', 'FINANCE_OFFICER');
    if (r1.missing.length || r1.extra.length || r2.missing.length || r2.extra.length) hasCreditRefundFailure = true;
  }

  if (manager) {
    const perms = flattenUserPermissions(manager);
    const r1 = requireExactSubset(perms, expectedManagerCreditNote, 'AR_CREDIT_NOTE_', 'FINANCE_MANAGER');
    const r2 = requireExactSubset(perms, expectedManagerRefund, 'AR_REFUND_', 'FINANCE_MANAGER');
    if (r1.missing.length || r1.extra.length || r2.missing.length || r2.extra.length) hasCreditRefundFailure = true;
  }

  if (controller) {
    const perms = flattenUserPermissions(controller);
    const r1 = requireExactSubset(perms, expectedControllerCreditNote, 'AR_CREDIT_NOTE_', 'FINANCE_CONTROLLER');
    const r2 = requireExactSubset(perms, expectedControllerRefund, 'AR_REFUND_', 'FINANCE_CONTROLLER');
    if (r1.missing.length || r1.extra.length || r2.missing.length || r2.extra.length) hasCreditRefundFailure = true;
  }

  if (hasCreditRefundFailure) {
    console.error('\nGOVERNANCE CHECK – CREDIT NOTES & REFUNDS: FAILED');
    process.exit(1);
  }

  console.log('\nGOVERNANCE CHECK – CREDIT NOTES & REFUNDS: PASSED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
