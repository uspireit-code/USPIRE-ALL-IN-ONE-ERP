import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { PeriodCloseController } from './periodClose.controller';
import { PeriodCloseService } from './periodClose.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule, PrismaModule],
  controllers: [PeriodCloseController],
  providers: [PeriodCloseService, JwtAuthGuard, PermissionsGuard],
})
export class PeriodCloseModule {}
