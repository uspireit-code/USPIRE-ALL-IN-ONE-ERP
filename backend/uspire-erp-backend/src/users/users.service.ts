import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { AuditEntityType, AuditEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { writeAuditEventWithPrisma } from '../audit/audit-writer';
import {
  AllowedAvatarMimeTypes,
  ChangePasswordDto,
  type UpdateMyProfileDto,
} from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private ensureTenant(req: Request) {
    const tenant: any = (req as any).tenant;
    if (!tenant?.id) throw new BadRequestException('Missing tenant context');
    return tenant as { id: string };
  }

  private ensureUser(req: Request) {
    const user: any = (req as any).user;
    if (!user?.id) throw new BadRequestException('Missing user context');
    return user as { id: string };
  }

  async listAdminUsers(req: Request) {
    const tenant = this.ensureTenant(req);

    const rows = await this.prisma.user.findMany({
      where: {
        tenantId: tenant.id,
      },
      orderBy: { name: 'asc' },
      take: 500,
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      users: rows.map((u) => ({
        id: u.id,
        fullName: u.name,
        email: u.email,
        roleName: (u.userRoles?.[0] as any)?.role?.name ?? null,
        isActive: Boolean(u.isActive),
      })),
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const roundsRaw = this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? '12';
    const rounds = Number(roundsRaw);
    const safeRounds = Number.isFinite(rounds) && rounds >= 8 && rounds <= 15 ? rounds : 12;
    return bcrypt.hash(password, safeRounds);
  }

  async getMe(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        jobTitle: true,
        timezone: true,
        language: true,
        avatarUrl: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      email: user.email,
      fullName: user.name,
      phone: user.phone,
      jobTitle: user.jobTitle,
      timezone: user.timezone,
      language: user.language,
      avatarUrl: user.avatarUrl,
    };
  }

  async updateMyProfile(userId: string, tenantId: string, dto: UpdateMyProfileDto) {
    const nameRaw = dto.fullName !== undefined ? String(dto.fullName ?? '') : undefined;
    const phoneRaw = dto.phone !== undefined ? String(dto.phone ?? '') : undefined;
    const jobTitleRaw = dto.jobTitle !== undefined ? String(dto.jobTitle ?? '') : undefined;
    const timezoneRaw = dto.timezone !== undefined ? String(dto.timezone ?? '') : undefined;
    const languageRaw = dto.language !== undefined ? String(dto.language ?? '') : undefined;

    const update: any = {};

    if (nameRaw !== undefined) {
      const name = nameRaw.trim();
      if (!name) throw new BadRequestException('Full name is required');
      update.name = name;
    }

    if (phoneRaw !== undefined) {
      const phone = phoneRaw.trim();
      if (phone && !/^[+()0-9\s.-]{6,20}$/.test(phone)) {
        throw new BadRequestException('Invalid phone number');
      }
      update.phone = phone || null;
    }

    if (jobTitleRaw !== undefined) {
      const jobTitle = jobTitleRaw.trim();
      update.jobTitle = jobTitle || null;
    }

    if (timezoneRaw !== undefined) {
      const timezone = timezoneRaw.trim();
      update.timezone = timezone || null;
    }

    if (languageRaw !== undefined) {
      const language = languageRaw.trim();
      update.language = language || null;
    }

    const existing = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: update,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        jobTitle: true,
        timezone: true,
        language: true,
        avatarUrl: true,
      },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId,
        actorUserId: userId,
        entityType: AuditEntityType.USER,
        entityId: userId,
        eventType: AuditEventType.USER_PROFILE_UPDATED,
        timestamp: new Date(),
      },
      this.prisma,
    );

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.name,
      phone: updated.phone,
      jobTitle: updated.jobTitle,
      timezone: updated.timezone,
      language: updated.language,
      avatarUrl: updated.avatarUrl,
    };
  }

  async updateMyAvatar(userId: string, tenantId: string, file?: any) {
    if (!file) throw new BadRequestException('Invalid avatar file');
    const mimeType = String(file.mimetype ?? '').trim();
    const allowed = AllowedAvatarMimeTypes as readonly string[];
    if (!allowed.includes(mimeType)) {
      throw new BadRequestException('Unsupported image type');
    }

    const filename = String(file.filename ?? '').trim();
    if (!filename) throw new BadRequestException('Invalid avatar file');

    const existing = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    const avatarUrl = `/uploads/avatars/${filename}`;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });

    await writeAuditEventWithPrisma(
      {
        tenantId,
        actorUserId: userId,
        entityType: AuditEntityType.USER,
        entityId: userId,
        eventType: AuditEventType.USER_AVATAR_UPDATED,
        timestamp: new Date(),
      },
      this.prisma,
    );

    return { avatarUrl: updated.avatarUrl };
  }

  async changePassword(req: Request, dto: ChangePasswordDto) {
    const tenant = this.ensureTenant(req);
    const sessionUser = this.ensureUser(req);

    const currentPassword = String(dto.currentPassword ?? '');
    const newPassword = String(dto.newPassword ?? '');
    const confirm = String(dto.confirmNewPassword ?? '');

    if (!currentPassword) throw new BadRequestException('Current password is required');
    if (!newPassword) throw new BadRequestException('New password is required');
    if (newPassword !== confirm) throw new BadRequestException('Passwords do not match');

    const user = await this.prisma.user.findFirst({
      where: { id: sessionUser.id, tenantId: tenant.id, isActive: true },
      select: { id: true, passwordHash: true },
    });

    if (!user) throw new UnauthorizedException('Invalid user');

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await this.hashPassword(newPassword);
    const now = new Date();
    const passwordExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordChangedAt: now as any,
        passwordExpiresAt: passwordExpiresAt as any,
        mustChangePassword: false as any,
      } as any,
    });

    return { ok: true };
  }
}
