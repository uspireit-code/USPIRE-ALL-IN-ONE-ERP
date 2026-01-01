import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { GlModule } from '../gl/gl.module';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { FaController } from './fa.controller';
import { FaService } from './fa.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    RbacModule,
    PrismaModule,
    GlModule,
  ],
  controllers: [FaController],
  providers: [FaService, JwtAuthGuard, PermissionsGuard],
})
export class FaModule {}
