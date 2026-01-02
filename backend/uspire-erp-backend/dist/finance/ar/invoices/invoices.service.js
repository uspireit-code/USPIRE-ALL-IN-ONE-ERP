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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceArInvoicesService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const exceljs_1 = __importDefault(require("exceljs"));
const prisma_service_1 = require("../../../prisma/prisma.service");
let FinanceArInvoicesService = class FinanceArInvoicesService {
    prisma;
    INVOICE_NUMBER_SEQUENCE_NAME = 'AR_INVOICE_NUMBER';
    OPENING_PERIOD_NAME = 'Opening Balances';
    constructor(prisma) {
        this.prisma = prisma;
    }
    round2(n) {
        return Math.round(Number(n ?? 0) * 100) / 100;
    }
    round6(n) {
        return Math.round(this.toNum(n) * 1_000_000) / 1_000_000;
    }
    formatMoney(amount, _currency) {
        const n = this.round2(this.toNum(amount ?? 0));
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(n);
    }
    computeDiscount(params) {
        const gross = this.round2(this.toNum(params.gross ?? 0));
        const discountPercent = this.round6(this.toNum(params.discountPercent ?? 0));
        const discountAmount = this.round2(this.toNum(params.discountAmount ?? 0));
        const hasPercent = discountPercent > 0;
        const hasAmount = discountAmount > 0;
        if (hasPercent && hasAmount) {
            throw new common_1.BadRequestException('Invoice line discountPercent and discountAmount are mutually exclusive');
        }
        if (discountPercent < 0 || discountPercent > 100) {
            throw new common_1.BadRequestException('Invoice line discountPercent must be between 0 and 100');
        }
        if (discountAmount < 0) {
            throw new common_1.BadRequestException('Invoice line discountAmount must be >= 0');
        }
        const computedDiscountTotal = hasPercent
            ? this.round2(gross * (discountPercent / 100))
            : hasAmount
                ? this.round2(discountAmount)
                : 0;
        if (computedDiscountTotal > gross) {
            throw new common_1.BadRequestException('Invoice line discount cannot exceed gross amount');
        }
        return {
            discountPercent: hasPercent ? discountPercent : null,
            discountAmount: hasAmount ? discountAmount : null,
            discountTotal: computedDiscountTotal,
        };
    }
    escapeHtml(v) {
        return String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
    normalizeHeaderKey(v) {
        return String(v ?? '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9]/g, '');
    }
    parseCsvRows(buf) {
        const text = buf.toString('utf8');
        const lines = text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .split('\n')
            .filter((l) => l.trim().length > 0);
        if (lines.length === 0)
            return [];
        const parseLine = (line) => {
            const out = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        cur += '"';
                        i++;
                    }
                    else {
                        inQuotes = !inQuotes;
                    }
                    continue;
                }
                if (ch === ',' && !inQuotes) {
                    out.push(cur);
                    cur = '';
                    continue;
                }
                cur += ch;
            }
            out.push(cur);
            return out;
        };
        const headers = parseLine(lines[0]).map((h) => this.normalizeHeaderKey(h));
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = parseLine(lines[i]);
            const row = {};
            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = String(cols[j] ?? '').trim();
            }
            const hasAny = Object.values(row).some((v) => String(v ?? '').trim() !== '');
            if (hasAny)
                rows.push({ rowNumber: i + 1, row });
        }
        return rows;
    }
    async readXlsxRows(buf) {
        const wb = new exceljs_1.default.Workbook();
        await wb.xlsx.load(buf);
        const ws = wb.worksheets[0];
        if (!ws)
            return [];
        const headerRow = ws.getRow(1);
        const headers = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const raw = cell.value?.text ?? cell.value;
            headers[colNumber - 1] = this.normalizeHeaderKey(raw);
        });
        const rows = [];
        ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1)
                return;
            const obj = {};
            headers.forEach((h, idx) => {
                const cell = row.getCell(idx + 1);
                const v = cell.value?.text ?? cell.value;
                obj[h] = v;
            });
            const hasAny = Object.values(obj).some((v) => String(v ?? '').trim() !== '');
            if (hasAny)
                rows.push({ rowNumber, row: obj });
        });
        return rows;
    }
    parseYmdToDateOrNull(v) {
        const s = String(v ?? '').trim();
        if (!s)
            return null;
        const d = new Date(s);
        if (Number.isNaN(d.getTime()))
            return null;
        return d;
    }
    toNum(v) {
        if (v === null || v === undefined)
            return 0;
        if (typeof v === 'number')
            return Number.isFinite(v) ? v : 0;
        const n = Number(String(v).trim());
        return Number.isFinite(n) ? n : 0;
    }
    async assertOpenPeriodForInvoiceDate(params) {
        const period = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: params.tenantId,
                startDate: { lte: params.invoiceDate },
                endDate: { gte: params.invoiceDate },
            },
            select: { id: true, status: true, name: true, startDate: true },
        });
        if (!period || period.status !== 'OPEN') {
            throw new common_1.ForbiddenException(!period
                ? 'Invoice date must fall within an OPEN accounting period'
                : `Invoice date period is not OPEN: ${period.name}`);
        }
        if (period.name === this.OPENING_PERIOD_NAME) {
            throw new common_1.ForbiddenException('Operational postings are not allowed in the Opening Balances period');
        }
        const cutoverLocked = await this.prisma.accountingPeriod.findFirst({
            where: {
                tenantId: params.tenantId,
                name: this.OPENING_PERIOD_NAME,
                status: 'CLOSED',
            },
            orderBy: { startDate: 'desc' },
            select: { startDate: true },
        });
        if (cutoverLocked && params.invoiceDate < cutoverLocked.startDate) {
            throw new common_1.ForbiddenException(`Invoice date is before cutover and cannot be used (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`);
        }
    }
    async nextInvoiceNumber(tx, tenantId) {
        const counter = await tx.tenantSequenceCounter.upsert({
            where: {
                tenantId_name: {
                    tenantId,
                    name: this.INVOICE_NUMBER_SEQUENCE_NAME,
                },
            },
            create: {
                tenantId,
                name: this.INVOICE_NUMBER_SEQUENCE_NAME,
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
        return `INV-${String(bumped.value).padStart(6, '0')}`;
    }
    async computeOutstandingBalance(params) {
        const g = await this.prisma.customerReceiptLine.groupBy({
            by: ['invoiceId'],
            where: {
                tenantId: params.tenantId,
                invoiceId: params.invoiceId,
                receipt: {
                    tenantId: params.tenantId,
                    status: 'POSTED',
                },
            },
            _sum: { appliedAmount: true },
        });
        const applied = this.round2(Number(g?.[0]?._sum?.appliedAmount ?? 0));
        const total = this.round2(Number(params.totalAmount ?? 0));
        return this.round2(total - applied);
    }
    async list(req, q) {
        const tenant = this.ensureTenant(req);
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? 50;
        const where = { tenantId: tenant.id };
        if (q.status)
            where.status = q.status;
        if (q.customerId)
            where.customerId = q.customerId;
        if (q.search) {
            const s = String(q.search).trim();
            if (s) {
                where.OR = [
                    { invoiceNumber: { contains: s, mode: 'insensitive' } },
                    { reference: { contains: s, mode: 'insensitive' } },
                    { customer: { name: { contains: s, mode: 'insensitive' } } },
                ];
            }
        }
        const [total, items] = await Promise.all([
            this.prisma.customerInvoice.count({ where }),
            this.prisma.customerInvoice.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: { customer: true },
            }),
        ]);
        const rows = await Promise.all((items ?? []).map(async (inv) => ({
            ...inv,
            subtotal: Number(inv.subtotal),
            taxAmount: Number(inv.taxAmount),
            totalAmount: Number(inv.totalAmount),
            outstandingBalance: await this.computeOutstandingBalance({
                tenantId: tenant.id,
                invoiceId: inv.id,
                totalAmount: Number(inv.totalAmount),
            }),
        })));
        return { page, pageSize, total, items: rows };
    }
    async getById(req, id) {
        const tenant = this.ensureTenant(req);
        const inv = await this.prisma.customerInvoice.findFirst({
            where: { id, tenantId: tenant.id },
            include: { customer: true, lines: true },
        });
        if (!inv)
            throw new common_1.NotFoundException('Invoice not found');
        return {
            ...inv,
            subtotal: Number(inv.subtotal),
            taxAmount: Number(inv.taxAmount),
            totalAmount: Number(inv.totalAmount),
            lines: inv.lines.map((l) => ({
                ...l,
                quantity: Number(l.quantity),
                unitPrice: Number(l.unitPrice),
                discountPercent: l.discountPercent === null || l.discountPercent === undefined ? l.discountPercent : Number(l.discountPercent),
                discountAmount: l.discountAmount === null || l.discountAmount === undefined ? l.discountAmount : Number(l.discountAmount),
                discountTotal: l.discountTotal === null || l.discountTotal === undefined ? l.discountTotal : Number(l.discountTotal),
                lineTotal: Number(l.lineTotal),
            })),
            outstandingBalance: await this.computeOutstandingBalance({
                tenantId: tenant.id,
                invoiceId: inv.id,
                totalAmount: Number(inv.totalAmount),
            }),
        };
    }
    async create(req, dto) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const invoiceDate = this.parseYmdToDateOrNull(dto.invoiceDate);
        const dueDate = this.parseYmdToDateOrNull(dto.dueDate);
        if (!invoiceDate)
            throw new common_1.BadRequestException('invoiceDate is required');
        if (!dueDate)
            throw new common_1.BadRequestException('dueDate is required');
        if (dueDate < invoiceDate) {
            throw new common_1.BadRequestException('Due date cannot be earlier than invoice date');
        }
        await this.assertOpenPeriodForInvoiceDate({ tenantId: tenant.id, invoiceDate });
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
            select: { id: true, status: true, name: true, email: true, billingAddress: true },
        });
        if (!customer)
            throw new common_1.BadRequestException('Customer not found');
        if (customer.status !== 'ACTIVE') {
            throw new common_1.BadRequestException('Customer is inactive and cannot be used for new transactions.');
        }
        if (!dto.lines || dto.lines.length < 1) {
            throw new common_1.BadRequestException('Invoice must have at least 1 line');
        }
        const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
        const accounts = await this.prisma.account.findMany({
            where: {
                tenantId: tenant.id,
                id: { in: accountIds },
                isActive: true,
            },
            select: { id: true, type: true },
        });
        const byId = new Map(accounts.map((a) => [a.id, a]));
        const computedLines = dto.lines.map((l) => {
            const qty = this.toNum(l.quantity ?? 1);
            const unitPrice = this.toNum(l.unitPrice);
            const description = String(l.description ?? '').trim();
            if (!l.accountId)
                throw new common_1.BadRequestException('Invoice line missing accountId');
            if (!description)
                throw new common_1.BadRequestException('Invoice line description is required');
            if (!(qty > 0))
                throw new common_1.BadRequestException('Invoice line quantity must be > 0');
            if (!(unitPrice > 0))
                throw new common_1.BadRequestException('Invoice line unitPrice must be > 0');
            const acct = byId.get(l.accountId);
            if (!acct) {
                throw new common_1.BadRequestException(`Account not found or inactive: ${l.accountId}`);
            }
            if (acct.type !== 'INCOME') {
                throw new common_1.BadRequestException(`Invoice line account must be INCOME: ${l.accountId}`);
            }
            const gross = this.round2(qty * unitPrice);
            const disc = this.computeDiscount({
                gross,
                discountPercent: l.discountPercent,
                discountAmount: l.discountAmount,
            });
            const lineTotal = this.round2(gross - disc.discountTotal);
            return {
                accountId: l.accountId,
                description,
                quantity: qty,
                unitPrice,
                discountPercent: disc.discountPercent,
                discountAmount: disc.discountAmount,
                discountTotal: disc.discountTotal,
                lineTotal,
            };
        });
        const subtotal = this.round2(computedLines.reduce((s, l) => s + l.lineTotal, 0));
        const discountTotal = this.round2(computedLines.reduce((s, l) => s + this.toNum(l.discountTotal ?? 0), 0));
        const taxAmount = 0;
        const totalAmount = this.round2(subtotal + taxAmount);
        const created = await this.prisma.$transaction(async (tx) => {
            const invoiceNumber = await this.nextInvoiceNumber(tx, tenant.id);
            return tx.customerInvoice.create({
                data: {
                    tenantId: tenant.id,
                    customerId: dto.customerId,
                    invoiceNumber,
                    invoiceDate,
                    dueDate,
                    currency,
                    exchangeRate,
                    reference: dto.reference ? String(dto.reference).trim() : undefined,
                    invoiceNote: dto.invoiceNote ? String(dto.invoiceNote).trim() : undefined,
                    customerNameSnapshot: String(customer.name ?? '').trim(),
                    customerEmailSnapshot: customer.email ? String(customer.email).trim() : undefined,
                    customerBillingAddressSnapshot: customer.billingAddress ? String(customer.billingAddress).trim() : undefined,
                    subtotal,
                    taxAmount,
                    totalAmount,
                    status: 'DRAFT',
                    createdById: user.id,
                    lines: {
                        create: computedLines.map((l) => ({
                            accountId: l.accountId,
                            description: l.description,
                            quantity: l.quantity,
                            unitPrice: l.unitPrice,
                            discountPercent: l.discountPercent ?? undefined,
                            discountAmount: l.discountAmount ?? undefined,
                            discountTotal: l.discountTotal ?? 0,
                            lineTotal: l.lineTotal,
                        })),
                    },
                },
                include: { customer: true, lines: true },
            });
        });
        return this.getById(req, created.id);
    }
    async post(req, id, opts) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const inv = await this.prisma.customerInvoice.findFirst({
            where: { id, tenantId: tenant.id },
            include: { lines: true },
        });
        if (!inv)
            throw new common_1.NotFoundException('Invoice not found');
        if (inv.status === 'POSTED') {
            throw new common_1.BadRequestException('Invoice is already posted');
        }
        if (inv.dueDate && inv.invoiceDate && inv.dueDate < inv.invoiceDate) {
            throw new common_1.BadRequestException('Due date cannot be earlier than invoice date');
        }
        await this.assertOpenPeriodForInvoiceDate({ tenantId: tenant.id, invoiceDate: inv.invoiceDate });
        const arCode = String(opts?.arControlAccountCode ?? '1100');
        const arAccount = await this.prisma.account.findFirst({
            where: {
                tenantId: tenant.id,
                code: arCode,
                isActive: true,
                type: 'ASSET',
            },
            select: { id: true, code: true, name: true },
        });
        if (!arAccount) {
            throw new common_1.BadRequestException(`AR control account not found or invalid: ${arCode}`);
        }
        const lines = (inv.lines ?? []).map((l) => ({
            accountId: l.accountId,
            lineTotal: this.round2(Number(l.lineTotal)),
        }));
        if (lines.length < 1)
            throw new common_1.BadRequestException('Invoice must have at least 1 line');
        const creditsTotal = this.round2(lines.reduce((s, l) => s + l.lineTotal, 0));
        const invTotal = this.round2(Number(inv.totalAmount));
        if (creditsTotal !== invTotal) {
            throw new common_1.BadRequestException('Invoice totals failed validation before posting');
        }
        let postedJournal = null;
        try {
            const journal = await this.prisma.journalEntry.create({
                data: {
                    tenantId: tenant.id,
                    journalDate: inv.invoiceDate,
                    reference: `AR-INVOICE:${inv.id}`,
                    description: `AR invoice posting: ${inv.invoiceNumber}`,
                    createdById: inv.createdById,
                    lines: {
                        create: [
                            {
                                accountId: arAccount.id,
                                debit: inv.totalAmount,
                                credit: 0,
                            },
                            ...lines.map((l) => ({
                                accountId: l.accountId,
                                debit: 0,
                                credit: l.lineTotal,
                            })),
                        ],
                    },
                },
                include: { lines: true },
            });
            postedJournal = await this.prisma.journalEntry.update({
                where: { id: journal.id },
                data: {
                    status: 'POSTED',
                    postedById: user.id,
                    postedAt: new Date(),
                },
                include: { lines: true },
            });
            const updated = await this.prisma.customerInvoice.update({
                where: { id: inv.id },
                data: {
                    status: 'POSTED',
                    postedById: user.id,
                    postedAt: new Date(),
                },
                include: { customer: true, lines: true },
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'AR_POST',
                    entityType: 'CUSTOMER_INVOICE',
                    entityId: String(inv.id),
                    action: 'AR_INVOICE_POST',
                    outcome: 'SUCCESS',
                    reason: JSON.stringify({ invoiceNumber: inv.invoiceNumber }),
                    userId: user.id,
                    permissionUsed: 'AR_INVOICE_POST',
                },
            })
                .catch(() => undefined);
            return { invoice: await this.getById(req, updated.id), glJournal: postedJournal };
        }
        catch (e) {
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'AR_POST',
                    entityType: 'CUSTOMER_INVOICE',
                    entityId: String(inv.id),
                    action: 'AR_INVOICE_POST',
                    outcome: 'FAILED',
                    reason: String(e?.message ?? 'Failed to post invoice'),
                    userId: user.id,
                    permissionUsed: 'AR_INVOICE_POST',
                },
            })
                .catch(() => undefined);
            throw e;
        }
    }
    async bulkPost(req, dto) {
        this.ensureTenant(req);
        this.ensureUser(req);
        const ids = Array.from(new Set((dto.invoiceIds ?? []).map((x) => String(x ?? '').trim()).filter(Boolean)));
        if (ids.length < 1)
            throw new common_1.BadRequestException('invoiceIds is required');
        const postedInvoiceIds = [];
        const failed = [];
        for (const invoiceId of ids) {
            try {
                await this.post(req, invoiceId, {
                    arControlAccountCode: dto.arControlAccountCode,
                });
                postedInvoiceIds.push(invoiceId);
            }
            catch (e) {
                failed.push({
                    invoiceId,
                    reason: String(e?.message ?? 'Failed to post invoice'),
                });
            }
        }
        return {
            postedCount: postedInvoiceIds.length,
            failedCount: failed.length,
            postedInvoiceIds,
            failed,
        };
    }
    async getImportCsvTemplate(req) {
        this.ensureTenant(req);
        const headers = [
            'rowType',
            'invoiceRef',
            'customerCode',
            'invoiceDate',
            'dueDate',
            'currency',
            'revenueAccountCode',
            'description',
            'quantity',
            'unitPrice',
            'discountPercent',
            'discountAmount',
        ];
        const fileName = `invoice_import_template.csv`;
        const sampleRows = [
            ['SAMPLE', 'INVREF-1001', 'CUST-001', '2026-01-01', '2026-01-31', 'USD', '4000', 'Consulting services - Phase 1', '1', '1500', '10', ''],
            ['SAMPLE', 'INVREF-1001', 'CUST-001', '2026-01-01', '2026-01-31', 'USD', '4000', 'Consulting services - Phase 2', '2', '750', '', '25.00'],
            ['SAMPLE', 'INVREF-2001', 'CUST-002', '2026-01-05', '2026-02-05', 'USD', '4010', 'Monthly subscription', '1', '99', '', ''],
        ];
        const body = `${headers.join(',')}\n${sampleRows.map((r) => r.join(',')).join('\n')}\n`;
        return { fileName, body };
    }
    async getImportXlsxTemplate(req) {
        this.ensureTenant(req);
        const wb = new exceljs_1.default.Workbook();
        const ws = wb.addWorksheet('Invoices');
        ws.addRow([
            'rowType',
            'invoiceRef',
            'customerCode',
            'invoiceDate',
            'dueDate',
            'currency',
            'revenueAccountCode',
            'description',
            'quantity',
            'unitPrice',
            'discountPercent',
            'discountAmount',
        ]);
        try {
            ws.getCell('A1').note = 'Optional. Use SAMPLE to include example rows (ignored during preview/import). Leave blank for real data.';
            ws.getCell('B1').note = 'Required. Rows with the same invoiceRef are grouped into ONE invoice with multiple lines.';
            ws.getCell('C1').note = 'Required. Must be consistent for all rows within the same invoiceRef group.';
            ws.getCell('D1').note = 'Required. Must be consistent for all rows within the same invoiceRef group.';
            ws.getCell('E1').note = 'Required. Must be consistent for all rows within the same invoiceRef group. Must be >= Invoice Date.';
            ws.getCell('F1').note = 'Required. Use a valid ISO code (e.g. USD). Must be consistent within invoiceRef group.';
            ws.getCell('K1').note = 'Optional. Discount percent (0-100). Mutually exclusive with discountAmount.';
            ws.getCell('L1').note = 'Optional. Discount amount (>= 0). Mutually exclusive with discountPercent.';
        }
        catch {
        }
        ws.addRow(['SAMPLE', 'INVREF-1001', 'CUST-001', '2026-01-01', '2026-01-31', 'USD', '4000', 'Consulting services - Phase 1', 1, 1500, 10, null]);
        ws.addRow(['SAMPLE', 'INVREF-1001', 'CUST-001', '2026-01-01', '2026-01-31', 'USD', '4000', 'Consulting services - Phase 2', 2, 750, null, 25]);
        ws.addRow(['SAMPLE', 'INVREF-2001', 'CUST-002', '2026-01-05', '2026-02-05', 'USD', '4010', 'Monthly subscription', 1, 99, null, null]);
        const fileName = `invoice_import_template.xlsx`;
        const body = await wb.xlsx.writeBuffer();
        return { fileName, body };
    }
    async readImportRows(file) {
        if (!file?.buffer)
            throw new common_1.BadRequestException('Missing file');
        const name = String(file.originalname ?? '').toLowerCase();
        const buf = file.buffer;
        if (name.endsWith('.xlsx')) {
            return this.readXlsxRows(buf);
        }
        return this.parseCsvRows(buf).map((r) => ({ rowNumber: r.rowNumber, row: r.row }));
    }
    async previewImport(req, file, opts) {
        const tenant = this.ensureTenant(req);
        const importId = String(opts?.importId ?? '').trim() || (0, crypto_1.randomUUID)();
        const rows = await this.readImportRows(file);
        const parsedAll = rows.map((r) => {
            const raw = r.row;
            const rowTypeRaw = String(raw.rowtype ?? raw.row_type ?? raw.type ?? raw.flag ?? '').trim();
            const isSample = rowTypeRaw.toUpperCase() === 'SAMPLE';
            const invoiceRef = String(raw.invoiceref ?? raw.invoice_ref ?? raw.invoicereference ?? '').trim();
            const customerCode = String(raw.customercode ?? raw.customer_code ?? raw.customer ?? '').trim();
            const invoiceDate = String(raw.invoicedate ?? raw.invoice_date ?? '').trim();
            const dueDate = String(raw.duedate ?? raw.due_date ?? '').trim();
            const revenueAccountCode = String(raw.revenueaccountcode ?? raw.revenue_account_code ?? raw.accountcode ?? raw.account_code ?? '').trim();
            const description = String(raw.description ?? '').trim();
            const quantity = this.toNum(raw.quantity ?? 1);
            const unitPrice = this.toNum(raw.unitprice ?? raw.unit_price ?? 0);
            const currency = String(raw.currency ?? '').trim();
            const discountPercent = raw.discountpercent ?? raw.discount_percent ?? raw.discpercent ?? raw.disc_percent;
            const discountAmount = raw.discountamount ?? raw.discount_amount ?? raw.discamount ?? raw.disc_amount;
            const errors = [];
            if (isSample) {
                return {
                    rowNumber: r.rowNumber,
                    invoiceRef,
                    customerCode,
                    invoiceDate,
                    dueDate,
                    revenueAccountCode,
                    description,
                    quantity,
                    unitPrice,
                    currency,
                    discountPercent,
                    discountAmount,
                    errors,
                    _isSample: true,
                };
            }
            if (!invoiceRef)
                errors.push('invoiceRef is required');
            if (!customerCode)
                errors.push('Customer Code is required');
            if (!invoiceDate || !this.parseYmdToDateOrNull(invoiceDate))
                errors.push('Invoice Date is required and must be a valid date');
            if (!dueDate || !this.parseYmdToDateOrNull(dueDate))
                errors.push('Due Date is required and must be a valid date');
            if (!currency)
                errors.push('Currency is required');
            if (!revenueAccountCode)
                errors.push('Revenue Account Code is required');
            if (!description)
                errors.push('Description is required');
            if (!(quantity > 0))
                errors.push('Quantity must be > 0');
            if (!(unitPrice > 0))
                errors.push('Unit Price must be > 0');
            if (errors.length === 0) {
                try {
                    const gross = this.round2(this.toNum(quantity) * this.toNum(unitPrice));
                    this.computeDiscount({
                        gross,
                        discountPercent,
                        discountAmount,
                    });
                }
                catch (e) {
                    errors.push(String(e?.message ?? 'Invalid discount'));
                }
            }
            const invDateObj = this.parseYmdToDateOrNull(invoiceDate);
            const dueDateObj = this.parseYmdToDateOrNull(dueDate);
            if (invDateObj && dueDateObj && dueDateObj < invDateObj) {
                errors.push('Due Date cannot be earlier than Invoice Date');
            }
            return {
                rowNumber: r.rowNumber,
                invoiceRef,
                customerCode,
                invoiceDate,
                dueDate,
                revenueAccountCode,
                description,
                quantity,
                unitPrice,
                currency,
                discountPercent,
                discountAmount,
                errors,
                _isSample: false,
            };
        });
        const parsed = (parsedAll ?? []).filter((p) => !p._isSample);
        const customerCodes = [...new Set(parsed.map((p) => p.customerCode).filter(Boolean))];
        const accountCodes = [...new Set(parsed.map((p) => p.revenueAccountCode).filter(Boolean))];
        const [customersRaw, accountsRaw] = await Promise.all([
            this.prisma.customer.findMany({
                where: { tenantId: tenant.id, customerCode: { in: customerCodes } },
                select: { id: true, customerCode: true, status: true },
            }),
            this.prisma.account.findMany({
                where: { tenantId: tenant.id, code: { in: accountCodes }, isActive: true },
                select: { id: true, code: true, type: true },
            }),
        ]);
        const customers = (customersRaw ?? []);
        const accounts = (accountsRaw ?? []);
        const customerByCode = new Map(customers.map((c) => [String(c.customerCode), c]));
        const accountByCode = new Map(accounts.map((a) => [String(a.code), a]));
        for (const p of parsed) {
            if (p.customerCode) {
                const c = customerByCode.get(p.customerCode);
                if (!c)
                    p.errors.push('Customer not found');
                else if (c.status !== 'ACTIVE')
                    p.errors.push('Customer is inactive');
            }
            if (p.revenueAccountCode) {
                const a = accountByCode.get(p.revenueAccountCode);
                if (!a)
                    p.errors.push('Revenue account not found or inactive');
                else if (a.type !== 'INCOME')
                    p.errors.push('Revenue account must be INCOME');
            }
            const invDate = this.parseYmdToDateOrNull(p.invoiceDate);
            if (invDate) {
                try {
                    await this.assertOpenPeriodForInvoiceDate({ tenantId: tenant.id, invoiceDate: invDate });
                }
                catch (e) {
                    p.errors.push(String(e?.message ?? 'Invoice Date period is not OPEN'));
                }
            }
        }
        const groups = new Map();
        for (const p of parsed) {
            const key = String(p.invoiceRef ?? '').trim();
            if (!key)
                continue;
            const prev = groups.get(key) ?? [];
            prev.push(p);
            groups.set(key, prev);
        }
        for (const [invoiceRef, rows] of groups.entries()) {
            if (!rows || rows.length < 2)
                continue;
            const base = rows[0];
            const baseCustomer = String(base.customerCode ?? '').trim();
            const baseCurrency = String(base.currency ?? '').trim().toUpperCase();
            const baseInvDate = String(base.invoiceDate ?? '').trim();
            const baseDueDate = String(base.dueDate ?? '').trim();
            const mixedCustomer = rows.some((r) => String(r.customerCode ?? '').trim() !== baseCustomer);
            const mixedCurrency = rows.some((r) => String(r.currency ?? '').trim().toUpperCase() !== baseCurrency);
            const mixedInvDate = rows.some((r) => String(r.invoiceDate ?? '').trim() !== baseInvDate);
            const mixedDueDate = rows.some((r) => String(r.dueDate ?? '').trim() !== baseDueDate);
            if (!mixedCustomer && !mixedCurrency && !mixedInvDate && !mixedDueDate)
                continue;
            for (const r of rows) {
                if (mixedCustomer)
                    r.errors.push(`Mixed customers in invoiceRef group: ${invoiceRef}`);
                if (mixedCurrency)
                    r.errors.push(`Mixed currencies in invoiceRef group: ${invoiceRef}`);
                if (mixedInvDate || mixedDueDate)
                    r.errors.push(`Mixed invoice/due dates in invoiceRef group: ${invoiceRef}`);
            }
        }
        const validCount = parsed.filter((p) => p.errors.length === 0).length;
        const invalidCount = parsed.length - validCount;
        return {
            importId,
            totalRows: parsed.length,
            validCount,
            invalidCount,
            rows: parsed,
        };
    }
    async import(req, file, importIdRaw) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const importId = String(importIdRaw ?? '').trim();
        if (!importId)
            throw new common_1.BadRequestException('importId is required');
        try {
            await this.prisma.customerInvoiceImportLog.create({
                data: {
                    tenantId: tenant.id,
                    importId,
                    processedById: user.id,
                },
            });
        }
        catch (e) {
            const code = String(e?.code ?? '');
            if (code === 'P2002') {
                throw new common_1.BadRequestException('This import has already been processed.');
            }
            throw e;
        }
        const preview = await this.previewImport(req, file, { importId });
        const validRows = preview.rows.filter((r) => (r.errors ?? []).length === 0);
        const failedRows = preview.rows
            .filter((r) => (r.errors ?? []).length > 0)
            .map((r) => ({ rowNumber: r.rowNumber, reason: (r.errors ?? []).join('; ') }));
        if (validRows.length === 0) {
            return {
                totalRows: preview.totalRows,
                createdCount: 0,
                failedCount: failedRows.length,
                failedRows,
            };
        }
        const customerCodes = [...new Set(validRows.map((r) => r.customerCode))];
        const accountCodes = [...new Set(validRows.map((r) => r.revenueAccountCode))];
        const [customers, accounts] = await Promise.all([
            this.prisma.customer.findMany({
                where: { tenantId: tenant.id, customerCode: { in: customerCodes } },
                select: { id: true, customerCode: true },
            }),
            this.prisma.account.findMany({
                where: { tenantId: tenant.id, code: { in: accountCodes }, isActive: true, type: 'INCOME' },
                select: { id: true, code: true },
            }),
        ]);
        const customerIdByCode = new Map(customers.map((c) => [String(c.customerCode), c.id]));
        const accountIdByCode = new Map(accounts.map((a) => [String(a.code), a.id]));
        const groups = new Map();
        for (const r of validRows) {
            const key = String(r.invoiceRef ?? '').trim();
            if (!key)
                continue;
            const prev = groups.get(key) ?? [];
            prev.push(r);
            groups.set(key, prev);
        }
        let createdCount = 0;
        for (const [, rows] of groups.entries()) {
            try {
                const first = rows[0];
                const customerId = customerIdByCode.get(first.customerCode);
                const invoiceDate = this.parseYmdToDateOrNull(first.invoiceDate);
                const dueDate = this.parseYmdToDateOrNull(first.dueDate);
                if (!customerId || !invoiceDate || !dueDate) {
                    throw new common_1.BadRequestException('Invalid grouping key');
                }
                if (dueDate < invoiceDate) {
                    throw new common_1.BadRequestException('Due date cannot be earlier than invoice date');
                }
                await this.assertOpenPeriodForInvoiceDate({ tenantId: tenant.id, invoiceDate });
                const customer = await this.prisma.customer.findFirst({
                    where: { tenantId: tenant.id, id: customerId },
                    select: { id: true, status: true, name: true, email: true, billingAddress: true },
                });
                if (!customer)
                    throw new common_1.BadRequestException('Customer not found');
                if (customer.status !== 'ACTIVE')
                    throw new common_1.BadRequestException('Customer is inactive');
                const tenantCurrency = String(tenant?.defaultCurrency ?? '').trim();
                const exchangeRate = tenantCurrency && String(first.currency).trim().toUpperCase() === tenantCurrency.toUpperCase()
                    ? 1
                    : 1;
                const computedLines = rows.map((rr) => {
                    const accountId = accountIdByCode.get(rr.revenueAccountCode);
                    if (!accountId)
                        throw new common_1.BadRequestException('Revenue account not found');
                    const qty = this.toNum(rr.quantity ?? 1);
                    const unitPrice = this.toNum(rr.unitPrice ?? 0);
                    if (!(qty > 0))
                        throw new common_1.BadRequestException('Quantity must be > 0');
                    if (!(unitPrice > 0))
                        throw new common_1.BadRequestException('Unit Price must be > 0');
                    const gross = this.round2(qty * unitPrice);
                    const disc = this.computeDiscount({
                        gross,
                        discountPercent: rr.discountPercent,
                        discountAmount: rr.discountAmount,
                    });
                    const lineTotal = this.round2(gross - disc.discountTotal);
                    return {
                        accountId,
                        description: String(rr.description ?? '').trim(),
                        quantity: qty,
                        unitPrice,
                        discountPercent: disc.discountPercent,
                        discountAmount: disc.discountAmount,
                        discountTotal: disc.discountTotal,
                        lineTotal,
                    };
                });
                const subtotal = this.round2(computedLines.reduce((s, l) => s + l.lineTotal, 0));
                const taxAmount = 0;
                const totalAmount = this.round2(subtotal + taxAmount);
                await this.prisma.$transaction(async (tx) => {
                    const invoiceNumber = await this.nextInvoiceNumber(tx, tenant.id);
                    await tx.customerInvoice.create({
                        data: {
                            tenantId: tenant.id,
                            customerId,
                            invoiceNumber,
                            invoiceDate,
                            dueDate,
                            currency: String(first.currency).trim(),
                            exchangeRate,
                            customerNameSnapshot: String(customer.name ?? '').trim(),
                            customerEmailSnapshot: customer.email ? String(customer.email).trim() : undefined,
                            customerBillingAddressSnapshot: customer.billingAddress ? String(customer.billingAddress).trim() : undefined,
                            subtotal,
                            taxAmount,
                            totalAmount,
                            status: 'DRAFT',
                            createdById: user.id,
                            lines: {
                                create: computedLines.map((l) => ({
                                    accountId: l.accountId,
                                    description: l.description,
                                    quantity: l.quantity,
                                    unitPrice: l.unitPrice,
                                    discountPercent: l.discountPercent ?? undefined,
                                    discountAmount: l.discountAmount ?? undefined,
                                    discountTotal: l.discountTotal ?? 0,
                                    lineTotal: l.lineTotal,
                                })),
                            },
                        },
                    });
                });
                createdCount += 1;
            }
            catch (e) {
                for (const rr of rows) {
                    failedRows.push({
                        rowNumber: rr.rowNumber,
                        reason: String(e?.message ?? 'Failed to create invoice'),
                    });
                }
            }
        }
        return {
            totalRows: preview.totalRows,
            createdCount,
            failedCount: failedRows.length,
            failedRows,
        };
    }
    async exportInvoice(req, id, opts) {
        const tenant = this.ensureTenant(req);
        const inv = await this.prisma.customerInvoice.findFirst({
            where: { id, tenantId: tenant.id },
            include: { lines: true, customer: true },
        });
        if (!inv)
            throw new common_1.NotFoundException('Invoice not found');
        if (inv.status !== 'POSTED') {
            throw new common_1.BadRequestException('Invoice export is available for POSTED invoices only');
        }
        const tenantName = String(tenant.legalName ?? tenant.organisationName ?? '');
        const invoiceNumber = String(inv.invoiceNumber ?? '').trim();
        const currency = String(inv.currency ?? '').trim();
        const invoiceNote = String(inv.invoiceNote ?? '').trim();
        const invLines = (inv.lines ?? []).map((l) => {
            const qty = Number(l.quantity ?? 0);
            const unitPrice = Number(l.unitPrice ?? 0);
            const discountTotal = Number(l.discountTotal ?? 0);
            const lineTotal = Number(l.lineTotal ?? 0);
            const discountPercent = Number(l.discountPercent ?? 0);
            const discountAmount = Number(l.discountAmount ?? 0);
            return {
                description: String(l.description ?? ''),
                qty,
                unitPrice,
                discountPercent,
                discountAmount,
                discountTotal,
                lineTotal,
            };
        });
        const hasDiscount = invLines.some((l) => (l.discountTotal ?? 0) > 0);
        const discountTotalSum = this.round2(invLines.reduce((s, l) => s + (Number(l.discountTotal ?? 0) || 0), 0));
        const grossSubtotal = this.round2(invLines.reduce((s, l) => s + this.round2(Number(l.qty ?? 0) * Number(l.unitPrice ?? 0)), 0));
        const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${invoiceNumber}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; color: #0B0C1E; margin: 32px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
      .brand h1 { margin: 0; font-size: 22px; }
      .muted { color: #667085; font-size: 12px; }
      .block { margin-top: 18px; }
      .row { display: flex; gap: 16px; }
      .card { border: 1px solid #E4E7EC; border-radius: 10px; padding: 14px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border-bottom: 1px solid #E4E7EC; padding: 10px 8px; font-size: 13px; }
      th { text-align: left; background: #F9FAFB; }
      td.num, th.num { text-align: right; }
      .totals { width: 320px; margin-left: auto; }
      .totals .line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
      .totals .grand { font-weight: 700; border-top: 1px solid #E4E7EC; margin-top: 8px; padding-top: 10px; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="brand">
        <h1>${tenantName || 'Invoice'}</h1>
        <div class="muted">Prepared in accordance with IFRS</div>
      </div>
      <div class="card" style="min-width: 280px;">
        <div><b>Invoice:</b> ${invoiceNumber}</div>
        <div><b>Date:</b> ${String(inv.invoiceDate).slice(0, 10)}</div>
        <div><b>Due:</b> ${String(inv.dueDate).slice(0, 10)}</div>
        <div><b>Currency:</b> ${currency}</div>
      </div>
    </div>

    <div class="row block">
      <div class="card" style="flex: 1;">
        <div style="font-weight: 700; margin-bottom: 6px;">Bill To</div>
        <div>${String(inv.customerNameSnapshot || inv.customer?.name || '').trim()}</div>
        ${inv.customerEmailSnapshot ? `<div class="muted">${String(inv.customerEmailSnapshot)}</div>` : ''}
        ${inv.customerBillingAddressSnapshot ? `<div class="muted" style="margin-top: 6px; white-space: pre-wrap;">${String(inv.customerBillingAddressSnapshot)}</div>` : ''}
      </div>
    </div>

    <div class="block">
      <table>
        <thead>
          <tr>
            <th class="num" style="width: 52px;">Line #</th>
            <th>Description</th>
            <th class="num">Qty</th>
            <th class="num">Unit Price</th>
            ${hasDiscount ? '<th class="num">Discount</th>' : ''}
            <th class="num">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${invLines
            .map((l, idx) => {
            const discountText = l.discountTotal > 0
                ? (l.discountPercent > 0 ? `${l.discountPercent.toFixed(2)}%` : `${this.formatMoney(l.discountTotal, currency)}`)
                : '';
            return `<tr>
                <td class="num">${idx + 1}</td>
                <td>${this.escapeHtml(l.description)}</td>
                <td class="num">${this.formatMoney(l.qty, currency)}</td>
                <td class="num">${this.formatMoney(l.unitPrice, currency)}</td>
                ${hasDiscount ? `<td class="num">${this.escapeHtml(discountText)}</td>` : ''}
                <td class="num">${this.formatMoney(l.lineTotal, currency)}</td>
              </tr>`;
        })
            .join('')}
        </tbody>
      </table>

      <div class="totals">
        ${hasDiscount ? `<div class="line"><span>Gross Subtotal</span><span>${this.formatMoney(grossSubtotal, currency)}</span></div>` : ''}
        ${hasDiscount ? `<div class="line"><span>Less: Discount</span><span>${this.formatMoney(discountTotalSum, currency)}</span></div>` : ''}
        <div class="line"><span>${hasDiscount ? 'Net Subtotal' : 'Subtotal'}</span><span>${this.formatMoney(Number(inv.subtotal ?? 0), currency)}</span></div>
        <div class="line"><span>Tax</span><span>${this.formatMoney(Number(inv.taxAmount ?? 0), currency)}</span></div>
        <div class="line grand"><span>Total</span><span>${this.formatMoney(Number(inv.totalAmount ?? 0), currency)}</span></div>
      </div>
    </div>

    <div class="block">
      <div class="card">
        <div style="font-weight: 700;">Bank Details</div>
        <div class="muted" style="margin-top: 6px;">
          Bank Name: FNB<br/>
          Account Name: Uspire Professional Services Ltd<br/>
          Account Number: 63144493680<br/>
          Branch Name/Number: Commercial Suite / 260001<br/>
          Swift Code: FIRNZMLX
        </div>
      </div>
    </div>

    ${invoiceNote ? `<div class="block"><div class="card"><div style="font-weight: 700;">Note</div><div style="margin-top: 6px; white-space: pre-wrap;">${this.escapeHtml(invoiceNote)}</div></div></div>` : ''}
  </body>
</html>`;
        if (opts.format === 'pdf') {
            let PDFDocument;
            try {
                PDFDocument = require('pdfkit');
            }
            catch {
                throw new common_1.BadRequestException('PDF export not available (missing dependency pdfkit)');
            }
            const doc = new PDFDocument({ size: 'A4', margin: 36 });
            const chunks = [];
            doc.on('data', (d) => chunks.push(Buffer.from(d)));
            const done = new Promise((resolve, reject) => {
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);
            });
            const page = {
                left: doc.page.margins.left,
                right: doc.page.margins.right,
                top: doc.page.margins.top,
                bottom: doc.page.margins.bottom,
                width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
                height: doc.page.height - doc.page.margins.top - doc.page.margins.bottom,
            };
            const colors = {
                text: '#0B0C1E',
                muted: '#667085',
                border: '#E4E7EC',
                headerBg: '#F9FAFB',
            };
            const font = {
                body: 'Helvetica',
                bold: 'Helvetica-Bold',
            };
            const invoiceDate = String(inv.invoiceDate).slice(0, 10);
            const dueDate = String(inv.dueDate).slice(0, 10);
            const billToName = String(inv.customerNameSnapshot || inv.customer?.name || '').trim();
            const billToEmail = inv.customerEmailSnapshot ? String(inv.customerEmailSnapshot).trim() : '';
            const billToAddress = inv.customerBillingAddressSnapshot
                ? String(inv.customerBillingAddressSnapshot).trim()
                : '';
            const drawDivider = (y) => {
                doc.save();
                doc.strokeColor(colors.border);
                doc.moveTo(page.left, y).lineTo(page.left + page.width, y).stroke();
                doc.restore();
            };
            const drawHeaderFirstPage = () => {
                doc.fillColor(colors.text);
                doc.font(font.bold).fontSize(20).text(tenantName || 'Invoice', page.left, doc.y, { align: 'left' });
                doc.moveDown(0.2);
                doc.font(font.body).fontSize(9).fillColor(colors.muted).text('Prepared in accordance with IFRS', { align: 'left' });
                doc.fillColor(colors.text);
                doc.moveDown(0.8);
                doc.font(font.bold).fontSize(24).text('INVOICE', { align: 'right' });
                doc.moveDown(0.2);
                const metaTopY = doc.y;
                const colGap = 18;
                const colWidth = (page.width - colGap) / 2;
                const leftX = page.left;
                const rightX = page.left + colWidth + colGap;
                doc.font(font.body).fontSize(10).fillColor(colors.text);
                const label = (t) => {
                    doc.font(font.bold).text(t);
                    doc.font(font.body);
                };
                doc.save();
                doc.x = leftX;
                doc.y = metaTopY;
                label('Invoice Number');
                doc.text(invoiceNumber || '');
                doc.moveDown(0.2);
                label('Invoice Date');
                doc.text(invoiceDate || '');
                doc.moveDown(0.2);
                label('Due Date');
                doc.text(dueDate || '');
                doc.restore();
                doc.save();
                doc.x = rightX;
                doc.y = metaTopY;
                label('Currency');
                doc.text(currency || '');
                doc.restore();
                const blockBottom = Math.max(doc.y, metaTopY + 54);
                doc.y = blockBottom + 12;
                drawDivider(doc.y);
                doc.moveDown(0.8);
                doc.font(font.bold).fontSize(11).fillColor(colors.text).text('Bill To', page.left, doc.y);
                doc.moveDown(0.3);
                doc.font(font.body).fontSize(10).text(billToName || '');
                if (billToEmail) {
                    doc.font(font.body).fillColor(colors.muted).text(billToEmail);
                    doc.fillColor(colors.text);
                }
                if (billToAddress) {
                    doc.font(font.body).fillColor(colors.muted).text(billToAddress, { width: page.width });
                    doc.fillColor(colors.text);
                }
                doc.moveDown(0.9);
                drawDivider(doc.y);
                doc.moveDown(0.8);
            };
            const startNewPage = () => {
                doc.addPage({ size: 'A4', margin: 36 });
                doc.fillColor(colors.text);
            };
            const colPaddingX = 6;
            const rowPaddingY = 6;
            const table = (() => {
                const qtyW = 40;
                const unitW = 92;
                const discW = hasDiscount ? 78 : 0;
                const totalW = 98;
                const descW = page.width - qtyW - unitW - discW - totalW;
                const qtyX = page.left;
                const descX = qtyX + qtyW;
                const unitX = descX + descW;
                const discX = unitX + unitW;
                const totalX = discX + discW;
                return {
                    qtyW,
                    descW,
                    unitW,
                    discW,
                    totalW,
                    qtyX,
                    descX,
                    unitX,
                    discX,
                    totalX,
                };
            })();
            const drawTableHeader = () => {
                const headerH = 22;
                const y0 = doc.y;
                const y1 = y0 + headerH;
                doc.save();
                doc.fillColor(colors.headerBg);
                doc.rect(page.left, y0, page.width, headerH).fill();
                doc.restore();
                doc.save();
                doc.strokeColor(colors.border);
                doc.rect(page.left, y0, page.width, headerH).stroke();
                doc.restore();
                doc.font(font.bold).fontSize(9).fillColor(colors.text);
                doc.text('Qty', table.qtyX + colPaddingX, y0 + 6, {
                    width: table.qtyW - colPaddingX * 2,
                    align: 'center',
                    lineBreak: false,
                });
                doc.text('Description', table.descX + colPaddingX, y0 + 6, {
                    width: table.descW - colPaddingX * 2,
                    align: 'left',
                    lineBreak: false,
                });
                doc.text('Unit Price', table.unitX + colPaddingX, y0 + 6, {
                    width: table.unitW - colPaddingX * 2,
                    align: 'right',
                    lineBreak: false,
                });
                if (hasDiscount) {
                    doc.fillColor(colors.muted);
                    doc.text('Discount', table.discX + colPaddingX, y0 + 6, {
                        width: table.discW - colPaddingX * 2,
                        align: 'right',
                        lineBreak: false,
                    });
                    doc.fillColor(colors.text);
                }
                doc.text('Line Total', table.totalX + colPaddingX, y0 + 6, {
                    width: table.totalW - colPaddingX * 2,
                    align: 'right',
                    lineBreak: false,
                });
                doc.y = y1;
            };
            const estimateTotalsHeight = () => {
                const totalsLines = hasDiscount ? 5 : 3;
                const totalsHeaderSpacing = 8;
                const lineH = 14;
                return totalsHeaderSpacing + totalsLines * lineH + 6;
            };
            const estimateBankDetailsHeight = () => {
                return 18 + 5 * 12 + 10;
            };
            const estimateNoteHeight = () => {
                if (!invoiceNote)
                    return 0;
                doc.font(font.body).fontSize(9);
                const h = doc.heightOfString(invoiceNote, { width: page.width });
                return 18 + h + 8;
            };
            const ensureSpace = (neededHeight, onNewPage) => {
                const bottomLimit = doc.page.height - doc.page.margins.bottom;
                if (doc.y + neededHeight > bottomLimit) {
                    startNewPage();
                    if (onNewPage)
                        onNewPage();
                }
            };
            drawHeaderFirstPage();
            ensureSpace(30, undefined);
            drawTableHeader();
            doc.font(font.body).fontSize(9).fillColor(colors.text);
            const minRowH = 18;
            invLines.forEach((l, idx) => {
                const discountText = hasDiscount
                    ? l.discountTotal > 0
                        ? (l.discountPercent > 0 ? `${l.discountPercent.toFixed(2)}%` : this.formatMoney(l.discountTotal, currency))
                        : ''
                    : '';
                doc.font(font.body).fontSize(9);
                const descText = String(l.description ?? '');
                const descH = doc.heightOfString(descText, {
                    width: table.descW - colPaddingX * 2,
                    align: 'left',
                });
                const rowH = Math.max(minRowH, descH + rowPaddingY * 2);
                ensureSpace(rowH + 6, () => {
                    drawTableHeader();
                    doc.font(font.body).fontSize(9).fillColor(colors.text);
                });
                const y0 = doc.y;
                doc.save();
                doc.strokeColor(colors.border);
                doc.moveTo(page.left, y0 + rowH).lineTo(page.left + page.width, y0 + rowH).stroke();
                doc.restore();
                doc.text(this.formatMoney(l.qty, currency), table.qtyX + colPaddingX, y0 + rowPaddingY, {
                    width: table.qtyW - colPaddingX * 2,
                    align: 'center',
                    lineBreak: false,
                });
                doc.text(descText, table.descX + colPaddingX, y0 + rowPaddingY, {
                    width: table.descW - colPaddingX * 2,
                    align: 'left',
                });
                doc.text(this.formatMoney(l.unitPrice, currency), table.unitX + colPaddingX, y0 + rowPaddingY, {
                    width: table.unitW - colPaddingX * 2,
                    align: 'right',
                    lineBreak: false,
                });
                if (hasDiscount) {
                    doc.fillColor(colors.muted);
                    doc.text(discountText, table.discX + colPaddingX, y0 + rowPaddingY, {
                        width: table.discW - colPaddingX * 2,
                        align: 'right',
                        lineBreak: false,
                    });
                    doc.fillColor(colors.text);
                }
                doc.text(this.formatMoney(l.lineTotal, currency), table.totalX + colPaddingX, y0 + rowPaddingY, {
                    width: table.totalW - colPaddingX * 2,
                    align: 'right',
                    lineBreak: false,
                });
                doc.y = y0 + rowH;
            });
            const totalsH = estimateTotalsHeight();
            const bankH = estimateBankDetailsHeight();
            const noteH = estimateNoteHeight();
            const reservedBottom = Math.max(bankH + 10, 0);
            const remainingBlocksH = totalsH + 16 + noteH + reservedBottom;
            ensureSpace(remainingBlocksH, undefined);
            doc.moveDown(0.8);
            const totalsBlockWidth = 240;
            const totalsX = page.left + page.width - totalsBlockWidth;
            const totalsLine = (label, value, opts) => {
                doc.font(opts?.bold ? font.bold : font.body).fontSize(10).fillColor(colors.text);
                const y = doc.y;
                doc.text(label, totalsX, y, { width: totalsBlockWidth * 0.62, align: 'left' });
                doc.text(value, totalsX + totalsBlockWidth * 0.62, y, { width: totalsBlockWidth * 0.38, align: 'right', lineBreak: false });
                doc.y = y + 14;
            };
            if (hasDiscount) {
                totalsLine('Gross Subtotal', this.formatMoney(grossSubtotal, currency));
                totalsLine('Less: Discount', this.formatMoney(discountTotalSum, currency));
                totalsLine('Net Subtotal', this.formatMoney(Number(inv.subtotal ?? 0), currency));
            }
            else {
                totalsLine('Subtotal', this.formatMoney(Number(inv.subtotal ?? 0), currency));
            }
            totalsLine('Tax', this.formatMoney(Number(inv.taxAmount ?? 0), currency));
            doc.save();
            doc.strokeColor(colors.border);
            doc.moveTo(totalsX, doc.y + 2).lineTo(totalsX + totalsBlockWidth, doc.y + 2).stroke();
            doc.restore();
            doc.y += 6;
            doc.font(font.bold).fontSize(11).fillColor(colors.text);
            const totalY = doc.y;
            doc.text('Total', totalsX, totalY, { width: totalsBlockWidth * 0.62, align: 'left' });
            doc.text(this.formatMoney(Number(inv.totalAmount ?? 0), currency), totalsX + totalsBlockWidth * 0.62, totalY, {
                width: totalsBlockWidth * 0.38,
                align: 'right',
                lineBreak: false,
            });
            doc.y = totalY + 16;
            if (invoiceNote) {
                doc.moveDown(0.8);
                doc.font(font.bold).fontSize(10).fillColor(colors.text).text('Invoice Note', page.left, doc.y);
                doc.moveDown(0.3);
                doc.font(font.body).fontSize(9).fillColor(colors.text).text(invoiceNote, page.left, doc.y, { width: page.width });
            }
            const bankBlockH = estimateBankDetailsHeight();
            const bankY = doc.page.height - doc.page.margins.bottom - bankBlockH;
            if (doc.y + 18 > bankY) {
                startNewPage();
            }
            const bankYFinal = doc.page.height - doc.page.margins.bottom - bankBlockH;
            doc.save();
            doc.rect(page.left, bankYFinal, page.width, bankBlockH).strokeColor(colors.border).stroke();
            doc.restore();
            doc.font(font.bold).fontSize(10).fillColor(colors.text).text('Bank Details', page.left + 10, bankYFinal + 8);
            doc.font(font.body).fontSize(9).fillColor(colors.muted);
            const bankText = 'Bank Name: FNB\n' +
                'Account Name: Uspire Professional Services Ltd\n' +
                'Account Number: 63144493680\n' +
                'Branch Name/Number: Commercial Suite/260001\n' +
                'Swift Code: FIRNZMLX';
            doc.text(bankText, page.left + 10, bankYFinal + 26, { width: page.width - 20 });
            doc.fillColor(colors.text);
            doc.end();
            const pdf = await done;
            return {
                fileName: `Invoice-${invoiceNumber}.pdf`,
                contentType: 'application/pdf',
                body: pdf,
            };
        }
        return {
            fileName: `Invoice-${invoiceNumber}.html`,
            contentType: 'text/html; charset=utf-8',
            body: html,
        };
    }
};
exports.FinanceArInvoicesService = FinanceArInvoicesService;
exports.FinanceArInvoicesService = FinanceArInvoicesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FinanceArInvoicesService);
//# sourceMappingURL=invoices.service.js.map