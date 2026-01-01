import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReadyController } from './ready.controller';
import { ReadinessService } from './readiness.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReadyController],
  providers: [ReadinessService],
})
export class InternalReadinessModule {}
