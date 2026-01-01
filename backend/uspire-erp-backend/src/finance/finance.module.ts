import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { RbacModule } from '../rbac/rbac.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { CoaController } from './coa.controller';
import { CoaService } from './coa.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule, PrismaModule],
  controllers: [CoaController],
  providers: [CoaService, JwtAuthGuard, PermissionsGuard],
})
export class FinanceModule {}
