import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { ForecastsController } from './forecasts.controller';
import { ForecastsService } from './forecasts.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule, PrismaModule],
  controllers: [ForecastsController],
  providers: [ForecastsService, JwtAuthGuard, PermissionsGuard],
})
export class ForecastsModule {}
