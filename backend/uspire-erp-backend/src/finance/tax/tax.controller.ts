import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../rbac/jwt-auth.guard';
import { PERMISSIONS } from '../../rbac/permission-catalog';
import { Permissions } from '../../rbac/permissions.decorator';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import {
  CreateTaxRateDto,
  SetTaxRateActiveDto,
  TaxSummaryQueryDto,
  UpdateTaxRateDto,
  UpdateTenantTaxConfigDto,
} from './tax.dto';
import { FinanceTaxService } from './tax.service';

@Controller('finance/tax')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceTaxController {
  constructor(private readonly tax: FinanceTaxService) {}

  @Get('rates')
  @Permissions(PERMISSIONS.TAX.RATE_VIEW)
  async listRates(@Req() req: Request) {
    return this.tax.listRates(req);
  }

  @Get('rates/:id')
  @Permissions(PERMISSIONS.TAX.RATE_VIEW)
  async getRateById(@Req() req: Request, @Param('id') id: string) {
    return this.tax.getRateById(req, id);
  }

  @Post('rates')
  @Permissions(PERMISSIONS.TAX.RATE_CREATE)
  async createRate(@Req() req: Request, @Body() dto: CreateTaxRateDto) {
    return this.tax.createRate(req, dto);
  }

  @Put('rates/:id')
  @Permissions(PERMISSIONS.TAX.RATE_UPDATE)
  async updateRate(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateTaxRateDto,
  ) {
    return this.tax.updateRate(req, id, dto);
  }

  @Put('rates/:id/active')
  @Permissions(PERMISSIONS.TAX.RATE_UPDATE)
  async setRateActive(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SetTaxRateActiveDto,
  ) {
    return this.tax.setRateActive(req, id, dto?.isActive);
  }

  @Get('config')
  @Permissions(PERMISSIONS.TAX.RATE_VIEW)
  async getConfig(@Req() req: Request) {
    return this.tax.getConfig(req);
  }

  @Put('config')
  @Permissions(PERMISSIONS.TAX.CONFIG_UPDATE)
  async updateConfig(@Req() req: Request, @Body() dto: UpdateTenantTaxConfigDto) {
    return this.tax.updateConfig(req, dto);
  }

  @Get('output-summary')
  @Permissions(PERMISSIONS.TAX.REPORT_VIEW)
  async outputSummary(@Req() req: Request, @Query() q: TaxSummaryQueryDto) {
    return this.tax.outputSummary(req, q);
  }

  @Get('input-summary')
  @Permissions(PERMISSIONS.TAX.REPORT_VIEW)
  async inputSummary(@Req() req: Request, @Query() q: TaxSummaryQueryDto) {
    return this.tax.inputSummary(req, q);
  }
}
