import {
  Body,
  Controller,
  Delete,
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
import {
  AddBankStatementLinesDto,
  CreateAdjustmentJournalDto,
  CreateBankStatementDto,
  ListStatementLinesQueryDto,
  MatchStatementLineDto,
  UnclearedTransactionsQueryDto,
} from './bank-recon.dto';
import { BankReconService } from './bank-recon.service';

@Controller('bank-recon')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BankReconController {
  constructor(private readonly bankRecon: BankReconService) {}

  @Post('statements')
  @Permissions(PERMISSIONS.BANK.STATEMENT_IMPORT)
  async createStatement(@Req() req: Request, @Body() dto: CreateBankStatementDto) {
    return this.bankRecon.createStatement(req, dto);
  }

  @Get('statements/:id')
  @Permissions(PERMISSIONS.BANK.RECONCILIATION_VIEW)
  async getStatement(@Req() req: Request, @Param('id') id: string) {
    return this.bankRecon.getStatement(req, id);
  }

  @Get('statements')
  @Permissions(PERMISSIONS.BANK.RECONCILIATION_VIEW)
  async listStatements(@Req() req: Request, @Query('bankAccountId') bankAccountId: string) {
    return this.bankRecon.listStatements(req, bankAccountId);
  }

  @Post('statements/:id/lines')
  @Permissions(PERMISSIONS.BANK.STATEMENT_IMPORT)
  async addLines(
    @Req() req: Request,
    @Param('id') statementId: string,
    @Body() dto: AddBankStatementLinesDto,
  ) {
    return this.bankRecon.addStatementLines(req, statementId, dto);
  }

  @Get('statements/:id/lines')
  @Permissions(PERMISSIONS.BANK.RECONCILIATION_VIEW)
  async listStatementLines(
    @Req() req: Request,
    @Param('id') statementId: string,
    @Query() q: ListStatementLinesQueryDto,
  ) {
    return this.bankRecon.listStatementLines(req, statementId, q);
  }

  @Get('statements/:id/preview')
  @Permissions(PERMISSIONS.BANK.RECONCILIATION_VIEW)
  async preview(@Req() req: Request, @Param('id') statementId: string) {
    return this.bankRecon.previewStatement(req, statementId);
  }

  @Delete('lines/:id')
  @Permissions(PERMISSIONS.BANK.STATEMENT_IMPORT)
  async deleteLine(@Req() req: Request, @Param('id') id: string) {
    return this.bankRecon.deleteStatementLine(req, id);
  }

  @Post('lines/:lineId/match')
  @Permissions(PERMISSIONS.BANK.RECONCILE)
  async matchLine(
    @Req() req: Request,
    @Param('lineId') lineId: string,
    @Body() dto: MatchStatementLineDto,
  ) {
    return this.bankRecon.matchStatementLine(req, lineId, dto);
  }

  @Post('lines/:lineId/unmatch')
  @Permissions(PERMISSIONS.BANK.RECONCILE)
  async unmatchLine(@Req() req: Request, @Param('lineId') lineId: string) {
    return this.bankRecon.unmatchStatementLine(req, lineId);
  }

  @Post('lines/:lineId/create-adjustment')
  @Permissions(PERMISSIONS.BANK.RECONCILE)
  async createAdjustment(
    @Req() req: Request,
    @Param('lineId') lineId: string,
    @Body() dto: CreateAdjustmentJournalDto,
  ) {
    return this.bankRecon.createAdjustmentForStatementLine(req, lineId, dto);
  }

  @Get('bank-accounts/:bankAccountId/uncleared-transactions')
  @Permissions(PERMISSIONS.BANK.RECONCILIATION_VIEW)
  async listUncleared(
    @Req() req: Request,
    @Param('bankAccountId') bankAccountId: string,
    @Query() q: UnclearedTransactionsQueryDto,
  ) {
    return this.bankRecon.listUnclearedTransactions(req, bankAccountId, q);
  }
}
