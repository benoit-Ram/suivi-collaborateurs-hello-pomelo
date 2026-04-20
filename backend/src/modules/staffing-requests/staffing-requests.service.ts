import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class StaffingRequestsService {
  constructor(private supabase: SupabaseService) {}

  async findAll(filters?: Record<string, string>) {
    let query = this.supabase.db
      .from('staffing_requests')
      .select('*, missions:mission_id(id, nom, client, clients:client_id(id, nom)), collaborateurs:collaborateur_id(id, prenom, nom, photo_url, poste, equipe, bureau, competences), demandeurs:demandeur_id(id, prenom, nom)')
      .order('created_at', { ascending: false });
    if (filters?.demandeur_id) query = query.eq('demandeur_id', filters.demandeur_id);
    if (filters?.statut) query = query.eq('statut', filters.statut);
    if (filters?.mission_id) query = query.eq('mission_id', filters.mission_id);
    const { data, error } = await query;
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return data;
  }

  async create(dto: any) {
    const { data, error } = await this.supabase.db
      .from('staffing_requests')
      .insert(dto)
      .select()
      .single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async approve(id: string) {
    // Atomic guard: transition en_attente → approuve. Only one caller wins.
    const { data: req, error: claimErr } = await this.supabase.db
      .from('staffing_requests')
      .update({ statut: 'approuve' })
      .eq('id', id)
      .eq('statut', 'en_attente')
      .select()
      .single();
    if (claimErr || !req) {
      // Either not found, or someone else already transitioned it
      throw new HttpException('Demande déjà traitée ou introuvable', HttpStatus.CONFLICT);
    }

    // Now create the assignment. If it fails, roll back the request state to en_attente.
    const { error: assignErr } = await this.supabase.db.from('assignments').insert({
      mission_id: req.mission_id,
      collaborateur_id: req.collaborateur_id,
      role: req.role,
      jours_par_semaine: req.jours_par_semaine,
      taux_staffing: Math.round((req.jours_par_semaine || 5) / 5 * 100),
      date_debut: req.date_debut,
      date_fin: req.date_fin,
      statut: 'actif',
    });
    if (assignErr) {
      await this.supabase.db.from('staffing_requests').update({ statut: 'en_attente' }).eq('id', id);
      throw new HttpException(assignErr.message, HttpStatus.BAD_REQUEST);
    }
    return req;
  }

  async refuse(id: string, motif_refus: string) {
    const { data, error } = await this.supabase.db
      .from('staffing_requests')
      .update({ statut: 'refuse', motif_refus })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }
}
