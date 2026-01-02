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
exports.ArReceiptsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ArReceiptsService = class ArReceiptsService {
    prisma;
    RECEIPT_NUMBER_SEQUENCE_NAME = 'AR_RECEIPT_NUMBER';
    OPENING_PERIOD_NAME = 'Opening Balances';
    constructor(prisma) {
        this.prisma = prisma;
    }
    round2(n) {
        return Math.round(n * 100) / 100;
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
    async assertEditable(receiptId, tenantId) {
        const r = await this.prisma.customerReceipt.findFirst({
            where: { id: receiptId, tenantId },
            select: { id: true, status: true },
        });
        if (!r)
            throw new common_1.NotFoundException('Receipt not found');
        if (r.status !== 'DRAFT') {
            throw new common_1.BadRequestException('Only DRAFT receipts can be edited');
        }
        return r;
    }
    async nextReceiptNumber(tx, tenantId) {
        const counter = await tx.tenantSequenceCounter.upsert({
            where: {
                tenantId_name: {
                    tenantId,
                    name: this.RECEIPT_NUMBER_SEQUENCE_NAME,
                },
            },
            create: {
                tenantId,
                name: this.RECEIPT_NUMBER_SEQUENCE_NAME,
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
        return `RCPT-${String(bumped.value).padStart(6, '0')}`;
    }
    async validateLines(params) {
        const lines = params.lines ?? [];
        for (const l of lines) {
            if (!l.invoiceId) {
                throw new common_1.BadRequestException('Receipt line missing invoiceId');
            }
            if (this.normalizeMoney(l.appliedAmount) < 0) {
                throw new common_1.BadRequestException('Receipt line appliedAmount must be >= 0');
            }
        }
        const appliedTotal = this.normalizeMoney(lines.reduce((s, l) => s + this.normalizeMoney(l.appliedAmount), 0));
        const receiptTotal = this.normalizeMoney(params.totalAmount);
        if (appliedTotal > receiptTotal) {
            throw new common_1.BadRequestException({
                error: 'Applied total cannot exceed receipt totalAmount',
                appliedTotal,
                totalAmount: receiptTotal,
            });
        }
        if (lines.length > 0) {
            const invoiceIds = [...new Set(lines.map((l) => l.invoiceId))];
            const invoices = await this.prisma.customerInvoice.findMany({
                where: {
                    tenantId: params.tenantId,
                    customerId: params.customerId,
                    id: { in: invoiceIds },
                    status: 'POSTED',
                },
                select: {
                    id: true,
                    totalAmount: true,
                    status: true,
                    currency: true,
                },
            });
            if (invoices.length !== invoiceIds.length) {
                throw new common_1.BadRequestException('One or more invoices not found / not POSTED for customer / tenant');
            }
            for (const inv of invoices) {
                const invCurrency = String(inv.currency ?? '').trim();
                if (!invCurrency) {
                    throw new common_1.BadRequestException({
                        error: 'Invoice currency missing; cannot allocate',
                        invoiceId: inv.id,
                    });
                }
                if (invCurrency !== params.receiptCurrency) {
                    throw new common_1.BadRequestException({
                        error: 'Receipt currency must match invoice currency',
                        receiptCurrency: params.receiptCurrency,
                        invoiceId: inv.id,
                        invoiceCurrency: invCurrency,
                    });
                }
            }
            const existingApplied = await this.prisma.customerReceiptLine.groupBy({
                by: ['invoiceId'],
                where: {
                    tenantId: params.tenantId,
                    invoiceId: { in: invoiceIds },
                    receipt: {
                        tenantId: params.tenantId,
                        status: 'POSTED',
                    },
                    ...(params.receiptIdForUpdate
                        ? { receiptId: { not: params.receiptIdForUpdate } }
                        : {}),
                },
                _sum: { appliedAmount: true },
            });
            const appliedByInvoiceId = new Map((existingApplied ?? []).map((g) => [
                g.invoiceId,
                Number(g._sum?.appliedAmount ?? 0),
            ]));
            const invById = new Map(invoices.map((i) => [i.id, i]));
            for (const l of lines) {
                const inv = invById.get(l.invoiceId);
                const alreadyApplied = this.normalizeMoney(Number(appliedByInvoiceId.get(l.invoiceId) ?? 0));
                const invoiceTotal = this.normalizeMoney(Number(inv?.totalAmount ?? 0));
                const openBalance = this.normalizeMoney(invoiceTotal - alreadyApplied);
                const nextApplied = this.normalizeMoney(l.appliedAmount);
                if (openBalance <= 0 && nextApplied > 0) {
                    throw new common_1.BadRequestException({
                        error: 'Invoice is fully settled; cannot allocate',
                        invoiceId: l.invoiceId,
                        invoiceTotal,
                        alreadyApplied,
                    });
                }
                if (nextApplied > openBalance) {
                    throw new common_1.BadRequestException({
                        error: 'Allocation exceeds invoice open balance',
                        invoiceId: l.invoiceId,
                        appliedAmount: nextApplied,
                        invoiceTotal,
                        alreadyApplied,
                        openBalance,
                    });
                }
            }
        }
    }
    async listAllocations(req, receiptId) {
        const tenant = this.ensureTenant(req);
        const r = await this.prisma.customerReceipt.findFirst({
            where: { id: receiptId, tenantId: tenant.id },
            select: { id: true },
        });
        if (!r)
            throw new common_1.NotFoundException('Receipt not found');
        const lines = await this.prisma.customerReceiptLine.findMany({
            where: { receiptId },
            include: { invoice: true },
            orderBy: [{ createdAt: 'asc' }],
        });
        return {
            receiptId,
            lines: (lines ?? []).map((l) => ({
                id: l.id,
                invoiceId: l.invoiceId,
                invoiceNumber: l.invoice?.invoiceNumber ?? '',
                invoiceDate: l.invoice?.invoiceDate
                    ? new Date(l.invoice.invoiceDate).toISOString().slice(0, 10)
                    : null,
                invoiceTotalAmount: l.invoice ? Number(l.invoice.totalAmount) : null,
                currency: l.invoice?.currency ?? null,
                appliedAmount: Number(l.appliedAmount),
                createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : null,
            })),
        };
    }
    async setAllocations(req, receiptId, dto) {
        const tenant = this.ensureTenant(req);
        await this.assertEditable(receiptId, tenant.id);
        const receipt = await this.prisma.customerReceipt.findFirst({
            where: { id: receiptId, tenantId: tenant.id },
            select: {
                id: true,
                customerId: true,
                currency: true,
                totalAmount: true,
                status: true,
            },
        });
        if (!receipt)
            throw new common_1.NotFoundException('Receipt not found');
        await this.validateLines({
            tenantId: tenant.id,
            customerId: receipt.customerId,
            receiptCurrency: String(receipt.currency),
            totalAmount: Number(receipt.totalAmount),
            lines: dto.lines,
            receiptIdForUpdate: receiptId,
        });
        await this.prisma.$transaction(async (tx) => {
            await tx.customerReceiptLine.deleteMany({
                where: { receiptId },
            });
            const lines = dto.lines ?? [];
            if (lines.length > 0) {
                await tx.customerReceiptLine.createMany({
                    data: lines.map((l) => ({
                        tenantId: tenant.id,
                        receiptId,
                        invoiceId: l.invoiceId,
                        appliedAmount: l.appliedAmount,
                    })),
                });
            }
        });
        return this.listAllocations(req, receiptId);
    }
    async listReceipts(req) {
        const tenant = this.ensureTenant(req);
        const rows = await this.prisma.customerReceipt.findMany({
            where: { tenantId: tenant.id },
            orderBy: [{ receiptDate: 'desc' }, { receiptNumber: 'desc' }],
            include: { customer: true },
        });
        return rows.map((r) => ({
            id: r.id,
            receiptNumber: r.receiptNumber,
            receiptDate: r.receiptDate.toISOString().slice(0, 10),
            customerId: r.customerId,
            customerName: r.customer?.name ?? '',
            currency: r.currency,
            totalAmount: Number(r.totalAmount),
            paymentMethod: r.paymentMethod,
            paymentReference: r.paymentReference,
            status: r.status,
            glJournalId: r.glJournalId ?? null,
            createdAt: r.createdAt.toISOString(),
            postedAt: r.postedAt?.toISOString() ?? null,
            voidedAt: r.voidedAt?.toISOString() ?? null,
        }));
    }
    async getReceiptById(req, id) {
        const tenant = this.ensureTenant(req);
        const r = await this.prisma.customerReceipt.findFirst({
            where: { id, tenantId: tenant.id },
            include: { customer: true, lines: { include: { invoice: true } } },
        });
        if (!r)
            throw new common_1.NotFoundException('Receipt not found');
        return {
            id: r.id,
            receiptNumber: r.receiptNumber,
            receiptDate: r.receiptDate.toISOString().slice(0, 10),
            customerId: r.customerId,
            customerName: r.customer?.name ?? '',
            currency: r.currency,
            totalAmount: Number(r.totalAmount),
            paymentMethod: r.paymentMethod,
            paymentReference: r.paymentReference,
            status: r.status,
            glJournalId: r.glJournalId ?? null,
            createdAt: r.createdAt.toISOString(),
            postedAt: r.postedAt?.toISOString() ?? null,
            postedById: r.postedById ?? null,
            voidedAt: r.voidedAt?.toISOString() ?? null,
            voidReason: r.voidReason ?? null,
            lines: r.lines.map((l) => ({
                id: l.id,
                invoiceId: l.invoiceId,
                invoiceNumber: l.invoice?.invoiceNumber ?? '',
                appliedAmount: Number(l.appliedAmount),
            })),
        };
    }
    async createReceipt(req, dto) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const customer = await this.prisma.customer.findFirst({
            where: { id: dto.customerId, tenantId: tenant.id, isActive: true },
            select: { id: true },
        });
        if (!customer) {
            throw new common_1.BadRequestException('Customer not found or inactive');
        }
        await this.validateLines({
            tenantId: tenant.id,
            customerId: dto.customerId,
            receiptCurrency: dto.currency,
            totalAmount: dto.totalAmount,
            lines: dto.lines,
        });
        const created = await this.prisma.$transaction(async (tx) => {
            const receiptNumber = await this.nextReceiptNumber(tx, tenant.id);
            return tx.customerReceipt.create({
                data: {
                    tenantId: tenant.id,
                    receiptNumber,
                    receiptDate: new Date(dto.receiptDate),
                    customerId: dto.customerId,
                    currency: dto.currency,
                    totalAmount: dto.totalAmount,
                    paymentMethod: dto.paymentMethod,
                    paymentReference: dto.paymentReference,
                    status: 'DRAFT',
                    createdById: user.id,
                    lines: {
                        create: (dto.lines ?? []).map((l) => ({
                            tenantId: tenant.id,
                            invoiceId: l.invoiceId,
                            appliedAmount: l.appliedAmount,
                        })),
                    },
                },
            });
        });
        return this.getReceiptById(req, created.id);
    }
    async updateReceipt(req, id, dto) {
        const tenant = this.ensureTenant(req);
        await this.assertEditable(id, tenant.id);
        const current = await this.prisma.customerReceipt.findFirst({
            where: { id, tenantId: tenant.id },
            select: { id: true, customerId: true, currency: true, totalAmount: true },
        });
        if (!current)
            throw new common_1.NotFoundException('Receipt not found');
        const nextCustomerId = dto.customerId ?? current.customerId;
        const nextTotalAmount = dto.totalAmount ?? Number(current.totalAmount);
        const nextCurrency = dto.currency ?? String(current.currency);
        if (dto.customerId) {
            const customer = await this.prisma.customer.findFirst({
                where: { id: dto.customerId, tenantId: tenant.id, isActive: true },
                select: { id: true },
            });
            if (!customer) {
                throw new common_1.BadRequestException('Customer not found or inactive');
            }
        }
        await this.validateLines({
            tenantId: tenant.id,
            customerId: nextCustomerId,
            receiptCurrency: nextCurrency,
            totalAmount: nextTotalAmount,
            lines: dto.lines,
            receiptIdForUpdate: id,
        });
        await this.prisma.$transaction(async (tx) => {
            await tx.customerReceipt.update({
                where: { id },
                data: {
                    customerId: dto.customerId,
                    receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : undefined,
                    currency: dto.currency,
                    totalAmount: dto.totalAmount,
                    paymentMethod: dto.paymentMethod ? dto.paymentMethod : undefined,
                    paymentReference: dto.paymentReference,
                },
            });
            if (dto.lines) {
                await tx.customerReceiptLine.deleteMany({ where: { receiptId: id } });
                if (dto.lines.length > 0) {
                    await tx.customerReceiptLine.createMany({
                        data: dto.lines.map((l) => ({
                            tenantId: tenant.id,
                            receiptId: id,
                            invoiceId: l.invoiceId,
                            appliedAmount: l.appliedAmount,
                        })),
                    });
                }
            }
        });
        return this.getReceiptById(req, id);
    }
    async postReceipt(req, id) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const now = new Date();
        const existing = await this.prisma.customerReceipt.findFirst({
            where: { id, tenantId: tenant.id },
            select: {
                id: true,
                status: true,
                receiptDate: true,
                currency: true,
                totalAmount: true,
                createdById: true,
                glJournalId: true,
            },
        });
        if (!existing)
            throw new common_1.NotFoundException('Receipt not found');
        if (existing.status === 'POSTED') {
            return this.getReceiptById(req, id);
        }
        if (existing.status !== 'DRAFT') {
            throw new common_1.BadRequestException('Only DRAFT receipts can be posted');
        }
        const draftLines = await this.prisma.customerReceiptLine.findMany({
            where: { receiptId: id },
            select: { invoiceId: true, appliedAmount: true },
        });
        const positiveLines = (draftLines ?? []).filter((l) => this.normalizeMoney(Number(l.appliedAmount)) > 0);
        if (positiveLines.length < 1) {
            throw new common_1.BadRequestException({
                error: 'Receipt must have at least one allocation line before posting',
                reason: 'NO_ALLOCATIONS',
            });
        }
        await this.validateLines({
            tenantId: tenant.id,
            customerId: String(existing.customerId ?? ''),
            receiptCurrency: String(existing.currency),
            totalAmount: Number(existing.totalAmount),
            lines: positiveLines.map((l) => ({
                invoiceId: l.invoiceId,
                appliedAmount: Number(l.appliedAmount),
            })),
        });
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                startDate: { lte: existing.receiptDate },
                endDate: { gte: existing.receiptDate },
            },
            select: { id: true, status: true, name: true },
        });
        if (!period || period.status !== 'OPEN') {
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by accounting period control',
                reason: !period
                    ? 'No accounting period exists for the receipt date'
                    : `Accounting period is not OPEN: ${period.name}`,
            });
        }
        if (period.name === this.OPENING_PERIOD_NAME) {
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by opening balances control period',
                reason: 'Operational postings are not allowed in the Opening Balances period',
            });
        }
        const cutoverLocked = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                name: this.OPENING_PERIOD_NAME,
                status: 'CLOSED',
            },
            orderBy: { startDate: 'desc' },
            select: { startDate: true },
        });
        if (cutoverLocked && existing.receiptDate < cutoverLocked.startDate) {
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by cutover lock',
                reason: `Posting dated before cutover is not allowed (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`,
            });
        }
        const tenantConfig = await this.prisma.tenant.findUnique({
            where: { id: tenant.id },
            select: {
                arControlAccountId: true,
                defaultBankClearingAccountId: true,
            },
        });
        const arControlAccountId = (tenantConfig?.arControlAccountId ?? null);
        const bankClearingAccountId = (tenantConfig?.defaultBankClearingAccountId ?? null);
        if (!bankClearingAccountId) {
            throw new common_1.BadRequestException({
                error: 'Missing configuration: default bank clearing account',
                field: 'Tenant.defaultBankClearingAccountId',
            });
        }
        if (!arControlAccountId) {
            throw new common_1.BadRequestException({
                error: 'Missing configuration: AR control account',
                field: 'Tenant.arControlAccountId',
            });
        }
        const [bankAccount, arAccount] = await Promise.all([
            this.prisma.account.findFirst({
                where: {
                    tenantId: tenant.id,
                    id: bankClearingAccountId,
                    isActive: true,
                    type: 'ASSET',
                },
                select: { id: true },
            }),
            this.prisma.account.findFirst({
                where: {
                    tenantId: tenant.id,
                    id: arControlAccountId,
                    isActive: true,
                    type: 'ASSET',
                },
                select: { id: true },
            }),
        ]);
        if (!bankAccount) {
            throw new common_1.BadRequestException('Configured bank clearing GL account not found or invalid');
        }
        if (!arAccount) {
            throw new common_1.BadRequestException('Configured AR control GL account not found or invalid');
        }
        const amount = Number(existing.totalAmount);
        if (!(amount > 0)) {
            throw new common_1.BadRequestException('Receipt totalAmount must be > 0 to post');
        }
        const posted = await this.prisma.$transaction(async (tx) => {
            const current = await tx.customerReceipt.findFirst({
                where: { id, tenantId: tenant.id },
                select: { id: true, status: true, glJournalId: true },
            });
            if (!current)
                throw new common_1.NotFoundException('Receipt not found');
            if (current.status === 'POSTED') {
                return { receiptId: current.id, glJournalId: current.glJournalId ?? null };
            }
            if (current.status !== 'DRAFT') {
                throw new common_1.BadRequestException('Only DRAFT receipts can be posted');
            }
            const existingJournal = await tx.journalEntry.findFirst({
                where: {
                    tenantId: tenant.id,
                    reference: `AR-RECEIPT:${id}`,
                },
                select: { id: true, status: true },
            });
            if (existingJournal) {
                if (existingJournal.status !== 'POSTED') {
                    throw new common_1.ConflictException({
                        error: 'Existing receipt journal is not POSTED; cannot continue',
                        journalId: existingJournal.id,
                        status: existingJournal.status,
                    });
                }
                await tx.customerReceipt.update({
                    where: { id },
                    data: {
                        status: 'POSTED',
                        postedById: user.id,
                        postedByUserId: user.id,
                        postedAt: now,
                        glJournalId: existingJournal.id,
                    },
                });
                return { receiptId: id, glJournalId: existingJournal.id };
            }
            const journal = await tx.journalEntry.create({
                data: {
                    tenantId: tenant.id,
                    journalDate: existing.receiptDate,
                    reference: `AR-RECEIPT:${id}`,
                    description: `AR receipt posting: ${id}`,
                    createdById: existing.createdById,
                    lines: {
                        create: [
                            { accountId: bankAccount.id, debit: amount, credit: 0 },
                            { accountId: arAccount.id, debit: 0, credit: amount },
                        ],
                    },
                },
                include: { lines: true },
            });
            const postedJournal = await tx.journalEntry.update({
                where: { id: journal.id },
                data: {
                    status: 'POSTED',
                    postedById: user.id,
                    postedAt: now,
                },
                select: { id: true },
            });
            await tx.customerReceipt.update({
                where: { id },
                data: {
                    status: 'POSTED',
                    postedById: user.id,
                    postedByUserId: user.id,
                    postedAt: now,
                    glJournalId: postedJournal.id,
                },
            });
            await tx.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'AR_POST',
                    entityType: 'CUSTOMER_RECEIPT',
                    entityId: id,
                    action: 'AR_RECEIPT_POST',
                    outcome: 'SUCCESS',
                    reason: JSON.stringify({ journalId: postedJournal.id }),
                    userId: user.id,
                    permissionUsed: 'AR_RECEIPTS_CREATE',
                },
            })
                .catch(() => undefined);
            return { receiptId: id, glJournalId: postedJournal.id };
        });
        return this.getReceiptById(req, posted.receiptId);
    }
    async voidReceipt(req, id, reason) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const now = new Date();
        const r = await this.prisma.customerReceipt.findFirst({
            where: { id, tenantId: tenant.id },
            select: { id: true, status: true },
        });
        if (!r)
            throw new common_1.NotFoundException('Receipt not found');
        if (r.status === 'VOIDED') {
            throw new common_1.BadRequestException('Receipt already VOIDED');
        }
        if (r.status !== 'POSTED' && r.status !== 'DRAFT') {
            throw new common_1.ForbiddenException('Invalid receipt status');
        }
        if (!reason || reason.trim().length < 2) {
            throw new common_1.BadRequestException('Void reason is required');
        }
        await this.prisma.customerReceipt.update({
            where: { id },
            data: {
                status: 'VOIDED',
                voidedById: user.id,
                voidedAt: now,
                voidReason: reason.trim(),
            },
        });
        return this.getReceiptById(req, id);
    }
};
exports.ArReceiptsService = ArReceiptsService;
exports.ArReceiptsService = ArReceiptsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ArReceiptsService);
//# sourceMappingURL=ar-receipts.service.js.map