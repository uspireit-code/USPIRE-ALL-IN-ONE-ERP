import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BrandingService } from './branding.service';

@Controller('public/branding')
export class PublicBrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Get('login')
  async getLoginBranding(@Req() req: Request) {
    return this.branding.getLoginBranding(req, { allowDefaultTenant: true });
  }
}
