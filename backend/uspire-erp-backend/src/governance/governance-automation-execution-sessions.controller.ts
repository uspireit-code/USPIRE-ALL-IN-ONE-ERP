import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { GovernanceAutomationExecutionSessionService } from './governance-automation-execution-session.service';

@Controller('governance/automation-executions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GovernanceAutomationExecutionSessionsController {
  constructor(private readonly executions: GovernanceAutomationExecutionSessionService) {}

  @Get()
  @Permissions(PERMISSIONS.GOVERNANCE.AUTOMATION.VIEW)
  async list(
    @Req() req: Request,
    @Query('automationCode') automationCode?: string,
    @Query('scheduleId') scheduleId?: string,
    @Query('executionStatus') executionStatus?: string,
  ) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.executions.listExecutions({
      tenantId: tenant.id,
      automationCode: automationCode ? String(automationCode).trim() : undefined,
      scheduleId: scheduleId ? String(scheduleId).trim() : undefined,
      executionStatus: executionStatus ? String(executionStatus).trim() : undefined,
    });
  }

  @Get(':id')
  @Permissions(PERMISSIONS.GOVERNANCE.AUTOMATION.VIEW)
  async getById(@Req() req: Request, @Param('id') id: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');
    return this.executions.getExecution({ tenantId: tenant.id, executionId: id });
  }
}
