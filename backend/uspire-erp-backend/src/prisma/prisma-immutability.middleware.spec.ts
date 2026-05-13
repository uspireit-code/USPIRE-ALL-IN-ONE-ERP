import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { runWithSystemContext, withGlLifecycleBypass } from '../internal/request-context.store';

let registeredMiddleware: any = null;

jest.mock('@prisma/client', () => {
  class PrismaClient {
    $use(fn: any) {
      registeredMiddleware = fn;
    }
  }

  return {
    PrismaClient,
    AuditEntityType: {
      JOURNAL_ENTRY: 'JOURNAL_ENTRY',
    },
    AuditEventType: {
      GL_JOURNAL_POST_BLOCKED: 'GL_JOURNAL_POST_BLOCKED',
      GL_LIFECYCLE_BYPASS_BLOCKED: 'GL_LIFECYCLE_BYPASS_BLOCKED',
    },
  };
});

function createMockPrismaClient(overrides: any = {}) {
  return {
    journalEntry: {
      findFirst: jest.fn(),
      ...overrides.journalEntry,
    },
    journalLine: {
      findFirst: jest.fn(),
      ...overrides.journalLine,
    },
    auditEvent: {
      create: jest.fn(),
      ...overrides.auditEvent,
    },
  };
}

function captureMiddleware(): (prismaClient: any, params: any) => Promise<any> {
  registeredMiddleware = null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _svc = new PrismaService();
  if (!registeredMiddleware) {
    throw new Error('Expected PrismaService to register middleware via $use');
  }
  const mw = registeredMiddleware;
  return async (prismaClient: any, params: any) =>
    mw.call(prismaClient, params, async () => ({ ok: true }));
}

