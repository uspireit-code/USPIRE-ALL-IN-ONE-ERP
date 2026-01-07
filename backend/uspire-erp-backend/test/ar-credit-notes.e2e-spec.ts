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

describe('AR Credit Notes (e2e)', () => {
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
    customerId?: string;
    invoiceId?: string;
    closedPeriodId?: string;
    openPeriodId?: string;
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
      get: (path: string) =>
        request(server)
          .get(path)
          .set('Authorization', `Bearer ${token}`)
          .set('x-tenant-id', tenantId),
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

    created.arControlAccountId = ar.id;
    created.revenueAccountId = revenue.id;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { arControlAccountId: ar.id } as any,
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
        where: {
          tenantId_email: { tenantId, email: 'officer@uspire.local' },
        },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: {
          tenantId_email: { tenantId, email: 'manager@uspire.local' },
        },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: {
          tenantId_email: { tenantId, email: 'controller@uspire.local' },
        },
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
  });

  afterAll(async () => {
    // Cleanup only records created by this test.
    if (created.invoiceId) {
      await prisma.customerReceiptLine
        .deleteMany({ where: { invoiceId: created.invoiceId } as any })
        .catch(() => undefined);
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

  it('RBAC: system admin and super admin cannot access credit note lifecycle endpoints', async () => {
    const draftBody = {
      creditNoteDate: '2026-01-10',
      customerId: created.customerId,
      invoiceId: created.invoiceId,
      memo: 'Test',
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
    };

    const superCreate = await req(superAdminToken)
      .post('/finance/ar/credit-notes')
      .send(draftBody);
    expect(superCreate.status).toBe(403);

    const sysCreate = await req(sysAdminToken)
      .post('/finance/ar/credit-notes')
      .send(draftBody);
    expect(sysCreate.status).toBe(403);
  });

  it('RBAC: officer can create draft; manager can approve; controller can post and void', async () => {
    const createRes = await req(officerToken).post('/finance/ar/credit-notes').send({
      creditNoteDate: '2026-01-10',
      customerId: created.customerId,
      invoiceId: created.invoiceId,
      memo: 'Draft',
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
    const cnId = createRes.body?.id;
    expect(cnId).toBeTruthy();

    const officerApprove = await req(officerToken)
      .post(`/finance/ar/credit-notes/${cnId}/approve`)
      .send({});
    expect(officerApprove.status).toBe(403);

    const managerApprove = await req(managerToken)
      .post(`/finance/ar/credit-notes/${cnId}/approve`)
      .send({});
    expect(managerApprove.status).toBe(201);

    const managerPost = await req(managerToken)
      .post(`/finance/ar/credit-notes/${cnId}/post`)
      .send({});
    expect(managerPost.status).toBe(403);

    const controllerPost = await req(controllerToken)
      .post(`/finance/ar/credit-notes/${cnId}/post`)
      .send({});
    // If controller lacks FINANCE_GL_FINAL_POST, this will fail and indicates seed/role setup issue.
    expect(controllerPost.status).toBe(201);

    const controllerVoid = await req(controllerToken)
      .post(`/finance/ar/credit-notes/${cnId}/void`)
      .send({ reason: 'Test void' });
    if (controllerVoid.status !== 201) {
      throw new Error(
        `Expected 201 from void, got ${controllerVoid.status}: ${JSON.stringify(controllerVoid.body)}`,
      );
    }
  });

  it('Period control: approving in a closed period is blocked', async () => {
    const createRes = await req(officerToken).post('/finance/ar/credit-notes').send({
      creditNoteDate: '2025-12-15',
      customerId: created.customerId,
      invoiceId: created.invoiceId,
      memo: 'Closed period',
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
    const cnId = createRes.body?.id;

    const approveRes = await req(managerToken)
      .post(`/finance/ar/credit-notes/${cnId}/approve`)
      .send({});
    expect(approveRes.status).toBe(403);
    expect(approveRes.body?.message).toBe('Cannot approve in a closed period');
  });

  it('Period control: posting in a closed period is blocked', async () => {
    const createRes = await req(officerToken).post('/finance/ar/credit-notes').send({
      creditNoteDate: '2026-01-10',
      customerId: created.customerId,
      invoiceId: created.invoiceId,
      memo: 'Closed period',
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
    const cnId = createRes.body?.id;

    const approveRes = await req(managerToken)
      .post(`/finance/ar/credit-notes/${cnId}/approve`)
      .send({});
    expect(approveRes.status).toBe(201);

    // Force the document date into a closed period AFTER approval so post() hits period control.
    await prisma.customerCreditNote.update({
      where: { id: cnId } as any,
      data: { creditNoteDate: new Date('2025-12-15T00:00:00.000Z') } as any,
    });

    const postRes = await req(controllerToken)
      .post(`/finance/ar/credit-notes/${cnId}/post`)
      .send({});
    expect(postRes.status).toBe(403);
    expect(postRes.body?.message).toBe('Cannot post in a closed period');
  });

  it('Balance protection: cannot approve credit note that exceeds invoice outstanding', async () => {
    const createRes = await req(officerToken).post('/finance/ar/credit-notes').send({
      creditNoteDate: '2026-01-10',
      customerId: created.customerId,
      invoiceId: created.invoiceId,
      memo: 'Exceeds outstanding',
      currency: 'ZAR',
      exchangeRate: 1,
      lines: [
        {
          description: 'Credit',
          quantity: 1,
          unitPrice: 12000,
          revenueAccountId: created.revenueAccountId,
        },
      ],
    });

    expect(createRes.status).toBe(201);
    const cnId = createRes.body?.id;

    const approveRes = await req(managerToken)
      .post(`/finance/ar/credit-notes/${cnId}/approve`)
      .send({});

    expect(approveRes.status).toBe(409);
    expect(approveRes.body?.message).toBe(
      'Credit note total exceeds invoice outstanding balance',
    );
  });

  it('Balance protection: posting fails if invoice outstanding is reduced after approval', async () => {
    const createRes = await req(officerToken).post('/finance/ar/credit-notes').send({
      creditNoteDate: '2026-01-10',
      customerId: created.customerId,
      invoiceId: created.invoiceId,
      memo: 'Race',
      currency: 'ZAR',
      exchangeRate: 1,
      lines: [
        {
          description: 'Credit',
          quantity: 1,
          unitPrice: 6000,
          revenueAccountId: created.revenueAccountId,
        },
      ],
    });

    expect(createRes.status).toBe(201);
    const cnId = createRes.body?.id;

    const approveRes = await req(managerToken)
      .post(`/finance/ar/credit-notes/${cnId}/approve`)
      .send({});
    expect(approveRes.status).toBe(201);

    // Apply receipt of 7000 after approval so outstanding becomes 3000.
    const receipt = await prisma.customerReceipt.create({
      data: {
        tenantId,
        receiptNumber: `T-RCPT-${Date.now()}`,
        receiptDate: new Date('2026-01-11T00:00:00.000Z'),
        customerId: created.customerId as string,
        currency: 'ZAR',
        exchangeRate: 1,
        totalAmount: 7000,
        paymentMethod: 'CASH',
        status: 'POSTED',
        createdById: controllerUserId,
        postedById: controllerUserId,
        postedAt: new Date('2026-01-11T00:00:00.000Z'),
        lines: {
          create: [
            {
              tenantId,
              invoiceId: created.invoiceId as string,
              appliedAmount: 7000,
            },
          ],
        },
      } as any,
      select: { id: true },
    });

    expect(receipt.id).toBeTruthy();

    const postRes = await req(controllerToken)
      .post(`/finance/ar/credit-notes/${cnId}/post`)
      .send({});

    expect(postRes.status).toBe(409);
    expect(postRes.body?.message).toBe(
      'Credit note total exceeds invoice outstanding balance',
    );

    await prisma.customerReceipt
      .delete({ where: { id: receipt.id } as any })
      .catch(() => undefined);
  });

  it('Idempotency + journal correctness: posting creates one linked journal and re-post fails', async () => {
    const createRes = await req(officerToken).post('/finance/ar/credit-notes').send({
      creditNoteDate: '2026-01-10',
      customerId: created.customerId,
      invoiceId: created.invoiceId,
      memo: 'Post once',
      currency: 'ZAR',
      exchangeRate: 1,
      lines: [
        {
          description: 'Credit',
          quantity: 1,
          unitPrice: 500,
          revenueAccountId: created.revenueAccountId,
        },
      ],
    });

    expect(createRes.status).toBe(201);
    const cnId = createRes.body?.id;

    await req(managerToken)
      .post(`/finance/ar/credit-notes/${cnId}/approve`)
      .send({});

    const postRes = await req(controllerToken)
      .post(`/finance/ar/credit-notes/${cnId}/post`)
      .send({});
    expect(postRes.status).toBe(201);

    const repostRes = await req(controllerToken)
      .post(`/finance/ar/credit-notes/${cnId}/post`)
      .send({});
    expect(repostRes.status).toBe(400);
    expect(repostRes.body?.message).toBe('Credit note already posted');

    const cn = await prisma.customerCreditNote.findFirst({
      where: { id: cnId, tenantId } as any,
      select: { postedJournalId: true, totalAmount: true },
    });

    expect(cn?.postedJournalId).toBeTruthy();

    const je = await prisma.journalEntry.findFirst({
      where: {
        tenantId,
        id: String(cn?.postedJournalId),
      } as any,
      include: { lines: true } as any,
    });

    expect(je).toBeTruthy();
    expect((je as any).sourceType).toBe('AR_CREDIT_NOTE');
    expect((je as any).sourceId).toBe(cnId);

    const total = Number(cn?.totalAmount ?? 0);

    const debit = (je?.lines ?? []).reduce((s, l: any) => s + Number(l.debit ?? 0), 0);
    const credit = (je?.lines ?? []).reduce((s, l: any) => s + Number(l.credit ?? 0), 0);

    expect(Math.round(debit * 100) / 100).toBe(Math.round(credit * 100) / 100);
    expect(Math.round(debit * 100) / 100).toBe(Math.round(total * 100) / 100);

    const arLine = (je?.lines ?? []).find(
      (l: any) =>
        String(l.accountId) === String(created.arControlAccountId) &&
        Number(l.credit ?? 0) === total,
    );
    expect(arLine).toBeTruthy();

    const revLine = (je?.lines ?? []).find(
      (l: any) =>
        String(l.accountId) === String(created.revenueAccountId) &&
        Number(l.debit ?? 0) === total,
    );
    expect(revLine).toBeTruthy();
  });
});
