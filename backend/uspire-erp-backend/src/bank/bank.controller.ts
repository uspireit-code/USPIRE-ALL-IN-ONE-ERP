import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { BankService } from './bank.service';
import { AddBankStatementLinesDto } from './dto/add-bank-statement-lines.dto';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { CreateBankStatementDto } from './dto/create-bank-statement.dto';
import { ListBankStatementsQueryDto } from './dto/list-bank-statements-query.dto';
import { MatchBankReconciliationDto } from './dto/match-bank-reconciliation.dto';
import { ReconciliationStatusQueryDto } from './dto/reconciliation-status-query.dto';

@Controller('bank')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BankController {
  constructor(private readonly bank: BankService) {}

  @Post('accounts')
  @Permissions(PERMISSIONS.BANK.ACCOUNT_CREATE)
  async createBankAccount(
    @Req() req: Request,
    @Body() dto: CreateBankAccountDto,
  ) {
    return this.bank.createBankAccount(req, dto);
  }

  @Get('accounts')
  @Permissions(PERMISSIONS.BANK.RECONCILIATION_VIEW)
  async listBankAccounts(@Req() req: Request) {
    return this.bank.listBankAccounts(req);
  }

  @Post('statements')
  @Permissions(PERMISSIONS.BANK.STATEMENT_IMPORT)
  async createStatement(
    @Req() req: Request,
    @Body() dto: CreateBankStatementDto,
  ) {
    return this.bank.createStatement(req, dto);
  }

  @Get('statements')
  @Permissions(PERMISSIONS.BANK.RECONCILIATION_VIEW)
  async listStatements(
    @Req() req: Request,
    @Query() dto: ListBankStatementsQueryDto,
  ) {
    return this.bank.listStatements(req, dto);
  }

  @Get('statements/:id')
  @Permissions(PERMISSIONS.BANK.RECONCILIATION_VIEW)
  async getStatement(@Req() req: Request, @Param('id') id: string) {
    return this.bank.getStatement(req, id);
  }

  @Post('statements/:id/lines')
  @Permissions(PERMISSIONS.BANK.STATEMENT_IMPORT)
  async addStatementLines(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: AddBankStatementLinesDto,
  ) {
    return this.bank.addStatementLines(req, id, dto);
  }

  @Get('reconciliation/unmatched')
  @Permissions(PERMISSIONS.BANK.RECONCILIATION_VIEW)
  async unmatched(@Req() req: Request) {
    return this.bank.unmatched(req);
  }

  @Post('reconciliation/match')
  @Permissions(PERMISSIONS.BANK.RECONCILE)
  async match(@Req() req: Request, @Body() dto: MatchBankReconciliationDto) {
    return this.bank.match(req, dto);
  }

  @Get('reconciliation/status')
  @Permissions(PERMISSIONS.BANK.RECONCILIATION_VIEW)
  async status(
    @Req() req: Request,
    @Query() dto: ReconciliationStatusQueryDto,
  ) {
    return this.bank.status(req, dto);
  }
}
