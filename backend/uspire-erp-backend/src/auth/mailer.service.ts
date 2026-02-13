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

  private readonly BRAND_BLUE = '#050056';
  private readonly ACCENT_GOLD = '#d4a017';
  private readonly BG = '#f5f7fb';
  private readonly TEXT = '#111827';
  private readonly SUBTEXT = '#6b7280';
  private readonly FONT_FAMILY = 'Inter, Arial, sans-serif';
  private readonly CODE_BOX_BLUE = '#1d67be';

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

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private resolveLogoUrl() {
    const logoUrl = String(process.env.MAIL_LOGO_URL ?? '').trim();
    return logoUrl || null;
  }

  private resolveFrontendUrl() {
    const url = String(process.env.FRONTEND_URL ?? '').trim();
    return url || null;
  }

  private buildEmailLayout(params: {
    title: string;
    preheader?: string;
    contentHtml: string;
  }) {
    const safeTitle = this.escapeHtml(params.title);
    const logoUrl = this.resolveLogoUrl();
    const preheader = this.escapeHtml(params.preheader ?? '');

    const headerHtml = logoUrl
      ? `<img src="${this.escapeHtml(logoUrl)}" alt="USPIRE ERP" height="28" style="display:block; height:28px; max-width:220px;" />`
      : `<div style="font-family:${this.FONT_FAMILY}; font-size:18px; font-weight:800; color:${this.BRAND_BLUE}; letter-spacing:0.3px;">USPIRE ERP</div>`;

    // Note: most email clients strip <style>; keep styles inline.
    return `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0; padding:0; background:${this.BG};">
    <div style="display:none; font-size:1px; color:${this.BG}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${this.BG}; padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background:#ffffff; border:1px solid rgba(17,24,39,0.10); border-radius:14px; overflow:hidden;">
            <tr>
              <td style="padding:18px 22px; border-bottom:1px solid rgba(17,24,39,0.08);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" valign="middle">
                      ${headerHtml}
                    </td>
                    <td align="right" valign="middle" style="font-family:${this.FONT_FAMILY}; font-size:12px; color:${this.ACCENT_GOLD}; font-weight:700;">
                      ${this.escapeHtml('Secure Access')}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:22px; font-family:${this.FONT_FAMILY}; color:${this.TEXT};">
                <div style="font-size:16px; font-weight:800; margin:0 0 8px 0; color:${this.TEXT};">${safeTitle}</div>
                ${params.contentHtml}
              </td>
            </tr>

            <tr>
              <td style="padding:18px 22px; border-top:1px solid rgba(17,24,39,0.08); font-family:${this.FONT_FAMILY};">
                <div style="font-size:12px; color:${this.SUBTEXT};">
                  <div style="margin-bottom:8px;">© 2026 Uspire Professional Services Limited. All rights reserved.</div>
                  <div>Support: <a href="mailto:support@uspireservices.com" style="color:${this.BRAND_BLUE}; text-decoration:none; font-weight:600;">support@uspireservices.com</a></div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  private buildCodeBoxHtml(code: string) {
    const safeCode = this.escapeHtml(code);
    return `
<div style="margin:20px 0;">
  <div style="font-size:12px; color:${this.SUBTEXT}; margin-bottom:8px;">Code</div>
  <div style="font-family:${this.FONT_FAMILY}; font-size:28px; font-weight:700; letter-spacing:4px; background:#eef5ff; border:1px solid ${this.CODE_BOX_BLUE}33; border-radius:10px; padding:18px; text-align:center; color:${this.CODE_BOX_BLUE};">
    ${safeCode}
  </div>
</div>`;
  }

  private buildCtaButtonHtml(params: { label: string; url: string }) {
    const safeLabel = this.escapeHtml(params.label);
    const safeUrl = this.escapeHtml(params.url);
    return `
<div style="margin:18px 0 0 0;">
  <a href="${safeUrl}"
     style="display:inline-block; background:${this.CODE_BOX_BLUE}; color:#ffffff; padding:12px 18px; border-radius:8px; font-weight:800; text-decoration:none; font-family:${this.FONT_FAMILY};">
    ${safeLabel}
  </a>
</div>`;
  }

  private async sendEmail(params: {
    to: string | string[];
    subject: string;
    text: string;
    html: string;
    logTag: string;
  }): Promise<void> {
    const toValue = Array.isArray(params.to) ? params.to.join(',') : params.to;

    if (!this.isProd()) {
      // eslint-disable-next-line no-console
      console.log(`[MailerService][${params.logTag}][dev]`, {
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return;
    }

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: this.resolveFrom(),
        to: toValue,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send email (${params.logTag}) to ${toValue}`,
        (err as any)?.stack ?? String(err),
      );
    }
  }

  async sendTwoFactorOtpEmail(params: SendOtpEmailParams): Promise<void> {
    const subject = `${params.tenantName ? `${params.tenantName} - ` : ''}USPIRE ERP - Login Verification Code`;
    const text = `USPIRE ERP - Login Verification Code\n\nYour verification code is: ${params.otp}\n\nThis code will expire in ${params.expiresMinutes} minutes.\n\nIf you did not attempt to sign in, you can ignore this email.\n\n© 2026 Uspire Professional Services Limited. All rights reserved.\nSupport: support@uspireservices.com\n`;

    const contentHtml = `
<div style="font-size:14px; color:${this.SUBTEXT}; margin:0 0 16px 0;">
  Hello,
</div>
<div style="font-size:14px; line-height:1.55; margin:0 0 12px 0;">
  Use the verification code below to complete your sign-in.
</div>
${this.buildCodeBoxHtml(params.otp)}
<div style="font-size:13px; color:${this.SUBTEXT}; line-height:1.55;">
  This code will expire in <strong style="color:${this.TEXT};">${this.escapeHtml(String(params.expiresMinutes))} minutes</strong>.
  <br />
  If you did not attempt to sign in, you can ignore this email.
</div>`;

    const html = this.buildEmailLayout({
      title: 'Login Verification Code',
      preheader: `Your verification code is ${params.otp}`,
      contentHtml,
    });

    await this.sendEmail({
      to: params.toEmail,
      subject,
      text,
      html,
      logTag: '2fa-otp-email',
    });
  }

  async sendUnlockRequestEmail(params: SendUnlockRequestEmailParams): Promise<void> {
    const subject = `USPIRE ERP - Unlock Request (${params.userEmail})`;
    const requestedAtIso = params.requestedAt.toISOString();
    const ip = params.ipAddress || 'N/A';
    const ua = params.userAgent || 'N/A';

    const text = `USPIRE ERP - Unlock Request\n\nAn account unlock request has been submitted.\n\nUser Email: ${params.userEmail}\nTenant ID: ${params.tenantId}\nRequest ID: ${params.unlockRequestId}\nRequested At: ${requestedAtIso}\nIP Address: ${ip}\nUser Agent: ${ua}\n\nPlease login to USPIRE ERP > Settings > Users and unlock the account.\n\n© 2026 Uspire Professional Services Limited. All rights reserved.\nSupport: support@uspireservices.com\n`;

    const row = (label: string, value: string) => `
<tr>
  <td style="padding:10px 12px; border-bottom:1px solid rgba(17,24,39,0.08); width:140px; font-weight:800; color:${this.TEXT};">${this.escapeHtml(label)}</td>
  <td style="padding:10px 12px; border-bottom:1px solid rgba(17,24,39,0.08); color:${this.TEXT};">${this.escapeHtml(value)}</td>
</tr>`;

    const contentHtml = `
<div style="font-size:14px; color:${this.SUBTEXT}; margin:0 0 16px 0;">
  Hello Administrator,
</div>

<div style="font-size:14px; line-height:1.55; margin:0 0 14px 0;">
  An account unlock request has been submitted. Review the details below.
</div>

<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; border:1px solid rgba(17,24,39,0.10); border-radius:12px; overflow:hidden;">
  ${row('User Email', params.userEmail)}
  ${row('Tenant ID', params.tenantId)}
  ${row('Request ID', params.unlockRequestId)}
  ${row('Requested At', requestedAtIso)}
  ${row('IP Address', ip)}
  ${row('User Agent', ua)}
</table>

<div style="font-size:13px; color:${this.SUBTEXT}; line-height:1.55; margin-top:14px;">
  Please login to USPIRE ERP &gt; Settings &gt; Users and unlock the account.
</div>`;

    const html = this.buildEmailLayout({
      title: 'Unlock Request',
      preheader: `Unlock request for ${params.userEmail}`,
      contentHtml,
    });

    await this.sendEmail({
      to: params.to,
      subject,
      text,
      html,
      logTag: 'unlock-request-email',
    });
  }

  async sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<void> {
    const subject = `USPIRE ERP - Password Reset`;

    const frontendUrl = this.resolveFrontendUrl();
    const resetUrl = frontendUrl
      ? `${frontendUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(params.resetToken)}`
      : null;

    const textLines = [
      'USPIRE ERP - Password Reset',
      '',
      'We received a request to reset your USPIRE ERP password.',
      '',
      `Tenant: ${params.tenantName ?? 'N/A'}`,
      `Reset Token: ${params.resetToken}`,
      '',
      resetUrl ? `Reset Password Link: ${resetUrl}` : null,
      '',
      `This token will expire in ${params.expiresMinutes} minutes.`,
      '',
      'If you did not request this, ignore this message.',
      '',
      '© 2026 Uspire Professional Services Limited. All rights reserved.',
      'Support: support@uspireservices.com',
      '',
    ].filter((v) => v !== null);

    const text = textLines.join('\n');

    const contentHtml = `
<div style="font-size:14px; color:${this.SUBTEXT}; margin:0 0 16px 0;">
  Hello,
</div>

<div style="font-size:14px; line-height:1.55; margin:0 0 12px 0;">
  We received a request to reset your USPIRE ERP password.
</div>

<div style="font-size:13px; color:${this.SUBTEXT}; margin:0 0 10px 0;">
  Tenant: <strong style="color:${this.TEXT};">${this.escapeHtml(params.tenantName ?? 'N/A')}</strong>
</div>

${this.buildCodeBoxHtml(params.resetToken)}

${resetUrl ? this.buildCtaButtonHtml({ label: 'Reset Password', url: resetUrl }) : ''}

<div style="font-size:13px; color:${this.SUBTEXT}; line-height:1.55; margin-top:14px;">
  This token will expire in <strong style="color:${this.TEXT};">${this.escapeHtml(String(params.expiresMinutes))} minutes</strong>.
  <br />
  If you did not request this, ignore this message.
</div>`;

    const html = this.buildEmailLayout({
      title: 'Password Reset',
      preheader: 'Use the token below to reset your password',
      contentHtml,
    });

    await this.sendEmail({
      to: params.to,
      subject,
      text,
      html,
      logTag: 'password-reset-email',
    });
  }
}
