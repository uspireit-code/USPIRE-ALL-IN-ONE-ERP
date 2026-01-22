import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), PrismaModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
