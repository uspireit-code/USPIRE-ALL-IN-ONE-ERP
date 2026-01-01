import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type DisclosureNoteType } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DisclosureNotesService {
  constructor(private readonly prisma: PrismaService) {}

  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  async generateNote(
    req: Request,
    periodId: string,
    noteType: DisclosureNoteType,
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id: periodId, tenantId: tenant.id },
      select: { id: true, status: true, startDate: true, endDate: true },
    });

    if (!period) {
      throw new NotFoundException('Accounting period not found');
    }

    if (period.status !== 'CLOSED') {
      throw new BadRequestException(
        'Disclosure notes can only be generated for CLOSED accounting periods',
      );
    }

    if (noteType === 'PPE_MOVEMENT') {
      return this.generatePpeMovementNote(req, {
        periodId: period.id,
        startDate: period.startDate,
        endDate: period.endDate,
      });
    }

    if (noteType === 'DEPRECIATION') {
      return this.generateDepreciationNote(req, {
        periodId: period.id,
        startDate: period.startDate,
        endDate: period.endDate,
      });
    }

    if (noteType === 'TAX_RECONCILIATION') {
      return this.generateTaxReconciliationNote(req, {
        periodId: period.id,
        startDate: period.startDate,
        endDate: period.endDate,
      });
    }

    return this.prisma.disclosureNote.upsert({
      where: {
        tenantId_accountingPeriodId_noteType: {
          tenantId: tenant.id,
          accountingPeriodId: period.id,
          noteType,
        },
      },
      create: {
        tenantId: tenant.id,
        accountingPeriodId: period.id,
        noteType,
        generatedAt: new Date(),
        generatedById: user.id,
      },
      update: {
        generatedAt: new Date(),
        generatedById: user.id,
      },
      include: { lines: true },
    });
  }

  private async generateDepreciationNote(
    req: Request,
    params: {
      periodId: string;
      startDate: Date;
      endDate: Date;
    },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const categories = await this.prisma.fixedAssetCategory.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        code: true,
        name: true,
        defaultMethod: true,
        defaultUsefulLifeMonths: true,
      },
      orderBy: { code: 'asc' },
    });

    const assets = await this.prisma.fixedAsset.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ['CAPITALIZED', 'DISPOSED'] },
      },
      select: {
        id: true,
        categoryId: true,
        cost: true,
        capitalizationDate: true,
        capitalizationJournalId: true,
        disposalJournalId: true,
      },
    });

    const journalIds = [
      ...new Set(
        assets
          .flatMap((a) => [a.capitalizationJournalId, a.disposalJournalId])
          .filter(Boolean) as string[],
      ),
    ];

    const journals = journalIds.length
      ? await this.prisma.journalEntry.findMany({
          where: { tenantId: tenant.id, id: { in: journalIds } },
          select: { id: true, status: true, journalDate: true },
        })
      : [];

    const journalById = new Map(
      journals.map((j) => [
        j.id,
        { status: j.status, journalDate: j.journalDate },
      ]),
    );

    const eligibleAssets = assets.filter((a) => {
      if (!a.capitalizationDate || !a.capitalizationJournalId) return false;
      const cap = journalById.get(a.capitalizationJournalId);
      if (!cap || cap.status !== 'POSTED') return false;
      if (a.disposalJournalId) {
        const disp = journalById.get(a.disposalJournalId);
        if (!disp || disp.status !== 'POSTED') return false;
      }
      return true;
    });

    const endMs = params.endDate.getTime();
    const inScopeAssets = eligibleAssets.filter((a) => {
      const capMs = a.capitalizationDate!.getTime();
      if (capMs > endMs) return false;

      const disp = a.disposalJournalId
        ? journalById.get(a.disposalJournalId)
        : undefined;
      const dispMs = disp?.journalDate?.getTime();

      // Exclude assets disposed on/before period end; disposal journal removes gross cost + accum dep.
      if (dispMs !== undefined && dispMs <= endMs) return false;
      return true;
    });

    const assetIds = inScopeAssets.map((a) => a.id);

    const depLinesAllToEnd = assetIds.length
      ? await this.prisma.fixedAssetDepreciationLine.findMany({
          where: {
            tenantId: tenant.id,
            assetId: { in: assetIds },
            run: {
              journalEntry: { status: 'POSTED' },
              period: { endDate: { lte: params.endDate } },
            },
          },
          select: {
            assetId: true,
            amount: true,
            run: {
              select: {
                periodId: true,
                period: { select: { endDate: true } },
              },
            },
          },
        })
      : [];

    const depByAsset = new Map<
      string,
      Array<{ endDate: Date; amount: Prisma.Decimal; periodId: string }>
    >();
    for (const l of depLinesAllToEnd) {
      const arr = depByAsset.get(l.assetId) ?? [];
      arr.push({
        endDate: l.run.period.endDate,
        amount: new Prisma.Decimal(l.amount),
        periodId: l.run.periodId,
      });
      depByAsset.set(l.assetId, arr);
    }
    for (const arr of depByAsset.values()) {
      arr.sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
    }

    const sumDepTo = (assetId: string, asOf: Date) => {
      const arr = depByAsset.get(assetId);
      if (!arr || !arr.length) return new Prisma.Decimal(0);
      let s = new Prisma.Decimal(0);
      for (const l of arr) {
        if (l.endDate.getTime() <= asOf.getTime()) s = s.plus(l.amount);
      }
      return s;
    };

    const sumDepForPeriod = (assetId: string, periodId: string) => {
      const arr = depByAsset.get(assetId);
      if (!arr || !arr.length) return new Prisma.Decimal(0);
      let s = new Prisma.Decimal(0);
      for (const l of arr) {
        if (l.periodId === periodId) s = s.plus(l.amount);
      }
      return s;
    };

    const totalsByCategory = new Map<
      string,
      {
        categoryId: string;
        categoryCode: string;
        categoryName: string;
        method: string;
        usefulLifeMonths: number;
        cost: Prisma.Decimal;
        depreciationForPeriod: Prisma.Decimal;
        accumulatedDepreciation: Prisma.Decimal;
      }
    >();

    const getBucket = (categoryId: string) => {
      const cat = categories.find((c) => c.id === categoryId);
      const existing = totalsByCategory.get(categoryId);
      if (existing) return existing;

      const bucket = {
        categoryId,
        categoryCode: cat?.code ?? categoryId,
        categoryName: cat?.name ?? categoryId,
        method: String(cat?.defaultMethod ?? ''),
        usefulLifeMonths: Number(cat?.defaultUsefulLifeMonths ?? 0),
        cost: new Prisma.Decimal(0),
        depreciationForPeriod: new Prisma.Decimal(0),
        accumulatedDepreciation: new Prisma.Decimal(0),
      };

      totalsByCategory.set(categoryId, bucket);
      return bucket;
    };

    for (const a of inScopeAssets) {
      const bucket = getBucket(a.categoryId);
      const cost = new Prisma.Decimal(a.cost);
      bucket.cost = bucket.cost.plus(cost);

      const depPeriod = sumDepForPeriod(a.id, params.periodId);
      if (depPeriod.gt(0)) {
        bucket.depreciationForPeriod =
          bucket.depreciationForPeriod.plus(depPeriod);
      }

      const acc = sumDepTo(a.id, params.endDate);
      if (acc.gt(0)) {
        bucket.accumulatedDepreciation =
          bucket.accumulatedDepreciation.plus(acc);
      }
    }

    const rows = [...totalsByCategory.values()].sort((a, b) =>
      a.categoryCode.localeCompare(b.categoryCode),
    );

    return this.prisma.$transaction(async (tx) => {
      const note = await tx.disclosureNote.upsert({
        where: {
          tenantId_accountingPeriodId_noteType: {
            tenantId: tenant.id,
            accountingPeriodId: params.periodId,
            noteType: 'DEPRECIATION',
          },
        },
        create: {
          tenantId: tenant.id,
          accountingPeriodId: params.periodId,
          noteType: 'DEPRECIATION',
          generatedAt: new Date(),
          generatedById: user.id,
          metadata: {
            periodId: params.periodId,
            noteType: 'DEPRECIATION',
          },
        },
        update: {
          generatedAt: new Date(),
          generatedById: user.id,
          metadata: {
            periodId: params.periodId,
            noteType: 'DEPRECIATION',
          },
        },
        select: { id: true },
      });

      await tx.disclosureNoteLine.deleteMany({
        where: { disclosureNoteId: note.id },
      });

      if (rows.length > 0) {
        await tx.disclosureNoteLine.createMany({
          data: rows.map((r, idx) => ({
            disclosureNoteId: note.id,
            rowKey: `CATEGORY:${r.categoryCode}`,
            label: r.categoryName,
            values: {
              categoryCode: r.categoryCode,
              categoryName: r.categoryName,
              cost: r.cost.toNumber(),
              method: r.method,
              usefulLifeMonths: r.usefulLifeMonths,
              depreciationForPeriod: r.depreciationForPeriod.toNumber(),
              accumulatedDepreciation: r.accumulatedDepreciation.toNumber(),
            },
            orderIndex: idx,
          })),
        });
      }

      const out = await tx.disclosureNote.findFirst({
        where: { id: note.id, tenantId: tenant.id },
        include: { lines: { orderBy: { orderIndex: 'asc' } } },
      });

      if (!out) {
        throw new NotFoundException('Disclosure note not found');
      }

      return out;
    });
  }

  private async generateTaxReconciliationNote(
    req: Request,
    params: {
      periodId: string;
      startDate: Date;
      endDate: Date;
    },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const taxAccounts = await this.prisma.account.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        ifrsMappingCode: {
          startsWith: 'TAX:',
        },
      },
      select: { id: true, ifrsMappingCode: true },
      orderBy: { code: 'asc' },
    });

    const toTaxType = (ifrsMappingCode: string | null) => {
      const raw = String(ifrsMappingCode ?? '');
      if (!raw.startsWith('TAX:')) return null;
      const tag = raw.slice('TAX:'.length).trim();
      if (!tag) return null;
      const base = tag.split('_')[0]?.trim();
      return base || null;
    };

    const taxTypeByAccountId = new Map<string, string>();
    const taxTypes = new Set<string>();
    for (const a of taxAccounts) {
      const taxType = toTaxType(a.ifrsMappingCode);
      if (!taxType) continue;
      taxTypeByAccountId.set(a.id, taxType);
      taxTypes.add(taxType);
    }

    if (taxTypes.size === 0) {
      throw new BadRequestException(
        'No tax control accounts configured. Expected Account.ifrsMappingCode tags like TAX:VAT_OUTPUT, TAX:PAYE_PAYABLE, etc.',
      );
    }

    const taxAccountIds = [...taxTypeByAccountId.keys()];

    const sumNetByTaxType = (
      rows: Array<{ accountId: string; debit: any; credit: any }>,
    ) => {
      const out = new Map<string, Prisma.Decimal>();
      for (const r of rows) {
        const taxType = taxTypeByAccountId.get(r.accountId);
        if (!taxType) continue;
        const net = new Prisma.Decimal(r.debit ?? 0).minus(
          new Prisma.Decimal(r.credit ?? 0),
        );
        out.set(taxType, (out.get(taxType) ?? new Prisma.Decimal(0)).plus(net));
      }
      return out;
    };

    const [openingGrouped, closingGrouped] = await Promise.all([
      this.prisma.journalLine.groupBy({
        by: ['accountId'],
        where: {
          accountId: { in: taxAccountIds },
          journalEntry: {
            tenantId: tenant.id,
            status: 'POSTED',
            journalDate: { lt: params.startDate },
          },
        },
        _sum: { debit: true, credit: true },
      }),
      this.prisma.journalLine.groupBy({
        by: ['accountId'],
        where: {
          accountId: { in: taxAccountIds },
          journalEntry: {
            tenantId: tenant.id,
            status: 'POSTED',
            journalDate: { lte: params.endDate },
          },
        },
        _sum: { debit: true, credit: true },
      }),
    ]);

    const openingByType = sumNetByTaxType(
      openingGrouped.map((g) => ({
        accountId: g.accountId,
        debit: g._sum.debit,
        credit: g._sum.credit,
      })),
    );
    const closingByType = sumNetByTaxType(
      closingGrouped.map((g) => ({
        accountId: g.accountId,
        debit: g._sum.debit,
        credit: g._sum.credit,
      })),
    );

    const getTaxMovements = async (
      prefix: 'TAX_PAYMENT:' | 'TAX_ADJ:',
      taxType: string,
    ) => {
      const ref = `${prefix}${taxType}`;
      const grouped = await this.prisma.journalLine.groupBy({
        by: ['accountId'],
        where: {
          accountId: { in: taxAccountIds },
          journalEntry: {
            tenantId: tenant.id,
            status: 'POSTED',
            journalDate: { gte: params.startDate, lte: params.endDate },
            reference: { startsWith: ref },
          },
        },
        _sum: { debit: true, credit: true },
      });

      const byType = sumNetByTaxType(
        grouped.map((g) => ({
          accountId: g.accountId,
          debit: g._sum.debit,
          credit: g._sum.credit,
        })),
      );

      return byType.get(taxType) ?? new Prisma.Decimal(0);
    };

    const paidByType = new Map<string, Prisma.Decimal>();
    const adjByType = new Map<string, Prisma.Decimal>();
    await Promise.all(
      [...taxTypes].map(async (t) => {
        const [paid, adj] = await Promise.all([
          getTaxMovements('TAX_PAYMENT:', t),
          getTaxMovements('TAX_ADJ:', t),
        ]);
        // Note: we store paid as a positive amount for disclosure presentation.
        // Journal movements are signed in debit-credit convention; we take absolute value.
        paidByType.set(t, paid.abs());
        adjByType.set(t, adj);
      }),
    );

    // Charged (VAT only) from AR/AP tax postings via InvoiceTaxLine.
    const chargedByType = new Map<string, Prisma.Decimal>();
    if (taxTypes.has('VAT')) {
      const [apInvoices, arInvoices] = await Promise.all([
        this.prisma.supplierInvoice.findMany({
          where: {
            tenantId: tenant.id,
            status: 'POSTED',
            invoiceDate: { gte: params.startDate, lte: params.endDate },
          },
          select: { id: true },
        }),
        this.prisma.customerInvoice.findMany({
          where: {
            tenantId: tenant.id,
            status: 'POSTED',
            invoiceDate: { gte: params.startDate, lte: params.endDate },
          },
          select: { id: true },
        }),
      ]);

      const apIds = apInvoices.map((i) => i.id);
      const arIds = arInvoices.map((i) => i.id);

      const emptyTaxLines: Array<{ taxAmount: any }> = [];
      const [inputTaxLines, outputTaxLines] = await Promise.all([
        apIds.length
          ? this.prisma.invoiceTaxLine.findMany({
              where: {
                tenantId: tenant.id,
                sourceType: 'SUPPLIER_INVOICE',
                sourceId: { in: apIds },
                taxRate: { type: 'INPUT' },
              },
              select: { taxAmount: true },
            })
          : Promise.resolve(emptyTaxLines),
        arIds.length
          ? this.prisma.invoiceTaxLine.findMany({
              where: {
                tenantId: tenant.id,
                sourceType: 'CUSTOMER_INVOICE',
                sourceId: { in: arIds },
                taxRate: { type: 'OUTPUT' },
              },
              select: { taxAmount: true },
            })
          : Promise.resolve(emptyTaxLines),
      ]);

      const totalInputVat = this.round2(
        inputTaxLines.reduce((s, t) => s + Number(t.taxAmount), 0),
      );
      const totalOutputVat = this.round2(
        outputTaxLines.reduce((s, t) => s + Number(t.taxAmount), 0),
      );

      // Net movement on VAT control accounts in debit-credit convention.
      // INPUT VAT debits increase balance (+), OUTPUT VAT credits decrease balance (-).
      chargedByType.set(
        'VAT',
        new Prisma.Decimal(totalInputVat).minus(totalOutputVat),
      );
    }

    const taxTypeList = [...taxTypes].sort((a, b) => a.localeCompare(b));

    const rows = taxTypeList.map((taxType) => {
      const opening = openingByType.get(taxType) ?? new Prisma.Decimal(0);
      const charged = chargedByType.get(taxType) ?? new Prisma.Decimal(0);
      const paid = paidByType.get(taxType) ?? new Prisma.Decimal(0);
      const adj = adjByType.get(taxType) ?? new Prisma.Decimal(0);

      const closing = closingByType.get(taxType);
      const computedClosing = opening.plus(charged).minus(paid).plus(adj);
      return {
        taxType,
        opening,
        charged,
        paid,
        adj,
        closing: closing ?? computedClosing,
        computedClosing,
      };
    });

    return this.prisma.$transaction(async (tx) => {
      const note = await tx.disclosureNote.upsert({
        where: {
          tenantId_accountingPeriodId_noteType: {
            tenantId: tenant.id,
            accountingPeriodId: params.periodId,
            noteType: 'TAX_RECONCILIATION',
          },
        },
        create: {
          tenantId: tenant.id,
          accountingPeriodId: params.periodId,
          noteType: 'TAX_RECONCILIATION',
          generatedAt: new Date(),
          generatedById: user.id,
          metadata: {
            periodId: params.periodId,
            noteType: 'TAX_RECONCILIATION',
            startDate: params.startDate,
            endDate: params.endDate,
          },
        },
        update: {
          generatedAt: new Date(),
          generatedById: user.id,
          metadata: {
            periodId: params.periodId,
            noteType: 'TAX_RECONCILIATION',
            startDate: params.startDate,
            endDate: params.endDate,
          },
        },
        select: { id: true },
      });

      await tx.disclosureNoteLine.deleteMany({
        where: { disclosureNoteId: note.id },
      });

      if (rows.length > 0) {
        await tx.disclosureNoteLine.createMany({
          data: rows.map((r, idx) => ({
            disclosureNoteId: note.id,
            rowKey: `TAX:${r.taxType}`,
            label: r.taxType,
            values: {
              taxType: r.taxType,
              openingBalance: r.opening.toNumber(),
              taxCharged: r.charged.toNumber(),
              taxPaid: r.paid.toNumber(),
              adjustments: r.adj.toNumber(),
              closingBalance: r.closing.toNumber(),
              computedClosingBalance: r.computedClosing.toNumber(),
            },
            orderIndex: idx,
          })),
        });
      }

      const out = await tx.disclosureNote.findFirst({
        where: { id: note.id, tenantId: tenant.id },
        include: { lines: { orderBy: { orderIndex: 'asc' } } },
      });

      if (!out) {
        throw new NotFoundException('Disclosure note not found');
      }

      return out;
    });
  }

  private async generatePpeMovementNote(
    req: Request,
    params: {
      periodId: string;
      startDate: Date;
      endDate: Date;
    },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const categories = await this.prisma.fixedAssetCategory.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });

    const assets = await this.prisma.fixedAsset.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ['CAPITALIZED', 'DISPOSED'] },
      },
      select: {
        id: true,
        categoryId: true,
        cost: true,
        capitalizationDate: true,
        capitalizationJournalId: true,
        disposalJournalId: true,
      },
    });

    const journalIds = [
      ...new Set(
        assets
          .flatMap((a) => [a.capitalizationJournalId, a.disposalJournalId])
          .filter(Boolean) as string[],
      ),
    ];

    const journals = journalIds.length
      ? await this.prisma.journalEntry.findMany({
          where: { tenantId: tenant.id, id: { in: journalIds } },
          select: { id: true, status: true, journalDate: true },
        })
      : [];

    const journalById = new Map(
      journals.map((j) => [
        j.id,
        { status: j.status, journalDate: j.journalDate },
      ]),
    );

    const eligibleAssets = assets.filter((a) => {
      if (!a.capitalizationDate || !a.capitalizationJournalId) return false;
      const cap = journalById.get(a.capitalizationJournalId);
      if (!cap || cap.status !== 'POSTED') return false;
      if (a.disposalJournalId) {
        const disp = journalById.get(a.disposalJournalId);
        if (!disp || disp.status !== 'POSTED') return false;
      }
      return true;
    });

    const assetIds = eligibleAssets.map((a) => a.id);

    const depLines = assetIds.length
      ? await this.prisma.fixedAssetDepreciationLine.findMany({
          where: {
            tenantId: tenant.id,
            assetId: { in: assetIds },
            run: {
              journalEntry: {
                status: 'POSTED',
              },
              period: {
                endDate: { lte: params.endDate },
              },
            },
          },
          select: {
            assetId: true,
            amount: true,
            run: { select: { period: { select: { endDate: true } } } },
          },
        })
      : [];

    const depByAsset = new Map<
      string,
      Array<{ endDate: Date; amount: Prisma.Decimal }>
    >();
    for (const l of depLines) {
      const arr = depByAsset.get(l.assetId) ?? [];
      arr.push({
        endDate: l.run.period.endDate,
        amount: new Prisma.Decimal(l.amount),
      });
      depByAsset.set(l.assetId, arr);
    }

    for (const arr of depByAsset.values()) {
      arr.sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
    }

    const sumDepTo = (assetId: string, asOf: Date) => {
      const arr = depByAsset.get(assetId);
      if (!arr || !arr.length) return new Prisma.Decimal(0);
      let s = new Prisma.Decimal(0);
      for (const l of arr) {
        if (l.endDate.getTime() <= asOf.getTime()) s = s.plus(l.amount);
      }
      return s;
    };

    const totalsByCategory = new Map<
      string,
      {
        categoryId: string;
        categoryCode: string;
        categoryName: string;
        opening: Prisma.Decimal;
        additions: Prisma.Decimal;
        disposals: Prisma.Decimal;
        depreciation: Prisma.Decimal;
        closing: Prisma.Decimal;
      }
    >();

    const getBucket = (categoryId: string) => {
      const cat = categories.find((c) => c.id === categoryId);
      const existing = totalsByCategory.get(categoryId);
      if (existing) return existing;
      const bucket = {
        categoryId,
        categoryCode: cat?.code ?? categoryId,
        categoryName: cat?.name ?? categoryId,
        opening: new Prisma.Decimal(0),
        additions: new Prisma.Decimal(0),
        disposals: new Prisma.Decimal(0),
        depreciation: new Prisma.Decimal(0),
        closing: new Prisma.Decimal(0),
      };
      totalsByCategory.set(categoryId, bucket);
      return bucket;
    };

    const startMs = params.startDate.getTime();
    const endMs = params.endDate.getTime();

    for (const a of eligibleAssets) {
      const bucket = getBucket(a.categoryId);

      const capDateMs = a.capitalizationDate!.getTime();
      const disposal = a.disposalJournalId
        ? journalById.get(a.disposalJournalId)
        : undefined;
      const disposalDateMs = disposal?.journalDate?.getTime();

      const cost = new Prisma.Decimal(a.cost);

      const openingEligible =
        capDateMs < startMs && (!disposalDateMs || disposalDateMs >= startMs);
      if (openingEligible) {
        const dep = sumDepTo(a.id, params.startDate);
        bucket.opening = bucket.opening.plus(cost.minus(dep));
      }

      const additionsEligible = capDateMs >= startMs && capDateMs <= endMs;
      if (additionsEligible) {
        bucket.additions = bucket.additions.plus(cost);
      }

      const disposalEligible =
        disposalDateMs !== undefined &&
        disposalDateMs >= startMs &&
        disposalDateMs <= endMs;
      if (disposalEligible) {
        const dep = sumDepTo(a.id, disposal!.journalDate);
        bucket.disposals = bucket.disposals.plus(cost.minus(dep));
      }

      const depCurrent = sumDepTo(a.id, params.endDate).minus(
        sumDepTo(a.id, params.startDate),
      );
      if (depCurrent.gt(0)) {
        bucket.depreciation = bucket.depreciation.plus(depCurrent);
      }

      const closingEligible =
        capDateMs <= endMs && (!disposalDateMs || disposalDateMs > endMs);
      if (closingEligible) {
        const dep = sumDepTo(a.id, params.endDate);
        bucket.closing = bucket.closing.plus(cost.minus(dep));
      }
    }

    const rows = [...totalsByCategory.values()].sort((a, b) =>
      a.categoryCode.localeCompare(b.categoryCode),
    );

    return this.prisma.$transaction(async (tx) => {
      const note = await tx.disclosureNote.upsert({
        where: {
          tenantId_accountingPeriodId_noteType: {
            tenantId: tenant.id,
            accountingPeriodId: params.periodId,
            noteType: 'PPE_MOVEMENT',
          },
        },
        create: {
          tenantId: tenant.id,
          accountingPeriodId: params.periodId,
          noteType: 'PPE_MOVEMENT',
          generatedAt: new Date(),
          generatedById: user.id,
          metadata: {
            periodId: params.periodId,
            noteType: 'PPE_MOVEMENT',
          },
        },
        update: {
          generatedAt: new Date(),
          generatedById: user.id,
          metadata: {
            periodId: params.periodId,
            noteType: 'PPE_MOVEMENT',
          },
        },
        select: { id: true },
      });

      await tx.disclosureNoteLine.deleteMany({
        where: { disclosureNoteId: note.id },
      });

      if (rows.length > 0) {
        await tx.disclosureNoteLine.createMany({
          data: rows.map((r, idx) => ({
            disclosureNoteId: note.id,
            rowKey: `CATEGORY:${r.categoryCode}`,
            label: r.categoryName,
            values: {
              categoryCode: r.categoryCode,
              categoryName: r.categoryName,
              opening: r.opening.toNumber(),
              additions: r.additions.toNumber(),
              disposals: r.disposals.toNumber(),
              depreciation: r.depreciation.toNumber(),
              closing: r.closing.toNumber(),
            },
            orderIndex: idx,
          })),
        });
      }

      const out = await tx.disclosureNote.findFirst({
        where: { id: note.id, tenantId: tenant.id },
        include: { lines: { orderBy: { orderIndex: 'asc' } } },
      });

      if (!out) {
        throw new NotFoundException('Disclosure note not found');
      }

      return out;
    });
  }

  async listNotes(req: Request, periodId: string) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    return this.prisma.disclosureNote.findMany({
      where: { tenantId: tenant.id, accountingPeriodId: periodId },
      orderBy: [{ noteType: 'asc' }, { generatedAt: 'desc' }],
      select: {
        id: true,
        accountingPeriodId: true,
        noteType: true,
        generatedAt: true,
        generatedById: true,
        createdAt: true,
      },
    });
  }

  async getNote(req: Request, noteId: string) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const note = await this.prisma.disclosureNote.findFirst({
      where: { id: noteId, tenantId: tenant.id },
      include: { lines: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!note) {
      throw new NotFoundException('Disclosure note not found');
    }

    return note;
  }
}
