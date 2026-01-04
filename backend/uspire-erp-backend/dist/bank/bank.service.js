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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let BankService = class BankService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    prismaAny() {
        return this.prisma;
    }
    async createBankAccount(req, dto) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const glAccount = await this.prisma.account.findFirst({
            where: {
                id: dto.glAccountId,
                tenantId: tenant.id,
                isActive: true,
                type: 'ASSET',
            },
            select: { id: true },
        });
        if (!glAccount) {
            throw new common_1.BadRequestException('GL account must exist, be active, and be an ASSET (cash/bank)');
        }
        return this.prisma.bankAccount.create({
            data: {
                tenantId: tenant.id,
                name: dto.name,
                bankName: dto.bankName,
                accountNumber: dto.accountNumber,
                currency: dto.currency,
                glAccountId: dto.glAccountId,
                isActive: true,
            },
            include: { glAccount: true },
        });
    }
    async listBankAccounts(req) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        return this.prisma.bankAccount.findMany({
            where: { tenantId: tenant.id, isActive: true },
            orderBy: { name: 'asc' },
            include: { glAccount: true },
        });
    }
    async createStatement(req, dto) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const prisma = this.prismaAny();
        const bankAccount = await prisma.bankAccount.findFirst({
            where: { id: dto.bankAccountId, tenantId: tenant.id, isActive: true },
            select: { id: true },
        });
        if (!bankAccount) {
            throw new common_1.BadRequestException('Bank account not found or inactive');
        }
        return prisma.bankStatement.create({
            data: {
                tenantId: tenant.id,
                bankAccountId: dto.bankAccountId,
                statementDate: new Date(dto.statementDate),
                openingBalance: dto.openingBalance,
                closingBalance: dto.closingBalance,
            },
            include: { lines: true },
        });
    }
    async listStatements(req, dto) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const prisma = this.prismaAny();
        const bankAccount = await prisma.bankAccount.findFirst({
            where: { id: dto.bankAccountId, tenantId: tenant.id, isActive: true },
            select: { id: true },
        });
        if (!bankAccount) {
            throw new common_1.NotFoundException('Bank account not found');
        }
        return prisma.bankStatement.findMany({
            where: { tenantId: tenant.id, bankAccountId: dto.bankAccountId },
            orderBy: { statementDate: 'desc' },
            select: {
                id: true,
                bankAccountId: true,
                statementDate: true,
                openingBalance: true,
                closingBalance: true,
                createdAt: true,
            },
        });
    }
    async getStatement(req, id) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const prisma = this.prismaAny();
        const statement = await prisma.bankStatement.findFirst({
            where: { id, tenantId: tenant.id },
            select: {
                id: true,
                bankAccountId: true,
                statementDate: true,
                openingBalance: true,
                closingBalance: true,
                createdAt: true,
                lines: {
                    orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
                    select: {
                        id: true,
                        transactionDate: true,
                        description: true,
                        amount: true,
                        reference: true,
                        isReconciled: true,
                    },
                },
            },
        });
        if (!statement) {
            throw new common_1.NotFoundException('Bank statement not found');
        }
        return statement;
    }
    async addStatementLines(req, bankStatementId, dto) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const prisma = this.prismaAny();
        const statement = await prisma.bankStatement.findFirst({
            where: { id: bankStatementId, tenantId: tenant.id },
            select: { id: true },
        });
        if (!statement) {
            throw new common_1.NotFoundException('Bank statement not found');
        }
        const created = await prisma.bankStatementLine.createMany({
            data: dto.lines.map((l) => ({
                bankStatementId: statement.id,
                transactionDate: new Date(l.transactionDate),
                description: l.description,
                amount: l.amount,
                reference: l.reference,
            })),
        });
        return { createdCount: created.count };
    }
    async unmatched(req) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const prisma = this.prismaAny();
        const unreconciledPayments = await prisma.payment.findMany({
            where: {
                tenantId: tenant.id,
                status: 'POSTED',
                reconciliations: { none: {} },
            },
            orderBy: { paymentDate: 'desc' },
            select: {
                id: true,
                type: true,
                bankAccountId: true,
                amount: true,
                paymentDate: true,
                reference: true,
            },
        });
        const unreconciledStatementLines = await prisma.bankStatementLine.findMany({
            where: {
                isReconciled: false,
                bankStatement: { tenantId: tenant.id },
            },
            orderBy: { transactionDate: 'desc' },
            select: {
                id: true,
                transactionDate: true,
                description: true,
                amount: true,
                reference: true,
                bankStatement: {
                    select: { id: true, bankAccountId: true, statementDate: true },
                },
            },
        });
        return {
            unreconciledPayments,
            unreconciledStatementLines,
        };
    }
    async match(req, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const prisma = this.prismaAny();
        const [payment, line] = await Promise.all([
            prisma.payment.findFirst({
                where: { id: dto.paymentId, tenantId: tenant.id },
                select: {
                    id: true,
                    status: true,
                    bankAccountId: true,
                    amount: true,
                    paymentDate: true,
                },
            }),
            prisma.bankStatementLine.findFirst({
                where: {
                    id: dto.statementLineId,
                    bankStatement: { tenantId: tenant.id },
                },
                select: {
                    id: true,
                    amount: true,
                    isReconciled: true,
                    transactionDate: true,
                    bankStatement: { select: { id: true, bankAccountId: true } },
                },
            }),
        ]);
        if (!payment) {
            throw new common_1.NotFoundException('Payment not found');
        }
        if (!line) {
            throw new common_1.NotFoundException('Statement line not found');
        }
        if (payment.status !== 'POSTED') {
            throw new common_1.BadRequestException('Only POSTED payments can be reconciled');
        }
        if (line.isReconciled) {
            throw new common_1.BadRequestException('Statement line is already reconciled');
        }
        if (payment.bankAccountId !== line.bankStatement.bankAccountId) {
            throw new common_1.BadRequestException('Payment bank account does not match statement line bank account');
        }
        const paymentAmount = Number(payment.amount);
        const lineAmount = Number(line.amount);
        const round2 = (n) => Math.round(n * 100) / 100;
        if (round2(paymentAmount) !== round2(lineAmount)) {
            throw new common_1.BadRequestException({
                error: 'Amounts do not match (exact match required)',
                paymentAmount: round2(paymentAmount),
                statementLineAmount: round2(lineAmount),
            });
        }
        const [paymentPeriod, linePeriod] = await Promise.all([
            prisma.accountingPeriod.findFirst({
                where: {
                    tenantId: tenant.id,
                    startDate: { lte: payment.paymentDate },
                    endDate: { gte: payment.paymentDate },
                },
                select: { id: true, status: true, name: true },
            }),
            prisma.accountingPeriod.findFirst({
                where: {
                    tenantId: tenant.id,
                    startDate: { lte: line.transactionDate },
                    endDate: { gte: line.transactionDate },
                },
                select: { id: true, status: true, name: true },
            }),
        ]);
        if (!paymentPeriod || paymentPeriod.status !== 'OPEN') {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'BANK_RECONCILIATION_MATCH',
                    entityType: 'BANK_RECONCILIATION_MATCH',
                    entityId: dto.statementLineId,
                    action: 'BANK_RECONCILE',
                    outcome: 'BLOCKED',
                    reason: !paymentPeriod
                        ? 'No accounting period exists for the payment date'
                        : `Accounting period is not OPEN for payment date: ${paymentPeriod.name}`,
                    userId: user.id,
                    permissionUsed: 'BANK_RECONCILE',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Reconciliation blocked by accounting period control',
                reason: !paymentPeriod
                    ? 'No accounting period exists for the payment date'
                    : `Accounting period is not OPEN for payment date: ${paymentPeriod.name}`,
            });
        }
        if (!linePeriod || linePeriod.status !== 'OPEN') {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'BANK_RECONCILIATION_MATCH',
                    entityType: 'BANK_RECONCILIATION_MATCH',
                    entityId: dto.statementLineId,
                    action: 'BANK_RECONCILE',
                    outcome: 'BLOCKED',
                    reason: !linePeriod
                        ? 'No accounting period exists for the statement transaction date'
                        : `Accounting period is not OPEN for statement date: ${linePeriod.name}`,
                    userId: user.id,
                    permissionUsed: 'BANK_RECONCILE',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Reconciliation blocked by accounting period control',
                reason: !linePeriod
                    ? 'No accounting period exists for the statement transaction date'
                    : `Accounting period is not OPEN for statement date: ${linePeriod.name}`,
            });
        }
        const now = new Date();
        try {
            const rec = await this.prisma.$transaction(async (tx) => {
                const createdRec = await tx.bankReconciliation.create({
                    data: {
                        tenantId: tenant.id,
                        bankAccountId: payment.bankAccountId,
                        paymentId: payment.id,
                        statementLineId: line.id,
                        reconciledAt: now,
                        reconciledBy: user.id,
                    },
                });
                await tx.bankStatementLine.update({
                    where: { id: line.id },
                    data: {
                        isReconciled: true,
                        reconciledAt: now,
                        reconciledBy: user.id,
                    },
                });
                return createdRec;
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'BANK_RECONCILIATION_MATCH',
                    entityType: 'BANK_RECONCILIATION_MATCH',
                    entityId: rec.id,
                    action: 'BANK_RECONCILE',
                    outcome: 'SUCCESS',
                    userId: user.id,
                    permissionUsed: 'BANK_RECONCILE',
                },
            })
                .catch(() => undefined);
            return { reconciliation: rec };
        }
        catch (e) {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'BANK_RECONCILIATION_MATCH',
                    entityType: 'BANK_RECONCILIATION_MATCH',
                    entityId: dto.statementLineId,
                    action: 'BANK_RECONCILE',
                    outcome: 'FAILED',
                    reason: e?.message,
                    userId: user.id,
                    permissionUsed: 'BANK_RECONCILE',
                },
            })
                .catch(() => undefined);
            throw new common_1.BadRequestException({
                error: 'Reconciliation failed (already reconciled?)',
                detail: e?.message,
            });
        }
    }
    async status(req, dto) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        const prisma = this.prismaAny();
        const bankAccount = await prisma.bankAccount.findFirst({
            where: { id: dto.bankAccountId, tenantId: tenant.id },
            select: { id: true },
        });
        if (!bankAccount) {
            throw new common_1.NotFoundException('Bank account not found');
        }
        const totalStatementLines = await prisma.bankStatementLine.count({
            where: {
                bankStatement: {
                    tenantId: tenant.id,
                    bankAccountId: dto.bankAccountId,
                },
            },
        });
        const reconciledCount = await prisma.bankStatementLine.count({
            where: {
                bankStatement: {
                    tenantId: tenant.id,
                    bankAccountId: dto.bankAccountId,
                },
                isReconciled: true,
            },
        });
        return {
            bankAccountId: dto.bankAccountId,
            totalStatementLines,
            reconciledCount,
            unreconciledCount: totalStatementLines - reconciledCount,
        };
    }
};
exports.BankService = BankService;
exports.BankService = BankService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BankService);
//# sourceMappingURL=bank.service.js.map