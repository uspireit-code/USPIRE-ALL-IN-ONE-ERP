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

describe('Imprest Settlement Journal Posting (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  let tenantId: string;

  let officerUserId: string;
  let managerUserId: string;
  let controllerUserId: string;

  let officerToken: string;
  let controllerToken: string;

  const created: {
    openPeriodId?: string;
    closedPeriodId?: string;
    controlAccountId?: string;
    bankGlAccountId?: string;
    expenseAccountAId?: string;
    expenseAccountBId?: string;
    bankAccountId?: string;
    policyId?: string;
    facilityId?: string;
    caseId?: string;
    issuedJournalId?: string;
    settlementJournalId?: string;
    entityId?: string;
    departmentId?: string;
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

  async function ensureAccounts() {
    const control = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: 'T-IMP-CONTROL' } },
      create: {
        tenantId,
        code: 'T-IMP-CONTROL',
        name: 'Test Imprest Control',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      update: {
        name: 'Test Imprest Control',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      select: { id: true },
    });

    const bankGl = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: 'T-IMP-BANK' } },
      create: {
        tenantId,
        code: 'T-IMP-BANK',
        name: 'Test Imprest Bank GL',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      update: {
        name: 'Test Imprest Bank GL',
        type: 'ASSET',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      select: { id: true },
    });

    const expenseA = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: 'T-EXP-A' } },
      create: {
        tenantId,
        code: 'T-EXP-A',
        name: 'Test Expense A',
        type: 'EXPENSE',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      update: {
        name: 'Test Expense A',
        type: 'EXPENSE',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      select: { id: true },
    });

    const expenseB = await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: 'T-EXP-B' } },
      create: {
        tenantId,
        code: 'T-EXP-B',
        name: 'Test Expense B',
        type: 'EXPENSE',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      update: {
        name: 'Test Expense B',
        type: 'EXPENSE',
        normalBalance: 'DEBIT',
        isActive: true,
        isPosting: true,
        isPostingAllowed: true,
      } as any,
      select: { id: true },
    });

    created.controlAccountId = control.id;
    created.bankGlAccountId = bankGl.id;
    created.expenseAccountAId = expenseA.id;
    created.expenseAccountBId = expenseB.id;
  }

  async function ensureBankAccount() {
    const bank = await prisma.bankAccount.upsert({
      where: { tenantId_name: { tenantId, name: 'T-IMPREST-BANK' } },
      create: {
        tenantId,
        name: 'T-IMPREST-BANK',
        bankName: 'Test Bank',
        accountNumber: '000123',
        type: 'BANK',
        currency: 'USD',
        glAccountId: created.bankGlAccountId,
        status: 'ACTIVE',
        openingBalance: 0,
      } as any,
      update: {
        bankName: 'Test Bank',
        accountNumber: '000123',
        type: 'BANK',
        currency: 'USD',
        glAccountId: created.bankGlAccountId,
        status: 'ACTIVE',
      } as any,
      select: { id: true },
    });

    created.bankAccountId = bank.id;
  }

  async function ensureOrgRefs() {
    const entity = await prisma.entity.findFirst({
      where: { tenantId },
      select: { id: true },
    });
    if (!entity) throw new Error('No entity found for tenant');

    const department = await prisma.department.findFirst({
      where: { tenantId },
      select: { id: true },
    });
    if (!department) throw new Error('No department found for tenant');

    created.entityId = entity.id;
    created.departmentId = department.id;

    await prisma.legalEntity.upsert({
      where: { tenantId_code: { tenantId, code: 'T-LE-ENTITY' } },
      create: {
        tenantId,
        code: 'T-LE-ENTITY',
        name: 'USPIRE Demo Entity',
        isActive: true,
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        effectiveTo: null,
        createdById: controllerUserId,
      } as any,
      update: {
        name: 'USPIRE Demo Entity',
        isActive: true,
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        effectiveTo: null,
      } as any,
      select: { id: true },
    });
  }

  async function ensurePolicyAndFacility() {
    const policy = await prisma.imprestTypePolicy.create({
      data: {
        tenantId,
        name: `T-POL-${Date.now()}`,
        defaultFloatLimit: 100000,
        settlementDays: 7,
        receiptRule: 'NONE',
        receiptThresholdAmount: null,
        approvalStrength: 'SINGLE',
        defaultRiskRating: 'LOW',
        effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        effectiveTo: new Date('2030-01-01T00:00:00.000Z'),
        isActive: true,
        createdById: controllerUserId,
      } as any,
      select: { id: true },
    });

    const facility = await prisma.imprestFacility.create({
      data: {
        tenantId,
        typePolicyId: policy.id,
        custodianUserId: officerUserId,
        entityId: created.entityId,
        departmentId: created.departmentId,
        projectId: null,
        fundId: null,
        currency: 'USD',
        approvedFloatLimit: 100000,
        settlementDays: 7,
        fundingSourceType: 'BANK',
        bankAccountId: created.bankAccountId,
        riskRating: 'LOW',
        controlGlAccountId: created.controlAccountId,
        validFrom: new Date('2025-01-01T00:00:00.000Z'),
        validTo: new Date('2030-01-01T00:00:00.000Z'),
        status: 'ACTIVE',
        createdById: controllerUserId,
      } as any,
      select: { id: true },
    });

    created.policyId = policy.id;
    created.facilityId = facility.id;
  }

  async function createIssuedCaseWithSettlement(params: {
    reference: string;
    requestedAmount: number;
    issueDate: Date;
    settlementDate: Date;
    expenseA: number;
    expenseB: number;
    cashReturn: number;
  }) {
    const issuanceJournal = await prisma.journalEntry.create({
      data: {
        tenantId,
        reference: params.reference,
        description: `Imprest issuance: ${params.reference}`,
        status: 'POSTED',
        createdById: controllerUserId,
        postedById: controllerUserId,
        postedAt: params.issueDate,
        journalDate: params.issueDate,
        journalType: 'STANDARD',
        periodId: created.openPeriodId,
        journalNumber: 999000 + Math.floor(Math.random() * 1000),
        sourceType: 'IMPREST_ISSUANCE',
        sourceId: `T-SRC-${Date.now()}`,
        lines: {
          create: [
            {
              accountId: created.controlAccountId,
              debit: params.requestedAmount,
              credit: 0,
              lineNumber: 1,
            },
            {
              accountId: created.bankGlAccountId,
              debit: 0,
              credit: params.requestedAmount,
              lineNumber: 2,
            },
          ],
        },
      } as any,
      select: { id: true },
    });

    const imprestCase = await prisma.imprestCase.create({
      data: {
        tenantId,
        facilityId: created.facilityId,
        reference: params.reference,
        purpose: 'Test imprest',
        justification: 'Test',
        periodFrom: new Date('2026-01-01T00:00:00.000Z'),
        periodTo: new Date('2026-01-31T00:00:00.000Z'),
        expectedSettlementDate: params.settlementDate,
        requestedAmount: params.requestedAmount,
        currency: 'USD',
        state: 'ISSUED',
        createdById: officerUserId,
        issuedAt: params.issueDate,
        issuedById: controllerUserId,
        issuedJournalId: issuanceJournal.id,
        settlementLines: {
          create: [
            {
              tenantId,
              type: 'EXPENSE',
              glAccountId: created.expenseAccountAId,
              description: 'Expense A',
              amount: params.expenseA,
              spentDate: params.settlementDate,
              createdById: officerUserId,
            },
            {
              tenantId,
              type: 'EXPENSE',
              glAccountId: created.expenseAccountBId,
              description: 'Expense B',
              amount: params.expenseB,
              spentDate: params.settlementDate,
              createdById: officerUserId,
            },
            {
              tenantId,
              type: 'CASH_RETURN',
              glAccountId: null,
              description: 'Cash returned',
              amount: params.cashReturn,
              spentDate: params.settlementDate,
              createdById: officerUserId,
            },
          ],
        },
      } as any,
      select: { id: true },
    });

    return { caseId: imprestCase.id };
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
    await ensureAccounts();
    await ensureBankAccount();
    await ensureOrgRefs();
    await ensurePolicyAndFacility();

    officerToken = (await login('officer@uspire.local', 'Officer123')).accessToken;
    controllerToken = (await login('controller@uspire.local', 'Controller123')).accessToken;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('posts a settlement journal and links it to the case', async () => {
    const settlementDate = new Date('2026-01-10T00:00:00.000Z');
    const issueDate = new Date('2026-01-05T00:00:00.000Z');

    const { caseId } = await createIssuedCaseWithSettlement({
      reference: `T-IMP-${Date.now()}`,
      requestedAmount: 100,
      issueDate,
      settlementDate,
      expenseA: 60,
      expenseB: 30,
      cashReturn: 10,
    });

    const res = await req(controllerToken)
      .post(`/imprest/cases/${encodeURIComponent(caseId)}/settle`)
      .send({ settlementDate: '2026-01-10' });

    expect(res.status).toBe(201);
    expect(res.body?.id).toBe(caseId);
    expect(String(res.body?.state ?? '')).toBe('SETTLED');
    expect(String(res.body?.settlementJournalId ?? '')).toBeTruthy();

    const settlementJournalId = String(res.body.settlementJournalId);

    const journal = await prisma.journalEntry.findFirst({
      where: { id: settlementJournalId, tenantId },
      include: { lines: true },
    });

    expect(journal).toBeTruthy();
    expect(String(journal!.status)).toBe('POSTED');
    expect(String(journal!.sourceType)).toBe('IMPREST_SETTLEMENT');
    expect(String(journal!.sourceId)).toBe(caseId);

    const lines = journal!.lines;

    const facility = await prisma.imprestFacility.findFirst({
      where: { id: String(created.facilityId), tenantId },
      include: { entity: true },
    });
    expect(facility).toBeTruthy();
    expect(facility!.entity).toBeTruthy();

    const mappedLegalEntity = await prisma.legalEntity.findFirst({
      where: { tenantId, name: String(facility!.entity.name) },
      select: { id: true },
    });
    expect(mappedLegalEntity).toBeTruthy();

    for (const l of lines) {
      expect(String((l as any).legalEntityId ?? '')).toBe(String(mappedLegalEntity!.id));
      expect(String((l as any).departmentId ?? '')).toBe(String(created.departmentId));
      expect((l as any).projectId ?? null).toBeNull();
      expect((l as any).fundId ?? null).toBeNull();
    }

    const byAccount = new Map<string, { debit: number; credit: number }>();
    for (const l of lines) {
      byAccount.set(String(l.accountId), {
        debit: Number(l.debit),
        credit: Number(l.credit),
      });
    }

    expect(byAccount.get(String(created.expenseAccountAId))?.debit).toBe(60);
    expect(byAccount.get(String(created.expenseAccountBId))?.debit).toBe(30);
    expect(byAccount.get(String(created.bankGlAccountId))?.debit).toBe(10);
    expect(byAccount.get(String(created.controlAccountId))?.credit).toBe(100);

    const updated = await prisma.imprestCase.findFirst({
      where: { id: caseId, tenantId },
      select: { settlementJournalId: true, settledAt: true, settledByUserId: true },
    });

    expect(String(updated?.settlementJournalId ?? '')).toBe(settlementJournalId);
    expect(updated?.settledAt).toBeTruthy();
    expect(String(updated?.settledByUserId ?? '')).toBe(controllerUserId);
  });

  it('blocks settling when a settlement journal already exists (idempotency)', async () => {
    const settlementDate = new Date('2026-01-12T00:00:00.000Z');
    const issueDate = new Date('2026-01-06T00:00:00.000Z');

    const { caseId } = await createIssuedCaseWithSettlement({
      reference: `T-IMP-${Date.now()}`,
      requestedAmount: 50,
      issueDate,
      settlementDate,
      expenseA: 40,
      expenseB: 10,
      cashReturn: 0,
    });

    const first = await req(controllerToken)
      .post(`/imprest/cases/${encodeURIComponent(caseId)}/settle`)
      .send({ settlementDate: '2026-01-12' });

    expect(first.status).toBe(201);

    const second = await req(controllerToken)
      .post(`/imprest/cases/${encodeURIComponent(caseId)}/settle`)
      .send({ settlementDate: '2026-01-12' });

    expect(second.status).toBe(400);
    expect(String(second.body?.message ?? '')).toMatch(/already settled|settlement journal already exists/i);
  });

  it('blocks posting when accounting period is CLOSED for the settlement date', async () => {
    const settlementDate = new Date('2025-12-10T00:00:00.000Z');
    const issueDate = new Date('2026-01-07T00:00:00.000Z');

    const { caseId } = await createIssuedCaseWithSettlement({
      reference: `T-IMP-${Date.now()}`,
      requestedAmount: 100,
      issueDate,
      settlementDate,
      expenseA: 90,
      expenseB: 10,
      cashReturn: 0,
    });

    const res = await req(controllerToken)
      .post(`/imprest/cases/${encodeURIComponent(caseId)}/settle`)
      .send({ settlementDate: '2025-12-10' });

    expect(res.status).toBe(403);
  });

  it('enforces permissions: officer cannot settle', async () => {
    const settlementDate = new Date('2026-01-14T00:00:00.000Z');
    const issueDate = new Date('2026-01-08T00:00:00.000Z');

    const { caseId } = await createIssuedCaseWithSettlement({
      reference: `T-IMP-${Date.now()}`,
      requestedAmount: 100,
      issueDate,
      settlementDate,
      expenseA: 100,
      expenseB: 0,
      cashReturn: 0,
    });

    const res = await req(officerToken)
      .post(`/imprest/cases/${encodeURIComponent(caseId)}/settle`)
      .send({ settlementDate: '2026-01-14' });

    expect(res.status).toBe(403);
  });
});
