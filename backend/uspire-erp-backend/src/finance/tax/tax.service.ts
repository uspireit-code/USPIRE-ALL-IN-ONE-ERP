import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { assertPeriodIsOpen } from '../common/accounting-period.guard';
import type {
  CreateTaxRateDto,
  TaxSummaryQueryDto,
  UpdateTaxRateDto,
  UpdateTenantTaxConfigDto,
} from './tax.dto';

@Injectable()
export class FinanceTaxService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureTenant(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');
    return tenant;
  }

  private ensureUser(req: Request) {
    const user = req.user;
    if (!user) throw new BadRequestException('Missing user context');
    return user;
  }

  private round2(n: number) {
    return Math.round(Number(n ?? 0) * 100) / 100;
  }

  private async assertPeriodCoverage(params: {
    tenantId: string;
    from: Date;
    to: Date;
  }) {
    const cursor = new Date(params.from);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(params.to);
    end.setHours(0, 0, 0, 0);

    for (;;) {
      await assertPeriodIsOpen({
        prisma: this.prisma,
        tenantId: params.tenantId,
        date: cursor,
        action: 'create',
        documentLabel: 'tax summary',
        dateLabel: 'date',
      });
      if (cursor >= end) break;
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  private async assertVatAccountValid(params: {
    tenantId: string;
    accountId: string;
    expectedType: 'ASSET' | 'LIABILITY';
  }) {
    const acct = await this.prisma.account.findFirst({
      where: {
        tenantId: params.tenantId,
        id: params.accountId,
        isActive: true,
        type: params.expectedType as any,
      } as any,
      select: { id: true } as any,
    } as any);

    if (!acct) {
      throw new BadRequestException(
        `VAT account must exist, be ACTIVE, and be of type ${params.expectedType}`,
      );
    }
  }

  async listRates(req: Request) {
    const tenant = this.ensureTenant(req);

    const items = await (this.prisma as any).taxRate.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        tenantId: true,
        code: true,
        name: true,
        rate: true,
        type: true,
        isActive: true,
        glAccountId: true,
        glAccount: { select: { id: true, code: true, name: true, type: true } },
        createdAt: true,
      } as any,
    });

    return {
      items: (items ?? []).map((r: any) => ({
        ...r,
        rate: Number(r.rate),
      })),
    };
  }

  async getRateById(req: Request, id: string) {
    const tenant = this.ensureTenant(req);

    const item = await (this.prisma as any).taxRate.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        tenantId: true,
        code: true,
        name: true,
        rate: true,
        type: true,
        isActive: true,
        glAccountId: true,
        glAccount: { select: { id: true, code: true, name: true, type: true } },
        createdAt: true,
      } as any,
    });

    if (!item) throw new NotFoundException('Tax rate not found');

    return { ...item, rate: Number((item as any).rate) };
  }

  async createRate(req: Request, dto: CreateTaxRateDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const code = String(dto.code ?? '').trim().toUpperCase();
    const name = String(dto.name ?? '').trim();
    if (!code) throw new BadRequestException('code is required');
    if (!name) throw new BadRequestException('name is required');

    const rate = this.round2(Number(dto.rate));
    if (!(rate >= 0 && rate <= 100)) {
      throw new BadRequestException('rate must be between 0 and 100');
    }

    const glAccountId = dto.glAccountId ? String(dto.glAccountId).trim() : null;
    if (glAccountId) {
      const expected = dto.type === 'INPUT' ? 'ASSET' : 'LIABILITY';
      await this.assertVatAccountValid({
        tenantId: tenant.id,
        accountId: glAccountId,
        expectedType: expected,
      });
    }

    try {
      const created = await (this.prisma as any).taxRate.create({
        data: {
          tenantId: tenant.id,
          code,
          name,
          rate,
          type: dto.type,
          glAccountId,
          isActive: true,
        } as any,
        select: { id: true } as any,
      });

      await (this.prisma as any).auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'TAX_RATE_CREATED' as any,
            entityType: 'TAX_RATE' as any,
            entityId: created.id,
            action: 'TAX_RATE_CREATE',
            outcome: 'SUCCESS',
            userId: user.id,
            permissionUsed: 'TAX_RATE_CREATE',
          } as any,
        })
        .catch(() => undefined);

      return this.getRateById(req, created.id);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException('Tax rate code must be unique');
      }
      throw e;
    }
  }

  async updateRate(req: Request, id: string, dto: UpdateTaxRateDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const existing = await (this.prisma as any).taxRate.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true } as any,
    });
    if (!existing) throw new NotFoundException('Tax rate not found');

    const patch: any = {};

    if (dto.code !== undefined) {
      const code = String(dto.code ?? '').trim().toUpperCase();
      if (!code) throw new BadRequestException('code must not be empty');
      patch.code = code;
    }

    if (dto.name !== undefined) {
      const name = String(dto.name ?? '').trim();
      if (!name) throw new BadRequestException('name must not be empty');
      patch.name = name;
    }

    if (dto.rate !== undefined) {
      const rate = this.round2(Number(dto.rate));
      if (!(rate >= 0 && rate <= 100)) {
        throw new BadRequestException('rate must be between 0 and 100');
      }
      patch.rate = rate;
    }

    if (dto.type !== undefined) {
      patch.type = dto.type;
    }

    if (dto.glAccountId !== undefined) {
      const glAccountId = dto.glAccountId ? String(dto.glAccountId).trim() : null;
      patch.glAccountId = glAccountId;
      if (glAccountId) {
        const expected = (dto.type ?? 'OUTPUT') === 'INPUT' ? 'ASSET' : 'LIABILITY';
        await this.assertVatAccountValid({
          tenantId: tenant.id,
          accountId: glAccountId,
          expectedType: expected,
        });
      }
    }

    try {
      await (this.prisma as any).taxRate.update({
        where: { id },
        data: patch,
      });

      await (this.prisma as any).auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'TAX_RATE_UPDATED' as any,
            entityType: 'TAX_RATE' as any,
            entityId: id,
            action: 'TAX_RATE_UPDATE',
            outcome: 'SUCCESS',
            userId: user.id,
            permissionUsed: 'TAX_RATE_UPDATE',
          } as any,
        })
        .catch(() => undefined);

      return this.getRateById(req, id);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException('Tax rate code must be unique');
      }
      throw e;
    }
  }

  async setRateActive(req: Request, id: string, isActive: boolean) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const existing = await (this.prisma as any).taxRate.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true } as any,
    });
    if (!existing) throw new NotFoundException('Tax rate not found');

    await (this.prisma as any).taxRate.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
    });

    await (this.prisma as any).auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'TAX_RATE_STATUS_CHANGE' as any,
          entityType: 'TAX_RATE' as any,
          entityId: id,
          action: 'TAX_RATE_UPDATE',
          outcome: 'SUCCESS',
          userId: user.id,
          permissionUsed: 'TAX_RATE_UPDATE',
        } as any,
      })
      .catch(() => undefined);

    return this.getRateById(req, id);
  }

  async getConfig(req: Request) {
    const tenant = this.ensureTenant(req);

    const cfg = await (this.prisma as any).tenantTaxConfig.findFirst({
      where: { tenantId: tenant.id },
      select: {
        tenantId: true,
        outputVatAccountId: true,
        inputVatAccountId: true,
        outputVatAccount: { select: { id: true, code: true, name: true, type: true } },
        inputVatAccount: { select: { id: true, code: true, name: true, type: true } },
      } as any,
    });

    if (cfg) return cfg;

    return (this.prisma as any).tenantTaxConfig.create({
      data: { tenantId: tenant.id } as any,
      select: {
        tenantId: true,
        outputVatAccountId: true,
        inputVatAccountId: true,
        outputVatAccount: { select: { id: true, code: true, name: true, type: true } },
        inputVatAccount: { select: { id: true, code: true, name: true, type: true } },
      } as any,
    });
  }

  async updateConfig(req: Request, dto: UpdateTenantTaxConfigDto) {
    const tenant = this.ensureTenant(req);
    const user = this.ensureUser(req);

    const outputVatAccountId =
      dto.outputVatAccountId === undefined
        ? undefined
        : dto.outputVatAccountId
          ? String(dto.outputVatAccountId).trim()
          : null;

    const inputVatAccountId =
      dto.inputVatAccountId === undefined
        ? undefined
        : dto.inputVatAccountId
          ? String(dto.inputVatAccountId).trim()
          : null;

    if (outputVatAccountId) {
      await this.assertVatAccountValid({
        tenantId: tenant.id,
        accountId: outputVatAccountId,
        expectedType: 'LIABILITY',
      });
    }
    if (inputVatAccountId) {
      await this.assertVatAccountValid({
        tenantId: tenant.id,
        accountId: inputVatAccountId,
        expectedType: 'ASSET',
      });
    }

    await (this.prisma as any).tenantTaxConfig.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        ...(outputVatAccountId !== undefined ? { outputVatAccountId } : {}),
        ...(inputVatAccountId !== undefined ? { inputVatAccountId } : {}),
      } as any,
      update: {
        ...(outputVatAccountId !== undefined ? { outputVatAccountId } : {}),
        ...(inputVatAccountId !== undefined ? { inputVatAccountId } : {}),
      } as any,
    });

    await (this.prisma as any).auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'TAX_CONFIG_UPDATED' as any,
          entityType: 'TENANT_TAX_CONFIG' as any,
          entityId: tenant.id,
          action: 'TAX_CONFIG_UPDATE',
          outcome: 'SUCCESS',
          userId: user.id,
          permissionUsed: 'TAX_CONFIG_UPDATE',
        } as any,
      })
      .catch(() => undefined);

    return this.getConfig(req);
  }

  async outputSummary(req: Request, dto: TaxSummaryQueryDto) {
    const tenant = this.ensureTenant(req);

    const from = new Date(dto.from);
    const to = new Date(dto.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid from/to dates');
    }
    if (from > to) {
      throw new BadRequestException('from must be less than or equal to to');
    }

    await this.assertPeriodCoverage({ tenantId: tenant.id, from, to });

    const arInvoices = await this.prisma.customerInvoice.findMany({
      where: {
        tenantId: tenant.id,
        status: 'POSTED',
        invoiceDate: { gte: from, lte: to },
      } as any,
      select: { id: true, subtotal: true, taxAmount: true, totalAmount: true } as any,
    });

    const taxableSales = this.round2(
      (arInvoices ?? []).reduce((s, i: any) => s + Number(i.subtotal ?? 0), 0),
    );
    const vatCharged = this.round2(
      (arInvoices ?? []).reduce((s, i: any) => s + Number(i.taxAmount ?? 0), 0),
    );

    return {
      from: dto.from,
      to: dto.to,
      taxableSales,
      vatCharged,
    };
  }

  async inputSummary(req: Request, dto: TaxSummaryQueryDto) {
    const tenant = this.ensureTenant(req);

    const from = new Date(dto.from);
    const to = new Date(dto.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid from/to dates');
    }
    if (from > to) {
      throw new BadRequestException('from must be less than or equal to to');
    }

    await this.assertPeriodCoverage({ tenantId: tenant.id, from, to });

    // Until AP VAT is migrated onto supplier invoices similarly to AR, expose VAT paid from existing InvoiceTaxLine.
    const apInvoices = await this.prisma.supplierInvoice.findMany({
      where: {
        tenantId: tenant.id,
        status: 'POSTED',
        invoiceDate: { gte: from, lte: to },
      } as any,
      select: { id: true } as any,
    });
    const apIds = (apInvoices ?? []).map((i: any) => i.id);

    if (apIds.length === 0) {
      return {
        from: dto.from,
        to: dto.to,
        vatPaid: 0,
      };
    }

    const inputTaxLines = await this.prisma.invoiceTaxLine.findMany({
      where: {
        tenantId: tenant.id,
        sourceType: 'SUPPLIER_INVOICE',
        sourceId: { in: apIds },
        taxRate: { type: 'INPUT' },
      } as any,
      select: { taxAmount: true } as any,
    });

    const vatPaid = this.round2(
      (inputTaxLines ?? []).reduce((s, t: any) => s + Number(t.taxAmount ?? 0), 0),
    );

    return {
      from: dto.from,
      to: dto.to,
      vatPaid,
    };
  }
}
