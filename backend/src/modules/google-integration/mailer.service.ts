import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAuthService } from './google-auth.service';

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

export interface MailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  replyTo?: string;
}

/** Sends mail via Gmail API using a service account that impersonates `from`
 * (via domain-wide delegation). Defaults to GOOGLE_IMPERSONATE_DEFAULT if not
 * specified. Silently no-ops if service account not configured.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly enabled = process.env.GOOGLE_MAIL_ENABLED === 'true';
  /** Primary Workspace user whose mailbox the service account impersonates.
   * Must be a real user (not an alias). Defaults to GOOGLE_IMPERSONATE_DEFAULT. */
  private readonly impersonateUser: string | undefined;
  /** From header — can be an alias of the impersonated user (Gmail will accept it). */
  private readonly fromAddress: string;

  constructor(private googleAuth: GoogleAuthService) {
    this.impersonateUser = process.env.GOOGLE_IMPERSONATE_DEFAULT;
    this.fromAddress = process.env.GOOGLE_MAIL_FROM || this.impersonateUser || 'noreply@hello-pomelo.com';
    if (!this.enabled) {
      this.logger.log('MailerService disabled (set GOOGLE_MAIL_ENABLED=true to activate).');
    } else if (!this.googleAuth.isConfigured()) {
      this.logger.warn('GOOGLE_MAIL_ENABLED=true but service account not configured — sends will be skipped.');
    } else if (!this.impersonateUser) {
      this.logger.warn('GOOGLE_IMPERSONATE_DEFAULT missing — cannot send mail without a real user to impersonate.');
    }
  }

  /** Fire-and-forget; returns true if dispatched, false if skipped. Never throws. */
  async send(msg: MailMessage): Promise<boolean> {
    if (!this.enabled || !this.impersonateUser) return false;
    // Impersonate the primary user; set From: header to fromAddress (possibly an alias).
    const client = this.googleAuth.getClient(GMAIL_SCOPES, this.impersonateUser);
    if (!client) return false;

    const toList = Array.isArray(msg.to) ? msg.to.join(', ') : msg.to;
    const ccList = msg.cc ? (Array.isArray(msg.cc) ? msg.cc.join(', ') : msg.cc) : undefined;
    const boundary = 'hp-' + Math.random().toString(36).slice(2);

    const headers = [
      `From: Hello Pomelo RH <${this.fromAddress}>`,
      `To: ${toList}`,
      ccList ? `Cc: ${ccList}` : null,
      msg.replyTo ? `Reply-To: ${msg.replyTo}` : null,
      `Subject: ${encodeSubject(msg.subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ].filter(Boolean).join('\r\n');

    const body = [
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      msg.text || stripHtml(msg.html),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      msg.html,
      `--${boundary}--`,
    ].join('\r\n');

    const raw = Buffer.from(headers + '\r\n' + body, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    try {
      const gmail = google.gmail({ version: 'v1', auth: client });
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
      this.logger.log(`Mail sent to ${toList} — "${msg.subject}"`);
      return true;
    } catch (e: any) {
      this.logger.warn(`Mail send failed for "${msg.subject}": ${e.message}`);
      return false;
    }
  }
}

function encodeSubject(s: string): string {
  // RFC 2047 encoded-word for non-ASCII subjects
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf-8').toString('base64')}?=`;
}

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
