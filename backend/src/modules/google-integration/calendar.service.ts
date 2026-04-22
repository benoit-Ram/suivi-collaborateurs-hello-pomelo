import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAuthService } from './google-auth.service';

const CAL_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

export interface AbsenceEventInput {
  userEmail: string;        // impersonate this user
  id: string;               // absence id (used as idempotency key)
  type: string;             // label absence ("Congé payé")
  date_debut: string;       // YYYY-MM-DD
  date_fin: string;         // YYYY-MM-DD
  commentaire?: string;
}

/** Pushes absences to the user's primary Google Calendar as all-day events.
 * Uses the absence.id as event identifier so we can update/delete on approval changes.
 * Silently no-ops if not configured.
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private readonly enabled = process.env.GOOGLE_CALENDAR_ENABLED === 'true';

  constructor(private googleAuth: GoogleAuthService) {
    if (!this.enabled) this.logger.log('CalendarService disabled (set GOOGLE_CALENDAR_ENABLED=true to activate).');
  }

  /** Google Calendar event IDs must be base32hex-ish; derive a deterministic id from the absence UUID. */
  private eventId(absenceId: string): string {
    return 'hpabs' + absenceId.replace(/-/g, '').toLowerCase();
  }

  /** Add one day to YYYY-MM-DD (all-day events use exclusive end in Google Calendar). */
  private addOneDay(d: string): string {
    const dt = new Date(d + 'T00:00:00Z');
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().split('T')[0];
  }

  async upsertAbsenceEvent(input: AbsenceEventInput): Promise<boolean> {
    if (!this.enabled) return false;
    const client = this.googleAuth.getClient(CAL_SCOPES, input.userEmail);
    if (!client) return false;
    const calendar = google.calendar({ version: 'v3', auth: client });
    const eventId = this.eventId(input.id);
    const body = {
      id: eventId,
      summary: `🏖️ ${input.type}`,
      description: input.commentaire || '',
      start: { date: input.date_debut },
      end: { date: this.addOneDay(input.date_fin) },
      transparency: 'opaque',
      source: { title: 'Hello Pomelo RH', url: 'https://rh.pomelo-dev.fr/' },
    };
    try {
      // Try insert first; if conflict (already exists), fall back to patch
      try {
        await calendar.events.insert({ calendarId: 'primary', requestBody: body });
        this.logger.log(`Calendar event created for ${input.userEmail} (abs ${input.id})`);
      } catch (e: any) {
        if (e?.code === 409 || /already exists|duplicate/i.test(e?.message || '')) {
          await calendar.events.patch({ calendarId: 'primary', eventId, requestBody: body });
          this.logger.log(`Calendar event updated for ${input.userEmail} (abs ${input.id})`);
        } else {
          throw e;
        }
      }
      return true;
    } catch (e: any) {
      this.logger.warn(`Calendar upsert failed for abs ${input.id}: ${e.message}`);
      return false;
    }
  }

  async deleteAbsenceEvent(userEmail: string, absenceId: string): Promise<boolean> {
    if (!this.enabled) return false;
    const client = this.googleAuth.getClient(CAL_SCOPES, userEmail);
    if (!client) return false;
    const calendar = google.calendar({ version: 'v3', auth: client });
    try {
      await calendar.events.delete({ calendarId: 'primary', eventId: this.eventId(absenceId) });
      return true;
    } catch (e: any) {
      if (e?.code !== 404 && e?.code !== 410) {
        this.logger.warn(`Calendar delete failed for abs ${absenceId}: ${e.message}`);
      }
      return false;
    }
  }
}
