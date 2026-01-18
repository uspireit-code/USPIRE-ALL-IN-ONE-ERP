import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { ReportsModule } from '../reports/reports.module';
import { StorageModule } from '../storage/storage.module';
import { ApController } from './ap.controller';
import { ApService } from './ap.service';
import { PaymentProposalsController } from './payment-proposals/payment-proposals.controller';
import { PaymentProposalsService } from './payment-proposals/payment-proposals.service';
import { PaymentRunsController } from './payment-runs/payment-runs.controller';
import { PaymentRunsService } from './payment-runs/payment-runs.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule, StorageModule, ReportsModule],
  controllers: [ApController, PaymentProposalsController, PaymentRunsController],
  providers: [ApService, PaymentProposalsService, PaymentRunsService, JwtAuthGuard, PermissionsGuard],
})
export class ApModule {}
