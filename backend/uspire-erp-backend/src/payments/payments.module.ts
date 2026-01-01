import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, JwtAuthGuard, PermissionsGuard],
})
export class PaymentsModule {}
