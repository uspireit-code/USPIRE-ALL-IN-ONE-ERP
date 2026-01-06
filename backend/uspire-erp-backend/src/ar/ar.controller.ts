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
import { ArService } from './ar.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateCustomerInvoiceDto } from './dto/create-customer-invoice.dto';
import { PostCustomerInvoiceDto } from './dto/post-customer-invoice.dto';

@Controller('ar')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ArController {
  constructor(private readonly ar: ArService) {}

  @Post('customers')
  @Permissions('AR_CUSTOMER_CREATE')
  async createCustomer(@Req() req: Request, @Body() dto: CreateCustomerDto) {
    return this.ar.createCustomer(req, dto);
  }

  @Get('customers')
  @Permissions('AR_INVOICE_CREATE')
  async listCustomers(@Req() req: Request) {
    return this.ar.listCustomers(req);
  }

  @Get('accounts')
  @Permissions('AR_INVOICE_CREATE')
  async listEligibleAccounts(@Req() req: Request) {
    return this.ar.listEligibleAccounts(req);
  }

  @Post('invoices')
  @Permissions('AR_INVOICE_CREATE')
  async createInvoice(
    @Req() req: Request,
    @Body() dto: CreateCustomerInvoiceDto,
  ) {
    return this.ar.createInvoice(req, dto);
  }

  @Post('invoices/:id/post')
  @Permissions('AR_INVOICE_POST')
  async postInvoice(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() _dto: PostCustomerInvoiceDto,
  ) {
    return this.ar.postInvoice(req, id);
  }

  @Get('invoices')
  @Permissions('AR_INVOICE_VIEW')
  async listInvoices(@Req() req: Request) {
    return this.ar.listInvoices(req);
  }
}
