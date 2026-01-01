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
    return this.authService.login(req, dto);
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
