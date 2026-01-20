import { Body, Controller, Delete, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { ImprestService } from './imprest.service';
import { UpdateImprestSettlementLineDto } from './dto/imprest-case.dto';

@Controller('imprest/settlement-lines')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ImprestSettlementLinesController {
  constructor(private readonly imprest: ImprestService) {}

  @Patch(':id')
  @Permissions(PERMISSIONS.IMPREST.CASE_SETTLEMENT_EDIT)
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateImprestSettlementLineDto) {
    return this.imprest.updateSettlementLine(req, id, dto);
  }

  @Delete(':id')
  @Permissions(PERMISSIONS.IMPREST.CASE_SETTLEMENT_EDIT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.imprest.deleteSettlementLine(req, id);
  }
}
