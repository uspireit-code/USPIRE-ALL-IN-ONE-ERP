import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { RbacModule } from '../rbac/rbac.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { ReportsModule } from '../reports/reports.module';
import { StorageModule } from '../storage/storage.module';
import { GlController } from './gl.controller';
import { GlRiskController } from './gl.risk.controller';
import { GlService } from './gl.service';
import { ReviewPackService } from './review-pack.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    RbacModule,
    StorageModule,
    ReportsModule,
  ],
  controllers: [GlController, GlRiskController],
  providers: [GlService, ReviewPackService, JwtAuthGuard, PermissionsGuard],
  exports: [GlService],
})
export class GlModule {}
