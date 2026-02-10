import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { ListDelegationsQueryDto } from './dto/list-delegations-query.dto';
import { DelegationsService } from './delegations.service';

@Controller('admin/delegations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DelegationsController {
  constructor(private readonly delegations: DelegationsService) {}

  @Post()
  @Permissions(PERMISSIONS.SECURITY.DELEGATION_MANAGE)
  async create(@Req() req: Request, @Body() dto: CreateDelegationDto) {
    return this.delegations.createDelegation({ req, dto });
  }

  @Get()
  @Permissions(PERMISSIONS.SECURITY.DELEGATION_MANAGE)
  async list(@Req() req: Request, @Query() query: ListDelegationsQueryDto) {
    return this.delegations.listDelegations({ req, query });
  }

  @Post(':id/revoke')
  @Permissions(PERMISSIONS.SECURITY.DELEGATION_MANAGE)
  async revoke(@Req() req: Request, @Param('id') id: string) {
    const res = await this.delegations.revokeDelegation({ req, id });
    if (!res) {
      throw new NotFoundException('Delegation not found');
    }
    return res;
  }
}
