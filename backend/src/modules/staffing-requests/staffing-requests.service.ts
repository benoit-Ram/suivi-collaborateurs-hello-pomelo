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
    // Get the request
    const { data: req, error: fetchErr } = await this.supabase.db
      .from('staffing_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !req) throw new HttpException('Demande non trouvée', HttpStatus.NOT_FOUND);
    if (req.statut !== 'en_attente') throw new HttpException('Demande déjà traitée', HttpStatus.BAD_REQUEST);

    // Create the assignment
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
    if (assignErr) throw new HttpException(assignErr.message, HttpStatus.BAD_REQUEST);

    // Update request status
    const { data, error } = await this.supabase.db
      .from('staffing_requests')
      .update({ statut: 'approuve' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
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
