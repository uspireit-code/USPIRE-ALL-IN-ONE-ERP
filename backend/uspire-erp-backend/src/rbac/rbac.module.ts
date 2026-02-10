import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SoDService } from '../sod/sod.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RbacController } from './rbac.controller';

@Module({
  imports: [ConfigModule, AuthModule, PrismaModule],
  controllers: [RbacController],
  providers: [JwtAuthGuard, PermissionsGuard, SoDService],
  exports: [JwtAuthGuard, PermissionsGuard, SoDService],
})
export class RbacModule {}
