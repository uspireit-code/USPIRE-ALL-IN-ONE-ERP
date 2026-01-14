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
exports.ArStatementsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const permission_catalog_1 = require("../../rbac/permission-catalog");
let ArStatementsService = class ArStatementsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listCustomersForStatements(req) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const customers = await this.prisma.customer.findMany({
            where: { tenantId: tenant.id },
            orderBy: [{ name: 'asc' }],
            select: {
                id: true,
                name: true,
                customerCode: true,
                status: true,
            },
        });
        return {
            items: (customers ?? []).map((c) => ({
                id: c.id,
                name: c.name,
                customerCode: c.customerCode ?? null,
                status: c.status,
            })),
        };
    }
    round2(n) {
        return Math.round(Number(n ?? 0) * 100) / 100;
    }
    parseDateOnlyOrThrow(label, v) {
        const s = String(v ?? '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            throw new common_1.BadRequestException(`${label} must be a valid date (YYYY-MM-DD).`);
        }
        const d = new Date(`${s}T00:00:00.000Z`);
        if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
            throw new common_1.BadRequestException(`${label} must be a valid date (YYYY-MM-DD).`);
        }
        return d;
    }
    resolveWindowOrThrow(q) {
        const fromDate = q.fromDate ? String(q.fromDate).trim() : '';
        const toDate = q.toDate ? String(q.toDate).trim() : '';
        const asOfDate = q.asOfDate ? String(q.asOfDate).trim() : '';
        const hasRange = Boolean(fromDate || toDate);
        const hasAsOf = Boolean(asOfDate);
        if (hasRange && hasAsOf) {
            throw new common_1.BadRequestException('Choose either a date range (fromDate + toDate) or an as-of date (asOfDate).');
        }
        if (hasAsOf) {
            const to = this.parseDateOnlyOrThrow('asOfDate', asOfDate);
            return { from: new Date('1970-01-01T00:00:00.000Z'), to, fromIso: '1970-01-01', toIso: to.toISOString().slice(0, 10) };
        }
        if (!fromDate || !toDate) {
            throw new common_1.BadRequestException('Choose either a date range (fromDate + toDate) or an as-of date (asOfDate).');
        }
        const from = this.parseDateOnlyOrThrow('fromDate', fromDate);
        const to = this.parseDateOnlyOrThrow('toDate', toDate);
        if (from > to) {
            throw new common_1.BadRequestException('End date must be after start date.');
        }
        return { from, to, fromIso: from.toISOString().slice(0, 10), toIso: to.toISOString().slice(0, 10) };
    }
    async getStatement(req, q) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const customerId = String(q.customerId ?? '').trim();
        if (!customerId) {
            throw new common_1.BadRequestException('Selected customer does not exist.');
        }
        const window = this.resolveWindowOrThrow({ fromDate: q.fromDate, toDate: q.toDate, asOfDate: q.asOfDate });
        const customer = await this.prisma.customer.findFirst({
            where: { tenantId: tenant.id, id: customerId },
            select: { id: true, name: true },
        });
        if (!customer) {
            throw new common_1.BadRequestException('Selected customer does not exist.');
        }
        const [openingInvoicesAgg, openingReceiptsAgg, openingCreditsAgg] = await Promise.all([
            this.prisma.customerInvoice.aggregate({
                where: {
                    tenantId: tenant.id,
                    customerId,
                    status: 'POSTED',
                    invoiceDate: { lt: window.from },
                },
                _sum: { totalAmount: true },
            }),
            this.prisma.customerReceipt.aggregate({
                where: {
                    tenantId: tenant.id,
                    customerId,
                    status: 'POSTED',
                    receiptDate: { lt: window.from },
                },
                _sum: { totalAmount: true },
            }),
            this.prisma.customerCreditNote.aggregate({
                where: {
                    tenantId: tenant.id,
                    customerId,
                    status: 'POSTED',
                    creditNoteDate: { lt: window.from },
                },
                _sum: { totalAmount: true },
            }),
        ]);
        const openingInvoices = this.round2(Number(openingInvoicesAgg._sum?.totalAmount ?? 0));
        const openingReceipts = this.round2(Number(openingReceiptsAgg._sum?.totalAmount ?? 0));
        const openingCredits = this.round2(Number(openingCreditsAgg._sum?.totalAmount ?? 0));
        const openingBalance = this.round2(openingInvoices - openingReceipts - openingCredits);
        const [invoices, receipts, creditNotes] = await Promise.all([
            this.prisma.customerInvoice.findMany({
                where: {
                    tenantId: tenant.id,
                    customerId,
                    status: 'POSTED',
                    invoiceDate: { gte: window.from, lte: window.to },
                },
                select: { invoiceDate: true, invoiceNumber: true, totalAmount: true },
                orderBy: [{ invoiceDate: 'asc' }, { invoiceNumber: 'asc' }],
            }),
            this.prisma.customerReceipt.findMany({
                where: {
                    tenantId: tenant.id,
                    customerId,
                    status: 'POSTED',
                    receiptDate: { gte: window.from, lte: window.to },
                },
                select: { receiptDate: true, receiptNumber: true, totalAmount: true },
                orderBy: [{ receiptDate: 'asc' }, { receiptNumber: 'asc' }],
            }),
            this.prisma.customerCreditNote.findMany({
                where: {
                    tenantId: tenant.id,
                    customerId,
                    status: 'POSTED',
                    creditNoteDate: { gte: window.from, lte: window.to },
                },
                select: { creditNoteDate: true, creditNoteNumber: true, totalAmount: true },
                orderBy: [{ creditNoteDate: 'asc' }, { creditNoteNumber: 'asc' }],
            }),
        ]);
        const tx = [];
        for (const i of invoices) {
            tx.push({
                date: i.invoiceDate,
                type: 'INVOICE',
                reference: i.invoiceNumber,
                amount: Number(i.totalAmount),
            });
        }
        for (const r of receipts) {
            tx.push({
                date: r.receiptDate,
                type: 'RECEIPT',
                reference: r.receiptNumber,
                amount: Number(r.totalAmount),
            });
        }
        for (const c of creditNotes) {
            tx.push({
                date: c.creditNoteDate,
                type: 'CREDIT_NOTE',
                reference: c.creditNoteNumber,
                amount: Number(c.totalAmount),
            });
        }
        tx.sort((a, b) => {
            const diff = a.date.getTime() - b.date.getTime();
            if (diff !== 0)
                return diff;
            if (a.type === b.type)
                return a.reference.localeCompare(b.reference);
            const order = { INVOICE: 0, CREDIT_NOTE: 1, RECEIPT: 2 };
            return (order[a.type] ?? 99) - (order[b.type] ?? 99);
        });
        let running = openingBalance;
        const transactions = [];
        for (const t of tx) {
            if (t.type === 'INVOICE') {
                running = this.round2(running + t.amount);
                transactions.push({
                    date: t.date.toISOString().slice(0, 10),
                    type: 'INVOICE',
                    reference: t.reference,
                    debit: this.round2(t.amount),
                    credit: 0,
                    runningBalance: running,
                });
            }
            else {
                running = this.round2(running - t.amount);
                transactions.push({
                    date: t.date.toISOString().slice(0, 10),
                    type: t.type,
                    reference: t.reference,
                    debit: 0,
                    credit: this.round2(t.amount),
                    runningBalance: running,
                });
            }
        }
        const closingBalance = running;
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'REPORT_VIEW',
                entityType: 'CUSTOMER',
                entityId: customerId,
                action: 'AR_STATEMENT_VIEW',
                outcome: 'SUCCESS',
                reason: JSON.stringify({ customerId, fromDate: q.fromDate ?? null, toDate: q.toDate ?? null, asOfDate: q.asOfDate ?? null }),
                userId: user.id,
                permissionUsed: permission_catalog_1.PERMISSIONS.AR_STATEMENT.VIEW,
            },
        })
            .catch(() => undefined);
        return {
            customer: { id: customer.id, name: customer.name },
            fromDate: window.fromIso,
            toDate: window.toIso,
            openingBalance,
            transactions,
            closingBalance,
        };
    }
};
exports.ArStatementsService = ArStatementsService;
exports.ArStatementsService = ArStatementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ArStatementsService);
//# sourceMappingURL=ar-statements.service.js.map