import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RbacController } from './rbac.controller';

@Module({
  imports: [ConfigModule, JwtModule.register({}), PrismaModule],
  controllers: [RbacController],
  providers: [JwtAuthGuard, PermissionsGuard],
  exports: [JwtAuthGuard, PermissionsGuard],
})
export class RbacModule {}
