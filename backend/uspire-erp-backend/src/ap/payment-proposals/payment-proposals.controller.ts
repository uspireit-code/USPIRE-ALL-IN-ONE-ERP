import {
  Body,
  Controller,
  Get,
  Patch,
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
import {
  CreatePaymentProposalDto,
  EligibleApInvoicesQueryDto,
  ListPaymentProposalsQueryDto,
  RejectPaymentProposalDto,
} from './payment-proposals.dto';
import { PaymentProposalsService } from './payment-proposals.service';

@Controller('ap/payment-proposals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentProposalsController {
  constructor(private readonly svc: PaymentProposalsService) {}

  @Get()
  @Permissions(PERMISSIONS.AP.PAYMENT_PROPOSAL_VIEW)
  async list(@Req() req: Request, @Query() q: ListPaymentProposalsQueryDto) {
    return this.svc.list(req, q);
  }

  @Get('eligible-invoices')
  @Permissions(PERMISSIONS.AP.PAYMENT_PROPOSAL_CREATE)
  async eligibleInvoices(@Req() req: Request, @Query() q: EligibleApInvoicesQueryDto) {
    return this.svc.listEligibleInvoices(req, q);
  }

  @Get('eligible-for-execution')
  @Permissions(PERMISSIONS.AP.PAYMENT_RUN_EXECUTE)
  async eligibleForExecution(@Req() req: Request) {
    return this.svc.listEligibleForExecution(req);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.AP.PAYMENT_PROPOSAL_VIEW)
  async getById(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getById(req, id);
  }

  @Post()
  @Permissions(PERMISSIONS.AP.PAYMENT_PROPOSAL_CREATE)
  async create(@Req() req: Request, @Body() dto: CreatePaymentProposalDto) {
    return this.svc.create(req, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.AP.PAYMENT_PROPOSAL_CREATE)
  async updateDraft(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreatePaymentProposalDto,
  ) {
    return this.svc.updateDraft(req, id, dto);
  }

  @Post(':id/submit')
  @Permissions(PERMISSIONS.AP.PAYMENT_PROPOSAL_SUBMIT)
  async submit(@Req() req: Request, @Param('id') id: string) {
    return this.svc.submit(req, id);
  }

  @Post(':id/approve')
  @Permissions(PERMISSIONS.AP.PAYMENT_PROPOSAL_APPROVE)
  async approve(@Req() req: Request, @Param('id') id: string) {
    return this.svc.approve(req, id);
  }

  @Post(':id/reject')
  @Permissions(PERMISSIONS.AP.PAYMENT_PROPOSAL_REJECT)
  async reject(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RejectPaymentProposalDto,
  ) {
    return this.svc.reject(req, id, dto);
  }
}
