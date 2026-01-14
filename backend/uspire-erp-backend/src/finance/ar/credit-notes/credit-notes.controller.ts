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
  ApproveCreditNoteDto,
  CreateCustomerCreditNoteDto,
  ListCreditNotesQueryDto,
  PostCreditNoteDto,
  SubmitCreditNoteDto,
  VoidCreditNoteDto,
} from './credit-notes.dto';
import { FinanceArCreditNotesService } from './credit-notes.service';

@Controller('finance/ar/credit-notes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceArCreditNotesController {
  constructor(private readonly creditNotes: FinanceArCreditNotesService) {}

  @Get()
  @Permissions(PERMISSIONS.AR.CREDIT_NOTE_VIEW)
  async list(@Req() req: Request, @Query() q: ListCreditNotesQueryDto) {
    return this.creditNotes.list(req, q);
  }

  @Get('eligible-customers')
  @Permissions(PERMISSIONS.AR.CREDIT_NOTE_CREATE)
  async eligibleCustomers(@Req() req: Request) {
    return this.creditNotes.listEligibleCustomers(req);
  }

  @Get('eligible-invoices')
  @Permissions(PERMISSIONS.AR.CREDIT_NOTE_CREATE)
  async eligibleInvoices(@Req() req: Request, @Query('customerId') customerId: string) {
    return this.creditNotes.listEligibleInvoices(req, customerId);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.AR.CREDIT_NOTE_VIEW)
  async getById(@Req() req: Request, @Param('id') id: string) {
    return this.creditNotes.getById(req, id);
  }

  @Get(':id/export')
  @Permissions(PERMISSIONS.AR.CREDIT_NOTE_VIEW)
  async exportPdf(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const body = await this.creditNotes.exportPdf(req, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="credit-note-${id}.pdf"`,
    );
    res.send(body);
  }

  @Post()
  @Permissions(PERMISSIONS.AR.CREDIT_NOTE_CREATE)
  async create(@Req() req: Request, @Body() dto: CreateCustomerCreditNoteDto) {
    return this.creditNotes.create(req, dto);
  }

  @Post(':id/submit')
  @Permissions(PERMISSIONS.AR.CREDIT_NOTE_CREATE)
  async submit(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SubmitCreditNoteDto,
  ) {
    return this.creditNotes.submit(req, id, dto);
  }

  @Post(':id/approve')
  @Permissions(PERMISSIONS.AR.CREDIT_NOTE_APPROVE)
  async approve(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ApproveCreditNoteDto,
  ) {
    return this.creditNotes.approve(req, id, dto);
  }

  @Post(':id/post')
  @Permissions(PERMISSIONS.AR.CREDIT_NOTE_POST)
  async post(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() _dto: PostCreditNoteDto,
  ) {
    return this.creditNotes.post(req, id);
  }

  @Post(':id/void')
  @Permissions(PERMISSIONS.AR.CREDIT_NOTE_VOID)
  async void(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: VoidCreditNoteDto,
  ) {
    return this.creditNotes.void(req, id, dto);
  }
}
