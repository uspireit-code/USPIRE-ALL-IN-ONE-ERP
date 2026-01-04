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
exports.TaxService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TaxService = class TaxService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createTaxRate(req, dto) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const glAccount = await this.prisma.account.findFirst({
            where: { id: dto.glAccountId, tenantId: tenant.id, isActive: true },
            select: { id: true, type: true },
        });
        if (!glAccount) {
            throw new common_1.BadRequestException('VAT control GL account not found or inactive');
        }
        if (dto.type === 'INPUT' && glAccount.type !== 'ASSET') {
            throw new common_1.BadRequestException('INPUT VAT control account must be an ASSET');
        }
        if (dto.type === 'OUTPUT' && glAccount.type !== 'LIABILITY') {
            throw new common_1.BadRequestException('OUTPUT VAT control account must be a LIABILITY');
        }
        return this.prisma.taxRate.create({
            data: {
                tenantId: tenant.id,
                name: dto.name,
                rate: dto.rate,
                type: dto.type,
                glAccountId: dto.glAccountId,
                isActive: true,
            },
            include: { glAccount: true },
        });
    }
    async listTaxRates(req) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        return this.prisma.taxRate.findMany({
            where: { tenantId: tenant.id },
            orderBy: { createdAt: 'desc' },
            include: { glAccount: true },
        });
    }
};
exports.TaxService = TaxService;
exports.TaxService = TaxService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TaxService);
//# sourceMappingURL=tax.service.js.map