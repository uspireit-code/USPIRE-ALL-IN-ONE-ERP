import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../rbac/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationController {
  constructor(private service: NotificationService) {}

  @Get()
  getUser(@Req() req: Request) {
    const tenantId = String((req as any)?.tenant?.id ?? '');
    const userId = String((req as any)?.user?.id ?? '');
    return this.service.getUserNotifications(tenantId, userId);
  }

  @Get('unread-count')
  async count(@Req() req: Request) {
    const tenantId = String((req as any)?.tenant?.id ?? '');
    const userId = String((req as any)?.user?.id ?? '');
    const count = await this.service.getUnreadCount(tenantId, userId);
    return { count };
  }

  @Patch(':id/read')
  async mark(@Req() req: Request, @Param('id') id: string) {
    const tenantId = String((req as any)?.tenant?.id ?? '');
    const userId = String((req as any)?.user?.id ?? '');
    const out = await this.service.markAsRead(tenantId, userId, id);
    return { ok: true, notification: out };
  }

  @Patch('read-all')
  async markAll(@Req() req: Request) {
    const tenantId = String((req as any)?.tenant?.id ?? '');
    const userId = String((req as any)?.user?.id ?? '');
    const out = await this.service.markAllAsRead(tenantId, userId);
    return { ok: true, updated: out.count };
  }
}
