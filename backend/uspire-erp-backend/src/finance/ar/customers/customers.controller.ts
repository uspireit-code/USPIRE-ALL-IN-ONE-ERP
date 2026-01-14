import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
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
import { JwtAuthGuard } from '../../../rbac/jwt-auth.guard';
import { Permissions } from '../../../rbac/permissions.decorator';
import { PermissionsGuard } from '../../../rbac/permissions.guard';
import { PERMISSIONS } from '../../../rbac/permission-catalog';
import {
  CreateCustomerDto,
  ListCustomersQueryDto,
  UpdateCustomerDto,
} from './customers.dto';
import { FinanceArCustomersService } from './customers.service';

@Controller('finance/ar/customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceArCustomersController {
  constructor(private readonly customers: FinanceArCustomersService) {}

  @Get()
  @Permissions(PERMISSIONS.CUSTOMERS.VIEW)
  async list(@Req() req: Request, @Query() q: ListCustomersQueryDto) {
    return this.customers.list(req, q);
  }

  @Post()
  @Permissions(PERMISSIONS.CUSTOMERS.CREATE)
  async create(@Req() req: Request, @Body() dto: CreateCustomerDto) {
    return this.customers.create(req, dto);
  }

  @Put(':id')
  @Permissions(PERMISSIONS.CUSTOMERS.EDIT)
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(req, id, dto);
  }

  @Post('import')
  @Permissions(PERMISSIONS.CUSTOMERS.IMPORT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async import(@Req() req: Request, @UploadedFile() file: any) {
    return this.customers.import(req, file);
  }

  @Post('import/preview')
  @Permissions(PERMISSIONS.CUSTOMERS.IMPORT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async previewImport(@Req() req: Request, @UploadedFile() file: any) {
    return this.customers.previewImport(req, file);
  }

  @Get('import/template.csv')
  @Permissions(PERMISSIONS.CUSTOMERS.IMPORT)
  async downloadImportCsvTemplate(@Req() req: Request, @Res() res: Response) {
    const out = await this.customers.getCustomerImportCsvTemplate(req);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.fileName}"`,
    );
    res.send(out.body);
  }

  @Get('import/template.xlsx')
  @Permissions(PERMISSIONS.CUSTOMERS.IMPORT)
  async downloadImportXlsxTemplate(@Req() req: Request, @Res() res: Response) {
    const out = await this.customers.getCustomerImportXlsxTemplate(req);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.fileName}"`,
    );
    res.send(out.body);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.CUSTOMERS.VIEW)
  async getById(@Req() req: Request, @Param('id') id: string) {
    return this.customers.getById(req, id);
  }
}
