import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('tenants')
  async listTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  @Get('entities')
  async listEntities() {
    return this.prisma.entity.findMany({
      orderBy: { createdAt: 'asc' },
      include: { tenant: true },
    });
  }
}
