import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

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
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;

  private isProd() {
    return process.env.NODE_ENV === 'production';
  }

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const host = String(process.env.MAIL_HOST ?? '').trim();
    const port = Number(process.env.MAIL_PORT ?? 0);
    const user = String(process.env.MAIL_USER ?? '').trim();
    const pass = String(process.env.MAIL_PASS ?? '').trim();

    if (!host || !port || !user || !pass) {
      throw new Error('Missing SMTP configuration (MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS)');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
    });

    return this.transporter;
  }

  private resolveFrom() {
    const fromEmail = String(process.env.MAIL_FROM_EMAIL ?? '').trim();
    const fromName = String(process.env.MAIL_FROM_NAME ?? '').trim();

    if (!fromEmail) {
      throw new Error('Missing MAIL_FROM_EMAIL');
    }

    return fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
  }

  async sendTwoFactorOtpEmail(params: SendOtpEmailParams): Promise<void> {
    const subject = `${params.tenantName ? `${params.tenantName} - ` : ''}USPIRE ERP - Login Verification Code`;
    const body = `\
Hello,\
\
Your verification code is: ${params.otp}\
\
This code will expire in ${params.expiresMinutes} minutes.\
\
If you did not attempt to sign in, you can ignore this email.\
\
Regards,\
USPIRE ERP System\
`;

    if (!this.isProd()) {
      // eslint-disable-next-line no-console
      console.log('[MailerService][2fa-otp-email][dev]', {
        toEmail: params.toEmail,
        tenantName: params.tenantName ?? null,
        subject,
        text: body,
      });
      return;
    }

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: this.resolveFrom(),
        to: params.toEmail,
        subject,
        text: body,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send 2FA OTP email to ${params.toEmail}`,
        (err as any)?.stack ?? String(err),
      );
    }
  }

  async sendUnlockRequestEmail(params: SendUnlockRequestEmailParams): Promise<void> {
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

    if (!this.isProd()) {
      // eslint-disable-next-line no-console
      console.log('[MailerService][unlock-request-email][dev]', {
        to: params.to,
        subject,
        text: body,
      });
      return;
    }

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: this.resolveFrom(),
        to: params.to.join(','),
        subject,
        text: body,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send unlock request email to ${params.to.join(',')}`,
        (err as any)?.stack ?? String(err),
      );
    }
  }

  async sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<void> {
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

    if (!this.isProd()) {
      // eslint-disable-next-line no-console
      console.log('[MailerService][password-reset-email][dev]', {
        to: params.to,
        subject,
        text: body,
      });
      return;
    }

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: this.resolveFrom(),
        to: params.to,
        subject,
        text: body,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send password reset email to ${params.to}`,
        (err as any)?.stack ?? String(err),
      );
    }
  }
}
