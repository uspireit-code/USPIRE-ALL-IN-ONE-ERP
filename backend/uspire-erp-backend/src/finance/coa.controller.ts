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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import ExcelJS from 'exceljs';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { CreateCoaAccountDto, UpdateCoaAccountDto } from './coa.dto';
import { CoaService } from './coa.service';

@Controller('finance/coa')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CoaController {
  constructor(private readonly coa: CoaService) {}

  @Get()
  @Permissions(PERMISSIONS.COA.VIEW)
  async list(@Req() req: Request) {
    return this.coa.list(req);
  }

  @Get('tree')
  @Permissions(PERMISSIONS.COA.VIEW)
  async tree(@Req() req: Request) {
    return this.coa.tree(req);
  }

  @Post()
  @Permissions(PERMISSIONS.COA.UPDATE)
  async create(@Req() req: Request, @Body() dto: CreateCoaAccountDto) {
    return this.coa.create(req, dto);
  }

  @Post('import')
  @Permissions(PERMISSIONS.COA.UPDATE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async importCanonical(@Req() req: Request, @UploadedFile() file: any) {
    return this.coa.importCanonical(req, file);
  }

  @Get('import-template')
  @Permissions(PERMISSIONS.COA.UPDATE)
  async importTemplate(
    @Req() req: Request,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    void req;
    const fmt = (format ?? 'csv').trim().toLowerCase();

    const headers = [
      'accountCode',
      'accountName',
      'category',
      'subCategory',
      'normalBalance',
      'fsMappingLevel1',
      'fsMappingLevel2',
      'parentAccountCode',
      'isControlAccount',
    ];

    if (fmt === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('COA');
      ws.addRow(headers);

      const body = (await wb.xlsx.writeBuffer()) as any as Buffer;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="coa_import_template.xlsx"',
      );
      res.send(body);
      return;
    }

    const escape = (v: any) => {
      const s = String(v ?? '');
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const csv = [headers.map(escape).join(',')].join('\n') + '\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="coa_import_template.csv"',
    );
    res.send(csv);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.COA.VIEW)
  async get(@Req() req: Request, @Param('id') id: string) {
    return this.coa.get(req, id);
  }

  @Post('cleanup-non-canonical')
  @Permissions(PERMISSIONS.COA.UPDATE)
  async cleanupNonCanonical(
    @Req() req: Request,
    @Body() dto: { canonicalHash?: string; dryRun?: boolean },
  ) {
    return this.coa.cleanupNonCanonical(req, dto);
  }

  @Post('setup-tax-control-accounts')
  @Permissions(PERMISSIONS.COA.UPDATE)
  async setupTaxControlAccounts(@Req() req: Request) {
    return this.coa.setupTaxControlAccounts(req);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.COA.UPDATE)
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCoaAccountDto,
  ) {
    return this.coa.update(req, id, dto);
  }

  @Put(':id')
  @Permissions(PERMISSIONS.COA.UPDATE)
  async put(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCoaAccountDto,
  ) {
    return this.coa.update(req, id, dto);
  }

  @Post('freeze')
  @Permissions(PERMISSIONS.COA.UPDATE)
  async freeze(@Req() req: Request) {
    return this.coa.freeze(req);
  }

  @Post('unfreeze')
  @Permissions(PERMISSIONS.COA.UPDATE)
  async unfreeze(@Req() req: Request) {
    return this.coa.unfreeze(req);
  }

  @Post('lock')
  @Permissions(PERMISSIONS.COA.UPDATE)
  async lock(@Req() req: Request) {
    return this.coa.lock(req);
  }

  @Post('unlock')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.COA.UNLOCK)
  async unlock(@Req() req: Request) {
    return this.coa.unlock(req);
  }
}
