import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { ArReceiptsService } from './ar-receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { SetReceiptAllocationsDto } from './dto/set-receipt-allocations.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { VoidReceiptDto } from './dto/void-receipt.dto';

@Controller('ar/receipts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ArReceiptsController {
  constructor(private readonly receipts: ArReceiptsService) {}

  @Get()
  @Permissions('AR_RECEIPTS_VIEW')
  async list(@Req() req: Request) {
    return this.receipts.listReceipts(req);
  }

  @Get('customers/:customerId/outstanding-invoices')
  @Permissions('AR_RECEIPTS_VIEW')
  async listOutstandingInvoices(
    @Req() req: Request,
    @Param('customerId') customerId: string,
    @Query('currency') currency?: string,
  ) {
    return this.receipts.listCustomerOutstandingInvoices(req, customerId, currency);
  }

  @Get(':id')
  @Permissions('AR_RECEIPTS_VIEW')
  async getById(@Param('id') id: string, @Req() req: Request) {
    return this.receipts.getReceiptById(req, id);
  }

  @Get(':id/export')
  @Permissions('AR_RECEIPTS_VIEW')
  async exportReceipt(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    const out = await this.receipts.exportReceipt(req, id, {
      format: (format || 'html') as any,
    });

    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
    res.send(out.body);
  }

  @Get(':id/allocations')
  @Permissions('AR_RECEIPTS_VIEW')
  async listAllocations(@Param('id') id: string, @Req() req: Request) {
    return this.receipts.listAllocations(req, id);
  }

  @Put(':id/allocations')
  @Permissions('AR_RECEIPTS_CREATE')
  async setAllocations(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: SetReceiptAllocationsDto,
  ) {
    return this.receipts.setAllocations(req, id, dto);
  }

  @Post()
  @Permissions('AR_RECEIPTS_CREATE')
  async create(@Req() req: Request, @Body() dto: CreateReceiptDto) {
    return this.receipts.createReceipt(req, dto);
  }

  @Patch(':id')
  @Permissions('AR_RECEIPTS_CREATE')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateReceiptDto) {
    return this.receipts.updateReceipt(req, id, dto);
  }

  @Post(':id/post')
  @Permissions('AR_RECEIPTS_CREATE')
  async post(@Req() req: Request, @Param('id') id: string) {
    return this.receipts.postReceipt(req, id);
  }

  @Post(':id/void')
  @Permissions('AR_RECEIPT_VOID')
  async void(@Req() req: Request, @Param('id') id: string, @Body() dto: VoidReceiptDto) {
    return this.receipts.voidReceipt(req, id, dto.reason);
  }
}
