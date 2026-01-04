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
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
let JwtAuthGuard = class JwtAuthGuard {
    jwtService;
    config;
    prisma;
    constructor(jwtService, config, prisma) {
        this.jwtService = jwtService;
        this.config = config;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const authHeader = req.header('authorization') ?? '';
        const [scheme, token] = authHeader.split(' ');
        if (scheme !== 'Bearer' || !token) {
            throw new common_1.UnauthorizedException('Missing Bearer token');
        }
        const secret = this.config.get('JWT_ACCESS_SECRET') ?? 'dev-access-secret';
        let payload;
        try {
            payload = await this.jwtService.verifyAsync(token, {
                secret,
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        req.user = {
            id: payload.sub,
            tenantId: payload.tenantId,
            email: payload.email,
            roles: payload.roles,
            permissions: payload.permissions,
        };
        if (req.tenant && req.tenant.id !== payload.tenantId) {
            throw new common_1.UnauthorizedException('Tenant context mismatch');
        }
        if (!req.tenant) {
            const tenant = await this.prisma.tenant.findUnique({
                where: { id: payload.tenantId },
            });
            if (!tenant) {
                throw new common_1.UnauthorizedException('Tenant not found');
            }
            req.tenant = tenant;
        }
        return true;
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService,
        prisma_service_1.PrismaService])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map