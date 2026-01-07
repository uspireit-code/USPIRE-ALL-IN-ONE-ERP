import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../rbac/jwt-auth.guard';
import { Permissions } from '../../../rbac/permissions.decorator';
import { PermissionsGuard } from '../../../rbac/permissions.guard';
import {
  ApproveRefundDto,
  CreateCustomerRefundDto,
  PostRefundDto,
  VoidRefundDto,
} from './refunds.dto';
import { FinanceArRefundsService } from './refunds.service';

@Controller('finance/ar/refunds')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceArRefundsController {
  constructor(private readonly refunds: FinanceArRefundsService) {}

  @Post()
  @Permissions('AR_REFUND_CREATE')
  async create(@Req() req: Request, @Body() dto: CreateCustomerRefundDto) {
    return this.refunds.create(req, dto);
  }

  @Post(':id/approve')
  @Permissions('AR_REFUND_APPROVE')
  async approve(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ApproveRefundDto,
  ) {
    return this.refunds.approve(req, id, dto);
  }

  @Post(':id/post')
  @Permissions('AR_REFUND_POST')
  async post(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() _dto: PostRefundDto,
  ) {
    return this.refunds.post(req, id);
  }

  @Post(':id/void')
  @Permissions('AR_REFUND_VOID')
  async void(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: VoidRefundDto,
  ) {
    return this.refunds.void(req, id, dto);
  }
}
