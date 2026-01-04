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
exports.InternalController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let InternalController = class InternalController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listTenants() {
        return this.prisma.tenant.findMany({
            orderBy: { createdAt: 'asc' },
        });
    }
    async listEntities() {
        return this.prisma.entity.findMany({
            orderBy: { createdAt: 'asc' },
            include: { tenant: true },
        });
    }
};
exports.InternalController = InternalController;
__decorate([
    (0, common_1.Get)('tenants'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InternalController.prototype, "listTenants", null);
__decorate([
    (0, common_1.Get)('entities'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], InternalController.prototype, "listEntities", null);
exports.InternalController = InternalController = __decorate([
    (0, common_1.Controller)('internal'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InternalController);
//# sourceMappingURL=internal.controller.js.map