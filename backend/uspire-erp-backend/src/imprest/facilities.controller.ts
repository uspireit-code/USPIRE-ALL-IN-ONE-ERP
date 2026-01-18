import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { ImprestService } from './imprest.service';
import { CreateImprestFacilityDto, UpdateImprestFacilityDto } from './dto/imprest-facility.dto';

@Controller('imprest/facilities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ImprestFacilitiesController {
  constructor(private readonly imprest: ImprestService) {}

  @Get()
  @Permissions(PERMISSIONS.IMPREST.FACILITY_VIEW)
  async list(@Req() req: Request) {
    return this.imprest.listFacilities(req);
  }

  @Post()
  @Permissions(PERMISSIONS.IMPREST.FACILITY_CREATE)
  async create(@Req() req: Request, @Body() dto: CreateImprestFacilityDto) {
    return this.imprest.createFacility(req, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.IMPREST.FACILITY_EDIT)
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateImprestFacilityDto,
  ) {
    return this.imprest.updateFacility(req, id, dto);
  }
}
