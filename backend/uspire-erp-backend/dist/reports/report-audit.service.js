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
exports.ReportAuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ReportAuditService = class ReportAuditService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async reportView(params) {
        const tenant = params.req.tenant;
        const user = params.req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        return this.prisma.auditEvent.create({
            data: {
                tenantId: tenant.id,
                eventType: 'REPORT_VIEW',
                entityType: 'REPORT',
                entityId: params.entityId,
                action: 'VIEW',
                outcome: params.outcome,
                reason: params.reason,
                userId: user.id,
                permissionUsed: params.permissionUsed,
            },
        });
    }
    async reportExport(params) {
        const tenant = params.req.tenant;
        const user = params.req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        return this.prisma.auditEvent.create({
            data: {
                tenantId: tenant.id,
                eventType: 'REPORT_EXPORT',
                entityType: 'REPORT',
                entityId: params.entityId,
                action: `EXPORT_${params.format}`,
                outcome: params.outcome,
                reason: params.reason,
                userId: user.id,
                permissionUsed: params.permissionUsed,
            },
        });
    }
};
exports.ReportAuditService = ReportAuditService;
exports.ReportAuditService = ReportAuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportAuditService);
//# sourceMappingURL=report-audit.service.js.map