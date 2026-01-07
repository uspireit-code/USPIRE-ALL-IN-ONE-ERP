import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

type LoginResult = {
  accessToken: string;
  tenant: { id: string; name: string };
};

describe('AR Refunds (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  let tenantId: string;

  let officerUserId: string;
  let managerUserId: string;
  let controllerUserId: string;

  let officerToken: string;
  let managerToken: string;
  let controllerToken: string;
  let sysAdminToken: string;
  let superAdminToken: string;

  const created: {
    revenueAccountId?: string;
    arControlAccountId?: string;
    bankClearingAccountId?: string;
    cashClearingAccountId?: string;
    customerId?: string;
    invoiceId?: string;
    creditNoteId?: string;
    refundId?: string;
    openPeriodId?: string;
    closedPeriodId?: string;
  } = {};

  async function login(email: string, password: string): Promise<LoginResult> {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      email,
      password,
      tenantId,
    });

    expect(res.status).toBe(201);
    expect(res.body?.accessToken).toBeTruthy();

    return res.body as LoginResult;
  }

  function req(token: string) {
    const server = app.getHttpServer();
    return {
      post: (path: string) =>
        request(server)
          .post(path)
          .set('Authorization', `Bearer ${token}`)
          .set('x-tenant-id', tenantId),
    };
  }

  async function ensurePeriods() {
    const openStart = new Date('2026-01-01T00:00:00.000Z');
    const openEnd = new Date('2026-01-31T23:59:59.999Z');

    const closedStart = new Date('2025-12-01T00:00:00.000Z');
    const closedEnd = new Date('2025-12-31T23:59:59.999Z');

    const open = await prisma.accountingPeriod.upsert({
      where: { tenantId_code: { tenantId, code: 'T-OPEN-202601' } },
      create: {
        tenantId,
        code: 'T-OPEN-202601',
        name: 'Test Open Period 2026-01',
        startDate: openStart,
        endDate: openEnd,
        status: 'OPEN',
      } as any,
      update: {
        startDate: openStart,
        endDate: openEnd,
        status: 'OPEN',
      } as any,
      select: { id: true },
    });

    const closed = await prisma.accountingPeriod.upsert({
      where: { tenantId_code: { tenantId, code: 'T-CLOSED-202512' } },
      create: {
        tenantId,
        code: 'T-CLOSED-202512',
        name: 'Test Closed Period 2025-12',
        startDate: closedStart,
        endDate: closedEnd,
        status: 'CLOSED',
      } as any,
      update: {
        startDate: closedStart,
        endDate: closedEnd,
        status: 'CLOSED',
      } as any,
      select: { id: true },
    });

    created.openPeriodId = open.id;
    created.closedPeriodId = closed.id;
  }

  async function ensureAccountsAndTenantConfig() {
    const ar = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: 'T-AR-CTRL' } },
      create: {
        tenantId,
        code: 'T-AR-CTRL',
        name: 'Test AR Control',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      update: {
        name: 'Test AR Control',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      select: { id: true },
    });

    const revenue = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: 'T-REV' } },
      create: {
        tenantId,
        code: 'T-REV',
        name: 'Test Revenue',
        type: 'INCOME',
        normalBalance: 'CREDIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      update: {
        name: 'Test Revenue',
        type: 'INCOME',
        normalBalance: 'CREDIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      select: { id: true },
    });

    const bankClearing = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: 'T-BANK-CLR' } },
      create: {
        tenantId,
        code: 'T-BANK-CLR',
        name: 'Test Bank Clearing',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      update: {
        name: 'Test Bank Clearing',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      select: { id: true },
    });

    const cashClearing = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: 'T-CASH-CLR' } },
      create: {
        tenantId,
        code: 'T-CASH-CLR',
        name: 'Test Cash Clearing',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      update: {
        name: 'Test Cash Clearing',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      select: { id: true },
    });

    created.arControlAccountId = ar.id;
    created.revenueAccountId = revenue.id;
    created.bankClearingAccountId = bankClearing.id;
    created.cashClearingAccountId = cashClearing.id;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        arControlAccountId: ar.id,
        defaultBankClearingAccountId: bankClearing.id,
        cashClearingAccountId: cashClearing.id,
      } as any,
    });
  }

  async function ensurePostedInvoiceOutstanding10k() {
    const customer = await prisma.customer.create({
      data: {
        tenantId,
        name: 'Test Customer',
        status: 'ACTIVE',
      } as any,
      select: { id: true },
    });

    const invoice = await prisma.customerInvoice.create({
      data: {
        tenantId,
        customerId: customer.id,
        invoiceNumber: `T-INV-${Date.now()}`,
        invoiceDate: new Date('2026-01-10T00:00:00.000Z'),
        dueDate: new Date('2026-01-20T00:00:00.000Z'),
        currency: 'ZAR',
        exchangeRate: 1,
        subtotal: 10000,
        taxAmount: 0,
        isTaxable: false,
        totalAmount: 10000,
        status: 'POSTED',
        createdById: controllerUserId,
        postedById: controllerUserId,
        postedAt: new Date('2026-01-10T00:00:00.000Z'),
        lines: {
          create: [
            {
              accountId: created.revenueAccountId as string,
              description: 'Training',
              quantity: 1,
              unitPrice: 10000,
              discountTotal: 0,
              lineTotal: 10000,
            },
          ],
        },
      } as any,
      select: { id: true },
    });

    created.customerId = customer.id;
    created.invoiceId = invoice.id;
  }

  async function createAndPostCreditNote100() {
    const createRes = await req(officerToken)
      .post('/finance/ar/credit-notes')
      .send({
        creditNoteDate: '2026-01-10',
        customerId: created.customerId,
        invoiceId: created.invoiceId,
        memo: 'Refund base CN',
        currency: 'ZAR',
        exchangeRate: 1,
        lines: [
          {
            description: 'Credit',
            quantity: 1,
            unitPrice: 100,
            revenueAccountId: created.revenueAccountId,
          },
        ],
      });

    expect(createRes.status).toBe(201);
    const cnId = String(createRes.body?.id ?? '');
    expect(cnId).toBeTruthy();

    const approveRes = await req(managerToken)
      .post(`/finance/ar/credit-notes/${cnId}/approve`)
      .send({});
    expect(approveRes.status).toBe(201);

    const postRes = await req(controllerToken)
      .post(`/finance/ar/credit-notes/${cnId}/post`)
      .send({});
    expect(postRes.status).toBe(201);

    created.creditNoteId = cnId;
  }

  beforeAll(async () => {
    prisma = new PrismaClient();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const tenant = await prisma.tenant.findFirst({
      where: { name: 'USPIRE Demo Tenant' },
      select: { id: true },
    });

    if (!tenant) throw new Error('Seed tenant not found (USPIRE Demo Tenant)');
    tenantId = tenant.id;

    const [officerUser, managerUser, controllerUser] = await Promise.all([
      prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: 'officer@uspire.local' } },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: 'manager@uspire.local' } },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: 'controller@uspire.local' } },
        select: { id: true },
      }),
    ]);

    if (!officerUser || !managerUser || !controllerUser) {
      throw new Error('Seed users not found (officer/manager/controller)');
    }

    officerUserId = officerUser.id;
    managerUserId = managerUser.id;
    controllerUserId = controllerUser.id;

    await ensurePeriods();
    await ensureAccountsAndTenantConfig();
    await ensurePostedInvoiceOutstanding10k();

    superAdminToken = (await login('superadmin@uspire.local', 'Super123'))
      .accessToken;
    sysAdminToken = (await login('sysadmin@uspire.local', 'SysAdmin123'))
      .accessToken;
    managerToken = (await login('manager@uspire.local', 'Manager123')).accessToken;
    officerToken = (await login('officer@uspire.local', 'Officer123')).accessToken;
    controllerToken = (await login('controller@uspire.local', 'Controller123'))
      .accessToken;

    await createAndPostCreditNote100();
  });

  afterAll(async () => {
    if (created.refundId) {
      const refunds = await prisma.customerRefund
        .findMany({ where: { id: created.refundId } as any })
        .catch(() => []);
      const journalIds = refunds
        .map((r: any) => r.postedJournalId)
        .filter(Boolean) as string[];

      if (journalIds.length > 0) {
        await prisma.journalLine
          .deleteMany({ where: { journalEntryId: { in: journalIds } } as any })
          .catch(() => undefined);
        await prisma.journalEntry
          .deleteMany({ where: { id: { in: journalIds } } as any })
          .catch(() => undefined);
      }

      await prisma.customerRefund
        .deleteMany({ where: { id: created.refundId } as any })
        .catch(() => undefined);
    }

    if (created.creditNoteId) {
      await prisma.customerCreditNoteLine
        .deleteMany({ where: { creditNoteId: created.creditNoteId } as any })
        .catch(() => undefined);
      await prisma.customerCreditNote
        .deleteMany({ where: { id: created.creditNoteId } as any })
        .catch(() => undefined);
    }

    if (created.invoiceId) {
      await prisma.customerInvoiceLine
        .deleteMany({ where: { customerInvoiceId: created.invoiceId } as any })
        .catch(() => undefined);
      await prisma.customerInvoice
        .deleteMany({ where: { id: created.invoiceId } as any })
        .catch(() => undefined);
    }

    if (created.customerId) {
      await prisma.customer
        .deleteMany({ where: { id: created.customerId } as any })
        .catch(() => undefined);
    }

    if (created.cashClearingAccountId) {
      await prisma.account
        .deleteMany({ where: { id: created.cashClearingAccountId } as any })
        .catch(() => undefined);
    }

    if (created.bankClearingAccountId) {
      await prisma.account
        .deleteMany({ where: { id: created.bankClearingAccountId } as any })
        .catch(() => undefined);
    }

    if (created.revenueAccountId) {
      await prisma.account
        .deleteMany({ where: { id: created.revenueAccountId } as any })
        .catch(() => undefined);
    }

    if (created.arControlAccountId) {
      await prisma.account
        .deleteMany({ where: { id: created.arControlAccountId } as any })
        .catch(() => undefined);
    }

    await prisma.$disconnect();
    await app.close();
  });

  it('RBAC: system admin and super admin cannot access refund lifecycle endpoints', async () => {
    const draftBody = {
      refundDate: '2026-01-12',
      customerId: created.customerId,
      creditNoteId: created.creditNoteId,
      currency: 'ZAR',
      exchangeRate: 1,
      amount: 10,
      paymentMethod: 'BANK',
    };

    const superCreate = await req(superAdminToken)
      .post('/finance/ar/refunds')
      .send(draftBody);
    expect(superCreate.status).toBe(403);

    const sysCreate = await req(sysAdminToken)
      .post('/finance/ar/refunds')
      .send(draftBody);
    expect(sysCreate.status).toBe(403);
  });

  it('Refund lifecycle: officer creates draft; manager approves; controller posts; journal correct; controller voids', async () => {
    const createRes = await req(officerToken).post('/finance/ar/refunds').send({
      refundDate: '2026-01-12',
      customerId: created.customerId,
      creditNoteId: created.creditNoteId,
      currency: 'ZAR',
      exchangeRate: 1,
      amount: 10,
      paymentMethod: 'BANK',
    });

    expect(createRes.status).toBe(201);
    expect(String(createRes.body?.status)).toBe('DRAFT');

    const refundId = String(createRes.body?.id ?? '');
    expect(refundId).toBeTruthy();
    created.refundId = refundId;

    const approveRes = await req(managerToken)
      .post(`/finance/ar/refunds/${refundId}/approve`)
      .send({});
    expect(approveRes.status).toBe(201);
    expect(String(approveRes.body?.status)).toBe('APPROVED');
    expect(approveRes.body?.approvedById).toBe(managerUserId);

    const postRes = await req(controllerToken)
      .post(`/finance/ar/refunds/${refundId}/post`)
      .send({});
    expect(postRes.status).toBe(201);
    expect(String(postRes.body?.status)).toBe('POSTED');
    expect(postRes.body?.postedById).toBe(controllerUserId);
    expect(postRes.body?.postedJournalId).toBeTruthy();

    const postedJournalId = String(postRes.body?.postedJournalId);

    const journal = await prisma.journalEntry.findFirst({
      where: { id: postedJournalId } as any,
      include: { lines: true } as any,
    });
    expect(journal).toBeTruthy();
    expect(String((journal as any).sourceType)).toBe('AR_REFUND');
    expect(String((journal as any).sourceId)).toBe(refundId);

    const lines = (journal as any).lines ?? [];
    expect(lines.length).toBe(2);

    const debitAr = lines.find(
      (l: any) =>
        String(l.accountId) === String(created.arControlAccountId) &&
        Number(l.debit) === 10 &&
        Number(l.credit) === 0,
    );
    expect(debitAr).toBeTruthy();

    const creditBank = lines.find(
      (l: any) =>
        String(l.accountId) === String(created.bankClearingAccountId) &&
        Number(l.credit) === 10 &&
        Number(l.debit) === 0,
    );
    expect(creditBank).toBeTruthy();

    const voidRes = await req(controllerToken)
      .post(`/finance/ar/refunds/${refundId}/void`)
      .send({ reason: 'Test void' });
    expect(voidRes.status).toBe(201);
    expect(String(voidRes.body?.status)).toBe('VOID');
    expect(voidRes.body?.voidedById).toBe(controllerUserId);
  });

  it('Posting is blocked in a closed period', async () => {
    const createRes = await req(officerToken).post('/finance/ar/refunds').send({
      refundDate: '2026-01-12',
      customerId: created.customerId,
      creditNoteId: created.creditNoteId,
      currency: 'ZAR',
      exchangeRate: 1,
      amount: 5,
      paymentMethod: 'CASH',
    });
    expect(createRes.status).toBe(201);

    const refundId = String(createRes.body?.id ?? '');
    expect(refundId).toBeTruthy();

    const approveRes = await req(managerToken)
      .post(`/finance/ar/refunds/${refundId}/approve`)
      .send({});
    expect(approveRes.status).toBe(201);

    await prisma.customerRefund.update({
      where: { id: refundId } as any,
      data: { refundDate: new Date('2025-12-10T00:00:00.000Z') } as any,
    });

    const postRes = await req(controllerToken)
      .post(`/finance/ar/refunds/${refundId}/post`)
      .send({});
    expect(postRes.status).toBe(403);
    expect(String(postRes.body?.message ?? '')).toContain('Cannot post in a closed period');

    await prisma.customerRefund
      .deleteMany({ where: { id: refundId } as any })
      .catch(() => undefined);
  });

  it('Idempotency: reposting is blocked', async () => {
    const createRes = await req(officerToken).post('/finance/ar/refunds').send({
      refundDate: '2026-01-12',
      customerId: created.customerId,
      creditNoteId: created.creditNoteId,
      currency: 'ZAR',
      exchangeRate: 1,
      amount: 1,
      paymentMethod: 'BANK',
    });
    expect(createRes.status).toBe(201);

    const refundId = String(createRes.body?.id ?? '');

    const approveRes = await req(managerToken)
      .post(`/finance/ar/refunds/${refundId}/approve`)
      .send({});
    expect(approveRes.status).toBe(201);

    const postRes = await req(controllerToken)
      .post(`/finance/ar/refunds/${refundId}/post`)
      .send({});
    expect(postRes.status).toBe(201);

    const repostRes = await req(controllerToken)
      .post(`/finance/ar/refunds/${refundId}/post`)
      .send({});
    expect(repostRes.status).toBe(400);

    const postedJournalId = String(postRes.body?.postedJournalId);

    await prisma.journalLine
      .deleteMany({ where: { journalEntryId: postedJournalId } as any })
      .catch(() => undefined);
    await prisma.journalEntry
      .deleteMany({ where: { id: postedJournalId } as any })
      .catch(() => undefined);

    await prisma.customerRefund
      .deleteMany({ where: { id: refundId } as any })
      .catch(() => undefined);
  });

  it('Refund amount cannot exceed available credit balance', async () => {
    const createRes = await req(officerToken).post('/finance/ar/refunds').send({
      refundDate: '2026-01-12',
      customerId: created.customerId,
      creditNoteId: created.creditNoteId,
      currency: 'ZAR',
      exchangeRate: 1,
      amount: 999,
      paymentMethod: 'BANK',
    });
    expect(createRes.status).toBe(201);

    const refundId = String(createRes.body?.id ?? '');

    const approveRes = await req(managerToken)
      .post(`/finance/ar/refunds/${refundId}/approve`)
      .send({});
    expect(approveRes.status).toBe(409);

    await prisma.customerRefund
      .deleteMany({ where: { id: refundId } as any })
      .catch(() => undefined);
  });
});
