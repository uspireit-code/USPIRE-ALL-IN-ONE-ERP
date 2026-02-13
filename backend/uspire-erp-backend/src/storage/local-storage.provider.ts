import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { StorageProvider } from './storage.provider';
import { getFirstEnv } from '../internal/env.util';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly rootDir: string;

  constructor() {
    const rawBase = String(getFirstEnv(['STORAGE_LOCAL_PATH']) ?? './storage').trim();
    const normalizedBase = rawBase.replace(/\\/g, '/').replace(/^\.\//, '');

    // In docker we often run with process.cwd() === '/app'. If STORAGE_LOCAL_PATH is set
    // to 'app/uploads', joining would produce '/app/app/uploads'. Normalize to 'uploads'.
    const safeBase = normalizedBase.startsWith('app/') ? normalizedBase.slice('app/'.length) : normalizedBase;

    const baseDir = path.isAbsolute(safeBase) ? safeBase : path.join(process.cwd(), safeBase);
    this.rootDir = path.join(baseDir, 'evidence');
  }

  private resolvePath(key: string) {
    const normalized = key.replace(/\\/g, '/');
    return path.join(this.rootDir, normalized);
  }

  async put(key: string, body: Buffer): Promise<void> {
    const fullPath = this.resolvePath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, body);
  }

  async get(key: string): Promise<Buffer> {
    const fullPath = this.resolvePath(key);
    return fs.readFile(fullPath);
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.resolvePath(key);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
