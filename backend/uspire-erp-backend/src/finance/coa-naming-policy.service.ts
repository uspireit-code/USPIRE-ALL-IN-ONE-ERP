import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CoaNamingValidationIssue = {
  field: 'code' | 'name';
  code:
    | 'REQUIRED'
    | 'FORMAT'
    | 'DUPLICATE'
    | 'RESTRICTED'
    | 'GENERIC'
    | 'WHITESPACE';
  message: string;
  conflictingAccountId?: string;
  conflictingAccountCode?: string;
  conflictingAccountName?: string;
};

export type CoaNamingPolicyValidationResult = {
  normalizedCode: string;
  normalizedName: string;
  issues: CoaNamingValidationIssue[];
};

@Injectable()
export class CoaNamingPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeCode(input: any) {
    return String(input ?? '').trim();
  }

  normalizeName(input: any) {
    const trimmed = String(input ?? '').trim();
    return trimmed.replace(/\s+/g, ' ');
  }

  normalizeNameKey(input: any) {
    return this.normalizeName(input).toLowerCase();
  }

  normalizeCodeKey(input: any) {
    return this.normalizeCode(input).toLowerCase();
  }

  validateCodeFormat(code: string): CoaNamingValidationIssue[] {
    const issues: CoaNamingValidationIssue[] = [];

    if (!code) {
      issues.push({ field: 'code', code: 'REQUIRED', message: 'Account Code is required.' });
      return issues;
    }

    if (/\s/.test(code)) {
      issues.push({
        field: 'code',
        code: 'WHITESPACE',
        message: 'Account Code cannot contain spaces.',
      });
    }

    if (/[^A-Za-z0-9._-]/.test(code)) {
      issues.push({
        field: 'code',
        code: 'FORMAT',
        message: 'Account Code contains invalid characters.',
      });
    }

    if (code.length > 40) {
      issues.push({
        field: 'code',
        code: 'FORMAT',
        message: 'Account Code is too long.',
      });
    }

    return issues;
  }

  validateNameFormat(name: string): CoaNamingValidationIssue[] {
    const issues: CoaNamingValidationIssue[] = [];

    if (!name) {
      issues.push({ field: 'name', code: 'REQUIRED', message: 'Account Name is required.' });
      return issues;
    }

    if (name !== name.trim()) {
      issues.push({ field: 'name', code: 'WHITESPACE', message: 'Account Name must be trimmed.' });
    }

    if (/\s{2,}/.test(name)) {
      issues.push({
        field: 'name',
        code: 'WHITESPACE',
        message: 'Account Name cannot contain repeated spaces.',
      });
    }

    const generic = new Set(['misc', 'general', 'temp', 'new account']);
    const key = name.trim().toLowerCase();
    if (generic.has(key)) {
      issues.push({
        field: 'name',
        code: 'GENERIC',
        message: `Account Name '${name}' is too generic. Please provide a more descriptive name.`,
      });
    }

    if (/\p{Cc}/u.test(name)) {
      issues.push({
        field: 'name',
        code: 'FORMAT',
        message: 'Account Name contains invalid control characters.',
      });
    }

    if (name.length > 180) {
      issues.push({
        field: 'name',
        code: 'FORMAT',
        message: 'Account Name is too long.',
      });
    }

    return issues;
  }

  async findDuplicateByCode(opts: { tenantId: string; code: string; excludeAccountId?: string }) {
    const codeKey = this.normalizeCodeKey(opts.code);
    if (!codeKey) return null;

    if (opts.excludeAccountId) {
      const rows: any[] = await this.prisma.$queryRaw`
        SELECT id, code, name
        FROM "Account"
        WHERE "tenantId" = ${opts.tenantId}
          AND lower(trim("code")) = ${codeKey}
          AND id <> ${opts.excludeAccountId}
        LIMIT 1
      `;
      return rows?.[0] ?? null;
    }

    const rows: any[] = await this.prisma.$queryRaw`
      SELECT id, code, name
      FROM "Account"
      WHERE "tenantId" = ${opts.tenantId}
        AND lower(trim("code")) = ${codeKey}
      LIMIT 1
    `;

    return rows?.[0] ?? null;
  }

  async findDuplicateByName(opts: { tenantId: string; name: string; excludeAccountId?: string }) {
    const nameKey = this.normalizeNameKey(opts.name);
    if (!nameKey) return null;

    if (opts.excludeAccountId) {
      const rows: any[] = await this.prisma.$queryRaw`
        SELECT id, code, name
        FROM "Account"
        WHERE "tenantId" = ${opts.tenantId}
          AND lower(regexp_replace(trim("name"), '\\s+', ' ', 'g')) = ${nameKey}
          AND id <> ${opts.excludeAccountId}
        LIMIT 1
      `;
      return rows?.[0] ?? null;
    }

    const rows: any[] = await this.prisma.$queryRaw`
      SELECT id, code, name
      FROM "Account"
      WHERE "tenantId" = ${opts.tenantId}
        AND lower(regexp_replace(trim("name"), '\\s+', ' ', 'g')) = ${nameKey}
      LIMIT 1
    `;

    return rows?.[0] ?? null;
  }

  async validateAccountNamingPolicy(opts: {
    tenantId: string;
    code: string;
    name: string;
    excludeAccountId?: string;
  }): Promise<CoaNamingPolicyValidationResult> {
    const normalizedCode = this.normalizeCode(opts.code);
    const normalizedName = this.normalizeName(opts.name);

    const issues: CoaNamingValidationIssue[] = [
      ...this.validateCodeFormat(normalizedCode),
      ...this.validateNameFormat(normalizedName),
    ];

    if (issues.length > 0) {
      return { normalizedCode, normalizedName, issues };
    }

    const dupCode = await this.findDuplicateByCode({
      tenantId: opts.tenantId,
      code: normalizedCode,
      excludeAccountId: opts.excludeAccountId,
    });

    if (dupCode) {
      issues.push({
        field: 'code',
        code: 'DUPLICATE',
        message: 'This account code is already in use.',
        conflictingAccountId: String(dupCode.id),
        conflictingAccountCode: String(dupCode.code ?? ''),
        conflictingAccountName: String(dupCode.name ?? ''),
      });
    }

    const dupName = await this.findDuplicateByName({
      tenantId: opts.tenantId,
      name: normalizedName,
      excludeAccountId: opts.excludeAccountId,
    });

    if (dupName) {
      issues.push({
        field: 'name',
        code: 'DUPLICATE',
        message: 'This account name is already in use.',
        conflictingAccountId: String(dupName.id),
        conflictingAccountCode: String(dupName.code ?? ''),
        conflictingAccountName: String(dupName.name ?? ''),
      });
    }

    return { normalizedCode, normalizedName, issues };
  }

  async assertAccountNamingPolicy(opts: {
    tenantId: string;
    code: string;
    name: string;
    excludeAccountId?: string;
  }) {
    const result = await this.validateAccountNamingPolicy(opts);

    if (result.issues.length > 0) {
      const hasDupCode = result.issues.some((i) => i.field === 'code' && i.code === 'DUPLICATE');
      const hasDupName = result.issues.some((i) => i.field === 'name' && i.code === 'DUPLICATE');
      const msg = hasDupCode
        ? 'Account Code already exists. Please use a different code.'
        : hasDupName
          ? 'Account Name already exists. Please use a different name.'
          : 'Account naming validation failed.';

      throw new BadRequestException({
        ok: false,
        message: msg,
        issues: result.issues,
      });
    }

    return { normalizedCode: result.normalizedCode, normalizedName: result.normalizedName };
  }
}
