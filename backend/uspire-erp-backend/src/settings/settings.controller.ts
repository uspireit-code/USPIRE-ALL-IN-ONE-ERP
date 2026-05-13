import {
  Body,
  Controller,
  ForbiddenException,
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
import { UpdateSystemGovernanceDto } from './dto/update-system-governance.dto';
import { UpdateFinancialGovernanceDto } from './dto/update-financial-governance.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { ValidateUserRolesDto } from './dto/validate-user-roles.dto';
import { UpdateLoginBrandingDto } from './dto/update-login-branding.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('organisation')
  @PermissionsAny(PERMISSIONS.GOVERNANCE.SYSTEM.VIEW, PERMISSIONS.SYSTEM.CONFIG_VIEW)
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

  @Patch('organisation/branding/login')
  @Permissions(PERMISSIONS.SYSTEM.CONFIG_UPDATE)
  async updateLoginBranding(@Req() req: Request, @Body() dto: UpdateLoginBrandingDto) {
    return this.settings.updateLoginBranding(req, dto);
  }

  @Post('organisation/branding/login-background')
  @Permissions(PERMISSIONS.SYSTEM.CONFIG_UPDATE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async uploadLoginBackground(@Req() req: Request, @UploadedFile() file: any) {
    return this.settings.uploadLoginBackground(req, file);
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
  @PermissionsAny(PERMISSIONS.GOVERNANCE.SYSTEM.VIEW, PERMISSIONS.SYSTEM.CONFIG_VIEW)
  async downloadLogo(@Req() req: Request, @Res() res: Response) {
    const out = await this.settings.downloadOrganisationLogo(req);
    res.setHeader('Content-Type', out.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${out.fileName}"`);
    res.send(out.body);
  }

  @Get('system')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.SYSTEM.VIEW,
    PERMISSIONS.SYSTEM.CONFIG_VIEW,
    PERMISSIONS.FINANCE.CONFIG_VIEW,
    PERMISSIONS.SYSTEM.SYS_SETTINGS_VIEW,
  )
  async getSystemConfig(@Req() req: Request) {
    return this.settings.getSystemConfig(req);
  }

  @Get('governance/system')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.SYSTEM.VIEW,
    PERMISSIONS.SYSTEM.CONFIG_VIEW,
    PERMISSIONS.SYSTEM.SYS_SETTINGS_VIEW,
  )
  async getSystemGovernance(@Req() req: Request) {
    return this.settings.getSystemGovernance(req);
  }

  @Put('governance/system')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.SYSTEM.MANAGE,
    PERMISSIONS.SYSTEM.CONFIG_UPDATE,
  )
  async updateSystemGovernance(
    @Req() req: Request,
    @Body() dto: UpdateSystemGovernanceDto,
  ) {
    return this.settings.updateSystemGovernance(req, dto);
  }

  @Get('governance/financial')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.FINANCIAL.VIEW,
    PERMISSIONS.FINANCE.CONFIG_VIEW,
    PERMISSIONS.FINANCE.VIEW_ALL,
  )
  async getFinancialGovernance(@Req() req: Request) {
    return this.settings.getFinancialGovernance(req);
  }

  @Put('governance/financial')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.FINANCIAL.MANAGE,
    PERMISSIONS.FINANCE.CONFIG_UPDATE,
    PERMISSIONS.FINANCE.CONFIG_CHANGE,
  )
  async updateFinancialGovernance(
    @Req() req: Request,
    @Body() dto: UpdateFinancialGovernanceDto,
  ) {
    return this.settings.updateFinancialGovernance(req, dto);
  }

  @Put('system')
  @PermissionsAny(
    PERMISSIONS.GOVERNANCE.GLOBAL_OVERRIDE.GOVERNANCE_OVERRIDE,
    PERMISSIONS.GOVERNANCE.GLOBAL_OVERRIDE.SUPER_ADMIN_GLOBAL,
  )
  async updateSystemConfig(
    @Req() req: Request,
    @Body() dto: UpdateSystemConfigDto,
  ) {
    if (process.env.GOVERNANCE_ALLOW_LEGACY_MIXED_SETTINGS_UPDATE !== 'true') {
      throw new ForbiddenException(
        'Legacy mixed-domain endpoint is disabled. Use /settings/governance/system and /settings/governance/financial.',
      );
    }

    const codes = new Set<string>(
      Array.isArray((req as any)?.user?.permissions)
        ? (((req as any).user.permissions ?? []) as string[]).map(String)
        : [],
    );
    const hasOverride =
      codes.has(PERMISSIONS.GOVERNANCE.GLOBAL_OVERRIDE.GOVERNANCE_OVERRIDE) ||
      codes.has(PERMISSIONS.GOVERNANCE.GLOBAL_OVERRIDE.SUPER_ADMIN_GLOBAL);
    if (!hasOverride) {
      throw new ForbiddenException('Access denied');
    }
    return this.settings.updateSystemConfig(req, dto);
  }

  @Get('finance/ap-control-account')
  @PermissionsAny(PERMISSIONS.FINANCE.CONFIG_UPDATE)
  async getFinanceApControlAccount(@Req() req: Request) {
    return this.settings.getFinanceApControlAccount(req);
  }

  @Put('finance/ap-control-account')
  @PermissionsAny(PERMISSIONS.FINANCE.CONFIG_UPDATE)
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
  @PermissionsAny(PERMISSIONS.GOVERNANCE.SYSTEM.VIEW, PERMISSIONS.SYSTEM.CONFIG_VIEW)
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
