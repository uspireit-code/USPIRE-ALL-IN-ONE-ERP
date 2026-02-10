import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { getEffectiveActorContext } from '../auth/actor-context';
import { PrismaService } from '../prisma/prisma.service';
import { SoDService } from '../sod/sod.service';
import { PERMISSIONS } from './permission-catalog';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { evaluateSoD, type SoDCheckContext } from './sod-policy';

type PermissionRequirement =
  | string[]
  | {
      mode: 'any';
      permissions: string[];
    };

function permissionIsView(code: string): boolean {
  return (code || '').toUpperCase().endsWith('_VIEW');
}

function findRefundLifecycleExclusivityConflict(params: {
  requiredPermissions: string[];
  userPermissionCodes: Set<string>;
}): null | { permissionAttempted: string; conflictingPermission: string } {
  const refundPowers = [
    PERMISSIONS.AR.REFUND_CREATE,
    PERMISSIONS.AR.REFUND_APPROVE,
    PERMISSIONS.AR.REFUND_POST,
    PERMISSIONS.AR.REFUND_VOID,
  ] as const;

  const attempted = params.requiredPermissions.find((p) =>
    (refundPowers as readonly string[]).includes(p),
  );
  if (!attempted) return null;

  const present = refundPowers.filter((p) => params.userPermissionCodes.has(p));
  if (present.length <= 1) return null;

  const conflictingPermission =
    present.find((p) => p !== attempted) ?? present[0] ?? attempted;

  return {
    permissionAttempted: attempted,
    conflictingPermission,
  };
}

function resolveLifecycleActionFromPermission(
  permissionCode: string,
): null | 'APPROVE' | 'POST' | 'VOID' {
  const p = String(permissionCode ?? '').toUpperCase();
  if (p.endsWith('_APPROVE')) return 'APPROVE';
  if (p.endsWith('_POST')) return 'POST';
  if (p.endsWith('_VOID')) return 'VOID';
  return null;
}

