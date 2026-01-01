import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsAny } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { CapitalizeFixedAssetDto } from './dto/capitalize-fa-asset.dto';
import { CreateFixedAssetDto } from './dto/create-fa-asset.dto';
import { CreateFixedAssetCategoryDto } from './dto/create-fa-category.dto';
import { DisposeFixedAssetDto } from './dto/dispose-fa-asset.dto';
import { FaService } from './fa.service';

@Controller('fa')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FaController {
  constructor(private readonly fa: FaService) {}

  @Get('categories')
  @Permissions('FA_CATEGORY_MANAGE')
  async listCategories(@Req() req: Request) {
    return this.fa.listCategories(req);
  }

  @Post('categories')
  @Permissions('FA_CATEGORY_MANAGE')
  async createCategory(
    @Req() req: Request,
    @Body() dto: CreateFixedAssetCategoryDto,
  ) {
    return this.fa.createCategory(req, dto);
  }

  @Get('assets')
  @PermissionsAny(
    'FA_ASSET_CREATE',
    'FA_ASSET_CAPITALIZE',
    'FA_DEPRECIATION_RUN',
    'FA_DISPOSE',
  )
  async listAssets(@Req() req: Request) {
    return this.fa.listAssets(req);
  }

  @Post('assets')
  @Permissions('FA_ASSET_CREATE')
  async createAsset(@Req() req: Request, @Body() dto: CreateFixedAssetDto) {
    return this.fa.createAsset(req, dto);
  }

  @Post('assets/:id/capitalize')
  @Permissions('FA_ASSET_CAPITALIZE', 'FINANCE_GL_POST')
  async capitalizeAsset(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CapitalizeFixedAssetDto,
  ) {
    return this.fa.capitalizeAsset(req, id, dto);
  }

  @Post('depreciation/run')
  @Permissions('FA_DEPRECIATION_RUN', 'FINANCE_GL_POST')
  async runDepreciation(
    @Req() req: Request,
    @Query('periodId') periodId: string,
  ) {
    return this.fa.runDepreciationForPeriod(req, periodId);
  }

  @Get('depreciation/runs')
  @Permissions('FA_DEPRECIATION_RUN')
  async listDepreciationRuns(@Req() req: Request) {
    return this.fa.listDepreciationRuns(req);
  }

  @Post('assets/:id/dispose')
  @Permissions('FA_DISPOSE', 'FINANCE_GL_POST')
  async disposeAsset(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: DisposeFixedAssetDto,
  ) {
    return this.fa.disposeAsset(req, id, dto);
  }
}
