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
const coa_controller_1 = require("./coa.controller");
const coa_service_1 = require("./coa.service");
const customers_controller_1 = require("./ar/customers/customers.controller");
const customers_service_1 = require("./ar/customers/customers.service");
const invoices_controller_1 = require("./ar/invoices/invoices.controller");
const invoices_service_1 = require("./ar/invoices/invoices.service");
let FinanceModule = class FinanceModule {
};
exports.FinanceModule = FinanceModule;
exports.FinanceModule = FinanceModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, jwt_1.JwtModule.register({}), rbac_module_1.RbacModule, prisma_module_1.PrismaModule],
        controllers: [
            coa_controller_1.CoaController,
            customers_controller_1.FinanceArCustomersController,
            invoices_controller_1.FinanceArInvoicesController,
        ],
        providers: [
            coa_service_1.CoaService,
            customers_service_1.FinanceArCustomersService,
            invoices_service_1.FinanceArInvoicesService,
            jwt_auth_guard_1.JwtAuthGuard,
            permissions_guard_1.PermissionsGuard,
        ],
    })
], FinanceModule);
//# sourceMappingURL=finance.module.js.map