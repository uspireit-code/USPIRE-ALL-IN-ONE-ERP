import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { ImprestService } from './imprest.service';
import { CreateImprestTypePolicyDto, UpdateImprestTypePolicyDto } from './dto/imprest-type-policy.dto';

@Controller('imprest/type-policies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ImprestTypePoliciesController {
  constructor(private readonly imprest: ImprestService) {}

  @Get()
  @Permissions(PERMISSIONS.IMPREST.TYPE_POLICY_VIEW)
  async list(@Req() req: Request) {
    return this.imprest.listTypePolicies(req);
  }

  @Post()
  @Permissions(PERMISSIONS.IMPREST.TYPE_POLICY_CREATE)
  async create(@Req() req: Request, @Body() dto: CreateImprestTypePolicyDto) {
    return this.imprest.createTypePolicy(req, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.IMPREST.TYPE_POLICY_EDIT)
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateImprestTypePolicyDto,
  ) {
    return this.imprest.updateTypePolicy(req, id, dto);
  }
}
