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
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { CreateForecastDto } from './dto/create-forecast.dto';
import { UpdateForecastLinesDto } from './dto/update-forecast-lines.dto';
import { ForecastsService } from './forecasts.service';

@Controller('forecasts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ForecastsController {
  constructor(private readonly forecasts: ForecastsService) {}

  @Post()
  @Permissions('forecast.create')
  async createForecast(@Req() req: Request, @Body() dto: CreateForecastDto) {
    return this.forecasts.createForecast(req, dto);
  }

  @Get()
  @Permissions('forecast.view')
  async listForecasts(
    @Req() req: Request,
    @Query('fiscalYear') fiscalYear?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const fy = fiscalYear ? Number(fiscalYear) : undefined;
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    const parsedOffset = offset === undefined ? undefined : Number(offset);

    return this.forecasts.listForecasts(req, {
      fiscalYear: fy && !Number.isNaN(fy) ? fy : undefined,
      limit:
        parsedLimit !== undefined && Number.isFinite(parsedLimit)
          ? parsedLimit
          : undefined,
      offset:
        parsedOffset !== undefined && Number.isFinite(parsedOffset)
          ? parsedOffset
          : undefined,
    });
  }

  @Get(':id')
  @Permissions('forecast.view')
  async getForecast(@Req() req: Request, @Param('id') id: string) {
    return this.forecasts.getForecast(req, id);
  }

  @Get(':id/actuals')
  @Permissions('forecast.view')
  async getForecastActuals(@Req() req: Request, @Param('id') id: string) {
    return this.forecasts.getForecastActuals(req, id);
  }

  @Get(':id/variance')
  @Permissions('forecast.view')
  async getForecastVariance(@Req() req: Request, @Param('id') id: string) {
    return this.forecasts.getForecastVariance(req, id);
  }

  @Post(':id/submit')
  @Permissions('forecast.submit')
  async submitForecast(@Req() req: Request, @Param('id') id: string) {
    return this.forecasts.submitForecast(req, id);
  }

  @Post(':id/approve')
  @Permissions('forecast.approve')
  async approveForecast(@Req() req: Request, @Param('id') id: string) {
    return this.forecasts.approveForecast(req, id);
  }

  @Patch(':id/lines')
  @Permissions('forecast.edit')
  async updateForecastLines(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateForecastLinesDto,
  ) {
    return this.forecasts.updateForecastLines(req, id, dto);
  }
}
