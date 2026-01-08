"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ArRemindersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArRemindersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let ArRemindersService = class ArRemindersService {
    static { ArRemindersService_1 = this; }
    prisma;
    static FINAL_MIN_DAYS_OVERDUE = 30;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listRules(req) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.ForbiddenException('Missing tenant context');
        return this.prisma.arReminderRule.findMany({
            where: { tenantId: tenant.id },
            orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
        });
    }
    async upsertRule(req, input) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.ForbiddenException('Missing tenant or user context');
        if (!input.name?.trim())
            throw new common_1.BadRequestException('Rule name is required');
        const rule = input.id
            ? await this.prisma.arReminderRule.update({
                where: { id: input.id },
                data: {
                    name: input.name.trim(),
                    triggerType: input.triggerType,
                    daysOffset: input.daysOffset,
                    active: input.active,
                    escalationLevel: input.escalationLevel,
                },
            })
            : await this.prisma.arReminderRule.create({
                data: {
                    tenantId: tenant.id,
                    name: input.name.trim(),
                    triggerType: input.triggerType,
                    daysOffset: input.daysOffset,
                    active: input.active,
                    escalationLevel: input.escalationLevel,
                    createdById: user.id,
                },
            });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'AR_REMINDER_CONFIG_CHANGED',
                entityType: 'TENANT',
                entityId: tenant.id,
                action: 'AR_REMINDER_CONFIG_CHANGED',
                outcome: 'SUCCESS',
                reason: JSON.stringify({ type: 'RULE', ruleId: rule.id }),
                userId: user.id,
                permissionUsed: 'AR_REMINDER_CONFIGURE',
            },
        })
            .catch(() => undefined);
        return rule;
    }
    async listTemplates(req) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.ForbiddenException('Missing tenant context');
        return this.prisma.arReminderTemplate.findMany({
            where: { tenantId: tenant.id },
            orderBy: [{ active: 'desc' }, { level: 'asc' }],
        });
    }
    async upsertTemplate(req, input) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.ForbiddenException('Missing tenant or user context');
        if (!input.subject?.trim())
            throw new common_1.BadRequestException('Template subject is required');
        if (!input.body?.trim())
            throw new common_1.BadRequestException('Template body is required');
        const template = input.id
            ? await this.prisma.arReminderTemplate.update({
                where: { id: input.id },
                data: {
                    level: input.level,
                    subject: input.subject,
                    body: input.body,
                    active: input.active,
                    lastUpdatedById: user.id,
                },
            })
            : await this.prisma.arReminderTemplate.create({
                data: {
                    tenantId: tenant.id,
                    level: input.level,
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
                eventType: 'AR_REMINDER_CONFIG_CHANGED',
                entityType: 'TENANT',
                entityId: tenant.id,
                action: 'AR_REMINDER_CONFIG_CHANGED',
                outcome: 'SUCCESS',
                reason: JSON.stringify({ type: 'TEMPLATE', templateId: template.id, level: template.level }),
                userId: user.id,
                permissionUsed: 'AR_REMINDER_CONFIGURE',
            },
        })
            .catch(() => undefined);
        return template;
    }
    async evaluateRulesForInvoice(req, invoiceId) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.ForbiddenException('Missing tenant context');
        const invoice = await this.prisma.customerInvoice.findFirst({
            where: { id: invoiceId, tenantId: tenant.id },
            select: { id: true, dueDate: true },
        });
        if (!invoice)
            throw new common_1.BadRequestException('Invoice not found');
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
    async enforceOnePerInvoicePerDay(tenantId, invoiceId) {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const recent = await this.prisma.arReminderLog.findFirst({
            where: { tenantId, invoiceId, sentAt: { gte: startOfDay } },
            select: { id: true, sentAt: true },
            orderBy: { sentAt: 'desc' },
        });
        if (recent) {
            throw new common_1.BadRequestException('Reminder already sent for this invoice today');
        }
    }
    determineNextLevel(last) {
        if (!last)
            return 'NORMAL';
        if (last === 'NORMAL')
            return 'ESCALATED';
        if (last === 'ESCALATED')
            return 'FINAL';
        return 'FINAL';
    }
    enforceFinalOverdue(daysOverdue) {
        if (daysOverdue <= ArRemindersService_1.FINAL_MIN_DAYS_OVERDUE) {
            throw new common_1.BadRequestException(`FINAL reminder blocked: invoice must be > ${ArRemindersService_1.FINAL_MIN_DAYS_OVERDUE} days overdue`);
        }
    }
    async sendReminder(req, input) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.ForbiddenException('Missing tenant or user context');
        if (!input.invoiceId)
            throw new common_1.BadRequestException('invoiceId is required');
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
        if (!invoice)
            throw new common_1.BadRequestException('Invoice not found');
        const today = new Date();
        const due = new Date(invoice.dueDate);
        const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        await this.enforceOnePerInvoicePerDay(tenant.id, invoice.id);
        const lastLog = await this.prisma.arReminderLog.findFirst({
            where: { tenantId: tenant.id, invoiceId: invoice.id },
            select: { reminderLevel: true },
            orderBy: { sentAt: 'desc' },
        });
        const nextLevel = this.determineNextLevel(lastLog?.reminderLevel ?? null);
        if (nextLevel === 'FINAL') {
            this.enforceFinalOverdue(daysOverdue);
        }
        const template = await this.prisma.arReminderTemplate.findFirst({
            where: { tenantId: tenant.id, level: nextLevel, active: true },
            select: { id: true, subject: true, body: true, level: true },
        });
        if (!template) {
            throw new common_1.BadRequestException(`No active template found for ${nextLevel}`);
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
                reminderLevel: nextLevel,
                triggerMode: input.triggerMode,
                sentById: user.id,
            },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'AR_REMINDER_SENT',
                entityType: 'CUSTOMER_INVOICE',
                entityId: invoice.id,
                action: 'AR_REMINDER_SENT',
                outcome: 'SUCCESS',
                reason: JSON.stringify({
                    customerId: invoice.customerId,
                    reminderLevel: nextLevel,
                    triggerMode: input.triggerMode,
                    reminderRuleId: rule?.id ?? null,
                    templateId: template.id,
                }),
                userId: user.id,
                permissionUsed: 'AR_REMINDER_TRIGGER',
            },
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
};
exports.ArRemindersService = ArRemindersService;
exports.ArRemindersService = ArRemindersService = ArRemindersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ArRemindersService);
//# sourceMappingURL=ar-reminders.service.js.map