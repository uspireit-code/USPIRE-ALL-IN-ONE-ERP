"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const jwt_auth_guard_1 = require("../rbac/jwt-auth.guard");
const permissions_guard_1 = require("../rbac/permissions.guard");
const rbac_module_1 = require("../rbac/rbac.module");
const disclosure_notes_controller_1 = require("./disclosure-notes.controller");
const disclosure_notes_audit_service_1 = require("./disclosure-notes-audit.service");
const disclosure_notes_service_1 = require("./disclosure-notes.service");
const ifrs_disclosure_notes_service_1 = require("./ifrs-disclosure-notes.service");
const reports_controller_1 = require("./reports.controller");
const financial_statements_service_1 = require("./financial-statements.service");
const report_audit_service_1 = require("./report-audit.service");
const report_export_service_1 = require("./report-export.service");
const report_presentation_service_1 = require("./report-presentation.service");
const reports_service_1 = require("./reports.service");
let ReportsModule = class ReportsModule {
};
exports.ReportsModule = ReportsModule;
exports.ReportsModule = ReportsModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, jwt_1.JwtModule.register({}), rbac_module_1.RbacModule],
        controllers: [reports_controller_1.ReportsController, disclosure_notes_controller_1.DisclosureNotesController],
        providers: [
            reports_service_1.ReportsService,
            financial_statements_service_1.FinancialStatementsService,
            report_presentation_service_1.ReportPresentationService,
            report_export_service_1.ReportExportService,
            report_audit_service_1.ReportAuditService,
            disclosure_notes_service_1.DisclosureNotesService,
            ifrs_disclosure_notes_service_1.IfrsDisclosureNotesService,
            disclosure_notes_audit_service_1.DisclosureNotesAuditService,
            jwt_auth_guard_1.JwtAuthGuard,
            permissions_guard_1.PermissionsGuard,
        ],
        exports: [
            financial_statements_service_1.FinancialStatementsService,
            report_presentation_service_1.ReportPresentationService,
            report_export_service_1.ReportExportService,
        ],
    })
], ReportsModule);
//# sourceMappingURL=reports.module.js.map