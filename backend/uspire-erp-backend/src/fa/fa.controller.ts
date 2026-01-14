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
import { PERMISSIONS } from '../rbac/permission-catalog';
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
  @Permissions(PERMISSIONS.FA.CATEGORY_MANAGE)
  async listCategories(@Req() req: Request) {
    return this.fa.listCategories(req);
  }

  @Post('categories')
  @Permissions(PERMISSIONS.FA.CATEGORY_MANAGE)
  async createCategory(
    @Req() req: Request,
    @Body() dto: CreateFixedAssetCategoryDto,
  ) {
    return this.fa.createCategory(req, dto);
  }

  @Get('assets')
  @PermissionsAny(
    PERMISSIONS.FA.ASSET_CREATE,
    PERMISSIONS.FA.ASSET_CAPITALIZE,
    PERMISSIONS.FA.DEPRECIATION_RUN,
    PERMISSIONS.FA.DISPOSE,
  )
  async listAssets(@Req() req: Request) {
    return this.fa.listAssets(req);
  }

  @Post('assets')
  @Permissions(PERMISSIONS.FA.ASSET_CREATE)
  async createAsset(@Req() req: Request, @Body() dto: CreateFixedAssetDto) {
    return this.fa.createAsset(req, dto);
  }

  @Post('assets/:id/capitalize')
  @Permissions(PERMISSIONS.FA.ASSET_CAPITALIZE, PERMISSIONS.GL.POST)
  async capitalizeAsset(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CapitalizeFixedAssetDto,
  ) {
    return this.fa.capitalizeAsset(req, id, dto);
  }

  @Post('depreciation/run')
  @Permissions(PERMISSIONS.FA.DEPRECIATION_RUN, PERMISSIONS.GL.POST)
  async runDepreciation(
    @Req() req: Request,
    @Query('periodId') periodId: string,
  ) {
    return this.fa.runDepreciationForPeriod(req, periodId);
  }

  @Get('depreciation/runs')
  @Permissions(PERMISSIONS.FA.DEPRECIATION_RUN)
  async listDepreciationRuns(@Req() req: Request) {
    return this.fa.listDepreciationRuns(req);
  }

  @Post('assets/:id/dispose')
  @Permissions(PERMISSIONS.FA.DISPOSE, PERMISSIONS.GL.POST)
  async disposeAsset(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: DisposeFixedAssetDto,
  ) {
    return this.fa.disposeAsset(req, id, dto);
  }
}
