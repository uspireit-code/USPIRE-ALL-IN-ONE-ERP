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

describe('Bank Reconciliation Adjustment Journals (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  let tenantId: string;

  let officerToken: string;
  let controllerToken: string;

  let controllerUserId: string;

  let statementSeq = 0;

  function nextJanWindow() {
    statementSeq += 1;

    // Keep within Jan 2026 (OPEN period in tests) but unique end dates.
    const start = new Date(Date.UTC(2026, 0, 1));
    const end = new Date(Date.UTC(2026, 0, Math.min(31, 10 + statementSeq))); // 2026-01-11, 12, ...
    const txn = new Date(Date.UTC(2026, 0, Math.min(31, 5 + statementSeq))); // txn within window

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
    // Closed-period test window
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
    expenseAccountId?: string;
    incomeAccountId?: string;
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
      where: { tenantId_code: { tenantId, code: 'T-BR3-BANK' } },
      create: {
        tenantId,
        code: 'T-BR3-BANK',
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

    const expense = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: 'T-BR3-EXP' } },
      create: {
        tenantId,
        code: 'T-BR3-EXP',
        name: 'Test Bank Charges Expense',
        type: 'EXPENSE',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      update: {
        name: 'Test Bank Charges Expense',
        type: 'EXPENSE',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      select: { id: true },
    });

    const income = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: 'T-BR3-INC' } },
      create: {
        tenantId,
        code: 'T-BR3-INC',
        name: 'Test Interest Income',
        type: 'INCOME',
        normalBalance: 'CREDIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      update: {
        name: 'Test Interest Income',
        type: 'INCOME',
        normalBalance: 'CREDIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      select: { id: true },
    });

    created.bankGlAccountId = bankGl.id;
    created.expenseAccountId = expense.id;
    created.incomeAccountId = income.id;
  }

  async function ensureBankAccount() {
    const bank = await prisma.bankAccount.upsert({
      where: { tenantId_name: { tenantId, name: 'T-BR3-BANK-ACC' } },
      create: {
        tenantId,
        name: 'T-BR3-BANK-ACC',
        bankName: 'Test Bank',
        accountNumber: 'BR3-0001',
        type: 'BANK',
        currency: 'USD',
        glAccountId: created.bankGlAccountId,
        status: 'ACTIVE',
        openingBalance: 0,
      } as any,
      update: {
        bankName: 'Test Bank',
        accountNumber: 'BR3-0001',
        type: 'BANK',
        currency: 'USD',
        glAccountId: created.bankGlAccountId,
        status: 'ACTIVE',
      } as any,
      select: { id: true },
    });

    created.bankAccountId = bank.id;
  }

  async function createStatementWithLine(params: {
    classification: string;
    debitAmount: number;
    creditAmount: number;
    window: ReturnType<typeof nextJanWindow> | ReturnType<typeof febWindow>;
    statementStatus?: 'DRAFT' | 'LOCKED' | 'RECONCILED' | 'IN_PROGRESS';
  }) {
    // Keep tests independent: statement creation enforces non-overlapping ranges and unique end dates.
    // Clean any prior statements for this test bank account.
    const priorLineIds = (
      await prisma.bankStatementLine.findMany({
        where: {
          statement: {
            tenantId,
            bankAccountId: created.bankAccountId,
          },
        },
        select: { id: true },
      })
    ).map((l) => l.id);

    if (priorLineIds.length) {
      await prisma.journalLine.updateMany({
        where: {
          bankStatementLineId: { in: priorLineIds },
        },
        data: {
          bankStatementLineId: null,
          cleared: false,
          clearedAt: null,
        },
      });
    }

    await prisma.bankStatement.deleteMany({
      where: {
        tenantId,
        bankAccountId: created.bankAccountId,
      },
    });

    const createRes = await req(controllerToken)
      .post('/bank-recon/statements')
      .send({
        bankAccountId: created.bankAccountId,
        statementStartDate: params.window.startStr,
        statementEndDate: params.window.endStr,
        openingBalance: 0,
        closingBalance: 0,
      });

    expect(createRes.status).toBe(201);
    const statementId = String(createRes.body?.id ?? '');
    expect(statementId).toBeTruthy();

    const addRes = await req(controllerToken)
      .post(`/bank-recon/statements/${encodeURIComponent(statementId)}/lines`)
      .send({
        lines: [
          {
            txnDate: params.window.txnStr,
            description: `Test ${params.classification} line`,
            debitAmount: params.debitAmount,
            creditAmount: params.creditAmount,
            classification: params.classification,
          },
        ],
      });

    expect(addRes.status).toBe(201);
    const lineId = String(addRes.body?.lines?.[0]?.id ?? '');
    expect(lineId).toBeTruthy();

    // Some endpoints (like adding lines) may be blocked when a statement is LOCKED/RECONCILED.
    // Apply final status after line creation.
    if (params.statementStatus && params.statementStatus !== 'DRAFT') {
      await prisma.bankStatement.update({
        where: { id: statementId },
        data: { status: params.statementStatus } as any,
      });
    }

    return { statementId, lineId };
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

    const controllerUser = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: 'controller@uspire.local' } },
      select: { id: true },
    });

    if (!controllerUser) throw new Error('Seed controller user not found');
    controllerUserId = controllerUser.id;

    // Ensure controller has needed perms before login
    const [controllerRoles, permReconcile, permView, permStatementImport] =
      await Promise.all([
        prisma.userRole.findMany({
          where: { userId: controllerUserId, role: { tenantId } },
          select: { roleId: true },
        }),
        prisma.permission.findUnique({
          where: { code: 'BANK_RECONCILE' },
          select: { id: true },
        }),
        prisma.permission.findUnique({
          where: { code: 'BANK_RECONCILIATION_VIEW' },
          select: { id: true },
        }),
        prisma.permission.findUnique({
          where: { code: 'BANK_STATEMENT_IMPORT' },
          select: { id: true },
        }),
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

    controllerToken = (await login('controller@uspire.local', 'Controller123'))
      .accessToken;
    officerToken = (await login('officer@uspire.local', 'Officer123')).accessToken;

    await ensurePeriods();
    await ensureAccounts();
    await ensureBankAccount();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('BANK_CHARGE adjustment creates POSTED journal and auto-clears + matches', async () => {
    const w = nextJanWindow();
    const { lineId } = await createStatementWithLine({
      classification: 'BANK_CHARGE',
      debitAmount: 100,
      creditAmount: 0,
      window: w,
    });

    const res = await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(lineId)}/create-adjustment`)
      .send({
        glAccountId: created.expenseAccountId,
        postingDate: w.endStr,
        memo: 'Test charge',
      });

    expect(res.status).toBe(201);
    expect(String(res.body?.journal?.id ?? '')).toBeTruthy();

    const stmtLine = await prisma.bankStatementLine.findUnique({
      where: { id: lineId },
    });

    expect(stmtLine?.matched).toBe(true);
    expect(String((stmtLine as any)?.adjustmentJournalId ?? '')).toBeTruthy();
    expect(String(stmtLine?.matchedJournalLineId ?? '')).toBeTruthy();
    expect(String(stmtLine?.classification ?? '')).toBe('SYSTEM_MATCH');

    const journal = await prisma.journalEntry.findUnique({
      where: { id: (stmtLine as any)!.adjustmentJournalId! },
      include: { lines: true },
    });

    expect(journal?.status).toBe('POSTED');

    const bankLine = journal?.lines.find(
      (l) => l.accountId === created.bankGlAccountId,
    );
    const expLine = journal?.lines.find(
      (l) => l.accountId === created.expenseAccountId,
    );

    expect(bankLine).toBeTruthy();
    expect(expLine).toBeTruthy();

    // BANK_CHARGE: Dr Expense / Cr Bank
    expect(Number(expLine!.debit)).toBe(100);
    expect(Number(expLine!.credit)).toBe(0);
    expect(Number(bankLine!.debit)).toBe(0);
    expect(Number(bankLine!.credit)).toBe(100);

    const clearedJl = await prisma.journalLine.findUnique({
      where: { id: stmtLine!.matchedJournalLineId! },
    });
    expect(clearedJl?.cleared).toBe(true);
    expect(String(clearedJl?.bankStatementLineId ?? '')).toBe(lineId);
  });

  it('INTEREST adjustment creates POSTED journal and auto-clears + matches', async () => {
    const w = nextJanWindow();
    const { lineId } = await createStatementWithLine({
      classification: 'INTEREST',
      debitAmount: 0,
      creditAmount: 50,
      window: w,
    });

    const res = await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(lineId)}/create-adjustment`)
      .send({
        glAccountId: created.incomeAccountId,
        postingDate: w.endStr,
      });

    expect(res.status).toBe(201);

    const stmtLine = await prisma.bankStatementLine.findUnique({
      where: { id: lineId },
    });

    expect(stmtLine?.matched).toBe(true);
    expect(String((stmtLine as any)?.adjustmentJournalId ?? '')).toBeTruthy();

    const journal = await prisma.journalEntry.findUnique({
      where: { id: (stmtLine as any)!.adjustmentJournalId! },
      include: { lines: true },
    });

    const bankLine = journal?.lines.find(
      (l: any) => l.accountId === created.bankGlAccountId,
    );
    const incLine = journal?.lines.find(
      (l: any) => l.accountId === created.incomeAccountId,
    );

    // INTEREST: Dr Bank / Cr Income
    expect(Number(bankLine!.debit)).toBe(50);
    expect(Number(bankLine!.credit)).toBe(0);
    expect(Number(incLine!.debit)).toBe(0);
    expect(Number(incLine!.credit)).toBe(50);
  });

  it('blocks when statement is LOCKED', async () => {
    const w = nextJanWindow();
    const { lineId } = await createStatementWithLine({
      classification: 'BANK_CHARGE',
      debitAmount: 10,
      creditAmount: 0,
      window: w,
      statementStatus: 'LOCKED',
    });

    const res = await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(lineId)}/create-adjustment`)
      .send({ glAccountId: created.expenseAccountId, postingDate: w.endStr });

    expect(res.status).toBe(400);
  });

  it('blocks when line already matched', async () => {
    const w = nextJanWindow();
    const { lineId } = await createStatementWithLine({
      classification: 'BANK_CHARGE',
      debitAmount: 10,
      creditAmount: 0,
      window: w,
    });

    await prisma.bankStatementLine.update({
      where: { id: lineId },
      data: { matched: true, classification: 'SYSTEM_MATCH' as any },
    });

    const res = await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(lineId)}/create-adjustment`)
      .send({ glAccountId: created.expenseAccountId, postingDate: w.endStr });

    expect(res.status).toBe(400);
  });

  it('blocks when classification is not BANK_CHARGE/INTEREST', async () => {
    const w = nextJanWindow();
    const { lineId } = await createStatementWithLine({
      classification: 'UNIDENTIFIED',
      debitAmount: 1,
      creditAmount: 0,
      window: w,
    });

    const res = await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(lineId)}/create-adjustment`)
      .send({ glAccountId: created.expenseAccountId, postingDate: w.endStr });

    expect(res.status).toBe(400);
  });

  it('blocks when posting period is CLOSED', async () => {
    const w = febWindow();
    const { lineId } = await createStatementWithLine({
      classification: 'BANK_CHARGE',
      debitAmount: 10,
      creditAmount: 0,
      window: w,
    });

    const res = await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(lineId)}/create-adjustment`)
      .send({ glAccountId: created.expenseAccountId, postingDate: w.endStr });

    expect(res.status).toBe(400);
  });

  it('permissions: officer cannot create adjustment (403)', async () => {
    const w = nextJanWindow();
    const { lineId } = await createStatementWithLine({
      classification: 'BANK_CHARGE',
      debitAmount: 10,
      creditAmount: 0,
      window: w,
    });

    const res = await req(officerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(lineId)}/create-adjustment`)
      .send({ glAccountId: created.expenseAccountId, postingDate: w.endStr });

    expect(res.status).toBe(403);
  });
});
