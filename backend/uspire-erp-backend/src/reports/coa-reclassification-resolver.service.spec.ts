import { CoaReclassificationResolverService } from './coa-reclassification-resolver.service';

function mockPrisma(params: {
  accounts: Array<{
    id: string;
    parentAccountId: string | null;
    ifrsMappingCode: string | null;
    fsMappingLevel1: string | null;
    fsMappingLevel2: string | null;
  }>;
  reclasses: Array<{
    id: string;
    accountId: string;
    effectiveStartDate: Date;
    status: 'APPROVED' | 'DRAFT' | 'PENDING' | 'REJECTED';
    newParentAccountId: string | null;
    newIfrsMappingCode: string | null;
    newFsMappingLevel1: string | null;
    newFsMappingLevel2: string | null;
  }>;
}) {
  return {
    account: {
      findMany: jest.fn(async (q: any) => {
        const ids: string[] = q?.where?.id?.in ?? [];
        return params.accounts.filter((a) => ids.includes(a.id));
      }),
    },
    cOAReclassification: {
      findMany: jest.fn(async (q: any) => {
        const ids: string[] = q?.where?.accountId?.in ?? [];
        const lte: Date | undefined = q?.where?.effectiveStartDate?.lte;
        const status: string | undefined = q?.where?.status;

        return params.reclasses
          .filter((r) => ids.includes(r.accountId))
          .filter((r) => (status ? r.status === status : true))
          .filter((r) => (lte ? r.effectiveStartDate <= lte : true))
          .sort((a, b) => {
            if (a.accountId !== b.accountId) return a.accountId.localeCompare(b.accountId);
            return b.effectiveStartDate.getTime() - a.effectiveStartDate.getTime();
          });
      }),
    },
  };
}

describe('CoaReclassificationResolverService', () => {
  test('no reclassifications => base values', async () => {
    const prisma = mockPrisma({
      accounts: [
        {
          id: 'A1',
          parentAccountId: 'P0',
          ifrsMappingCode: 'IFRS:OLD',
          fsMappingLevel1: 'FS1',
          fsMappingLevel2: 'FS2',
        },
      ],
      reclasses: [],
    });

    const svc = new CoaReclassificationResolverService(prisma as any);
    const res = await svc.resolveAccountAsOfDate({
      tenantId: 'T1',
      accountId: 'A1',
      asOfDate: '2026-01-31',
    });

    expect(res.appliedReclassificationId).toBeNull();
    expect(res.resolvedParentAccountId).toBe('P0');
    expect(res.resolvedIfrsMappingCode).toBe('IFRS:OLD');
    expect(res.resolvedFsMappingLevel1).toBe('FS1');
    expect(res.resolvedFsMappingLevel2).toBe('FS2');
  });

  test('reclassification effective in future => base values for prior date', async () => {
    const prisma = mockPrisma({
      accounts: [
        {
          id: 'A1',
          parentAccountId: 'P0',
          ifrsMappingCode: 'IFRS:OLD',
          fsMappingLevel1: 'FS1',
          fsMappingLevel2: 'FS2',
        },
      ],
      reclasses: [
        {
          id: 'R1',
          accountId: 'A1',
          effectiveStartDate: new Date('2026-02-01T00:00:00.000Z'),
          status: 'APPROVED',
          newParentAccountId: 'P1',
          newIfrsMappingCode: 'IFRS:NEW',
          newFsMappingLevel1: 'FS1N',
          newFsMappingLevel2: 'FS2N',
        },
      ],
    });

    const svc = new CoaReclassificationResolverService(prisma as any);
    const res = await svc.resolveAccountAsOfDate({
      tenantId: 'T1',
      accountId: 'A1',
      asOfDate: '2026-01-31',
    });

    expect(res.appliedReclassificationId).toBeNull();
    expect(res.resolvedParentAccountId).toBe('P0');
    expect(res.resolvedIfrsMappingCode).toBe('IFRS:OLD');
  });

  test('reclassification effective <= date => overlay applied (nulls do not overwrite)', async () => {
    const prisma = mockPrisma({
      accounts: [
        {
          id: 'A1',
          parentAccountId: 'P0',
          ifrsMappingCode: 'IFRS:OLD',
          fsMappingLevel1: 'FS1',
          fsMappingLevel2: 'FS2',
        },
      ],
      reclasses: [
        {
          id: 'R1',
          accountId: 'A1',
          effectiveStartDate: new Date('2026-02-01T00:00:00.000Z'),
          status: 'APPROVED',
          newParentAccountId: null,
          newIfrsMappingCode: 'IFRS:NEW',
          newFsMappingLevel1: null,
          newFsMappingLevel2: 'FS2N',
        },
      ],
    });

    const svc = new CoaReclassificationResolverService(prisma as any);
    const res = await svc.resolveAccountAsOfDate({
      tenantId: 'T1',
      accountId: 'A1',
      asOfDate: '2026-02-28',
    });

    expect(res.appliedReclassificationId).toBe('R1');
    expect(res.appliedEffectiveStartDate).toBe('2026-02-01');
    expect(res.resolvedParentAccountId).toBe('P0');
    expect(res.resolvedIfrsMappingCode).toBe('IFRS:NEW');
    expect(res.resolvedFsMappingLevel1).toBe('FS1');
    expect(res.resolvedFsMappingLevel2).toBe('FS2N');
  });

  test('multiple approved reclassifications => latest effectiveStartDate wins', async () => {
    const prisma = mockPrisma({
      accounts: [
        {
          id: 'A1',
          parentAccountId: 'P0',
          ifrsMappingCode: 'IFRS:OLD',
          fsMappingLevel1: 'FS1',
          fsMappingLevel2: 'FS2',
        },
      ],
      reclasses: [
        {
          id: 'R1',
          accountId: 'A1',
          effectiveStartDate: new Date('2026-02-01T00:00:00.000Z'),
          status: 'APPROVED',
          newParentAccountId: 'P1',
          newIfrsMappingCode: 'IFRS:NEW1',
          newFsMappingLevel1: 'FS1N',
          newFsMappingLevel2: 'FS2N',
        },
        {
          id: 'R2',
          accountId: 'A1',
          effectiveStartDate: new Date('2026-03-01T00:00:00.000Z'),
          status: 'APPROVED',
          newParentAccountId: 'P2',
          newIfrsMappingCode: 'IFRS:NEW2',
          newFsMappingLevel1: 'FS1N2',
          newFsMappingLevel2: 'FS2N2',
        },
      ],
    });

    const svc = new CoaReclassificationResolverService(prisma as any);
    const res = await svc.resolveAccountAsOfDate({
      tenantId: 'T1',
      accountId: 'A1',
      asOfDate: '2026-03-31',
    });

    expect(res.appliedReclassificationId).toBe('R2');
    expect(res.appliedEffectiveStartDate).toBe('2026-03-01');
    expect(res.resolvedParentAccountId).toBe('P2');
    expect(res.resolvedIfrsMappingCode).toBe('IFRS:NEW2');
  });
});
