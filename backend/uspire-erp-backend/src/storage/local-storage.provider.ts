import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { StorageProvider } from './storage.provider';
import { getFirstEnv } from '../internal/env.util';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly rootDir: string;

  constructor() {
    const base = getFirstEnv(['STORAGE_LOCAL_PATH']) ?? './storage';
    this.rootDir = path.join(process.cwd(), base, 'evidence');
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
