import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class AbsencesService {
  constructor(private supabase: SupabaseService) {}

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
    return data;
  }

  async update(id: string, dto: any) {
    const { data, error } = await this.supabase.db.from('absences').update(dto).eq('id', id).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
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
