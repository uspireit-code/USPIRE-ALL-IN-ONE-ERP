import {
  BadRequestException,
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
import { PERMISSIONS } from '../rbac/permission-catalog';
import { Permissions, PermissionsAny } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { GovernanceOverrideSessionService } from './governance-override-session.service';
import { CreateOverrideSessionDto } from './dto/create-override-session.dto';
import { getOverridePolicy, type OverrideCode } from './override-governance-registry';

@Controller('governance/override-sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GovernanceOverrideSessionsController {
  constructor(private readonly sessions: GovernanceOverrideSessionService) {}

  @Post()
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
    PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
  )
  async create(@Req() req: Request, @Body() dto: CreateOverrideSessionDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    const overrideCode = String(dto.overrideCode ?? '').trim() as OverrideCode;
    const entryPoint = String(dto.entryPoint ?? '').trim();
    const policy = getOverridePolicy(overrideCode);
    if (!policy) {
      throw new BadRequestException(`Unknown overrideCode: ${overrideCode}`);
    }

    if (policy.allowedEntryPoints !== 'ANY') {
      const ok = policy.allowedEntryPoints.includes(entryPoint as any);
      if (!ok) {
        throw new BadRequestException(
          `Override entryPoint is not allowed for overrideCode ${overrideCode}`,
        );
      }
    }

    return this.sessions.createSession({
      tenantId: tenant.id,
      requestedById: user.id,
      overrideCode,
      entryPoint,
      reason: dto.reason,
      justification: dto.justification,
      expiresAt: dto.expiresAt,
      escalation:
        dto.escalationType || dto.escalationReason
          ? {
              type: dto.escalationType ?? null,
              reason: dto.escalationReason ?? null,
            }
          : null,
      entityType: (dto.entityType as any) ?? null,
      entityId: dto.entityId ?? null,
      req,
      permissionUsed: PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
    });
  }

  @Get()
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
    PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
  )
  async list(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('overrideCode') overrideCode?: string,
    @Query('requestedById') requestedById?: string,
  ) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.sessions.listSessions({
      tenantId: tenant.id,
      status: status ? String(status).trim() : undefined,
      overrideCode: overrideCode ? String(overrideCode).trim() : undefined,
      requestedById: requestedById ? String(requestedById).trim() : undefined,
    });
  }

  @Get(':id')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
    PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
  )
  async getById(@Req() req: Request, @Param('id') id: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');
    return this.sessions.getSession({ tenantId: tenant.id, sessionId: id });
  }

  @Post(':id/approve')
  @Permissions(PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE)
  async approve(@Req() req: Request, @Param('id') id: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    return this.sessions.approveSession({
      tenantId: tenant.id,
      sessionId: id,
      approvedById: user.id,
      req,
      permissionUsed: PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
    });
  }

  @Post(':id/reject')
  @Permissions(PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE)
  async reject(@Req() req: Request, @Param('id') id: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    return this.sessions.rejectSession({
      tenantId: tenant.id,
      sessionId: id,
      rejectedById: user.id,
      req,
      permissionUsed: PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
    });
  }

  @Post(':id/revoke')
  @Permissions(PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE)
  async revoke(@Req() req: Request, @Param('id') id: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    return this.sessions.revokeSession({
      tenantId: tenant.id,
      sessionId: id,
      revokedById: user.id,
      req,
      permissionUsed: PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
    });
  }
}
