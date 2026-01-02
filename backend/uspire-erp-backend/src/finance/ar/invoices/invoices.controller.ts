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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../../rbac/jwt-auth.guard';
import { Permissions } from '../../../rbac/permissions.decorator';
import { PermissionsGuard } from '../../../rbac/permissions.guard';
import {
  CreateCustomerInvoiceDto,
  ListInvoicesQueryDto,
  PostInvoiceDto,
} from './invoices.dto';
import { FinanceArInvoicesService } from './invoices.service';

@Controller('finance/ar/invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceArInvoicesController {
  constructor(private readonly invoices: FinanceArInvoicesService) {}

  @Get()
  @Permissions('AR_INVOICE_VIEW')
  async list(@Req() req: Request, @Query() q: ListInvoicesQueryDto) {
    return this.invoices.list(req, q);
  }

  @Post()
  @Permissions('AR_INVOICE_CREATE')
  async create(@Req() req: Request, @Body() dto: CreateCustomerInvoiceDto) {
    return this.invoices.create(req, dto);
  }

  @Post('import')
  @Permissions('AR_INVOICE_CREATE')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async import(@Req() req: Request, @UploadedFile() file: any) {
    return this.invoices.import(req, file);
  }

  @Post('import/preview')
  @Permissions('AR_INVOICE_CREATE')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async previewImport(@Req() req: Request, @UploadedFile() file: any) {
    return this.invoices.previewImport(req, file);
  }

  @Get('import/template.csv')
  @Permissions('AR_INVOICE_CREATE')
  async downloadImportCsvTemplate(@Req() req: Request, @Res() res: Response) {
    const out = await this.invoices.getImportCsvTemplate(req);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
    res.send(out.body);
  }

  @Get('import/template.xlsx')
  @Permissions('AR_INVOICE_CREATE')
  async downloadImportXlsxTemplate(@Req() req: Request, @Res() res: Response) {
    const out = await this.invoices.getImportXlsxTemplate(req);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
    res.send(out.body);
  }

  @Get(':id')
  @Permissions('AR_INVOICE_VIEW')
  async getById(@Req() req: Request, @Param('id') id: string) {
    return this.invoices.getById(req, id);
  }

  @Post(':id/post')
  @Permissions('AR_INVOICE_POST')
  async postInvoice(@Req() req: Request, @Param('id') id: string, @Body() dto: PostInvoiceDto) {
    return this.invoices.post(req, id, {
      arControlAccountCode: dto.arControlAccountCode,
    });
  }
}
