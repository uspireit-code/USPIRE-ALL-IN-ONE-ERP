import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { CreateIfrsNodeDto, UpdateIfrsNodeDto } from './ifrs-nodes.dto';
import { IfrsNodesService } from './ifrs-nodes.service';

@Controller('finance/settings/ifrs-nodes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IfrsNodesController {
  constructor(private readonly ifrsNodes: IfrsNodesService) {}

  @Get()
  @Permissions(PERMISSIONS.COA.VIEW)
  async listTree(
    @Req() req: Request,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const inc = String(includeInactive ?? '').toLowerCase() === 'true';
    return this.ifrsNodes.listTree(req, { includeInactive: inc });
  }

  @Get('reference')
  @Permissions(PERMISSIONS.COA.VIEW)
  async listReference(
    @Req() req: Request,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const inc = String(includeInactive ?? '').toLowerCase() === 'true';
    return this.ifrsNodes.listFlatReference(req, { includeInactive: inc });
  }

  @Post()
  @Permissions(PERMISSIONS.FINANCE.CONFIG_CHANGE)
  async create(@Req() req: Request, @Body() dto: CreateIfrsNodeDto) {
    return this.ifrsNodes.create(req, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.FINANCE.CONFIG_CHANGE)
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateIfrsNodeDto,
  ) {
    return this.ifrsNodes.update(req, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.FINANCE.CONFIG_CHANGE)
  async deactivate(@Req() req: Request, @Param('id') id: string) {
    return this.ifrsNodes.deactivate(req, id);
  }
}
