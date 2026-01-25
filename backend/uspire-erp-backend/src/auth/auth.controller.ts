import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    try {
      return await this.authService.login(req, dto);
    } catch (e) {
      // TEMP DEBUG: capture why /auth/login is returning 500 in production.
      // eslint-disable-next-line no-console
      console.error('[AuthController.login] error', {
        message: (e as any)?.message,
        name: (e as any)?.name,
        status: (e as any)?.status,
        response: (e as any)?.response,
        request: {
          method: req.method,
          url: req.originalUrl,
          origin: req.header('origin') ?? null,
          hasTenantHeader: Boolean(req.header('x-tenant-id')),
        },
        body: {
          email: (dto as any)?.email,
          tenantId: (dto as any)?.tenantId ?? null,
          tenantName: (dto as any)?.tenantName ?? null,
          password: '[redacted]',
        },
      });
      throw e;
    }
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Body() dto: RefreshTokenDto) {
    return this.authService.refresh(req, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    return this.authService.me(req);
  }
}
