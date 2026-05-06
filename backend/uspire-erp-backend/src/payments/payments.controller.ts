import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PostPaymentDto } from './dto/post-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @Permissions(PERMISSIONS.PAYMENT.CREATE)
  async createPayment(@Req() req: Request, @Body() dto: CreatePaymentDto) {
    return this.payments.createPayment(req, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.PAYMENT.CREATE)
  async updatePayment(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.payments.updatePayment(req, id, dto);
  }

  @Post(':id/approve')
  @Permissions(PERMISSIONS.PAYMENT.APPROVE)
  async approvePayment(@Req() req: Request, @Param('id') id: string) {
    return this.payments.approvePayment(req, id);
  }

  @Post(':id/post')
  @Permissions(PERMISSIONS.PAYMENT.POST)
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
  @Permissions(PERMISSIONS.PAYMENT.VIEW)
  async listPayments(@Req() req: Request) {
    return this.payments.listPayments(req);
  }
}
