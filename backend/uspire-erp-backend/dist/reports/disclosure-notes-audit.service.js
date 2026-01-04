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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisclosureNotesAuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let DisclosureNotesAuditService = class DisclosureNotesAuditService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async disclosureNoteGenerate(params) {
        const tenant = params.req.tenant;
        const user = params.req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        return this.prisma.auditEvent.create({
            data: {
                tenantId: tenant.id,
                eventType: 'DISCLOSURE_NOTE_GENERATE',
                entityType: 'DISCLOSURE_NOTE',
                entityId: params.noteId,
                action: 'GENERATE',
                outcome: params.outcome,
                reason: params.reason,
                userId: user.id,
                permissionUsed: params.permissionUsed,
            },
        });
    }
    async disclosureNoteView(params) {
        const tenant = params.req.tenant;
        const user = params.req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        return this.prisma.auditEvent.create({
            data: {
                tenantId: tenant.id,
                eventType: 'DISCLOSURE_NOTE_VIEW',
                entityType: 'DISCLOSURE_NOTE',
                entityId: params.noteId,
                action: 'VIEW',
                outcome: params.outcome,
                reason: params.reason,
                userId: user.id,
                permissionUsed: params.permissionUsed,
            },
        });
    }
};
exports.DisclosureNotesAuditService = DisclosureNotesAuditService;
exports.DisclosureNotesAuditService = DisclosureNotesAuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DisclosureNotesAuditService);
//# sourceMappingURL=disclosure-notes-audit.service.js.map