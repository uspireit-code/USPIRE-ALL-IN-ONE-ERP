import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { getFirstEnv } from '../internal/env.util';
import { MailerService } from './mailer.service';
import { SuperAdminGuard } from './super-admin.guard';
import { UnlockRequestsService } from './unlock-requests.service';

function parseDurationToSeconds(
  value: string,
  fallbackSeconds: number,
): number {
  const trimmed = value.trim();
  if (!trimmed) return fallbackSeconds;

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const match = trimmed.match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackSeconds;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multiplier =
    unit === 's'
      ? 1
      : unit === 'm'
        ? 60
        : unit === 'h'
          ? 60 * 60
          : 60 * 60 * 24;

  return amount * multiplier;
}

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret',
        signOptions: {
          expiresIn: parseDurationToSeconds(
            getFirstEnv(['JWT_ACCESS_TTL', 'JWT_ACCESS_EXPIRES_IN']) ?? '15m',
            15 * 60,
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, MailerService, SuperAdminGuard, UnlockRequestsService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
