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
exports.AuditEvidenceController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_decorator_1 = require("../rbac/permissions.decorator");
const permissions_guard_1 = require("../rbac/permissions.guard");
const audit_evidence_service_1 = require("./audit-evidence.service");
const audit_evidence_query_dto_1 = require("./dto/audit-evidence-query.dto");
const audit_evidence_upload_dto_1 = require("./dto/audit-evidence-upload.dto");
let AuditEvidenceController = class AuditEvidenceController {
    evidence;
    constructor(evidence) {
        this.evidence = evidence;
    }
    async upload(req, file, dto, res) {
        const created = await this.evidence.uploadEvidence(req, dto, file);
        res.json(created);
    }
    async list(req, dto) {
        return this.evidence.listEvidence(req, dto);
    }
    async download(req, id, res) {
        const out = await this.evidence.downloadEvidence(req, id);
        res.setHeader('Content-Type', out.mimeType || 'application/octet-stream');
        res.setHeader('Content-Length', String(out.size ?? out.body.length));
        res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
        res.send(out.body);
    }
};
exports.AuditEvidenceController = AuditEvidenceController;
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)('AUDIT_EVIDENCE_UPLOAD'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 25 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, audit_evidence_upload_dto_1.AuditEvidenceUploadDto, Object]),
    __metadata("design:returntype", Promise)
], AuditEvidenceController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)('AUDIT_EVIDENCE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, audit_evidence_query_dto_1.AuditEvidenceQueryDto]),
    __metadata("design:returntype", Promise)
], AuditEvidenceController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id/download'),
    (0, permissions_decorator_1.Permissions)('AUDIT_EVIDENCE_VIEW'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], AuditEvidenceController.prototype, "download", null);
exports.AuditEvidenceController = AuditEvidenceController = __decorate([
    (0, common_1.Controller)('audit/evidence'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [audit_evidence_service_1.AuditEvidenceService])
], AuditEvidenceController);
//# sourceMappingURL=audit-evidence.controller.js.map