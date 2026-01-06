import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { FundsController } from './funds.controller';
import { FundsService } from './funds.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), PrismaModule, RbacModule],
  controllers: [DepartmentsController, ProjectsController, FundsController],
  providers: [
    DepartmentsService,
    ProjectsService,
    FundsService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
})
export class MasterDataModule {}
