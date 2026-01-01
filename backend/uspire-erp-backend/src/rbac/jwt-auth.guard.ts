import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type JwtAccessPayload = {
  sub: string;
  tenantId: string;
  email: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const authHeader = req.header('authorization') ?? '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const secret =
      this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret';

    let payload: JwtAccessPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
        secret,
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
    };

    if (req.tenant && req.tenant.id !== payload.tenantId) {
      throw new UnauthorizedException('Tenant context mismatch');
    }

    if (!req.tenant) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: payload.tenantId },
      });
      if (!tenant) {
        throw new UnauthorizedException('Tenant not found');
      }
      req.tenant = tenant;
    }

    return true;
  }
}
