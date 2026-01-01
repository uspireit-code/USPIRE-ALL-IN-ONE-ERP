import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule],
  controllers: [TaxController],
  providers: [TaxService, JwtAuthGuard, PermissionsGuard],
})
export class TaxModule {}
