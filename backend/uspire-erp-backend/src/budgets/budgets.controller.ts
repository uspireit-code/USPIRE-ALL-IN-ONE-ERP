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
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';

@Controller('budgets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Post()
  @Permissions('BUDGET_CREATE')
  async createBudget(@Req() req: Request, @Body() dto: CreateBudgetDto) {
    return this.budgets.createBudget(req, dto);
  }

  @Post(':id/approve')
  @Permissions('BUDGET_APPROVE')
  async approveBudget(@Req() req: Request, @Param('id') id: string) {
    return this.budgets.approveBudget(req, id);
  }

  @Get()
  @Permissions('BUDGET_VIEW')
  async listBudgets(
    @Req() req: Request,
    @Query('fiscalYear') fiscalYear?: string,
  ) {
    const fy = fiscalYear ? Number(fiscalYear) : undefined;
    return this.budgets.listBudgets(req, {
      fiscalYear: fy && !Number.isNaN(fy) ? fy : undefined,
    });
  }

  @Get('vs-actual')
  @Permissions('FINANCE_BUDGET_VIEW')
  async budgetVsActualPaged(
    @Req() req: Request,
    @Query('fiscalYear') fiscalYear?: string,
    @Query('periodId') periodId?: string,
    @Query('accountId') accountId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    const fy = fiscalYear ? Number(fiscalYear) : undefined;
    const lim = limit ? Number(limit) : undefined;
    const off = offset ? Number(offset) : undefined;

    return this.budgets.budgetVsActualPaged(req, {
      fiscalYear: fy && !Number.isNaN(fy) ? fy : undefined,
      periodId: periodId?.trim() || undefined,
      accountId: accountId?.trim() || undefined,
      limit: lim && Number.isFinite(lim) ? lim : undefined,
      offset: off && Number.isFinite(off) ? off : undefined,
      sortBy: sortBy?.trim() || undefined,
      sortDir: sortDir?.trim() || undefined,
    });
  }

  @Get('vs-actual/:accountId/:periodId/journals')
  @Permissions('FINANCE_BUDGET_VIEW')
  async budgetVsActualDrilldownJournals(
    @Req() req: Request,
    @Param('accountId') accountId: string,
    @Param('periodId') periodId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const lim = limit ? Number(limit) : undefined;
    const off = offset ? Number(offset) : undefined;

    return this.budgets.budgetVsActualJournals(req, {
      accountId,
      periodId,
      limit: lim && Number.isFinite(lim) ? lim : undefined,
      offset: off && Number.isFinite(off) ? off : undefined,
    });
  }

  @Get('vs-actual/matrix')
  @Permissions('BUDGET_VS_ACTUAL_VIEW')
  async budgetVsActualMatrix(
    @Req() req: Request,
    @Query('fiscalYear') fiscalYear?: string,
  ) {
    const fy = fiscalYear ? Number(fiscalYear) : undefined;
    return this.budgets.budgetVsActual(req, {
      fiscalYear: fy && !Number.isNaN(fy) ? fy : undefined,
    });
  }

  @Get(':id')
  @Permissions('BUDGET_VIEW')
  async getBudget(@Req() req: Request, @Param('id') id: string) {
    return this.budgets.getBudget(req, id);
  }
}
