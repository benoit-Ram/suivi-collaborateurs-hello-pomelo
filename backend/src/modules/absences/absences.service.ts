import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';
import { NotificationsService } from '../google-integration/notifications.service';

@Injectable()
export class AbsencesService {
  constructor(private supabase: SupabaseService, private notifications: NotificationsService) {}

  /** Count working days (weekdays) in [start, end] inclusive, accounting for half-days. */
  private countWorkDays(start: string, end: string, demi?: string | null): number {
    const s = new Date(start);
    const e = new Date(end);
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return demi && start === end ? 0.5 : count;
  }

  /** Fetch collab info needed for notification templates */
  private async getCollabForNotif(id: string) {
    const { data } = await this.supabase.db
      .from('collaborateurs')
      .select('id, prenom, nom, email, manager_id')
      .eq('id', id)
      .single();
    return data;
  }

  private async getManagerEmail(managerId: string | null | undefined) {
    if (!managerId) return null;
    const { data } = await this.supabase.db
      .from('collaborateurs')
      .select('email, prenom')
      .eq('id', managerId)
      .single();
    return data;
  }

  private absenceTypeLabel(key: string): string {
    const m: Record<string, string> = {
      conge: 'Congé payé',
      sans_solde: 'Sans solde',
      maladie: 'Maladie',
      formation: 'Formation / Cours',
    };
    return m[key] || key;
  }

  private static readonly ALLOWED_FILTERS = ['collaborateur_id', 'statut', 'type'];

  async findAll(filters?: Record<string, string>) {
    let query = this.supabase.db.from('absences').select('*').order('date_debut', { ascending: false });
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => { if (val && AbsencesService.ALLOWED_FILTERS.includes(key)) query = query.eq(key, val); });
    }
    const { data, error } = await query;
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db.from('absences').select('*').eq('id', id).single();
    if (error) throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    return data;
  }

  async create(dto: any) {
    // Validate required fields
    if (!dto.collaborateur_id) throw new HttpException('collaborateur_id requis', HttpStatus.BAD_REQUEST);
    if (!dto.type) throw new HttpException('type requis', HttpStatus.BAD_REQUEST);
    if (!dto.date_debut) throw new HttpException('date_debut requis', HttpStatus.BAD_REQUEST);
    if (!dto.date_fin) throw new HttpException('date_fin requis', HttpStatus.BAD_REQUEST);
    if (dto.date_fin < dto.date_debut) throw new HttpException('date_fin doit être >= date_debut', HttpStatus.BAD_REQUEST);

    // Check for overlapping absences (only non-cancelled)
    const { data: existing } = await this.supabase.db
      .from('absences')
      .select('id, date_debut, date_fin, demi_journee, statut')
      .eq('collaborateur_id', dto.collaborateur_id)
      .in('statut', ['en_attente', 'approuve'])
      .lte('date_debut', dto.date_fin)
      .gte('date_fin', dto.date_debut);

    if (existing && existing.length > 0) {
      // Check if it's a real overlap (handle half-day)
      const hasRealOverlap = existing.some(a => {
        if (dto.demi_journee && a.demi_journee && dto.date_debut === a.date_debut) {
          return dto.demi_journee === a.demi_journee;
        }
        return true; // Full overlap
      });
      if (hasRealOverlap) {
        throw new HttpException('Chevauchement avec une absence existante', HttpStatus.BAD_REQUEST);
      }
    }

    const { data, error } = await this.supabase.db.from('absences').insert(dto).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);

    // Notify manager if the created absence is still pending
    if (data?.statut === 'en_attente') {
      const collab = await this.getCollabForNotif(data.collaborateur_id);
      const manager = await this.getManagerEmail(collab?.manager_id);
      if (manager?.email) {
        this.notifications.onAbsencePending({
          managerEmail: manager.email,
          managerPrenom: manager.prenom,
          collabPrenom: collab?.prenom || '',
          collabNom: collab?.nom || '',
          type: this.absenceTypeLabel(data.type),
          date_debut: data.date_debut,
          date_fin: data.date_fin,
          jours: this.countWorkDays(data.date_debut, data.date_fin, data.demi_journee),
          commentaire: data.commentaire,
        });
      }
    }
    return data;
  }

  async update(id: string, dto: any) {
    // Capture previous state for diff-based notification
    const { data: before } = await this.supabase.db.from('absences').select('*').eq('id', id).single();

    const { data, error } = await this.supabase.db.from('absences').update(dto).eq('id', id).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);

    // Notify on status transitions
    if (before && data && before.statut !== data.statut) {
      const collab = await this.getCollabForNotif(data.collaborateur_id);
      if (collab?.email) {
        const common = {
          collabEmail: collab.email,
          collabPrenom: collab.prenom,
          absenceId: data.id,
          type: this.absenceTypeLabel(data.type),
          date_debut: data.date_debut,
          date_fin: data.date_fin,
        };
        if (data.statut === 'approuve') {
          this.notifications.onAbsenceApproved({
            ...common,
            managerEmail: null,
            jours: this.countWorkDays(data.date_debut, data.date_fin, data.demi_journee),
            commentaire: data.commentaire,
          });
        } else if (data.statut === 'refuse') {
          this.notifications.onAbsenceRefused({ ...common, motif_refus: data.motif_refus });
        } else if (data.statut === 'annule') {
          this.notifications.onAbsenceCancelled({ collabEmail: collab.email, absenceId: data.id });
        }
      }
    }
    return data;
  }

  /** Collab can only cancel their own pending/approved absences */
  async updateForCollab(id: string, dto: any, collabId: string) {
    // Fetch the absence first
    const { data: absence, error: fetchErr } = await this.supabase.db
      .from('absences')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !absence) throw new HttpException('Absence non trouvée', HttpStatus.NOT_FOUND);
    if (absence.collaborateur_id !== collabId) throw new HttpException('Non autorisé', HttpStatus.FORBIDDEN);

    // Only allow specific state transitions
    const allowed: Record<string, string[]> = {
      'en_attente': ['annule'], // Can cancel pending
      'approuve': ['annulation_demandee'], // Can request cancellation of approved
    };
    if (dto.statut && (!allowed[absence.statut] || !allowed[absence.statut].includes(dto.statut))) {
      throw new HttpException(`Transition ${absence.statut} → ${dto.statut} non autorisée`, HttpStatus.BAD_REQUEST);
    }

    // Only allow statut + commentaire_annulation fields
    const safeDto: any = {};
    if (dto.statut) safeDto.statut = dto.statut;
    if (dto.commentaire_annulation) safeDto.commentaire_annulation = dto.commentaire_annulation;

    const { data, error } = await this.supabase.db.from('absences').update(safeDto).eq('id', id).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabase.db.from('absences').delete().eq('id', id);
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return { success: true };
  }
}
