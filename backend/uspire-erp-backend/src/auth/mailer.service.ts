import { Injectable } from '@nestjs/common';

type SendOtpEmailParams = {
  toEmail: string;
  otp: string;
  tenantName?: string;
  expiresMinutes: number;
};

type SendUnlockRequestEmailParams = {
  to: string[];
  tenantId: string;
  userEmail: string;
  unlockRequestId: string;
  requestedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type SendPasswordResetEmailParams = {
  to: string;
  tenantName?: string;
  resetToken: string;
  expiresMinutes: number;
};

@Injectable()
export class MailerService {
  async sendTwoFactorOtpEmail(params: SendOtpEmailParams): Promise<void> {
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) {
      // Stub implementation. Replace with SMTP provider integration.
      // Intentionally do not throw to avoid blocking 2FA flows in environments where email is not configured.
      return;
    }

    // eslint-disable-next-line no-console
    console.log('[MailerService][2fa-otp-email][dev]', {
      toEmail: params.toEmail,
      tenantName: params.tenantName ?? null,
      otp: params.otp,
      expiresMinutes: params.expiresMinutes,
    });
  }

  async sendUnlockRequestEmail(params: SendUnlockRequestEmailParams): Promise<void> {
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) {
      // Stub implementation. Replace with SMTP provider integration.
      // Intentionally do not throw to avoid blocking unlock-request flows in environments where email is not configured.
      return;
    }

    const subject = `USPIRE ERP - Unlock Request (${params.userEmail})`;
    const body = `\
Hello Administrator,\
\
An account unlock request has been submitted.\
\
User Email: ${params.userEmail}\
Tenant ID: ${params.tenantId}\
Request ID: ${params.unlockRequestId}\
Requested At: ${params.requestedAt.toISOString()}\
IP Address: ${params.ipAddress || 'N/A'}\
User Agent: ${params.userAgent || 'N/A'}\
\
Please login to USPIRE ERP > Settings > Users and unlock the account.\
\
Regards,\
USPIRE ERP System\
`;

    // eslint-disable-next-line no-console
    console.log('[MailerService][unlock-request-email][dev]', {
      to: params.to,
      subject,
      text: body,
    });
  }

  async sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<void> {
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) {
      // Stub implementation. Replace with SMTP provider integration.
      // Intentionally do not throw to avoid blocking password-reset flows in environments where email is not configured.
      return;
    }

    const subject = `USPIRE ERP - Password Reset`;
    const body = `\
Hello,\
\
We received a request to reset your USPIRE ERP password.\
\
Tenant: ${params.tenantName ?? 'N/A'}\
Reset Token: ${params.resetToken}\
\
This token will expire in ${params.expiresMinutes} minutes.\
\
If you did not request this, ignore this message.\
\
Regards,\
USPIRE ERP System\
`;

    // eslint-disable-next-line no-console
    console.log('[MailerService][password-reset-email][dev]', {
      to: params.to,
      subject,
      text: body,
    });
  }
}
