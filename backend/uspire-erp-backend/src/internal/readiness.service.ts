import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
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
}
