"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const env_util_1 = require("../internal/env.util");
let AuthService = class AuthService {
    prisma;
    jwtService;
    config;
    constructor(prisma, jwtService, config) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.config = config;
    }
    async registerInternal(params) {
        const passwordHash = await this.hashPassword(params.password);
        return this.prisma.user.create({
            data: {
                tenantId: params.tenantId,
                name: params.name.trim(),
                email: params.email.toLowerCase(),
                passwordHash,
                isActive: params.isActive ?? true,
            },
        });
    }
    async login(req, dto) {
        const email = dto.email.toLowerCase();
        const candidates = await this.prisma.user.findMany({
            where: { email, isActive: true },
            select: {
                id: true,
                tenantId: true,
                email: true,
                passwordHash: true,
                isActive: true,
            },
            take: 10,
        });
        if (candidates.length === 0) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const passwordMatches = [];
        for (const u of candidates) {
            const ok = await bcrypt.compare(dto.password, u.passwordHash);
            if (ok) {
                passwordMatches.push({ id: u.id, tenantId: u.tenantId, email: u.email });
            }
        }
        if (passwordMatches.length === 0) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const requestedTenantId = (dto.tenantId ?? '').trim();
        const requestedTenantName = (dto.tenantName ?? '').trim();
        let selectedTenantId = null;
        if (requestedTenantId) {
            const tenantExists = await this.prisma.tenant.findUnique({
                where: { id: requestedTenantId },
                select: { id: true },
            });
            if (!tenantExists) {
                throw new common_1.BadRequestException('Tenant not found');
            }
            const match = passwordMatches.find((m) => m.tenantId === requestedTenantId);
            if (!match) {
                throw new common_1.BadRequestException('User is not assigned to the selected organisation.');
            }
            selectedTenantId = requestedTenantId;
        }
        else if (requestedTenantName) {
            const tenantByName = await this.prisma.tenant.findFirst({
                where: { name: requestedTenantName },
                select: { id: true },
            });
            if (!tenantByName) {
                throw new common_1.BadRequestException('Tenant not found');
            }
            const match = passwordMatches.find((m) => m.tenantId === tenantByName.id);
            if (!match) {
                throw new common_1.BadRequestException('User is not assigned to the selected organisation.');
            }
            selectedTenantId = tenantByName.id;
        }
        else {
            const uniqueTenantIds = [...new Set(passwordMatches.map((m) => m.tenantId))];
            if (uniqueTenantIds.length === 0) {
                throw new common_1.BadRequestException('User is not assigned to any organisation.');
            }
            if (uniqueTenantIds.length > 1) {
                throw new common_1.BadRequestException('Multiple organisations found. Please select one.');
            }
            selectedTenantId = uniqueTenantIds[0];
        }
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: selectedTenantId },
        });
        if (!tenant) {
            throw new common_1.BadRequestException('Tenant not found');
        }
        const selectedUser = passwordMatches.find((m) => m.tenantId === tenant.id);
        if (!selectedUser) {
            throw new common_1.BadRequestException('User is not assigned to any organisation.');
        }
        const { roles, permissions } = await this.getTenantScopedRolesAndPermissions({
            tenantId: tenant.id,
            userId: selectedUser.id,
        });
        const { accessToken, refreshToken } = await this.issueTokens({
            tenant,
            user: { id: selectedUser.id, tenantId: tenant.id, email: selectedUser.email },
            roles,
            permissions,
        });
        return {
            accessToken,
            refreshToken,
            user: {
                id: selectedUser.id,
                email: selectedUser.email,
                roles,
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
            },
            permissions,
        };
    }
    async refresh(req, dto) {
        const refreshSecret = this.config.get('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret';
        let payload;
        try {
            payload = await this.jwtService.verifyAsync(dto.refreshToken, {
                secret: refreshSecret,
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        if (payload.type !== 'refresh') {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: payload.tenantId },
        });
        if (!tenant) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
        });
        if (!user || !user.isActive || user.tenantId !== tenant.id) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const { roles, permissions } = await this.getTenantScopedRolesAndPermissions({
            tenantId: tenant.id,
            userId: user.id,
        });
        const { accessToken, refreshToken } = await this.issueTokens({
            tenant,
            user,
            roles,
            permissions,
        });
        return {
            accessToken,
            refreshToken,
        };
    }
    async me(req) {
        const tenant = this.getTenantFromRequest(req);
        const sessionUser = req.user;
        if (!sessionUser) {
            throw new common_1.UnauthorizedException('Missing user context');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: sessionUser.id },
            select: {
                id: true,
                name: true,
                email: true,
                isActive: true,
                tenantId: true,
            },
        });
        if (!user || !user.isActive || user.tenantId !== tenant.id) {
            throw new common_1.UnauthorizedException('Invalid user');
        }
        const financeOfficerRole = await this.prisma.role.findFirst({
            where: { tenantId: tenant.id, name: 'FINANCE_OFFICER' },
            select: { id: true },
        });
        if (financeOfficerRole?.id) {
            const recurringGeneratePerm = await this.prisma.permission.upsert({
                where: { code: 'FINANCE_GL_RECURRING_GENERATE' },
                create: {
                    code: 'FINANCE_GL_RECURRING_GENERATE',
                    description: 'Generate journals from recurring templates',
                },
                update: {
                    description: 'Generate journals from recurring templates',
                },
                select: { id: true },
            });
            if (recurringGeneratePerm?.id) {
                await this.prisma.rolePermission.createMany({
                    data: [
                        {
                            roleId: financeOfficerRole.id,
                            permissionId: recurringGeneratePerm.id,
                        },
                    ],
                    skipDuplicates: true,
                });
            }
        }
        const userRoles = await this.prisma.userRole.findMany({
            where: {
                userId: user.id,
                role: { tenantId: tenant.id },
            },
            select: {
                role: {
                    select: {
                        name: true,
                        rolePermissions: {
                            select: {
                                permission: { select: { code: true } },
                            },
                        },
                    },
                },
            },
        });
        const permissions = new Set();
        const roles = new Set();
        for (const ur of userRoles) {
            roles.add(ur.role.name);
            for (const rp of ur.role.rolePermissions) {
                permissions.add(rp.permission.code);
            }
        }
        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                roles: Array.from(roles),
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
            },
            permissions: Array.from(permissions),
        };
    }
    getTenantFromRequest(req) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        return tenant;
    }
    async getTenantScopedRolesAndPermissions(params) {
        const userRoles = await this.prisma.userRole.findMany({
            where: {
                userId: params.userId,
                role: { tenantId: params.tenantId },
            },
            select: {
                role: {
                    select: {
                        name: true,
                        rolePermissions: {
                            select: {
                                permission: { select: { code: true } },
                            },
                        },
                    },
                },
            },
        });
        const permissions = new Set();
        const roles = new Set();
        for (const ur of userRoles) {
            roles.add(ur.role.name);
            for (const rp of ur.role.rolePermissions) {
                permissions.add(rp.permission.code);
            }
        }
        return {
            roles: Array.from(roles),
            permissions: Array.from(permissions),
        };
    }
    async hashPassword(password) {
        const roundsRaw = this.config.get('BCRYPT_SALT_ROUNDS') ?? '12';
        const rounds = Number(roundsRaw);
        if (!Number.isFinite(rounds) || rounds < 4) {
            throw new common_1.BadRequestException('Invalid BCRYPT_SALT_ROUNDS');
        }
        return bcrypt.hash(password, rounds);
    }
    async issueTokens(params) {
        const accessPayload = {
            sub: params.user.id,
            tenantId: params.tenant.id,
            email: params.user.email,
            roles: params.roles,
            permissions: params.permissions,
        };
        const refreshPayload = {
            sub: params.user.id,
            tenantId: params.tenant.id,
            type: 'refresh',
        };
        const refreshSecret = this.config.get('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret';
        const refreshExpiresIn = this.parseDurationToSeconds((0, env_util_1.getFirstEnv)(['JWT_REFRESH_TTL', 'JWT_REFRESH_EXPIRES_IN']) ?? '7d', 7 * 24 * 60 * 60);
        const accessToken = await this.jwtService.signAsync(accessPayload);
        const refreshToken = await this.jwtService.signAsync(refreshPayload, {
            secret: refreshSecret,
            expiresIn: refreshExpiresIn,
        });
        return { accessToken, refreshToken };
    }
    parseDurationToSeconds(value, fallbackSeconds) {
        const trimmed = value.trim();
        if (!trimmed)
            return fallbackSeconds;
        if (/^\d+$/.test(trimmed)) {
            return Number(trimmed);
        }
        const match = trimmed.match(/^(\d+)([smhd])$/i);
        if (!match)
            return fallbackSeconds;
        const amount = Number(match[1]);
        const unit = match[2].toLowerCase();
        const multiplier = unit === 's'
            ? 1
            : unit === 'm'
                ? 60
                : unit === 'h'
                    ? 60 * 60
                    : 60 * 60 * 24;
        return amount * multiplier;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map