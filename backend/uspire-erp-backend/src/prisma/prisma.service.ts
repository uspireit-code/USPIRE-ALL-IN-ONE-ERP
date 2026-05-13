import { ForbiddenException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AuditEntityType, AuditEventType, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  getActorOrSystem,
  getRequestContext,
  getRequestIdOrSystem,
  getTenantIdOrNull,
} from '../internal/request-context.store';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();

    const guard = async (p: {
      prismaClient: any;
      model: any;
      action: any;
      args: any;
      next: (args: any) => Promise<any>;
    }) => {
      const prismaClient = p.prismaClient;
      const model = p.model;
      const action = p.action;
      const args = p.args;

      const journalEntryDelegate =
        prismaClient?.journalEntry ??
        (model === 'JournalEntry' ? prismaClient : undefined);
      const journalLineDelegate =
        prismaClient?.journalLine ??
        (model === 'JournalLine' ? prismaClient : undefined);

      const isJournalEntry = model === 'JournalEntry';
      const isJournalLine = model === 'JournalLine';

      const isWriteAction =
        action === 'create' ||
        action === 'createMany' ||
        action === 'update' ||
        action === 'updateMany' ||
        action === 'upsert' ||
        action === 'delete' ||
        action === 'deleteMany';

      if (!isWriteAction) {
        return p.next(args);
      }

      const ctx = getRequestContext();
      const req: any = ctx?.req as any;
      const glLifecycleBypass = Boolean((ctx as any)?.glLifecycleBypass);

      const tenantId: string | null = getTenantIdOrNull(ctx);
      const actorUserId: string = getActorOrSystem(ctx);
      const requestId: string = getRequestIdOrSystem(ctx);
      const ipAddress: string | null =
        ctx?.ipAddress ?? (typeof req?.ip === 'string' ? req.ip : null);
      const userAgent: string | null =
        ctx?.userAgent ??
        (typeof req?.headers?.['user-agent'] === 'string'
          ? req.headers['user-agent']
          : null);

      const whereForAudit = (args as any)?.where ?? null;
      const attemptedDataForAudit = (args as any)?.data ??
        (action === 'upsert' ? (args as any)?.update ?? null : null);
      const attemptedKeysForAudit =
        attemptedDataForAudit && typeof attemptedDataForAudit === 'object'
          ? Object.keys(attemptedDataForAudit)
          : [];

      const containsForbiddenNestedJournalStatusMutation = (node: unknown): boolean => {
        const isForbiddenStatus = (v: unknown) => v === 'POSTED' || v === 'REVIEWED';

        const hasForbiddenStatusInAny = (n: unknown): boolean => {
          if (!n) return false;
          if (Array.isArray(n)) return n.some(hasForbiddenStatusInAny);
          if (typeof n !== 'object') return false;
          for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
            if (k === 'status' && isForbiddenStatus(v)) return true;
            if (hasForbiddenStatusInAny(v)) return true;
          }
          return false;
        };

        const walk = (n: unknown): boolean => {
          if (!n) return false;
          if (Array.isArray(n)) return n.some(walk);
          if (typeof n !== 'object') return false;

          const obj = n as Record<string, unknown>;
          for (const [k, v] of Object.entries(obj)) {
            if (k === 'journalEntry' || k === 'journalEntries') {
              if (hasForbiddenStatusInAny(v)) return true;
            }
            if (walk(v)) return true;
          }
          return false;
        };

        return walk(node);
      };

      const postBlockedAudit = async (p: {
        entityType: AuditEntityType;
        entityId: string;
        metadata?: Record<string, any>;
      }) => {
        await writeAuditEventWithPrisma(
          {
            tenantId,
            eventType: AuditEventType.GL_JOURNAL_POST_BLOCKED,
            actorUserId,
            entityType: p.entityType,
            entityId: p.entityId,
            timestamp: new Date(),
            outcome: 'BLOCKED' as any,
            action: 'IMMUTABILITY_GUARD',
            requestId,
            ipAddress,
            userAgent,
            metadata: {
              reason:
                'Posted journals are immutable. Use reversal or adjustment workflow.',
              model,
              prismaAction: action,
              where: whereForAudit,
              attemptedData: attemptedDataForAudit,
              attemptedKeys: attemptedKeysForAudit,
              ...(p.metadata ?? {}),
            },
          },
          prismaClient,
        ).catch(() => undefined);
      };

      const deny = async (p: {
        entityType: AuditEntityType;
        entityId: string;
        metadata?: Record<string, any>;
      }) => {
        await postBlockedAudit(p);
        throw new ForbiddenException(
          'Posted journals are immutable. Use reversal or adjustment workflow.',
        );
      };

      const denyLifecycleBypass = async (p: {
        entityType: AuditEntityType;
        entityId: string;
        metadata?: Record<string, any>;
      }) => {
        await writeAuditEventWithPrisma(
          {
            tenantId,
            eventType: (AuditEventType as any).GL_LIFECYCLE_BYPASS_BLOCKED,
            actorUserId,
            entityType: p.entityType,
            entityId: p.entityId,
            timestamp: new Date(),
            outcome: 'BLOCKED' as any,
            action: 'LIFECYCLE_GUARD',
            requestId,
            ipAddress,
            userAgent,
            metadata: {
              model,
              prismaAction: action,
              where: whereForAudit,
              attemptedData: attemptedDataForAudit,
              attemptedKeys: attemptedKeysForAudit,
              ...(p.metadata ?? {}),
            },
          },
          prismaClient,
        ).catch(() => undefined);

        throw new ForbiddenException(
          'Journal lifecycle transition is not allowed. Use governed GL workflow.',
        );
      };

      // Nested writes: block any attempt to set JournalEntry.status to REVIEWED/POSTED
      // through relational nested mutations (where params.model is not JournalEntry).
      if (!isJournalEntry && !isJournalLine) {
        if (
          !glLifecycleBypass &&
          containsForbiddenNestedJournalStatusMutation((args as any)?.data)
        ) {
          return denyLifecycleBypass({
            entityType: AuditEntityType.JOURNAL_ENTRY,
            entityId: randomUUID(),
            metadata: {
              reason:
                'Nested JournalEntry status mutation to REVIEWED/POSTED blocked',
            },
          });
        }

        return p.next(args);
      }

      // JournalEntry: block any update/delete when status is POSTED.
      if (isJournalEntry) {
        if (typeof journalEntryDelegate?.findFirst !== 'function') {
          return p.next(args);
        }

        const attemptedStatus =
          attemptedDataForAudit && typeof attemptedDataForAudit === 'object'
            ? (attemptedDataForAudit as any).status
            : undefined;

        if (!glLifecycleBypass) {
          if (action === 'create' || action === 'createMany') {
            const data = (args as any)?.data;
            const rows = action === 'createMany' ? (data?.data ?? []) : [data];
            const bad = (rows ?? []).find(
              (r: any) => r && (r.status === 'REVIEWED' || r.status === 'POSTED'),
            );
            if (bad) {
              return denyLifecycleBypass({
                entityType: AuditEntityType.JOURNAL_ENTRY,
                entityId: randomUUID(),
                metadata: { reason: 'Direct create with REVIEWED/POSTED status blocked' },
              });
            }
          }

          if (attemptedStatus === 'REVIEWED' || attemptedStatus === 'POSTED') {
            return denyLifecycleBypass({
              entityType: AuditEntityType.JOURNAL_ENTRY,
              entityId:
                typeof (whereForAudit as any)?.id === 'string'
                  ? (whereForAudit as any).id
                  : randomUUID(),
              metadata: {
                reason: 'Direct status mutation to REVIEWED/POSTED blocked',
                attemptedStatus,
              },
            });
          }
        }

        const where = (args as any)?.where;
        const id = typeof where?.id === 'string' ? where.id : null;
        const tenantScopedWhere = tenantId
          ? { ...where, tenantId }
          : { ...where };

        // Upsert: treat as update when the target record exists.
        if (action === 'upsert') {
          const existing = await journalEntryDelegate.findFirst({
            where: tenantScopedWhere,
            select: { id: true, status: true },
          });
          if (existing?.status === 'POSTED') {
            return deny({
              entityType: AuditEntityType.JOURNAL_ENTRY,
              entityId: existing.id,
            });
          }
          return p.next(args);
        }

        if (id) {
          const entry = await journalEntryDelegate.findFirst({
            where: tenantScopedWhere,
            select: { id: true, status: true },
          });
          if (entry?.status === 'POSTED') {
            return deny({
              entityType: AuditEntityType.JOURNAL_ENTRY,
              entityId: entry.id,
            });
          }
        }

        // For updateMany/deleteMany, prevent targeting POSTED journals.
        if (action === 'updateMany' || action === 'deleteMany') {
          const filter = (args as any)?.where ?? {};
          if ((filter as any)?.status === 'POSTED') {
            return deny({
              entityType: AuditEntityType.JOURNAL_ENTRY,
              entityId: randomUUID(),
              metadata: { scope: 'MANY', where: filter },
            });
          }

          // Deny if the bulk filter would match any POSTED journal.
          const postedMatch = await journalEntryDelegate.findFirst({
            where: {
              AND: [
                filter,
                { status: 'POSTED', ...(tenantId ? { tenantId } : {}) },
              ],
            },
            select: { id: true },
          });
          if (postedMatch) {
            return deny({
              entityType: AuditEntityType.JOURNAL_ENTRY,
              entityId: postedMatch.id,
              metadata: { scope: 'MANY', where: filter },
            });
          }

          const filterId = typeof (filter as any)?.id === 'string' ? (filter as any).id : null;
          const filterIdIn = Array.isArray((filter as any)?.id?.in) ? (filter as any).id.in : null;

          if (filterId || (filterIdIn && filterIdIn.length > 0)) {
            const ids = filterId ? [filterId] : filterIdIn;
            const posted = await journalEntryDelegate.findFirst({
              where: {
                id: { in: ids },
                ...(tenantId ? { tenantId } : {}),
                status: 'POSTED',
              },
              select: { id: true },
            });
            if (posted) {
              return deny({
                entityType: AuditEntityType.JOURNAL_ENTRY,
                entityId: posted.id,
                metadata: { scope: 'MANY', where: filter },
              });
            }
          }
        }
      }

      // JournalLine: block updates/deletes if parent journal is POSTED.
      // Exception: allow bank-recon clearance-only updates (cleared/clearedAt/bankStatementLineId).
      if (isJournalLine) {
        if (typeof journalLineDelegate?.findFirst !== 'function') {
          return p.next(args);
        }

        const where = (args as any)?.where;
        const id = typeof where?.id === 'string' ? where.id : null;

        const data =
          action === 'upsert'
            ? (args as any)?.update
            : (args as any)?.data;
        const isUpdateAction =
          action === 'update' || action === 'updateMany' || action === 'upsert';
        const dataKeys =
          isUpdateAction && data && typeof data === 'object' ? Object.keys(data) : [];

        const clearanceKeys = new Set(['cleared', 'clearedAt', 'bankStatementLineId']);
        const isClearanceOnlyUpdate =
          isUpdateAction &&
          dataKeys.length > 0 &&
          dataKeys.every((k) => clearanceKeys.has(k));

        // Upsert: if an existing line is targeted, enforce posted-parent rule.
        if (action === 'upsert') {
          const line = await journalLineDelegate.findFirst({
            where: tenantId
              ? { ...where, journalEntry: { tenantId } }
              : {
                  ...where,
                },
            select: {
              id: true,
              journalEntryId: true,
              journalEntry: { select: { id: true, status: true } },
            },
          });

          if (line?.journalEntry?.status === 'POSTED') {
            if (isClearanceOnlyUpdate) {
              return p.next(args);
            }

            return deny({
              entityType: AuditEntityType.JOURNAL_ENTRY,
              entityId: line.journalEntryId,
              metadata: {
                journalLineId: line.id,
                attemptedKeys: dataKeys,
              },
            });
          }

          return p.next(args);
        }

        if (!id) {
          if (action === 'updateMany' || action === 'deleteMany') {
            const filter = (args as any)?.where ?? {};

            if ((filter as any)?.journalEntry?.status === 'POSTED') {
              return deny({
                entityType: AuditEntityType.JOURNAL_ENTRY,
                entityId: randomUUID(),
                metadata: { scope: 'MANY', where: filter, model: 'JournalLine' },
              });
            }

            // Deny if the bulk filter would match any journal line whose parent journal is POSTED.
            const postedLineMatch = await journalLineDelegate.findFirst({
              where: {
                AND: [
                  filter,
                  {
                    journalEntry: {
                      status: 'POSTED',
                      ...(tenantId ? { tenantId } : {}),
                    },
                  },
                ],
              },
              select: { id: true, journalEntryId: true },
            });
            if (postedLineMatch) {
              return deny({
                entityType: AuditEntityType.JOURNAL_ENTRY,
                entityId: postedLineMatch.journalEntryId,
                metadata: {
                  scope: 'MANY',
                  where: filter,
                  model: 'JournalLine',
                  journalLineId: postedLineMatch.id,
                },
              });
            }

            const jeId =
              typeof (filter as any)?.journalEntryId === 'string'
                ? (filter as any).journalEntryId
                : null;
            const jeIdIn = Array.isArray((filter as any)?.journalEntryId?.in)
              ? (filter as any).journalEntryId.in
              : null;

            if (
              (jeId || (jeIdIn && jeIdIn.length > 0)) &&
              typeof journalEntryDelegate?.findFirst === 'function'
            ) {
              const ids = jeId ? [jeId] : jeIdIn;
              const posted = await journalEntryDelegate.findFirst({
                where: {
                  id: { in: ids },
                  ...(tenantId ? { tenantId } : {}),
                  status: 'POSTED',
                },
                select: { id: true },
              });
              if (posted) {
                return deny({
                  entityType: AuditEntityType.JOURNAL_ENTRY,
                  entityId: posted.id,
                  metadata: { scope: 'MANY', where: filter },
                });
              }
            }

            return p.next(args);
          }

          return p.next(args);
        }

        const line = await journalLineDelegate.findFirst({
          where: tenantId
            ? { ...where, journalEntry: { tenantId } }
            : {
                ...where,
              },
          select: {
            id: true,
            journalEntryId: true,
            journalEntry: { select: { id: true, status: true } },
          },
        });

        if (line?.journalEntry?.status === 'POSTED') {
          if (isClearanceOnlyUpdate) {
            return p.next(args);
          }

          return deny({
            entityType: AuditEntityType.JOURNAL_ENTRY,
            entityId: line.journalEntryId,
            metadata: {
              journalLineId: line.id,
              attemptedKeys: dataKeys,
            },
          });
        }
      }

      return p.next(args);
    };

    const self: any = this as any;

    if (typeof self.$use === 'function') {
      self.$use(async function (params: any, next: any) {
        const prismaClient = this as any;
        return guard({
          prismaClient,
          model: params.model,
          action: params.action,
          args: params.args,
          next: (nextArgs) => next({ ...params, args: nextArgs }),
        });
      });
      return;
    }

    if (typeof self.$extends === 'function') {
      return self.$extends({
        query: {
          $allModels: {
            async $allOperations({ model, operation, args, query }: any) {
              const prismaClient = this as any;
              return guard({
                prismaClient,
                model,
                action: operation,
                args,
                next: (nextArgs) => query(nextArgs),
              });
            },
          },
        },
      }) as any;
    }
  }

  private logDatabaseTarget() {
    const raw = process.env.DATABASE_URL;
    if (!raw) return;
    try {
      const u = new URL(raw);
      const dbName = (u.pathname ?? '').replace(/^\//, '');
      this.logger.log(
        `DATABASE_URL target: ${u.hostname}:${u.port || '(default)'} db=${dbName || '(unknown)'} schema=${u.searchParams.get('schema') || 'public'}`,
      );
    } catch {
      this.logger.log('DATABASE_URL target: (unparseable)');
    }
  }

  async onModuleInit() {
    try {
      this.logDatabaseTarget();
      await this.$connect();
      await this.$queryRaw`SELECT 1`;
      this.logger.log('Database connection check succeeded');
    } catch (error) {
      this.logger.error('Database connection check failed', error as Error);

      if (process.env.NODE_ENV !== 'production') {
        return;
      }

      throw error;
    }
  }
}
