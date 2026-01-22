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

describe('Bank Reconciliation Matching Engine (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  let tenantId: string;

  let officerToken: string;
  let controllerToken: string;

  let officerUserId: string;
  let controllerUserId: string;

  let statementSeq = 0;

  function nextStatementWindow() {
    statementSeq += 1;

    // Generate a non-overlapping window per statement for the same bank account.
    // Must include a valid txnDate within the window.
    const start = new Date(Date.UTC(2030, 0, 1) + statementSeq * 40 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const txn = new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000);

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
    bankGlAccountId?: string;
    contraGlAccountId?: string;
    bankAccountId?: string;
    statementId?: string;
    statementLineId?: string;
    journalId?: string;
    journalLineId?: string;
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
  }

  async function ensureAccounts() {
    const bankGl = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: 'T-BR-BANK' } },
      create: {
        tenantId,
        code: 'T-BR-BANK',
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
      where: { tenantId_code: { tenantId, code: 'T-BR-CONTRA' } },
      create: {
        tenantId,
        code: 'T-BR-CONTRA',
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
      where: { tenantId_name: { tenantId, name: 'T-BR-BANK-ACC' } },
      create: {
        tenantId,
        name: 'T-BR-BANK-ACC',
        bankName: 'Test Bank',
        accountNumber: 'BR-0001',
        type: 'BANK',
        currency: 'USD',
        glAccountId: created.bankGlAccountId,
        status: 'ACTIVE',
        openingBalance: 0,
      } as any,
      update: {
        bankName: 'Test Bank',
        accountNumber: 'BR-0001',
        type: 'BANK',
        currency: 'USD',
        glAccountId: created.bankGlAccountId,
        status: 'ACTIVE',
      } as any,
      select: { id: true },
    });

    created.bankAccountId = bank.id;
  }

  async function ensureStatementWithDebitLine100() {
    const w = nextStatementWindow();
    const createRes = await req(controllerToken)
      .post('/bank-recon/statements')
      .send({
        bankAccountId: created.bankAccountId,
        statementStartDate: w.startStr,
        statementEndDate: w.endStr,
        openingBalance: 0,
        closingBalance: 0,
      });

    expect(createRes.status).toBe(201);
    expect(String(createRes.body?.id ?? '')).toBeTruthy();
    created.statementId = String(createRes.body.id);

    const addRes = await req(controllerToken)
      .post(`/bank-recon/statements/${encodeURIComponent(created.statementId)}/lines`)
      .send({
        lines: [
          {
            txnDate: w.txnStr,
            description: 'Test debit outflow',
            debitAmount: 100,
            creditAmount: 0,
          },
        ],
      });

    expect(addRes.status).toBe(201);
    expect(Array.isArray(addRes.body?.lines)).toBe(true);
    expect(String(addRes.body.lines?.[0]?.id ?? '')).toBeTruthy();
    created.statementLineId = String(addRes.body.lines[0].id);
  }

  async function ensurePostedJournalWithBankCredit100() {
    const now = new Date('2026-01-10T00:00:00.000Z');

    const journal = await prisma.journalEntry.create({
      data: {
        tenantId,
        status: 'POSTED',
        createdById: controllerUserId,
        postedById: controllerUserId,
        postedAt: now,
        journalDate: now,
        reference: `T-BR-J-${Date.now()}`,
        description: 'Test bank outflow journal',
        lines: {
          create: [
            {
              accountId: created.bankGlAccountId,
              debit: 0,
              credit: 100,
              description: 'Bank credit 100',
            },
            {
              accountId: created.contraGlAccountId,
              debit: 100,
              credit: 0,
              description: 'Contra debit 100',
            },
          ],
        },
      } as any,
      include: { lines: true },
    });

    created.journalId = journal.id;

    const bankLine = journal.lines.find((l) => l.accountId === created.bankGlAccountId);
    expect(bankLine).toBeTruthy();
    created.journalLineId = String(bankLine!.id);
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

    if (!officerUser || !controllerUser) {
      throw new Error('Seed users not found (officer/controller)');
    }

    officerUserId = officerUser.id;
    controllerUserId = controllerUser.id;

    // Ensure controller has BANK_RECONCILE + BANK_RECONCILIATION_VIEW before login
    // (tokens capture permissions at issuance time).
    const [controllerRoles, permReconcile, permView, permStatementImport] = await Promise.all([
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

  it('matches a statement debit line to a posted bank credit journal line (success)', async () => {
    await ensureStatementWithDebitLine100();
    await ensurePostedJournalWithBankCredit100();

    const res = await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(created.statementLineId!)}/match`)
      .send({ journalLineId: created.journalLineId });

    expect(res.status).toBe(201);

    const stmtLine = await prisma.bankStatementLine.findUnique({
      where: { id: created.statementLineId! },
    });

    expect(stmtLine?.matched).toBe(true);
    expect(String(stmtLine?.matchedJournalLineId ?? '')).toBe(created.journalLineId);

    const jl = await prisma.journalLine.findUnique({ where: { id: created.journalLineId! } });
    expect(jl?.cleared).toBe(true);
    expect(String(jl?.bankStatementLineId ?? '')).toBe(created.statementLineId);
  });

  it('blocks match when statement is LOCKED', async () => {
    const w = nextStatementWindow();
    const lockedStatement = await prisma.bankStatement.create({
      data: {
        tenantId,
        bankAccountId: created.bankAccountId!,
        statementStartDate: w.start,
        statementEndDate: w.end,
        openingBalance: 0,
        closingBalance: 0,
        status: 'LOCKED',
        createdByUserId: controllerUserId,
      } as any,
      select: { id: true },
    });

    const line = await prisma.bankStatementLine.create({
      data: {
        statementId: lockedStatement.id,
        txnDate: w.txn,
        description: 'Locked stmt line',
        debitAmount: 50,
        creditAmount: 0,
        matched: false,
        classification: 'UNIDENTIFIED',
      } as any,
      select: { id: true },
    });

    const res = await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(line.id)}/match`)
      .send({ journalLineId: created.journalLineId });

    expect(res.status).toBe(400);
  });

  it('blocks match when journal line already cleared', async () => {
    const journal = await prisma.journalEntry.create({
      data: {
        tenantId,
        status: 'POSTED',
        createdById: controllerUserId,
        postedById: controllerUserId,
        postedAt: new Date('2026-01-10T00:00:00.000Z'),
        journalDate: new Date('2026-01-10T00:00:00.000Z'),
        reference: `T-BR-JC-${Date.now()}`,
        description: 'Already cleared',
        lines: {
          create: [
            {
              accountId: created.bankGlAccountId,
              debit: 0,
              credit: 100,
              description: 'Bank credit 100',
              cleared: true,
              clearedAt: new Date('2026-01-11T00:00:00.000Z'),
            },
            {
              accountId: created.contraGlAccountId,
              debit: 100,
              credit: 0,
              description: 'Contra',
            },
          ],
        },
      } as any,
      include: { lines: true },
    });

    const clearedLine = journal.lines.find((l) => l.accountId === created.bankGlAccountId);
    expect(clearedLine).toBeTruthy();

    const w = nextStatementWindow();
    const stmt = await prisma.bankStatement.create({
      data: {
        tenantId,
        bankAccountId: created.bankAccountId!,
        statementStartDate: w.start,
        statementEndDate: w.end,
        openingBalance: 0,
        closingBalance: 0,
        status: 'DRAFT',
        createdByUserId: controllerUserId,
      } as any,
      select: { id: true },
    });

    const stmtLine = await prisma.bankStatementLine.create({
      data: {
        statementId: stmt.id,
        txnDate: w.txn,
        description: 'To match',
        debitAmount: 100,
        creditAmount: 0,
        matched: false,
        classification: 'UNIDENTIFIED',
      } as any,
      select: { id: true },
    });

    const res = await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(stmtLine.id)}/match`)
      .send({ journalLineId: clearedLine!.id });

    expect(res.status).toBe(400);
  });

  it('blocks match on amount/direction mismatch', async () => {
    const journal = await prisma.journalEntry.create({
      data: {
        tenantId,
        status: 'POSTED',
        createdById: controllerUserId,
        postedById: controllerUserId,
        postedAt: new Date('2026-01-10T00:00:00.000Z'),
        journalDate: new Date('2026-01-10T00:00:00.000Z'),
        reference: `T-BR-JM-${Date.now()}`,
        description: 'Mismatch',
        lines: {
          create: [
            {
              accountId: created.bankGlAccountId,
              debit: 100,
              credit: 0,
              description: 'Bank debit 100 (inflow)',
            },
            {
              accountId: created.contraGlAccountId,
              debit: 0,
              credit: 100,
              description: 'Contra credit',
            },
          ],
        },
      } as any,
      include: { lines: true },
    });

    const bankLine = journal.lines.find((l) => l.accountId === created.bankGlAccountId);
    expect(bankLine).toBeTruthy();

    const w = nextStatementWindow();

    const stmt = await prisma.bankStatement.create({
      data: {
        tenantId,
        bankAccountId: created.bankAccountId!,
        statementStartDate: w.start,
        statementEndDate: w.end,
        openingBalance: 0,
        closingBalance: 0,
        status: 'DRAFT',
        createdByUserId: controllerUserId,
      } as any,
      select: { id: true },
    });

    const stmtLine = await prisma.bankStatementLine.create({
      data: {
        statementId: stmt.id,
        txnDate: w.txn,
        description: 'Statement debit outflow 100',
        debitAmount: 100,
        creditAmount: 0,
        matched: false,
        classification: 'UNIDENTIFIED',
      } as any,
      select: { id: true },
    });

    const res = await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(stmtLine.id)}/match`)
      .send({ journalLineId: bankLine!.id });

    expect(res.status).toBe(400);
  });

  it('unmatches successfully', async () => {
    const w = nextStatementWindow();
    const stmt = await prisma.bankStatement.create({
      data: {
        tenantId,
        bankAccountId: created.bankAccountId!,
        statementStartDate: w.start,
        statementEndDate: w.end,
        openingBalance: 0,
        closingBalance: 0,
        status: 'DRAFT',
        createdByUserId: controllerUserId,
      } as any,
      select: { id: true },
    });

    const stmtLine = await prisma.bankStatementLine.create({
      data: {
        statementId: stmt.id,
        txnDate: w.txn,
        description: 'Statement debit outflow 55',
        debitAmount: 55,
        creditAmount: 0,
        matched: false,
        classification: 'UNIDENTIFIED',
      } as any,
      select: { id: true },
    });

    const journal = await prisma.journalEntry.create({
      data: {
        tenantId,
        status: 'POSTED',
        createdById: controllerUserId,
        postedById: controllerUserId,
        postedAt: new Date('2026-01-10T00:00:00.000Z'),
        journalDate: new Date('2026-01-10T00:00:00.000Z'),
        reference: `T-BR-JU-${Date.now()}`,
        description: 'To unmatch',
        lines: {
          create: [
            {
              accountId: created.bankGlAccountId,
              debit: 0,
              credit: 55,
              description: 'Bank credit 55',
            },
            {
              accountId: created.contraGlAccountId,
              debit: 55,
              credit: 0,
              description: 'Contra',
            },
          ],
        },
      } as any,
      include: { lines: true },
    });

    const bankLine = journal.lines.find((l) => l.accountId === created.bankGlAccountId);
    expect(bankLine).toBeTruthy();

    const matchRes = await req(controllerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(stmtLine.id)}/match`)
      .send({ journalLineId: bankLine!.id });
    expect(matchRes.status).toBe(201);

    const unmatchRes = await req(controllerToken).post(
      `/bank-recon/lines/${encodeURIComponent(stmtLine.id)}/unmatch`,
    );

    expect(unmatchRes.status).toBe(201);

    const stmtLineAfter = await prisma.bankStatementLine.findUnique({
      where: { id: stmtLine.id },
    });
    expect(stmtLineAfter?.matched).toBe(false);
    expect(stmtLineAfter?.matchedJournalLineId).toBeNull();

    const jlAfter = await prisma.journalLine.findUnique({ where: { id: bankLine!.id } });
    expect(jlAfter?.cleared).toBe(false);
    expect(jlAfter?.clearedAt).toBeNull();
    expect(jlAfter?.bankStatementLineId).toBeNull();
  });

  it('permissions: officer cannot match/unmatch (403)', async () => {
    const w = nextStatementWindow();
    const stmt = await prisma.bankStatement.create({
      data: {
        tenantId,
        bankAccountId: created.bankAccountId!,
        statementStartDate: w.start,
        statementEndDate: w.end,
        openingBalance: 0,
        closingBalance: 0,
        status: 'DRAFT',
        createdByUserId: controllerUserId,
      } as any,
      select: { id: true },
    });

    const stmtLine = await prisma.bankStatementLine.create({
      data: {
        statementId: stmt.id,
        txnDate: w.txn,
        description: 'Statement debit outflow 20',
        debitAmount: 20,
        creditAmount: 0,
        matched: false,
        classification: 'UNIDENTIFIED',
      } as any,
      select: { id: true },
    });

    const journal = await prisma.journalEntry.create({
      data: {
        tenantId,
        status: 'POSTED',
        createdById: controllerUserId,
        postedById: controllerUserId,
        postedAt: new Date('2026-01-10T00:00:00.000Z'),
        journalDate: new Date('2026-01-10T00:00:00.000Z'),
        reference: `T-BR-JP-${Date.now()}`,
        description: 'Permissions',
        lines: {
          create: [
            {
              accountId: created.bankGlAccountId,
              debit: 0,
              credit: 20,
              description: 'Bank credit 20',
            },
            {
              accountId: created.contraGlAccountId,
              debit: 20,
              credit: 0,
              description: 'Contra',
            },
          ],
        },
      } as any,
      include: { lines: true },
    });

    const bankLine = journal.lines.find((l) => l.accountId === created.bankGlAccountId);
    expect(bankLine).toBeTruthy();

    const matchRes = await req(officerToken)
      .post(`/bank-recon/lines/${encodeURIComponent(stmtLine.id)}/match`)
      .send({ journalLineId: bankLine!.id });

    expect(matchRes.status).toBe(403);

    const unmatchRes = await req(officerToken).post(
      `/bank-recon/lines/${encodeURIComponent(stmtLine.id)}/unmatch`,
    );

    expect(unmatchRes.status).toBe(403);
  });

  it('preview endpoint returns totals and counts', async () => {
    // Create a statement with closing balance 500
    const w = nextStatementWindow();
    const stmt = await prisma.bankStatement.create({
      data: {
        tenantId,
        bankAccountId: created.bankAccountId!,
        statementStartDate: w.start,
        statementEndDate: w.end,
        openingBalance: 0,
        closingBalance: 500,
        status: 'DRAFT',
        createdByUserId: controllerUserId,
      } as any,
      select: { id: true },
    });

    // Post a journal impacting bank GL: debit 700, credit 200 => balance +500
    await prisma.journalEntry.create({
      data: {
        tenantId,
        status: 'POSTED',
        createdById: controllerUserId,
        postedById: controllerUserId,
        postedAt: new Date('2026-01-20T00:00:00.000Z'),
        journalDate: new Date('2026-01-20T00:00:00.000Z'),
        reference: `T-BR-PV-${Date.now()}`,
        description: 'Preview journal',
        lines: {
          create: [
            { accountId: created.bankGlAccountId, debit: 700, credit: 0 } as any,
            { accountId: created.contraGlAccountId, debit: 0, credit: 700 } as any,
            { accountId: created.bankGlAccountId, debit: 0, credit: 200 } as any,
            { accountId: created.contraGlAccountId, debit: 200, credit: 0 } as any,
          ],
        },
      } as any,
    });

    const res = await req(controllerToken).get(
      `/bank-recon/statements/${encodeURIComponent(stmt.id)}/preview`,
    );

    expect(res.status).toBe(200);
    expect(typeof res.body?.bankClosingBalance).toBe('number');
    expect(typeof res.body?.systemBankBalanceAsAtEndDate).toBe('number');
    expect(typeof res.body?.outstandingPaymentsTotal).toBe('number');
    expect(typeof res.body?.depositsInTransitTotal).toBe('number');
    expect(typeof res.body?.matchedCount).toBe('number');
    expect(typeof res.body?.unmatchedStatementLinesCount).toBe('number');
  });
});
