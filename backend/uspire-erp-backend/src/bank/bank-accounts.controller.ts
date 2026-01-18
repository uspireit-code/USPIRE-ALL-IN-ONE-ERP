import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { BankService } from './bank.service';
import { CreateBankAccountFoundationDto, UpdateBankAccountFoundationDto } from './dto/bank-accounts.dto';

@Controller('bank-accounts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BankAccountsController {
  constructor(private readonly bank: BankService) {}

  @Get()
  @Permissions(PERMISSIONS.BANK.ACCOUNT_VIEW)
  async list(@Req() req: Request) {
    return this.bank.listBankAccountsFoundation(req);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.BANK.ACCOUNT_VIEW)
  async getById(@Req() req: Request, @Param('id') id: string) {
    return this.bank.getBankAccountFoundationById(req, id);
  }

  @Post()
  @Permissions(PERMISSIONS.BANK.ACCOUNT_CREATE)
  async create(@Req() req: Request, @Body() dto: CreateBankAccountFoundationDto) {
    return this.bank.createBankAccountFoundation(req, dto);
  }

  @Put(':id')
  @Permissions(PERMISSIONS.BANK.ACCOUNT_EDIT)
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateBankAccountFoundationDto) {
    return this.bank.updateBankAccountFoundation(req, id, dto);
  }

  @Post(':id/deactivate')
  @Permissions(PERMISSIONS.BANK.ACCOUNT_DEACTIVATE)
  async deactivate(@Req() req: Request, @Param('id') id: string) {
    return this.bank.deactivateBankAccountFoundation(req, id);
  }
}
