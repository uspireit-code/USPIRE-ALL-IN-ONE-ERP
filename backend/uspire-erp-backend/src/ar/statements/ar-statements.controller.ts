import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../rbac/jwt-auth.guard';
import { PermissionsAny } from '../../rbac/permissions.decorator';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { ArStatementsService } from './ar-statements.service';

@Controller('ar/statements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ArStatementsController {
  constructor(private readonly statements: ArStatementsService) {}

  @Get()
  @PermissionsAny('AR_STATEMENT_VIEW', 'FINANCE_VIEW_ALL', 'SYSTEM_VIEW_ALL')
  async get(
    @Req() req: Request,
    @Query('customerId') customerId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('asOfDate') asOfDate?: string,
  ) {
    return this.statements.getStatement(req, { customerId, fromDate, toDate, asOfDate });
  }
}
