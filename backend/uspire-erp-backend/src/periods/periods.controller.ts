import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions, PermissionsAny } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { CreateAccountingPeriodDto } from '../gl/dto/create-accounting-period.dto';
import { ReopenPeriodDto } from '../gl/dto/reopen-period.dto';
import { PeriodsService } from './periods.service';
import { CorrectPeriodDto } from './dto/correct-period.dto';

@Controller('periods')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PeriodsController {
  constructor(private readonly periods: PeriodsService) {}

  @Get()
  @PermissionsAny(
    PERMISSIONS.PERIOD.VIEW,
    PERMISSIONS.PERIOD.REVIEW,
    PERMISSIONS.GL.VIEW,
  )
  async list(@Req() req: Request) {
    return this.periods.listPeriods(req);
  }

  @Post()
  @Permissions(PERMISSIONS.PERIOD.CREATE)
  async create(@Req() req: Request, @Body() dto: CreateAccountingPeriodDto) {
    return this.periods.createPeriod(req, dto);
  }

  @Get(':id/checklist')
  @PermissionsAny(
    PERMISSIONS.PERIOD.CHECKLIST_VIEW,
    PERMISSIONS.PERIOD.VIEW,
    PERMISSIONS.PERIOD.REVIEW,
    PERMISSIONS.GL.VIEW,
  )
  async getChecklist(@Req() req: Request, @Param('id') id: string) {
    return this.periods.getChecklist(req, id);
  }

  @Post(':id/checklist/items/:itemId/complete')
  @Permissions(PERMISSIONS.PERIOD.CHECKLIST_COMPLETE)
  async completeChecklistItem(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.periods.completeChecklistItem(req, { periodId: id, itemId });
  }

  @Post(':id/close')
  @Permissions(PERMISSIONS.PERIOD.CLOSE)
  async close(@Req() req: Request, @Param('id') id: string) {
    return this.periods.closePeriod(req, id);
  }

  @Post(':id/reopen')
  @Permissions(PERMISSIONS.PERIOD.REOPEN)
  async reopen(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ReopenPeriodDto,
  ) {
    return this.periods.reopenPeriod(req, id, dto);
  }

  @Patch(':id/correct')
  @Permissions(PERMISSIONS.PERIOD.CORRECT)
  async correct(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CorrectPeriodDto,
  ) {
    return this.periods.correctPeriod(req, id, dto);
  }
}
