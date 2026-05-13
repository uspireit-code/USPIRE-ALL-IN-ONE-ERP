import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GlModule } from '../gl/gl.module';
import { RbacModule } from '../rbac/rbac.module';
import { SettingsModule } from '../settings/settings.module';
import { PeriodsController } from './periods.controller';
import { PeriodsService } from './periods.service';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [AuthModule, GlModule, RbacModule, SettingsModule, GovernanceModule],
  controllers: [PeriodsController],
  providers: [PeriodsService],
})
export class PeriodsModule {}
