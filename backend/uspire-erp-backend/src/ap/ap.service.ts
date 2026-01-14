import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Request } from 'express';
import { randomUUID, createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import { AuditEntityType, AuditEventType } from '@prisma/client';
import { assertCanPost } from '../periods/period-guard';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import type { StorageProvider } from '../storage/storage.provider';
import { STORAGE_PROVIDER } from '../storage/storage.provider';
import { UploadSupplierDocumentDto } from './dto/upload-supplier-document.dto';
import { CreateSupplierBankAccountDto } from './dto/create-supplier-bank-account.dto';
import { UpdateSupplierBankAccountDto } from './dto/update-supplier-bank-account.dto';

@Injectable()
export class ApService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  private async assertActiveSupplier(params: { tenantId: string; supplierId: string }) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: params.supplierId, tenantId: params.tenantId, isActive: true },
      select: { id: true },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found or inactive');
    }
    return supplier;
  }

  private async createSupplierChangeLog(params: {
    tenantId: string;
    supplierId: string;
    changeType: string;
    actorUserId: string;
    field?: string;
    oldValue?: string;
    newValue?: string;
    refId?: string;
  }) {
    await this.prisma.supplierChangeLog.create({
      data: {
        tenantId: params.tenantId,
        supplierId: params.supplierId,
        changeType: params.changeType,
        field: params.field,
        oldValue: params.oldValue,
        newValue: params.newValue,
        refId: params.refId,
        actorUserId: params.actorUserId,
      },
    });
  }

  // Supplier documents
  async listSupplierDocuments(req: Request, supplierId: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    await this.assertActiveSupplier({ tenantId: tenant.id, supplierId });

    return this.prisma.supplierDocument.findMany({
      where: { tenantId: tenant.id, supplierId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        supplierId: true,
        docType: true,
        filename: true,
        mimeType: true,
        storageKey: true,
        fileSize: true,
        notes: true,
        createdById: true,
        createdAt: true,
        isActive: true,
      },
    });
  }

  async uploadSupplierDocument(
    req: Request,
    supplierId: string,
    dto: UploadSupplierDocumentDto,
    file?: any,
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');
    if (!file) throw new BadRequestException('Missing file');
    if (!file.originalname) throw new BadRequestException('Missing fileName');

    await this.assertActiveSupplier({ tenantId: tenant.id, supplierId });

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const docId = randomUUID();
    const safeName = String(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `${tenant.id}/supplier/${supplierId}/${docId}_${safeName}`;
    await this.storage.put(storageKey, file.buffer);

    const created = await this.prisma.supplierDocument.create({
      data: {
        id: docId,
        tenantId: tenant.id,
        supplierId,
        docType: dto.docType,
        filename: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        storageKey,
        fileSize: file.size,
        notes: dto.notes,
        createdById: user.id,
        isActive: true,
      },
      select: {
        id: true,
        tenantId: true,
        supplierId: true,
        docType: true,
        filename: true,
        mimeType: true,
        storageKey: true,
        fileSize: true,
        notes: true,
        createdById: true,
        createdAt: true,
        isActive: true,
      },
    });

    await this.createSupplierChangeLog({
      tenantId: tenant.id,
      supplierId,
      changeType: 'DOC_UPLOAD',
      actorUserId: user.id,
      refId: created.id,
      newValue: `${created.docType}:${created.filename}`,
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.AP_POST,
        entityType: AuditEntityType.SUPPLIER_INVOICE,
        entityId: supplierId,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'AP_SUPPLIER_DOC_UPLOAD',
        permissionUsed: PERMISSIONS.AP.SUPPLIER_CREATE,
        lifecycleType: 'UPDATE',
        metadata: { supplierId, supplierDocumentId: created.id, sha256Hash: sha256 },
      },
      this.prisma,
    );

    return created;
  }

  async deactivateSupplierDocument(req: Request, supplierId: string, docId: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    await this.assertActiveSupplier({ tenantId: tenant.id, supplierId });

    const row = await this.prisma.supplierDocument.findFirst({
      where: { id: docId, tenantId: tenant.id, supplierId },
      select: { id: true, isActive: true, docType: true, filename: true },
    });
    if (!row) throw new NotFoundException('Supplier document not found');
    if (!row.isActive) return { ok: true };

    await this.prisma.supplierDocument.update({
      where: { id: row.id },
      data: { isActive: false },
    });

    await this.createSupplierChangeLog({
      tenantId: tenant.id,
      supplierId,
      changeType: 'DOC_DEACTIVATE',
      actorUserId: user.id,
      refId: row.id,
      oldValue: `${row.docType}:${row.filename}`,
      newValue: 'DEACTIVATED',
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.AP_POST,
        entityType: AuditEntityType.SUPPLIER_INVOICE,
        entityId: supplierId,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'AP_SUPPLIER_DOC_DEACTIVATE',
        permissionUsed: PERMISSIONS.AP.SUPPLIER_CREATE,
        lifecycleType: 'UPDATE',
        metadata: { supplierId, supplierDocumentId: row.id },
      },
      this.prisma,
    );

    return { ok: true };
  }

  async downloadSupplierDocument(req: Request, supplierId: string, docId: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    await this.assertActiveSupplier({ tenantId: tenant.id, supplierId });

    const row = await this.prisma.supplierDocument.findFirst({
      where: { id: docId, tenantId: tenant.id, supplierId, isActive: true },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        fileSize: true,
        storageKey: true,
      },
    });
    if (!row) throw new NotFoundException('Supplier document not found');

    const exists = await this.storage.exists(row.storageKey);
    if (!exists) throw new NotFoundException('Supplier document file not found in storage');

    const buf = await this.storage.get(row.storageKey);

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.AP_POST,
        entityType: AuditEntityType.SUPPLIER_INVOICE,
        entityId: supplierId,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'AP_SUPPLIER_DOC_DOWNLOAD',
        permissionUsed: PERMISSIONS.AP.INVOICE_CREATE,
        metadata: { supplierId, supplierDocumentId: row.id },
      },
      this.prisma,
    );

    return {
      fileName: row.filename,
      mimeType: row.mimeType || 'application/octet-stream',
      size: row.fileSize ?? buf.length,
      body: buf,
    };
  }

  // Supplier bank accounts
  async listSupplierBankAccounts(req: Request, supplierId: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    await this.assertActiveSupplier({ tenantId: tenant.id, supplierId });

    return this.prisma.supplierBankAccount.findMany({
      where: { tenantId: tenant.id, supplierId, isActive: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createSupplierBankAccount(req: Request, supplierId: string, dto: CreateSupplierBankAccountDto) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    await this.assertActiveSupplier({ tenantId: tenant.id, supplierId });

    const created = await this.prisma.supplierBankAccount.create({
      data: {
        tenantId: tenant.id,
        supplierId,
        bankName: dto.bankName,
        branchName: dto.branchName,
        accountName: dto.accountName,
        accountNumber: dto.accountNumber,
        currency: dto.currency,
        swiftCode: dto.swiftCode,
        notes: dto.notes,
        isPrimary: Boolean(dto.isPrimary),
        isActive: true,
        createdById: user.id,
      },
    });

    if (created.isPrimary) {
      await this.prisma.supplierBankAccount.updateMany({
        where: {
          tenantId: tenant.id,
          supplierId,
          isActive: true,
          id: { not: created.id },
        },
        data: { isPrimary: false },
      });
    }

    await this.createSupplierChangeLog({
      tenantId: tenant.id,
      supplierId,
      changeType: 'BANK_CREATE',
      actorUserId: user.id,
      refId: created.id,
      newValue: `${created.bankName}:${created.accountNumber}`,
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.AP_POST,
        entityType: AuditEntityType.SUPPLIER_INVOICE,
        entityId: supplierId,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'AP_SUPPLIER_BANK_CREATE',
        permissionUsed: PERMISSIONS.AP.SUPPLIER_CREATE,
        lifecycleType: 'CREATE',
        metadata: { supplierId, supplierBankAccountId: created.id },
      },
      this.prisma,
    );

    return created;
  }

  async updateSupplierBankAccount(
    req: Request,
    supplierId: string,
    bankId: string,
    dto: UpdateSupplierBankAccountDto,
  ) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    await this.assertActiveSupplier({ tenantId: tenant.id, supplierId });

    const existing = await this.prisma.supplierBankAccount.findFirst({
      where: { id: bankId, tenantId: tenant.id, supplierId },
    });
    if (!existing) throw new NotFoundException('Supplier bank account not found');

    const updated = await this.prisma.supplierBankAccount.update({
      where: { id: existing.id },
      data: {
        bankName: dto.bankName ?? existing.bankName,
        branchName: dto.branchName ?? existing.branchName,
        accountName: dto.accountName ?? existing.accountName,
        accountNumber: dto.accountNumber ?? existing.accountNumber,
        currency: dto.currency ?? existing.currency,
        swiftCode: dto.swiftCode ?? existing.swiftCode,
        notes: dto.notes ?? existing.notes,
        isPrimary: typeof dto.isPrimary === 'boolean' ? dto.isPrimary : existing.isPrimary,
        updatedById: user.id,
      },
    });

    if (updated.isPrimary) {
      await this.prisma.supplierBankAccount.updateMany({
        where: {
          tenantId: tenant.id,
          supplierId,
          isActive: true,
          id: { not: updated.id },
        },
        data: { isPrimary: false },
      });
    }

    if (existing.bankName !== updated.bankName) {
      await this.createSupplierChangeLog({
        tenantId: tenant.id,
        supplierId,
        changeType: 'BANK_UPDATE',
        actorUserId: user.id,
        field: 'bankName',
        oldValue: existing.bankName,
        newValue: updated.bankName,
        refId: updated.id,
      });
    }
    if (existing.branchName !== updated.branchName) {
      await this.createSupplierChangeLog({
        tenantId: tenant.id,
        supplierId,
        changeType: 'BANK_UPDATE',
        actorUserId: user.id,
        field: 'branchName',
        oldValue: existing.branchName ?? '',
        newValue: updated.branchName ?? '',
        refId: updated.id,
      });
    }
    if (existing.accountName !== updated.accountName) {
      await this.createSupplierChangeLog({
        tenantId: tenant.id,
        supplierId,
        changeType: 'BANK_UPDATE',
        actorUserId: user.id,
        field: 'accountName',
        oldValue: existing.accountName,
        newValue: updated.accountName,
        refId: updated.id,
      });
    }
    if (existing.accountNumber !== updated.accountNumber) {
      await this.createSupplierChangeLog({
        tenantId: tenant.id,
        supplierId,
        changeType: 'BANK_UPDATE',
        actorUserId: user.id,
        field: 'accountNumber',
        oldValue: existing.accountNumber,
        newValue: updated.accountNumber,
        refId: updated.id,
      });
    }
    if ((existing.currency ?? '') !== (updated.currency ?? '')) {
      await this.createSupplierChangeLog({
        tenantId: tenant.id,
        supplierId,
        changeType: 'BANK_UPDATE',
        actorUserId: user.id,
        field: 'currency',
        oldValue: existing.currency ?? '',
        newValue: updated.currency ?? '',
        refId: updated.id,
      });
    }
    if ((existing.swiftCode ?? '') !== (updated.swiftCode ?? '')) {
      await this.createSupplierChangeLog({
        tenantId: tenant.id,
        supplierId,
        changeType: 'BANK_UPDATE',
        actorUserId: user.id,
        field: 'swiftCode',
        oldValue: existing.swiftCode ?? '',
        newValue: updated.swiftCode ?? '',
        refId: updated.id,
      });
    }
    if ((existing.notes ?? '') !== (updated.notes ?? '')) {
      await this.createSupplierChangeLog({
        tenantId: tenant.id,
        supplierId,
        changeType: 'BANK_UPDATE',
        actorUserId: user.id,
        field: 'notes',
        oldValue: existing.notes ?? '',
        newValue: updated.notes ?? '',
        refId: updated.id,
      });
    }
    if (existing.isPrimary !== updated.isPrimary) {
      await this.createSupplierChangeLog({
        tenantId: tenant.id,
        supplierId,
        changeType: 'BANK_UPDATE',
        actorUserId: user.id,
        field: 'isPrimary',
        oldValue: String(existing.isPrimary),
        newValue: String(updated.isPrimary),
        refId: updated.id,
      });
    }

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.AP_POST,
        entityType: AuditEntityType.SUPPLIER_INVOICE,
        entityId: supplierId,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'AP_SUPPLIER_BANK_UPDATE',
        permissionUsed: PERMISSIONS.AP.SUPPLIER_CREATE,
        lifecycleType: 'UPDATE',
        metadata: { supplierId, supplierBankAccountId: updated.id },
      },
      this.prisma,
    );

    return updated;
  }

  async deactivateSupplierBankAccount(req: Request, supplierId: string, bankId: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    await this.assertActiveSupplier({ tenantId: tenant.id, supplierId });

    const existing = await this.prisma.supplierBankAccount.findFirst({
      where: { id: bankId, tenantId: tenant.id, supplierId },
      select: { id: true, isActive: true, isPrimary: true, bankName: true, accountNumber: true },
    });
    if (!existing) throw new NotFoundException('Supplier bank account not found');
    if (!existing.isActive) return { ok: true };

    await this.prisma.supplierBankAccount.update({
      where: { id: existing.id },
      data: { isActive: false, isPrimary: false, updatedById: user.id },
    });

    await this.createSupplierChangeLog({
      tenantId: tenant.id,
      supplierId,
      changeType: 'BANK_DEACTIVATE',
      actorUserId: user.id,
      refId: existing.id,
      oldValue: `${existing.bankName}:${existing.accountNumber}`,
      newValue: 'DEACTIVATED',
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.AP_POST,
        entityType: AuditEntityType.SUPPLIER_INVOICE,
        entityId: supplierId,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'AP_SUPPLIER_BANK_DEACTIVATE',
        permissionUsed: PERMISSIONS.AP.SUPPLIER_CREATE,
        lifecycleType: 'UPDATE',
        metadata: { supplierId, supplierBankAccountId: existing.id },
      },
      this.prisma,
    );

    return { ok: true };
  }

  async setPrimarySupplierBankAccount(req: Request, supplierId: string, bankId: string) {
    const tenant = req.tenant;
    const user = req.user;
    if (!tenant || !user) throw new BadRequestException('Missing tenant or user context');

    await this.assertActiveSupplier({ tenantId: tenant.id, supplierId });

    const existing = await this.prisma.supplierBankAccount.findFirst({
      where: { id: bankId, tenantId: tenant.id, supplierId, isActive: true },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Supplier bank account not found or inactive');

    await this.prisma.$transaction([
      this.prisma.supplierBankAccount.updateMany({
        where: { tenantId: tenant.id, supplierId, isActive: true },
        data: { isPrimary: false, updatedById: user.id },
      }),
      this.prisma.supplierBankAccount.update({
        where: { id: existing.id },
        data: { isPrimary: true, updatedById: user.id },
      }),
    ]);

    await this.createSupplierChangeLog({
      tenantId: tenant.id,
      supplierId,
      changeType: 'BANK_SET_PRIMARY',
      actorUserId: user.id,
      refId: existing.id,
      field: 'isPrimary',
      newValue: 'true',
    });

    await writeAuditEventWithPrisma(
      {
        tenantId: tenant.id,
        eventType: AuditEventType.AP_POST,
        entityType: AuditEntityType.SUPPLIER_INVOICE,
        entityId: supplierId,
        actorUserId: user.id,
        timestamp: new Date(),
        outcome: 'SUCCESS' as any,
        action: 'AP_SUPPLIER_BANK_SET_PRIMARY',
        permissionUsed: PERMISSIONS.AP.SUPPLIER_CREATE,
        lifecycleType: 'UPDATE',
        metadata: { supplierId, supplierBankAccountId: existing.id },
      },
      this.prisma,
    );

    return { ok: true };
  }

  // Supplier change history
  async listSupplierChangeHistory(req: Request, supplierId: string) {
    const tenant = req.tenant;
    if (!tenant) throw new BadRequestException('Missing tenant context');

    await this.assertActiveSupplier({ tenantId: tenant.id, supplierId });

    return this.prisma.supplierChangeLog.findMany({
      where: { tenantId: tenant.id, supplierId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createSupplier(req: Request, dto: CreateSupplierDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
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

  async listSuppliers(req: Request) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    return this.prisma.supplier.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async listEligibleAccounts(req: Request) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
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

  async createInvoice(req: Request, dto: CreateSupplierInvoiceDto) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, tenantId: tenant.id, isActive: true },
      select: { id: true },
    });

    if (!supplier) {
      throw new BadRequestException('Supplier not found or inactive');
    }

    const netAmount = this.round2(
      dto.lines.reduce((s, l) => s + (l.amount ?? 0), 0),
    );
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
      throw new BadRequestException({
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

    const accountMap = new Map(accounts.map((a) => [a.id, a] as const));

    for (const line of dto.lines) {
      const a = accountMap.get(line.accountId);
      if (!a) {
        throw new BadRequestException(
          `Account not found or inactive: ${line.accountId}`,
        );
      }
      if (a.type !== 'EXPENSE' && a.type !== 'ASSET') {
        throw new BadRequestException(
          `Invoice line account must be EXPENSE or ASSET: ${line.accountId}`,
        );
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

  async submitInvoice(req: Request, id: string) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const inv = await this.prisma.supplierInvoice.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true, createdById: true },
    });

    if (!inv) {
      throw new NotFoundException('Invoice not found');
    }

    if (inv.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT invoices can be submitted');
    }

    if (inv.createdById !== user.id) {
      throw new ForbiddenException('Only the creator can submit this invoice');
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

  async approveInvoice(req: Request, id: string) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const inv = await this.prisma.supplierInvoice.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true, createdById: true },
    });

    if (!inv) {
      throw new NotFoundException('Invoice not found');
    }

    if (inv.status !== 'SUBMITTED') {
      throw new BadRequestException('Only SUBMITTED invoices can be approved');
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

  async postInvoice(
    req: Request,
    id: string,
    opts?: { apControlAccountCode?: string },
  ) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const inv = await this.prisma.supplierInvoice.findFirst({
      where: { id, tenantId: tenant.id },
      include: { lines: true },
    });

    if (!inv) {
      throw new NotFoundException('Invoice not found');
    }

    if (inv.status === 'POSTED') {
      throw new BadRequestException('Invoice is already posted');
    }

    if (inv.status !== 'APPROVED') {
      throw new BadRequestException('Only APPROVED invoices can be posted');
    }

    if (!inv.approvedById) {
      throw new BadRequestException(
        'Invoice must have an approver before posting',
      );
    }

    const netAmount = this.round2(
      inv.lines.reduce((s, l) => s + Number(l.amount), 0),
    );
    this.assertInvoiceLines(
      inv.lines.map((l) => ({
        accountId: l.accountId,
        description: l.description,
        amount: Number(l.amount),
      })),
      netAmount,
    );

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

    const totalTax = this.round2(
      taxLines.reduce((s, t) => s + Number(t.taxAmount), 0),
    );
    const expectedGross = this.round2(netAmount + totalTax);
    if (this.round2(Number(inv.totalAmount)) !== expectedGross) {
      throw new BadRequestException({
        error: 'Invoice totalAmount must equal net + VAT before posting',
        netAmount,
        totalTax,
        expectedGross,
        totalAmount: this.round2(Number(inv.totalAmount)),
      });
    }

    for (const t of taxLines) {
      if (!t.taxRate.isActive || t.taxRate.type !== 'INPUT') {
        throw new BadRequestException(
          'Invoice has invalid or inactive INPUT VAT rate',
        );
      }
      const expected = this.round2(
        Number(t.taxableAmount) * Number(t.taxRate.rate),
      );
      if (this.round2(Number(t.taxAmount)) !== expected) {
        throw new BadRequestException('Invoice VAT line failed validation');
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

    if (!period) {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.AP_POST,
          entityType: AuditEntityType.SUPPLIER_INVOICE,
          entityId: inv.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'AP_INVOICE_POST',
          permissionUsed: PERMISSIONS.AP.INVOICE_POST,
          lifecycleType: 'POST',
          reason: 'No accounting period exists for the invoice date',
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: 'No accounting period exists for the invoice date',
      });
    }

    // Canonical period semantics: posting is allowed only in OPEN.
    // We preserve the existing ForbiddenException payload/messages on failure.
    try {
      assertCanPost(period.status, { periodName: period.name });
    } catch {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.AP_POST,
          entityType: AuditEntityType.SUPPLIER_INVOICE,
          entityId: inv.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'AP_INVOICE_POST',
          permissionUsed: PERMISSIONS.AP.INVOICE_POST,
          lifecycleType: 'POST',
          reason: `Accounting period is not OPEN: ${period.name}`,
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Posting blocked by accounting period control',
        reason: `Accounting period is not OPEN: ${period.name}`,
      });
    }

    if (period.name === 'Opening Balances') {
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.AP_POST,
          entityType: AuditEntityType.SUPPLIER_INVOICE,
          entityId: inv.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'AP_INVOICE_POST',
          permissionUsed: PERMISSIONS.AP.INVOICE_POST,
          lifecycleType: 'POST',
          reason: 'Operational postings are not allowed in the Opening Balances period',
        },
        this.prisma,
      );

      throw new ForbiddenException({
        error: 'Posting blocked by opening balances control period',
        reason:
          'Operational postings are not allowed in the Opening Balances period',
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
      await writeAuditEventWithPrisma(
        {
          tenantId: tenant.id,
          eventType: AuditEventType.AP_POST,
          entityType: AuditEntityType.SUPPLIER_INVOICE,
          entityId: inv.id,
          actorUserId: user.id,
          timestamp: new Date(),
          outcome: 'BLOCKED' as any,
          action: 'AP_INVOICE_POST',
          permissionUsed: PERMISSIONS.AP.INVOICE_POST,
          lifecycleType: 'POST',
          reason: `Posting dated before cutover is not allowed (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`,
        },
        this.prisma,
      );

      throw new ForbiddenException({
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
      throw new BadRequestException(
        `AP control account not found or invalid: ${apCode}`,
      );
    }

    const taxByAccountId = new Map<string, number>();
    for (const t of taxLines) {
      const accountId = String(t.taxRate.glAccountId ?? '').trim();
      if (!accountId) {
        throw new BadRequestException(
          'Tax rate is missing a VAT control account (glAccountId). Configure the tax rate before posting.',
        );
      }
      const prev = taxByAccountId.get(accountId) ?? 0;
      taxByAccountId.set(accountId, this.round2(prev + Number(t.taxAmount)));
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
          permissionUsed: PERMISSIONS.AP.INVOICE_POST,
        },
      })
      .catch(() => undefined);

    return { invoice: updatedInvoice, glJournal: postedJournal };
  }

  private async validateTaxLines(params: {
    tenantId: string;
    sourceType: 'SUPPLIER_INVOICE' | 'CUSTOMER_INVOICE';
    expectedRateType: 'INPUT' | 'OUTPUT';
    netAmount: number;
    taxLines: Array<{
      taxRateId: string;
      taxableAmount: number;
      taxAmount: number;
    }>;
  }) {
    if (!params.taxLines || params.taxLines.length === 0) {
      return {
        totalTax: 0,
        rows: [] as Array<{
          taxRateId: string;
          taxableAmount: number;
          taxAmount: number;
        }>,
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

    const rateById = new Map(rates.map((r) => [r.id, r] as const));
    for (const id of ids) {
      if (!rateById.get(id)) {
        throw new BadRequestException(
          `TaxRate not found/active or wrong type: ${id}`,
        );
      }
    }

    const rows = params.taxLines.map((t) => ({
      taxRateId: t.taxRateId,
      taxableAmount: this.round2(t.taxableAmount ?? 0),
      taxAmount: this.round2(t.taxAmount ?? 0),
    }));

    const totalTaxable = this.round2(
      rows.reduce((s, r) => s + r.taxableAmount, 0),
    );
    if (totalTaxable !== this.round2(params.netAmount)) {
      throw new BadRequestException({
        error: 'Taxable amounts must sum to invoice net amount',
        netAmount: this.round2(params.netAmount),
        totalTaxable,
      });
    }

    for (const r of rows) {
      const rate = rateById.get(r.taxRateId);
      const expected = this.round2(r.taxableAmount * Number(rate?.rate ?? 0));
      if (r.taxAmount !== expected) {
        throw new BadRequestException({
          error:
            'Tax line failed validation: taxableAmount × rate must equal taxAmount',
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

  private async assertTaxIntegrityBeforeSubmit(params: {
    tenantId: string;
    invoiceId: string;
  }) {
    const inv = await this.prisma.supplierInvoice.findFirst({
      where: { id: params.invoiceId, tenantId: params.tenantId },
      include: { lines: true },
    });

    if (!inv) {
      throw new BadRequestException('Invoice not found');
    }

    const netAmount = this.round2(
      inv.lines.reduce((s, l) => s + Number(l.amount), 0),
    );
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

    const totalTaxable = this.round2(
      taxLines.reduce((s, t) => s + Number(t.taxableAmount), 0),
    );
    if (totalTaxable !== this.round2(netAmount)) {
      throw new BadRequestException(
        'Invoice tax taxableAmount does not equal net amount',
      );
    }

    for (const t of taxLines) {
      if (!t.taxRate.isActive || t.taxRate.type !== 'INPUT') {
        throw new BadRequestException(
          'Invoice has invalid or inactive INPUT VAT rate',
        );
      }
      const expected = this.round2(
        Number(t.taxableAmount) * Number(t.taxRate.rate),
      );
      if (this.round2(Number(t.taxAmount)) !== expected) {
        throw new BadRequestException('Invoice VAT line failed validation');
      }
    }

    const totalTax = this.round2(
      taxLines.reduce((s, t) => s + Number(t.taxAmount), 0),
    );
    const expectedGross = this.round2(netAmount + totalTax);
    if (this.round2(Number(inv.totalAmount)) !== expectedGross) {
      throw new BadRequestException('Invoice totalAmount must equal net + VAT');
    }
  }

  async listInvoices(req: Request) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    return this.prisma.supplierInvoice.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
      include: { supplier: true, lines: true },
    });
  }

  private assertInvoiceLines(
    lines: Array<{ accountId: string; description: string; amount: number }>,
    totalAmount: number,
  ) {
    if (!lines || lines.length < 1) {
      throw new BadRequestException('Invoice must have at least 1 line');
    }

    for (const l of lines) {
      if ((l.amount ?? 0) <= 0) {
        throw new BadRequestException(
          'Invoice line amount must be greater than zero',
        );
      }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const sum = round2(lines.reduce((s, l) => s + (l.amount ?? 0), 0));
    const total = round2(totalAmount ?? 0);

    if (sum !== total) {
      throw new BadRequestException({
        error: 'Invoice lines do not sum to totalAmount',
        sum,
        totalAmount: total,
      });
    }
  }
}
