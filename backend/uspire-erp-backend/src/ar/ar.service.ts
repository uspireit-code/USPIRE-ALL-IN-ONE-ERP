import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { assertPeriodIsOpen } from '../finance/common/accounting-period.guard';
import { resolveArControlAccount } from '../finance/common/resolve-ar-control-account';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateCustomerInvoiceDto } from './dto/create-customer-invoice.dto';

@Injectable()
export class ArService {
  constructor(private readonly prisma: PrismaService) {}

  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  private async loadInvoiceCategoryOrThrow(params: {
    tenantId: string;
    invoiceCategoryId: string | null;
  }) {
    if (!params.invoiceCategoryId) {
      throw new BadRequestException('Invoice category is required before posting.');
    }

    const cat = await (this.prisma as any).invoiceCategory.findFirst({
      where: { tenantId: params.tenantId, id: params.invoiceCategoryId } as any,
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        revenueAccountId: true,
        requiresProject: true,
        requiresFund: true,
        requiresDepartment: true,
        revenueAccount: {
          select: { id: true, type: true, isActive: true } as any,
        },
      } as any,
    });

    if (!cat) throw new BadRequestException('Invoice category is required before posting.');
    if (!cat.isActive) {
      throw new BadRequestException(`Invoice category ${cat.name} is inactive.`);
    }

    const ra = (cat as any).revenueAccount;
    if (!ra || ra.isActive !== true || ra.type !== 'INCOME') {
      throw new BadRequestException(
        'Revenue account for invoice category is not configured or is invalid. Please check Chart of Accounts.',
      );
    }

