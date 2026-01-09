import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  private logDatabaseTarget() {
    const raw = process.env.DATABASE_URL;
    if (!raw) return;
    try {
      const u = new URL(raw);
      const dbName = (u.pathname ?? '').replace(/^\//, '');
      this.logger.log(
        `DATABASE_URL target: ${u.hostname}:${u.port || '(default)'} db=${dbName || '(unknown)'} schema=${u.searchParams.get('schema') || 'public'}`,
      );
    } catch {
      this.logger.log('DATABASE_URL target: (unparseable)');
    }
  }

  async onModuleInit() {
    try {
      this.logDatabaseTarget();
      await this.$connect();
      await this.$queryRaw`SELECT 1`;
      this.logger.log('Database connection check succeeded');
    } catch (error) {
      this.logger.error('Database connection check failed', error as Error);

      if (process.env.NODE_ENV !== 'production') {
        return;
      }

      throw error;
    }
  }
}
