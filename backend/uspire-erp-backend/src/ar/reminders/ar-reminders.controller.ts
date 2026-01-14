import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../rbac/jwt-auth.guard';
import { PERMISSIONS } from '../../rbac/permission-catalog';
import { Permissions, PermissionsAny } from '../../rbac/permissions.decorator';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { ArRemindersService } from './ar-reminders.service';

@Controller('ar/reminders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ArRemindersController {
  constructor(private readonly reminders: ArRemindersService) {}

  @Get('rules')
  @PermissionsAny(
    PERMISSIONS.AR_REMINDER.VIEW,
    PERMISSIONS.FINANCE.VIEW_ALL,
    PERMISSIONS.SYSTEM.VIEW_ALL,
  )
  async listRules(@Req() req: Request) {
    return this.reminders.listRules(req);
  }

  @Post('rules')
  @Permissions(PERMISSIONS.AR_REMINDER.CONFIGURE)
  async upsertRule(
    @Req() req: Request,
    @Body()
    body: {
      id?: string;
      name: string;
      triggerType: 'BEFORE_DUE' | 'ON_DUE' | 'AFTER_DUE';
      daysOffset: number;
      active: boolean;
      escalationLevel: 'NORMAL' | 'ESCALATED' | 'FINAL';
    },
  ) {
    return this.reminders.upsertRule(req, body);
  }

  @Get('templates')
  @PermissionsAny(
    PERMISSIONS.AR_REMINDER.VIEW,
    PERMISSIONS.FINANCE.VIEW_ALL,
    PERMISSIONS.SYSTEM.VIEW_ALL,
  )
  async listTemplates(@Req() req: Request) {
    return this.reminders.listTemplates(req);
  }

  @Post('templates')
  @Permissions(PERMISSIONS.AR_REMINDER.CONFIGURE)
  async upsertTemplate(
    @Req() req: Request,
    @Body()
    body: {
      id?: string;
      level: 'NORMAL' | 'ESCALATED' | 'FINAL';
      subject: string;
      body: string;
      active: boolean;
    },
  ) {
    return this.reminders.upsertTemplate(req, body);
  }

  @Post('send')
  @Permissions(PERMISSIONS.AR_REMINDER.TRIGGER)
  async send(
    @Req() req: Request,
    @Body()
    body: {
      invoiceId: string;
      triggerMode?: 'AUTO' | 'MANUAL';
      reminderRuleId?: string;
    },
  ) {
    return this.reminders.sendReminder(req, {
      invoiceId: body.invoiceId,
      triggerMode: body.triggerMode ?? 'MANUAL',
      reminderRuleId: body.reminderRuleId,
    });
  }
}
