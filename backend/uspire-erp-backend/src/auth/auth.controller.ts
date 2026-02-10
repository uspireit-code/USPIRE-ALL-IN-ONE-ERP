import {
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { AuthService } from './auth.service';
import { SuperAdminGuard } from './super-admin.guard';
import { UnlockRequestsService } from './unlock-requests.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AdminUnlockUserDto } from './dto/admin-unlock-user.dto';
import { RequestUnlockDto } from './dto/request-unlock.dto';
import { ResolveUnlockRequestDto } from './dto/resolve-unlock-request.dto';
import { UnlockUserFromRequestDto } from './dto/unlock-user-from-request.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { ForceChangePasswordDto } from './dto/force-change-password.dto';
import { ActivateDelegationDto } from './dto/activate-delegation.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly unlockRequests: UnlockRequestsService,
  ) {}

  private getCookieOptions() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
    };
  }

  private setAuthCookies(res: Response, params: { accessToken: string; refreshToken: string; accessMaxAgeMs: number; refreshMaxAgeMs: number }) {
    const base = this.getCookieOptions();
    res.cookie('uspire_access_token', params.accessToken, {
      ...base,
      maxAge: params.accessMaxAgeMs,
    });
    res.cookie('uspire_refresh_token', params.refreshToken, {
      ...base,
      maxAge: params.refreshMaxAgeMs,
    });
  }

  private clearAuthCookies(res: Response) {
    const base = this.getCookieOptions();
    res.clearCookie('uspire_access_token', base);
    res.clearCookie('uspire_refresh_token', base);
  }

  @Post('login')
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: LoginDto) {
    try {
      const out: any = await this.authService.login(req, dto);

      if (out?.requiresTenant || out?.requires2fa || out?.requiresPasswordReset)
        return out;

      if (out?.accessToken && out?.refreshToken) {
        this.setAuthCookies(res, {
          accessToken: out.accessToken,
          refreshToken: out.refreshToken,
          accessMaxAgeMs: out.accessMaxAgeMs,
          refreshMaxAgeMs: out.refreshMaxAgeMs,
        });
      }

      return {
        success: true,
        availableDelegations: Array.isArray(out?.availableDelegations)
          ? out.availableDelegations
          : [],
      };
    } catch (e) {
      if (e instanceof HttpException) {
        const status = e.getStatus();
        const payload: any = e.getResponse();

        if (status === 401) {
          res.status(401);
          if (payload && typeof payload === 'object' && payload.success === false && typeof payload.error === 'string') {
            return payload;
          }
          return {
            success: false,
            error: 'INVALID_CREDENTIALS',
            message: 'Invalid credentials',
          };
        }

        if (status === 400) {
          res.status(400);
          return {
            success: false,
            error: 'LOGIN_FAILED',
            message: 'Login failed',
          };
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[AuthController.login] error', {
          message: (e as any)?.message,
          name: (e as any)?.name,
          status: (e as any)?.status,
        });
      }
      throw e;
    }
  }

  @Post('activate-delegation')
  @UseGuards(JwtAuthGuard)
  async activateDelegation(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: ActivateDelegationDto,
  ) {
    const out: any = await this.authService.activateDelegation({
      req,
      delegationId: dto.delegationId,
    });

    if (out?.accessToken && out?.refreshToken) {
      this.setAuthCookies(res, {
        accessToken: out.accessToken,
        refreshToken: out.refreshToken,
        accessMaxAgeMs: out.accessMaxAgeMs,
        refreshMaxAgeMs: out.refreshMaxAgeMs,
      });
    }

    return { success: true, delegation: out?.delegation ?? null };
  }

  @Post('admin/unlock-user')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async adminUnlockUser(@Req() req: Request, @Body() dto: AdminUnlockUserDto) {
    const out = await this.authService.adminUnlockUser({
      tenantId: req.tenant?.id ?? '',
      userId: dto.userId,
    });

    return out;
  }

  @Get('admin/unlock-requests')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async listUnlockRequests(@Req() req: Request) {
    return this.unlockRequests.listUnlockRequests(req);
  }

  @Post('admin/resolve-unlock-request')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async resolveUnlockRequest(@Req() req: Request, @Body() dto: ResolveUnlockRequestDto) {
    return this.unlockRequests.resolveUnlockRequest(req, dto.unlockRequestId);
  }

  @Post('admin/unlock-user-from-request')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async unlockUserFromRequest(@Req() req: Request, @Body() dto: UnlockUserFromRequestDto) {
    return this.unlockRequests.unlockUserFromRequest(req, dto.unlockRequestId);
  }

  @Post('request-unlock')
  async requestUnlock(@Body() dto: RequestUnlockDto, @Req() req: Request) {
    return this.authService.requestUnlock(dto, req);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    await this.authService.requestPasswordReset(dto, req);
    return {
      success: true,
      message:
        'If this account exists, password reset instructions have been sent.',
    };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.authService.resetPassword(dto, req);
  }

  @Post('force-change-password')
  async forceChangePassword(@Body() dto: ForceChangePasswordDto, @Req() req: Request) {
    try {
      return await this.authService.forceChangePassword(dto, req);
    } catch (err) {
      if (err instanceof HttpException) {
        const status = err.getStatus();
        const res: any = err.getResponse();
        const rawMessage =
          typeof res === 'string'
            ? res
            : typeof res?.message === 'string'
              ? res.message
              : Array.isArray(res?.message)
                ? res.message.join('; ')
                : typeof (err as any)?.message === 'string'
                  ? (err as any).message
                  : '';

        const msg = String(rawMessage ?? '').trim();
        const safeKnownMessages = new Set([
          'Email is required',
          'New password is required',
          'Passwords do not match',
          'Tenant resolution required',
          'Invalid user',
          'Password reset is not required',
        ]);

        if (safeKnownMessages.has(msg)) {
          throw new HttpException({ success: false, message: msg }, status);
        }

        if (typeof msg === 'string' && msg.toLowerCase().includes('password')) {
          throw new HttpException({ success: false, message: msg }, status);
        }

        throw new HttpException(
          {
            success: false,
            message:
              'Password update could not be completed. Please contact your System Administrator.',
          },
          status,
        );
      }

      throw new InternalServerErrorException({
        success: false,
        message:
          'Password update could not be completed. Please contact your System Administrator.',
      });
    }
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: RefreshTokenDto) {
    const out: any = await this.authService.refresh(req, dto);
    this.setAuthCookies(res, {
      accessToken: out.accessToken,
      refreshToken: out.refreshToken,
      accessMaxAgeMs: out.accessMaxAgeMs,
      refreshMaxAgeMs: out.refreshMaxAgeMs,
    });
    return { success: true };
  }

  @Post('2fa/verify')
  async verify2fa(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() dto: Verify2faDto) {
    const out: any = await this.authService.verify2fa(req, dto);
    this.setAuthCookies(res, {
      accessToken: out.accessToken,
      refreshToken: out.refreshToken,
      accessMaxAgeMs: out.accessMaxAgeMs,
      refreshMaxAgeMs: out.refreshMaxAgeMs,
    });
    return {
      success: true,
      availableDelegations: Array.isArray(out?.availableDelegations) ? out.availableDelegations : [],
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionUser: any = req.user as any;
    const tenantId = String((req.tenant as any)?.id ?? sessionUser?.tenantId ?? '').trim();
    const userId = String(sessionUser?.id ?? '').trim();
    const sessionId = String(sessionUser?.sessionId ?? '').trim();

    const requestId = (req.header('x-request-id') ? String(req.header('x-request-id')) : '').trim();
    await this.authService.revokeSessionBySessionId({
      tenantId,
      userId,
      sessionId,
      req,
      requestId: requestId || undefined,
      reason: 'user_logout',
    });

    this.clearAuthCookies(res);
    return { success: true };
  }

  @Post('ping')
  @UseGuards(JwtAuthGuard)
  async ping(@Req() req: Request) {
    await this.authService.ping(req);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    return this.authService.me(req);
  }
}
