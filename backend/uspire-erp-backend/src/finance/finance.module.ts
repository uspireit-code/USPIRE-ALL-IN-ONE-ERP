import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { RbacModule } from '../rbac/rbac.module';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { GlModule } from '../gl/gl.module';
import { ReportsModule } from '../reports/reports.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CoaController } from './coa.controller';
import { CoaService } from './coa.service';
import { CoaNamingPolicyService } from './coa-naming-policy.service';
import { CoaRootCategoriesController } from './coa-root-categories.controller';
import { CoaRootCategoriesService } from './coa-root-categories.service';
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
import { IfrsMappingController } from './ifrs-mapping.controller';
import { IfrsMappingService } from './ifrs-mapping.service';
import { IfrsNodesController } from './ifrs-nodes.controller';
import { IfrsNodesService } from './ifrs-nodes.service';
import { CoaStructureChangeRequestsController } from './coa-structure-change-requests.controller';
import { CoaStructureChangeRequestsService } from './coa-structure-change-requests.service';
import { CoaStructuralResolverService } from './coa-structural-resolver.service';
import { CoaHealthService } from './coa-health.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule, PrismaModule, GlModule, ReportsModule, NotificationsModule],
  controllers: [
    CoaRootCategoriesController,
    CoaController,
    CoaStructureChangeRequestsController,
    IfrsMappingController,
    IfrsNodesController,
    FinanceArCustomersController,
    FinanceArInvoicesController,
    FinanceArCreditNotesController,
    FinanceArRefundsController,
    InvoiceCategoriesController,
    FinanceTaxController,
  ],
  providers: [
    CoaService,
    CoaNamingPolicyService,
    CoaRootCategoriesService,
    CoaStructuralResolverService,
    CoaHealthService,
    CoaStructureChangeRequestsService,
    IfrsMappingService,
    IfrsNodesService,
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
