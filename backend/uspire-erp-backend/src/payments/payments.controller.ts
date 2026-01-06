import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PostPaymentDto } from './dto/post-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @Permissions('PAYMENT_CREATE')
  async createPayment(@Req() req: Request, @Body() dto: CreatePaymentDto) {
    return this.payments.createPayment(req, dto);
  }

  @Post(':id/approve')
  @Permissions('PAYMENT_APPROVE')
  async approvePayment(@Req() req: Request, @Param('id') id: string) {
    return this.payments.approvePayment(req, id);
  }

  @Post(':id/post')
  @Permissions('PAYMENT_POST')
  async postPayment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PostPaymentDto,
  ) {
    return this.payments.postPayment(req, id, {
      apControlAccountCode: dto.apControlAccountCode,
    });
  }

  @Get()
  @Permissions('PAYMENT_VIEW')
  async listPayments(@Req() req: Request) {
    return this.payments.listPayments(req);
  }
}
