"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const rbac_module_1 = require("../rbac/rbac.module");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_guard_1 = require("../rbac/permissions.guard");
const prisma_module_1 = require("../prisma/prisma.module");
const gl_module_1 = require("../gl/gl.module");
const coa_controller_1 = require("./coa.controller");
const coa_service_1 = require("./coa.service");
const customers_controller_1 = require("./ar/customers/customers.controller");
const customers_service_1 = require("./ar/customers/customers.service");
const invoices_controller_1 = require("./ar/invoices/invoices.controller");
const invoices_service_1 = require("./ar/invoices/invoices.service");
const credit_notes_controller_1 = require("./ar/credit-notes/credit-notes.controller");
const credit_notes_service_1 = require("./ar/credit-notes/credit-notes.service");
const refunds_controller_1 = require("./ar/refunds/refunds.controller");
const refunds_service_1 = require("./ar/refunds/refunds.service");
const invoice_categories_controller_1 = require("./ar/invoice-categories/invoice-categories.controller");
const invoice_category_service_1 = require("./ar/invoice-categories/invoice-category.service");
const tax_controller_1 = require("./tax/tax.controller");
const tax_service_1 = require("./tax/tax.service");
let FinanceModule = class FinanceModule {
};
exports.FinanceModule = FinanceModule;
exports.FinanceModule = FinanceModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, jwt_1.JwtModule.register({}), rbac_module_1.RbacModule, prisma_module_1.PrismaModule, gl_module_1.GlModule],
        controllers: [
            coa_controller_1.CoaController,
            customers_controller_1.FinanceArCustomersController,
            invoices_controller_1.FinanceArInvoicesController,
            credit_notes_controller_1.FinanceArCreditNotesController,
            refunds_controller_1.FinanceArRefundsController,
            invoice_categories_controller_1.InvoiceCategoriesController,
            tax_controller_1.FinanceTaxController,
        ],
        providers: [
            coa_service_1.CoaService,
            customers_service_1.FinanceArCustomersService,
            invoices_service_1.FinanceArInvoicesService,
            credit_notes_service_1.FinanceArCreditNotesService,
            refunds_service_1.FinanceArRefundsService,
            invoice_category_service_1.InvoiceCategoryService,
            tax_service_1.FinanceTaxService,
            jwt_auth_guard_1.JwtAuthGuard,
            permissions_guard_1.PermissionsGuard,
        ],
    })
], FinanceModule);
//# sourceMappingURL=finance.module.js.map