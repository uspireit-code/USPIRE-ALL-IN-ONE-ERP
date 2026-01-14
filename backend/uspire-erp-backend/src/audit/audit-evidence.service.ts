import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/permission-catalog';
import type { StorageProvider } from '../storage/storage.provider';
import { STORAGE_PROVIDER } from '../storage/storage.provider';
import { AuditEvidenceQueryDto } from './dto/audit-evidence-query.dto';
import { AuditEvidenceUploadDto } from './dto/audit-evidence-upload.dto';

@Injectable()
export class AuditEvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async uploadEvidence(req: Request, dto: AuditEvidenceUploadDto, file?: any) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    if (!file) throw new BadRequestException('Missing file');
    if (!file.originalname) throw new BadRequestException('Missing fileName');

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    const evidenceId = randomUUID();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `${tenant.id}/${evidenceId}_${safeName}`;

    await this.storage.put(storageKey, file.buffer);

    const created = await this.prisma.auditEvidence.create({
      data: {
        id: evidenceId,
        tenantId: tenant.id,
        entityType: dto.entityType as any,
        entityId: dto.entityId,
        fileName: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        storageKey,
        sha256Hash: sha256,
        uploadedById: user.id,
      },
      select: {
        id: true,
        tenantId: true,
        entityType: true,
        entityId: true,
        fileName: true,
        mimeType: true,
        size: true,
        storageKey: true,
        sha256Hash: true,
        uploadedById: true,
        createdAt: true,
        uploadedBy: { select: { id: true, email: true } },
      },
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'EVIDENCE_UPLOAD',
          entityType: dto.entityType as any,
          entityId: dto.entityId,
          action: 'AUDIT_EVIDENCE_UPLOAD',
          outcome: 'SUCCESS',
          reason: `Uploaded evidence: ${file.originalname}`,
          userId: user.id,
          permissionUsed: PERMISSIONS.AUDIT.EVIDENCE_UPLOAD,
        },
      })
      .catch(() => undefined);

    return created;
  }

  async listEvidence(req: Request, dto: AuditEvidenceQueryDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    if (!dto.entityType || !dto.entityId) {
      throw new BadRequestException('entityType and entityId are required');
    }

    return this.prisma.auditEvidence.findMany({
      where: {
        tenantId: tenant.id,
        entityType: dto.entityType as any,
        entityId: dto.entityId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        entityType: true,
        entityId: true,
        fileName: true,
        mimeType: true,
        size: true,
        sha256Hash: true,
        uploadedById: true,
        createdAt: true,
        uploadedBy: { select: { id: true, email: true } },
      },
    });
  }

  async downloadEvidence(req: Request, id: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user)
      throw new BadRequestException('Missing tenant or user context');

    const row = await this.prisma.auditEvidence.findFirst({
      where: { id, tenantId: tenant.id },
      select: {
        id: true,
        tenantId: true,
        fileName: true,
        mimeType: true,
        size: true,
        storageKey: true,
        sha256Hash: true,
      },
    });

    if (!row) throw new NotFoundException('Evidence not found');

    const exists = await this.storage.exists(row.storageKey);
    if (!exists) {
      throw new NotFoundException('Evidence file not found in storage');
    }

    const buf = await this.storage.get(row.storageKey);
    const sha256 = createHash('sha256').update(buf).digest('hex');
    if (sha256 !== row.sha256Hash) {
      throw new ForbiddenException(
        'Evidence integrity check failed (hash mismatch)',
      );
    }

    return {
      fileName: row.fileName,
      mimeType: row.mimeType,
      size: row.size,
      body: buf,
    };
  }
}
