import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { ArController } from './ar.controller';
import { ArService } from './ar.service';
import { ArAgingController } from './aging/ar-aging.controller';
import { ArAgingService } from './aging/ar-aging.service';
import { ArRemindersController } from './reminders/ar-reminders.controller';
import { ArRemindersService } from './reminders/ar-reminders.service';
import { ArStatementsController } from './statements/ar-statements.controller';
import { ArStatementsService } from './statements/ar-statements.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), PrismaModule, RbacModule],
  controllers: [ArController, ArAgingController, ArStatementsController, ArRemindersController],
  providers: [ArService, ArAgingService, ArStatementsService, ArRemindersService, JwtAuthGuard, PermissionsGuard],
})
export class ArModule {}
