import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getFirstEnv } from './env.util';

@Injectable()
export class ReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async checkDb(): Promise<'ok' | 'fail'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'fail';
    }
  }

  async checkStorage(): Promise<'ok' | 'fail'> {
    const provider = (process.env.STORAGE_PROVIDER ?? 'local')
      .trim()
      .toLowerCase();
    if (provider !== 'local') {
      return 'ok';
    }

    const storageLocalPath = getFirstEnv(['STORAGE_LOCAL_PATH']) ?? './storage';
    const evidenceDir = path.join(process.cwd(), storageLocalPath, 'evidence');

    try {
      await fs.mkdir(evidenceDir, { recursive: true });
      const testFile = path.join(evidenceDir, `.ready_${Date.now()}`);
      await fs.writeFile(testFile, 'ok');
      await fs.unlink(testFile);
      return 'ok';
    } catch {
      return 'fail';
    }
  }

  async checkGovernanceTables(): Promise<{
    status: 'ok' | 'fail';
    missing: string[];
  }> {
    const required = [
      'GovernanceOverrideSession',
      'GovernanceAutomationSchedule',
      'GovernanceAutomationExecutionSession',
    ];

    try {
      const rows = await this.prisma.$queryRaw<{ table_name: string }[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (${Prisma.join(required)})
      `;

      const existing = new Set(
        (rows ?? []).map((r) => String((r as any)?.table_name ?? '').trim()),
      );
      const missing = required.filter((t) => !existing.has(t));

      return { status: missing.length === 0 ? 'ok' : 'fail', missing };
    } catch {
      return { status: 'fail', missing: required };
    }
  }
}
