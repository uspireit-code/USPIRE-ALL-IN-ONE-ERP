import {
  Body,
  Controller,
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
import { PERMISSIONS } from '../rbac/permission-catalog';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import type {
  CreateCoaStructureChangeRequestDraftDto,
  RejectCoaStructureChangeRequestDto,
  SubmitCoaStructureChangeRequestDto,
  UpdateCoaStructureChangeRequestDraftDto,
} from './coa-structure-change-requests.dto';
import { CoaStructureChangeRequestsService } from './coa-structure-change-requests.service';

@Controller('finance/coa/structure-change-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CoaStructureChangeRequestsController {
  constructor(private readonly service: CoaStructureChangeRequestsService) {}

  @Get()
  @Permissions(PERMISSIONS.COA.VIEW)
  async list(@Req() req: Request, @Query('status') status?: string) {
    return this.service.list(req, { status });
  }

  @Get(':id')
  @Permissions(PERMISSIONS.COA.VIEW)
  async getById(@Req() req: Request, @Param('id') id: string) {
    return this.service.getById(req, id);
  }

  @Post()
  @Permissions(PERMISSIONS.COA.DRAFT_CREATE)
  async createDraft(@Req() req: Request, @Body() dto: CreateCoaStructureChangeRequestDraftDto) {
    return this.service.createDraft(req, dto);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.COA.DRAFT_EDIT)
  async updateDraft(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCoaStructureChangeRequestDraftDto,
  ) {
    return this.service.updateDraft(req, id, dto);
  }

  @Post(':id/submit')
  @Permissions(PERMISSIONS.COA.DRAFT_SUBMIT)
  async submit(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SubmitCoaStructureChangeRequestDto,
  ) {
    return this.service.submit(req, id, dto);
  }

  @Post(':id/approve')
  @Permissions(PERMISSIONS.COA.APPROVE)
  async approve(@Req() req: Request, @Param('id') id: string, @Body() dto: { comment?: string }) {
    return this.service.approve(req, id, dto);
  }

  @Post(':id/reject')
  @Permissions(PERMISSIONS.COA.REJECT)
  async reject(@Req() req: Request, @Param('id') id: string, @Body() dto: RejectCoaStructureChangeRequestDto) {
    return this.service.reject(req, id, dto);
  }

  @Post(':id/implement')
  @Permissions(PERMISSIONS.COA.APPROVE)
  async implement(@Req() req: Request, @Param('id') id: string) {
    return this.service.implement(req, id);
  }
}
