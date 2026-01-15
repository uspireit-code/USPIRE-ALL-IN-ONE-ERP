import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { ApService } from './ap.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { PostInvoiceDto } from './dto/post-invoice.dto';
import { UploadSupplierDocumentDto } from './dto/upload-supplier-document.dto';
import { CreateSupplierBankAccountDto } from './dto/create-supplier-bank-account.dto';
import { UpdateSupplierBankAccountDto } from './dto/update-supplier-bank-account.dto';

@Controller('ap')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApController {
  constructor(private readonly ap: ApService) {}

  @Post('suppliers')
  @Permissions(PERMISSIONS.AP.SUPPLIER_CREATE)
  async createSupplier(@Req() req: Request, @Body() dto: CreateSupplierDto) {
    return this.ap.createSupplier(req, dto);
  }

  @Get('suppliers')
  @Permissions(PERMISSIONS.AP.SUPPLIER_VIEW)
  async listSuppliers(@Req() req: Request) {
    return this.ap.listSuppliers(req);
  }

  @Get('suppliers/import/template.csv')
  @Permissions(PERMISSIONS.AP.SUPPLIER_IMPORT)
  async downloadSupplierImportTemplate(@Req() req: Request, @Res() res: Response) {
    const out = await this.ap.getSupplierImportCsvTemplate(req);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
    res.send(out.body);
  }

  @Post('suppliers/import/preview')
  @Permissions(PERMISSIONS.AP.SUPPLIER_IMPORT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async previewSupplierImport(@Req() req: Request, @UploadedFile() file: any) {
    return this.ap.previewSupplierImport(req, file);
  }

  @Post('suppliers/import/commit')
  @Permissions(PERMISSIONS.AP.SUPPLIER_IMPORT)
  async commitSupplierImport(@Req() req: Request, @Body() payload: { rows: any[] }) {
    return this.ap.commitSupplierImport(req, payload?.rows ?? []);
  }

  // Supplier documents
  @Get('suppliers/:id/documents')
  @Permissions(PERMISSIONS.AP.SUPPLIER_VIEW)
  async listSupplierDocuments(@Req() req: Request, @Param('id') id: string) {
    return this.ap.listSupplierDocuments(req, id);
  }

  @Post('suppliers/:id/documents')
  @Permissions(PERMISSIONS.AP.SUPPLIER_CREATE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async uploadSupplierDocument(
    @Req() req: Request,
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body() dto: UploadSupplierDocumentDto,
  ) {
    return this.ap.uploadSupplierDocument(req, id, dto, file);
  }

  @Patch('suppliers/:id/documents/:docId/deactivate')
  @Permissions(PERMISSIONS.AP.SUPPLIER_CREATE)
  async deactivateSupplierDocument(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.ap.deactivateSupplierDocument(req, id, docId);
  }

  @Get('suppliers/:id/documents/:docId/download')
  @Permissions(PERMISSIONS.AP.SUPPLIER_VIEW)
  async downloadSupplierDocument(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const out = await this.ap.downloadSupplierDocument(req, id, docId);
    res.setHeader('Content-Type', out.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(out.size ?? out.body.length));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.fileName}"`,
    );
    res.send(out.body);
  }

  // Supplier bank accounts
  @Get('suppliers/:id/bank-accounts')
  @Permissions(PERMISSIONS.AP.SUPPLIER_VIEW)
  async listSupplierBankAccounts(@Req() req: Request, @Param('id') id: string) {
    return this.ap.listSupplierBankAccounts(req, id);
  }

  @Post('suppliers/:id/bank-accounts')
  @Permissions(PERMISSIONS.AP.SUPPLIER_CREATE)
  async createSupplierBankAccount(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreateSupplierBankAccountDto,
  ) {
    return this.ap.createSupplierBankAccount(req, id, dto);
  }

  @Patch('suppliers/:id/bank-accounts/:bankId')
  @Permissions(PERMISSIONS.AP.SUPPLIER_CREATE)
  async updateSupplierBankAccount(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('bankId') bankId: string,
    @Body() dto: UpdateSupplierBankAccountDto,
  ) {
    return this.ap.updateSupplierBankAccount(req, id, bankId, dto);
  }

  @Patch('suppliers/:id/bank-accounts/:bankId/deactivate')
  @Permissions(PERMISSIONS.AP.SUPPLIER_CREATE)
  async deactivateSupplierBankAccount(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('bankId') bankId: string,
  ) {
    return this.ap.deactivateSupplierBankAccount(req, id, bankId);
  }

  @Patch('suppliers/:id/bank-accounts/:bankId/set-primary')
  @Permissions(PERMISSIONS.AP.SUPPLIER_CREATE)
  async setPrimarySupplierBankAccount(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('bankId') bankId: string,
  ) {
    return this.ap.setPrimarySupplierBankAccount(req, id, bankId);
  }

  // Supplier change history
  @Get('suppliers/:id/change-history')
  @Permissions(PERMISSIONS.AP.SUPPLIER_VIEW)
  async listSupplierChangeHistory(@Req() req: Request, @Param('id') id: string) {
    return this.ap.listSupplierChangeHistory(req, id);
  }

  @Get('accounts')
  @Permissions(PERMISSIONS.AP.INVOICE_CREATE)
  async listEligibleAccounts(@Req() req: Request) {
    return this.ap.listEligibleAccounts(req);
  }

  @Post('invoices')
  @Permissions(PERMISSIONS.AP.INVOICE_CREATE)
  async createInvoice(
    @Req() req: Request,
    @Body() dto: CreateSupplierInvoiceDto,
  ) {
    return this.ap.createInvoice(req, dto);
  }

  @Post('bills')
  @Permissions(PERMISSIONS.AP.INVOICE_CREATE)
  async createBill(
    @Req() req: Request,
    @Body() dto: CreateSupplierInvoiceDto,
  ) {
    return this.ap.createInvoice(req, dto);
  }

  @Post('invoices/:id/submit')
  @Permissions(PERMISSIONS.AP.INVOICE_SUBMIT)
  async submitInvoice(@Req() req: Request, @Param('id') id: string) {
    return this.ap.submitInvoice(req, id);
  }

  @Post('bills/:id/submit')
  @Permissions(PERMISSIONS.AP.INVOICE_SUBMIT)
  async submitBill(@Req() req: Request, @Param('id') id: string) {
    return this.ap.submitInvoice(req, id);
  }

  @Post('invoices/:id/approve')
  @Permissions(PERMISSIONS.AP.INVOICE_APPROVE)
  async approveInvoice(@Req() req: Request, @Param('id') id: string) {
    return this.ap.approveInvoice(req, id);
  }

  @Post('bills/:id/approve')
  @Permissions(PERMISSIONS.AP.INVOICE_APPROVE)
  async approveBill(@Req() req: Request, @Param('id') id: string) {
    return this.ap.approveInvoice(req, id);
  }

  @Post('invoices/:id/post')
  @Permissions(PERMISSIONS.AP.INVOICE_POST)
  async postInvoice(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PostInvoiceDto,
  ) {
    return this.ap.postInvoice(req, id, {
      apControlAccountCode: dto.apControlAccountCode,
    });
  }

  @Post('bills/:id/post')
  @Permissions(PERMISSIONS.AP.INVOICE_POST)
  async postBill(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PostInvoiceDto,
  ) {
    return this.ap.postInvoice(req, id, {
      apControlAccountCode: dto.apControlAccountCode,
    });
  }

  @Get('invoices')
  @Permissions(PERMISSIONS.AP.INVOICE_VIEW)
  async listInvoices(@Req() req: Request) {
    return this.ap.listInvoices(req);
  }

  @Get('bills')
  @Permissions(PERMISSIONS.AP.INVOICE_VIEW)
  async listBills(@Req() req: Request) {
    return this.ap.listInvoices(req);
  }
}
