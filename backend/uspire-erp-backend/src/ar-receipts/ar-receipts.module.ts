import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { RbacModule } from '../rbac/rbac.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { ArReceiptsController } from './ar-receipts.controller';
import { ArReceiptsService } from './ar-receipts.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule],
  controllers: [ArReceiptsController],
  providers: [ArReceiptsService, JwtAuthGuard, PermissionsGuard],
})
export class ArReceiptsModule {}
