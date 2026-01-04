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
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PaymentsService = class PaymentsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createPayment(req, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        this.assertAllocations(dto.allocations, dto.amount);
        if (dto.type !== 'SUPPLIER_PAYMENT' && dto.type !== 'CUSTOMER_RECEIPT') {
            throw new common_1.BadRequestException('Invalid payment type');
        }
        const bankAccount = await this.prisma.bankAccount.findFirst({
            where: { id: dto.bankAccountId, tenantId: tenant.id, isActive: true },
            select: { id: true, glAccountId: true },
        });
        if (!bankAccount) {
            throw new common_1.BadRequestException('Bank account not found or inactive');
        }
        for (const a of dto.allocations) {
            if (dto.type === 'SUPPLIER_PAYMENT' &&
                a.sourceType !== 'SUPPLIER_INVOICE') {
                throw new common_1.BadRequestException('Supplier payment allocations must reference SUPPLIER_INVOICE');
            }
            if (dto.type === 'CUSTOMER_RECEIPT' &&
                a.sourceType !== 'CUSTOMER_INVOICE') {
                throw new common_1.BadRequestException('Customer receipt allocations must reference CUSTOMER_INVOICE');
            }
        }
        if (dto.type === 'SUPPLIER_PAYMENT') {
            const ids = dto.allocations.map((a) => a.sourceId);
            const invoices = await this.prisma.supplierInvoice.findMany({
                where: { tenantId: tenant.id, id: { in: ids }, status: 'POSTED' },
                select: { id: true, totalAmount: true },
            });
            const map = new Map(invoices.map((i) => [i.id, i]));
            for (const a of dto.allocations) {
                const inv = map.get(a.sourceId);
                if (!inv) {
                    throw new common_1.BadRequestException(`Supplier invoice not found or not POSTED: ${a.sourceId}`);
                }
                if (Number(a.amount) > Number(inv.totalAmount)) {
                    throw new common_1.BadRequestException(`Allocation exceeds supplier invoice total: ${a.sourceId}`);
                }
            }
        }
        if (dto.type === 'CUSTOMER_RECEIPT') {
            const ids = dto.allocations.map((a) => a.sourceId);
            const invoices = await this.prisma.customerInvoice.findMany({
                where: { tenantId: tenant.id, id: { in: ids }, status: 'POSTED' },
                select: { id: true, totalAmount: true },
            });
            const map = new Map(invoices.map((i) => [i.id, i]));
            for (const a of dto.allocations) {
                const inv = map.get(a.sourceId);
                if (!inv) {
                    throw new common_1.BadRequestException(`Customer invoice not found or not POSTED: ${a.sourceId}`);
                }
                if (Number(a.amount) > Number(inv.totalAmount)) {
                    throw new common_1.BadRequestException(`Allocation exceeds customer invoice total: ${a.sourceId}`);
                }
            }
        }
        return this.prisma.payment.create({
            data: {
                tenantId: tenant.id,
                type: dto.type,
                bankAccountId: dto.bankAccountId,
                amount: dto.amount,
                paymentDate: new Date(dto.paymentDate),
                reference: dto.reference,
                createdById: user.id,
                allocations: {
                    create: dto.allocations.map((a) => ({
                        sourceType: a.sourceType,
                        sourceId: a.sourceId,
                        amount: a.amount,
                    })),
                },
            },
            include: { allocations: true, bankAccount: true },
        });
    }
    async approvePayment(req, id) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const p = await this.prisma.payment.findFirst({
            where: { id, tenantId: tenant.id },
            select: { id: true, status: true, createdById: true },
        });
        if (!p) {
            throw new common_1.NotFoundException('Payment not found');
        }
        if (p.status !== 'DRAFT') {
            throw new common_1.BadRequestException('Only DRAFT payments can be approved');
        }
        if (p.createdById === user.id) {
            await this.prisma.soDViolationLog.create({
                data: {
                    tenantId: tenant.id,
                    userId: user.id,
                    permissionAttempted: 'PAYMENT_APPROVE',
                    conflictingPermission: 'PAYMENT_CREATE',
                },
            });
            throw new common_1.ForbiddenException({
                error: 'Action blocked by Segregation of Duties (SoD)',
                reason: 'Creator cannot approve own payment',
            });
        }
        return this.prisma.payment.update({
            where: { id: p.id },
            data: {
                status: 'APPROVED',
                approvedById: user.id,
                approvedAt: new Date(),
            },
            include: { allocations: true, bankAccount: true },
        });
    }
    async postPayment(req, id, opts) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const p = await this.prisma.payment.findFirst({
            where: { id, tenantId: tenant.id },
            include: { allocations: true, bankAccount: true },
        });
        if (!p) {
            throw new common_1.NotFoundException('Payment not found');
        }
        if (p.status === 'POSTED') {
            throw new common_1.BadRequestException('Payment is already posted');
        }
        if (p.status !== 'APPROVED') {
            throw new common_1.BadRequestException('Only APPROVED payments can be posted');
        }
        if (!p.approvedById) {
            throw new common_1.BadRequestException('Payment must have an approver before posting');
        }
        if (p.approvedById === user.id) {
            await this.prisma.soDViolationLog.create({
                data: {
                    tenantId: tenant.id,
                    userId: user.id,
                    permissionAttempted: 'PAYMENT_POST',
                    conflictingPermission: 'PAYMENT_APPROVE',
                },
            });
            throw new common_1.ForbiddenException({
                error: 'Action blocked by Segregation of Duties (SoD)',
                reason: 'Approver cannot post the same payment',
            });
        }
        if (p.createdById === user.id) {
            await this.prisma.soDViolationLog.create({
                data: {
                    tenantId: tenant.id,
                    userId: user.id,
                    permissionAttempted: 'PAYMENT_POST',
                    conflictingPermission: 'PAYMENT_CREATE',
                },
            });
            throw new common_1.ForbiddenException({
                error: 'Action blocked by Segregation of Duties (SoD)',
                reason: 'Creator cannot post own payment',
            });
        }
        this.assertAllocations(p.allocations.map((a) => ({
            sourceType: a.sourceType,
            sourceId: a.sourceId,
            amount: Number(a.amount),
        })), Number(p.amount));
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                startDate: { lte: p.paymentDate },
                endDate: { gte: p.paymentDate },
            },
            select: { id: true, status: true, name: true },
        });
        if (!period || period.status !== 'OPEN') {
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by accounting period control',
                reason: !period
                    ? 'No accounting period exists for the payment date'
                    : `Accounting period is not OPEN: ${period.name}`,
            });
        }
        if (period.name === 'Opening Balances') {
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by opening balances control period',
                reason: 'Operational postings are not allowed in the Opening Balances period',
            });
        }
        const cutoverLocked = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                name: 'Opening Balances',
                status: 'CLOSED',
            },
            orderBy: { startDate: 'desc' },
            select: { startDate: true },
        });
        if (cutoverLocked && p.paymentDate < cutoverLocked.startDate) {
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by cutover lock',
                reason: `Posting dated before cutover is not allowed (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`,
            });
        }
        const bankGl = await this.prisma.account.findFirst({
            where: {
                tenantId: tenant.id,
                id: p.bankAccount.glAccountId,
                isActive: true,
                type: 'ASSET',
            },
            select: { id: true },
        });
        if (!bankGl) {
            throw new common_1.BadRequestException('Bank GL account not found or invalid');
        }
        const apCode = opts?.apControlAccountCode ?? '2000';
        const arCode = opts?.arControlAccountCode ?? '1100';
        let journalLines;
        if (p.type === 'SUPPLIER_PAYMENT') {
            const apAccount = await this.prisma.account.findFirst({
                where: {
                    tenantId: tenant.id,
                    code: apCode,
                    isActive: true,
                    type: 'LIABILITY',
                },
                select: { id: true },
            });
            if (!apAccount) {
                throw new common_1.BadRequestException(`AP control account not found or invalid: ${apCode}`);
            }
            journalLines = [
                { accountId: apAccount.id, debit: p.amount, credit: 0 },
                { accountId: bankGl.id, debit: 0, credit: p.amount },
            ];
        }
        else if (p.type === 'CUSTOMER_RECEIPT') {
            const arAccount = await this.prisma.account.findFirst({
                where: {
                    tenantId: tenant.id,
                    code: arCode,
                    isActive: true,
                    type: 'ASSET',
                },
                select: { id: true },
            });
            if (!arAccount) {
                throw new common_1.BadRequestException(`AR control account not found or invalid: ${arCode}`);
            }
            journalLines = [
                { accountId: bankGl.id, debit: p.amount, credit: 0 },
                { accountId: arAccount.id, debit: 0, credit: p.amount },
            ];
        }
        else {
            throw new common_1.BadRequestException('Invalid payment type');
        }
        const journal = await this.prisma.journalEntry.create({
            data: {
                tenantId: tenant.id,
                journalDate: p.paymentDate,
                reference: `PAYMENT:${p.id}`,
                description: `Payment posting: ${p.id}`,
                createdById: p.createdById,
                lines: {
                    create: journalLines.map((l) => ({
                        accountId: l.accountId,
                        debit: l.debit,
                        credit: l.credit,
                    })),
                },
            },
            include: { lines: true },
        });
        const postedJournal = await this.prisma.journalEntry.update({
            where: { id: journal.id },
            data: {
                status: 'POSTED',
                postedById: user.id,
                postedAt: new Date(),
            },
            include: { lines: true },
        });
        const updatedPayment = await this.prisma.payment.update({
            where: { id: p.id },
            data: {
                status: 'POSTED',
                postedById: user.id,
                postedAt: new Date(),
            },
            include: { allocations: true, bankAccount: true },
        });
        return { payment: updatedPayment, glJournal: postedJournal };
    }
    async listPayments(req) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        return this.prisma.payment.findMany({
            where: { tenantId: tenant.id },
            orderBy: { createdAt: 'desc' },
            include: { allocations: true, bankAccount: true },
        });
    }
    assertAllocations(allocations, amount) {
        if (!allocations || allocations.length < 1) {
            throw new common_1.BadRequestException('Payment must have at least 1 allocation');
        }
        for (const a of allocations) {
            if ((a.amount ?? 0) <= 0) {
                throw new common_1.BadRequestException('Allocation amount must be greater than zero');
            }
        }
        const round2 = (n) => Math.round(n * 100) / 100;
        const sum = round2(allocations.reduce((s, a) => s + (a.amount ?? 0), 0));
        const total = round2(amount ?? 0);
        if (sum !== total) {
            throw new common_1.BadRequestException({
                error: 'Allocations do not sum to payment amount',
                sum,
                amount: total,
            });
        }
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map