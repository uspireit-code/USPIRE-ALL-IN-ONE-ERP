import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { ArReceiptsService } from './ar-receipts.service';

@Controller('ar/receipts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ArReceiptsController {
  constructor(private readonly receipts: ArReceiptsService) {}

  @Get()
  @Permissions('AR_RECEIPT_READ')
  async list(@Req() _req: Request) {
    return this.receipts.listReceipts();
  }

  @Get(':id')
  @Permissions('AR_RECEIPT_READ')
  async getById(@Param('id') id: string, @Req() _req: Request) {
    return this.receipts.getReceiptById(id);
  }
}
