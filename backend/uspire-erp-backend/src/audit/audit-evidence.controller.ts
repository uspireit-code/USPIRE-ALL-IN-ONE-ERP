import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  Body,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AuditEvidenceService } from './audit-evidence.service';
import { AuditEvidenceQueryDto } from './dto/audit-evidence-query.dto';
import { AuditEvidenceUploadDto } from './dto/audit-evidence-upload.dto';

@Controller('audit/evidence')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditEvidenceController {
  constructor(private readonly evidence: AuditEvidenceService) {}

  @Post()
  @Permissions('AUDIT_EVIDENCE_UPLOAD')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async upload(
    @Req() req: Request,
    @UploadedFile() file: any,
    @Body() dto: AuditEvidenceUploadDto,
    @Res() res: Response,
  ) {
    const created = await this.evidence.uploadEvidence(req, dto, file);
    res.json(created);
  }

  @Get()
  @Permissions('AUDIT_EVIDENCE_VIEW')
  async list(@Req() req: Request, @Query() dto: AuditEvidenceQueryDto) {
    return this.evidence.listEvidence(req, dto);
  }

  @Get(':id/download')
  @Permissions('AUDIT_EVIDENCE_VIEW')
  async download(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const out = await this.evidence.downloadEvidence(req, id);
    res.setHeader('Content-Type', out.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(out.size ?? out.body.length));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${out.fileName}"`,
    );
    res.send(out.body);
  }
}
