import { BadRequestException, Injectable } from '@nestjs/common';
import type { PresentedReport } from './report-presentation.service';
import type { IfrsDisclosureNoteDto } from './ifrs-disclosure-notes.types';

type PdfHeaderBlock = {
  entityLegalName: string;
  reportName: string;
  periodLine: string;
  currencyIsoCode: string;
  headerFooterLine?: string;
};

@Injectable()
export class ReportExportService {
  private formatMoney(n: number) {
    const v = Number(n ?? 0);
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(v));
    return v < 0 ? `(${formatted})` : formatted;
  }

  private ensurePdfKit() {
    let PDFDocument: any;
    try {
      PDFDocument = require('pdfkit');
    } catch {
      throw new BadRequestException(
        'PDF export not available (missing dependency pdfkit)',
      );
    }
    return PDFDocument;
  }

  private pageWidth(doc: any) {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
  }

  private x0(doc: any) {
    return doc.page.margins.left;
  }

  private yMax(doc: any) {
    return doc.page.height - doc.page.margins.bottom;
  }

  private ensureSpace(doc: any, minHeight: number, onNewPage?: () => void) {
    if (doc.y + minHeight <= this.yMax(doc)) return;
    doc.addPage();
    if (onNewPage) onNewPage();
  }

  private renderHeaderBlock(doc: any, header: PdfHeaderBlock) {
    const width = this.pageWidth(doc);
    const x = this.x0(doc);

    doc.font('Helvetica-Bold').fontSize(14);
    doc.text(header.entityLegalName, x, doc.y, {
      width,
      align: 'center',
    });

    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(header.reportName, x, doc.y, { width, align: 'center' });

    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(10);
    doc.text(header.periodLine, x, doc.y, { width, align: 'center' });

    doc.moveDown(0.15);
    doc.font('Helvetica').fontSize(8).fillColor('#444');
    doc.text(
      header.headerFooterLine ??
        `Currency: ${header.currencyIsoCode} | Prepared in accordance with IFRS`,
      x,
      doc.y,
      { width, align: 'center' },
    );
    doc.fillColor('#000');

    doc.moveDown(0.8);
    doc
      .moveTo(x, doc.y)
      .lineTo(x + width, doc.y)
      .strokeColor('#ddd')
      .stroke();
    doc.strokeColor('#000');
    doc.moveDown(0.8);
  }

  private renderTwoColumnRow(
    doc: any,
    params: {
      label: string;
      value: string;
      labelWidth: number;
      valueWidth: number;
      bold?: boolean;
      indent?: number;
      lineGap?: number;
    },
  ) {
    const x = this.x0(doc) + (params.indent ?? 0);
    const y = doc.y;
    const labelW = params.labelWidth - (params.indent ?? 0);
    const valueW = params.valueWidth;

    doc.font(params.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    doc.text(params.label, x, y, {
      width: labelW,
      align: 'left',
      lineGap: params.lineGap ?? 1,
    });
    doc.text(params.value, x + labelW, y, {
      width: valueW,
      align: 'right',
    });

    const h1 = doc.heightOfString(params.label, {
      width: labelW,
      lineGap: params.lineGap ?? 1,
    });
    const h2 = doc.heightOfString(params.value, { width: valueW });
    doc.y = y + Math.max(h1, h2) + 2;
  }

  private csvEscape(v: string) {
    if (v.includes('"') || v.includes(',') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  }

  toCsv(report: PresentedReport): Buffer {
    const lines: string[] = [];

    lines.push(this.csvEscape(report.title));
    lines.push('');

    const hasCompare = report.sections.some(
      (s) =>
        s.rows.some((r) => !!r.compareAmount) || !!s.subtotal?.compareAmount,
    );

    const header = hasCompare
      ? ['Section', 'Line', 'Current', 'Comparative']
      : ['Section', 'Line', 'Current'];
    lines.push(header.map((h) => this.csvEscape(h)).join(','));

    for (const s of report.sections) {
      for (const r of s.rows) {
        const row = hasCompare
          ? [
              s.label,
              r.label,
              r.amount.display,
              r.compareAmount ? r.compareAmount.display : '',
            ]
          : [s.label, r.label, r.amount.display];
        lines.push(row.map((x) => this.csvEscape(String(x))).join(','));
      }

      if (s.subtotal) {
        const r = s.subtotal;
        const row = hasCompare
          ? [
              s.label,
              r.label,
              r.amount.display,
              r.compareAmount ? r.compareAmount.display : '',
            ]
          : [s.label, r.label, r.amount.display];
        lines.push(row.map((x) => this.csvEscape(String(x))).join(','));
      }

      lines.push('');
    }

    for (const t of report.totals) {
      const row = hasCompare
        ? [
            'Totals',
            t.label,
            t.amount.display,
            t.compareAmount ? t.compareAmount.display : '',
          ]
        : ['Totals', t.label, t.amount.display];
      lines.push(row.map((x) => this.csvEscape(String(x))).join(','));
    }

    return Buffer.from(lines.join('\n'), 'utf8');
  }

  async toXlsx(report: PresentedReport): Promise<Buffer> {
    let ExcelJS: any;
    try {
      ExcelJS = require('exceljs');
    } catch {
      throw new BadRequestException(
        'XLSX export not available (missing dependency exceljs)',
      );
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Report');

    ws.addRow([report.title]);
    ws.addRow([]);

    const hasCompare = report.sections.some(
      (s) =>
        s.rows.some((r) => !!r.compareAmount) || !!s.subtotal?.compareAmount,
    );
    ws.addRow(
      hasCompare
        ? ['Section', 'Line', 'Current', 'Comparative']
        : ['Section', 'Line', 'Current'],
    );

    for (const s of report.sections) {
      for (const r of s.rows) {
        ws.addRow(
          hasCompare
            ? [
                s.label,
                r.label,
                r.amount.display,
                r.compareAmount?.display ?? '',
              ]
            : [s.label, r.label, r.amount.display],
        );
      }
      if (s.subtotal) {
        const r = s.subtotal;
        ws.addRow(
          hasCompare
            ? [
                s.label,
                r.label,
                r.amount.display,
                r.compareAmount?.display ?? '',
              ]
            : [s.label, r.label, r.amount.display],
        );
      }
      ws.addRow([]);
    }

    for (const t of report.totals) {
      ws.addRow(
        hasCompare
          ? [
              'Totals',
              t.label,
              t.amount.display,
              t.compareAmount?.display ?? '',
            ]
          : ['Totals', t.label, t.amount.display],
      );
    }

    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    return Buffer.from(buf);
  }

  async toPdf(params: {
    report: PresentedReport;
    header: PdfHeaderBlock;
  }): Promise<Buffer> {
    const PDFDocument = this.ensurePdfKit();

    const report = params.report;
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const drawHeader = () => this.renderHeaderBlock(doc, params.header);
    drawHeader();

    const hasCompare = report.sections.some(
      (s) =>
        s.rows.some((r) => !!r.compareAmount) || !!s.subtotal?.compareAmount,
    );

    const width = this.pageWidth(doc);
    const x = this.x0(doc);
    const colAmount = hasCompare ? 120 : 140;
    const colCompare = hasCompare ? 120 : 0;
    const labelWidth = width - colAmount - colCompare;

    const renderSectionHeader = (label: string) => {
      this.ensureSpace(doc, 24, drawPageHeader);
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text(label, x, doc.y, { width });
      doc.moveDown(0.25);
      doc
        .moveTo(x, doc.y)
        .lineTo(x + width, doc.y)
        .strokeColor('#eee')
        .stroke();
      doc.strokeColor('#000');
      doc.moveDown(0.35);
    };

    const isClosingBalanceLabel = (label: string) =>
      /profit for the period|total assets|total equity|liabilities \+ equity|closing cash and cash equivalents/i.test(
        label,
      );

    const renderLine = (
      r: { label: string; amount: any; compareAmount?: any },
      opts?: { bold?: boolean; indent?: number; separatorAbove?: boolean },
    ) => {
      this.ensureSpace(doc, 16, drawPageHeader);

      if (opts?.separatorAbove) {
        doc
          .moveTo(x, doc.y)
          .lineTo(x + width, doc.y)
          .strokeColor('#000')
          .stroke();
        doc.strokeColor('#000');
        doc.moveDown(0.25);
      }

      const value = hasCompare
        ? `${this.formatMoney(Number(r.amount?.value ?? 0))}`
        : this.formatMoney(Number(r.amount?.value ?? 0));

      this.renderTwoColumnRow(doc, {
        label: r.label,
        value,
        labelWidth,
        valueWidth: colAmount,
        bold: opts?.bold,
        indent: opts?.indent,
      });

      if (hasCompare) {
        const y = doc.y - 12;
        doc.font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        doc.text(
          this.formatMoney(Number(r.compareAmount?.value ?? 0)),
          x + labelWidth + colAmount,
          y,
          { width: colCompare, align: 'right' },
        );
      }
    };

    const renderTableHeaderRow = () => {
      this.ensureSpace(doc, 18, drawHeader);
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('Line', x, y, { width: labelWidth, align: 'left' });
      doc.text('Current', x + labelWidth, y, {
        width: colAmount,
        align: 'right',
      });
      if (hasCompare) {
        doc.text(
          'Comparative',
          x + labelWidth + colAmount,
          y,
          { width: colCompare, align: 'right' },
        );
      }
      doc.moveDown(0.5);
      doc
        .moveTo(x, doc.y)
        .lineTo(x + width, doc.y)
        .strokeColor('#ddd')
        .stroke();
      doc.strokeColor('#000');
      doc.moveDown(0.35);
    };

    const renderTableHeaderRowNoEnsure = () => {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('Line', x, y, { width: labelWidth, align: 'left' });
      doc.text('Current', x + labelWidth, y, {
        width: colAmount,
        align: 'right',
      });
      if (hasCompare) {
        doc.text(
          'Comparative',
          x + labelWidth + colAmount,
          y,
          { width: colCompare, align: 'right' },
        );
      }
      doc.moveDown(0.5);
      doc
        .moveTo(x, doc.y)
        .lineTo(x + width, doc.y)
        .strokeColor('#ddd')
        .stroke();
      doc.strokeColor('#000');
      doc.moveDown(0.35);
    };

    const drawPageHeader = () => {
      drawHeader();
      renderTableHeaderRowNoEnsure();
    };

    renderTableHeaderRow();

    for (const s of report.sections) {
      renderSectionHeader(s.label);

      for (const r of s.rows) {
        renderLine(r, { indent: 10 });
      }

      if (s.subtotal) {
        const r = s.subtotal;
        doc.moveDown(0.2);
        doc
          .moveTo(x, doc.y)
          .lineTo(x + width, doc.y)
          .strokeColor('#ddd')
          .stroke();
        doc.strokeColor('#000');
        doc.moveDown(0.25);
        renderLine(r, { bold: true });
      }

      doc.moveDown(0.6);
    }

    if (report.totals.length > 0) {
      doc.moveDown(0.4);
      for (const t of report.totals) {
        const isClosing = isClosingBalanceLabel(String(t.label ?? ''));
        renderLine(t, {
          bold: true,
          indent: 0,
          separatorAbove: isClosing,
        });
      }
    }

    return await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }

  async trialBalanceToXlsx(params: {
    title: string;
    from: string;
    to: string;
    rows: Array<{
      accountCode: string;
      accountName: string;
      totalDebit: number;
      totalCredit: number;
      net: number;
    }>;
  }): Promise<Buffer> {
    let ExcelJS: any;
    try {
      ExcelJS = require('exceljs');
    } catch {
      throw new BadRequestException(
        'XLSX export not available (missing dependency exceljs)',
      );
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Trial Balance');

    ws.addRow([params.title]);
    ws.addRow([`Range: ${params.from} to ${params.to}`]);
    ws.addRow([]);
    ws.addRow(['Code', 'Account', 'Debit', 'Credit', 'Net']);

    for (const r of params.rows) {
      ws.addRow([
        r.accountCode,
        r.accountName,
        Number(r.totalDebit ?? 0),
        Number(r.totalCredit ?? 0),
        Number(r.net ?? 0),
      ]);
    }

    ws.getRow(4).font = { bold: true };
    ws.getColumn(1).width = 14;
    ws.getColumn(2).width = 40;
    ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 16;
    ws.getColumn(5).width = 16;

    for (const idx of [3, 4, 5]) {
      ws.getColumn(idx).numFmt = '#,##0.00;(#,##0.00)';
    }

    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    return Buffer.from(buf);
  }

  async trialBalanceToPdf(params: {
    title: string;
    header: PdfHeaderBlock;
    from: string;
    to: string;
    rows: Array<{
      accountCode: string;
      accountName: string;
      totalDebit: number;
      totalCredit: number;
      net: number;
    }>;
    totals: { totalDebit: number; totalCredit: number; net: number };
  }): Promise<Buffer> {
    const PDFDocument = this.ensurePdfKit();

    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const drawHeader = () => this.renderHeaderBlock(doc, params.header);
    drawHeader();

    const pageWidth = this.pageWidth(doc);
    const x0 = this.x0(doc);
    const colCode = 70;
    const colNum = 100;
    const colAccount = Math.max(140, pageWidth - colCode - colNum * 3);

    const drawColumnHeader = () => {
      this.ensureSpace(doc, 18, drawHeader);
      const yHeader = doc.y;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Code', x0, yHeader, { width: colCode });
      doc.text('Account', x0 + colCode, yHeader, { width: colAccount });
      doc.text('Debit', x0 + colCode + colAccount, yHeader, {
        width: colNum,
        align: 'right',
      });
      doc.text('Credit', x0 + colCode + colAccount + colNum, yHeader, {
        width: colNum,
        align: 'right',
      });
      doc.text('Net', x0 + colCode + colAccount + colNum * 2, yHeader, {
        width: colNum,
        align: 'right',
      });
      doc.moveDown(0.5);
      doc.font('Helvetica');
      doc
        .moveTo(x0, doc.y)
        .lineTo(x0 + pageWidth, doc.y)
        .strokeColor('#ddd')
        .stroke();
      doc.strokeColor('#000');
      doc.moveDown(0.35);
    };

    drawColumnHeader();

    doc.fontSize(9);
    for (const r of params.rows) {
      this.ensureSpace(doc, 14, () => {
        drawHeader();
        drawColumnHeader();
      });
      const y = doc.y;
      doc.text(String(r.accountCode ?? ''), x0, y, { width: colCode });
      doc.text(String(r.accountName ?? ''), x0 + colCode, y, {
        width: colAccount,
      });
      doc.text(
        this.formatMoney(Number(r.totalDebit ?? 0)),
        x0 + colCode + colAccount,
        y,
        { width: colNum, align: 'right' },
      );
      doc.text(
        this.formatMoney(Number(r.totalCredit ?? 0)),
        x0 + colCode + colAccount + colNum,
        y,
        { width: colNum, align: 'right' },
      );
      doc.text(
        this.formatMoney(Number(r.net ?? 0)),
        x0 + colCode + colAccount + colNum * 2,
        y,
        { width: colNum, align: 'right' },
      );
      doc.moveDown(0.9);
    }

    doc.moveDown(0.3);
    doc
      .moveTo(x0, doc.y)
      .lineTo(x0 + pageWidth, doc.y)
      .strokeColor('#000')
      .stroke();
    doc.moveDown(0.35);
    doc.font('Helvetica-Bold');
    const yTot = doc.y;
    doc.text('Grand totals', x0, yTot, { width: colCode + colAccount });
    doc.text(
      this.formatMoney(Number(params.totals.totalDebit ?? 0)),
      x0 + colCode + colAccount,
      yTot,
      { width: colNum, align: 'right' },
    );
    doc.text(
      this.formatMoney(Number(params.totals.totalCredit ?? 0)),
      x0 + colCode + colAccount + colNum,
      yTot,
      { width: colNum, align: 'right' },
    );
    doc.text(
      this.formatMoney(Number(params.totals.net ?? 0)),
      x0 + colCode + colAccount + colNum * 2,
      yTot,
      { width: colNum, align: 'right' },
    );
    doc.font('Helvetica');

    return await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }

  async ifrsDisclosureNoteToPdf(params: {
    note: IfrsDisclosureNoteDto;
    header: PdfHeaderBlock;
  }): Promise<Buffer> {
    const PDFDocument = this.ensurePdfKit();

    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const drawHeader = () => this.renderHeaderBlock(doc, params.header);
    drawHeader();

    if (params.note.narrative) {
      const parts = String(params.note.narrative)
        .split(/\n\s*\n/g)
        .map((p) => p.trim())
        .filter(Boolean);
      doc.fontSize(10).font('Helvetica');
      for (const p of parts) {
        this.ensureSpace(doc, 40, drawHeader);
        doc.text(p, { align: 'left', lineGap: 2 });
        doc.moveDown(0.75);
      }
    }

    const pageWidth = this.pageWidth(doc);
    const x0 = this.x0(doc);

    for (const t of params.note.tables ?? []) {
      this.ensureSpace(doc, 60, drawHeader);

      doc.font('Helvetica-Bold').fontSize(11).text(t.title, x0, doc.y, {
        width: pageWidth,
      });
      doc.font('Helvetica');
      doc.moveDown(0.35);

      const cols = t.columns ?? [];
      const colCount = Math.max(1, cols.length);
      const colWidth = pageWidth / colCount;

      const drawTableHeader = () => {
        this.ensureSpace(doc, 18, drawHeader);
        const headerY = doc.y;
        doc.font('Helvetica-Bold').fontSize(9);
        cols.forEach((c, idx) => {
          doc.text(String(c.label ?? ''), x0 + idx * colWidth, headerY, {
            width: colWidth,
            align: c.align === 'right' ? 'right' : 'left',
            lineGap: 1,
          });
        });
        doc.font('Helvetica');
        doc.moveDown(0.6);
        doc
          .moveTo(x0, doc.y)
          .lineTo(x0 + pageWidth, doc.y)
          .strokeColor('#ddd')
          .stroke();
        doc.strokeColor('#000');
        doc.moveDown(0.3);
      };

      drawTableHeader();

      doc.fontSize(9);
      for (const r of t.rows ?? []) {
        const cells = cols.map((c) => {
          const raw = (r as any)?.[c.key];
          const isNumeric = typeof raw === 'number' || c.align === 'right';
          const val = isNumeric
            ? this.formatMoney(Number(raw ?? 0))
            : String(raw ?? '');
          return {
            text: val,
            align: c.align === 'right' ? 'right' : 'left',
          };
        });

        const heights = cells.map((cell) =>
          doc.heightOfString(cell.text, { width: colWidth, lineGap: 1 }),
        );
        const rowH = Math.max(12, ...heights) + 6;

        this.ensureSpace(doc, rowH, () => {
          drawHeader();
          drawTableHeader();
        });

        const y = doc.y;
        cells.forEach((cell, idx) => {
          doc.text(cell.text, x0 + idx * colWidth, y, {
            width: colWidth,
            align: cell.align,
            lineGap: 1,
          });
        });

        doc.y = y + rowH;
      }

      doc.moveDown(0.8);
    }

    if (
      Array.isArray(params.note.footnotes) &&
      params.note.footnotes.length > 0
    ) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
      }
      doc.font('Helvetica').fontSize(9);
      for (const f of params.note.footnotes) {
        this.ensureSpace(doc, 20, drawHeader);
        doc.text(String(f ?? ''), { lineGap: 2 });
        doc.moveDown(0.35);
      }
    }

    return await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}
