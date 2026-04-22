import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { CalendarService } from './calendar.service';

/** High-level RH notifications orchestrating Gmail + Calendar side effects.
 * All methods are fire-and-forget: callers don't await the actual delivery
 * and errors never bubble up (already logged). Safe to call from any service.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  /** Public URL used in mail templates (deep links back to the app).
   * Falls back to the first HTTPS origin declared in FRONTEND_URL (CORS list),
   * then to the production domain. APP_URL takes precedence when set. */
  private readonly appUrl = (() => {
    if (process.env.APP_URL) return process.env.APP_URL;
    const fromCors = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).find(s => s.startsWith('https://'));
    return fromCors || 'https://rh.pomelo-dev.fr';
  })();

  constructor(private mailer: MailerService, private calendar: CalendarService) {}

  // ── Congés ─────────────────────────────────────────

  onAbsenceApproved(data: {
    collabEmail: string; collabPrenom: string; managerEmail?: string | null;
    absenceId: string; type: string; date_debut: string; date_fin: string; jours: number; commentaire?: string;
  }): void {
    // Fire mail
    this.mailer.send({
      to: data.collabEmail,
      subject: `✅ Ton congé du ${fr(data.date_debut)} au ${fr(data.date_fin)} a été validé`,
      html: congeApprovedTemplate(data, this.appUrl),
    }).catch(() => {});
    // Fire calendar event
    this.calendar.upsertAbsenceEvent({
      userEmail: data.collabEmail, id: data.absenceId, type: data.type,
      date_debut: data.date_debut, date_fin: data.date_fin, commentaire: data.commentaire,
    }).catch(() => {});
  }

  onAbsenceRefused(data: {
    collabEmail: string; collabPrenom: string; absenceId: string;
    type: string; date_debut: string; date_fin: string; motif_refus?: string;
  }): void {
    this.mailer.send({
      to: data.collabEmail,
      subject: `❌ Ton congé du ${fr(data.date_debut)} au ${fr(data.date_fin)} a été refusé`,
      html: congeRefusedTemplate(data, this.appUrl),
    }).catch(() => {});
    // In case the absence had been approved before, remove the calendar event
    this.calendar.deleteAbsenceEvent(data.collabEmail, data.absenceId).catch(() => {});
  }

  onAbsencePending(data: {
    managerEmail: string; managerPrenom: string;
    collabPrenom: string; collabNom: string;
    type: string; date_debut: string; date_fin: string; jours: number; commentaire?: string;
  }): void {
    this.mailer.send({
      to: data.managerEmail,
      subject: `⏳ Demande de congé — ${data.collabPrenom} ${data.collabNom}`,
      html: congeRequestTemplate(data, this.appUrl),
    }).catch(() => {});
  }

  onAbsenceCancelled(data: { collabEmail: string; absenceId: string }): void {
    this.calendar.deleteAbsenceEvent(data.collabEmail, data.absenceId).catch(() => {});
  }
}

// ── Templates (kept inline to avoid template-engine dep) ──────────

function fr(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const baseStyle = `
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#05056D;max-width:560px;margin:0 auto;padding:24px;line-height:1.5;background:#F8F7FC}
  .card{background:#FFFFFF;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(5,5,109,0.05)}
  h1{font-size:1.1rem;margin:0 0 12px}
  .muted{color:#6B6B9A;font-size:0.82rem}
  .btn{display:inline-block;padding:10px 18px;background:#FF3285;color:#fff !important;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px}
  .detail{background:#F8F7FC;border-radius:8px;padding:12px;margin:12px 0;font-size:0.88rem}
  .footer{margin-top:16px;font-size:0.72rem;color:#6B6B9A}
`;

function congeApprovedTemplate(d: any, appUrl: string): string {
  return `<html><head><style>${baseStyle}</style></head><body>
<div class="card">
  <h1>✅ Ton congé est validé, ${esc(d.collabPrenom)} 🎉</h1>
  <div class="detail">
    <strong>${esc(d.type)}</strong><br/>
    Du <strong>${fr(d.date_debut)}</strong> au <strong>${fr(d.date_fin)}</strong> — ${d.jours} jour(s) ouvré(s)
    ${d.commentaire ? `<br/><span class="muted">${esc(d.commentaire)}</span>` : ''}
  </div>
  <p class="muted">Un événement a été ajouté à ton calendrier Google.</p>
  <a href="${appUrl}/collab" class="btn">Voir mon solde</a>
  <div class="footer">— Hello Pomelo RH</div>
</div></body></html>`;
}

function congeRefusedTemplate(d: any, appUrl: string): string {
  return `<html><head><style>${baseStyle}</style></head><body>
<div class="card">
  <h1>❌ Ta demande de congé a été refusée</h1>
  <div class="detail">
    <strong>${esc(d.type)}</strong> du <strong>${fr(d.date_debut)}</strong> au <strong>${fr(d.date_fin)}</strong>
  </div>
  ${d.motif_refus ? `<p><strong>Motif :</strong> ${esc(d.motif_refus)}</p>` : ''}
  <p>N'hésite pas à échanger avec ton manager pour trouver une autre période.</p>
  <a href="${appUrl}/collab" class="btn">Voir mes demandes</a>
  <div class="footer">— Hello Pomelo RH</div>
</div></body></html>`;
}

function congeRequestTemplate(d: any, appUrl: string): string {
  return `<html><head><style>${baseStyle}</style></head><body>
<div class="card">
  <h1>⏳ Nouvelle demande de congé à valider</h1>
  <p>Bonjour ${esc(d.managerPrenom)},</p>
  <div class="detail">
    <strong>${esc(d.collabPrenom)} ${esc(d.collabNom)}</strong><br/>
    ${esc(d.type)} — du <strong>${fr(d.date_debut)}</strong> au <strong>${fr(d.date_fin)}</strong> (${d.jours} jour(s) ouvré(s))
    ${d.commentaire ? `<br/><span class="muted">« ${esc(d.commentaire)} »</span>` : ''}
  </div>
  <a href="${appUrl}/collab" class="btn">Valider / refuser</a>
  <div class="footer">— Hello Pomelo RH</div>
</div></body></html>`;
}
