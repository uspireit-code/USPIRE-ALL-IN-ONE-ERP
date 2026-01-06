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
exports.FinanceTaxService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const accounting_period_guard_1 = require("../common/accounting-period.guard");
let FinanceTaxService = class FinanceTaxService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
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
    round2(n) {
        return Math.round(Number(n ?? 0) * 100) / 100;
    }
    async assertPeriodCoverage(params) {
        const cursor = new Date(params.from);
        cursor.setHours(0, 0, 0, 0);
        const end = new Date(params.to);
        end.setHours(0, 0, 0, 0);
        for (;;) {
            await (0, accounting_period_guard_1.assertPeriodIsOpen)({
                prisma: this.prisma,
                tenantId: params.tenantId,
                date: cursor,
                action: 'create',
                documentLabel: 'tax summary',
                dateLabel: 'date',
            });
            if (cursor >= end)
                break;
            cursor.setDate(cursor.getDate() + 1);
        }
    }
    async assertVatAccountValid(params) {
        const acct = await this.prisma.account.findFirst({
            where: {
                tenantId: params.tenantId,
                id: params.accountId,
                isActive: true,
                type: params.expectedType,
            },
            select: { id: true },
        });
        if (!acct) {
            throw new common_1.BadRequestException(`VAT account must exist, be ACTIVE, and be of type ${params.expectedType}`);
        }
    }
    async listRates(req) {
        const tenant = this.ensureTenant(req);
        const items = await this.prisma.taxRate.findMany({
            where: { tenantId: tenant.id },
            orderBy: [{ code: 'asc' }],
            select: {
                id: true,
                tenantId: true,
                code: true,
                name: true,
                rate: true,
                type: true,
                isActive: true,
                glAccountId: true,
                glAccount: { select: { id: true, code: true, name: true, type: true } },
                createdAt: true,
            },
        });
        return {
            items: (items ?? []).map((r) => ({
                ...r,
                rate: Number(r.rate),
            })),
        };
    }
    async getRateById(req, id) {
        const tenant = this.ensureTenant(req);
        const item = await this.prisma.taxRate.findFirst({
            where: { id, tenantId: tenant.id },
            select: {
                id: true,
                tenantId: true,
                code: true,
                name: true,
                rate: true,
                type: true,
                isActive: true,
                glAccountId: true,
                glAccount: { select: { id: true, code: true, name: true, type: true } },
                createdAt: true,
            },
        });
        if (!item)
            throw new common_1.NotFoundException('Tax rate not found');
        return { ...item, rate: Number(item.rate) };
    }
    async createRate(req, dto) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const code = String(dto.code ?? '').trim().toUpperCase();
        const name = String(dto.name ?? '').trim();
        if (!code)
            throw new common_1.BadRequestException('code is required');
        if (!name)
            throw new common_1.BadRequestException('name is required');
        const rate = this.round2(Number(dto.rate));
        if (!(rate >= 0 && rate <= 100)) {
            throw new common_1.BadRequestException('rate must be between 0 and 100');
        }
        const glAccountId = dto.glAccountId ? String(dto.glAccountId).trim() : null;
        if (glAccountId) {
            const expected = dto.type === 'INPUT' ? 'ASSET' : 'LIABILITY';
            await this.assertVatAccountValid({
                tenantId: tenant.id,
                accountId: glAccountId,
                expectedType: expected,
            });
        }
        try {
            const created = await this.prisma.taxRate.create({
                data: {
                    tenantId: tenant.id,
                    code,
                    name,
                    rate,
                    type: dto.type,
                    glAccountId,
                    isActive: true,
                },
                select: { id: true },
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'TAX_RATE_CREATED',
                    entityType: 'TAX_RATE',
                    entityId: created.id,
                    action: 'TAX_RATE_CREATE',
                    outcome: 'SUCCESS',
                    userId: user.id,
                    permissionUsed: 'TAX_RATE_CREATE',
                },
            })
                .catch(() => undefined);
            return this.getRateById(req, created.id);
        }
        catch (e) {
            if (e?.code === 'P2002') {
                throw new common_1.ConflictException('Tax rate code must be unique');
            }
            throw e;
        }
    }
    async updateRate(req, id, dto) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const existing = await this.prisma.taxRate.findFirst({
            where: { id, tenantId: tenant.id },
            select: { id: true },
        });
        if (!existing)
            throw new common_1.NotFoundException('Tax rate not found');
        const patch = {};
        if (dto.code !== undefined) {
            const code = String(dto.code ?? '').trim().toUpperCase();
            if (!code)
                throw new common_1.BadRequestException('code must not be empty');
            patch.code = code;
        }
        if (dto.name !== undefined) {
            const name = String(dto.name ?? '').trim();
            if (!name)
                throw new common_1.BadRequestException('name must not be empty');
            patch.name = name;
        }
        if (dto.rate !== undefined) {
            const rate = this.round2(Number(dto.rate));
            if (!(rate >= 0 && rate <= 100)) {
                throw new common_1.BadRequestException('rate must be between 0 and 100');
            }
            patch.rate = rate;
        }
        if (dto.type !== undefined) {
            patch.type = dto.type;
        }
        if (dto.glAccountId !== undefined) {
            const glAccountId = dto.glAccountId ? String(dto.glAccountId).trim() : null;
            patch.glAccountId = glAccountId;
            if (glAccountId) {
                const expected = (dto.type ?? 'OUTPUT') === 'INPUT' ? 'ASSET' : 'LIABILITY';
                await this.assertVatAccountValid({
                    tenantId: tenant.id,
                    accountId: glAccountId,
                    expectedType: expected,
                });
            }
        }
        try {
            await this.prisma.taxRate.update({
                where: { id },
                data: patch,
            });
            await this.prisma.auditEvent
                .create({
                data: {
                    tenantId: tenant.id,
                    eventType: 'TAX_RATE_UPDATED',
                    entityType: 'TAX_RATE',
                    entityId: id,
                    action: 'TAX_RATE_UPDATE',
                    outcome: 'SUCCESS',
                    userId: user.id,
                    permissionUsed: 'TAX_RATE_UPDATE',
                },
            })
                .catch(() => undefined);
            return this.getRateById(req, id);
        }
        catch (e) {
            if (e?.code === 'P2002') {
                throw new common_1.ConflictException('Tax rate code must be unique');
            }
            throw e;
        }
    }
    async setRateActive(req, id, isActive) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const existing = await this.prisma.taxRate.findFirst({
            where: { id, tenantId: tenant.id },
            select: { id: true },
        });
        if (!existing)
            throw new common_1.NotFoundException('Tax rate not found');
        await this.prisma.taxRate.update({
            where: { id },
            data: { isActive: Boolean(isActive) },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'TAX_RATE_STATUS_CHANGE',
                entityType: 'TAX_RATE',
                entityId: id,
                action: 'TAX_RATE_UPDATE',
                outcome: 'SUCCESS',
                userId: user.id,
                permissionUsed: 'TAX_RATE_UPDATE',
            },
        })
            .catch(() => undefined);
        return this.getRateById(req, id);
    }
    async getConfig(req) {
        const tenant = this.ensureTenant(req);
        const cfg = await this.prisma.tenantTaxConfig.findFirst({
            where: { tenantId: tenant.id },
            select: {
                tenantId: true,
                outputVatAccountId: true,
                inputVatAccountId: true,
                outputVatAccount: { select: { id: true, code: true, name: true, type: true } },
                inputVatAccount: { select: { id: true, code: true, name: true, type: true } },
            },
        });
        if (cfg)
            return cfg;
        return this.prisma.tenantTaxConfig.create({
            data: { tenantId: tenant.id },
            select: {
                tenantId: true,
                outputVatAccountId: true,
                inputVatAccountId: true,
                outputVatAccount: { select: { id: true, code: true, name: true, type: true } },
                inputVatAccount: { select: { id: true, code: true, name: true, type: true } },
            },
        });
    }
    async updateConfig(req, dto) {
        const tenant = this.ensureTenant(req);
        const user = this.ensureUser(req);
        const outputVatAccountId = dto.outputVatAccountId === undefined
            ? undefined
            : dto.outputVatAccountId
                ? String(dto.outputVatAccountId).trim()
                : null;
        const inputVatAccountId = dto.inputVatAccountId === undefined
            ? undefined
            : dto.inputVatAccountId
                ? String(dto.inputVatAccountId).trim()
                : null;
        if (outputVatAccountId) {
            await this.assertVatAccountValid({
                tenantId: tenant.id,
                accountId: outputVatAccountId,
                expectedType: 'LIABILITY',
            });
        }
        if (inputVatAccountId) {
            await this.assertVatAccountValid({
                tenantId: tenant.id,
                accountId: inputVatAccountId,
                expectedType: 'ASSET',
            });
        }
        await this.prisma.tenantTaxConfig.upsert({
            where: { tenantId: tenant.id },
            create: {
                tenantId: tenant.id,
                ...(outputVatAccountId !== undefined ? { outputVatAccountId } : {}),
                ...(inputVatAccountId !== undefined ? { inputVatAccountId } : {}),
            },
            update: {
                ...(outputVatAccountId !== undefined ? { outputVatAccountId } : {}),
                ...(inputVatAccountId !== undefined ? { inputVatAccountId } : {}),
            },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'TAX_CONFIG_UPDATED',
                entityType: 'TENANT_TAX_CONFIG',
                entityId: tenant.id,
                action: 'TAX_CONFIG_UPDATE',
                outcome: 'SUCCESS',
                userId: user.id,
                permissionUsed: 'TAX_CONFIG_UPDATE',
            },
        })
            .catch(() => undefined);
        return this.getConfig(req);
    }
    async outputSummary(req, dto) {
        const tenant = this.ensureTenant(req);
        const from = new Date(dto.from);
        const to = new Date(dto.to);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            throw new common_1.BadRequestException('Invalid from/to dates');
        }
        if (from > to) {
            throw new common_1.BadRequestException('from must be less than or equal to to');
        }
        await this.assertPeriodCoverage({ tenantId: tenant.id, from, to });
        const arInvoices = await this.prisma.customerInvoice.findMany({
            where: {
                tenantId: tenant.id,
                status: 'POSTED',
                invoiceDate: { gte: from, lte: to },
            },
            select: { id: true, subtotal: true, taxAmount: true, totalAmount: true },
        });
        const taxableSales = this.round2((arInvoices ?? []).reduce((s, i) => s + Number(i.subtotal ?? 0), 0));
        const vatCharged = this.round2((arInvoices ?? []).reduce((s, i) => s + Number(i.taxAmount ?? 0), 0));
        return {
            from: dto.from,
            to: dto.to,
            taxableSales,
            vatCharged,
        };
    }
    async inputSummary(req, dto) {
        const tenant = this.ensureTenant(req);
        const from = new Date(dto.from);
        const to = new Date(dto.to);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            throw new common_1.BadRequestException('Invalid from/to dates');
        }
        if (from > to) {
            throw new common_1.BadRequestException('from must be less than or equal to to');
        }
        await this.assertPeriodCoverage({ tenantId: tenant.id, from, to });
        const apInvoices = await this.prisma.supplierInvoice.findMany({
            where: {
                tenantId: tenant.id,
                status: 'POSTED',
                invoiceDate: { gte: from, lte: to },
            },
            select: { id: true },
        });
        const apIds = (apInvoices ?? []).map((i) => i.id);
        if (apIds.length === 0) {
            return {
                from: dto.from,
                to: dto.to,
                vatPaid: 0,
            };
        }
        const inputTaxLines = await this.prisma.invoiceTaxLine.findMany({
            where: {
                tenantId: tenant.id,
                sourceType: 'SUPPLIER_INVOICE',
                sourceId: { in: apIds },
                taxRate: { type: 'INPUT' },
            },
            select: { taxAmount: true },
        });
        const vatPaid = this.round2((inputTaxLines ?? []).reduce((s, t) => s + Number(t.taxAmount ?? 0), 0));
        return {
            from: dto.from,
            to: dto.to,
            vatPaid,
        };
    }
};
exports.FinanceTaxService = FinanceTaxService;
exports.FinanceTaxService = FinanceTaxService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FinanceTaxService);
//# sourceMappingURL=tax.service.js.map