import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { RbacModule } from '../rbac/rbac.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { GlModule } from '../gl/gl.module';
import { ReportsModule } from '../reports/reports.module';
import { CoaController } from './coa.controller';
import { CoaService } from './coa.service';
import { FinanceArCustomersController } from './ar/customers/customers.controller';
import { FinanceArCustomersService } from './ar/customers/customers.service';
import { FinanceArInvoicesController } from './ar/invoices/invoices.controller';
import { FinanceArInvoicesService } from './ar/invoices/invoices.service';
import { FinanceArCreditNotesController } from './ar/credit-notes/credit-notes.controller';
import { FinanceArCreditNotesService } from './ar/credit-notes/credit-notes.service';
import { FinanceArRefundsController } from './ar/refunds/refunds.controller';
import { FinanceArRefundsService } from './ar/refunds/refunds.service';
import { InvoiceCategoriesController } from './ar/invoice-categories/invoice-categories.controller';
import { InvoiceCategoryService } from './ar/invoice-categories/invoice-category.service';
import { FinanceTaxController } from './tax/tax.controller';
import { FinanceTaxService } from './tax/tax.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule, PrismaModule, GlModule, ReportsModule],
  controllers: [
    CoaController,
    FinanceArCustomersController,
    FinanceArInvoicesController,
    FinanceArCreditNotesController,
    FinanceArRefundsController,
    InvoiceCategoriesController,
    FinanceTaxController,
  ],
  providers: [
    CoaService,
    FinanceArCustomersService,
    FinanceArInvoicesService,
    FinanceArCreditNotesService,
    FinanceArRefundsService,
    InvoiceCategoryService,
    FinanceTaxService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
})
export class FinanceModule {}
