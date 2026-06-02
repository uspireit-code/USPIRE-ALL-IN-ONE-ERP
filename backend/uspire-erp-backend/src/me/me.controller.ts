import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';

@Controller('me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get('legal-entity-access')
  @UseGuards(JwtAuthGuard)
  async legalEntityAccess(@Req() req: Request) {
    return this.authService.myLegalEntityAccess(req);
  }
}
