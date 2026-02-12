import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BrandingService } from './branding.service';

@Controller('branding')
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  @Get('current')
  async getCurrent(@Req() req: Request) {
    return this.branding.getCurrent(req);
  }

  @Get('login')
  async getLoginBranding(@Req() req: Request) {
    return this.branding.getLoginBranding(req);
  }

  @Get('logo')
  async getLogo(@Req() req: Request, @Res() res: Response) {
    const out = await this.branding.getLogo(req);
    res.setHeader('Content-Type', out.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${out.fileName}"`);
    res.send(out.body);
  }
}
