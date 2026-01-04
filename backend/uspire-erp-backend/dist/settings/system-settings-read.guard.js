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
exports.SystemSettingsReadGuard = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let SystemSettingsReadGuard = class SystemSettingsReadGuard {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.ForbiddenException('Missing tenant or user context');
        }
        const allowedRole = await this.prisma.userRole.findFirst({
            where: {
                userId: user.id,
                role: {
                    tenantId: tenant.id,
                    name: {
                        in: ['ADMIN', 'FINANCE_MANAGER', 'FINANCE_CONTROLLER'],
                    },
                },
            },
            select: { roleId: true },
        });
        if (!allowedRole) {
            throw new common_1.ForbiddenException('Access denied');
        }
        return true;
    }
};
exports.SystemSettingsReadGuard = SystemSettingsReadGuard;
exports.SystemSettingsReadGuard = SystemSettingsReadGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SystemSettingsReadGuard);
//# sourceMappingURL=system-settings-read.guard.js.map