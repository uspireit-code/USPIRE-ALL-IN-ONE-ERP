/// <reference types="jest" />

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

jest.setTimeout(60000);

describe('Bank Reconciliation Reconcile & Lock (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  let tenantId: string;

  let officerToken: string;
  let controllerToken: string;

  let officerUserId: string;
  let controllerUserId: string;

  let statementSeq = 0;

  function nextJanWindow() {
    statementSeq += 1;

    const start = new Date(Date.UTC(2026, 0, 1));
    const end = new Date(Date.UTC(2026, 0, Math.min(31, 10 + statementSeq))); // 2026-01-11, 12, ...
    const txn = new Date(Date.UTC(2026, 0, Math.min(31, 5 + statementSeq)));

    return {
      start,
      end,
      txn,
      startStr: start.toISOString().slice(0, 10),
      endStr: end.toISOString().slice(0, 10),
      txnStr: txn.toISOString().slice(0, 10),
    };
  }

  function febWindow() {
    const start = new Date(Date.UTC(2026, 1, 1));
    const end = new Date(Date.UTC(2026, 1, 10));
    const txn = new Date(Date.UTC(2026, 1, 5));

    return {
      start,
      end,
      txn,
      startStr: start.toISOString().slice(0, 10),
      endStr: end.toISOString().slice(0, 10),
      txnStr: txn.toISOString().slice(0, 10),
    };
  }

  const created: {
    openPeriodId?: string;
    closedPeriodId?: string;
    bankGlAccountId?: string;
    contraGlAccountId?: string;
    bankAccountId?: string;
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

    created.openPeriodId = open.id;

    const closedStart = new Date('2026-02-01T00:00:00.000Z');
    const closedEnd = new Date('2026-02-28T23:59:59.999Z');

    const closed = await prisma.accountingPeriod.upsert({
      where: { tenantId_code: { tenantId, code: 'T-CLOSED-202602' } },
      create: {
        tenantId,
        code: 'T-CLOSED-202602',
        name: 'Test Closed Period 2026-02',
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

    created.closedPeriodId = closed.id;
  }

  async function ensureAccounts() {
    const bankGl = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: 'T-BR4-BANK' } },
      create: {
        tenantId,
        code: 'T-BR4-BANK',
        name: 'Test Bank GL',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      update: {
        name: 'Test Bank GL',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      select: { id: true },
    });

    const contra = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: 'T-BR4-CONTRA' } },
      create: {
        tenantId,
        code: 'T-BR4-CONTRA',
        name: 'Test Contra GL',
        type: 'EXPENSE',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      update: {
        name: 'Test Contra GL',
        type: 'EXPENSE',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      select: { id: true },
    });

    created.bankGlAccountId = bankGl.id;
    created.contraGlAccountId = contra.id;
  }

  async function ensureBankAccount() {
    const bank = await prisma.bankAccount.upsert({
      where: { tenantId_name: { tenantId, name: 'T-BR4-BANK-ACC' } },
      create: {
        tenantId,
        name: 'T-BR4-BANK-ACC',
        bankName: 'Test Bank',
        accountNumber: 'BR4-0001',
        type: 'BANK',
        currency: 'USD',
        glAccountId: created.bankGlAccountId,
        status: 'ACTIVE',
        openingBalance: 0,
      } as any,
      update: {
        bankName: 'Test Bank',
        accountNumber: 'BR4-0001',
        type: 'BANK',
        currency: 'USD',
        glAccountId: created.bankGlAccountId,
        status: 'ACTIVE',
      } as any,
      select: { id: true },
    });

    created.bankAccountId = bank.id;
  }

  async function ensureControllerPermissions() {
    const [controllerRoles, permReconcile, permView, permStatementImport] = await Promise.all([
      prisma.userRole.findMany({
        where: { userId: controllerUserId, role: { tenantId } },
        select: { roleId: true },
      }),
      prisma.permission.findUnique({ where: { code: 'BANK_RECONCILE' }, select: { id: true } }),
      prisma.permission.findUnique({ where: { code: 'BANK_RECONCILIATION_VIEW' }, select: { id: true } }),
      prisma.permission.findUnique({ where: { code: 'BANK_STATEMENT_IMPORT' }, select: { id: true } }),
    ]);

    if (!permReconcile || !permView || !permStatementImport) {
      throw new Error(
        'Seed permissions not found (BANK_RECONCILE / BANK_RECONCILIATION_VIEW / BANK_STATEMENT_IMPORT)',
      );
    }

    await prisma.rolePermission.createMany({
      data: controllerRoles.flatMap((r) => [
        { roleId: r.roleId, permissionId: permReconcile.id },
        { roleId: r.roleId, permissionId: permView.id },
        { roleId: r.roleId, permissionId: permStatementImport.id },
      ]),
      skipDuplicates: true,
    });
  }

  async function createPostedBankBalance(params: { endDate: Date; bankBalance: number }) {
    const d = new Date(params.endDate.getTime());
    d.setUTCHours(0, 0, 0, 0);

    await prisma.journalEntry.create({
      data: {
        tenantId,
        status: 'POSTED',
        createdById: controllerUserId,
        postedById: controllerUserId,
        postedAt: d,
        journalDate: d,
        reference: `T-BR4-J-${Date.now()}`,
        description: 'Test journal for bank balance',
        lines: {
          create: [
            {
              accountId: created.bankGlAccountId,
              debit: params.bankBalance,
              credit: 0,
              cleared: false,
            } as any,
            {
              accountId: created.contraGlAccountId,
              debit: 0,
              credit: params.bankBalance,
              cleared: false,
            } as any,
          ],
        },
      } as any,
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = new PrismaClient();

    const tenant = await prisma.tenant.findFirst({
      where: { name: 'USPIRE Demo Tenant' },
      select: { id: true },
    });

    if (!tenant) throw new Error('Seed tenant not found (USPIRE Demo Tenant)');
    tenantId = tenant.id;

    const [officerUser, controllerUser] = await Promise.all([
      prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: 'officer@uspire.local' } },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: 'controller@uspire.local' } },
        select: { id: true },
      }),
    ]);

    if (!officerUser || !controllerUser) throw new Error('Seed users not found (officer/controller)');

    officerUserId = officerUser.id;
    controllerUserId = controllerUser.id;

    await ensureControllerPermissions();

    controllerToken = (await login('controller@uspire.local', 'Controller123')).accessToken;
    officerToken = (await login('officer@uspire.local', 'Officer123')).accessToken;

    await ensurePeriods();
    await ensureAccounts();
    await ensureBankAccount();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('reconcile succeeds when difference = 0 and creates snapshot; statement ends LOCKED', async () => {
    const w = nextJanWindow();

    await createPostedBankBalance({ endDate: w.end, bankBalance: 500 });

    const createRes = await req(controllerToken).post('/bank-recon/statements').send({
      bankAccountId: created.bankAccountId,
      statementStartDate: w.startStr,
      statementEndDate: w.endStr,
      openingBalance: 0,
      closingBalance: 500,
    });

    expect(createRes.status).toBe(201);
    const statementId = String(createRes.body?.id ?? '');
    expect(statementId).toBeTruthy();

    const previewRes = await req(controllerToken).get(
      `/bank-recon/statements/${encodeURIComponent(statementId)}/preview`,
    );
    expect(previewRes.status).toBe(200);
    expect(previewRes.body?.differencePreview).toBe(0);

    const reconcileRes = await req(controllerToken).post(
      `/bank-recon/statements/${encodeURIComponent(statementId)}/reconcile`,
    );

    expect(reconcileRes.status).toBe(201);

    const stmt = await (prisma as any).bankStatement.findUnique({
      where: { id: statementId },
      select: { status: true, reconciledAt: true, lockedAt: true },
    });

    expect(String(stmt?.status)).toBe('LOCKED');
    expect(stmt?.reconciledAt).toBeTruthy();
    expect(stmt?.lockedAt).toBeTruthy();

    const snapshot = await (prisma as any).bankReconciliationSnapshot.findFirst({
      where: { tenantId, bankStatementId: statementId },
    });

    expect(snapshot).toBeTruthy();
    expect(Number(snapshot.difference)).toBe(0);
  });

  it('reconcile blocked when difference != 0', async () => {
    const w = nextJanWindow();

    await createPostedBankBalance({ endDate: w.end, bankBalance: 500 });

    const createRes = await req(controllerToken).post('/bank-recon/statements').send({
      bankAccountId: created.bankAccountId,
      statementStartDate: w.startStr,
      statementEndDate: w.endStr,
      openingBalance: 0,
      closingBalance: 400,
    });

    expect(createRes.status).toBe(201);
    const statementId = String(createRes.body?.id ?? '');

    const reconcileRes = await req(controllerToken).post(
      `/bank-recon/statements/${encodeURIComponent(statementId)}/reconcile`,
    );

    expect(reconcileRes.status).toBe(400);
  });

  it('reconcile blocked when period is CLOSED', async () => {
    const w = febWindow();

    const createRes = await req(controllerToken).post('/bank-recon/statements').send({
      bankAccountId: created.bankAccountId,
      statementStartDate: w.startStr,
      statementEndDate: w.endStr,
      openingBalance: 0,
      closingBalance: 0,
    });

    expect(createRes.status).toBe(201);
    const statementId = String(createRes.body?.id ?? '');

    const reconcileRes = await req(controllerToken).post(
      `/bank-recon/statements/${encodeURIComponent(statementId)}/reconcile`,
    );

    expect(reconcileRes.status).toBe(400);
  });

  it('after LOCKED: add line blocked, match blocked, create adjustment blocked', async () => {
    const w = nextJanWindow();

    // Set up bank balance 0 (no journals) so closingBalance 0 yields difference = 0.
    const createRes = await req(controllerToken).post('/bank-recon/statements').send({
      bankAccountId: created.bankAccountId,
      statementStartDate: w.startStr,
      statementEndDate: w.endStr,
      openingBalance: 0,
      closingBalance: 0,
    });

    expect(createRes.status).toBe(201);
    const statementId = String(createRes.body?.id ?? '');

    const addLineRes = await req(controllerToken)
      .post(`/bank-recon/statements/${encodeURIComponent(statementId)}/lines`)
      .send({
        lines: [
          {
            txnDate: w.txnStr,
            description: 'Line to test immutability',
            debitAmount: 10,
            creditAmount: 0,
            classification: 'BANK_CHARGE',
          },
        ],
      });

    expect(addLineRes.status).toBe(201);
    const lineId = String(addLineRes.body?.lines?.[0]?.id ?? '');

    await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(lineId)}/create-adjustment`)
      .send({ glAccountId: created.contraGlAccountId, postingDate: w.endStr });

    const reconcileRes = await req(controllerToken).post(
      `/bank-recon/statements/${encodeURIComponent(statementId)}/reconcile`,
    );
    expect(reconcileRes.status).toBe(201);

    const addAfterLock = await req(controllerToken)
      .post(`/bank-recon/statements/${encodeURIComponent(statementId)}/lines`)
      .send({
        lines: [
          {
            txnDate: w.txnStr,
            description: 'Should be blocked',
            debitAmount: 1,
            creditAmount: 0,
          },
        ],
      });
    expect(addAfterLock.status).toBe(400);

    const matchAfterLock = await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(lineId)}/match`)
      .send({ journalLineId: 'non-existent-id' });
    expect(matchAfterLock.status).toBe(400);

    const adjustmentAfterLock = await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(lineId)}/create-adjustment`)
      .send({ glAccountId: created.contraGlAccountId, postingDate: w.endStr });
    expect(adjustmentAfterLock.status).toBe(400);
  });

  it('RBAC: officer cannot reconcile (403)', async () => {
    const w = nextJanWindow();

    const createRes = await req(controllerToken).post('/bank-recon/statements').send({
      bankAccountId: created.bankAccountId,
      statementStartDate: w.startStr,
      statementEndDate: w.endStr,
      openingBalance: 0,
      closingBalance: 0,
    });

    expect(createRes.status).toBe(201);
    const statementId = String(createRes.body?.id ?? '');

    const res = await req(officerToken).post(
      `/bank-recon/statements/${encodeURIComponent(statementId)}/reconcile`,
    );

    expect(res.status).toBe(403);
  });

  it('final-summary returns snapshot only when LOCKED', async () => {
    const w = nextJanWindow();

    const createRes = await req(controllerToken).post('/bank-recon/statements').send({
      bankAccountId: created.bankAccountId,
      statementStartDate: w.startStr,
      statementEndDate: w.endStr,
      openingBalance: 0,
      closingBalance: 0,
    });

    expect(createRes.status).toBe(201);
    const statementId = String(createRes.body?.id ?? '');

    const before = await req(controllerToken).get(
      `/bank-recon/statements/${encodeURIComponent(statementId)}/final-summary`,
    );
    expect(before.status).toBe(400);

    const reconcileRes = await req(controllerToken).post(
      `/bank-recon/statements/${encodeURIComponent(statementId)}/reconcile`,
    );
    expect(reconcileRes.status).toBe(201);

    const after = await req(controllerToken).get(
      `/bank-recon/statements/${encodeURIComponent(statementId)}/final-summary`,
    );
    expect(after.status).toBe(200);
    expect(after.body?.difference).toBe(0);
  });
});
