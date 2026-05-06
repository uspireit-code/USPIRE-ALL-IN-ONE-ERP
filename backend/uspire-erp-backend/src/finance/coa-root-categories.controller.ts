import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { CoaRootCategoriesService } from './coa-root-categories.service';

@Controller('finance/coa/root-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CoaRootCategoriesController {
  constructor(private readonly svc: CoaRootCategoriesService) {}

  @Get()
  @Permissions(PERMISSIONS.COA.VIEW)
  async list(@Req() req: Request) {
    return this.svc.list(req);
  }

  @Post()
  @Permissions(PERMISSIONS.COA.UNLOCK)
  async create(
    @Req() req: Request,
    @Body()
    dto: {
      code: string;
      name: string;
      accountType: any;
      ifrsMappingCode?: string | null;
      fsMappingLevel1?: string | null;
      fsMappingLevel2?: string | null;
    },
  ) {
    return this.svc.create(req, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.COA.UNLOCK)
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string;
      ifrsMappingCode?: string | null;
      fsMappingLevel1?: string | null;
      fsMappingLevel2?: string | null;
    },
  ) {
    return this.svc.update(req, id, dto);
  }

  @Post(':id/disable')
  @Permissions(PERMISSIONS.COA.UNLOCK)
  async disable(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { force?: boolean },
  ) {
    return this.svc.disable(req, id, dto);
  }

  @Post('setup-default')
  @Permissions(PERMISSIONS.COA.UNLOCK)
  async setupDefault(@Req() req: Request) {
    return this.svc.setupDefault(req);
  }
}