describe('Prisma immutability middleware (POSTED journals)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  function parseAuditReason(reason: unknown): any {
    if (typeof reason !== 'string' || reason.trim().length === 0) return {};
    try {
      return JSON.parse(reason);
    } catch {
      return {};
    }
  }

  it('blocks JournalEntry.update when status is POSTED and writes GL_JOURNAL_POST_BLOCKED audit', async () => {
    const prisma = createMockPrismaClient({
      journalEntry: {
        findFirst: jest.fn().mockResolvedValue({ id: 'je1', status: 'POSTED' }),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ae1' }),
      },
    });

    const invoke = captureMiddleware();
    const run = async () =>
      invoke(prisma, {
        model: 'JournalEntry',
        action: 'update',
        args: {
          where: { id: 'je1' },
          data: { description: 'hacked' },
        },
      });

    await expect(
      new Promise<void>((resolve, reject) => {
        runWithSystemContext({ tenantId: 't1' }, () => {
          run().then(resolve).catch(reject);
        });
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.auditEvent.create).toHaveBeenCalled();
    const payload = prisma.auditEvent.create.mock.calls[0]?.[0]?.data;
    expect(payload.tenantId).toBe('t1');
    expect(payload.userId).toBe('SYSTEM');
    expect(payload.requestId).toBe('BACKGROUND_JOB');
    expect(payload.eventType).toBe('GL_JOURNAL_POST_BLOCKED');
    expect(payload.outcome).toBe('BLOCKED');
    expect(payload.entityId).toBe('je1');

    const reason = parseAuditReason(payload.reason);
    expect(reason.metadata?.model).toBe('JournalEntry');
    expect(reason.metadata?.prismaAction).toBe('update');
    expect(reason.metadata?.where).toEqual({ id: 'je1' });
    expect(reason.metadata?.attemptedData).toEqual({ description: 'hacked' });
    expect(reason.metadata?.attemptedKeys).toEqual(['description']);
  });

  it('blocks JournalEntry.upsert update-branch when existing status is POSTED', async () => {
    const prisma = createMockPrismaClient({
      journalEntry: {
        findFirst: jest.fn().mockResolvedValue({ id: 'je1', status: 'POSTED' }),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ae1' }),
      },
    });

    const invoke = captureMiddleware();

    await expect(
      new Promise((resolve, reject) => {
        runWithSystemContext({ tenantId: 't1' }, () => {
          invoke(prisma, {
            model: 'JournalEntry',
            action: 'upsert',
            args: {
              where: { id: 'je1' },
              create: { tenantId: 't1', journalDate: new Date(), status: 'DRAFT' },
              update: { description: 'attempt' },
            },
          })
            .then(resolve)
            .catch(reject);
        });
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.auditEvent.create).toHaveBeenCalled();
    const payload = prisma.auditEvent.create.mock.calls[0]?.[0]?.data;
    const reason = parseAuditReason(payload.reason);
    expect(reason.metadata?.prismaAction).toBe('upsert');
    expect(reason.metadata?.attemptedData).toEqual({ description: 'attempt' });
  });

  it('allows JournalLine.update clearance-only on POSTED parent', async () => {
    const prisma = createMockPrismaClient({
      journalLine: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'jl1',
            journalEntryId: 'je1',
            journalEntry: { id: 'je1', status: 'POSTED' },
          }),
      },
    });

    const invoke = captureMiddleware();

    await expect(
      invoke(prisma, {
        model: 'JournalLine',
        action: 'update',
        args: {
          where: { id: 'jl1' },
          data: { cleared: true, clearedAt: new Date(), bankStatementLineId: 'bs1' },
        },
      }),
    ).resolves.toEqual({ ok: true });
  });

  it('blocks JournalLine.upsert on POSTED parent when non-clearance fields are updated', async () => {
    const prisma = createMockPrismaClient({
      journalLine: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'jl1',
            journalEntryId: 'je1',
            journalEntry: { id: 'je1', status: 'POSTED' },
          }),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ae1' }),
      },
    });

    const invoke = captureMiddleware();

    await expect(
      new Promise((resolve, reject) => {
        runWithSystemContext({ tenantId: 't1' }, () => {
          invoke(prisma, {
            model: 'JournalLine',
            action: 'upsert',
            args: {
              where: { id: 'jl1' },
              create: { tenantId: 't1', journalEntryId: 'je1', accountId: 'a1', debit: 1, credit: 0 },
              update: { debit: 999 },
            },
          })
            .then(resolve)
            .catch(reject);
        });
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.auditEvent.create).toHaveBeenCalled();
    const payload = prisma.auditEvent.create.mock.calls[0]?.[0]?.data;
    const reason = parseAuditReason(payload.reason);
    expect(reason.metadata?.model).toBe('JournalLine');
    expect(reason.metadata?.prismaAction).toBe('upsert');
    expect(reason.metadata?.where).toEqual({ id: 'jl1' });
    expect(reason.metadata?.attemptedData).toEqual({ debit: 999 });
    expect(reason.metadata?.attemptedKeys).toEqual(['debit']);
  });

  it('blocks JournalEntry.updateMany if filter would match any POSTED journal', async () => {
    const prisma = createMockPrismaClient({
      journalEntry: {
        findFirst: jest
          .fn()
          // postedMatch probe
          .mockResolvedValueOnce({ id: 'jePosted' })
          // subsequent reads (if any)
          .mockResolvedValue(null),
      },
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ae1' }),
      },
    });

    const invoke = captureMiddleware();

    await expect(
      new Promise((resolve, reject) => {
        runWithSystemContext({ tenantId: 't1' }, () => {
          invoke(prisma, {
            model: 'JournalEntry',
            action: 'updateMany',
            args: {
              where: { tenantId: 't1' },
              data: { description: 'bulk edit' },
            },
          })
            .then(resolve)
            .catch(reject);
        });
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Prisma lifecycle middleware (nested REVIEWED/POSTED bypass protection)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("blocks nested REVIEWED mutation and emits GL_LIFECYCLE_BYPASS_BLOCKED audit", async () => {
    const prisma = createMockPrismaClient({
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ae1' }),
      },
    });

    const invoke = captureMiddleware();
    const run = async () =>
      invoke(prisma, {
        model: 'SupplierInvoice',
        action: 'update',
        args: {
          where: { id: 'si1' },
          data: {
            journalEntry: {
              update: {
                status: 'REVIEWED',
              },
            },
          },
        },
      });

    await expect(
      new Promise<void>((resolve, reject) => {
        runWithSystemContext({ tenantId: 't1' }, () => {
          run().then(resolve).catch(reject);
        });
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.auditEvent.create).toHaveBeenCalled();
    const payload = prisma.auditEvent.create.mock.calls[0]?.[0]?.data;
    expect(payload.eventType).toBe('GL_LIFECYCLE_BYPASS_BLOCKED');
    expect(payload.outcome).toBe('BLOCKED');
  });

  it("blocks nested POSTED mutation and emits GL_LIFECYCLE_BYPASS_BLOCKED audit", async () => {
    const prisma = createMockPrismaClient({
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ae1' }),
      },
    });

    const invoke = captureMiddleware();
    const run = async () =>
      invoke(prisma, {
        model: 'CustomerReceipt',
        action: 'update',
        args: {
          where: { id: 'cr1' },
          data: {
            journalEntry: {
              update: {
                status: 'POSTED',
              },
            },
          },
        },
      });

    await expect(
      new Promise<void>((resolve, reject) => {
        runWithSystemContext({ tenantId: 't1' }, () => {
          run().then(resolve).catch(reject);
        });
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.auditEvent.create).toHaveBeenCalled();
    const payload = prisma.auditEvent.create.mock.calls[0]?.[0]?.data;
    expect(payload.eventType).toBe('GL_LIFECYCLE_BYPASS_BLOCKED');
    expect(payload.outcome).toBe('BLOCKED');
  });

  it('allows nested lifecycle mutation only within withGlLifecycleBypass context', async () => {
    const prisma = createMockPrismaClient({
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ae1' }),
      },
    });

    const invoke = captureMiddleware();

    await expect(
      new Promise<void>((resolve, reject) => {
        runWithSystemContext({ tenantId: 't1' }, () => {
          withGlLifecycleBypass(() =>
            invoke(prisma, {
              model: 'Payment',
              action: 'update',
              args: {
                where: { id: 'p1' },
                data: {
                  journalEntry: {
                    update: {
                      status: 'REVIEWED',
                    },
                  },
                },
              },
            }),
          )
            .then(() => resolve())
            .catch(reject);
        });
      }),
    ).resolves.toBeUndefined();

    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('blocks nested lifecycle mutation when invoked with a transactional client', async () => {
    const tx = createMockPrismaClient({
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ae1' }),
      },
    });

    const invoke = captureMiddleware();

    await expect(
      new Promise<void>((resolve, reject) => {
        runWithSystemContext({ tenantId: 't1' }, () => {
          invoke(tx, {
            model: 'BankReconciliation',
            action: 'update',
            args: {
              where: { id: 'br1' },
              data: {
                journalEntry: {
                  update: {
                    status: 'POSTED',
                  },
                },
              },
            },
          })
            .then(resolve)
            .catch(reject);
        });
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.auditEvent.create).toHaveBeenCalled();
    const payload = tx.auditEvent.create.mock.calls[0]?.[0]?.data;
    expect(payload.eventType).toBe('GL_LIFECYCLE_BYPASS_BLOCKED');
    expect(payload.outcome).toBe('BLOCKED');
  });
});
