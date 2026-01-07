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
exports.FinanceArCreditNotesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const accounting_period_guard_1 = require("../../common/accounting-period.guard");
const resolve_ar_control_account_1 = require("../../common/resolve-ar-control-account");
const gl_service_1 = require("../../../gl/gl.service");
let FinanceArCreditNotesService = class FinanceArCreditNotesService {
    prisma;
    gl;
    CREDIT_NOTE_NUMBER_SEQUENCE_NAME = 'AR_CREDIT_NOTE_NUMBER';
    constructor(prisma, gl) {
        this.prisma = prisma;
        this.gl = gl;
    }
    round2(n) {
        return Math.round(Number(n ?? 0) * 100) / 100;
    }
    round6(n) {
        return Math.round(Number(n ?? 0) * 1_000_000) / 1_000_000;
    }
    toNum(v) {
        if (v === null || v === undefined)
            return 0;
        if (typeof v === 'number')
            return Number.isFinite(v) ? v : 0;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
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
    async nextCreditNoteNumber(tx, tenantId) {
        const counter = await tx.tenantSequenceCounter.upsert({
            where: {
                tenantId_name: {
                    tenantId,
                    name: this.CREDIT_NOTE_NUMBER_SEQUENCE_NAME,
                },
            },
            create: {
                tenantId,
                name: this.CREDIT_NOTE_NUMBER_SEQUENCE_NAME,
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
    normalizeMoney(n) {
        return this.round2(Number(n ?? 0));
    }
    async computeInvoiceOutstanding(params) {
        const inv = await this.prisma.customerInvoice.findFirst({
            where: {
                tenantId: params.tenantId,
                id: params.invoiceId,
                status: 'POSTED',
            },
            select: {
                id: true,
                customerId: true,
                currency: true,
                totalAmount: true,
            },
        });
        if (!inv)
            throw new common_1.NotFoundException('Invoice not found');
        const invTotal = this.normalizeMoney(Number(inv.totalAmount ?? 0));
        const receiptAppliedAgg = await this.prisma.customerReceiptLine.groupBy({
            by: ['invoiceId'],
            where: {
                tenantId: params.tenantId,
                invoiceId: params.invoiceId,
                receipt: { tenantId: params.tenantId, status: 'POSTED' },
            },
            _sum: { appliedAmount: true },
        });
        const receiptApplied = this.normalizeMoney(Number(receiptAppliedAgg?.[0]?._sum?.appliedAmount ?? 0));
        const creditAgg = await this.prisma.customerCreditNote.aggregate({
            where: {
                tenantId: params.tenantId,
                invoiceId: params.invoiceId,
                status: 'POSTED',
            },
            _sum: { totalAmount: true },
        });
        const creditApplied = this.normalizeMoney(Number(creditAgg?._sum?.totalAmount ?? 0));
        const outstanding = this.normalizeMoney(invTotal - receiptApplied - creditApplied);
        return {
            invoice: {
                id: inv.id,
                customerId: inv.customerId,
                currency: inv.currency,
                totalAmount: invTotal,
            },
            receiptApplied,
            creditApplied,
            outstanding,
        };
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
        const invoiceId = String(q.invoiceId ?? '').trim();
        if (invoiceId)
            where.invoiceId = invoiceId;
        const search = String(q.search ?? '').trim();
        if (search) {
            where.OR = [
                { creditNoteNumber: { contains: search, mode: 'insensitive' } },
                { memo: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [items, total] = await Promise.all([
            this.prisma.customerCreditNote.findMany({
                where,
                orderBy: [{ creditNoteDate: 'desc' }, { creditNoteNumber: 'desc' }],
                take,
                skip,
                select: {
                    id: true,
                    creditNoteNumber: true,
                    creditNoteDate: true,
                    customerId: true,
                    invoiceId: true,
                    currency: true,
                    exchangeRate: true,
                    subtotal: true,
                    totalAmount: true,
                    status: true,
                    createdAt: true,
                    approvedAt: true,
                    postedAt: true,
                    voidedAt: true,
                },
            }),
            this.prisma.customerCreditNote.count({ where }),
        ]);
        return {
            items: (items ?? []).map((cn) => ({
                id: cn.id,
                creditNoteNumber: cn.creditNoteNumber,
                creditNoteDate: cn.creditNoteDate?.toISOString?.().slice(0, 10) ?? null,
                customerId: cn.customerId,
                invoiceId: cn.invoiceId ?? null,
                currency: cn.currency,
                exchangeRate: Number(cn.exchangeRate ?? 1),
                subtotal: Number(cn.subtotal),
                totalAmount: Number(cn.totalAmount),
                status: cn.status,
                createdAt: cn.createdAt?.toISOString?.() ?? null,
                approvedAt: cn.approvedAt?.toISOString?.() ?? null,
                postedAt: cn.postedAt?.toISOString?.() ?? null,
                voidedAt: cn.voidedAt?.toISOString?.() ?? null,
            })),
            total,
            page,
            pageSize,
        };
    }
    async getById(req, id) {
        const tenant = this.ensureTenant(req);
        const cn = await this.prisma.customerCreditNote.findFirst({
            where: { id, tenantId: tenant.id },
            include: {
                customer: true,
                invoice: true,
                lines: { include: { revenueAccount: true } },
                postedJournal: true,
            },
        });
        if (!cn)
            throw new common_1.NotFoundException('Credit note not found');
        return {
            id: cn.id,
            creditNoteNumber: cn.creditNoteNumber,
            creditNoteDate: cn.creditNoteDate?.toISOString?.().slice(0, 10) ?? null,
            customerId: cn.customerId,
            customerName: cn.customer?.name ?? '',
            invoiceId: cn.invoiceId ?? null,
            invoiceNumber: cn.invoice?.invoiceNumber ?? null,
            memo: cn.memo ?? null,
            currency: cn.currency,
            exchangeRate: Number(cn.exchangeRate ?? 1),
            subtotal: Number(cn.subtotal),
            totalAmount: Number(cn.totalAmount),
            status: cn.status,
            createdById: cn.createdById,
            approvedById: cn.approvedById ?? null,
            postedById: cn.postedById ?? null,
            voidedById: cn.voidedById ?? null,
            voidReason: cn.voidReason ?? null,
            postedJournalId: cn.postedJournalId ?? null,
            createdAt: cn.createdAt?.toISOString?.() ?? null,
            approvedAt: cn.approvedAt?.toISOString?.() ?? null,
            postedAt: cn.postedAt?.toISOString?.() ?? null,
            voidedAt: cn.voidedAt?.toISOString?.() ?? null,
            lines: (cn.lines ?? []).map((l) => ({
                id: l.id,
                description: l.description,
                quantity: Number(l.quantity),
                unitPrice: Number(l.unitPrice),
                lineAmount: Number(l.lineAmount),
                revenueAccountId: l.revenueAccountId,
                revenueAccountCode: l.revenueAccount?.code ?? null,
                departmentId: l.departmentId ?? null,
                projectId: l.projectId ?? null,
                fundId: l.fundId ?? null,
            })),
        };
    }
    async create(req, dto) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const creditNoteDate = this.parseYmdToDateOrNull(dto.creditNoteDate);
        if (!creditNoteDate)
            throw new common_1.BadRequestException('creditNoteDate is required');
        const currency = String(dto.currency ?? '').trim();
        if (!currency)
            throw new common_1.BadRequestException('currency is required');
        const tenantCurrency = String(tenant?.defaultCurrency ?? '').trim();
        const exchangeRate = tenantCurrency && currency.toUpperCase() === tenantCurrency.toUpperCase()
            ? 1
            : this.round6(this.toNum(dto.exchangeRate ?? 0));
        if (!(exchangeRate > 0)) {
            throw new common_1.BadRequestException('exchangeRate is required and must be > 0 for non-base currency');
        }
        const customer = await this.prisma.customer.findFirst({
            where: { id: dto.customerId, tenantId: tenant.id },
            select: { id: true, status: true },
        });
        if (!customer)
            throw new common_1.BadRequestException('Customer not found');
        if (String(customer.status) !== 'ACTIVE') {
            throw new common_1.BadRequestException('Customer is inactive and cannot be used for new transactions.');
        }
        const invoiceId = String(dto.invoiceId ?? '').trim() || null;
        if (invoiceId) {
            const inv = await this.prisma.customerInvoice.findFirst({
                where: { tenantId: tenant.id, id: invoiceId },
                select: { id: true, customerId: true, currency: true, status: true },
            });
            if (!inv)
                throw new common_1.BadRequestException('Invoice not found');
            if (String(inv.customerId) !== String(dto.customerId)) {
                throw new common_1.BadRequestException('Invoice customer does not match credit note customer');
            }
            if (String(inv.currency ?? '') !== currency) {
                throw new common_1.BadRequestException('Credit note currency must match invoice currency');
            }
            if (String(inv.status) !== 'POSTED') {
                throw new common_1.BadRequestException('Credit note can only be applied to a POSTED invoice');
            }
        }
        if (!dto.lines || dto.lines.length < 1) {
            throw new common_1.BadRequestException('Credit note must have at least 1 line');
        }
        const accountIds = [...new Set(dto.lines.map((l) => l.revenueAccountId))];
        const accounts = await this.prisma.account.findMany({
            where: { tenantId: tenant.id, id: { in: accountIds }, isActive: true },
            select: { id: true, type: true },
        });
        const byId = new Map(accounts.map((a) => [a.id, a]));
        const computedLines = dto.lines.map((l) => {
            const qty = this.toNum(l.quantity ?? 1);
            const unitPrice = this.toNum(l.unitPrice);
            const description = String(l.description ?? '').trim();
            if (!description) {
                throw new common_1.BadRequestException('Credit note line description is required');
            }
            if (!(qty > 0)) {
                throw new common_1.BadRequestException('Credit note line quantity must be > 0');
            }
            if (!(unitPrice > 0)) {
                throw new common_1.BadRequestException('Credit note line unitPrice must be > 0');
            }
            const acct = byId.get(l.revenueAccountId);
            if (!acct) {
                throw new common_1.BadRequestException('One or more revenue accounts were not found or inactive');
            }
            if (String(acct.type) !== 'INCOME') {
                throw new common_1.BadRequestException('Credit note revenueAccountId must be an INCOME account');
            }
            const lineAmount = this.round2(qty * unitPrice);
            if (!(lineAmount > 0)) {
                throw new common_1.BadRequestException('Credit note lineAmount must be > 0');
            }
            return {
                description,
                quantity: this.round2(qty),
                unitPrice: this.round2(unitPrice),
                lineAmount,
                revenueAccountId: l.revenueAccountId,
                departmentId: l.departmentId ? String(l.departmentId) : null,
                projectId: l.projectId ? String(l.projectId) : null,
                fundId: l.fundId ? String(l.fundId) : null,
            };
        });
        const subtotal = this.round2(computedLines.reduce((s, l) => s + l.lineAmount, 0));
        const totalAmount = subtotal;
        const created = await this.prisma.$transaction(async (tx) => {
            const creditNoteNumber = await this.nextCreditNoteNumber(tx, tenant.id);
            return tx.customerCreditNote.create({
                data: {
                    tenantId: tenant.id,
                    creditNoteNumber,
                    creditNoteDate,
                    customerId: dto.customerId,
                    invoiceId,
                    memo: dto.memo ? String(dto.memo) : null,
                    currency,
                    exchangeRate,
                    subtotal,
                    totalAmount,
                    status: 'DRAFT',
                    createdById: user.id,
                    lines: {
                        create: computedLines.map((l) => ({
                            description: l.description,
                            quantity: l.quantity,
                            unitPrice: l.unitPrice,
                            lineAmount: l.lineAmount,
                            revenueAccountId: l.revenueAccountId,
                            departmentId: l.departmentId ?? undefined,
                            projectId: l.projectId ?? undefined,
                            fundId: l.fundId ?? undefined,
                        })),
                    },
                },
                select: { id: true },
            });
        });
        return this.getById(req, created.id);
    }
    async approve(req, id, dto) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const cn = await this.prisma.customerCreditNote.findFirst({
            where: { id, tenantId: tenant.id },
            include: { lines: true, invoice: true },
        });
        if (!cn)
            throw new common_1.NotFoundException('Credit note not found');
        if (String(cn.status) !== 'DRAFT') {
            throw new common_1.BadRequestException(`Credit note cannot be approved from status: ${cn.status}`);
        }
        const creditNoteDate = new Date(cn.creditNoteDate);
        try {
            await (0, accounting_period_guard_1.assertPeriodIsOpen)({
                prisma: this.prisma,
                tenantId: tenant.id,
                date: creditNoteDate,
                action: 'create',
                documentLabel: 'Credit Note',
                dateLabel: 'credit note date',
            });
        }
        catch {
            throw new common_1.ForbiddenException('Cannot approve in a closed period');
        }
        if (cn.invoiceId) {
            const outstanding = await this.computeInvoiceOutstanding({
                tenantId: tenant.id,
                invoiceId: cn.invoiceId,
            });
            const totalAmount = this.normalizeMoney(Number(cn.totalAmount ?? 0));
            if (totalAmount > outstanding.outstanding) {
                throw new common_1.ConflictException('Credit note total exceeds invoice outstanding balance');
            }
        }
        await this.prisma.customerCreditNote.update({
            where: { id: cn.id },
            data: {
                status: 'APPROVED',
                approvedById: user.id,
                approvedAt: new Date(),
                ...(dto.memo !== undefined ? { memo: dto.memo ? String(dto.memo) : null } : {}),
            },
        });
        return this.getById(req, cn.id);
    }
    async post(req, id) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const cn = await this.prisma.customerCreditNote.findFirst({
            where: { id, tenantId: tenant.id },
            include: { lines: true },
        });
        if (!cn)
            throw new common_1.NotFoundException('Credit note not found');
        if (cn.postedJournalId) {
            throw new common_1.BadRequestException('Credit note already posted');
        }
        if (String(cn.status) === 'POSTED') {
            throw new common_1.BadRequestException('Credit note already posted');
        }
        if (String(cn.status) !== 'APPROVED') {
            throw new common_1.BadRequestException(`Credit note cannot be posted from status: ${cn.status}`);
        }
        const creditNoteDate = new Date(cn.creditNoteDate);
        try {
            await (0, accounting_period_guard_1.assertPeriodIsOpen)({
                prisma: this.prisma,
                tenantId: tenant.id,
                date: creditNoteDate,
                action: 'post',
                documentLabel: 'Credit Note',
                dateLabel: 'credit note date',
            });
        }
        catch {
            throw new common_1.ForbiddenException('Cannot post in a closed period');
        }
        if ((cn.lines ?? []).length < 1) {
            throw new common_1.BadRequestException('Credit note must have at least 1 line');
        }
        const totalAmount = this.normalizeMoney(Number(cn.totalAmount ?? 0));
        const subtotal = this.normalizeMoney((cn.lines ?? []).reduce((s, l) => s + Number(l.lineAmount ?? 0), 0));
        if (this.normalizeMoney(subtotal) !== this.normalizeMoney(totalAmount)) {
            throw new common_1.BadRequestException('Credit note totals failed validation before posting');
        }
        if (cn.invoiceId) {
            const outstanding = await this.computeInvoiceOutstanding({
                tenantId: tenant.id,
                invoiceId: cn.invoiceId,
            });
            if (totalAmount > outstanding.outstanding) {
                throw new common_1.ConflictException('Credit note total exceeds invoice outstanding balance');
            }
        }
        const arAccount = await (0, resolve_ar_control_account_1.resolveArControlAccount)(this.prisma, tenant.id);
        const journal = await this.prisma.journalEntry.create({
            data: {
                tenantId: tenant.id,
                sourceType: 'AR_CREDIT_NOTE',
                sourceId: cn.id,
                journalDate: creditNoteDate,
                reference: `AR-CN:${cn.id}`,
                description: `AR credit note posting: ${cn.creditNoteNumber}`,
                createdById: cn.createdById,
                status: 'REVIEWED',
                reviewedById: cn.approvedById,
                reviewedAt: cn.approvedAt ?? new Date(),
                lines: {
                    create: [
                        ...(cn.lines ?? []).map((l) => ({
                            accountId: l.revenueAccountId,
                            debit: this.normalizeMoney(Number(l.lineAmount ?? 0)),
                            credit: 0,
                            departmentId: l.departmentId ?? undefined,
                            projectId: l.projectId ?? undefined,
                            fundId: l.fundId ?? undefined,
                            description: String(l.description ?? '').trim() || undefined,
                        })),
                        {
                            accountId: arAccount.id,
                            debit: 0,
                            credit: totalAmount,
                            description: 'AR control',
                        },
                    ],
                },
            },
            select: { id: true },
        });
        const postedJournal = await this.gl.postJournal(req, journal.id);
        await this.prisma.customerCreditNote.update({
            where: { id: cn.id },
            data: {
                status: 'POSTED',
                postedById: user.id,
                postedAt: new Date(),
                postedJournalId: postedJournal.id,
            },
        });
        return this.getById(req, cn.id);
    }
    async void(req, id, dto) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const reason = String(dto.reason ?? '').trim();
        if (!reason)
            throw new common_1.BadRequestException('reason is required');
        const cn = await this.prisma.customerCreditNote.findFirst({
            where: { id, tenantId: tenant.id },
            include: { lines: true },
        });
        if (!cn)
            throw new common_1.NotFoundException('Credit note not found');
        if (String(cn.status) === 'VOID') {
            return this.getById(req, cn.id);
        }
        if (String(cn.status) !== 'POSTED') {
            throw new common_1.BadRequestException(`Credit note cannot be voided from status: ${cn.status}`);
        }
        const creditNoteDate = new Date(cn.creditNoteDate);
        await (0, accounting_period_guard_1.assertPeriodIsOpen)({
            prisma: this.prisma,
            tenantId: tenant.id,
            date: creditNoteDate,
            action: 'post',
            documentLabel: 'Credit Note',
            dateLabel: 'credit note date',
        });
        const arAccount = await (0, resolve_ar_control_account_1.resolveArControlAccount)(this.prisma, tenant.id);
        const totalAmount = this.normalizeMoney(Number(cn.totalAmount ?? 0));
        const reversal = await this.prisma.journalEntry.create({
            data: {
                tenantId: tenant.id,
                sourceType: 'AR_CREDIT_NOTE_VOID',
                sourceId: cn.id,
                journalDate: creditNoteDate,
                reference: `AR-CN-VOID:${cn.id}`,
                description: `Void AR credit note: ${cn.creditNoteNumber}`,
                createdById: cn.createdById,
                journalType: 'REVERSING',
                status: 'REVIEWED',
                reviewedById: cn.approvedById ?? cn.createdById,
                reviewedAt: new Date(),
                lines: {
                    create: [
                        {
                            accountId: arAccount.id,
                            debit: totalAmount,
                            credit: 0,
                            description: 'AR control reversal',
                        },
                        ...(cn.lines ?? []).map((l) => ({
                            accountId: l.revenueAccountId,
                            debit: 0,
                            credit: this.normalizeMoney(Number(l.lineAmount ?? 0)),
                            departmentId: l.departmentId ?? undefined,
                            projectId: l.projectId ?? undefined,
                            fundId: l.fundId ?? undefined,
                            description: String(l.description ?? '').trim() || undefined,
                        })),
                    ],
                },
            },
            select: { id: true },
        });
        await this.gl.postJournal(req, reversal.id);
        await this.prisma.customerCreditNote.update({
            where: { id: cn.id },
            data: {
                status: 'VOID',
                voidedById: user.id,
                voidedAt: new Date(),
                voidReason: reason,
            },
        });
        return this.getById(req, cn.id);
    }
};
exports.FinanceArCreditNotesService = FinanceArCreditNotesService;
exports.FinanceArCreditNotesService = FinanceArCreditNotesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gl_service_1.GlService])
], FinanceArCreditNotesService);
//# sourceMappingURL=credit-notes.service.js.map