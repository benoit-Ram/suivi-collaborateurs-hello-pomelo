import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import type { JWT } from 'google-auth-library';

/** Loads a GCP service account with domain-wide delegation and returns JWT clients
 * that impersonate a given user within the @hello-pomelo.com workspace.
 *
 * Config via env vars (kept optional — features degrade to no-op if missing):
 * - GOOGLE_SA_EMAIL: service account email (…@…iam.gserviceaccount.com)
 * - GOOGLE_SA_PRIVATE_KEY: RSA private key (newlines escaped as \n are auto-decoded)
 * - GOOGLE_IMPERSONATE_DEFAULT: fallback user to impersonate (e.g. noreply@hello-pomelo.com)
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly saEmail?: string;
  private readonly saKey?: string;
  private readonly defaultImpersonate?: string;

  constructor() {
    this.saEmail = process.env.GOOGLE_SA_EMAIL;
    this.saKey = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n');
    this.defaultImpersonate = process.env.GOOGLE_IMPERSONATE_DEFAULT;
    if (!this.isConfigured()) {
      this.logger.warn('Google integration is NOT configured (GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY missing). All Google features are no-ops.');
    }
  }

  isConfigured(): boolean {
    return !!(this.saEmail && this.saKey);
  }

  /** Build a JWT client with the requested scopes, impersonating `subject`.
   * Returns null if service account not configured — callers should no-op. */
  getClient(scopes: string[], subject?: string): JWT | null {
    if (!this.isConfigured()) return null;
    const impersonate = subject || this.defaultImpersonate;
    if (!impersonate) {
      this.logger.warn('No user to impersonate (subject arg and GOOGLE_IMPERSONATE_DEFAULT both missing).');
      return null;
    }
    return new google.auth.JWT({
      email: this.saEmail!,
      key: this.saKey!,
      scopes,
      subject: impersonate,
    });
  }
}
