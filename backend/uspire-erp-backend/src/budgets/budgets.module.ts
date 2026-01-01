import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule],
  controllers: [BudgetsController],
  providers: [BudgetsService, JwtAuthGuard, PermissionsGuard],
})
export class BudgetsModule {}
