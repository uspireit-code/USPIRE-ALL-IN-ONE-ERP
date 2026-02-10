import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSIONS } from '../rbac/permission-catalog';
import { AllowedAvatarMimeTypes, ChangePasswordDto, UpdateMyProfileDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('admin/users')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.SECURITY.DELEGATION_MANAGE)
  async listAdminUsers(@Req() req: Request) {
    return this.users.listAdminUsers(req);
  }

  @Get('me')
  async me(@Req() req: Request) {
    return this.users.getMe(req.user!.id, req.user!.tenantId);
  }

  @Patch('me')
  async updateMe(@Req() req: Request, @Body() dto: UpdateMyProfileDto) {
    return this.users.updateMyProfile(req.user!.id, req.user!.tenantId, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = AllowedAvatarMimeTypes as readonly string[];
        if (!allowed.includes(String(file.mimetype ?? ''))) {
          return cb(null, false);
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dest = path.join(process.cwd(), 'uploads', 'avatars');
          fs.mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(String(file.originalname ?? '')).toLowerCase();
          const safeExt = ext && ext.length <= 10 ? ext : '';
          cb(null, `${req.user!.id}_${Date.now()}${safeExt}`);
        },
      }),
    }),
  )
  async uploadAvatar(@Req() req: Request, @UploadedFile() file: any) {
    return this.users.updateMyAvatar(req.user!.id, req.user!.tenantId, file);
  }

  @Post('me/change-password')
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(req, dto);
  }
}
