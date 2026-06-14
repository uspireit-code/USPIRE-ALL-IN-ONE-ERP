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
import { Permissions, PermissionsAny } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import {
  ApproveCoaImportBatchDto,
  CreateCoaAccountDto,
  RejectCoaImportBatchDto,
  UpdateCoaAccountDto,
} from './coa.dto';
import { CoaService } from './coa.service';
import { CoaHealthService } from './coa-health.service';

@Controller('finance/coa')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CoaController {
  constructor(
    private readonly coa: CoaService,
    private readonly coaHealth: CoaHealthService,
  ) {}

  @Get()
  @Permissions(PERMISSIONS.COA.VIEW)
  async list(@Req() req: Request, @Query('asOfDate') asOfDate?: string) {
    return this.coa.list(req, { asOfDate });
  }

  @Get('tree')
  @Permissions(PERMISSIONS.COA.VIEW)
  async tree(@Req() req: Request, @Query('asOfDate') asOfDate?: string) {
    return this.coa.tree(req, { asOfDate });
  }

  @Get('submissions')
  @Permissions(PERMISSIONS.COA.VIEW)
  async submissions(@Req() req: Request) {
    return this.coa.listSubmissions(req);
  }

  @Get('parent-options')
  @Permissions(PERMISSIONS.COA.VIEW)
  async parentOptions(@Req() req: Request) {
    return this.coa.listParentOptions(req);
  }

  @Get('health')
  @Permissions(PERMISSIONS.COA.VIEW)
  async health(@Req() req: Request) {
    return this.coaHealth.getHealth(req);
  }

  @Post()
@PermissionsAny(
  PERMISSIONS.COA.DRAFT_CREATE,
  PERMISSIONS.COA.NEW_DRAFT_CREATE,
)
  async create(@Req() req: Request, @Body() dto: CreateCoaAccountDto) {
    return this.coa.create(req, dto);
  }

  @Post('bulk-submit')
  @PermissionsAny(
    PERMISSIONS.COA.DRAFT_SUBMIT,
    PERMISSIONS.COA.NEW_DRAFT_SUBMIT,
  )
  async bulkSubmit(@Req() req: Request, @Body() body: { ids: string[] }) {
    return this.coa.bulkSubmitAccounts(req, body?.ids ?? []);
  }

  @Post(':id/submit')
  @PermissionsAny(
    PERMISSIONS.COA.DRAFT_SUBMIT,
    PERMISSIONS.COA.NEW_DRAFT_SUBMIT,
  )
  async submit(@Req() req: Request, @Param('id') id: string) {
    return this.coa.submitAccount(req, id);
  }

  @Get('approvals/queue')
  @Permissions(PERMISSIONS.COA.APPROVE)
  async approvalsQueue(@Req() req: Request) {
    return this.coa.listApprovalQueue(req);
  }

  @Post('bulk-approve')
  @Permissions(PERMISSIONS.COA.APPROVE)
  async bulkApprove(@Req() req: Request, @Body() body: { ids: string[]; comment?: string }) {
    return this.coa.bulkApproveAccounts(req, body?.ids ?? [], { comment: body?.comment });
  }

  @Post('bulk-reject')
  @Permissions(PERMISSIONS.COA.REJECT)
  async bulkReject(@Req() req: Request, @Body() body: { ids: string[]; rejectionReason?: string }) {
    return this.coa.bulkRejectAccounts(req, body?.ids ?? [], { rejectionReason: body?.rejectionReason });
  }

  @Post('approvals/:requestId/approve')
  @Permissions(PERMISSIONS.COA.APPROVE)
  async approve(
    @Req() req: Request,
    @Param('requestId') requestId: string,
    @Body() dto: { comment?: string },
  ) {
    return this.coa.approveRequest(req, requestId, dto);
  }

  @Post('approvals/:requestId/reject')
  @Permissions(PERMISSIONS.COA.REJECT)
  async reject(
    @Req() req: Request,
    @Param('requestId') requestId: string,
    @Body() dto: { rejectionReason?: string },
  ) {
    return this.coa.rejectRequest(req, requestId, dto);
  }

  @Get('reclassifications')
  @Permissions(PERMISSIONS.COA.VIEW)
  async listReclassifications(@Req() req: Request) {
    return this.coa.listReclassifications(req);
  }

  @Post('reclassifications')
  @Permissions(PERMISSIONS.COA.UPDATE)
  async createReclassification(
    @Req() req: Request,
    @Body()
    dto: {
      accountId: string;
      newParentAccountId?: string | null;
      newIfrsMappingCode?: string | null;
      newFsMappingLevel1?: string | null;
      newFsMappingLevel2?: string | null;
      effectiveStartDate: string;
      reason?: string | null;
    },
  ) {
    return this.coa.createReclassification(req, dto);
  }

  @Post('reclassifications/:id/submit')
  @Permissions(PERMISSIONS.COA.UPDATE)
  async submitReclassification(@Req() req: Request, @Param('id') id: string) {
    return this.coa.submitReclassification(req, id);
  }

  @Post('reclassifications/:id/approve')
  @Permissions(PERMISSIONS.COA.APPROVE)
  async approveReclassification(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { comment?: string },
  ) {
    return this.coa.approveReclassification(req, id, dto);
  }

  @Post('reclassifications/:id/reject')
  @Permissions(PERMISSIONS.COA.REJECT)
  async rejectReclassification(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { rejectionReason?: string },
  ) {
    return this.coa.rejectReclassification(req, id, dto);
  }

 @Post('import')
@PermissionsAny(
  PERMISSIONS.COA.DRAFT_CREATE,
  PERMISSIONS.COA.NEW_DRAFT_CREATE,
)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async importCanonical(@Req() req: Request, @UploadedFile() file: any) {
    const q: any = (req as any).query ?? {};
    const autoSubmit = String(q.autoSubmit ?? '').toLowerCase() === 'true';
    return this.coa.importCanonical(req, file, { autoSubmit });
  }

  @Post('import/validate')
@PermissionsAny(
  PERMISSIONS.COA.DRAFT_CREATE,
  PERMISSIONS.COA.NEW_DRAFT_CREATE,
)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async validateImport(@Req() req: Request, @UploadedFile() file: any) {
    return this.coa.validateImport(req, file);
  }

 @Post('import/commit')
@PermissionsAny(
  PERMISSIONS.COA.DRAFT_CREATE,
  PERMISSIONS.COA.NEW_DRAFT_CREATE,
)
  async commitImport(
    @Req() req: Request,
    @Body()
    dto: {
      sourceFileName?: string | null;
      rows: Array<{
        rowNumber: number;
        accountCode: string;
        accountName: string;
        parentCode?: string | null;
        accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
        normalBalance: 'DEBIT' | 'CREDIT';
        ifrsNodeName?: string | null;
        description?: string | null;
        status: 'VALID' | 'ERROR';
        message?: string | null;
      }>;
    },
  ) {
    return this.coa.commitImport(req, dto);
  }

  @Get('import-batches/draft')
  @Permissions(PERMISSIONS.COA.DRAFT_CREATE)
  async getDraftImportBatch(@Req() req: Request) {
    return this.coa.getDraftImportBatch(req);
  }

  @Get('import-batches/:batchId/accounts')
  @PermissionsAny(PERMISSIONS.COA.DRAFT_CREATE, PERMISSIONS.COA.APPROVE, PERMISSIONS.COA.REJECT)
  async listImportBatchAccounts(
    @Req() req: Request,
    @Param('batchId') batchId: string,
  ) {
    return this.coa.listImportBatchAccounts(req, batchId);
  }

  @Post('import-batches/:batchId/submit')
  @PermissionsAny(
    PERMISSIONS.COA.DRAFT_SUBMIT,
    PERMISSIONS.COA.NEW_DRAFT_SUBMIT,
  )
  async submitImportBatch(@Req() req: Request, @Param('batchId') batchId: string) {
    return this.coa.submitImportBatch(req, batchId);
  }

  @Post('import-batches/:batchId/cancel')
  @Permissions(PERMISSIONS.COA.DRAFT_CREATE)
  async cancelImportBatch(@Req() req: Request, @Param('batchId') batchId: string) {
    return this.coa.cancelImportBatch(req, batchId);
  }

  @Get('import-batches/:batchId/review')
  @Permissions(PERMISSIONS.COA.APPROVE)
  async reviewImportBatch(@Req() req: Request, @Param('batchId') batchId: string) {
    return this.coa.reviewImportBatch(req, batchId);
  }

  @Post('import-batches/:batchId/approve')
  @Permissions(PERMISSIONS.COA.APPROVE)
  async approveImportBatch(
    @Req() req: Request,
    @Param('batchId') batchId: string,
    @Body() dto: ApproveCoaImportBatchDto,
  ) {
    return this.coa.approveImportBatch(req, batchId, dto);
  }

  @Post('import-batches/:batchId/reject')
  @Permissions(PERMISSIONS.COA.REJECT)
  async rejectImportBatch(
    @Req() req: Request,
    @Param('batchId') batchId: string,
    @Body() dto: RejectCoaImportBatchDto,
  ) {
    return this.coa.rejectImportBatch(req, batchId, dto);
  }

  @Get('import-template')
@PermissionsAny(
  PERMISSIONS.COA.DRAFT_CREATE,
  PERMISSIONS.COA.NEW_DRAFT_CREATE,
)
  async importTemplate(
    @Req() req: Request,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    void req;
    const tpl = await this.coa.getImportTemplate(req, { format });
    res.setHeader('Content-Type', tpl.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${tpl.fileName}"`,
    );
    res.send(tpl.body);
  }

@Get('import-template/industry/:industry')
@PermissionsAny(
  PERMISSIONS.COA.DRAFT_CREATE,
  PERMISSIONS.COA.NEW_DRAFT_CREATE,
)
  async importIndustryTemplate(
    @Req() req: Request,
    @Param('industry') industry: string,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const tpl = await this.coa.getIndustryImportTemplate(req, {
      industry,
      format,
    });
    res.setHeader('Content-Type', tpl.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${tpl.fileName}"`,
    );
    res.send(tpl.body);
  }

  @Post('reset')
  @Permissions(PERMISSIONS.FINANCE.CONFIG_CHANGE)
  async resetTenantCoa(@Req() req: Request) {
    return this.coa.resetTenantCoa(req);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.COA.VIEW)
  async get(@Req() req: Request, @Param('id') id: string) {
    return this.coa.get(req, id);
  }

  @Post(':id/block')
  @Permissions(PERMISSIONS.COA.UPDATE)
  async requestBlock(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { reason?: string },
  ) {
    return this.coa.requestStatusChange(req, id, { nextStatus: 'BLOCKED', ...dto });
  }

  @Post(':id/retire')
  @Permissions(PERMISSIONS.COA.UPDATE)
  async requestRetire(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { reason?: string },
  ) {
    return this.coa.requestStatusChange(req, id, { nextStatus: 'RETIRED', ...dto });
  }

  @Post(':id/activate')
  @Permissions(PERMISSIONS.COA.UPDATE)
  async requestActivate(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { reason?: string },
  ) {
    return this.coa.requestStatusChange(req, id, { nextStatus: 'ACTIVE', ...dto });
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

  @Post('setup-top-level-categories')
  @Permissions(PERMISSIONS.COA.UNLOCK)
  async setupTopLevelCategories(@Req() req: Request) {
    return this.coa.setupTopLevelCategories(req);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.COA.DRAFT_EDIT)
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCoaAccountDto,
  ) {
    return this.coa.update(req, id, dto);
  }

  @Put(':id')
  @Permissions(PERMISSIONS.COA.DRAFT_EDIT)
  async put(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCoaAccountDto,
  ) {
    return this.coa.update(req, id, dto);
  }

  @Post('freeze')
  @Permissions(PERMISSIONS.COA.FREEZE)
  async freeze(@Req() req: Request) {
    return this.coa.freeze(req);
  }

  @Post('structure-freeze')
  @Permissions(PERMISSIONS.COA.FREEZE)
  async structureFreeze(
    @Req() req: Request,
    @Body() dto?: { effectiveDate?: string | Date },
  ) {
    return this.coa.structureFreeze(req, dto);
  }

  @Post('unfreeze')
  @Permissions(PERMISSIONS.COA.FREEZE)
  async unfreeze(@Req() req: Request) {
    return this.coa.unfreeze(req);
  }

  @Post('structure-unfreeze')
  @Permissions(PERMISSIONS.COA.FREEZE)
  async structureUnfreeze(@Req() req: Request) {
    return this.coa.structureUnfreeze(req);
  }

  @Post('lock')
  @Permissions(PERMISSIONS.COA.UNLOCK)
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
