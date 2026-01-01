import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { DisclosureNotesController } from './disclosure-notes.controller';
import { DisclosureNotesAuditService } from './disclosure-notes-audit.service';
import { DisclosureNotesService } from './disclosure-notes.service';
import { IfrsDisclosureNotesService } from './ifrs-disclosure-notes.service';
import { ReportsController } from './reports.controller';
import { FinancialStatementsService } from './financial-statements.service';
import { ReportAuditService } from './report-audit.service';
import { ReportExportService } from './report-export.service';
import { ReportPresentationService } from './report-presentation.service';
import { ReportsService } from './reports.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule],
  controllers: [ReportsController, DisclosureNotesController],
  providers: [
    ReportsService,
    FinancialStatementsService,
    ReportPresentationService,
    ReportExportService,
    ReportAuditService,
    DisclosureNotesService,
    IfrsDisclosureNotesService,
    DisclosureNotesAuditService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    FinancialStatementsService,
    ReportPresentationService,
    ReportExportService,
  ],
})
export class ReportsModule {}
