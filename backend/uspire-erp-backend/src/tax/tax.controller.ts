import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { TaxService } from './tax.service';

@Controller('tax')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TaxController {
  constructor(private readonly tax: TaxService) {}

  @Post('rates')
  @Permissions('TAX_RATE_CREATE')
  async createTaxRate(@Req() req: Request, @Body() dto: CreateTaxRateDto) {
    return this.tax.createTaxRate(req, dto);
  }

  @Get('rates')
  @Permissions('TAX_RATE_VIEW')
  async listTaxRates(@Req() req: Request) {
    return this.tax.listTaxRates(req);
  }
}
