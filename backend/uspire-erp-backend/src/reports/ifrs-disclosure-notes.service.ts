import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialStatementsService } from './financial-statements.service';
import { ReportsService } from './reports.service';
import type {
  IfrsDisclosureNoteCode,
  IfrsDisclosureNoteDto,
  IfrsDisclosureNotesIndexItem,
  IfrsDisclosureTable,
} from './ifrs-disclosure-notes.types';

@Injectable()
export class IfrsDisclosureNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fs: FinancialStatementsService,
    private readonly reports: ReportsService,
  ) {}

  private validationError(params: {
    message: string;
    missingFields: string[];
    guidance: string;
  }): BadRequestException {
    return new BadRequestException({
      error: 'IFRS_VALIDATION_ERROR',
      message: params.message,
      missingFields: params.missingFields,
      guidance: params.guidance,
    });
  }

  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  private utcDateOnly(d: Date) {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  private addUtcDays(d: Date, days: number) {
    return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private assertTieOut(params: {
    noteCode: string;
    statement: 'BS' | 'PL' | 'CF' | 'SOCE';
    label: string;
    expected: number;
    actual: number;
    tolerance?: number;
  }) {
    const tol = params.tolerance ?? 0.01;
    const e = this.round2(params.expected);
    const a = this.round2(params.actual);
    const diff = this.round2(a - e);
    if (Math.abs(diff) > tol) {
      throw new BadRequestException({
        error: 'IFRS_RECONCILIATION_ERROR',
        message: `IFRS Disclosure Note ${params.noteCode} does not reconcile to the ${params.statement} statement.`,
        noteCode: params.noteCode,
        statement: params.statement,
        label: params.label,
      });
    }
  }

  private async getClosedPeriodOrThrow(tenantId: string, periodId: string) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, tenantId },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!period) throw new NotFoundException('Accounting period not found');
    if (period.status !== 'CLOSED') {
      throw new BadRequestException(
        'IFRS Disclosure Notes require a closed accounting period.',
      );
    }

    return period;
  }

  private async getCurrencyConfigOrThrow(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { defaultCurrency: true },
    });

    const functionalCurrency = tenant?.defaultCurrency?.trim() || null;
    const presentationCurrency = tenant?.defaultCurrency?.trim() || null;

    if (!functionalCurrency || !presentationCurrency) {
      throw this.validationError({
        message:
          'Missing currency configuration: defaultCurrency is required in Settings.',
        missingFields: ['defaultCurrency'],
        guidance: 'Set this under Settings → Organisation.',
      });
    }

    return { functionalCurrency, presentationCurrency };
  }

  private async getEntityInfoOrThrow(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        organisationName: true,
        legalName: true,
        country: true,
        timezone: true,
      },
    });

    if (!tenant) throw new BadRequestException('Tenant not found');

    const organisationName = (tenant.organisationName ?? '').trim();
    const legalName = (tenant.legalName ?? '').trim();
    const country = (tenant.country ?? '').trim();
    const timezone = (tenant.timezone ?? '').trim();

    const missingFields: string[] = [];
    if (!organisationName) missingFields.push('organisationName');
    if (!legalName) missingFields.push('legalName');
    if (!country) missingFields.push('country');
    if (!timezone) missingFields.push('timezone');

    if (missingFields.length > 0) {
      throw this.validationError({
        message: `Missing entity information: ${missingFields.join(', ')} ${missingFields.length === 1 ? 'is' : 'are'} required in Settings.`,
        missingFields,
        guidance: 'Set this under Settings → Organisation.',
      });
    }

    return { organisationName, legalName, country, timezone };
  }

  private classifyCashAccount(a: { code: string; name: string; type: string }) {
    const n = `${a.code} ${a.name}`.toLowerCase();
    if (a.type !== 'ASSET') return false;
    return n.includes('cash') || n.includes('bank') || a.code === '1000';
  }

  private classifyPpeAccount(a: { code: string; name: string; type: string }) {
    const n = `${a.code} ${a.name}`.toLowerCase();
    if (a.type !== 'ASSET') return false;
    return (
      n.includes('property') ||
      n.includes('plant') ||
      n.includes('equipment') ||
      n.includes('ppe') ||
      n.includes('fixed asset')
    );
  }

  private classifyAccumulatedDepreciationAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'ASSET') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      n.includes('accumulated') &&
      (n.includes('depreciation') ||
        n.includes('amortisation') ||
        n.includes('amortization'))
    );
  }

  private classifyAllowanceForDoubtfulDebtsAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'ASSET') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      (n.includes('allowance') ||
        n.includes('provision') ||
        n.includes('impair')) &&
      (n.includes('receivable') || n.includes('debt'))
    );
  }

  private classifyArControlOrTradeReceivableAccount(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'ASSET') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      n.includes('accounts receivable') ||
      n.includes('trade receivable') ||
      (n.includes('ar') && n.includes('control')) ||
      (n.includes('receivable') && n.includes('control'))
    );
  }

  private classifyDepreciationExpense(a: {
    code: string;
    name: string;
    type: string;
  }) {
    if (a.type !== 'EXPENSE') return false;
    const n = `${a.code} ${a.name}`.toLowerCase();
    return (
      n.includes('depreciation') || n.includes('amort') || n.includes('depr')
    );
  }

  private async balanceByAccountAsOf(params: {
    tenantId: string;
    asOf: Date;
  }): Promise<
    Map<
      string,
      { id: string; code: string; name: string; type: string; net: number }
    >
  > {
    const grouped = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          tenantId: params.tenantId,
          status: 'POSTED',
          journalDate: { lte: params.asOf },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const accountIds = grouped.map((g) => g.accountId);
    const accounts = await this.prisma.account.findMany({
      where: { tenantId: params.tenantId, id: { in: accountIds } },
      select: { id: true, code: true, name: true, type: true },
    });
    const byId = new Map(accounts.map((a) => [a.id, a] as const));

    const out = new Map<
      string,
      { id: string; code: string; name: string; type: string; net: number }
    >();
    for (const g of grouped) {
      const acc = byId.get(g.accountId);
      if (!acc) continue;
      const debit = Number(g._sum?.debit ?? 0);
      const credit = Number(g._sum?.credit ?? 0);
      out.set(g.accountId, {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        net: this.round2(debit - credit),
      });
    }
    return out;
  }

  listNotes(): IfrsDisclosureNotesIndexItem[] {
    return [
      { noteCode: 'A', title: 'Basis of preparation' },
      { noteCode: 'B', title: 'Significant accounting policies' },
      { noteCode: 'C', title: 'Property, plant and equipment' },
      { noteCode: 'D', title: 'Depreciation' },
      { noteCode: 'E', title: 'Trade and other receivables' },
      { noteCode: 'F', title: 'Cash and cash equivalents' },
      { noteCode: 'G', title: 'Equity' },
      { noteCode: 'H', title: 'Income tax' },
    ];
  }

  async generateNote(
    req: Request,
    params: { periodId: string; noteCode: IfrsDisclosureNoteCode },
  ): Promise<IfrsDisclosureNoteDto> {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const period = await this.getClosedPeriodOrThrow(
      tenant.id,
      params.periodId,
    );
    const [currency, entityInfo] = await Promise.all([
      this.getCurrencyConfigOrThrow(tenant.id),
      this.getEntityInfoOrThrow(tenant.id),
    ]);

    const from = this.utcDateOnly(period.startDate).toISOString().slice(0, 10);
    const to = this.utcDateOnly(period.endDate).toISOString().slice(0, 10);
    const asOf = to;
    const openingAsOf = this.addUtcDays(this.utcDateOnly(period.startDate), -1)
      .toISOString()
      .slice(0, 10);

    if (params.noteCode === 'A')
      return this.noteA({
        periodName: period.name,
        from,
        to,
        ...currency,
        ...entityInfo,
      });
    if (params.noteCode === 'B') return this.noteB({ ...currency });

    if (params.noteCode === 'C')
      return this.noteC(req, { from, to, asOf, openingAsOf });
    if (params.noteCode === 'D') return this.noteD(req, { from, to });
    if (params.noteCode === 'E')
      return this.noteE(req, { asOf, openingAsOf, from, to });
    if (params.noteCode === 'F') return this.noteF(req, { from, to });
    if (params.noteCode === 'G')
      return this.noteG(req, { from, to, openingAsOf });
    if (params.noteCode === 'H')
      return this.noteH(req, {
        periodId: period.id,
        startDate: period.startDate,
        endDate: period.endDate,
        asOf,
      });

    throw new NotFoundException('Unknown IFRS note code');
  }

  private noteA(params: {
    periodName: string;
    from: string;
    to: string;
    organisationName: string;
    legalName: string;
    country: string;
    timezone: string;
    functionalCurrency: string;
    presentationCurrency: string;
  }): IfrsDisclosureNoteDto {
    const entityTable: IfrsDisclosureTable = {
      title: 'Entity information',
      columns: [
        { key: 'field', label: 'Field', align: 'left' },
        { key: 'value', label: 'Value', align: 'left' },
      ],
      rows: [
        { field: 'Entity name', value: params.organisationName },
        { field: 'Legal name', value: params.legalName },
        { field: 'Country', value: params.country },
        { field: 'Timezone', value: params.timezone },
        { field: 'Reporting period', value: `${params.from} to ${params.to}` },
        { field: 'Functional currency', value: params.functionalCurrency },
        { field: 'Presentation currency', value: params.presentationCurrency },
      ],
    };

    const measurementTable: IfrsDisclosureTable = {
      title: 'Basis of measurement and compliance',
      columns: [
        { key: 'policy', label: 'Policy', align: 'left' },
        { key: 'summary', label: 'Summary', align: 'left' },
      ],
      rows: [
        {
          policy: 'Compliance with IFRS',
          summary:
            'The financial statements have been prepared in accordance with International Financial Reporting Standards (IFRS).',
        },
        {
          policy: 'Measurement basis',
          summary:
            'The financial statements have been prepared on the historical cost basis, except where IFRS requires a different measurement basis.',
        },
      ],
    };

    return {
      noteCode: 'A',
      title: 'Basis of preparation',
      narrative: `These financial statements have been prepared in accordance with International Financial Reporting Standards (IFRS). The financial statements have been prepared on the historical cost basis, except as otherwise stated in the significant accounting policies. The financial statements have been prepared on a going concern basis. The financial statements are presented in ${params.presentationCurrency} and the functional currency of the entity is ${params.functionalCurrency}.`,
      footnotes: [
        'The reporting period and presentation currency are disclosed in the entity information table.',
      ],
      tables: [entityTable, measurementTable],
      statementReferences: [
        {
          statement: 'BS',
          asOf: params.to,
        },
        {
          statement: 'PL',
          from: params.from,
          to: params.to,
        },
        {
          statement: 'CF',
          from: params.from,
          to: params.to,
        },
      ],
    };
  }

  private noteB(params: {
    functionalCurrency: string;
    presentationCurrency: string;
  }): IfrsDisclosureNoteDto {
    const narrative =
      'The accounting policies set out below have been applied consistently to all periods presented in these financial statements.';
    const tables: IfrsDisclosureTable[] = [
      {
        title: 'Summary of significant accounting policies',
        columns: [
          { key: 'policy', label: 'Policy', align: 'left' },
          { key: 'summary', label: 'Summary', align: 'left' },
        ],
        rows: [
          {
            policy: 'Revenue recognition',
            summary:
              'Revenue is recognised when control of goods or services is transferred to the customer, in an amount that reflects the consideration expected to be received.',
          },
          {
            policy: 'Property, plant and equipment (PPE)',
            summary:
              'Property, plant and equipment are stated at cost less accumulated depreciation and accumulated impairment losses. Depreciation is charged so as to allocate the cost of assets over their estimated useful lives.',
          },
          {
            policy: 'Depreciation methods',
            summary:
              "Depreciation is calculated using a systematic basis that reflects the pattern in which the asset's future economic benefits are expected to be consumed. Residual values and useful lives are reviewed at each reporting date.",
          },
          {
            policy: 'Trade and other receivables (impairment)',
            summary:
              'Trade and other receivables are initially recognised at fair value and subsequently measured at amortised cost, net of expected credit losses.',
          },
          {
            policy: 'Cash and cash equivalents',
            summary:
              'Cash and cash equivalents comprise cash on hand and demand deposits. Bank overdrafts are presented separately as liabilities where applicable.',
          },
          {
            policy: 'Income taxes',
            summary:
              'Current tax is the expected tax payable on taxable profit for the period. Deferred tax is recognised on temporary differences between the carrying amounts of assets and liabilities and their tax bases.',
          },
          {
            policy: 'Functional and presentation currency',
            summary: `Transactions are recorded in the functional currency. The financial statements are presented in ${params.presentationCurrency}.`,
          },
        ],
      },
    ];

    return {
      noteCode: 'B',
      title: 'Significant accounting policies',
      narrative,
      footnotes: [
        'The policies summarised above are intended to be read together with the other disclosures in these financial statements.',
      ],
      tables,
      statementReferences: [],
    };
  }

  private async noteC(
    req: Request,
    params: { from: string; to: string; asOf: string; openingAsOf: string },
  ): Promise<IfrsDisclosureNoteDto> {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const categories = await this.prisma.fixedAssetCategory.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    if (categories.length === 0) {
      throw new BadRequestException(
        'Cannot generate PPE note: no fixed asset categories configured.',
      );
    }

    const assets = await this.prisma.fixedAsset.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ['CAPITALIZED', 'DISPOSED'] },
      },
      select: {
        id: true,
        categoryId: true,
        name: true,
        cost: true,
        capitalizationDate: true,
        status: true,
        disposalJournalId: true,
      },
    });

    const disposalJournalIds = assets
      .map((a) => a.disposalJournalId)
      .filter(Boolean) as string[];
    const disposalJournals = disposalJournalIds.length
      ? await this.prisma.journalEntry.findMany({
          where: {
            tenantId: tenant.id,
            id: { in: disposalJournalIds },
            status: 'POSTED',
          },
          select: { id: true, journalDate: true },
        })
      : [];
    const disposalDateByJournalId = new Map(
      disposalJournals.map(
        (j) => [j.id, this.utcDateOnly(j.journalDate)] as const,
      ),
    );

    for (const a of assets) {
      if (a.status === 'DISPOSED') {
        if (!a.disposalJournalId) {
          throw new BadRequestException(
            `Cannot generate PPE note: disposed asset '${a.name}' is missing disposalJournalId.`,
          );
        }
        const dd = disposalDateByJournalId.get(a.disposalJournalId);
        if (!dd) {
          throw new BadRequestException(
            `Cannot generate PPE note: disposal journal for asset '${a.name}' is missing or not POSTED.`,
          );
        }
      }
    }

    const openingAsOfDate = this.utcDateOnly(new Date(params.openingAsOf));
    const closingAsOfDate = this.utcDateOnly(new Date(params.asOf));
    const fromDate = this.utcDateOnly(new Date(params.from));
    const toDate = this.utcDateOnly(new Date(params.to));

    const assetIds = assets.map((a) => a.id);
    const depLines = assetIds.length
      ? await this.prisma.fixedAssetDepreciationLine.findMany({
          where: {
            tenantId: tenant.id,
            assetId: { in: assetIds },
            run: {
              journalEntry: { status: 'POSTED' },
            },
          },
          select: {
            assetId: true,
            amount: true,
            run: { select: { period: { select: { endDate: true } } } },
          },
        })
      : [];

    const depByAsset = new Map<string, Array<{ end: Date; amount: number }>>();
    for (const l of depLines) {
      const arr = depByAsset.get(l.assetId) ?? [];
      arr.push({
        end: this.utcDateOnly(l.run.period.endDate),
        amount: Number(l.amount),
      });
      depByAsset.set(l.assetId, arr);
    }
    for (const arr of depByAsset.values()) {
      arr.sort((a, b) => a.end.getTime() - b.end.getTime());
    }

    const depTo = (assetId: string, asOf: Date) => {
      const arr = depByAsset.get(assetId);
      if (!arr?.length) return 0;
      let s = 0;
      for (const l of arr) {
        if (l.end.getTime() <= asOf.getTime()) s += l.amount;
      }
      return this.round2(s);
    };

    const depInPeriod = (assetId: string, from: Date, to: Date) => {
      const arr = depByAsset.get(assetId);
      if (!arr?.length) return 0;
      let s = 0;
      for (const l of arr) {
        if (
          l.end.getTime() >= from.getTime() &&
          l.end.getTime() <= to.getTime()
        )
          s += l.amount;
      }
      return this.round2(s);
    };

    const catsById = new Map(categories.map((c) => [c.id, c] as const));
    type CatRow = {
      classCode: string;
      className: string;
      opening: number;
      additions: number;
      disposals: number;
      depreciation: number;
      closing: number;
    };
    const rowsByCatId = new Map<string, CatRow>();
    for (const c of categories) {
      rowsByCatId.set(c.id, {
        classCode: c.code,
        className: c.name,
        opening: 0,
        additions: 0,
        disposals: 0,
        depreciation: 0,
        closing: 0,
      });
    }

    const disposalDate = (a: (typeof assets)[number]) =>
      a.disposalJournalId
        ? (disposalDateByJournalId.get(a.disposalJournalId) ?? null)
        : null;

    for (const a of assets) {
      const cat = catsById.get(a.categoryId);
      if (!cat) continue;
      const row = rowsByCatId.get(a.categoryId);
      if (!row) continue;

      const capDate = a.capitalizationDate
        ? this.utcDateOnly(a.capitalizationDate)
        : null;
      if (!capDate) {
        throw new BadRequestException(
          `Cannot generate PPE note: asset '${a.name}' is missing capitalizationDate.`,
        );
      }

      const dispDate = disposalDate(a);

      const isInServiceAt = (asOf: Date) => {
        if (capDate.getTime() > asOf.getTime()) return false;
        if (!dispDate) return true;
        return dispDate.getTime() > asOf.getTime();
      };

      const cost = Number(a.cost);

      if (isInServiceAt(openingAsOfDate)) {
        const nbv = this.round2(cost - depTo(a.id, openingAsOfDate));
        row.opening = this.round2(row.opening + nbv);
      }

      if (isInServiceAt(closingAsOfDate)) {
        const nbv = this.round2(cost - depTo(a.id, closingAsOfDate));
        row.closing = this.round2(row.closing + nbv);
      }

      if (
        capDate.getTime() >= fromDate.getTime() &&
        capDate.getTime() <= toDate.getTime()
      ) {
        row.additions = this.round2(row.additions + cost);
      }

      if (
        dispDate &&
        dispDate.getTime() >= fromDate.getTime() &&
        dispDate.getTime() <= toDate.getTime()
      ) {
        const nbvAtDisposal = this.round2(cost - depTo(a.id, dispDate));
        row.disposals = this.round2(row.disposals + nbvAtDisposal);
      }

      row.depreciation = this.round2(
        row.depreciation + depInPeriod(a.id, fromDate, toDate),
      );
    }

    const [bsOpening, bsClosing, cf, pl] = await Promise.all([
      this.fs.computeBalanceSheet(req, { asOf: params.openingAsOf }),
      this.fs.computeBalanceSheet(req, { asOf: params.asOf }),
      this.fs.computeCashFlowIndirect(req, {
        from: params.from,
        to: params.to,
      }),
      this.fs.computeProfitAndLoss(req, { from: params.from, to: params.to }),
    ]);

    const openingPpeNet = this.round2(
      bsOpening.assets.rows
        .filter((r) => r.accountCode === 'PPE_NET')
        .reduce((s, r) => s + r.balance, 0),
    );
    const closingPpeNet = this.round2(
      bsClosing.assets.rows
        .filter((r) => r.accountCode === 'PPE_NET')
        .reduce((s, r) => s + r.balance, 0),
    );

    const ppePurchasesCash = this.round2(
      cf.investing.rows
        .filter((r) => r.label.toLowerCase().includes('purchase of property'))
        .reduce((s, r) => s + r.amount, 0),
    );
    const ppeProceedsCash = this.round2(
      cf.investing.rows
        .filter((r) =>
          r.label.toLowerCase().includes('proceeds from sale of property'),
        )
        .reduce((s, r) => s + r.amount, 0),
    );

    const additionsFromFa = this.round2(
      [...rowsByCatId.values()].reduce((s, r) => s + r.additions, 0),
    );
    const additionsFromCf = this.round2(Math.abs(ppePurchasesCash));
    if (additionsFromFa === 0 && additionsFromCf !== 0) {
      throw new BadRequestException(
        'Cannot reconcile PPE additions: cash flow shows PPE purchases but no assets were capitalised in the fixed asset register for the period.',
      );
    }
    if (additionsFromFa !== 0 && additionsFromCf === 0) {
      throw new BadRequestException(
        'Cannot reconcile PPE additions: assets were capitalised in the fixed asset register but no PPE purchases were classified in the investing cash flow. Non-cash or unclassified additions detected.',
      );
    }
    this.assertTieOut({
      noteCode: 'C',
      statement: 'CF',
      label:
        'PPE additions (fixed asset register) to cash flow investing purchases of PPE',
      expected: additionsFromFa,
      actual: additionsFromCf,
      tolerance: 0.01,
    });

    const additions = additionsFromFa;
    const disposals = this.round2(
      -1 * [...rowsByCatId.values()].reduce((s, r) => s + r.disposals, 0),
    );

    const depreciationExpense = this.round2(
      pl.expenses.rows
        .filter((x) =>
          this.classifyDepreciationExpense({
            code: x.accountCode,
            name: x.accountName,
            type: 'EXPENSE',
          }),
        )
        .reduce((s, r) => s + r.balance, 0),
    );

    const depFromFa = this.round2(
      [...rowsByCatId.values()].reduce((s, r) => s + r.depreciation, 0),
    );
    this.assertTieOut({
      noteCode: 'C',
      statement: 'PL',
      label:
        'Depreciation for the period (fixed asset register) to depreciation expense (P&L)',
      expected: depFromFa,
      actual: depreciationExpense,
      tolerance: 0.01,
    });

    const depreciation = this.round2(-Math.abs(depreciationExpense));

    const computedClosing = this.round2(
      openingPpeNet + additions + disposals + depreciation,
    );

    this.assertTieOut({
      noteCode: 'C',
      statement: 'BS',
      label:
        'PPE movement (opening + additions + disposals + depreciation) to closing PPE_NET',
      expected: closingPpeNet,
      actual: computedClosing,
      tolerance: 0.01,
    });

    const byClassTable: IfrsDisclosureTable = {
      title: 'Movements in net book value by class',
      columns: [
        { key: 'className', label: 'Class of asset', align: 'left' },
        { key: 'opening', label: 'Opening', align: 'right' },
        { key: 'additions', label: 'Additions', align: 'right' },
        { key: 'disposals', label: 'Disposals', align: 'right' },
        { key: 'depreciation', label: 'Depreciation', align: 'right' },
        { key: 'closing', label: 'Closing', align: 'right' },
      ],
      rows: [...rowsByCatId.values()].map((r) => ({
        className: `${r.className} (${r.classCode})`,
        opening: r.opening,
        additions: r.additions,
        disposals: this.round2(-1 * r.disposals),
        depreciation: this.round2(-1 * r.depreciation),
        closing: r.closing,
      })),
    };

    const totalRow = {
      className: 'Total',
      opening: this.round2(
        [...rowsByCatId.values()].reduce((s, r) => s + r.opening, 0),
      ),
      additions: additions,
      disposals: disposals,
      depreciation: depreciation,
      closing: this.round2(
        [...rowsByCatId.values()].reduce((s, r) => s + r.closing, 0),
      ),
    };
    this.assertTieOut({
      noteCode: 'C',
      statement: 'BS',
      label: 'PPE closing total by class to Balance Sheet PPE_NET',
      expected: closingPpeNet,
      actual: totalRow.closing,
      tolerance: 0.01,
    });

    const summaryTable: IfrsDisclosureTable = {
      title: 'Total movements in net book value',
      columns: [
        { key: 'movement', label: 'Movement', align: 'left' },
        { key: 'amount', label: 'Amount', align: 'right' },
      ],
      rows: [
        { movement: 'Opening net book value', amount: openingPpeNet },
        { movement: 'Additions', amount: additions },
        { movement: 'Disposals', amount: disposals },
        { movement: 'Depreciation', amount: depreciation },
        { movement: 'Closing net book value', amount: closingPpeNet },
        {
          movement: 'Proceeds from disposals (cash flow investing)',
          amount: ppeProceedsCash,
        },
      ],
    };

    return {
      noteCode: 'C',
      title: 'Property, plant and equipment',
      narrative:
        'Property, plant and equipment are stated at cost less accumulated depreciation and accumulated impairment losses. The movements in property, plant and equipment for the period are set out below.',
      footnotes: [
        'The closing balance agrees to the Statement of Financial Position.',
        'Additions agree to purchases of property, plant and equipment presented in investing activities in the Statement of Cash Flows.',
        'Depreciation expense agrees to depreciation presented in profit or loss.',
      ],
      tables: [byClassTable, summaryTable],
      statementReferences: [
        {
          statement: 'BS',
          lineCode: 'PPE_NET',
          lineLabel: 'Property, plant and equipment (net)',
          amount: closingPpeNet,
          asOf: params.asOf,
        },
        { statement: 'CF', from: params.from, to: params.to },
        { statement: 'PL', from: params.from, to: params.to },
      ],
    };
  }

  private async noteD(
    req: Request,
    params: { from: string; to: string },
  ): Promise<IfrsDisclosureNoteDto> {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const [pl, cf, categories, balances] = await Promise.all([
      this.fs.computeProfitAndLoss(req, { from: params.from, to: params.to }),
      this.fs.computeCashFlowIndirect(req, {
        from: params.from,
        to: params.to,
      }),
      this.prisma.fixedAssetCategory.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      }),
      this.balanceByAccountAsOf({
        tenantId: tenant.id,
        asOf: this.utcDateOnly(new Date(params.to)),
      }),
    ]);

    if (categories.length === 0) {
      throw new BadRequestException(
        'Cannot generate depreciation note: no fixed asset categories configured.',
      );
    }

    const fromDate = this.utcDateOnly(new Date(params.from));
    const toDate = this.utcDateOnly(new Date(params.to));

    const assets = await this.prisma.fixedAsset.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ['CAPITALIZED', 'DISPOSED'] },
      },
      select: { id: true, categoryId: true },
    });
    const assetIdToCategoryId = new Map(
      assets.map((a) => [a.id, a.categoryId] as const),
    );

    const depLines = assets.length
      ? await this.prisma.fixedAssetDepreciationLine.findMany({
          where: {
            tenantId: tenant.id,
            assetId: { in: assets.map((a) => a.id) },
            run: {
              journalEntry: { status: 'POSTED' },
              period: { endDate: { gte: fromDate, lte: toDate } },
            },
          },
          select: {
            assetId: true,
            amount: true,
          },
        })
      : [];

    const depByCatId = new Map<string, number>();
    for (const c of categories) depByCatId.set(c.id, 0);
    for (const l of depLines) {
      const catId = assetIdToCategoryId.get(l.assetId);
      if (!catId) continue;
      depByCatId.set(
        catId,
        this.round2((depByCatId.get(catId) ?? 0) + Number(l.amount)),
      );
    }

    const depFromFa = this.round2(
      [...depByCatId.values()].reduce((s, n) => s + n, 0),
    );

    const depFromPl = this.round2(
      pl.expenses.rows
        .filter((x) =>
          this.classifyDepreciationExpense({
            code: x.accountCode,
            name: x.accountName,
            type: 'EXPENSE',
          }),
        )
        .reduce((s, r) => s + r.balance, 0),
    );

    const depFromCf = this.round2(
      cf.operating.adjustments
        .filter((a) => a.label.toLowerCase().includes('depreciation'))
        .reduce((s, a) => s + a.amount, 0),
    );

    let accumulatedDepClosing = 0;
    for (const b of balances.values()) {
      if (this.classifyAccumulatedDepreciationAccount(b)) {
        accumulatedDepClosing = this.round2(accumulatedDepClosing + b.net);
      }
    }

    this.assertTieOut({
      noteCode: 'D',
      statement: 'PL',
      label:
        'Depreciation per fixed asset register to depreciation expense (P&L)',
      expected: depFromFa,
      actual: depFromPl,
      tolerance: 0.01,
    });
    this.assertTieOut({
      noteCode: 'D',
      statement: 'CF',
      label:
        'Depreciation per Cash Flow adjustment to depreciation expense (P&L)',
      expected: depFromPl,
      actual: depFromCf,
      tolerance: 0.01,
    });

    const byClassTable: IfrsDisclosureTable = {
      title: 'Depreciation expense by class',
      columns: [
        { key: 'className', label: 'Class of asset', align: 'left' },
        { key: 'amount', label: 'Expense for the period', align: 'right' },
      ],
      rows: categories.map((c) => ({
        className: `${c.name} (${c.code})`,
        amount: this.round2(depByCatId.get(c.id) ?? 0),
      })),
    };

    const reconciliationTable: IfrsDisclosureTable = {
      title: 'Reconciliation of depreciation',
      columns: [
        { key: 'source', label: 'Source', align: 'left' },
        { key: 'amount', label: 'Amount', align: 'right' },
      ],
      rows: [
        { source: 'Depreciation per fixed asset register', amount: depFromFa },
        { source: 'Depreciation expense (P&L)', amount: depFromPl },
        { source: 'Depreciation add-back (Cash Flow)', amount: depFromCf },
        {
          source: 'Accumulated depreciation (closing balance)',
          amount: accumulatedDepClosing,
        },
      ],
    };

    return {
      noteCode: 'D',
      title: 'Depreciation',
      narrative:
        'Depreciation is charged to profit or loss so as to allocate the depreciable amount of property, plant and equipment over its estimated useful lives. The depreciation charge for the period is analysed below.',
      footnotes: [
        'The depreciation charge agrees to depreciation presented in profit or loss.',
        'The depreciation add-back agrees to the adjustment presented in the Statement of Cash Flows.',
      ],
      tables: [byClassTable, reconciliationTable],
      statementReferences: [
        { statement: 'PL', from: params.from, to: params.to },
        { statement: 'CF', from: params.from, to: params.to },
      ],
    };
  }

  private async noteE(
    req: Request,
    params: { asOf: string; openingAsOf: string; from: string; to: string },
  ): Promise<IfrsDisclosureNoteDto> {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const [bs, balances, balancesOpening] = await Promise.all([
      this.fs.computeBalanceSheet(req, { asOf: params.asOf }),
      this.balanceByAccountAsOf({
        tenantId: tenant.id,
        asOf: this.utcDateOnly(new Date(params.asOf)),
      }),
      this.balanceByAccountAsOf({
        tenantId: tenant.id,
        asOf: this.utcDateOnly(new Date(params.openingAsOf)),
      }),
    ]);

    let gross = 0;
    let allowance = 0;
    for (const b of balances.values()) {
      if (this.classifyAllowanceForDoubtfulDebtsAccount(b)) {
        allowance = this.round2(allowance + b.net);
        continue;
      }
      if (this.classifyArControlOrTradeReceivableAccount(b)) {
        gross = this.round2(gross + b.net);
        continue;
      }
    }

    const netComputed = this.round2(gross + allowance);
    const netPerBs = this.round2(
      bs.assets.rows
        .filter((r) => r.accountCode === 'TRADE_RECEIVABLES')
        .reduce((s, r) => s + r.balance, 0),
    );

    this.assertTieOut({
      noteCode: 'E',
      statement: 'BS',
      label:
        'Trade receivables (gross + allowance) to Balance Sheet TRADE_RECEIVABLES (net)',
      expected: netPerBs,
      actual: netComputed,
      tolerance: 0.01,
    });

    const ageing = await this.reports.arAging(req, {
      asOf: params.asOf,
    } as any);
    const ageingTotal = this.round2(ageing.grandTotalOutstanding);
    this.assertTieOut({
      noteCode: 'E',
      statement: 'BS',
      label: 'Trade receivables gross to AR ageing total outstanding',
      expected: gross,
      actual: ageingTotal,
      tolerance: 0.01,
    });

    const breakdownTable: IfrsDisclosureTable = {
      title: 'Trade receivables',
      columns: [
        { key: 'component', label: 'Component', align: 'left' },
        { key: 'amount', label: 'Amount', align: 'right' },
      ],
      rows: [
        { component: 'Gross trade receivables', amount: gross },
        {
          component: 'Loss allowance (expected credit losses)',
          amount: allowance,
        },
        { component: 'Trade receivables (net)', amount: netComputed },
      ],
    };

    const ageingTable: IfrsDisclosureTable = {
      title: 'Ageing of trade receivables (gross)',
      columns: [
        { key: 'bucket', label: 'Ageing bucket', align: 'left' },
        { key: 'amount', label: 'Amount', align: 'right' },
      ],
      rows: ageing.buckets.map((b: any) => ({
        bucket: b.label,
        amount: this.round2(ageing.grandTotalsByBucket?.[b.code] ?? 0),
      })),
    };

    let allowanceOpening = 0;
    let allowanceClosing = 0;
    for (const b of balancesOpening.values()) {
      if (this.classifyAllowanceForDoubtfulDebtsAccount(b)) {
        allowanceOpening = this.round2(allowanceOpening + b.net);
      }
    }
    for (const b of balances.values()) {
      if (this.classifyAllowanceForDoubtfulDebtsAccount(b)) {
        allowanceClosing = this.round2(allowanceClosing + b.net);
      }
    }

    const allowanceMovement = this.round2(allowanceClosing - allowanceOpening);

    const allowanceTable: IfrsDisclosureTable = {
      title: 'Movement in loss allowance (expected credit losses)',
      columns: [
        { key: 'line', label: 'Line', align: 'left' },
        { key: 'amount', label: 'Amount', align: 'right' },
      ],
      rows: [
        { line: 'Opening balance', amount: allowanceOpening },
        { line: 'Movement for the period', amount: allowanceMovement },
        { line: 'Closing balance', amount: allowanceClosing },
      ],
    };

    return {
      noteCode: 'E',
      title: 'Trade and other receivables',
      narrative:
        'Trade receivables are measured at amortised cost and are presented net of expected credit losses. The ageing analysis below is based on amounts outstanding at the reporting date.',
      footnotes: [
        'The closing balance agrees to the Statement of Financial Position.',
      ],
      tables: [breakdownTable, ageingTable, allowanceTable],
      statementReferences: [
        {
          statement: 'BS',
          lineCode: 'TRADE_RECEIVABLES',
          lineLabel: 'Trade receivables (net)',
          amount: netPerBs,
          asOf: params.asOf,
        },
      ],
    };
  }

  private async noteF(
    req: Request,
    params: { from: string; to: string },
  ): Promise<IfrsDisclosureNoteDto> {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const [bs, cf, balances] = await Promise.all([
      this.fs.computeBalanceSheet(req, { asOf: params.to }),
      this.fs.computeCashFlowIndirect(req, {
        from: params.from,
        to: params.to,
      }),
      this.balanceByAccountAsOf({
        tenantId: tenant.id,
        asOf: this.utcDateOnly(new Date(params.to)),
      }),
    ]);

    const cashPerBs = this.round2(
      bs.assets.rows
        .filter((r) => r.accountCode === 'CASH_AND_EQUIVALENTS')
        .reduce((s, r) => s + r.balance, 0),
    );
    const overdraftPerBs = this.round2(
      bs.liabilities.rows
        .filter((r) => r.accountCode === 'BANK_OVERDRAFT')
        .reduce((s, r) => s + r.balance, 0),
    );

    const cashAccounts = [...balances.values()]
      .filter((b) => this.classifyCashAccount(b))
      .sort((a, b) => `${a.code}`.localeCompare(`${b.code}`));

    if (cashAccounts.length === 0) {
      throw new BadRequestException(
        'Cannot generate cash note: no cash/bank accounts found in the ledger as of period end.',
      );
    }

    let cashTotal = 0;
    let overdraftTotal = 0;
    const rows = cashAccounts.map((a) => {
      const cash = a.net > 0 ? a.net : 0;
      const overdraft = a.net < 0 ? Math.abs(a.net) : 0;
      cashTotal = this.round2(cashTotal + cash);
      overdraftTotal = this.round2(overdraftTotal + overdraft);
      return {
        accountCode: a.code,
        accountName: a.name,
        balance: a.net,
        cash,
        overdraft,
      };
    });

    this.assertTieOut({
      noteCode: 'F',
      statement: 'BS',
      label:
        'Cash total (positive balances) to Balance Sheet CASH_AND_EQUIVALENTS',
      expected: cashPerBs,
      actual: cashTotal,
      tolerance: 0.01,
    });
    this.assertTieOut({
      noteCode: 'F',
      statement: 'BS',
      label:
        'Overdraft total (negative balances) to Balance Sheet BANK_OVERDRAFT',
      expected: overdraftPerBs,
      actual: overdraftTotal,
      tolerance: 0.01,
    });

    const netCashPositionPerBs = this.round2(cashPerBs - overdraftPerBs);
    const netCashPositionPerCf = this.round2(cf.cash.closingCash);
    this.assertTieOut({
      noteCode: 'F',
      statement: 'CF',
      label:
        'Net cash position (BS cash less overdraft) to Cash Flow closing cash',
      expected: netCashPositionPerCf,
      actual: netCashPositionPerBs,
      tolerance: 0.01,
    });

    const compositionTable: IfrsDisclosureTable = {
      title: 'Composition of cash and cash equivalents',
      columns: [
        { key: 'accountName', label: 'Account', align: 'left' },
        { key: 'balance', label: 'Balance', align: 'right' },
      ],
      rows: rows.map((r) => ({
        accountName: `${r.accountName} (${r.accountCode})`,
        balance: r.balance,
      })),
    };

    const reconciliationTable: IfrsDisclosureTable = {
      title: 'Reconciliation to cash flow statement',
      columns: [
        { key: 'line', label: 'Line', align: 'left' },
        { key: 'amount', label: 'Amount', align: 'right' },
      ],
      rows: [
        {
          line: 'Cash and cash equivalents (per statement of financial position)',
          amount: cashPerBs,
        },
        {
          line: 'Less: Bank overdraft (per statement of financial position)',
          amount: this.round2(-overdraftPerBs),
        },
        {
          line: 'Net cash position (per cash flow statement)',
          amount: netCashPositionPerCf,
        },
      ],
    };

    return {
      noteCode: 'F',
      title: 'Cash and cash equivalents',
      narrative:
        'Cash and cash equivalents comprise cash on hand and demand deposits. Bank overdrafts are presented separately as liabilities where applicable.',
      footnotes: [
        'The closing net cash position agrees to the Statement of Cash Flows.',
        'The closing balances agree to the Statement of Financial Position.',
      ],
      tables: [compositionTable, reconciliationTable],
      statementReferences: [
        {
          statement: 'BS',
          lineCode: 'CASH_AND_EQUIVALENTS',
          asOf: params.to,
          amount: cashPerBs,
        },
        {
          statement: 'BS',
          lineCode: 'BANK_OVERDRAFT',
          asOf: params.to,
          amount: overdraftPerBs,
        },
        {
          statement: 'CF',
          from: params.from,
          to: params.to,
          amount: netCashPositionPerCf,
        },
      ],
    };
  }

  private async noteG(
    req: Request,
    params: { from: string; to: string; openingAsOf: string },
  ): Promise<IfrsDisclosureNoteDto> {
    const [bsOpening, bsClosing, pl, soce] = await Promise.all([
      this.fs.computeBalanceSheet(req, { asOf: params.openingAsOf }),
      this.fs.computeBalanceSheet(req, { asOf: params.to }),
      this.fs.computeProfitAndLoss(req, { from: params.from, to: params.to }),
      this.fs.computeSOCE(req, { from: params.from, to: params.to }),
    ]);

    if (soce.from !== params.from || soce.to !== params.to) {
      throw new BadRequestException(
        'IFRS Disclosure Notes require a closed accounting period that matches the fiscal year range used for the Statement of Changes in Equity.',
      );
    }

    const openingShareCapital = this.round2(
      bsOpening.equity.rows.find((r) => r.accountCode === 'SHARE_CAPITAL')
        ?.balance ?? 0,
    );
    const openingRetainedEarnings = this.round2(
      bsOpening.equity.rows.find((r) => r.accountCode === 'RETAINED_EARNINGS')
        ?.balance ?? 0,
    );
    const openingOtherReserves = this.round2(
      bsOpening.equity.rows.find((r) => r.accountCode === 'OTHER_RESERVES')
        ?.balance ?? 0,
    );
    const openingEquityTotal = this.round2(
      openingShareCapital + openingRetainedEarnings + openingOtherReserves,
    );

    const closingShareCapital = this.round2(
      bsClosing.equity.rows.find((r) => r.accountCode === 'SHARE_CAPITAL')
        ?.balance ?? 0,
    );
    const closingRetainedEarnings = this.round2(
      bsClosing.equity.rows.find((r) => r.accountCode === 'RETAINED_EARNINGS')
        ?.balance ?? 0,
    );
    const closingOtherReserves = this.round2(
      bsClosing.equity.rows.find((r) => r.accountCode === 'OTHER_RESERVES')
        ?.balance ?? 0,
    );
    const closingEquityTotal = this.round2(
      closingShareCapital + closingRetainedEarnings + closingOtherReserves,
    );

    const profitOrLoss = this.round2(pl.profitOrLoss);

    const otherShareCapital = this.round2(
      closingShareCapital - openingShareCapital,
    );
    const otherRetainedEarnings = this.round2(
      closingRetainedEarnings - openingRetainedEarnings - profitOrLoss,
    );
    const otherOtherReserves = this.round2(
      closingOtherReserves - openingOtherReserves,
    );
    const otherTotal = this.round2(
      closingEquityTotal - openingEquityTotal - profitOrLoss,
    );

    this.assertTieOut({
      noteCode: 'G',
      statement: 'BS',
      label:
        'Equity movement (opening + profit/(loss) + other movements) to closing equity (Balance Sheet)',
      expected: closingEquityTotal,
      actual: this.round2(openingEquityTotal + profitOrLoss + otherTotal),
      tolerance: 0.01,
    });

    this.assertTieOut({
      noteCode: 'G',
      statement: 'SOCE',
      label: 'Closing total equity (SOCE) to closing equity (Balance Sheet)',
      expected: closingEquityTotal,
      actual: this.round2(soce.totalEquity.closing),
      tolerance: 0.01,
    });

    const table: IfrsDisclosureTable = {
      title: 'Equity movements',
      columns: [
        { key: 'component', label: 'Component', align: 'left' },
        { key: 'opening', label: 'Opening', align: 'right' },
        { key: 'profitOrLoss', label: 'Profit/(loss)', align: 'right' },
        { key: 'otherMovements', label: 'Other movements', align: 'right' },
        { key: 'closing', label: 'Closing', align: 'right' },
      ],
      rows: [
        {
          component: 'Share capital',
          opening: openingShareCapital,
          profitOrLoss: 0,
          otherMovements: otherShareCapital,
          closing: closingShareCapital,
        },
        {
          component: 'Retained earnings',
          opening: openingRetainedEarnings,
          profitOrLoss: profitOrLoss,
          otherMovements: otherRetainedEarnings,
          closing: closingRetainedEarnings,
        },
        {
          component: 'Other reserves',
          opening: openingOtherReserves,
          profitOrLoss: 0,
          otherMovements: otherOtherReserves,
          closing: closingOtherReserves,
        },
        {
          component: 'Total equity',
          opening: openingEquityTotal,
          profitOrLoss: profitOrLoss,
          otherMovements: otherTotal,
          closing: closingEquityTotal,
        },
      ],
    };

    return {
      noteCode: 'G',
      title: 'Equity',
      narrative:
        'The movements in equity for the period are presented in the statement of changes in equity and are summarised below.',
      footnotes: [
        'The closing balance agrees to the Statement of Financial Position.',
      ],
      tables: [table],
      statementReferences: [
        { statement: 'PL', from: params.from, to: params.to },
        {
          statement: 'SOCE',
          from: soce.from,
          to: soce.to,
          amount: this.round2(soce.totalEquity.closing),
        },
        {
          statement: 'BS',
          asOf: params.openingAsOf,
          amount: openingEquityTotal,
        },
        { statement: 'BS', asOf: params.to, amount: closingEquityTotal },
      ],
    };
  }

  private async noteH(
    req: Request,
    params: { periodId: string; startDate: Date; endDate: Date; asOf: string },
  ): Promise<IfrsDisclosureNoteDto> {
    const from = this.utcDateOnly(params.startDate).toISOString().slice(0, 10);
    const to = this.utcDateOnly(params.endDate).toISOString().slice(0, 10);

    const [pl, cf, bs] = await Promise.all([
      this.fs.computeProfitAndLoss(req, { from, to }),
      this.fs.computeCashFlowIndirect(req, { from, to }),
      this.fs.computeBalanceSheet(req, { asOf: params.asOf }),
    ]);

    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const currentTaxExpense = this.round2(
      pl.expenses.rows
        .filter((r) => r.reportSection === 'TAX_EXPENSE')
        .reduce((s, r) => s + r.balance, 0),
    );

    const profitBeforeTax = this.round2(cf.operating.profitBeforeTax);
    const deferredTaxAsset = this.round2(
      bs.assets.rows
        .filter((r) => r.accountCode === 'DEFERRED_TAX_ASSET')
        .reduce((s, r) => s + r.balance, 0),
    );
    const deferredTaxLiability = this.round2(
      bs.liabilities.rows
        .filter((r) => r.accountCode === 'DEFERRED_TAX_LIABILITY')
        .reduce((s, r) => s + r.balance, 0),
    );

    const incomeTaxAccounts = await this.prisma.account.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        ifrsMappingCode: { in: ['TAX:INCOME', 'TAX:CIT'] },
      },
      select: { id: true, code: true, name: true, ifrsMappingCode: true },
      orderBy: { code: 'asc' },
    });

    if (incomeTaxAccounts.length === 0) {
      throw new BadRequestException(
        'Cannot generate income tax note: no income tax control accounts configured. Set Account.ifrsMappingCode to TAX:INCOME (or TAX:CIT) for the current tax payable/receivable control account(s).',
      );
    }

    const fromDate = this.utcDateOnly(params.startDate);
    const toDate = this.utcDateOnly(params.endDate);

    const accountIds = incomeTaxAccounts.map((a) => a.id);

    const sumNetTo = async (cutoff: Date) => {
      const grouped = await this.prisma.journalLine.groupBy({
        by: ['accountId'],
        where: {
          accountId: { in: accountIds },
          journalEntry: {
            tenantId: tenant.id,
            status: 'POSTED',
            journalDate: { lte: cutoff },
          },
        },
        _sum: { debit: true, credit: true },
      });
      const out = new Map<string, number>();
      for (const g of grouped) {
        out.set(
          g.accountId,
          this.round2(Number(g._sum?.debit ?? 0) - Number(g._sum?.credit ?? 0)),
        );
      }
      return out;
    };

    const opening = await sumNetTo(this.addUtcDays(fromDate, -1));
    const closing = await sumNetTo(toDate);

    const sumMovementByRefPrefix = async (
      prefix: 'TAX_PAYMENT:' | 'TAX_ADJ:',
    ) => {
      const grouped = await this.prisma.journalLine.groupBy({
        by: ['accountId'],
        where: {
          accountId: { in: accountIds },
          journalEntry: {
            tenantId: tenant.id,
            status: 'POSTED',
            journalDate: { gte: fromDate, lte: toDate },
            reference: { startsWith: `${prefix}INCOME` },
          },
        },
        _sum: { debit: true, credit: true },
      });
      const out = new Map<string, number>();
      for (const g of grouped) {
        out.set(
          g.accountId,
          this.round2(Number(g._sum?.debit ?? 0) - Number(g._sum?.credit ?? 0)),
        );
      }
      return out;
    };

    const paidNet = await sumMovementByRefPrefix('TAX_PAYMENT:');
    const adjNet = await sumMovementByRefPrefix('TAX_ADJ:');

    let chargedTotal = 0;
    let openingTotal = 0;
    let closingTotal = 0;
    let paidTotal = 0;
    let adjTotal = 0;

    const rows = incomeTaxAccounts.map((a) => {
      const o = opening.get(a.id) ?? 0;
      const c = closing.get(a.id) ?? 0;
      const paid = Math.abs(paidNet.get(a.id) ?? 0);
      const adj = adjNet.get(a.id) ?? 0;
      const charged = this.round2(c - o + paid - adj);

      openingTotal = this.round2(openingTotal + o);
      closingTotal = this.round2(closingTotal + c);
      paidTotal = this.round2(paidTotal + paid);
      adjTotal = this.round2(adjTotal + adj);
      chargedTotal = this.round2(chargedTotal + charged);

      return {
        taxAccount: `${a.name} (${a.code})`,
        openingBalance: o,
        taxCharged: charged,
        taxPaid: paid,
        adjustments: adj,
        closingBalance: c,
      };
    });

    this.assertTieOut({
      noteCode: 'H',
      statement: 'PL',
      label:
        'Income tax charged per control account reconciliation to tax expense (P&L TAX_EXPENSE)',
      expected: currentTaxExpense,
      actual: chargedTotal,
      tolerance: 0.01,
    });

    const taxExpensePerCf = this.round2(
      cf.operating.profitBeforeTax - pl.profitOrLoss,
    );
    this.assertTieOut({
      noteCode: 'H',
      statement: 'CF',
      label:
        'Current tax expense (P&L TAX_EXPENSE) to cash flow profit-before-tax bridge',
      expected: currentTaxExpense,
      actual: taxExpensePerCf,
      tolerance: 0.01,
    });

    const currentTaxReconciliationTable: IfrsDisclosureTable = {
      title: 'Current tax reconciliation',
      columns: [
        { key: 'taxAccount', label: 'Tax control account', align: 'left' },
        { key: 'openingBalance', label: 'Opening', align: 'right' },
        { key: 'taxCharged', label: 'Tax charged', align: 'right' },
        { key: 'taxPaid', label: 'Tax paid', align: 'right' },
        { key: 'adjustments', label: 'Adjustments', align: 'right' },
        { key: 'closingBalance', label: 'Closing', align: 'right' },
      ],
      rows,
    };

    const totalsTable: IfrsDisclosureTable = {
      title: 'Income tax summary',
      columns: [
        { key: 'line', label: 'Line', align: 'left' },
        { key: 'amount', label: 'Amount', align: 'right' },
      ],
      rows: [
        { line: 'Profit before tax', amount: profitBeforeTax },
        {
          line: 'Income tax expense (per profit or loss)',
          amount: currentTaxExpense,
        },
        {
          line: 'Effective tax rate (%)',
          amount:
            profitBeforeTax === 0
              ? 0
              : this.round2((currentTaxExpense / profitBeforeTax) * 100),
        },
        {
          line: 'Opening current tax control balance (net)',
          amount: openingTotal,
        },
        { line: 'Tax paid', amount: this.round2(-paidTotal) },
        { line: 'Adjustments', amount: adjTotal },
        {
          line: 'Closing current tax control balance (net)',
          amount: closingTotal,
        },
        {
          line: 'Deferred tax assets (statement of financial position)',
          amount: deferredTaxAsset,
        },
        {
          line: 'Deferred tax liabilities (statement of financial position)',
          amount: deferredTaxLiability,
        },
      ],
    };

    return {
      noteCode: 'H',
      title: 'Income tax',
      narrative:
        'Income tax expense comprises current tax and deferred tax. Current tax represents the expected tax payable on taxable profit for the period. Deferred tax is recognised on temporary differences between the carrying amounts of assets and liabilities and their tax bases.',
      footnotes: [
        'The income tax expense agrees to profit or loss.',
        'Deferred tax balances, where recognised, agree to the Statement of Financial Position.',
      ],
      tables: [totalsTable, currentTaxReconciliationTable],
      statementReferences: [
        { statement: 'PL', from, to },
        { statement: 'CF', from, to },
        { statement: 'BS', asOf: params.asOf },
      ],
    };
  }
}
