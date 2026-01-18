import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../rbac/jwt-auth.guard';
import { Permissions } from '../../rbac/permissions.decorator';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { PERMISSIONS } from '../../rbac/permission-catalog';
import { ExecutePaymentRunDto, ListPaymentRunsQueryDto } from './payment-runs.dto';
import { PaymentRunsService } from './payment-runs.service';

@Controller('ap/payment-runs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentRunsController {
  constructor(private readonly svc: PaymentRunsService) {}

  @Get()
  @Permissions(PERMISSIONS.AP.PAYMENT_RUN_VIEW)
  async list(@Req() req: Request, @Query() q: ListPaymentRunsQueryDto) {
    return this.svc.list(req, q);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.AP.PAYMENT_RUN_VIEW)
  async getById(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getById(req, id);
  }

  @Post('execute')
  @Permissions(PERMISSIONS.AP.PAYMENT_RUN_EXECUTE)
  async execute(@Req() req: Request, @Body() dto: ExecutePaymentRunDto) {
    return this.svc.execute(req, dto);
  }
}
