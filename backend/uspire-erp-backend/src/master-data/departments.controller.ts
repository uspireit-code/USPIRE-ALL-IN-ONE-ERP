import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import {
  CreateDepartmentDto,
  CreateDepartmentMemberDto,
  DepartmentIdParamDto,
  UpdateDepartmentDto,
  UpdateDepartmentMemberStatusDto,
} from './departments.dto';
import { DepartmentsService } from './departments.service';

@Controller('master-data/departments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @Permissions(PERMISSIONS.MASTER_DATA.DEPARTMENT.VIEW)
  async list(@Req() req: Request) {
    return this.departments.list(req);
  }

  @Post()
  @Permissions(PERMISSIONS.MASTER_DATA.DEPARTMENT.CREATE)
  async create(@Req() req: Request, @Body() dto: CreateDepartmentDto) {
    return this.departments.create(req, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.MASTER_DATA.DEPARTMENT.EDIT)
  async update(
    @Req() req: Request,
    @Param() params: DepartmentIdParamDto,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departments.update(req, params.id, dto);
  }

  @Get(':id/members')
  @Permissions(PERMISSIONS.MASTER_DATA.DEPARTMENT.MEMBERS_MANAGE)
  async listMembers(@Req() req: Request, @Param() params: DepartmentIdParamDto) {
    return this.departments.listMembers(req, params.id);
  }

  @Post(':id/members')
  @Permissions(PERMISSIONS.MASTER_DATA.DEPARTMENT.MEMBERS_MANAGE)
  async addMember(
    @Req() req: Request,
    @Param() params: DepartmentIdParamDto,
    @Body() dto: CreateDepartmentMemberDto,
  ) {
    return this.departments.addMember(req, params.id, dto);
  }

  @Patch(':id/members/:userId/status')
  @Permissions(PERMISSIONS.MASTER_DATA.DEPARTMENT.MEMBERS_MANAGE)
  async updateMemberStatus(
    @Req() req: Request,
    @Param('id') departmentId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateDepartmentMemberStatusDto,
  ) {
    return this.departments.updateMemberStatus(req, departmentId, userId, dto);
  }
}
