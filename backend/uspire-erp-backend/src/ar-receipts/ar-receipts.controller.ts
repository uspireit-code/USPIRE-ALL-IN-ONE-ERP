import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { ArReceiptsService } from './ar-receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
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

  @Get(':id')
  @Permissions('AR_RECEIPTS_VIEW')
  async getById(@Param('id') id: string, @Req() req: Request) {
    return this.receipts.getReceiptById(req, id);
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
