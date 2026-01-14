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
const permission_catalog_1 = require("../../../rbac/permission-catalog");
const audit_writer_1 = require("../../../audit/audit-writer");
const client_1 = require("@prisma/client");
const accounting_period_guard_1 = require("../../common/accounting-period.guard");
const gl_service_1 = require("../../../gl/gl.service");
const resolve_ar_control_account_1 = require("../../common/resolve-ar-control-account");
const report_export_service_1 = require("../../../reports/report-export.service");
let FinanceArRefundsService = class FinanceArRefundsService {
    prisma;
    gl;
    exports;
    REFUND_NUMBER_SEQUENCE_NAME = 'AR_REFUND_NUMBER';
    constructor(prisma, gl, exports) {
        this.prisma = prisma;
        this.gl = gl;
        this.exports = exports;
    }
    async exportPdf(req, id) {
        const tenant = req.tenant;
        const entityLegalName = String(tenant?.legalName ?? '').trim();
        const currencyIsoCode = String(tenant?.defaultCurrency ?? '').trim();
        if (!entityLegalName || !currencyIsoCode) {
            throw new common_1.BadRequestException('Missing tenant PDF metadata (legalName/defaultCurrency). Configure tenant settings before exporting.');
        }
        const refund = await this.getById(req, id);
        return this.exports.refundToPdf({
            refund: refund,
            header: {
                entityLegalName,
                reportName: 'Customer Refund',
                periodLine: `Refund Date: ${String(refund?.refundDate ?? '')}`,
                currencyIsoCode,
                headerFooterLine: `Currency: ${String(refund?.currency ?? currencyIsoCode)}`,
            },
        });
    }
    round2(n) {
        return Math.round(Number(n ?? 0) * 100) / 100;
    }
    async approve(req, id) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const now = new Date();
        const refund = await this.prisma.customerRefund.findFirst({
            where: { id, tenantId: tenant.id },
        });
        if (!refund)
            throw new common_1.NotFoundException('Refund not found');
        if (String(refund.status) !== 'SUBMITTED') {
            throw new common_1.BadRequestException(`Refund cannot be approved from status: ${refund.status}`);
        }
        await this.prisma.customerRefund.update({
            where: { id: refund.id },
            data: {
                status: 'APPROVED',
                approvedById: user.id,
                approvedAt: now,
            },
        });
        return this.prisma.customerRefund.findFirst({
            where: { id: refund.id, tenantId: tenant.id },
        });
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
                exchangeRate: true,
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
                exchangeRate: Number(cn.exchangeRate ?? 1),
                totalAmount: total,
            },
            refunded,
            refundable,
        };
    }
    async getRefundableForCreditNote(req, creditNoteId) {
        const tenant = this.ensureTenant(req);
        const out = await this.computeCreditNoteRefundable({
            tenantId: tenant.id,
            creditNoteId: String(creditNoteId ?? '').trim(),
        });
        return {
            creditNote: {
                ...out.creditNote,
                creditNoteDate: out.creditNote.creditNoteDate?.toISOString?.().slice(0, 10) ??
                    null,
            },
            refunded: Number(out.refunded),
            refundable: Number(out.refundable),
        };
    }
    async listRefundableCustomers(req) {
        const tenant = this.ensureTenant(req);
        const creditNotes = await this.prisma.customerCreditNote.findMany({
            where: {
                tenantId: tenant.id,
                status: 'POSTED',
            },
            select: {
                id: true,
                customerId: true,
                totalAmount: true,
            },
        });
        if ((creditNotes ?? []).length === 0) {
            return { items: [] };
        }
        const refundsAgg = await this.prisma.customerRefund.groupBy({
            by: ['creditNoteId'],
            where: {
                tenantId: tenant.id,
                status: 'POSTED',
                creditNoteId: { in: creditNotes.map((c) => c.id) },
            },
            _sum: { amount: true },
        });
        const refundedByCreditNoteId = new Map();
        for (const r of refundsAgg ?? []) {
            refundedByCreditNoteId.set(String(r.creditNoteId), this.normalizeMoney(Number(r?._sum?.amount ?? 0)));
        }
        const customerIds = new Set();
        for (const cn of creditNotes ?? []) {
            const total = this.normalizeMoney(Number(cn.totalAmount ?? 0));
            const refunded = refundedByCreditNoteId.get(String(cn.id)) ?? 0;
            const refundable = this.normalizeMoney(total - refunded);
            if (refundable > 0)
                customerIds.add(String(cn.customerId));
        }
        if (customerIds.size === 0) {
            return { items: [] };
        }
        const customers = await this.prisma.customer.findMany({
            where: {
                tenantId: tenant.id,
                id: { in: Array.from(customerIds) },
                status: 'ACTIVE',
            },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        return {
            items: (customers ?? []).map((c) => ({
                id: c.id,
                name: c.name,
            })),
        };
    }
    async listRefundableCreditNotes(req, customerId) {
        const tenant = this.ensureTenant(req);
        const cid = String(customerId ?? '').trim();
        if (!cid)
            throw new common_1.BadRequestException('customerId is required');
        const creditNotes = await this.prisma.customerCreditNote.findMany({
            where: {
                tenantId: tenant.id,
                customerId: cid,
                status: 'POSTED',
            },
            orderBy: [{ creditNoteDate: 'desc' }, { creditNoteNumber: 'desc' }],
            select: {
                id: true,
                creditNoteNumber: true,
                creditNoteDate: true,
                invoiceId: true,
                invoice: { select: { invoiceNumber: true } },
                currency: true,
                totalAmount: true,
            },
        });
        if ((creditNotes ?? []).length === 0) {
            return { items: [] };
        }
        const refundsAgg = await this.prisma.customerRefund.groupBy({
            by: ['creditNoteId'],
            where: {
                tenantId: tenant.id,
                status: 'POSTED',
                creditNoteId: { in: creditNotes.map((c) => c.id) },
            },
            _sum: { amount: true },
        });
        const refundedByCreditNoteId = new Map();
        for (const r of refundsAgg ?? []) {
            refundedByCreditNoteId.set(String(r.creditNoteId), this.normalizeMoney(Number(r?._sum?.amount ?? 0)));
        }
        const items = (creditNotes ?? [])
            .map((cn) => {
            const total = this.normalizeMoney(Number(cn.totalAmount ?? 0));
            const refunded = refundedByCreditNoteId.get(String(cn.id)) ?? 0;
            const refundable = this.normalizeMoney(total - refunded);
            return {
                id: cn.id,
                creditNoteNumber: String(cn.creditNoteNumber ?? '').trim(),
                creditNoteDate: cn.creditNoteDate?.toISOString?.().slice(0, 10) ?? null,
                invoiceId: cn.invoiceId ?? null,
                invoiceNumber: cn.invoice?.invoiceNumber ?? null,
                currency: String(cn.currency ?? '').trim(),
                totalAmount: total,
                refunded,
                refundable,
            };
        })
            .filter((x) => Number(x.refundable ?? 0) > 0);
        return { items };
    }
    async list(req, q) {
        const tenant = this.ensureTenant(req);
        const page = Number(q.page ?? 1);
        const pageSize = Number(q.pageSize ?? 50);
        const take = pageSize;
        const skip = (page - 1) * pageSize;
        const where = { tenantId: tenant.id };
        const status = String(q.status ?? '').trim();
        if (status)
            where.status = status;
        const customerId = String(q.customerId ?? '').trim();
        if (customerId)
            where.customerId = customerId;
        const creditNoteId = String(q.creditNoteId ?? '').trim();
        if (creditNoteId)
            where.creditNoteId = creditNoteId;
        const dateFrom = String(q.dateFrom ?? '').trim();
        const dateTo = String(q.dateTo ?? '').trim();
        if (dateFrom || dateTo) {
            where.refundDate = {};
            if (dateFrom)
                where.refundDate.gte = new Date(dateFrom);
            if (dateTo)
                where.refundDate.lte = new Date(dateTo);
        }
        const [items, total] = await Promise.all([
            this.prisma.customerRefund.findMany({
                where,
                orderBy: [{ refundDate: 'desc' }, { refundNumber: 'desc' }],
                take,
                skip,
                include: {
                    customer: { select: { id: true, name: true } },
                    creditNote: {
                        select: { id: true, creditNoteNumber: true, creditNoteDate: true },
                    },
                },
            }),
            this.prisma.customerRefund.count({ where }),
        ]);
        return {
            items: (items ?? []).map((r) => ({
                id: r.id,
                refundNumber: r.refundNumber,
                refundDate: r.refundDate?.toISOString?.().slice(0, 10) ?? null,
                amount: Number(r.amount ?? 0),
                currency: r.currency,
                exchangeRate: Number(r.exchangeRate ?? 1),
                paymentMethod: r.paymentMethod,
                status: r.status,
                customerId: r.customerId,
                customerName: r.customer?.name ?? null,
                creditNoteId: r.creditNoteId,
                creditNoteNumber: r.creditNote?.creditNoteNumber ?? null,
                createdById: r.createdById,
                approvedById: r.approvedById ?? null,
                postedById: r.postedById ?? null,
                voidedById: r.voidedById ?? null,
                approvedAt: r.approvedAt?.toISOString?.() ?? null,
                postedAt: r.postedAt?.toISOString?.() ?? null,
                voidedAt: r.voidedAt?.toISOString?.() ?? null,
                postedJournalId: r.postedJournalId ?? null,
            })),
            total,
            page,
            pageSize,
        };
    }
    async getById(req, id) {
        const tenant = this.ensureTenant(req);
        const refund = await this.prisma.customerRefund.findFirst({
            where: { id, tenantId: tenant.id },
            include: {
                customer: { select: { id: true, name: true } },
                creditNote: {
                    select: {
                        id: true,
                        creditNoteNumber: true,
                        creditNoteDate: true,
                        totalAmount: true,
                        currency: true,
                        invoiceId: true,
                    },
                },
                postedJournal: { select: { id: true } },
            },
        });
        if (!refund)
            throw new common_1.NotFoundException('Refund not found');
        return {
            id: refund.id,
            refundNumber: refund.refundNumber,
            refundDate: refund.refundDate?.toISOString?.().slice(0, 10) ?? null,
            customerId: refund.customerId,
            customerName: refund.customer?.name ?? null,
            creditNoteId: refund.creditNoteId,
            creditNoteNumber: refund.creditNote?.creditNoteNumber ?? null,
            creditNoteDate: refund.creditNote?.creditNoteDate?.toISOString?.().slice(0, 10) ?? null,
            creditNoteTotalAmount: Number(refund.creditNote?.totalAmount ?? 0),
            creditNoteCurrency: refund.creditNote?.currency ?? null,
            invoiceId: refund.creditNote?.invoiceId ?? null,
            currency: refund.currency,
            exchangeRate: Number(refund.exchangeRate ?? 1),
            amount: Number(refund.amount ?? 0),
            paymentMethod: refund.paymentMethod,
            bankAccountId: refund.bankAccountId ?? null,
            status: refund.status,
            createdById: refund.createdById,
            createdAt: refund.createdAt?.toISOString?.() ?? null,
            approvedById: refund.approvedById ?? null,
            approvedAt: refund.approvedAt?.toISOString?.() ?? null,
            postedById: refund.postedById ?? null,
            postedAt: refund.postedAt?.toISOString?.() ?? null,
            voidedById: refund.voidedById ?? null,
            voidedAt: refund.voidedAt?.toISOString?.() ?? null,
            voidReason: refund.voidReason ?? null,
            postedJournalId: refund.postedJournalId ?? null,
        };
    }
    async resolveClearingAccountId(params) {
        if (params.paymentMethod === 'BANK') {
            if (!params.bankAccountId) {
                throw new common_1.BadRequestException({
                    error: 'Bank account is required for BANK refunds',
                    field: 'CustomerRefund.bankAccountId',
                });
            }
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
        }
        const tenantControls = await this.prisma.tenant.findUnique({
            where: { id: params.tenantId },
            select: { cashClearingAccountId: true },
        });
        const cashClearingAccountId = (tenantControls?.cashClearingAccountId ?? null);
        if (!cashClearingAccountId) {
            throw new common_1.BadRequestException({
                error: 'Missing configuration: cash clearing account',
                field: 'AR_CASH_CLEARING_ACCOUNT_ID',
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
        const refundable = await this.computeCreditNoteRefundable({
            tenantId: tenant.id,
            creditNoteId: String(dto.creditNoteId ?? '').trim(),
        });
        const requestedCustomerId = String(dto.customerId ?? '').trim();
        if (!requestedCustomerId)
            throw new common_1.BadRequestException('customerId is required');
        if (String(refundable.creditNote.customerId) !== requestedCustomerId) {
            throw new common_1.BadRequestException('creditNoteId does not belong to customerId');
        }
        if (amount > refundable.refundable) {
            throw new common_1.ConflictException('Refund amount exceeds available credit balance');
        }
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
    async submit(req, id) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const refund = await this.prisma.customerRefund.findFirst({
            where: { id, tenantId: tenant.id },
            select: { id: true, status: true, refundDate: true },
        });
        if (!refund)
            throw new common_1.NotFoundException('Refund not found');
        if (String(refund.status) !== 'DRAFT') {
            throw new common_1.BadRequestException(`Refund cannot be submitted from status: ${refund.status}`);
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
            throw new common_1.ForbiddenException('Cannot submit in a closed period');
        }
        await this.prisma.customerRefund.update({
            where: { id: refund.id },
            data: { status: 'SUBMITTED' },
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
        if (!refund.creditNoteId)
            throw new common_1.BadRequestException('Refund must reference a credit note');
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
        const tenantControls = await this.prisma.tenant.findUnique({
            where: { id: tenant.id },
            select: { defaultBankClearingAccountId: true },
        });
        const refundClearingAccountId = (tenantControls?.defaultBankClearingAccountId ?? null);
        if (!refundClearingAccountId) {
            throw new common_1.BadRequestException({
                error: 'Missing configuration: refund clearing account',
                field: 'AR_REFUND_CLEARING_ACCOUNT_ID',
            });
        }
        const refundClearingAccount = await this.prisma.account.findFirst({
            where: {
                tenantId: tenant.id,
                id: refundClearingAccountId,
                isActive: true,
                type: 'ASSET',
            },
            select: { id: true },
        });
        if (!refundClearingAccount) {
            throw new common_1.BadRequestException('Configured refund clearing GL account not found or invalid');
        }
        const paymentAccountId = await this.resolveClearingAccountId({
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
                reviewedById: user.id,
                reviewedAt: now,
                lines: {
                    create: [
                        {
                            accountId: arAccount.id,
                            debit: amount,
                            credit: 0,
                            description: 'AR control',
                        },
                        {
                            accountId: refundClearingAccount.id,
                            debit: 0,
                            credit: amount,
                            description: 'AR refund clearing',
                        },
                        {
                            accountId: refundClearingAccount.id,
                            debit: amount,
                            credit: 0,
                            description: 'AR refund clearing',
                        },
                        {
                            accountId: paymentAccountId,
                            debit: 0,
                            credit: amount,
                            description: String(refund.paymentMethod) === 'CASH'
                                ? 'Cash clearing'
                                : 'Bank account',
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
        await (0, audit_writer_1.writeAuditEventWithPrisma)({
            tenantId: tenant.id,
            eventType: client_1.AuditEventType.AR_POST,
            entityType: client_1.AuditEntityType.CUSTOMER_INVOICE,
            entityId: refund.id,
            actorUserId: user.id,
            timestamp: new Date(),
            outcome: 'SUCCESS',
            action: 'REFUND_POSTED',
            permissionUsed: permission_catalog_1.PERMISSIONS.AR.REFUND_POST,
            lifecycleType: 'POST',
            metadata: {
                entityTypeRaw: 'CUSTOMER_REFUND',
                refundId: refund.id,
                journalId: postedJournal.id,
            },
        }, this.prisma);
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
        const tenantControls = await this.prisma.tenant.findUnique({
            where: { id: tenant.id },
            select: { defaultBankClearingAccountId: true },
        });
        const refundClearingAccountId = (tenantControls?.defaultBankClearingAccountId ?? null);
        if (!refundClearingAccountId) {
            throw new common_1.BadRequestException({
                error: 'Missing configuration: refund clearing account',
                field: 'AR_REFUND_CLEARING_ACCOUNT_ID',
            });
        }
        const refundClearingAccount = await this.prisma.account.findFirst({
            where: {
                tenantId: tenant.id,
                id: refundClearingAccountId,
                isActive: true,
                type: 'ASSET',
            },
            select: { id: true },
        });
        if (!refundClearingAccount) {
            throw new common_1.BadRequestException('Configured refund clearing GL account not found or invalid');
        }
        const paymentAccountId = await this.resolveClearingAccountId({
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
                            accountId: paymentAccountId,
                            debit: amount,
                            credit: 0,
                            description: String(refund.paymentMethod) === 'CASH'
                                ? 'Cash clearing reversal'
                                : 'Bank account reversal',
                        },
                        {
                            accountId: refundClearingAccount.id,
                            debit: 0,
                            credit: amount,
                            description: 'AR refund clearing reversal',
                        },
                        {
                            accountId: refundClearingAccount.id,
                            debit: amount,
                            credit: 0,
                            description: 'AR refund clearing reversal',
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
        gl_service_1.GlService,
        report_export_service_1.ReportExportService])
], FinanceArRefundsService);
//# sourceMappingURL=refunds.service.js.map