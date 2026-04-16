import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class ObjectifRequestsService {
  constructor(private supabase: SupabaseService) {}

  async findAll(filters?: Record<string, string>) {
    let query = this.supabase.db
      .from('objectif_requests')
      .select('*, objectifs:objectif_id(id, titre, progression, statut, collaborateur_id), collaborateurs:collaborateur_id(id, prenom, nom, photo_url)')
      .order('created_at', { ascending: false });
    if (filters?.collaborateur_id) query = query.eq('collaborateur_id', filters.collaborateur_id);
    if (filters?.statut) query = query.eq('statut', filters.statut);
    if (filters?.manager_id) query = query.eq('manager_id', filters.manager_id);
    const { data, error } = await query;
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return data;
  }

  async create(dto: any) {
    const { data, error } = await this.supabase.db
      .from('objectif_requests')
      .insert(dto)
      .select()
      .single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async approve(id: string) {
    // Get the request
    const { data: req, error: fetchErr } = await this.supabase.db
      .from('objectif_requests').select('*').eq('id', id).single();
    if (fetchErr || !req) throw new HttpException('Demande non trouvée', HttpStatus.NOT_FOUND);
    if (req.statut !== 'en_attente') throw new HttpException('Demande déjà traitée', HttpStatus.BAD_REQUEST);

    const requestData = req.data || {};

    // Update the objectif progression
    if (requestData.progression !== undefined) {
      // Get current objectif for historique
      const { data: obj } = await this.supabase.db
        .from('objectifs').select('progression, historique').eq('id', req.objectif_id).single();

      const historique = [...(obj?.historique || []), {
        date: new Date().toISOString().split('T')[0],
        auteur: 'Collab (validé)',
        changes: [{ champ: 'Progression', avant: (obj?.progression || 0) + '%', apres: requestData.progression + '%' }],
      }];

      await this.supabase.db.from('objectifs').update({
        progression: requestData.progression,
        historique,
      }).eq('id', req.objectif_id);
    }

    // Update request status
    const { data, error } = await this.supabase.db
      .from('objectif_requests').update({ statut: 'approuve' }).eq('id', id).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async refuse(id: string, motif_refus: string) {
    const { data, error } = await this.supabase.db
      .from('objectif_requests').update({ statut: 'refuse', motif_refus }).eq('id', id).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }
}
