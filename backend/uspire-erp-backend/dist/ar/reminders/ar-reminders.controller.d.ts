import type { Request } from 'express';
import { ArRemindersService } from './ar-reminders.service';
export declare class ArRemindersController {
    private readonly reminders;
    constructor(reminders: ArRemindersService);
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
    upsertRule(req: Request, body: {
        id?: string;
        name: string;
        triggerType: 'BEFORE_DUE' | 'ON_DUE' | 'AFTER_DUE';
        daysOffset: number;
        active: boolean;
        escalationLevel: 'NORMAL' | 'ESCALATED' | 'FINAL';
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
    upsertTemplate(req: Request, body: {
        id?: string;
        level: 'NORMAL' | 'ESCALATED' | 'FINAL';
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
    send(req: Request, body: {
        invoiceId: string;
        triggerMode?: 'AUTO' | 'MANUAL';
        reminderRuleId?: string;
    }): Promise<{
        logId: string;
        invoiceId: string;
        customerId: string;
        reminderLevel: "NORMAL" | "ESCALATED" | "FINAL";
        triggerMode: "AUTO" | "MANUAL";
        subject: string;
        body: string;
        customerEmail: string | null;
    }>;
}
