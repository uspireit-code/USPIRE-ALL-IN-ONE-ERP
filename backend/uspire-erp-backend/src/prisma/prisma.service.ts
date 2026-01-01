import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/index';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
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
