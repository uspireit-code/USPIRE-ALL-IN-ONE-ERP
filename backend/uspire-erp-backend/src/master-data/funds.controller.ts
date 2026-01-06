import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { CreateFundDto, FundIdParamDto, UpdateFundDto } from './funds.dto';
import { FundsService } from './funds.service';

@Controller('master-data/funds')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FundsController {
  constructor(private readonly funds: FundsService) {}

  @Get()
  @Permissions('MASTER_DATA_FUND_VIEW')
  async list(@Req() req: Request) {
    return this.funds.list(req);
  }

  @Post()
  @Permissions('MASTER_DATA_FUND_CREATE')
  async create(@Req() req: Request, @Body() dto: CreateFundDto) {
    return this.funds.create(req, dto);
  }

  @Patch(':id')
  @Permissions('MASTER_DATA_FUND_EDIT')
  async update(
    @Req() req: Request,
    @Param() params: FundIdParamDto,
    @Body() dto: UpdateFundDto,
  ) {
    return this.funds.update(req, params.id, dto);
  }
}
