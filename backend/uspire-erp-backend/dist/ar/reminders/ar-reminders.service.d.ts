import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
type ReminderSendMode = 'AUTO' | 'MANUAL';
type ReminderLevel = 'NORMAL' | 'ESCALATED' | 'FINAL';
export declare class ArRemindersService {
    private readonly prisma;
    private static readonly FINAL_MIN_DAYS_OVERDUE;
    constructor(prisma: PrismaService);
    listRules(req: Request): Promise<{
        name: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdById: string;
        triggerType: import("@prisma/client").$Enums.ArReminderTriggerType;
        daysOffset: number;
        active: boolean;
        escalationLevel: import("@prisma/client").$Enums.ArReminderLevel;
    }[]>;
    upsertRule(req: Request, input: {
        id?: string;
        name: string;
        triggerType: 'BEFORE_DUE' | 'ON_DUE' | 'AFTER_DUE';
        daysOffset: number;
        active: boolean;
        escalationLevel: ReminderLevel;
    }): Promise<{
        name: string;
        id: string;
        tenantId: string;
        createdAt: Date;
        createdById: string;
        triggerType: import("@prisma/client").$Enums.ArReminderTriggerType;
        daysOffset: number;
        active: boolean;
        escalationLevel: import("@prisma/client").$Enums.ArReminderLevel;
    }>;
    listTemplates(req: Request): Promise<{
        id: string;
        tenantId: string;
        active: boolean;
        level: import("@prisma/client").$Enums.ArReminderLevel;
        subject: string;
        body: string;
        lastUpdatedById: string;
        lastUpdatedAt: Date;
    }[]>;
    upsertTemplate(req: Request, input: {
        id?: string;
        level: ReminderLevel;
        subject: string;
        body: string;
        active: boolean;
    }): Promise<{
        id: string;
        tenantId: string;
        active: boolean;
        level: import("@prisma/client").$Enums.ArReminderLevel;
        subject: string;
        body: string;
        lastUpdatedById: string;
        lastUpdatedAt: Date;
    }>;
    evaluateRulesForInvoice(req: Request, invoiceId: string): Promise<{
        today: string;
        dueDate: string;
        daysFromDue: number;
        matchingRules: {
            name: string;
            id: string;
            tenantId: string;
            createdAt: Date;
            createdById: string;
            triggerType: import("@prisma/client").$Enums.ArReminderTriggerType;
            daysOffset: number;
            active: boolean;
            escalationLevel: import("@prisma/client").$Enums.ArReminderLevel;
        }[];
    }>;
    private enforceOnePerInvoicePerDay;
    private determineNextLevel;
    private enforceFinalOverdue;
    sendReminder(req: Request, input: {
        invoiceId: string;
        triggerMode: ReminderSendMode;
        reminderRuleId?: string;
    }): Promise<{
        logId: string;
        invoiceId: string;
        customerId: string;
        reminderLevel: ReminderLevel;
        triggerMode: ReminderSendMode;
        subject: string;
        body: string;
        customerEmail: string | null;
    }>;
}
export {};
