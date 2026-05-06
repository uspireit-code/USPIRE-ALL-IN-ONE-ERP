import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export type IfrsMappingMasterDto = {
  code: string;
  label: string;
  statementType: string;
  section?: string | null;
  allowedAccountType: string;
  displayOrder?: number;
};

@Injectable()
export class IfrsMappingService {
  constructor(private readonly prisma: PrismaService) {}

  async list(req: Request, query: { accountType?: string }) {
    // Explicitly ignore tenant scoping; this is a system-level global master table.
    const accountType = String(query?.accountType ?? '')
      .trim()
      .toUpperCase();

    if (!accountType) {
      throw new BadRequestException('accountType is required');
    }

    const normalize = (s: string) => s.trim().toUpperCase();

    const bsAssetSections = ['CURRENT_ASSET', 'NON_CURRENT_ASSET'];
    const bsLiabilitySections = ['CURRENT_LIABILITY', 'NON_CURRENT_LIABILITY'];
    const bsEquitySections = ['EQUITY'];

    const plIncomeSections = ['REVENUE'];
    const plExpenseSections = ['COST_OF_SALES', 'OPERATING_EXPENSE', 'FINANCE_COST', 'TAX_EXPENSE'];

    const legacyCodeFallbackByAccountType: Record<string, string[]> = {
      ASSET: ['BS_CA', 'BS_NCA'],
      LIABILITY: ['BS_CL'],
      EQUITY: [],
      INCOME: ['PL_REV'],
      EXPENSE: ['PL_EXP_OP'],
    };

    const desired: { statementType?: string; sections?: string[] } = {};
    if (accountType === 'ASSET') desired.statementType = 'BS';
    if (accountType === 'LIABILITY') desired.statementType = 'BS';
    if (accountType === 'EQUITY') desired.statementType = 'BS';
    if (accountType === 'INCOME') desired.statementType = 'PL';
    if (accountType === 'EXPENSE') desired.statementType = 'PL';

    if (accountType === 'ASSET') desired.sections = bsAssetSections;
    if (accountType === 'LIABILITY') desired.sections = bsLiabilitySections;
    if (accountType === 'EQUITY') desired.sections = bsEquitySections;
    if (accountType === 'INCOME') desired.sections = plIncomeSections;
    if (accountType === 'EXPENSE') desired.sections = plExpenseSections;

    const legacyCodes = legacyCodeFallbackByAccountType[accountType] ?? [];

    const items = await (this.prisma as any).ifrsMappingMaster.findMany({
      where: {
        isActive: true,
        allowedAccountType: accountType,
        AND: [
          desired.statementType
            ? {
                OR: [
                  { statementType: desired.statementType },
                  { statementType: normalize(desired.statementType) },
                ],
              }
            : {},
          desired.sections && desired.sections.length > 0
            ? {
                OR: [
                  { section: { in: desired.sections } },
                  { section: null },
                  { code: { in: legacyCodes } },
                ],
              }
            : {},
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
      select: {
        code: true,
        label: true,
        statementType: true,
        section: true,
        allowedAccountType: true,
        displayOrder: true,
      },
    });

    return items as IfrsMappingMasterDto[];
  }
}
