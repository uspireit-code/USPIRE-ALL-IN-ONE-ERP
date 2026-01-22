import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { SearchQueryDto, SearchResultItem } from './search.dto';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(req: Request, q: SearchQueryDto): Promise<{ q: string; results: SearchResultItem[] }> {
    const tenant: any = (req as any).tenant;
    if (!tenant?.id) throw new BadRequestException('Missing tenant context');

    const raw = String(q.q ?? '').trim();
    if (!raw) return { q: raw, results: [] };

    const term = raw.slice(0, 100);

    const routes: Array<{ label: string; targetUrl: string }> = [
      { label: 'Dashboard', targetUrl: '/' },
      { label: 'Finance & Accounting / General Ledger / Journal Register', targetUrl: '/finance/gl/journals' },
      { label: 'Cash & Bank / Bank Reconciliation', targetUrl: '/bank-reconciliation' },
      { label: 'Accounts Payable / Bills', targetUrl: '/finance/ap/bills' },
      { label: 'Accounts Payable / Suppliers', targetUrl: '/finance/ap/suppliers' },
      { label: 'Imprest / Cases', targetUrl: '/finance/imprest/cases' },
    ];

    const routeMatches: SearchResultItem[] = routes
      .filter((r) => r.label.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 8)
      .map((r) => ({ type: 'ROUTE', label: r.label, targetUrl: r.targetUrl }));

    const [journals, imprests, statementLineHits] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where: {
          tenantId: tenant.id,
          reference: { contains: term, mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, reference: true, journalDate: true, status: true },
      }),
      (this.prisma as any).imprestCase.findMany({
        where: {
          tenantId: tenant.id,
          reference: { contains: term, mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, reference: true, state: true },
      }),
      this.prisma.bankStatementLine.findMany({
        where: {
          statement: { tenantId: tenant.id },
          reference: { contains: term, mode: 'insensitive' },
        },
        take: 8,
        orderBy: { txnDate: 'desc' },
        select: { statementId: true, reference: true, statement: { select: { statementEndDate: true } } },
      }),
    ]);

    const journalResults: SearchResultItem[] = journals.map((j) => ({
      type: 'JOURNAL',
      label: `${j.reference ?? j.id}${j.status ? ` (${String(j.status)})` : ''}`,
      targetUrl: `/finance/gl/journals/${encodeURIComponent(j.id)}`,
    }));

    const imprestResults: SearchResultItem[] = imprests.map((c: any) => ({
      type: 'IMPREST',
      label: `${String(c.reference ?? c.id)}${c.state ? ` (${String(c.state)})` : ''}`,
      targetUrl: `/finance/imprest/cases/${encodeURIComponent(String(c.id))}`,
    }));

    const seenStatements = new Set<string>();
    const bankStatementResults: SearchResultItem[] = [];
    for (const hit of statementLineHits) {
      if (!hit.statementId || seenStatements.has(hit.statementId)) continue;
      seenStatements.add(hit.statementId);
      const endDate = hit.statement?.statementEndDate ? new Date(hit.statement.statementEndDate).toISOString().slice(0, 10) : '';
      const ref = String(hit.reference ?? '').trim();
      bankStatementResults.push({
        type: 'BANK_STATEMENT',
        label: ref ? `Bank Statement Line ${ref} (Statement end: ${endDate})` : `Bank Statement (Statement end: ${endDate})`,
        targetUrl: `/bank-reconciliation/statements/${encodeURIComponent(hit.statementId)}`,
      });
      if (bankStatementResults.length >= 8) break;
    }

    return {
      q: term,
      results: [...routeMatches, ...journalResults, ...bankStatementResults, ...imprestResults],
    };
  }
}
