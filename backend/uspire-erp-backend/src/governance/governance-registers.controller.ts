import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { PermissionsAny } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { GovernanceExceptionRegisterQueryDto } from './dto/governance-exception-register-query.dto';
import { GovernanceOverrideSessionRegisterQueryDto } from './dto/governance-override-session-register-query.dto';
import { GovernanceEvidenceRegisterQueryDto } from './dto/governance-evidence-register-query.dto';
import { GovernanceRegistersService } from './governance-registers.service';

@Controller('governance/registers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GovernanceRegistersController {
  constructor(private readonly registers: GovernanceRegistersService) {}

  @Get('exceptions')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
    PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
  )
  async listExceptions(@Req() req: Request, @Query() dto: GovernanceExceptionRegisterQueryDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.registers.listExceptionRegister(req, dto);
  }

  @Get('override-sessions')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
    PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
  )
  async listOverrideSessions(
    @Req() req: Request,
    @Query() dto: GovernanceOverrideSessionRegisterQueryDto,
  ) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.registers.listOverrideSessionsRegister(req, dto);
  }

  @Get('evidence')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
    PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
  )
  async listEvidence(@Req() req: Request, @Query() dto: GovernanceEvidenceRegisterQueryDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.registers.listEvidenceRegister(req, dto);
  }
}
