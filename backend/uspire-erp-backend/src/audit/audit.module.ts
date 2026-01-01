import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { StorageModule } from '../storage/storage.module';
import { AuditController } from './audit.controller';
import { AuditEvidenceController } from './audit-evidence.controller';
import { AuditEvidenceService } from './audit-evidence.service';
import { AuditService } from './audit.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    RbacModule,
    PrismaModule,
    StorageModule,
  ],
  controllers: [AuditController, AuditEvidenceController],
  providers: [
    AuditService,
    AuditEvidenceService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
})
export class AuditModule {}
