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
import { ApService } from './ap.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { PostInvoiceDto } from './dto/post-invoice.dto';

@Controller('ap')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApController {
  constructor(private readonly ap: ApService) {}

  @Post('suppliers')
  @Permissions('AP_SUPPLIER_CREATE')
  async createSupplier(@Req() req: Request, @Body() dto: CreateSupplierDto) {
    return this.ap.createSupplier(req, dto);
  }

  @Get('suppliers')
  @Permissions('AP_INVOICE_CREATE')
  async listSuppliers(@Req() req: Request) {
    return this.ap.listSuppliers(req);
  }

  @Get('accounts')
  @Permissions('AP_INVOICE_CREATE')
  async listEligibleAccounts(@Req() req: Request) {
    return this.ap.listEligibleAccounts(req);
  }

  @Post('invoices')
  @Permissions('AP_INVOICE_CREATE')
  async createInvoice(
    @Req() req: Request,
    @Body() dto: CreateSupplierInvoiceDto,
  ) {
    return this.ap.createInvoice(req, dto);
  }

  @Post('invoices/:id/submit')
  @Permissions('AP_INVOICE_SUBMIT')
  async submitInvoice(@Req() req: Request, @Param('id') id: string) {
    return this.ap.submitInvoice(req, id);
  }

  @Post('invoices/:id/approve')
  @Permissions('AP_INVOICE_APPROVE')
  async approveInvoice(@Req() req: Request, @Param('id') id: string) {
    return this.ap.approveInvoice(req, id);
  }

  @Post('invoices/:id/post')
  @Permissions('AP_INVOICE_POST')
  async postInvoice(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PostInvoiceDto,
  ) {
    return this.ap.postInvoice(req, id, {
      apControlAccountCode: dto.apControlAccountCode,
    });
  }

  @Get('invoices')
  @Permissions('AP_INVOICE_VIEW')
  async listInvoices(@Req() req: Request) {
    return this.ap.listInvoices(req);
  }
}
