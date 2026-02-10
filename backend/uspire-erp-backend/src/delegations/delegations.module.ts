import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { SoDService } from '../sod/sod.service';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule), RbacModule],
  controllers: [DelegationsController],
  providers: [DelegationsService, JwtAuthGuard, PermissionsGuard, SoDService],
  exports: [DelegationsService],
})
export class DelegationsModule {}
