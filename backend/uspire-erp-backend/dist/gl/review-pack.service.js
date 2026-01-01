"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewPackService = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_fs_2 = require("node:fs");
const path = __importStar(require("node:path"));
const node_stream_1 = require("node:stream");
const archiver_1 = __importDefault(require("archiver"));
const prisma_service_1 = require("../prisma/prisma.service");
const report_presentation_service_1 = require("../reports/report-presentation.service");
const storage_provider_1 = require("../storage/storage.provider");
const gl_service_1 = require("./gl.service");
let ReviewPackService = class ReviewPackService {
    prisma;
    gl;
    reports;
    storage;
    rootDir;
    constructor(prisma, gl, reports, storage) {
        this.prisma = prisma;
        this.gl = gl;
        this.reports = reports;
        this.storage = storage;
        this.rootDir = path.join(process.cwd(), 'storage', 'review-packs');
    }
    resolvePath(storageKey) {
        const normalized = storageKey.replace(/\\/g, '/');
        return path.join(this.rootDir, normalized);
    }
    sha256(buf) {
        return (0, node_crypto_1.createHash)('sha256').update(buf).digest('hex');
    }
    jsonBuf(data) {
        return Buffer.from(JSON.stringify(data, null, 2), 'utf8');
    }
    toSafeFileName(name) {
        return name.replace(/[^a-zA-Z0-9._-]/g, '_');
    }
    async listReviewPacks(req, periodId) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const period = await this.prisma.accountingPeriod.findFirst({
            where: { id: periodId, tenantId: tenant.id },
            select: { id: true, status: true },
        });
        if (!period)
            throw new common_1.NotFoundException('Accounting period not found');
        if (period.status !== 'CLOSED') {
            throw new common_1.BadRequestException('Review packs can only be generated for CLOSED accounting periods');
        }
        return this.prisma.reviewPack.findMany({
            where: { tenantId: tenant.id, periodId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                tenantId: true,
                periodId: true,
                generatedById: true,
                storageKey: true,
                zipSize: true,
                zipSha256Hash: true,
                manifestSha256: true,
                createdAt: true,
                generatedBy: { select: { id: true, email: true } },
            },
        });
    }
    async generateReviewPack(req, periodId) {
        const tenant = req.tenant;
        const user = req.user;
        if (!tenant || !user)
            throw new common_1.BadRequestException('Missing tenant or user context');
        const packGeneratedAt = new Date().toISOString();
        const period = await this.prisma.accountingPeriod.findFirst({
            where: { id: periodId, tenantId: tenant.id },
            select: {
                id: true,
                tenantId: true,
                name: true,
                status: true,
                startDate: true,
                endDate: true,
                closedAt: true,
                closedBy: { select: { id: true, email: true } },
                createdAt: true,
            },
        });
        if (!period)
            throw new common_1.NotFoundException('Accounting period not found');
        const checklistItems = await this.prisma.accountingPeriodChecklistItem.findMany({
            where: { tenantId: tenant.id, periodId: period.id },
            orderBy: [{ completed: 'asc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                code: true,
                label: true,
                completed: true,
                completedAt: true,
                completedBy: { select: { id: true, email: true } },
                createdAt: true,
            },
        });
        const checklistItemIds = checklistItems.map((i) => i.id);
        const eventEntityFilters = [
            { entityType: 'ACCOUNTING_PERIOD', entityId: period.id },
            ...(checklistItemIds.length > 0
                ? [
                    {
                        entityType: 'ACCOUNTING_PERIOD_CHECKLIST_ITEM',
                        entityId: { in: checklistItemIds },
                    },
                ]
                : []),
        ];
        const auditEvents = await this.prisma.auditEvent.findMany({
            where: {
                tenantId: tenant.id,
                OR: [
                    {
                        eventType: {
                            in: [
                                'PERIOD_CHECKLIST_COMPLETE',
                                'PERIOD_CLOSE',
                                'EVIDENCE_UPLOAD',
                            ],
                        },
                        OR: eventEntityFilters,
                    },
                    {
                        eventType: 'SOD_VIOLATION',
                        action: {
                            in: [
                                'FINANCE_PERIOD_CHECKLIST_COMPLETE',
                                'FINANCE_PERIOD_CLOSE_APPROVE',
                            ],
                        },
                    },
                ],
            },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                tenantId: true,
                eventType: true,
                entityType: true,
                entityId: true,
                action: true,
                outcome: true,
                reason: true,
                userId: true,
                permissionUsed: true,
                createdAt: true,
                user: { select: { id: true, email: true } },
            },
        });
        const evidenceForPeriod = await this.prisma.auditEvidence.findMany({
            where: {
                tenantId: tenant.id,
                entityType: 'ACCOUNTING_PERIOD',
                entityId: period.id,
            },
            orderBy: { createdAt: 'asc' },
            select: {
                id: true,
                tenantId: true,
                entityType: true,
                entityId: true,
                fileName: true,
                mimeType: true,
                size: true,
                storageKey: true,
                sha256Hash: true,
                uploadedById: true,
                createdAt: true,
                uploadedBy: { select: { id: true, email: true } },
            },
        });
        const evidenceForChecklistItems = checklistItemIds.length === 0
            ? []
            : await this.prisma.auditEvidence.findMany({
                where: {
                    tenantId: tenant.id,
                    entityType: 'ACCOUNTING_PERIOD_CHECKLIST_ITEM',
                    entityId: { in: checklistItemIds },
                },
                orderBy: { createdAt: 'asc' },
                select: {
                    id: true,
                    tenantId: true,
                    entityType: true,
                    entityId: true,
                    fileName: true,
                    mimeType: true,
                    size: true,
                    storageKey: true,
                    sha256Hash: true,
                    uploadedById: true,
                    createdAt: true,
                    uploadedBy: { select: { id: true, email: true } },
                },
            });
        const evidenceRows = [...evidenceForPeriod, ...evidenceForChecklistItems];
        const packId = (0, node_crypto_1.randomUUID)();
        const storageKey = `${tenant.id}/${packId}.zip`;
        const fullPath = this.resolvePath(storageKey);
        await node_fs_2.promises.mkdir(path.dirname(fullPath), { recursive: true });
        const entries = [];
        const zipHash = (0, node_crypto_1.createHash)('sha256');
        let zipSize = 0;
        const evidenceFileBuffers = [];
        for (const ev of evidenceRows) {
            const ok = await this.storage.exists(ev.storageKey);
            if (!ok) {
                throw new common_1.NotFoundException(`Evidence file not found in storage: ${ev.id}`);
            }
            const buf = await this.storage.get(ev.storageKey);
            const sha = this.sha256(buf);
            if (sha !== ev.sha256Hash) {
                throw new common_1.BadRequestException(`Evidence integrity check failed (hash mismatch): ${ev.id}`);
            }
            const zipPath = `evidence/files/${ev.id}_${this.toSafeFileName(ev.fileName)}`;
            evidenceFileBuffers.push({ zipPath, buf, sha256: sha });
        }
        const evidenceIndex = evidenceRows.map((ev) => {
            const zipPath = `evidence/files/${ev.id}_${this.toSafeFileName(ev.fileName)}`;
            return {
                ...ev,
                zipPath,
                sha256Hash: ev.sha256Hash,
            };
        });
        const filesToInclude = [];
        filesToInclude.push({ zipPath: 'period.json', buf: this.jsonBuf(period) });
        filesToInclude.push({
            zipPath: 'checklist.json',
            buf: this.jsonBuf({ periodId: period.id, items: checklistItems }),
        });
        filesToInclude.push({
            zipPath: 'audit-events.json',
            buf: this.jsonBuf(auditEvents),
        });
        filesToInclude.push({
            zipPath: 'evidence/index.json',
            buf: this.jsonBuf(evidenceIndex),
        });
        const disclosureNoteTypes = [
            'PPE_MOVEMENT',
            'DEPRECIATION',
            'TAX_RECONCILIATION',
        ];
        const disclosureNotes = await this.prisma.disclosureNote.findMany({
            where: {
                tenantId: tenant.id,
                accountingPeriodId: period.id,
                noteType: { in: disclosureNoteTypes },
            },
            select: {
                id: true,
                noteType: true,
                accountingPeriodId: true,
                generatedAt: true,
                generatedById: true,
                lines: {
                    orderBy: { orderIndex: 'asc' },
                    select: {
                        id: true,
                        disclosureNoteId: true,
                        rowKey: true,
                        label: true,
                        values: true,
                        orderIndex: true,
                    },
                },
            },
            orderBy: { noteType: 'asc' },
        });
        const noteByType = new Map();
        for (const n of disclosureNotes)
            noteByType.set(String(n.noteType), n);
        const missingNotes = disclosureNoteTypes.filter((t) => !noteByType.has(t));
        if (missingNotes.length > 0) {
            throw new common_1.BadRequestException(`Disclosure notes not generated for this period: ${missingNotes.join(', ')}. Generate disclosure notes first; review pack export reads persisted records only.`);
        }
        for (const t of disclosureNoteTypes) {
            const n = noteByType.get(t);
            if (!n)
                continue;
            filesToInclude.push({
                zipPath: `disclosure-notes/${t}.json`,
                buf: this.jsonBuf({
                    id: n.id,
                    noteType: n.noteType,
                    accountingPeriodId: n.accountingPeriodId,
                    generatedAt: n.generatedAt,
                    generatedById: n.generatedById,
                    lines: n.lines,
                }),
            });
        }
        const tbFrom = period.startDate.toISOString().slice(0, 10);
        const tbTo = period.endDate.toISOString().slice(0, 10);
        const tb = await this.gl.trialBalance(req, {
            from: tbFrom,
            to: tbTo,
        });
        const tbAccountIds = (tb.rows ?? []).map((r) => r.accountId);
        const tbAccounts = tbAccountIds.length === 0
            ? []
            : await this.prisma.account.findMany({
                where: { tenantId: tenant.id, id: { in: tbAccountIds } },
                select: { id: true, normalBalance: true },
            });
        const tbNormalById = new Map(tbAccounts.map((a) => [a.id, a.normalBalance]));
        filesToInclude.push({
            zipPath: 'review-pack/trial-balance.json',
            buf: this.jsonBuf({
                accountingPeriodId: period.id,
                asOfDate: tbTo,
                generatedAt: packGeneratedAt,
                rows: (tb.rows ?? []).map((r) => {
                    const debit = Number(r.totalDebit ?? 0);
                    const credit = Number(r.totalCredit ?? 0);
                    const balance = Number(r.net ?? debit - credit);
                    return {
                        accountCode: r.accountCode,
                        accountName: r.accountName,
                        debit,
                        credit,
                        balance,
                        normalBalance: tbNormalById.get(r.accountId) ?? 'DEBIT',
                    };
                }),
            }),
        });
        const pl = await this.reports.presentPL(req, { from: tbFrom, to: tbTo });
        const bs = await this.reports.presentBS(req, { asOf: tbTo });
        const cf = await this.reports.presentCF(req, { from: tbFrom, to: tbTo });
        const soce = await this.reports.presentSOCE(req, {
            from: tbFrom,
            to: tbTo,
        });
        filesToInclude.push({
            zipPath: 'review-pack/financial-statements/profit-loss.json',
            buf: this.jsonBuf({
                accountingPeriodId: period.id,
                reportType: pl.reportType,
                period: pl.period,
                generatedAt: packGeneratedAt,
                rows: pl.sections,
                totals: pl.totals,
            }),
        });
        filesToInclude.push({
            zipPath: 'review-pack/financial-statements/balance-sheet.json',
            buf: this.jsonBuf({
                accountingPeriodId: period.id,
                reportType: bs.reportType,
                asOf: bs.period.asOf,
                generatedAt: packGeneratedAt,
                rows: bs.sections,
                totals: bs.totals,
            }),
        });
        filesToInclude.push({
            zipPath: 'review-pack/financial-statements/cash-flow.json',
            buf: this.jsonBuf({
                accountingPeriodId: period.id,
                reportType: cf.reportType,
                period: cf.period,
                generatedAt: packGeneratedAt,
                rows: cf.sections,
                totals: cf.totals,
            }),
        });
        filesToInclude.push({
            zipPath: 'review-pack/financial-statements/soce.json',
            buf: this.jsonBuf({
                accountingPeriodId: period.id,
                reportType: soce.reportType,
                period: soce.period,
                generatedAt: packGeneratedAt,
                rows: soce.sections,
                totals: soce.totals,
            }),
        });
        for (const f of evidenceFileBuffers) {
            filesToInclude.push({ zipPath: f.zipPath, buf: f.buf });
        }
        for (const f of filesToInclude) {
            entries.push({
                path: f.zipPath,
                sha256: this.sha256(f.buf),
                size: f.buf.length,
            });
        }
        const manifest = {
            tenantId: tenant.id,
            periodId: period.id,
            generatedAt: packGeneratedAt,
            generatedBy: { id: user.id, email: user.email },
            sections: {
                disclosureNotes: true,
                trialBalance: true,
                financialStatements: true,
            },
            files: entries,
        };
        const manifestBuf = this.jsonBuf(manifest);
        const manifestSha256 = this.sha256(manifestBuf);
        const out = await new Promise((resolve, reject) => {
            const output = new node_stream_1.PassThrough();
            const fileStream = (0, node_fs_1.createWriteStream)(fullPath);
            output.on('data', (chunk) => {
                zipHash.update(chunk);
                zipSize += chunk.length;
            });
            output.pipe(fileStream);
            fileStream.on('close', () => resolve());
            fileStream.on('error', reject);
            const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
            archive.on('error', reject);
            archive.pipe(output);
            const addBuffer = (zipPath, buf) => {
                archive.append(buf, { name: zipPath });
            };
            addBuffer('manifest.json', manifestBuf);
            for (const f of filesToInclude) {
                addBuffer(f.zipPath, f.buf);
            }
            archive.finalize().catch(reject);
        });
        void out;
        const zipSha256Hash = zipHash.digest('hex');
        const created = await this.prisma.reviewPack.create({
            data: {
                id: packId,
                tenantId: tenant.id,
                periodId: period.id,
                generatedById: user.id,
                storageKey,
                zipSize,
                zipSha256Hash,
                manifest,
                manifestSha256,
            },
            select: {
                id: true,
                tenantId: true,
                periodId: true,
                storageKey: true,
                zipSize: true,
                zipSha256Hash: true,
                manifestSha256: true,
                createdAt: true,
                generatedBy: { select: { id: true, email: true } },
            },
        });
        await this.prisma.auditEvent
            .create({
            data: {
                tenantId: tenant.id,
                eventType: 'REPORT_EXPORT',
                entityType: 'ACCOUNTING_PERIOD',
                entityId: period.id,
                action: 'AUDIT_REVIEW_PACK_GENERATE',
                outcome: 'SUCCESS',
                reason: JSON.stringify({
                    reviewPackId: created.id,
                    includedSections: [
                        'disclosure-notes',
                        'trial-balance',
                        'financial-statements',
                    ],
                }),
                userId: user.id,
                permissionUsed: 'AUDIT_REVIEW_PACK_GENERATE',
            },
        })
            .catch(() => undefined);
        return created;
    }
    async downloadReviewPack(req, periodId, packId) {
        const tenant = req.tenant;
        if (!tenant)
            throw new common_1.BadRequestException('Missing tenant context');
        const row = await this.prisma.reviewPack.findFirst({
            where: { id: packId, tenantId: tenant.id, periodId },
            select: {
                id: true,
                tenantId: true,
                periodId: true,
                storageKey: true,
                zipSize: true,
                zipSha256Hash: true,
                createdAt: true,
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Review pack not found');
        const fullPath = this.resolvePath(row.storageKey);
        try {
            await node_fs_2.promises.access(fullPath);
        }
        catch {
            throw new common_1.NotFoundException('Review pack file not found in storage');
        }
        const buf = await node_fs_2.promises.readFile(fullPath);
        const sha = this.sha256(buf);
        if (sha !== row.zipSha256Hash) {
            throw new common_1.BadRequestException('Review pack integrity check failed (hash mismatch)');
        }
        return {
            fileName: `review-pack_${periodId}_${row.id}.zip`,
            body: buf,
            size: row.zipSize,
        };
    }
};
exports.ReviewPackService = ReviewPackService;
exports.ReviewPackService = ReviewPackService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_2.Inject)(storage_provider_1.STORAGE_PROVIDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gl_service_1.GlService,
        report_presentation_service_1.ReportPresentationService, Object])
], ReviewPackService);
//# sourceMappingURL=review-pack.service.js.map