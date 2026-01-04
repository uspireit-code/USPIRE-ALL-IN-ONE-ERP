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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AuditService = class AuditService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listEvents(req, dto) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const where = {
            tenantId: tenant.id,
        };
        if (dto.entityType) {
            where.entityType = dto.entityType;
        }
        if (dto.entityId) {
            where.entityId = dto.entityId;
        }
        if (dto.userId) {
            where.userId = dto.userId;
        }
        if (dto.eventType) {
            where.eventType = dto.eventType;
        }
        if (dto.from || dto.to) {
            const createdAt = {};
            if (dto.from)
                createdAt.gte = new Date(dto.from);
            if (dto.to)
                createdAt.lte = new Date(dto.to);
            where.createdAt = createdAt;
        }
        const limit = dto.limit ?? 50;
        const offset = dto.offset ?? 0;
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.auditEvent.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: offset,
                take: limit,
                select: {
                    id: true,
                    tenantId: true,
                    eventType: true,
                    entityType: true,
                    entityId: true,
                    action: true,
                    outcome: true,
                    reason: true,
                    permissionUsed: true,
                    createdAt: true,
                    user: { select: { id: true, email: true } },
                },
            }),
            this.prisma.auditEvent.count({ where }),
        ]);
        return {
            total,
            limit,
            offset,
            rows,
        };
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditService);
//# sourceMappingURL=audit.service.js.map