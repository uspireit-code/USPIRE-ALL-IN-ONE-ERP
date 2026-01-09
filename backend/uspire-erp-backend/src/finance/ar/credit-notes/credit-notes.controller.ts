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
import { JwtAuthGuard } from '../../../rbac/jwt-auth.guard';
import { Permissions } from '../../../rbac/permissions.decorator';
import { PermissionsGuard } from '../../../rbac/permissions.guard';
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
  @Permissions('AR_CREDIT_NOTE_VIEW')
  async list(@Req() req: Request, @Query() q: ListCreditNotesQueryDto) {
    return this.creditNotes.list(req, q);
  }

  @Get(':id')
  @Permissions('AR_CREDIT_NOTE_VIEW')
  async getById(@Req() req: Request, @Param('id') id: string) {
    return this.creditNotes.getById(req, id);
  }

  @Post()
  @Permissions('AR_CREDIT_NOTE_CREATE')
  async create(@Req() req: Request, @Body() dto: CreateCustomerCreditNoteDto) {
    return this.creditNotes.create(req, dto);
  }

  @Post(':id/submit')
  @Permissions('AR_CREDIT_NOTE_SUBMIT')
  async submit(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SubmitCreditNoteDto,
  ) {
    return this.creditNotes.submit(req, id, dto);
  }

  @Post(':id/approve')
  @Permissions('AR_CREDIT_NOTE_APPROVE')
  async approve(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ApproveCreditNoteDto,
  ) {
    return this.creditNotes.approve(req, id, dto);
  }

  @Post(':id/post')
  @Permissions('AR_CREDIT_NOTE_POST')
  async post(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() _dto: PostCreditNoteDto,
  ) {
    return this.creditNotes.post(req, id);
  }

  @Post(':id/void')
  @Permissions('AR_CREDIT_NOTE_VOID')
  async void(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: VoidCreditNoteDto,
  ) {
    return this.creditNotes.void(req, id, dto);
  }
}
