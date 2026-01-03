import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { RbacModule } from '../rbac/rbac.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { CoaController } from './coa.controller';
import { CoaService } from './coa.service';
import { FinanceArCustomersController } from './ar/customers/customers.controller';
import { FinanceArCustomersService } from './ar/customers/customers.service';
import { FinanceArInvoicesController } from './ar/invoices/invoices.controller';
import { FinanceArInvoicesService } from './ar/invoices/invoices.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule, PrismaModule],
  controllers: [
    CoaController,
    FinanceArCustomersController,
    FinanceArInvoicesController,
  ],
  providers: [
    CoaService,
    FinanceArCustomersService,
    FinanceArInvoicesService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
})
export class FinanceModule {}
