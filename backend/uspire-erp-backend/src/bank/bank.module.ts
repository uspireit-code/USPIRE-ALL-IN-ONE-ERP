import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { BankController } from './bank.controller';
import { BankService } from './bank.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule],
  controllers: [BankController],
  providers: [BankService, JwtAuthGuard, PermissionsGuard],
})
export class BankModule {}
