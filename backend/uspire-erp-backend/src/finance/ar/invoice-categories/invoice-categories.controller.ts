import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../rbac/jwt-auth.guard';
import { Permissions } from '../../../rbac/permissions.decorator';
import { PermissionsGuard } from '../../../rbac/permissions.guard';
import {
  CreateInvoiceCategoryDto,
  UpdateInvoiceCategoryDto,
} from './invoice-categories.dto';
import { InvoiceCategoryService } from './invoice-category.service';

@Controller('finance/ar/invoice-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvoiceCategoriesController {
  constructor(private readonly categories: InvoiceCategoryService) {}

  @Get()
  @Permissions('INVOICE_CATEGORY_VIEW')
  async list(@Req() req: Request) {
    return this.categories.list(req);
  }

  @Get(':id')
  @Permissions('INVOICE_CATEGORY_VIEW')
  async getById(@Req() req: Request, @Param('id') id: string) {
    return this.categories.getById(req, id);
  }

  @Post()
  @Permissions('INVOICE_CATEGORY_CREATE')
  async create(@Req() req: Request, @Body() dto: CreateInvoiceCategoryDto) {
    return this.categories.create(req, dto);
  }

  @Put(':id')
  @Permissions('INVOICE_CATEGORY_UPDATE')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceCategoryDto,
  ) {
    return this.categories.update(req, id, dto);
  }

  @Put(':id/active')
  @Permissions('INVOICE_CATEGORY_DISABLE')
  async setActive(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.categories.setActive(req, id, body?.isActive);
  }
}
