import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../../rbac/jwt-auth.guard';
import { Permissions } from '../../../rbac/permissions.decorator';
import { PermissionsGuard } from '../../../rbac/permissions.guard';
import { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from './customers.dto';
import { FinanceArCustomersService } from './customers.service';

@Controller('finance/ar/customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceArCustomersController {
  constructor(private readonly customers: FinanceArCustomersService) {}

  @Get()
  @Permissions('CUSTOMERS_VIEW')
  async list(@Req() req: Request, @Query() q: ListCustomersQueryDto) {
    return this.customers.list(req, q);
  }

  @Post()
  @Permissions('CUSTOMERS_CREATE')
  async create(@Req() req: Request, @Body() dto: CreateCustomerDto) {
    return this.customers.create(req, dto);
  }

  @Put(':id')
  @Permissions('CUSTOMERS_EDIT')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(req, id, dto);
  }

  @Post('import')
  @Permissions('CUSTOMERS_IMPORT')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async import(@Req() req: Request, @UploadedFile() file: any) {
    return this.customers.import(req, file);
  }
}
