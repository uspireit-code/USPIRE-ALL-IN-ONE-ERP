import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS } from '../../rbac/permission-catalog';

type ReminderSendMode = 'AUTO' | 'MANUAL';

type ReminderLevel = 'NORMAL' | 'ESCALATED' | 'FINAL';

@Injectable()
export class ArRemindersService {
  private static readonly FINAL_MIN_DAYS_OVERDUE = 30;

  constructor(private readonly prisma: PrismaService) {}

  async listRules(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new ForbiddenException('Missing tenant context');

    return this.prisma.arReminderRule.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async upsertRule(req: Request, input: {
    id?: string;
    name: string;
    triggerType: 'BEFORE_DUE' | 'ON_DUE' | 'AFTER_DUE';
    daysOffset: number;
    active: boolean;
    escalationLevel: ReminderLevel;
  }) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new ForbiddenException('Missing tenant or user context');

    if (!input.name?.trim()) throw new BadRequestException('Rule name is required');

    const rule = input.id
      ? await this.prisma.arReminderRule.update({
          where: { id: input.id },
          data: {
            name: input.name.trim(),
            triggerType: input.triggerType as any,
            daysOffset: input.daysOffset,
            active: input.active,
            escalationLevel: input.escalationLevel as any,
          },
        })
      : await this.prisma.arReminderRule.create({
          data: {
            tenantId: tenant.id,
            name: input.name.trim(),
            triggerType: input.triggerType as any,
            daysOffset: input.daysOffset,
            active: input.active,
            escalationLevel: input.escalationLevel as any,
            createdById: user.id,
          },
        });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'AR_REMINDER_CONFIG_CHANGED' as any,
          entityType: 'TENANT' as any,
          entityId: tenant.id,
          action: 'AR_REMINDER_CONFIG_CHANGED',
          outcome: 'SUCCESS' as any,
          reason: JSON.stringify({ type: 'RULE', ruleId: rule.id }),
          userId: user.id,
          permissionUsed: PERMISSIONS.AR_REMINDER.CONFIGURE,
        } as any,
      })
      .catch(() => undefined);

    return rule;
  }

  async listTemplates(req: Request) {
    const tenant = req.tenant;
    if (!tenant) throw new ForbiddenException('Missing tenant context');

    return this.prisma.arReminderTemplate.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ active: 'desc' }, { level: 'asc' }],
    });
  }

  async upsertTemplate(req: Request, input: {
    id?: string;
    level: ReminderLevel;
    subject: string;
    body: string;
    active: boolean;
  }) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new ForbiddenException('Missing tenant or user context');

    if (!input.subject?.trim()) throw new BadRequestException('Template subject is required');
    if (!input.body?.trim()) throw new BadRequestException('Template body is required');

    const template = input.id
      ? await this.prisma.arReminderTemplate.update({
          where: { id: input.id },
          data: {
            level: input.level as any,
            subject: input.subject,
            body: input.body,
            active: input.active,
            lastUpdatedById: user.id,
          },
        })
      : await this.prisma.arReminderTemplate.create({
          data: {
            tenantId: tenant.id,
            level: input.level as any,
            subject: input.subject,
            body: input.body,
            active: input.active,
            lastUpdatedById: user.id,
          },
        });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'AR_REMINDER_CONFIG_CHANGED' as any,
          entityType: 'TENANT' as any,
          entityId: tenant.id,
          action: 'AR_REMINDER_CONFIG_CHANGED',
          outcome: 'SUCCESS' as any,
          reason: JSON.stringify({ type: 'TEMPLATE', templateId: template.id, level: template.level }),
          userId: user.id,
          permissionUsed: PERMISSIONS.AR_REMINDER.CONFIGURE,
        } as any,
      })
      .catch(() => undefined);

    return template;
  }

  async evaluateRulesForInvoice(req: Request, invoiceId: string) {
    const tenant = req.tenant;
    if (!tenant) throw new ForbiddenException('Missing tenant context');

    const invoice = await this.prisma.customerInvoice.findFirst({
      where: { id: invoiceId, tenantId: tenant.id },
      select: { id: true, dueDate: true },
    });

    if (!invoice) throw new BadRequestException('Invoice not found');

    const todayIso = new Date().toISOString().slice(0, 10);
    const dueIso = invoice.dueDate.toISOString().slice(0, 10);

    const dueDate = new Date(dueIso);
    const today = new Date(todayIso);
    const daysFromDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    const rules = await this.prisma.arReminderRule.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: [{ daysOffset: 'asc' }],
    });

    const matching = rules.filter((r) => {
      const offset = r.daysOffset;
      if (offset < 0) {
        const daysBefore = -offset;
        return daysFromDue === -daysBefore;
      }
      return daysFromDue === offset;
    });

    return {
      today: todayIso,
      dueDate: dueIso,
      daysFromDue,
      matchingRules: matching,
    };
  }

  private async enforceOnePerInvoicePerDay(tenantId: string, invoiceId: string) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const recent = await this.prisma.arReminderLog.findFirst({
      where: { tenantId, invoiceId, sentAt: { gte: startOfDay } },
      select: { id: true, sentAt: true },
      orderBy: { sentAt: 'desc' },
    });

    if (recent) {
      throw new BadRequestException('Reminder already sent for this invoice today');
    }
  }

  private determineNextLevel(last: null | ReminderLevel): ReminderLevel {
    if (!last) return 'NORMAL';
    if (last === 'NORMAL') return 'ESCALATED';
    if (last === 'ESCALATED') return 'FINAL';
    return 'FINAL';
  }

  private enforceFinalOverdue(daysOverdue: number) {
    if (daysOverdue <= ArRemindersService.FINAL_MIN_DAYS_OVERDUE) {
      throw new BadRequestException(
        `FINAL reminder blocked: invoice must be > ${ArRemindersService.FINAL_MIN_DAYS_OVERDUE} days overdue`,
      );
    }
  }

  async sendReminder(req: Request, input: {
    invoiceId: string;
    triggerMode: ReminderSendMode;
    reminderRuleId?: string;
  }) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new ForbiddenException('Missing tenant or user context');

    if (!input.invoiceId) throw new BadRequestException('invoiceId is required');

    const invoice = await this.prisma.customerInvoice.findFirst({
      where: { id: input.invoiceId, tenantId: tenant.id },
      select: {
        id: true,
        tenantId: true,
        customerId: true,
        dueDate: true,
        status: true,
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!invoice) throw new BadRequestException('Invoice not found');

    const today = new Date();
    const due = new Date(invoice.dueDate);
    const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

    await this.enforceOnePerInvoicePerDay(tenant.id, invoice.id);

    const lastLog = await this.prisma.arReminderLog.findFirst({
      where: { tenantId: tenant.id, invoiceId: invoice.id },
      select: { reminderLevel: true },
      orderBy: { sentAt: 'desc' },
    });

    const nextLevel = this.determineNextLevel((lastLog?.reminderLevel as any) ?? null);

    if (nextLevel === 'FINAL') {
      this.enforceFinalOverdue(daysOverdue);
    }

    const template = await this.prisma.arReminderTemplate.findFirst({
      where: { tenantId: tenant.id, level: nextLevel as any, active: true },
      select: { id: true, subject: true, body: true, level: true },
    });

    if (!template) {
      throw new BadRequestException(`No active template found for ${nextLevel}`);
    }

    const rule = input.reminderRuleId
      ? await this.prisma.arReminderRule.findFirst({
          where: { id: input.reminderRuleId, tenantId: tenant.id, active: true },
          select: { id: true, escalationLevel: true },
        })
      : null;

    const log = await this.prisma.arReminderLog.create({
      data: {
        tenantId: tenant.id,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        reminderRuleId: rule?.id ?? null,
        reminderLevel: nextLevel as any,
        triggerMode: input.triggerMode as any,
        sentById: user.id,
      },
    });

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: tenant.id,
          eventType: 'AR_REMINDER_SENT' as any,
          entityType: 'CUSTOMER_INVOICE' as any,
          entityId: invoice.id,
          action: 'AR_REMINDER_SENT',
          outcome: 'SUCCESS' as any,
          reason: JSON.stringify({
            customerId: invoice.customerId,
            reminderLevel: nextLevel,
            triggerMode: input.triggerMode,
            reminderRuleId: rule?.id ?? null,
            templateId: template.id,
          }),
          userId: user.id,
          permissionUsed: PERMISSIONS.AR_REMINDER.TRIGGER,
        } as any,
      })
      .catch(() => undefined);

    return {
      logId: log.id,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      reminderLevel: nextLevel,
      triggerMode: input.triggerMode,
      subject: template.subject,
      body: template.body,
      customerEmail: invoice.customer.email ?? null,
    };
  }
}
