import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [ConfigModule, AuthModule, PrismaModule, RbacModule],
  controllers: [NotificationController],
  providers: [NotificationService, JwtAuthGuard, PermissionsGuard],
  exports: [NotificationService],
})
export class NotificationsModule {}
