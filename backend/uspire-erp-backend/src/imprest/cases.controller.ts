import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { ImprestService } from './imprest.service';
import {
  ApproveImprestCaseDto,
  CreateImprestCaseDto,
  IssueImprestCaseDto,
  LinkImprestEvidenceDto,
  RejectImprestCaseDto,
  ReviewImprestCaseDto,
  SubmitImprestCaseDto,
} from './dto/imprest-case.dto';

@Controller('imprest/cases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ImprestCasesController {
  constructor(private readonly imprest: ImprestService) {}

  @Get()
  @Permissions(PERMISSIONS.IMPREST.CASE_VIEW)
  async list(@Req() req: Request) {
    return this.imprest.listCases(req);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.IMPREST.CASE_VIEW)
  async get(@Req() req: Request, @Param('id') id: string) {
    return this.imprest.getCase(req, id);
  }

  @Post()
  @Permissions(PERMISSIONS.IMPREST.CASE_CREATE)
  async create(@Req() req: Request, @Body() dto: CreateImprestCaseDto) {
    return this.imprest.createCase(req, dto);
  }

  @Post(':id/submit')
  @Permissions(PERMISSIONS.IMPREST.CASE_SUBMIT)
  async submit(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SubmitImprestCaseDto,
  ) {
    return this.imprest.submitCase(req, id, dto);
  }

  @Post(':id/review')
  @Permissions(PERMISSIONS.IMPREST.CASE_REVIEW)
  async review(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ReviewImprestCaseDto,
  ) {
    return this.imprest.reviewCase(req, id, dto);
  }

  @Post(':id/approve')
  @Permissions(PERMISSIONS.IMPREST.CASE_APPROVE)
  async approve(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ApproveImprestCaseDto,
  ) {
    return this.imprest.approveCase(req, id, dto);
  }

  @Post(':id/reject')
  @Permissions(PERMISSIONS.IMPREST.CASE_REJECT)
  async reject(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: RejectImprestCaseDto,
  ) {
    return this.imprest.rejectCase(req, id, dto);
  }

  @Post(':id/evidence')
  @Permissions(PERMISSIONS.IMPREST.CASE_VIEW)
  async linkEvidence(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: LinkImprestEvidenceDto,
  ) {
    return this.imprest.linkEvidence(req, id, dto);
  }

  @Post(':id/issue')
  @Permissions(PERMISSIONS.IMPREST.CASE_ISSUE)
  async issue(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: IssueImprestCaseDto,
  ) {
    return this.imprest.issueCase(req, id, dto);
  }
}
