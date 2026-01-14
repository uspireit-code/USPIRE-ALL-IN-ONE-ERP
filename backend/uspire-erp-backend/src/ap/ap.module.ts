import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { StorageModule } from '../storage/storage.module';
import { ApController } from './ap.controller';
import { ApService } from './ap.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule, StorageModule],
  controllers: [ApController],
  providers: [ApService, JwtAuthGuard, PermissionsGuard],
})
export class ApModule {}
