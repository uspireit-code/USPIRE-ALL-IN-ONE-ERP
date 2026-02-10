import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';
import { StorageModule } from '../storage/storage.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), PrismaModule, StorageModule, RbacModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [],
})
export class SettingsModule {}
