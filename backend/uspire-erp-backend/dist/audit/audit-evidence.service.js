"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditEvidenceService = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const storage_provider_1 = require("../storage/storage.provider");
let AuditEvidenceService = class AuditEvidenceService {
    prisma;
    storage;
    constructor(prisma, storage) {
        this.prisma = prisma;
        this.storage = storage;
    }
    async uploadEvidence(req, dto, file) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        if (!file)
            throw new common_1.BadRequestException('Missing file');
        if (!file.originalname)
            throw new common_1.BadRequestException('Missing fileName');
        const sha256 = (0, node_crypto_1.createHash)('sha256').update(file.buffer).digest('hex');
        const evidenceId = (0, node_crypto_1.randomUUID)();
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storageKey = `${tenant.id}/${evidenceId}_${safeName}`;
        await this.storage.put(storageKey, file.buffer);
        const created = await this.prisma.auditEvidence.create({
            data: {
                id: evidenceId,
                tenantId: tenant.id,
                entityType: dto.entityType,
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
                entityType: dto.entityType,
                entityId: dto.entityId,
                action: 'AUDIT_EVIDENCE_UPLOAD',
                outcome: 'SUCCESS',
                reason: `Uploaded evidence: ${file.originalname}`,
                userId: user.id,
                permissionUsed: 'AUDIT_EVIDENCE_UPLOAD',
            },
        })
            .catch(() => undefined);
        return created;
    }
    async listEvidence(req, dto) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        if (!dto.entityType || !dto.entityId) {
            throw new common_1.BadRequestException('entityType and entityId are required');
        }
        return this.prisma.auditEvidence.findMany({
            where: {
                tenantId: tenant.id,
                entityType: dto.entityType,
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
    async downloadEvidence(req, id) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
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
        if (!row)
            throw new common_1.NotFoundException('Evidence not found');
        const exists = await this.storage.exists(row.storageKey);
        if (!exists) {
            throw new common_1.NotFoundException('Evidence file not found in storage');
        }
        const buf = await this.storage.get(row.storageKey);
        const sha256 = (0, node_crypto_1.createHash)('sha256').update(buf).digest('hex');
        if (sha256 !== row.sha256Hash) {
            throw new common_1.ForbiddenException('Evidence integrity check failed (hash mismatch)');
        }
        return {
            fileName: row.fileName,
            mimeType: row.mimeType,
            size: row.size,
            body: buf,
        };
    }
};
exports.AuditEvidenceService = AuditEvidenceService;
exports.AuditEvidenceService = AuditEvidenceService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_2.Inject)(storage_provider_1.STORAGE_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object])
], AuditEvidenceService);
//# sourceMappingURL=audit-evidence.service.js.map