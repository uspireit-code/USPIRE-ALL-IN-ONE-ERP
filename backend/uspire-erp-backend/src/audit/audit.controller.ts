import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AuditService } from './audit.service';
import { AuditEventsQueryDto } from './dto/audit-events-query.dto';

@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('events')
  @Permissions(PERMISSIONS.AUDIT_VIEW)
  async listEvents(@Req() req: Request, @Query() dto: AuditEventsQueryDto) {
    return this.audit.listEvents(req, dto);
  }
}
