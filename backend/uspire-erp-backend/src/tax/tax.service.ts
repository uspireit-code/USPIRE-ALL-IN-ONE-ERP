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

    const glAccount = await this.prisma.account.findFirst({
      where: { id: dto.glAccountId, tenantId: tenant.id, isActive: true },
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

    return this.prisma.taxRate.create({
      data: {
        tenantId: tenant.id,
        name: dto.name,
        rate: dto.rate,
        type: dto.type,
        glAccountId: dto.glAccountId,
        isActive: true,
      },
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
