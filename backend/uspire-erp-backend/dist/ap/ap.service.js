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
exports.ApService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ApService = class ApService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    round2(n) {
        return Math.round(n * 100) / 100;
    }
    async createSupplier(req, dto) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        return this.prisma.supplier.create({
            data: {
                tenantId: tenant.id,
                name: dto.name,
                taxNumber: dto.taxNumber,
                isActive: true,
            },
        });
    }
    async listSuppliers(req) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        return this.prisma.supplier.findMany({
            where: { tenantId: tenant.id, isActive: true },
            orderBy: { name: 'asc' },
        });
    }
    async listEligibleAccounts(req) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        return this.prisma.account.findMany({
            where: {
                tenantId: tenant.id,
                isActive: true,
                type: { in: ['EXPENSE', 'ASSET'] },
            },
            orderBy: [{ code: 'asc' }],
            select: { id: true, code: true, name: true, type: true },
        });
    }
    async createInvoice(req, dto) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const supplier = await this.prisma.supplier.findFirst({
            where: { id: dto.supplierId, tenantId: tenant.id, isActive: true },
            select: { id: true },
        });
        if (!supplier) {
            throw new common_1.BadRequestException('Supplier not found or inactive');
        }
        const netAmount = this.round2(dto.lines.reduce((s, l) => s + (l.amount ?? 0), 0));
        this.assertInvoiceLines(dto.lines, netAmount);
        const taxLines = dto.taxLines ?? [];
        const validatedTax = await this.validateTaxLines({
            tenantId: tenant.id,
            sourceType: 'SUPPLIER_INVOICE',
            expectedRateType: 'INPUT',
            netAmount,
            taxLines,
        });
        const expectedGross = this.round2(netAmount + validatedTax.totalTax);
        if (this.round2(dto.totalAmount) !== expectedGross) {
            throw new common_1.BadRequestException({
                error: 'Invoice totalAmount must equal net + VAT',
                netAmount,
                totalTax: validatedTax.totalTax,
                expectedGross,
                totalAmount: this.round2(dto.totalAmount),
            });
        }
        const accounts = await this.prisma.account.findMany({
            where: {
                tenantId: tenant.id,
                id: { in: dto.lines.map((l) => l.accountId) },
                isActive: true,
            },
            select: { id: true, type: true },
        });
        const accountMap = new Map(accounts.map((a) => [a.id, a]));
        for (const line of dto.lines) {
            const a = accountMap.get(line.accountId);
            if (!a) {
                throw new common_1.BadRequestException(`Account not found or inactive: ${line.accountId}`);
            }
            if (a.type !== 'EXPENSE' && a.type !== 'ASSET') {
                throw new common_1.BadRequestException(`Invoice line account must be EXPENSE or ASSET: ${line.accountId}`);
            }
        }
        const invoice = await this.prisma.supplierInvoice.create({
            data: {
                tenantId: tenant.id,
                supplierId: dto.supplierId,
                invoiceNumber: dto.invoiceNumber,
                invoiceDate: new Date(dto.invoiceDate),
                dueDate: new Date(dto.dueDate),
                totalAmount: dto.totalAmount,
                createdById: user.id,
                lines: {
                    create: dto.lines.map((l) => ({
                        accountId: l.accountId,
                        description: l.description,
                        amount: l.amount,
                    })),
                },
            },
            include: { lines: true, supplier: true },
        });
        if (validatedTax.rows.length > 0) {
            await this.prisma.invoiceTaxLine.createMany({
                data: validatedTax.rows.map((t) => ({
                    tenantId: tenant.id,
                    sourceType: 'SUPPLIER_INVOICE',
                    sourceId: invoice.id,
                    taxRateId: t.taxRateId,
                    taxableAmount: t.taxableAmount,
                    taxAmount: t.taxAmount,
                })),
            });
        }
        const createdTaxLines = await this.prisma.invoiceTaxLine.findMany({
            where: {
                tenantId: tenant.id,
                sourceType: 'SUPPLIER_INVOICE',
                sourceId: invoice.id,
            },
            include: { taxRate: { include: { glAccount: true } } },
        });
        return { ...invoice, taxLines: createdTaxLines };
    }
    async submitInvoice(req, id) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const inv = await this.prisma.supplierInvoice.findFirst({
            where: { id, tenantId: tenant.id },
            select: { id: true, status: true, createdById: true },
        });
        if (!inv) {
            throw new common_1.NotFoundException('Invoice not found');
        }
        if (inv.status !== 'DRAFT') {
            throw new common_1.BadRequestException('Only DRAFT invoices can be submitted');
        }
        if (inv.createdById !== user.id) {
            throw new common_1.ForbiddenException('Only the creator can submit this invoice');
        }
        await this.assertTaxIntegrityBeforeSubmit({
            tenantId: tenant.id,
            invoiceId: inv.id,
        });
        return this.prisma.supplierInvoice.update({
            where: { id: inv.id },
            data: { status: 'SUBMITTED' },
            include: { lines: true, supplier: true },
        });
    }
    async approveInvoice(req, id) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const inv = await this.prisma.supplierInvoice.findFirst({
            where: { id, tenantId: tenant.id },
            select: { id: true, status: true, createdById: true },
        });
        if (!inv) {
            throw new common_1.NotFoundException('Invoice not found');
        }
        if (inv.status !== 'SUBMITTED') {
            throw new common_1.BadRequestException('Only SUBMITTED invoices can be approved');
        }
        if (inv.createdById === user.id) {
            await this.prisma.soDViolationLog.create({
                data: {
                    tenantId: tenant.id,
                    userId: user.id,
                    permissionAttempted: 'AP_INVOICE_APPROVE',
                    conflictingPermission: 'AP_INVOICE_CREATE',
                },
            });
            throw new common_1.ForbiddenException({
                error: 'Action blocked by Segregation of Duties (SoD)',
                reason: 'Creator cannot approve own supplier invoice',
            });
        }
        return this.prisma.supplierInvoice.update({
            where: { id: inv.id },
            data: {
                status: 'APPROVED',
                approvedById: user.id,
                approvedAt: new Date(),
            },
            include: { lines: true, supplier: true },
        });
    }
    async postInvoice(req, id, opts) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user) {
            throw new common_1.BadRequestException('Missing tenant or user context');
        }
        const inv = await this.prisma.supplierInvoice.findFirst({
            where: { id, tenantId: tenant.id },
            include: { lines: true },
        });
        if (!inv) {
            throw new common_1.NotFoundException('Invoice not found');
        }
        if (inv.status === 'POSTED') {
            throw new common_1.BadRequestException('Invoice is already posted');
        }
        if (inv.status !== 'APPROVED') {
            throw new common_1.BadRequestException('Only APPROVED invoices can be posted');
        }
        if (!inv.approvedById) {
            throw new common_1.BadRequestException('Invoice must have an approver before posting');
        }
        if (inv.createdById === user.id) {
            await this.prisma.soDViolationLog.create({
                data: {
                    tenantId: tenant.id,
                    userId: user.id,
                    permissionAttempted: 'AP_INVOICE_POST',
                    conflictingPermission: 'AP_INVOICE_CREATE',
                },
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'AP_POST',
                    entityType: 'SUPPLIER_INVOICE',
                    entityId: inv.id,
                    action: 'AP_INVOICE_POST',
                    outcome: 'BLOCKED',
                    reason: 'Creator cannot post own supplier invoice',
                    userId: user.id,
                    permissionUsed: 'AP_INVOICE_POST',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Action blocked by Segregation of Duties (SoD)',
                reason: 'Creator cannot post own supplier invoice',
            });
        }
        if (inv.approvedById === user.id) {
            await this.prisma.soDViolationLog.create({
                data: {
                    tenantId: tenant.id,
                    userId: user.id,
                    permissionAttempted: 'AP_INVOICE_POST',
                    conflictingPermission: 'AP_INVOICE_APPROVE',
                },
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'AP_POST',
                    entityType: 'SUPPLIER_INVOICE',
                    entityId: inv.id,
                    action: 'AP_INVOICE_POST',
                    outcome: 'BLOCKED',
                    reason: 'Approver cannot post the same supplier invoice',
                    userId: user.id,
                    permissionUsed: 'AP_INVOICE_POST',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Action blocked by Segregation of Duties (SoD)',
                reason: 'Approver cannot post the same supplier invoice',
            });
        }
        const netAmount = this.round2(inv.lines.reduce((s, l) => s + Number(l.amount), 0));
        this.assertInvoiceLines(inv.lines.map((l) => ({
            accountId: l.accountId,
            description: l.description,
            amount: Number(l.amount),
        })), netAmount);
        const taxLines = await this.prisma.invoiceTaxLine.findMany({
            where: {
                tenantId: tenant.id,
                sourceType: 'SUPPLIER_INVOICE',
                sourceId: inv.id,
            },
            include: {
                taxRate: {
                    select: {
                        id: true,
                        type: true,
                        isActive: true,
                        rate: true,
                        glAccountId: true,
                    },
                },
            },
        });
        const totalTax = this.round2(taxLines.reduce((s, t) => s + Number(t.taxAmount), 0));
        const expectedGross = this.round2(netAmount + totalTax);
        if (this.round2(Number(inv.totalAmount)) !== expectedGross) {
            throw new common_1.BadRequestException({
                error: 'Invoice totalAmount must equal net + VAT before posting',
                netAmount,
                totalTax,
                expectedGross,
                totalAmount: this.round2(Number(inv.totalAmount)),
            });
        }
        for (const t of taxLines) {
            if (!t.taxRate.isActive || t.taxRate.type !== 'INPUT') {
                throw new common_1.BadRequestException('Invoice has invalid or inactive INPUT VAT rate');
            }
            const expected = this.round2(Number(t.taxableAmount) * Number(t.taxRate.rate));
            if (this.round2(Number(t.taxAmount)) !== expected) {
                throw new common_1.BadRequestException('Invoice VAT line failed validation');
            }
        }
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: tenant.id,
                startDate: { lte: inv.invoiceDate },
                endDate: { gte: inv.invoiceDate },
            },
            select: { id: true, status: true, name: true },
        });
        if (!period || period.status !== 'OPEN') {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'AP_POST',
                    entityType: 'SUPPLIER_INVOICE',
                    entityId: inv.id,
                    action: 'AP_INVOICE_POST',
                    outcome: 'BLOCKED',
                    reason: !period
                        ? 'No accounting period exists for the invoice date'
                        : `Accounting period is not OPEN: ${period.name}`,
                    userId: user.id,
                    permissionUsed: 'AP_INVOICE_POST',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by accounting period control',
                reason: !period
                    ? 'No accounting period exists for the invoice date'
                    : `Accounting period is not OPEN: ${period.name}`,
            });
        }
        if (period.name === 'Opening Balances') {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'AP_POST',
                    entityType: 'SUPPLIER_INVOICE',
                    entityId: inv.id,
                    action: 'AP_INVOICE_POST',
                    outcome: 'BLOCKED',
                    reason: 'Operational postings are not allowed in the Opening Balances period',
                    userId: user.id,
                    permissionUsed: 'AP_INVOICE_POST',
                },
            })
                .catch(() => undefined);
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
        if (cutoverLocked && inv.invoiceDate < cutoverLocked.startDate) {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'AP_POST',
                    entityType: 'SUPPLIER_INVOICE',
                    entityId: inv.id,
                    action: 'AP_INVOICE_POST',
                    outcome: 'BLOCKED',
                    reason: `Posting dated before cutover is not allowed (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`,
                    userId: user.id,
                    permissionUsed: 'AP_INVOICE_POST',
                },
            })
                .catch(() => undefined);
            throw new common_1.ForbiddenException({
                error: 'Posting blocked by cutover lock',
                reason: `Posting dated before cutover is not allowed (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`,
            });
        }
        const apCode = opts?.apControlAccountCode ?? '2000';
        const apAccount = await this.prisma.account.findFirst({
            where: {
                tenantId: tenant.id,
                code: apCode,
                isActive: true,
                type: 'LIABILITY',
            },
            select: { id: true, code: true, name: true },
        });
        if (!apAccount) {
            throw new common_1.BadRequestException(`AP control account not found or invalid: ${apCode}`);
        }
        const taxByAccountId = new Map();
        for (const t of taxLines) {
            const prev = taxByAccountId.get(t.taxRate.glAccountId) ?? 0;
            taxByAccountId.set(t.taxRate.glAccountId, this.round2(prev + Number(t.taxAmount)));
        }
        const journal = await this.prisma.journalEntry.create({
            data: {
                tenantId: tenant.id,
                journalDate: inv.invoiceDate,
                reference: `AP-INVOICE:${inv.id}`,
                description: `AP invoice posting: ${inv.id}`,
                createdById: inv.createdById,
                lines: {
                    create: [
                        ...inv.lines.map((l) => ({
                            accountId: l.accountId,
                            debit: l.amount,
                            credit: 0,
                        })),
                        ...[...taxByAccountId.entries()]
                            .filter(([, amt]) => amt !== 0)
                            .map(([accountId, amt]) => ({
                            accountId,
                            debit: amt,
                            credit: 0,
                        })),
                        {
                            accountId: apAccount.id,
                            debit: 0,
                            credit: inv.totalAmount,
                        },
                    ],
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
        const updatedInvoice = await this.prisma.supplierInvoice.update({
            where: { id: inv.id },
            data: {
                status: 'POSTED',
                postedById: user.id,
                postedAt: new Date(),
            },
            include: { supplier: true, lines: true },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'AP_POST',
                entityType: 'SUPPLIER_INVOICE',
                entityId: inv.id,
                action: 'AP_INVOICE_POST',
                outcome: 'SUCCESS',
                userId: user.id,
                permissionUsed: 'AP_INVOICE_POST',
            },
        })
            .catch(() => undefined);
        return { invoice: updatedInvoice, glJournal: postedJournal };
    }
    async validateTaxLines(params) {
        if (!params.taxLines || params.taxLines.length === 0) {
            return {
                totalTax: 0,
                rows: [],
            };
        }
        const ids = [...new Set(params.taxLines.map((t) => t.taxRateId))];
        const rates = await this.prisma.taxRate.findMany({
            where: {
                tenantId: params.tenantId,
                id: { in: ids },
                isActive: true,
                type: params.expectedRateType,
            },
            select: {
                id: true,
                rate: true,
                type: true,
                glAccountId: true,
                isActive: true,
            },
        });
        const rateById = new Map(rates.map((r) => [r.id, r]));
        for (const id of ids) {
            if (!rateById.get(id)) {
                throw new common_1.BadRequestException(`TaxRate not found/active or wrong type: ${id}`);
            }
        }
        const rows = params.taxLines.map((t) => ({
            taxRateId: t.taxRateId,
            taxableAmount: this.round2(t.taxableAmount ?? 0),
            taxAmount: this.round2(t.taxAmount ?? 0),
        }));
        const totalTaxable = this.round2(rows.reduce((s, r) => s + r.taxableAmount, 0));
        if (totalTaxable !== this.round2(params.netAmount)) {
            throw new common_1.BadRequestException({
                error: 'Taxable amounts must sum to invoice net amount',
                netAmount: this.round2(params.netAmount),
                totalTaxable,
            });
        }
        for (const r of rows) {
            const rate = rateById.get(r.taxRateId);
            const expected = this.round2(r.taxableAmount * Number(rate?.rate ?? 0));
            if (r.taxAmount !== expected) {
                throw new common_1.BadRequestException({
                    error: 'Tax line failed validation: taxableAmount × rate must equal taxAmount',
                    taxRateId: r.taxRateId,
                    taxableAmount: r.taxableAmount,
                    rate: Number(rate?.rate ?? 0),
                    expectedTaxAmount: expected,
                    taxAmount: r.taxAmount,
                });
            }
        }
        const totalTax = this.round2(rows.reduce((s, r) => s + r.taxAmount, 0));
        return { totalTax, rows };
    }
    async assertTaxIntegrityBeforeSubmit(params) {
        const inv = await this.prisma.supplierInvoice.findFirst({
            where: { id: params.invoiceId, tenantId: params.tenantId },
            include: { lines: true },
        });
        if (!inv) {
            throw new common_1.BadRequestException('Invoice not found');
        }
        const netAmount = this.round2(inv.lines.reduce((s, l) => s + Number(l.amount), 0));
        const taxLines = await this.prisma.invoiceTaxLine.findMany({
            where: {
                tenantId: params.tenantId,
                sourceType: 'SUPPLIER_INVOICE',
                sourceId: inv.id,
            },
            include: {
                taxRate: {
                    select: { id: true, type: true, isActive: true, rate: true },
                },
            },
        });
        if (taxLines.length === 0) {
            return;
        }
        const totalTaxable = this.round2(taxLines.reduce((s, t) => s + Number(t.taxableAmount), 0));
        if (totalTaxable !== this.round2(netAmount)) {
            throw new common_1.BadRequestException('Invoice tax taxableAmount does not equal net amount');
        }
        for (const t of taxLines) {
            if (!t.taxRate.isActive || t.taxRate.type !== 'INPUT') {
                throw new common_1.BadRequestException('Invoice has invalid or inactive INPUT VAT rate');
            }
            const expected = this.round2(Number(t.taxableAmount) * Number(t.taxRate.rate));
            if (this.round2(Number(t.taxAmount)) !== expected) {
                throw new common_1.BadRequestException('Invoice VAT line failed validation');
            }
        }
        const totalTax = this.round2(taxLines.reduce((s, t) => s + Number(t.taxAmount), 0));
        const expectedGross = this.round2(netAmount + totalTax);
        if (this.round2(Number(inv.totalAmount)) !== expectedGross) {
            throw new common_1.BadRequestException('Invoice totalAmount must equal net + VAT');
        }
    }
    async listInvoices(req) {
        const tenant = req.tenant;
        if (!tenant) {
            throw new common_1.BadRequestException('Missing tenant context');
        }
        return this.prisma.supplierInvoice.findMany({
            where: { tenantId: tenant.id },
            orderBy: { createdAt: 'desc' },
            include: { supplier: true, lines: true },
        });
    }
    assertInvoiceLines(lines, totalAmount) {
        if (!lines || lines.length < 1) {
            throw new common_1.BadRequestException('Invoice must have at least 1 line');
        }
        for (const l of lines) {
            if ((l.amount ?? 0) <= 0) {
                throw new common_1.BadRequestException('Invoice line amount must be greater than zero');
            }
        }
        const round2 = (n) => Math.round(n * 100) / 100;
        const sum = round2(lines.reduce((s, l) => s + (l.amount ?? 0), 0));
        const total = round2(totalAmount ?? 0);
        if (sum !== total) {
            throw new common_1.BadRequestException({
                error: 'Invoice lines do not sum to totalAmount',
                sum,
                totalAmount: total,
            });
        }
    }
};
exports.ApService = ApService;
exports.ApService = ApService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ApService);
//# sourceMappingURL=ap.service.js.map