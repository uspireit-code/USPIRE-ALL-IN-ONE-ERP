import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { CreateProjectDto, ProjectIdParamDto, UpdateProjectDto } from './projects.dto';
import { ProjectsService } from './projects.service';

@Controller('master-data/projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @Permissions('MASTER_DATA_PROJECT_VIEW')
  async list(@Req() req: Request) {
    return this.projects.list(req);
  }

  @Post()
  @Permissions('MASTER_DATA_PROJECT_CREATE')
  async create(@Req() req: Request, @Body() dto: CreateProjectDto) {
    return this.projects.create(req, dto);
  }

  @Patch(':id')
  @Permissions('MASTER_DATA_PROJECT_EDIT')
  async update(
    @Req() req: Request,
    @Param() params: ProjectIdParamDto,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(req, params.id, dto);
  }

  @Post(':id/close')
  @Permissions('MASTER_DATA_PROJECT_CLOSE')
  async close(@Req() req: Request, @Param() params: ProjectIdParamDto) {
    return this.projects.close(req, params.id);
  }
}
