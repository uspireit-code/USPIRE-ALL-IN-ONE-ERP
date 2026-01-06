import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';

@Injectable()
export class TaxService {
  constructor(private readonly prisma: PrismaService) {}

  async createTaxRate(req: Request, dto: CreateTaxRateDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    const code = String(dto.code ?? '').trim().toUpperCase();
    const name = String(dto.name ?? '').trim();
    if (!code) throw new BadRequestException('code is required');
    if (!name) throw new BadRequestException('name is required');

    const rate = Number(dto.rate);
    if (!(rate >= 0 && rate <= 100)) {
      throw new BadRequestException('rate must be between 0 and 100');
    }

    const glAccountId = dto.glAccountId ? String(dto.glAccountId).trim() : undefined;
    if (glAccountId) {
      const glAccount = await this.prisma.account.findFirst({
        where: { id: glAccountId, tenantId: tenant.id, isActive: true },
        select: { id: true, type: true },
      });

      if (!glAccount) {
        throw new BadRequestException(
          'VAT control GL account not found or inactive',
        );
      }

      if (dto.type === 'INPUT' && glAccount.type !== 'ASSET') {
        throw new BadRequestException(
          'INPUT VAT control account must be an ASSET',
        );
      }

      if (dto.type === 'OUTPUT' && glAccount.type !== 'LIABILITY') {
        throw new BadRequestException(
          'OUTPUT VAT control account must be a LIABILITY',
        );
      }
    }

    return (this.prisma as any).taxRate.create({
      data: {
        tenantId: tenant.id,
        code,
        name,
        rate,
        type: dto.type,
        glAccountId,
        isActive: true,
      } as any,
      include: { glAccount: true },
    });
  }

  async listTaxRates(req: Request) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    return this.prisma.taxRate.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
      include: { glAccount: true },
    });
  }
}
