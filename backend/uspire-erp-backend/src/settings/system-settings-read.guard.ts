import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemSettingsReadGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new ForbiddenException('Missing tenant or user context');
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
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
