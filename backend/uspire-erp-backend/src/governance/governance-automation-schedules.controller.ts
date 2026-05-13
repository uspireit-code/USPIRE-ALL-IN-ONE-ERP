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
import { GlService } from '../gl/gl.service';
import { GovernanceAutomationScheduleService } from './governance-automation-schedule.service';
import { CreateAutomationScheduleDto } from './dto/create-automation-schedule.dto';
import { PreviewAutomationScheduleDto } from './dto/preview-automation-schedule.dto';
import { ExecuteAutomationScheduleDto } from './dto/execute-automation-schedule.dto';
import { assertAutomationGovernance } from './automation-governance-engine';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { buildGovernanceAuditMetadata } from './governance-enforcement';

@Controller('governance/automation-schedules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GovernanceAutomationSchedulesController {
  constructor(
    private readonly schedules: GovernanceAutomationScheduleService,
    private readonly gl: GlService,
  ) {}

  @Post('preview')
  @Permissions(PERMISSIONS.GOVERNANCE.AUTOMATION.CREATE)
  async preview(@Req() req: Request, @Body() dto: PreviewAutomationScheduleDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    const warnings: string[] = [];

    const automationCode = String(dto?.automationCode ?? '').trim();
    const targetType = String(dto?.targetType ?? '').trim();
    const targetId = String(dto?.targetId ?? '').trim();
    if (!automationCode) throw new BadRequestException('automationCode is required');
    if (!targetType) throw new BadRequestException('targetType is required');
    if (!targetId) throw new BadRequestException('targetId is required');

    const now = dto?.now ? new Date(String(dto.now)) : new Date();
    if (Number.isNaN(now.getTime())) throw new BadRequestException('Invalid now');

    const count = Math.max(1, Math.min(20, Math.floor(Number(dto?.count ?? 5))));

    const explicitNext = dto?.nextRunAt ? new Date(String(dto.nextRunAt)) : null;
    if (explicitNext && Number.isNaN(explicitNext.getTime())) {
      throw new BadRequestException('Invalid nextRunAt');
    }

    const expiresAt = dto?.expiresAt ? new Date(String(dto.expiresAt)) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid expiresAt');
    }

    const scheduleDraft = {
      automationCode,
      targetType,
      targetId,
      scheduleConfig: (dto as any)?.scheduleConfig ?? null,
      nextRunAt: explicitNext,
      expiresAt,
    };

    if (expiresAt && expiresAt.getTime() <= now.getTime()) {
      warnings.push('expiresAt is in the past or equal to now');
    }

    if (automationCode === 'RECURRING_JOURNAL_AUTOMATION' && targetType !== 'RECURRING_TEMPLATE') {
      warnings.push('For RECURRING_JOURNAL_AUTOMATION, targetType should be RECURRING_TEMPLATE');
    }
    if (automationCode === 'REVERSAL_AUTOMATION' && targetType !== 'JOURNAL_ENTRY') {
      warnings.push('For REVERSAL_AUTOMATION, targetType should be JOURNAL_ENTRY');
    }

    let cursor = explicitNext;
    if (!cursor) {
      cursor = this.schedules.computeNextRunAt({
        schedule: scheduleDraft,
        automationCode,
        now,
      });
    }

    const nextRuns: string[] = [];
    if (!cursor) {
      warnings.push('Unable to compute next run time from scheduleConfig; provide nextRunAt or valid scheduleConfig');
    } else {
      for (let i = 0; i < count; i += 1) {
        if (expiresAt && cursor.getTime() > expiresAt.getTime()) {
          warnings.push('Computed next run is after expiresAt; truncated preview');
          break;
        }

        nextRuns.push(cursor.toISOString());
        const next = this.schedules.computeNextRunAt({
          schedule: scheduleDraft,
          automationCode,
          now: cursor,
        });
        if (!next) break;
        cursor = next;
      }
    }

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: 'AUTOMATION_SCHEDULE_UPDATED' as any,
        actorUserId: user.id,
        entityType: 'GOVERNANCE_AUTOMATION_SCHEDULE' as any,
        entityId: 'PREVIEW',
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        permissionUsed: PERMISSIONS.GOVERNANCE.AUTOMATION.CREATE,
        metadata: {
          governance: buildGovernanceAuditMetadata({
            actionType: 'AUTOMATION_SCHEDULE_PREVIEW' as any,
            permissionUsed: PERMISSIONS.GOVERNANCE.AUTOMATION.CREATE,
            actorUserId: user.id,
            tenantId: tenant.id,
            req,
            after: {
              automationCode,
              targetType,
              targetId,
              count,
              now: now.toISOString(),
              nextRuns,
              warnings,
            },
          }),
        },
      },
      this.schedules.prisma,
    );

    return {
      now: now.toISOString(),
      count,
      warnings,
      nextRuns,
    };
  }

  @Post('sweep-due')
  @Permissions(PERMISSIONS.GOVERNANCE.AUTOMATION.EXECUTE)
  async sweepDue(
    @Req() req: Request,
    @Body()
    body: {
      now?: string;
      limit?: number;
      execute?: boolean;
      includeSuspended?: boolean;
      autoSubmitForReview?: boolean;
      evidenceRefs?: Array<{ id: string; evidenceCategory?: string | null; fileName?: string | null }>;
      overrideSessionId?: string;
      governanceReason?: string;
    },
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    const now = body?.now ? new Date(String(body.now)) : new Date();
    if (Number.isNaN(now.getTime())) throw new BadRequestException('Invalid now');

    const execute = Boolean(body?.execute);
    const limit = body?.limit;

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: 'AUTOMATION_SCHEDULE_UPDATED' as any,
        actorUserId: user.id,
        entityType: 'GOVERNANCE_AUTOMATION_SCHEDULE' as any,
        entityId: 'SWEEP_DUE',
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        permissionUsed: PERMISSIONS.GOVERNANCE.AUTOMATION.EXECUTE,
        metadata: {
          governance: buildGovernanceAuditMetadata({
            actionType: 'AUTOMATION_SCHEDULE_SWEEP_DUE' as any,
            permissionUsed: PERMISSIONS.GOVERNANCE.AUTOMATION.EXECUTE,
            actorUserId: user.id,
            tenantId: tenant.id,
            req,
            after: {
              now: now.toISOString(),
              execute,
              limit: limit ?? null,
            },
          }),
        },
      },
      this.schedules.prisma,
    );

    const due = await this.schedules.resolveDueSchedules({
      tenantId: tenant.id,
      now,
      includeSuspended: Boolean(body?.includeSuspended),
      limit,
    });

    const results: any[] = [];

    for (const schedule of due) {
      const scheduleId = String((schedule as any).id);

      const maybeExpired = await this.schedules.applyExpiryTransition({
        tenantId: tenant.id,
        scheduleId,
        now,
        permissionUsed: PERMISSIONS.GOVERNANCE.AUTOMATION.EXECUTE,
        actorUserId: user.id,
        req,
      });

      const scheduleStatus = String((maybeExpired as any).scheduleStatus ?? '').trim();
      if (scheduleStatus === 'EXPIRED' || scheduleStatus === 'REVOKED') {
        results.push({ scheduleId, status: scheduleStatus, due: true, executed: false });
        continue;
      }

      const automationCode = String((maybeExpired as any).automationCode ?? '').trim();
      const evidenceRefs = Array.isArray(body?.evidenceRefs) ? body.evidenceRefs : [];
      const overrideSessionId = body?.overrideSessionId ? String(body.overrideSessionId).trim() : null;

      let governanceEligible = true;
      let governanceViolation: any = null;
      try {
        assertAutomationGovernance({
          req,
          tenantId: tenant.id,
          actorUserId: user.id,
          actorType: 'SUPERVISOR',
          permissionUsed: PERMISSIONS.GOVERNANCE.AUTOMATION.EXECUTE,
          automationCode: automationCode as any,
          now,
          journalType: null,
          evidenceRefs,
          overrideSessionId,
          retryCount: 0,
          lastExecutionAt: (maybeExpired as any).lastRunAt ?? null,
          isSuspended: scheduleStatus === 'SUSPENDED',
        });
      } catch (e: any) {
        governanceEligible = false;
        governanceViolation = e?.response ?? e?.message ?? String(e);
      }

      if (!execute) {
        results.push({
          scheduleId,
          status: scheduleStatus,
          due: true,
          governanceEligible,
          governanceViolation,
          executed: false,
        });
        continue;
      }

      if (!governanceEligible) {
        results.push({
          scheduleId,
          status: scheduleStatus,
          due: true,
          governanceEligible,
          governanceViolation,
          executed: false,
        });
        continue;
      }

      try {
        const targetType = String((maybeExpired as any).targetType ?? '').trim();
        const targetId = String((maybeExpired as any).targetId ?? '').trim();

        if (automationCode === 'RECURRING_JOURNAL_AUTOMATION') {
          if (targetType !== 'RECURRING_TEMPLATE') {
            throw new BadRequestException('Schedule targetType must be RECURRING_TEMPLATE');
          }
          const executionResult = await this.gl.executeRecurringAutomation(req, targetId, {
            runDate: now.toISOString(),
            scheduleId,
            autoSubmitForReview: Boolean(body?.autoSubmitForReview),
            evidenceRefs,
            overrideSessionId: overrideSessionId ?? undefined,
            governanceReason: body?.governanceReason,
          } as any);
          results.push({ scheduleId, status: scheduleStatus, due: true, executed: true, executionResult });
          continue;
        }

        if (automationCode === 'REVERSAL_AUTOMATION') {
          if (targetType !== 'JOURNAL_ENTRY') {
            throw new BadRequestException('Schedule targetType must be JOURNAL_ENTRY');
          }
          const executionResult = await this.gl.executeReversalAutomation(req, targetId, {
            journalDate: now.toISOString(),
            scheduleId,
            reason: body?.governanceReason ?? 'Scheduled reversal',
            autoSubmitForReview: Boolean(body?.autoSubmitForReview),
            evidenceRefs,
            overrideSessionId: overrideSessionId ?? undefined,
            governanceReason: body?.governanceReason,
          } as any);
          results.push({ scheduleId, status: scheduleStatus, due: true, executed: true, executionResult });
          continue;
        }

        results.push({
          scheduleId,
          status: scheduleStatus,
          due: true,
          executed: false,
          error: `Unsupported automationCode: ${automationCode}`,
        });
      } catch (e: any) {
        results.push({
          scheduleId,
          status: scheduleStatus,
          due: true,
          executed: false,
          error: e?.response ?? e?.message ?? String(e),
        });
      }
    }

    return {
      now: now.toISOString(),
      execute,
      dueCount: due.length,
      results,
    };
  }

  @Post()
  @Permissions(PERMISSIONS.GOVERNANCE.AUTOMATION.CREATE)
  async create(@Req() req: Request, @Body() dto: CreateAutomationScheduleDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    return this.schedules.createSchedule({
      tenantId: tenant.id,
      createdById: user.id,
      permissionUsed: PERMISSIONS.GOVERNANCE.AUTOMATION.CREATE,
      req,
      automationCode: dto.automationCode,
      targetType: dto.targetType,
      targetId: dto.targetId,
      scheduleConfig: (dto as any).scheduleConfig ?? null,
      nextRunAt: dto.nextRunAt ?? null,
      expiresAt: dto.expiresAt ?? null,
    });
  }

  @Get()
  @Permissions(PERMISSIONS.GOVERNANCE.AUTOMATION.VIEW)
  async list(
    @Req() req: Request,
    @Query('automationCode') automationCode?: string,
    @Query('scheduleStatus') scheduleStatus?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
  ) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    return this.schedules.listSchedules({
      tenantId: tenant.id,
      automationCode: automationCode ? String(automationCode).trim() : undefined,
      scheduleStatus: scheduleStatus ? String(scheduleStatus).trim() : undefined,
      targetType: targetType ? String(targetType).trim() : undefined,
      targetId: targetId ? String(targetId).trim() : undefined,
    });
  }

  @Get(':id')
  @Permissions(PERMISSIONS.GOVERNANCE.AUTOMATION.VIEW)
  async getById(@Req() req: Request, @Param('id') id: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');
    return this.schedules.getSchedule({ tenantId: tenant.id, scheduleId: id });
  }

  @Post(':id/suspend')
  @Permissions(PERMISSIONS.GOVERNANCE.AUTOMATION.SUSPEND)
  async suspend(@Req() req: Request, @Param('id') id: string, @Body() body: { reason?: string }) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    return this.schedules.suspendSchedule({
      tenantId: tenant.id,
      scheduleId: id,
      suspendedById: user.id,
      permissionUsed: PERMISSIONS.GOVERNANCE.AUTOMATION.SUSPEND,
      req,
      reason: body?.reason,
    });
  }

  @Post(':id/resume')
  @Permissions(PERMISSIONS.GOVERNANCE.AUTOMATION.SUSPEND)
  async resume(@Req() req: Request, @Param('id') id: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    return this.schedules.resumeSchedule({
      tenantId: tenant.id,
      scheduleId: id,
      resumedById: user.id,
      permissionUsed: PERMISSIONS.GOVERNANCE.AUTOMATION.SUSPEND,
      req,
    });
  }

  @Post(':id/revoke')
  @Permissions(PERMISSIONS.GOVERNANCE.AUTOMATION.SUSPEND)
  async revoke(@Req() req: Request, @Param('id') id: string, @Body() body: { reason?: string }) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    return this.schedules.revokeSchedule({
      tenantId: tenant.id,
      scheduleId: id,
      revokedById: user.id,
      permissionUsed: PERMISSIONS.GOVERNANCE.AUTOMATION.SUSPEND,
      req,
      reason: body?.reason,
    });
  }

  // DRAFT-only execution entry point (supervised orchestration)
  @Post(':id/execute')
  @Permissions(PERMISSIONS.GOVERNANCE.AUTOMATION.EXECUTE)
  async execute(@Req() req: Request, @Param('id') id: string, @Body() dto: ExecuteAutomationScheduleDto) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    const schedule = await this.schedules.getSchedule({ tenantId: tenant.id, scheduleId: id });

    const targetType = String((schedule as any).targetType ?? '').trim();
    const targetId = String((schedule as any).targetId ?? '').trim();
    const automationCode = String((schedule as any).automationCode ?? '').trim();

    // Scheduler does not decide governance; it triggers the domain orchestrator.
    if (automationCode === 'RECURRING_JOURNAL_AUTOMATION') {
      if (targetType !== 'RECURRING_TEMPLATE') {
        throw new BadRequestException('Schedule targetType must be RECURRING_TEMPLATE');
      }
      return this.gl.executeRecurringAutomation(req, targetId, {
        runDate: dto.runAt,
        autoSubmitForReview: dto.autoSubmitForReview,
        evidenceRefs: (dto as any).evidenceRefs ?? [],
        overrideSessionId: dto.overrideSessionId,
        governanceReason: dto.governanceReason,
        scheduleId: schedule.id,
      } as any);
    }

    if (automationCode === 'REVERSAL_AUTOMATION') {
      if (targetType !== 'JOURNAL_ENTRY') {
        throw new BadRequestException('Schedule targetType must be JOURNAL_ENTRY');
      }
      return this.gl.executeReversalAutomation(req, targetId, {
        journalDate: dto.runAt,
        reason: dto.governanceReason ?? 'Scheduled reversal',
        autoSubmitForReview: dto.autoSubmitForReview,
        evidenceRefs: (dto as any).evidenceRefs ?? [],
        overrideSessionId: dto.overrideSessionId,
        governanceReason: dto.governanceReason,
        scheduleId: schedule.id,
      } as any);
    }

    throw new BadRequestException(`Unsupported automationCode: ${automationCode}`);
  }
}