function resolveSoDActionFromRequest(req: Request, attemptedPermission: string): string | null {
  const baseUrl = String((req as any)?.baseUrl ?? '').trim();
  const routePath = String((req as any)?.route?.path ?? '').trim();

  if (baseUrl === '/gl') {
    if (routePath === '/journals/:id/review') return 'GL_JOURNAL_REVIEW';
    if (routePath === '/journals/:id/reject') return 'GL_JOURNAL_REJECT';
    if (routePath === '/journals/:id/post') return 'GL_JOURNAL_POST';
    if (routePath === '/journals/:id/return-to-review') return 'GL_JOURNAL_RETURN_TO_REVIEW';
    if (routePath === '/journals/:id/reverse') return 'GL_JOURNAL_REVERSE';
    if (routePath === '/periods/:id/close') return 'PERIOD_CLOSE_APPROVE';
  }

  if (baseUrl === '/ar/receipts') {
    if (routePath === '/:id/post') return 'AR_RECEIPT_POST';
  }

  if (attemptedPermission === PERMISSIONS.PERIOD.CORRECT) return 'PERIOD_CORRECT_POSTED';

  return null;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly sod: SoDService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      !requirement ||
      (Array.isArray(requirement) && requirement.length === 0)
    ) {
      return true;
    }

    const required = Array.isArray(requirement)
      ? requirement
      : requirement.permissions;
    const mode = Array.isArray(requirement) ? 'all' : requirement.mode;

    const req = context.switchToHttp().getRequest<Request>();

    const tenant = req.tenant;
    const user = req.user;

    const actorCtx = getEffectiveActorContext(req);
    const permissionUserId = actorCtx.actingAsUserId ?? actorCtx.realUserId;

    if (!tenant || !user) {
      throw new ForbiddenException('Missing tenant or user context');
    }

    const codes = new Set<string>();
    const jwtPermissionCodes = Array.isArray((user as any)?.permissions)
      ? ((user as any).permissions as string[])
      : [];
    if (jwtPermissionCodes.length > 0) {
      for (const p of jwtPermissionCodes) codes.add(String(p));
    } else {
      const userRoles = await this.prisma.userRole.findMany({
        where: {
          userId: permissionUserId,
          role: { tenantId: tenant.id },
        },
        select: {
          role: {
            select: {
              rolePermissions: {
                select: {
                  permission: { select: { code: true } },
                },
              },
            },
          },
        },
      });

      for (const ur of userRoles) {
        for (const rp of ur.role.rolePermissions) {
          codes.add(rp.permission.code);
        }
      }
    }

    const satisfiedBySystemView = new Set<string>();

    if (mode === 'all') {
      const missing = required.filter(
        (p) => !codes.has(p) && !satisfiedBySystemView.has(p),
      );
      if (missing.length > 0) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[PermissionsGuard][deny][all]', {
            baseUrl: (req as any)?.baseUrl,
            routePath: (req as any)?.route?.path,
            method: (req as any)?.method,
            requiredAll: required,
            missing: missing,
            tenantId: tenant.id,
            userId: user.id,
            userEmail: (user as any)?.email,
          });
        }
        if (missing[0] === PERMISSIONS.AR.RECEIPT_POST) {
          throw new ForbiddenException(
            'You do not have permission to post receipts. Required: RECEIPT_POST.',
          );
        }
        throw new ForbiddenException(`Missing permission: ${missing[0]}`);
      }
    } else {
      const hasAny = required.some(
        (p) => codes.has(p) || satisfiedBySystemView.has(p),
      );
      if (!hasAny) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[PermissionsGuard][deny][any]', {
            baseUrl: (req as any)?.baseUrl,
            routePath: (req as any)?.route?.path,
            method: (req as any)?.method,
            requiredAny: required,
            tenantId: tenant.id,
            userId: user.id,
            userEmail: (user as any)?.email,
          });
        }
        throw new ForbiddenException(`Missing permission: ${required[0]}`);
      }
    }

    const requiredForSoD = required.filter((p) => !satisfiedBySystemView.has(p));

    await this.enforceLifecycleSoD({
      req,
      tenantId: tenant.id,
      realUserId: actorCtx.realUserId,
      actingAsUserId: actorCtx.actingAsUserId,
      delegationId: actorCtx.delegationId,
      requiredPermissions: requiredForSoD,
    });

    const refundExclusivityConflict = findRefundLifecycleExclusivityConflict({
      requiredPermissions: requiredForSoD,
      userPermissionCodes: codes,
    });
    if (refundExclusivityConflict) {
      await this.prisma.soDViolationLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          permissionAttempted: refundExclusivityConflict.permissionAttempted,
          conflictingPermission: refundExclusivityConflict.conflictingPermission,
        },
      });

      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'SOD_VIOLATION' as any,
            entityType: 'USER',
            entityId: user.id,
            action: refundExclusivityConflict.permissionAttempted,
            outcome: 'BLOCKED',
            reason: `Conflicts with ${refundExclusivityConflict.conflictingPermission}`,
            userId: user.id,
            permissionUsed: refundExclusivityConflict.permissionAttempted,
          },
        })
        .catch(() => undefined);

      throw new ForbiddenException({
        error: 'Action blocked by Segregation of Duties (SoD)',
        permissionAttempted: refundExclusivityConflict.permissionAttempted,
        conflictingPermission: refundExclusivityConflict.conflictingPermission,
      });
    }

    if (
      requiredForSoD.some((p) =>
        ([
          PERMISSIONS.AR.REFUND_CREATE,
          PERMISSIONS.AR.REFUND_APPROVE,
          PERMISSIONS.AR.REFUND_POST,
          PERMISSIONS.AR.REFUND_VOID,
        ] as string[]).includes(p),
      )
    ) {
      return true;
    }

    const conflict = await this.findSoDConflict({
      tenantId: tenant.id,
      userId: user.id,
      requiredPermissions: requiredForSoD,
      userPermissionCodes: codes,
    });

    if (conflict) {
      await this.prisma.soDViolationLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          permissionAttempted: conflict.permissionAttempted,
          conflictingPermission: conflict.conflictingPermission,
        },
      });

      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'SOD_VIOLATION' as any,
            entityType: 'USER',
            entityId: user.id,
            action: conflict.permissionAttempted,
            outcome: 'BLOCKED',
            reason: `Conflicts with ${conflict.conflictingPermission}`,
            userId: user.id,
            permissionUsed: conflict.permissionAttempted,
          },
        })
        .catch(() => undefined);

      throw new ForbiddenException({
        error: 'Action blocked by Segregation of Duties (SoD)',
        permissionAttempted: conflict.permissionAttempted,
        conflictingPermission: conflict.conflictingPermission,
      });
    }

    return true;
  }

  private async enforceLifecycleSoD(params: {
    req: Request;
    tenantId: string;
    realUserId: string;
    actingAsUserId?: string;
    delegationId?: string;
    requiredPermissions: string[];
  }) {
    const id = String((params.req as any)?.params?.id ?? '').trim();
    if (!id) return;

    const attemptedPermission = params.requiredPermissions.find((p) => {
      const a = resolveLifecycleActionFromPermission(p);
      return a === 'APPROVE' || a === 'POST' || a === 'VOID' || p === PERMISSIONS.PERIOD.CORRECT;
    });
    if (!attemptedPermission) return;

    if (attemptedPermission === PERMISSIONS.PERIOD.CORRECT) {
      const period = await this.prisma.accountingPeriod.findFirst({
        where: { id, tenantId: params.tenantId },
        select: { id: true, createdById: true, startDate: true, endDate: true },
      });
      if (!period) return;

      const postedInOriginalRange = await this.prisma.journalEntry.findFirst({
        where: {
          tenantId: params.tenantId,
          status: 'POSTED',
          journalDate: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
        select: { id: true },
      });

      if (!postedInOriginalRange) return;

      await this.sod.assertNoLifecycleConflict({
        req: params.req,
        tenantId: params.tenantId,
        realUserId: params.realUserId,
        actingAsUserId: params.actingAsUserId,
        delegationId: params.delegationId,
        actionType: 'PERIOD_CORRECT',
        soDAction: 'PERIOD_CORRECT_POSTED',
        entityType: 'ACCOUNTING_PERIOD' as any,
        entityId: period.id,
        createdByUserId: period.createdById ?? undefined,
        permissionUsed: attemptedPermission,
      });
      return;
    }

    const requestSoDAction = resolveSoDActionFromRequest(params.req, attemptedPermission);

    if (requestSoDAction === 'AR_RECEIPT_POST') {
      const receipt = await (this.prisma as any).customerReceipt.findFirst({
        where: { id, tenantId: params.tenantId },
        select: { id: true, createdById: true },
      });
      if (!receipt) return;

      const tenantControls = await (this.prisma as any).tenant.findUnique({
        where: { id: params.tenantId },
        select: { allowSelfPosting: true },
      });

      await this.sod.assertNoLifecycleConflict({
        req: params.req,
        tenantId: params.tenantId,
        realUserId: params.realUserId,
        actingAsUserId: params.actingAsUserId,
        delegationId: params.delegationId,
        actionType: 'POST',
        soDAction: 'AR_RECEIPT_POST',
        entityType: 'CUSTOMER_RECEIPT' as any,
        entityId: receipt.id,
        createdByUserId: receipt.createdById ?? undefined,
        allowSelfPosting: (tenantControls as any)?.allowSelfPosting ?? undefined,
        permissionUsed: attemptedPermission,
      });
      return;
    }

    if (requestSoDAction === 'PERIOD_CLOSE_APPROVE') {
      const items = await (this.prisma.accountingPeriodChecklist as any).findMany({
        where: { tenantId: params.tenantId, periodId: id, completed: true },
        select: { completedById: true },
      });
      const completedByIds = (items ?? [])
        .map((i: any) => i?.completedById)
        .filter(Boolean)
        .map((x: any) => String(x));

      const ctx: SoDCheckContext = {
        action: 'PERIOD_CLOSE_APPROVE',
        actorUserId: params.realUserId,
        entityType: 'ACCOUNTING_PERIOD',
        entityId: id,
        checklistCompletedByIds: completedByIds,
      };

      const res = evaluateSoD(ctx);
      if (!res.allowed) {
        await this.prisma.accountingPeriodCloseLog
          .create({
            data: {
              tenantId: params.tenantId,
              periodId: id,
              userId: params.realUserId,
              action: 'PERIOD_CLOSE',
              outcome: 'DENIED_SOD',
              message: res.reason,
            },
          })
          .catch(() => undefined);

        await this.sod.assertNoLifecycleConflict({
          req: params.req,
          tenantId: params.tenantId,
          realUserId: params.realUserId,
          actingAsUserId: params.actingAsUserId,
          delegationId: params.delegationId,
          actionType: 'APPROVE',
          soDAction: 'PERIOD_CLOSE_APPROVE',
          entityType: 'ACCOUNTING_PERIOD' as any,
          entityId: id,
          checklistCompletedByIds: completedByIds,
          permissionUsed: attemptedPermission,
        });
      }
      return;
    }

    if (
      requestSoDAction === 'GL_JOURNAL_REVIEW' ||
      requestSoDAction === 'GL_JOURNAL_REJECT' ||
      requestSoDAction === 'GL_JOURNAL_POST' ||
      requestSoDAction === 'GL_JOURNAL_RETURN_TO_REVIEW' ||
      requestSoDAction === 'GL_JOURNAL_REVERSE'
    ) {
      const entry: any = await this.prisma.journalEntry.findFirst({
        where: { id, tenantId: params.tenantId },
        select: {
          id: true,
          createdById: true,
          submittedById: true,
          reviewedById: true,
          journalType: true,
          reversalOfId: true,
          reversalInitiatedById: true,
        } as any,
      });
      if (!entry) return;

      if (requestSoDAction === 'GL_JOURNAL_REVERSE') {
        await this.sod.assertNoLifecycleConflict({
          req: params.req,
          tenantId: params.tenantId,
          realUserId: params.realUserId,
          actingAsUserId: params.actingAsUserId,
          delegationId: params.delegationId,
          actionType: 'REVERSE',
          soDAction: 'GL_JOURNAL_REVERSE',
          entityType: 'JOURNAL_ENTRY' as any,
          entityId: entry.id,
          createdByUserId: entry.createdById ?? undefined,
          permissionUsed: attemptedPermission,
        });
        return;
      }

      const reversalInitiatedById =
        entry.journalType === 'REVERSING' && !!(entry as any).reversalOfId
          ? ((entry as any).reversalInitiatedById ?? entry.createdById ?? null)
          : null;

      const actionType =
        requestSoDAction === 'GL_JOURNAL_POST'
          ? 'POST'
          : requestSoDAction === 'GL_JOURNAL_REVIEW'
            ? 'REVIEW'
            : requestSoDAction === 'GL_JOURNAL_REJECT'
              ? 'REJECT'
              : requestSoDAction === 'GL_JOURNAL_RETURN_TO_REVIEW'
                ? 'RETURN_TO_REVIEW'
                : 'POST';

      await this.sod.assertNoLifecycleConflict({
        req: params.req,
        tenantId: params.tenantId,
        realUserId: params.realUserId,
        actingAsUserId: params.actingAsUserId,
        delegationId: params.delegationId,
        actionType: actionType as any,
        soDAction: requestSoDAction,
        entityType: 'JOURNAL_ENTRY' as any,
        entityId: entry.id,
        createdByUserId: (entry as any).createdById ?? undefined,
        submittedByUserId: (entry as any).submittedById ?? undefined,
        reviewedByUserId: (entry as any).reviewedById ?? undefined,
        reversalInitiatedByUserId: reversalInitiatedById ? String(reversalInitiatedById) : undefined,
        permissionUsed: attemptedPermission,
      });
      return;
    }

    const lifecycleAction = resolveLifecycleActionFromPermission(attemptedPermission);
    if (!lifecycleAction) return;

    if (
      attemptedPermission === PERMISSIONS.AP.INVOICE_APPROVE ||
      attemptedPermission === PERMISSIONS.AP.INVOICE_POST
    ) {
      const inv = await this.prisma.supplierInvoice.findFirst({
        where: { id, tenantId: params.tenantId },
        select: { id: true, createdById: true, approvedById: true },
      });
      if (!inv) return;

      await this.sod.assertNoLifecycleConflict({
        req: params.req,
        tenantId: params.tenantId,
        realUserId: params.realUserId,
        actingAsUserId: params.actingAsUserId,
        delegationId: params.delegationId,
        actionType: lifecycleAction,
        soDAction: lifecycleAction,
        entityType: 'SUPPLIER_INVOICE' as any,
        entityId: inv.id,
        createdByUserId: inv.createdById ?? undefined,
        approvedByUserId: inv.approvedById ?? undefined,
        permissionUsed: attemptedPermission,
      });
      return;
    }

    if (attemptedPermission === PERMISSIONS.PAYMENT.APPROVE || attemptedPermission === PERMISSIONS.PAYMENT.POST) {
      const p = await this.prisma.payment.findFirst({
        where: { id, tenantId: params.tenantId },
        select: { id: true, createdById: true, approvedById: true },
      });
      if (!p) return;

      await this.sod.assertNoLifecycleConflict({
        req: params.req,
        tenantId: params.tenantId,
        realUserId: params.realUserId,
        actingAsUserId: params.actingAsUserId,
        delegationId: params.delegationId,
        actionType: lifecycleAction,
        soDAction: lifecycleAction,
        entityType: 'PAYMENT' as any,
        entityId: p.id,
        createdByUserId: p.createdById ?? undefined,
        approvedByUserId: p.approvedById ?? undefined,
        permissionUsed: attemptedPermission,
      });
      return;
    }

    if (
      attemptedPermission === PERMISSIONS.AR.CREDIT_NOTE_APPROVE ||
      attemptedPermission === PERMISSIONS.AR.CREDIT_NOTE_POST ||
      attemptedPermission === PERMISSIONS.AR.CREDIT_NOTE_VOID
    ) {
      const cn = await (this.prisma as any).customerCreditNote.findFirst({
        where: { id, tenantId: params.tenantId },
        select: { id: true, createdById: true, approvedById: true, postedById: true },
      });
      if (!cn) return;

      await this.sod.assertNoLifecycleConflict({
        req: params.req,
        tenantId: params.tenantId,
        realUserId: params.realUserId,
        actingAsUserId: params.actingAsUserId,
        delegationId: params.delegationId,
        actionType: lifecycleAction,
        soDAction: lifecycleAction,
        entityType: 'CUSTOMER_CREDIT_NOTE' as any,
        entityId: cn.id,
        createdByUserId: cn.createdById ?? undefined,
        approvedByUserId: cn.approvedById ?? undefined,
        postedByUserId: cn.postedById ?? undefined,
        permissionUsed: attemptedPermission,
      });
      return;
    }
  }

  private async logSoDBlocked(params: {
    tenantId: string;
    userId: string;
    ctx: SoDCheckContext;
    permissionAttempted: string;
    conflictingPermission: string;
    ruleCode?: string;
    reason?: string;
  }) {
    await this.prisma.soDViolationLog
      .create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          permissionAttempted: params.permissionAttempted,
          conflictingPermission: params.conflictingPermission,
        },
      })
      .catch(() => undefined);

    await this.prisma.auditEvent
      .create({
        data: {
          tenantId: params.tenantId,
          eventType: 'SOD_VIOLATION' as any,
          entityType: params.ctx.entityType as any,
          entityId: params.ctx.entityId,
          action: params.permissionAttempted,
          outcome: 'BLOCKED' as any,
          reason: params.ruleCode
            ? `${params.reason ?? 'SoD violation'} (${params.ruleCode})`
            : params.reason ?? 'SoD violation',
          userId: params.userId,
          permissionUsed: params.permissionAttempted,
        },
      })
      .catch(() => undefined);
  }

  private async findSoDConflict(params: {
    tenantId: string;
    userId: string;
    requiredPermissions: string[];
    userPermissionCodes: Set<string>;
  }): Promise<null | {
    permissionAttempted: string;
    conflictingPermission: string;
  }> {
    const skipRulePairs = new Set([
      `${PERMISSIONS.GL.POST}|${PERMISSIONS.GL.APPROVE}`,
      `${PERMISSIONS.GL.APPROVE}|${PERMISSIONS.GL.POST}`,
    ]);

    const relevantRules = await this.prisma.soDRule.findMany({
      where: {
        tenantId: params.tenantId,
        OR: [
          { forbiddenPermissionA: { in: params.requiredPermissions } },
          { forbiddenPermissionB: { in: params.requiredPermissions } },
        ],
      },
      select: {
        forbiddenPermissionA: true,
        forbiddenPermissionB: true,
      },
    });

    for (const attempted of params.requiredPermissions) {
      for (const rule of relevantRules) {
        if (
          skipRulePairs.has(
            `${rule.forbiddenPermissionA}|${rule.forbiddenPermissionB}`,
          )
        ) {
          continue;
        }

        if (
          rule.forbiddenPermissionA === attempted &&
          params.userPermissionCodes.has(rule.forbiddenPermissionB)
        ) {
          return {
            permissionAttempted: attempted,
            conflictingPermission: rule.forbiddenPermissionB,
          };
        }

        if (
          rule.forbiddenPermissionB === attempted &&
          params.userPermissionCodes.has(rule.forbiddenPermissionA)
        ) {
          return {
            permissionAttempted: attempted,
            conflictingPermission: rule.forbiddenPermissionA,
          };
        }
      }
    }

    return null;
  }
}