    return cat as any;
  }

  private async getActiveDimensionOrThrow(params: {
    tenantId: string;
    invoiceDate: Date;
    projectId?: string | null;
    fundId?: string | null;
    departmentId?: string | null;
  }) {
    const invoiceDate = params.invoiceDate;

    if (params.projectId) {
      const p = await this.prisma.project.findFirst({
        where: {
          tenantId: params.tenantId,
          id: params.projectId,
          status: 'ACTIVE' as any,
          isActive: true,
          effectiveFrom: { lte: invoiceDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: invoiceDate } }],
        } as any,
        select: { id: true } as any,
      } as any);
      if (!p) {
        throw new BadRequestException(
          'Project is inactive, closed, or not effective for invoice date. Posting is not allowed.',
        );
      }
    }

    if (params.fundId) {
      const f = await (this.prisma.fund as any).findFirst({
        where: {
          tenantId: params.tenantId,
          id: params.fundId,
          status: 'ACTIVE' as any,
          isActive: true,
          effectiveFrom: { lte: invoiceDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: invoiceDate } }],
        } as any,
        select: { id: true, projectId: true } as any,
      } as any);
      if (!f) {
        throw new BadRequestException(
          'Fund is inactive, closed, or not effective for invoice date. Posting is not allowed.',
        );
      }
      if (params.projectId && String((f as any).projectId) !== String(params.projectId)) {
        throw new BadRequestException(
          'Fund is not valid for the selected project. Posting is not allowed.',
        );
      }
    }

    if (params.departmentId) {
      const d = await (this.prisma.department as any).findFirst({
        where: {
          tenantId: params.tenantId,
          id: params.departmentId,
          status: 'ACTIVE' as any,
          isActive: true,
          effectiveFrom: { lte: invoiceDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: invoiceDate } }],
        } as any,
        select: { id: true } as any,
      } as any);
      if (!d) {
        throw new BadRequestException(
          'Department is inactive, closed, or not effective for invoice date. Posting is not allowed.',
        );
      }
    }
  }

  async createCustomer(req: Request, dto: CreateCustomerDto) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    return (this.prisma as any).customer.create({
      data: {
        tenantId: tenant.id,
        name: dto.name,
        taxNumber: dto.taxNumber,
        status: 'ACTIVE',
      },
    });
  }

  async listCustomers(req: Request) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    return (this.prisma as any).customer.findMany({
      where: { tenantId: tenant.id, status: 'ACTIVE' },
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
        type: 'INCOME',
      },
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        requiresDepartment: true,
        requiresProject: true,
        requiresFund: true,
      } as any,
    });
  }

  async createInvoice(req: Request, dto: CreateCustomerInvoiceDto) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const customer = await (this.prisma as any).customer.findFirst({
      where: { id: dto.customerId, tenantId: tenant.id },
      select: { id: true, status: true },
    });

    if (!customer) {
      throw new BadRequestException('Customer not found');
    }
    if (customer.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Customer is inactive and cannot be used for new transactions.',
      );
    }

    const netAmount = this.round2(
      dto.lines.reduce((s, l) => s + (l.amount ?? 0), 0),
    );
    this.assertInvoiceLines(dto.lines, netAmount);

    const invoiceDate = new Date(dto.invoiceDate);
    if (Number.isNaN(invoiceDate.getTime())) {
      throw new BadRequestException('Invalid invoiceDate');
    }

    await assertPeriodIsOpen({
      prisma: this.prisma,
      tenantId: tenant.id,
      date: invoiceDate,
      action: 'create',
      documentLabel: 'invoice',
      dateLabel: 'invoice date',
    });

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
      if (a.type !== 'INCOME') {
        throw new BadRequestException(
          `Invoice line account must be INCOME: ${line.accountId}`,
        );
      }
    }

    const currency = 'USD';
    const subtotal = this.round2(netAmount);
    const taxAmount = 0;
    const totalAmount = this.round2(subtotal + taxAmount);

    const invoice = await this.prisma.customerInvoice.create({
      data: {
        tenantId: tenant.id,
        customerId: dto.customerId,
        invoiceNumber: dto.invoiceNumber,
        invoiceDate,
        dueDate: new Date(dto.dueDate),
        currency,
        invoiceCategoryId: (dto as any).invoiceCategoryId ?? undefined,
        projectId: (dto as any).projectId ?? undefined,
        fundId: (dto as any).fundId ?? undefined,
        departmentId: (dto as any).departmentId ?? undefined,
        subtotal,
        taxAmount,
        totalAmount,
        createdById: user.id,
        status: 'DRAFT',
        lines: {
          create: dto.lines.map((l) => ({
            accountId: l.accountId,
            description: l.description,
            quantity: 1,
            unitPrice: l.amount,
            lineTotal: l.amount,
          })),
        },
      } as any,
      include: { lines: true, customer: true } as any,
    } as any);

    return invoice;
  }

  async postInvoice(
    req: Request,
    id: string,
  ) {
    const tenant = req.tenant;
    const user = req.user;

    if (!tenant || !user) {
      throw new BadRequestException('Missing tenant or user context');
    }

    const inv = await this.prisma.customerInvoice.findFirst({
      where: { id, tenantId: tenant.id },
      include: { lines: true },
    });

    if (!inv) {
      throw new NotFoundException('Invoice not found');
    }

    if (inv.status === 'POSTED') {
      throw new BadRequestException('Invoice is already posted');
    }

    if (inv.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT invoices can be posted');
    }

    const netAmount = this.round2(
      inv.lines.reduce((s, l: any) => s + Number(l.lineTotal), 0),
    );

    let period: any = null;
    try {
      period = await assertPeriodIsOpen({
        prisma: this.prisma,
        tenantId: tenant.id,
        date: new Date(inv.invoiceDate),
        action: 'post',
        documentLabel: 'invoice',
        dateLabel: 'invoice date',
      });
    } catch (e: any) {
      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'AR_POST',
            entityType: 'CUSTOMER_INVOICE',
            entityId: inv.id,
            action: 'AR_INVOICE_POST',
            outcome: 'BLOCKED',
            reason: String(e?.message ?? 'Posting blocked by accounting period control'),
            userId: user.id,
            permissionUsed: 'AR_INVOICE_POST',
          },
        })
        .catch(() => undefined);
      throw e;
    }

    if (period.name === 'Opening Balances') {
      await this.prisma.auditEvent
        .create({
          data: {
            tenantId: tenant.id,
            eventType: 'AR_POST',
            entityType: 'CUSTOMER_INVOICE',
            entityId: inv.id,
            action: 'AR_INVOICE_POST',
            outcome: 'BLOCKED',
            reason:
              'Operational postings are not allowed in the Opening Balances period',
            userId: user.id,
            permissionUsed: 'AR_INVOICE_POST',
          },
        })
        .catch(() => undefined);

      throw new ForbiddenException({
        error: 'Posting blocked by opening balances control period',
        reason:
          'Operational postings are not allowed in the Opening Balances period',
      });
    }

    const invoiceCategoryId = String((inv as any).invoiceCategoryId ?? '').trim() || null;
    const category = await this.loadInvoiceCategoryOrThrow({
      tenantId: tenant.id,
      invoiceCategoryId,
    });

    const headerProjectId = String((inv as any).projectId ?? '').trim() || null;
    const headerFundId = String((inv as any).fundId ?? '').trim() || null;
    const headerDepartmentId = String((inv as any).departmentId ?? '').trim() || null;

    if (category.requiresProject && !headerProjectId) {
      throw new BadRequestException('Project is required for this invoice category before posting.');
    }
    if (category.requiresFund && !headerFundId) {
      throw new BadRequestException('Fund is required for this invoice category before posting.');
    }
    if (category.requiresDepartment && !headerDepartmentId) {
      throw new BadRequestException('Department is required for this invoice category before posting.');
    }

    await this.getActiveDimensionOrThrow({
      tenantId: tenant.id,
      invoiceDate: new Date(inv.invoiceDate),
      projectId: headerProjectId,
      fundId: headerFundId,
      departmentId: headerDepartmentId,
    });

    const revenueAccountId = String((category as any).revenueAccountId);

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
            eventType: 'AR_POST',
            entityType: 'CUSTOMER_INVOICE',
            entityId: inv.id,
            action: 'AR_INVOICE_POST',
            outcome: 'BLOCKED',
            reason: `Posting dated before cutover is not allowed (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`,
            userId: user.id,
            permissionUsed: 'AR_INVOICE_POST',
          },
        })
        .catch(() => undefined);

      throw new ForbiddenException({
        error: 'Posting blocked by cutover lock',
        reason: `Posting dated before cutover is not allowed (cutover: ${cutoverLocked.startDate.toISOString().slice(0, 10)})`,
      });
    }

    const arAccount = await resolveArControlAccount(this.prisma as any, tenant.id);

    const journal = await this.prisma.journalEntry.create({
      data: {
        tenantId: tenant.id,
        journalDate: inv.invoiceDate,
        reference: `AR-INVOICE:${inv.id}`,
        description: `AR invoice posting: ${inv.id}`,
        createdById: inv.createdById,
        lines: {
          create: [
            {
              accountId: arAccount.id,
              debit: inv.totalAmount,
              credit: 0,
              projectId: category.requiresProject ? headerProjectId : null,
              fundId: category.requiresFund ? headerFundId : null,
              departmentId: category.requiresDepartment ? headerDepartmentId : null,
            },
            {
              accountId: revenueAccountId,
              debit: 0,
              credit: inv.totalAmount,
              projectId: category.requiresProject ? headerProjectId : null,
              fundId: category.requiresFund ? headerFundId : null,
              departmentId: category.requiresDepartment ? headerDepartmentId : null,
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

    const updatedInvoice = await this.prisma.customerInvoice.update({
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
          entityId: inv.id,
          action: 'AR_INVOICE_POST',
          outcome: 'SUCCESS',
          userId: user.id,
          permissionUsed: 'AR_INVOICE_POST',
        },
      })
      .catch(() => undefined);

    return { invoice: updatedInvoice, glJournal: postedJournal };
  }

  async listInvoices(req: Request) {
    const tenant = req.tenant;
    if (!tenant) {
      throw new BadRequestException('Missing tenant context');
    }

    return this.prisma.customerInvoice.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
      include: { customer: true, lines: true },
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
