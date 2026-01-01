import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AdminRoleGuard } from './admin-role.guard';
import { SystemSettingsReadGuard } from './system-settings-read.guard';

@Module({
  imports: [ConfigModule, JwtModule.register({}), PrismaModule, StorageModule],
  controllers: [SettingsController],
  providers: [SettingsService, AdminRoleGuard, SystemSettingsReadGuard],
})
export class SettingsModule {}
