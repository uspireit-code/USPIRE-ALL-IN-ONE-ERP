import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { BankReconController } from './bank-recon.controller';
import { BankReconService } from './bank-recon.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule],
  controllers: [BankReconController],
  providers: [BankReconService, JwtAuthGuard, PermissionsGuard],
})
export class BankReconModule {}
