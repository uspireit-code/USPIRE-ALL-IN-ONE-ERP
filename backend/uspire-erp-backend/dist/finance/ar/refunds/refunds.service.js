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
exports.FinanceArRefundsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const gl_service_1 = require("../../../gl/gl.service");
const accounting_period_guard_1 = require("../../common/accounting-period.guard");
const resolve_ar_control_account_1 = require("../../common/resolve-ar-control-account");
let FinanceArRefundsService = class FinanceArRefundsService {
    prisma;
    gl;
    REFUND_NUMBER_SEQUENCE_NAME = 'AR_REFUND_NUMBER';
    constructor(prisma, gl) {
        this.prisma = prisma;
        this.gl = gl;
    }
    round2(n) {
        return Math.round(Number(n ?? 0) * 100) / 100;
    }
    normalizeMoney(n) {
        return this.round2(Number(n ?? 0));
    }
    ensureTenant(req) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        return tenant;
    }
    ensureUser(req) {
        const user = req.user;
        if (!user)
            throw new common_1.BadRequestException('Missing user context');
        return user;
    }
    parseYmdToDateOrNull(s) {
        const v = String(s ?? '').trim();
        if (!v)
            return null;
        const d = new Date(v);
        if (Number.isNaN(d.getTime()))
            return null;
        return d;
    }
    async nextRefundNumber(tx, tenantId) {
        const counter = await tx.tenantSequenceCounter.upsert({
            where: {
                tenantId_name: {
                    tenantId,
                    name: this.REFUND_NUMBER_SEQUENCE_NAME,
                },
            },
            create: {
                tenantId,
                name: this.REFUND_NUMBER_SEQUENCE_NAME,
                value: 0,
            },
            update: {},
            select: { id: true },
        });
        const bumped = await tx.tenantSequenceCounter.update({
            where: { id: counter.id },
            data: { value: { increment: 1 } },
            select: { value: true },
        });
        return String(bumped.value);
    }
    async computeCreditNoteRefundable(params) {
        const cn = await this.prisma.customerCreditNote.findFirst({
            where: { tenantId: params.tenantId, id: params.creditNoteId },
            select: {
                id: true,
                status: true,
                currency: true,
                totalAmount: true,
                customerId: true,
                creditNoteNumber: true,
                creditNoteDate: true,
            },
        });
        if (!cn)
            throw new common_1.NotFoundException('Credit note not found');
        if (String(cn.status) !== 'POSTED') {
            throw new common_1.BadRequestException(`Refund requires a POSTED credit note (status: ${cn.status})`);
        }
        const total = this.normalizeMoney(Number(cn.totalAmount ?? 0));
        const postedRefundAgg = await this.prisma.customerRefund.aggregate({
            where: {
                tenantId: params.tenantId,
                creditNoteId: params.creditNoteId,
                status: 'POSTED',
            },
            _sum: { amount: true },
        });
        const refunded = this.normalizeMoney(Number(postedRefundAgg?._sum?.amount ?? 0));
        const refundable = this.normalizeMoney(total - refunded);
        return {
            creditNote: {
                id: cn.id,
                creditNoteNumber: String(cn.creditNoteNumber ?? '').trim(),
                creditNoteDate: cn.creditNoteDate,
                customerId: cn.customerId,
                currency: String(cn.currency ?? '').trim(),
                totalAmount: total,
            },
            refunded,
            refundable,
        };
    }
    async resolveClearingAccountId(params) {
        if (params.paymentMethod === 'BANK') {
            if (params.bankAccountId) {
                const ba = await this.prisma.bankAccount.findFirst({
                    where: {
                        tenantId: params.tenantId,
                        id: params.bankAccountId,
                        isActive: true,
                    },
                    select: { glAccountId: true },
                });
                if (!ba) {
                    throw new common_1.BadRequestException('Bank account not found or inactive');
                }
                const bankGl = await this.prisma.account.findFirst({
                    where: {
                        tenantId: params.tenantId,
                        id: ba.glAccountId,
                        isActive: true,
                        type: 'ASSET',
                    },
                    select: { id: true },
                });
                if (!bankGl) {
                    throw new common_1.BadRequestException('Bank GL account not found or invalid');
                }
                return bankGl.id;
            }
            const tenantControls = await this.prisma.tenant.findUnique({
                where: { id: params.tenantId },
                select: { defaultBankClearingAccountId: true },
            });
            const bankClearingAccountId = (tenantControls?.defaultBankClearingAccountId ?? null);
            if (!bankClearingAccountId) {
                throw new common_1.BadRequestException({
                    error: 'Missing configuration: default bank clearing account',
                    field: 'Tenant.defaultBankClearingAccountId',
                });
            }
            const bankAccount = await this.prisma.account.findFirst({
                where: {
                    tenantId: params.tenantId,
                    id: bankClearingAccountId,
                    isActive: true,
                    type: 'ASSET',
                },
                select: { id: true },
            });
            if (!bankAccount) {
                throw new common_1.BadRequestException('Configured bank clearing GL account not found or invalid');
            }
            return bankAccount.id;
        }
        const tenantControls = await this.prisma.tenant.findUnique({
            where: { id: params.tenantId },
            select: { cashClearingAccountId: true },
        });
        const cashClearingAccountId = (tenantControls?.cashClearingAccountId ?? null);
        if (!cashClearingAccountId) {
            throw new common_1.BadRequestException({
                error: 'Missing configuration: cash clearing account',
                field: 'Tenant.cashClearingAccountId',
            });
        }
        const cashAccount = await this.prisma.account.findFirst({
            where: {
                tenantId: params.tenantId,
                id: cashClearingAccountId,
                isActive: true,
                type: 'ASSET',
            },
            select: { id: true },
        });
        if (!cashAccount) {
            throw new common_1.BadRequestException('Configured cash clearing GL account not found or invalid');
        }
        return cashAccount.id;
    }
    async create(req, dto) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const refundDate = this.parseYmdToDateOrNull(dto.refundDate);
        if (!refundDate)
            throw new common_1.BadRequestException('refundDate is invalid');
        const paymentMethod = String(dto.paymentMethod ?? '').trim().toUpperCase();
        if (paymentMethod !== 'BANK' && paymentMethod !== 'CASH') {
            throw new common_1.BadRequestException('paymentMethod must be BANK or CASH');
        }
        const amount = this.normalizeMoney(Number(dto.amount));
        if (!(amount > 0))
            throw new common_1.BadRequestException('amount must be > 0');
        const exchangeRate = Number(dto.exchangeRate ?? 1);
        if (!(exchangeRate > 0))
            throw new common_1.BadRequestException('exchangeRate must be > 0');
        const created = await this.prisma.$transaction(async (tx) => {
            const refundNumber = await this.nextRefundNumber(tx, tenant.id);
            return tx.customerRefund.create({
                data: {
                    tenantId: tenant.id,
                    refundNumber,
                    refundDate,
                    customerId: dto.customerId,
                    creditNoteId: dto.creditNoteId,
                    currency: dto.currency,
                    exchangeRate,
                    amount,
                    paymentMethod,
                    bankAccountId: dto.bankAccountId ?? null,
                    status: 'DRAFT',
                    createdById: user.id,
                },
            });
        });
        return created;
    }
    async approve(req, id, _dto) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const refund = await this.prisma.customerRefund.findFirst({
            where: { id, tenantId: tenant.id },
        });
        if (!refund)
            throw new common_1.NotFoundException('Refund not found');
        if (String(refund.status) !== 'DRAFT') {
            throw new common_1.BadRequestException(`Refund cannot be approved from status: ${refund.status}`);
        }
        const refundDate = new Date(refund.refundDate);
        try {
            await (0, accounting_period_guard_1.assertPeriodIsOpen)({
                prisma: this.prisma,
                tenantId: tenant.id,
                date: refundDate,
                action: 'create',
                documentLabel: 'Refund',
                dateLabel: 'refund date',
            });
        }
        catch {
            throw new common_1.ForbiddenException('Cannot approve in a closed period');
        }
        const refundable = await this.computeCreditNoteRefundable({
            tenantId: tenant.id,
            creditNoteId: String(refund.creditNoteId ?? ''),
        });
        const amount = this.normalizeMoney(Number(refund.amount ?? 0));
        if (amount > refundable.refundable) {
            throw new common_1.ConflictException('Refund amount exceeds available credit balance');
        }
        await this.prisma.customerRefund.update({
            where: { id: refund.id },
            data: {
                status: 'APPROVED',
                approvedById: user.id,
                approvedAt: new Date(),
            },
        });
        return this.prisma.customerRefund.findFirst({
            where: { id: refund.id, tenantId: tenant.id },
        });
    }
    async post(req, id) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const now = new Date();
        const refund = await this.prisma.customerRefund.findFirst({
            where: { id, tenantId: tenant.id },
        });
        if (!refund)
            throw new common_1.NotFoundException('Refund not found');
        if (refund.postedJournalId || String(refund.status) === 'POSTED') {
            throw new common_1.BadRequestException('Refund already posted');
        }
        if (String(refund.status) !== 'APPROVED') {
            throw new common_1.BadRequestException(`Refund cannot be posted from status: ${refund.status}`);
        }
        const refundDate = new Date(refund.refundDate);
        try {
            await (0, accounting_period_guard_1.assertPeriodIsOpen)({
                prisma: this.prisma,
                tenantId: tenant.id,
                date: refundDate,
                action: 'post',
                documentLabel: 'Refund',
                dateLabel: 'refund date',
            });
        }
        catch {
            throw new common_1.ForbiddenException('Cannot post in a closed period');
        }
        const refundable = await this.computeCreditNoteRefundable({
            tenantId: tenant.id,
            creditNoteId: String(refund.creditNoteId ?? ''),
        });
        const amount = this.normalizeMoney(Number(refund.amount ?? 0));
        if (amount > refundable.refundable) {
            throw new common_1.ConflictException('Refund amount exceeds available credit balance');
        }
        const arAccount = await (0, resolve_ar_control_account_1.resolveArControlAccount)(this.prisma, tenant.id);
        const clearingAccountId = await this.resolveClearingAccountId({
            tenantId: tenant.id,
            paymentMethod: String(refund.paymentMethod),
            bankAccountId: refund.bankAccountId ?? null,
        });
        const journal = await this.prisma.journalEntry.create({
            data: {
                tenantId: tenant.id,
                sourceType: 'AR_REFUND',
                sourceId: refund.id,
                journalDate: refundDate,
                reference: `AR-REFUND:${refund.id}`,
                description: `AR refund posting: ${refund.refundNumber}`,
                createdById: refund.createdById,
                status: 'REVIEWED',
                reviewedById: refund.approvedById,
                reviewedAt: refund.approvedAt ?? now,
                lines: {
                    create: [
                        {
                            accountId: arAccount.id,
                            debit: amount,
                            credit: 0,
                            description: 'AR control',
                        },
                        {
                            accountId: clearingAccountId,
                            debit: 0,
                            credit: amount,
                            description: String(refund.paymentMethod) === 'CASH'
                                ? 'Cash clearing'
                                : 'Bank clearing',
                        },
                    ],
                },
            },
            select: { id: true },
        });
        const postedJournal = await this.gl.postJournal(req, journal.id);
        await this.prisma.customerRefund.update({
            where: { id: refund.id },
            data: {
                status: 'POSTED',
                postedById: user.id,
                postedAt: now,
                postedJournalId: postedJournal.id,
            },
        });
        return this.prisma.customerRefund.findFirst({
            where: { id: refund.id, tenantId: tenant.id },
        });
    }
    async void(req, id, dto) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const reason = String(dto.reason ?? '').trim();
        if (!reason)
            throw new common_1.BadRequestException('reason is required');
        const refund = await this.prisma.customerRefund.findFirst({
            where: { id, tenantId: tenant.id },
        });
        if (!refund)
            throw new common_1.NotFoundException('Refund not found');
        if (String(refund.status) === 'VOID') {
            return refund;
        }
        if (String(refund.status) !== 'POSTED') {
            throw new common_1.BadRequestException(`Refund cannot be voided from status: ${refund.status}`);
        }
        const refundDate = new Date(refund.refundDate);
        await (0, accounting_period_guard_1.assertPeriodIsOpen)({
            prisma: this.prisma,
            tenantId: tenant.id,
            date: refundDate,
            action: 'post',
            documentLabel: 'Refund',
            dateLabel: 'refund date',
        });
        const arAccount = await (0, resolve_ar_control_account_1.resolveArControlAccount)(this.prisma, tenant.id);
        const clearingAccountId = await this.resolveClearingAccountId({
            tenantId: tenant.id,
            paymentMethod: String(refund.paymentMethod),
            bankAccountId: refund.bankAccountId ?? null,
        });
        const amount = this.normalizeMoney(Number(refund.amount ?? 0));
        const reversal = await this.prisma.journalEntry.create({
            data: {
                tenantId: tenant.id,
                sourceType: 'AR_REFUND_VOID',
                sourceId: refund.id,
                journalDate: refundDate,
                reference: `AR-REFUND-VOID:${refund.id}`,
                description: `Void AR refund: ${refund.refundNumber}`,
                createdById: refund.createdById,
                journalType: 'REVERSING',
                status: 'REVIEWED',
                reviewedById: refund.approvedById ?? refund.createdById,
                reviewedAt: new Date(),
                lines: {
                    create: [
                        {
                            accountId: clearingAccountId,
                            debit: amount,
                            credit: 0,
                            description: String(refund.paymentMethod) === 'CASH'
                                ? 'Cash clearing reversal'
                                : 'Bank clearing reversal',
                        },
                        {
                            accountId: arAccount.id,
                            debit: 0,
                            credit: amount,
                            description: 'AR control reversal',
                        },
                    ],
                },
            },
            select: { id: true },
        });
        await this.gl.postJournal(req, reversal.id);
        await this.prisma.customerRefund.update({
            where: { id: refund.id },
            data: {
                status: 'VOID',
                voidedById: user.id,
                voidedAt: new Date(),
                voidReason: reason,
            },
        });
        return this.prisma.customerRefund.findFirst({
            where: { id: refund.id, tenantId: tenant.id },
        });
    }
};
exports.FinanceArRefundsService = FinanceArRefundsService;
exports.FinanceArRefundsService = FinanceArRefundsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gl_service_1.GlService])
], FinanceArRefundsService);
//# sourceMappingURL=refunds.service.js.map