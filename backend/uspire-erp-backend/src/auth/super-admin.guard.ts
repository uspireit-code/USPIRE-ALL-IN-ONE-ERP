import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new ForbiddenException('Missing tenant or user context');
    }

    const superAdminRole = await this.prisma.userRole.findFirst({
      where: {
        userId: user.id,
        role: {
          tenantId: tenant.id,
          name: {
            in: ['SUPER_ADMIN', 'SUPERADMIN', 'SYSTEM_ADMIN', 'SYSTEMADMIN'],
          },
        },
      },
      select: { roleId: true },
    });

    if (!superAdminRole) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
