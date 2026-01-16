import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
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

    if (!tenant || !user) {
      throw new ForbiddenException('Missing tenant or user context');
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId: user.id,
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

    const codes = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        codes.add(rp.permission.code);
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
      actorUserId: user.id,
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
            eventType: 'SOD_VIOLATION',
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
            eventType: 'SOD_VIOLATION',
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
    actorUserId: string;
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

      const ctx: SoDCheckContext = {
        action: 'PERIOD_CORRECT_POSTED',
        actorUserId: params.actorUserId,
        entityType: 'ACCOUNTING_PERIOD',
        entityId: period.id,
        createdById: period.createdById ?? undefined,
      };

      const res = evaluateSoD(ctx);
      if (!res.allowed) {
        await this.logSoDBlocked({
          tenantId: params.tenantId,
          userId: params.actorUserId,
          ctx,
          permissionAttempted: attemptedPermission,
          conflictingPermission: PERMISSIONS.PERIOD.CREATE,
          ruleCode: res.ruleCode,
          reason: res.reason,
        });
        throw new ForbiddenException({
          error: 'Action blocked by Segregation of Duties (SoD)',
          reason: res.reason,
          ruleCode: res.ruleCode,
        });
      }
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

      const ctx: SoDCheckContext = {
        action: 'AR_RECEIPT_POST',
        actorUserId: params.actorUserId,
        entityType: 'CUSTOMER_RECEIPT',
        entityId: receipt.id,
        createdById: receipt.createdById ?? undefined,
        allowSelfPosting: (tenantControls as any)?.allowSelfPosting ?? undefined,
      };

      const res = evaluateSoD(ctx);
      if (!res.allowed) {
        await this.logSoDBlocked({
          tenantId: params.tenantId,
          userId: params.actorUserId,
          ctx,
          permissionAttempted: attemptedPermission,
          conflictingPermission: PERMISSIONS.AR.RECEIPT_CREATE,
          ruleCode: res.ruleCode,
          reason: res.reason,
        });
        throw new ForbiddenException({
          error: 'Action blocked by Segregation of Duties (SoD)',
          reason: res.reason,
          ruleCode: res.ruleCode,
        });
      }
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
        actorUserId: params.actorUserId,
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
              userId: params.actorUserId,
              action: 'PERIOD_CLOSE',
              outcome: 'DENIED_SOD',
              message: res.reason,
            },
          })
          .catch(() => undefined);

        await this.logSoDBlocked({
          tenantId: params.tenantId,
          userId: params.actorUserId,
          ctx,
          permissionAttempted: attemptedPermission,
          conflictingPermission: PERMISSIONS.PERIOD.CHECKLIST_COMPLETE,
          ruleCode: res.ruleCode,
          reason: res.reason,
        });
        throw new ForbiddenException({
          error: 'Action blocked by Segregation of Duties (SoD)',
          reason: res.reason,
          ruleCode: res.ruleCode,
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
        const ctx: SoDCheckContext = {
          action: 'GL_JOURNAL_REVERSE',
          actorUserId: params.actorUserId,
          entityType: 'JOURNAL_ENTRY',
          entityId: entry.id,
          createdById: entry.createdById ?? undefined,
        };

        const res = evaluateSoD(ctx);
        if (!res.allowed) {
          await this.logSoDBlocked({
            tenantId: params.tenantId,
            userId: params.actorUserId,
            ctx,
            permissionAttempted: attemptedPermission,
            conflictingPermission: PERMISSIONS.GL.CREATE,
            ruleCode: res.ruleCode,
            reason: res.reason,
          });
          throw new ForbiddenException({
            error: 'Action blocked by Segregation of Duties (SoD)',
            reason: res.reason,
            ruleCode: res.ruleCode,
          });
        }
        return;
      }

      const reversalInitiatedById =
        entry.journalType === 'REVERSING' && !!(entry as any).reversalOfId
          ? ((entry as any).reversalInitiatedById ?? entry.createdById ?? null)
          : null;

      const ctx: SoDCheckContext = {
        action: requestSoDAction,
        actorUserId: params.actorUserId,
        entityType: 'JOURNAL_ENTRY',
        entityId: entry.id,
        createdById: (entry as any).createdById ?? undefined,
        submittedById: (entry as any).submittedById ?? undefined,
        reviewedById: (entry as any).reviewedById ?? undefined,
        reversalInitiatedById: reversalInitiatedById ? String(reversalInitiatedById) : undefined,
      };

      const res = evaluateSoD(ctx);
      if (!res.allowed) {
        const conflictingPermission =
          requestSoDAction === 'GL_JOURNAL_POST' || requestSoDAction === 'GL_JOURNAL_RETURN_TO_REVIEW'
            ? PERMISSIONS.GL.VIEW
            : PERMISSIONS.GL.CREATE;

        await this.logSoDBlocked({
          tenantId: params.tenantId,
          userId: params.actorUserId,
          ctx,
          permissionAttempted: attemptedPermission,
          conflictingPermission,
          ruleCode: res.ruleCode,
          reason: res.reason,
        });
        throw new ForbiddenException({
          error: 'Action blocked by Segregation of Duties (SoD)',
          reason: res.reason,
          ruleCode: res.ruleCode,
        });
      }
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

      const ctx: SoDCheckContext = {
        action: lifecycleAction,
        actorUserId: params.actorUserId,
        entityType: 'SUPPLIER_INVOICE',
        entityId: inv.id,
        createdById: inv.createdById ?? undefined,
        approvedById: inv.approvedById ?? undefined,
      };

      const res = evaluateSoD(ctx);
      if (!res.allowed) {
        const conflictingPermission =
          res.ruleCode === 'SOD_APPROVER_CANNOT_POST'
            ? PERMISSIONS.AP.INVOICE_APPROVE
            : PERMISSIONS.AP.INVOICE_CREATE;

        await this.logSoDBlocked({
          tenantId: params.tenantId,
          userId: params.actorUserId,
          ctx,
          permissionAttempted: attemptedPermission,
          conflictingPermission,
          ruleCode: res.ruleCode,
          reason: res.reason,
        });
        throw new ForbiddenException({
          error: 'Action blocked by Segregation of Duties (SoD)',
          reason: res.reason,
          ruleCode: res.ruleCode,
        });
      }
      return;
    }

    if (attemptedPermission === PERMISSIONS.PAYMENT.APPROVE || attemptedPermission === PERMISSIONS.PAYMENT.POST) {
      const p = await this.prisma.payment.findFirst({
        where: { id, tenantId: params.tenantId },
        select: { id: true, createdById: true, approvedById: true },
      });
      if (!p) return;

      const ctx: SoDCheckContext = {
        action: lifecycleAction,
        actorUserId: params.actorUserId,
        entityType: 'PAYMENT',
        entityId: p.id,
        createdById: p.createdById ?? undefined,
        approvedById: p.approvedById ?? undefined,
      };

      const res = evaluateSoD(ctx);
      if (!res.allowed) {
        const conflictingPermission =
          res.ruleCode === 'SOD_APPROVER_CANNOT_POST'
            ? PERMISSIONS.PAYMENT.APPROVE
            : PERMISSIONS.PAYMENT.CREATE;

        await this.logSoDBlocked({
          tenantId: params.tenantId,
          userId: params.actorUserId,
          ctx,
          permissionAttempted: attemptedPermission,
          conflictingPermission,
          ruleCode: res.ruleCode,
          reason: res.reason,
        });
        throw new ForbiddenException({
          error: 'Action blocked by Segregation of Duties (SoD)',
          reason: res.reason,
          ruleCode: res.ruleCode,
        });
      }
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

      const ctx: SoDCheckContext = {
        action: lifecycleAction,
        actorUserId: params.actorUserId,
        entityType: 'CUSTOMER_CREDIT_NOTE',
        entityId: cn.id,
        createdById: cn.createdById ?? undefined,
        approvedById: cn.approvedById ?? undefined,
        postedById: cn.postedById ?? undefined,
      };

      const res = evaluateSoD(ctx);
      if (!res.allowed) {
        const conflictingPermission =
          res.ruleCode === 'SOD_APPROVER_CANNOT_POST'
            ? PERMISSIONS.AR.CREDIT_NOTE_APPROVE
            : res.ruleCode === 'SOD_POSTER_CANNOT_VOID'
              ? PERMISSIONS.AR.CREDIT_NOTE_POST
              : PERMISSIONS.AR.CREDIT_NOTE_CREATE;

        await this.logSoDBlocked({
          tenantId: params.tenantId,
          userId: params.actorUserId,
          ctx,
          permissionAttempted: attemptedPermission,
          conflictingPermission,
          ruleCode: res.ruleCode,
          reason: res.reason,
        });
        throw new ForbiddenException({
          error: 'Action blocked by Segregation of Duties (SoD)',
          reason: res.reason,
          ruleCode: res.ruleCode,
        });
      }
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
