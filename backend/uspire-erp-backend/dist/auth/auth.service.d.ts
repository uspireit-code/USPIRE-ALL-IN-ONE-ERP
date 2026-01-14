import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    private readonly config;
    constructor(prisma: PrismaService, jwtService: JwtService, config: ConfigService);
    registerInternal(params: {
        tenantId: string;
        name: string;
        email: string;
        password: string;
        isActive?: boolean;
    }): Promise<User>;
    login(req: Request, dto: LoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            roles: string[];
        };
        tenant: {
            id: string;
            name: string;
        };
        permissions: string[];
    }>;
    refresh(req: Request, dto: RefreshTokenDto): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    me(req: Request): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            roles: string[];
        };
        tenant: {
            id: string;
            name: string;
        };
        permissions: string[];
    }>;
    private getTenantFromRequest;
    private getTenantScopedRolesAndPermissions;
    private hashPassword;
    private issueTokens;
    private parseDurationToSeconds;
}
