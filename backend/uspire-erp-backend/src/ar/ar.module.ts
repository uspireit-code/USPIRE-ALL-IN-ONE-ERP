import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { ArController } from './ar.controller';
import { ArService } from './ar.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule],
  controllers: [ArController],
  providers: [ArService, JwtAuthGuard, PermissionsGuard],
})
export class ArModule {}
