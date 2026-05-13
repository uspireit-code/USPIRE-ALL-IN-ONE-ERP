import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GlModule } from '../gl/gl.module';
import { RbacModule } from '../rbac/rbac.module';
import { AuthModule } from '../auth/auth.module';
import { GovernanceOverrideSessionService } from './governance-override-session.service';
import { GovernanceOverrideSessionsController } from './governance-override-sessions.controller';
import { GovernanceAutomationExecutionSessionService } from './governance-automation-execution-session.service';
import { GovernanceAutomationExecutionSessionsController } from './governance-automation-execution-sessions.controller';
import { GovernanceAutomationScheduleService } from './governance-automation-schedule.service';
import { GovernanceAutomationSchedulesController } from './governance-automation-schedules.controller';
import { GovernanceAnalyticsService } from './governance-analytics.service';
import { GovernanceAnalyticsController } from './governance-analytics.controller';
import { GovernanceRegistersController } from './governance-registers.controller';
import { GovernanceRegistersService } from './governance-registers.service';

@Module({
  imports: [PrismaModule, AuthModule, RbacModule, forwardRef(() => GlModule)],
  controllers: [
    GovernanceOverrideSessionsController,
    GovernanceAutomationExecutionSessionsController,
    GovernanceAutomationSchedulesController,
    GovernanceAnalyticsController,
    GovernanceRegistersController,
  ],
  providers: [
    GovernanceOverrideSessionService,
    GovernanceAutomationExecutionSessionService,
    GovernanceAutomationScheduleService,
    GovernanceAnalyticsService,
    GovernanceRegistersService,
  ],
  exports: [
    GovernanceOverrideSessionService,
    GovernanceAutomationExecutionSessionService,
    GovernanceAutomationScheduleService,
    GovernanceAnalyticsService,
    GovernanceRegistersService,
  ],
})
export class GovernanceModule {}
