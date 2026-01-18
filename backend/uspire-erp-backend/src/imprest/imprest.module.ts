import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { GlModule } from '../gl/gl.module';
import { ImprestService } from './imprest.service';
import { ImprestTypePoliciesController } from './type-policies.controller';
import { ImprestFacilitiesController } from './facilities.controller';
import { ImprestCasesController } from './cases.controller';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule, PrismaModule, GlModule],
  controllers: [
    ImprestTypePoliciesController,
    ImprestFacilitiesController,
    ImprestCasesController,
  ],
  providers: [ImprestService, JwtAuthGuard, PermissionsGuard],
})
export class ImprestModule {}
