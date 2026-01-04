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
exports.PeriodCloseService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PeriodCloseService = class PeriodCloseService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getChecklist(req, periodId) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const period = await this.prisma.accountingPeriod.findFirst({
            where: { id: periodId, tenantId: tenant.id },
            select: { id: true, name: true, status: true },
        });
        if (!period)
            throw new common_1.NotFoundException('Accounting period not found');
        const checklist = await this.prisma.periodCloseChecklist.findFirst({
            where: { tenantId: tenant.id, periodId: period.id },
            select: {
                id: true,
                periodId: true,
                createdAt: true,
                items: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        status: true,
                        completedAt: true,
                        completedBy: { select: { id: true, email: true } },
                        createdAt: true,
                    },
                },
            },
        });
        if (!checklist) {
            throw new common_1.NotFoundException('Period close checklist not found');
        }
        return { period, checklist };
    }
    async completeItem(req, params) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const period = await this.prisma.accountingPeriod.findFirst({
            where: { id: params.periodId, tenantId: tenant.id },
            select: { id: true, status: true, name: true },
        });
        if (!period)
            throw new common_1.NotFoundException('Accounting period not found');
        if (period.status !== 'OPEN') {
            throw new common_1.ForbiddenException({
                error: 'Checklist completion blocked by accounting period control',
                reason: `Accounting period is not OPEN: ${period.name}`,
            });
        }
        const item = await this.prisma.periodCloseChecklistItem.findFirst({
            where: {
                id: params.itemId,
                tenantId: tenant.id,
                checklist: {
                    tenantId: tenant.id,
                    periodId: period.id,
                },
            },
            select: { id: true, status: true },
        });
        if (!item)
            throw new common_1.NotFoundException('Checklist item not found');
        if (item.status === 'COMPLETED') {
            throw new common_1.BadRequestException('Checklist item is already completed');
        }
        return this.prisma.periodCloseChecklistItem.update({
            where: { id: item.id },
            data: {
                status: 'COMPLETED',
                completedById: user.id,
                completedAt: new Date(),
            },
            select: {
                id: true,
                code: true,
                name: true,
                status: true,
                completedAt: true,
                completedBy: { select: { id: true, email: true } },
                createdAt: true,
            },
        });
    }
};
exports.PeriodCloseService = PeriodCloseService;
exports.PeriodCloseService = PeriodCloseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PeriodCloseService);
//# sourceMappingURL=periodClose.service.js.map