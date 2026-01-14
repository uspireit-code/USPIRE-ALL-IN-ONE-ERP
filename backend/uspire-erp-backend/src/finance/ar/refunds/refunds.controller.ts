import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../rbac/jwt-auth.guard';
import { Permissions } from '../../../rbac/permissions.decorator';
import { PermissionsGuard } from '../../../rbac/permissions.guard';
import { PERMISSIONS } from '../../../rbac/permission-catalog';
import {
  CreateCustomerRefundDto,
  ListRefundsQueryDto,
  ApproveRefundDto,
  PostRefundDto,
  SubmitRefundDto,
  VoidRefundDto,
} from './refunds.dto';
import { FinanceArRefundsService } from './refunds.service';

@Controller('finance/ar/refunds')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceArRefundsController {
  constructor(private readonly refunds: FinanceArRefundsService) {}

  @Get()
  @Permissions(PERMISSIONS.AR.REFUND_VIEW)
  async list(@Req() req: Request, @Query() q: ListRefundsQueryDto) {
    return this.refunds.list(req, q);
  }

  @Get('refundable-credit-notes')
  @Permissions(PERMISSIONS.AR.REFUND_CREATE)
  async listRefundableCreditNotes(
    @Req() req: Request,
    @Query('customerId') customerId: string,
  ) {
    return this.refunds.listRefundableCreditNotes(req, customerId);
  }

  @Get('refundable-customers')
  @Permissions(PERMISSIONS.AR.REFUND_CREATE)
  async listRefundableCustomers(@Req() req: Request) {
    return this.refunds.listRefundableCustomers(req);
  }

  @Get('credit-notes/:creditNoteId/refundable')
  @Permissions(PERMISSIONS.AR.REFUND_CREATE)
  async refundable(
    @Req() req: Request,
    @Param('creditNoteId') creditNoteId: string,
  ) {
    return this.refunds.getRefundableForCreditNote(req, creditNoteId);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.AR.REFUND_VIEW)
  async getById(@Req() req: Request, @Param('id') id: string) {
    return this.refunds.getById(req, id);
  }

  @Get(':id/export')
  @Permissions(PERMISSIONS.AR.REFUND_VIEW)
  async exportPdf(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const body = await this.refunds.exportPdf(req, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="refund-${id}.pdf"`,
    );
    res.send(body);
  }

  @Post()
  @Permissions(PERMISSIONS.AR.REFUND_CREATE)
  async create(@Req() req: Request, @Body() dto: CreateCustomerRefundDto) {
    return this.refunds.create(req, dto);
  }

  @Post(':id/submit')
  @Permissions(PERMISSIONS.AR.REFUND_SUBMIT)
  async submit(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() _dto: SubmitRefundDto,
  ) {
    return this.refunds.submit(req, id);
  }

  @Post(':id/approve')
  @Permissions(PERMISSIONS.AR.REFUND_APPROVE)
  async approve(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() _dto: ApproveRefundDto,
  ) {
    return this.refunds.approve(req, id);
  }

  @Post(':id/post')
  @Permissions(PERMISSIONS.AR.REFUND_POST)
  async post(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() _dto: PostRefundDto,
  ) {
    return this.refunds.post(req, id);
  }

  @Post(':id/void')
  @Permissions(PERMISSIONS.AR.REFUND_VOID)
  async void(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: VoidRefundDto,
  ) {
    return this.refunds.void(req, id, dto);
  }
}
