import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  Post,
  Param,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { Permissions, PermissionsAny } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { SettingsService } from './settings.service';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { UpdateApControlAccountDto } from './dto/update-ap-control-account.dto';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { ValidateUserRolesDto } from './dto/validate-user-roles.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('organisation')
  @PermissionsAny(PERMISSIONS.SYSTEM.CONFIG_VIEW, PERMISSIONS.SYSTEM.VIEW_ALL)
  async getOrganisation(@Req() req: Request) {
    return this.settings.getOrganisation(req);
  }

  @Put('organisation')
  @Permissions(PERMISSIONS.SYSTEM.CONFIG_UPDATE)
  async updateOrganisation(
    @Req() req: Request,
    @Body() dto: UpdateOrganisationDto,
  ) {
    return this.settings.updateOrganisation(req, dto);
  }

  @Post('organisation/logo')
  @Permissions(PERMISSIONS.SYSTEM.CONFIG_UPDATE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadLogo(@Req() req: Request, @UploadedFile() file: any) {
    return this.settings.uploadOrganisationLogo(req, file);
  }

  @Get('organisation/logo')
  @PermissionsAny(PERMISSIONS.SYSTEM.CONFIG_VIEW, PERMISSIONS.SYSTEM.VIEW_ALL)
  async downloadLogo(@Req() req: Request, @Res() res: Response) {
    const out = await this.settings.downloadOrganisationLogo(req);
    res.setHeader('Content-Type', out.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${out.fileName}"`);
    res.send(out.body);
  }

  @Get('system')
  @PermissionsAny(
    PERMISSIONS.SYSTEM.CONFIG_VIEW,
    PERMISSIONS.FINANCE.CONFIG_VIEW,
    PERMISSIONS.SYSTEM.SYS_SETTINGS_VIEW,
    PERMISSIONS.SYSTEM.VIEW_ALL,
  )
  async getSystemConfig(@Req() req: Request) {
    return this.settings.getSystemConfig(req);
  }

  @Put('system')
  @PermissionsAny(
    PERMISSIONS.SYSTEM.CONFIG_UPDATE,
    PERMISSIONS.FINANCE.CONFIG_UPDATE,
    PERMISSIONS.FINANCE.CONFIG_CHANGE,
    PERMISSIONS.SYSTEM.VIEW_ALL,
  )
  async updateSystemConfig(
    @Req() req: Request,
    @Body() dto: UpdateSystemConfigDto,
  ) {
    return this.settings.updateSystemConfig(req, dto);
  }

  @Get('finance/ap-control-account')
  @PermissionsAny(
    PERMISSIONS.FINANCE.CONFIG_UPDATE,
    PERMISSIONS.SYSTEM.CONFIG_UPDATE,
    PERMISSIONS.SYSTEM.VIEW_ALL,
  )
  async getFinanceApControlAccount(@Req() req: Request) {
    return this.settings.getFinanceApControlAccount(req);
  }

  @Put('finance/ap-control-account')
  @PermissionsAny(
    PERMISSIONS.FINANCE.CONFIG_UPDATE,
    PERMISSIONS.SYSTEM.CONFIG_UPDATE,
    PERMISSIONS.SYSTEM.VIEW_ALL,
  )
  async updateFinanceApControlAccount(
    @Req() req: Request,
    @Body() dto: UpdateApControlAccountDto,
  ) {
    return this.settings.updateFinanceApControlAccount(req, dto);
  }

  @Post('system/favicon')
  @Permissions(PERMISSIONS.SYSTEM.CONFIG_UPDATE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadFavicon(@Req() req: Request, @UploadedFile() file: any) {
    return this.settings.uploadTenantFavicon(req, file);
  }

  @Get('system/favicon')
  @PermissionsAny(PERMISSIONS.SYSTEM.CONFIG_VIEW, PERMISSIONS.SYSTEM.VIEW_ALL)
  async downloadFavicon(@Req() req: Request, @Res() res: Response) {
    const out = await this.settings.downloadTenantFavicon(req);
    res.setHeader('Content-Type', out.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${out.fileName}"`);
    res.send(out.body);
  }

  @Get('users')
  @Permissions(PERMISSIONS.USER.VIEW)
  async listUsers(@Req() req: Request) {
    return this.settings.listUsers(req);
  }

  @Get('users/roles')
  @Permissions(PERMISSIONS.ROLE.VIEW)
  async listRoles(@Req() req: Request) {
    return this.settings.listRoles(req);
  }

  @Post('users/roles/validate')
  @Permissions(PERMISSIONS.ROLE.VIEW)
  async validateRoles(@Req() req: Request, @Body() dto: ValidateUserRolesDto) {
    return this.settings.validateRoles(req, dto);
  }

  @Post('users')
  @Permissions(PERMISSIONS.USER.CREATE)
  async createUser(@Req() req: Request, @Body() dto: CreateUserDto) {
    return this.settings.createUser(req, dto);
  }

  @Patch('users/:id/status')
  @Permissions(PERMISSIONS.USER.EDIT)
  async updateUserStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.settings.updateUserStatus(req, id, dto);
  }

  @Patch('users/:id/roles')
  @Permissions(PERMISSIONS.ROLE.ASSIGN)
  async updateUserRoles(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateUserRolesDto,
  ) {
    return this.settings.updateUserRoles(req, id, dto);
  }

  @Get('roles')
  @Permissions(PERMISSIONS.ROLE.VIEW)
  async listRolesWithPermissions(@Req() req: Request) {
    return this.settings.listRolesWithPermissions(req);
  }

  @Get('roles/:id')
  @Permissions(PERMISSIONS.ROLE.VIEW)
  async getRoleDetails(@Req() req: Request, @Param('id') id: string) {
    return this.settings.getRoleDetails(req, id);
  }
}
