import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class MissionsService {
  constructor(private supabase: SupabaseService) {}

  private static readonly ALLOWED_FILTERS = ['client_id', 'statut'];

  async findAll(filters?: Record<string, string>) {
    let query = this.supabase.db.from('missions').select('*, clients:client_id(id, nom), assignments(*, collaborateurs:collaborateur_id(id, prenom, nom, photo_url, poste))').order('created_at', { ascending: false });
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => { if (val && MissionsService.ALLOWED_FILTERS.includes(key)) query = query.eq(key, val); });
    }
    const { data, error } = await query;
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db.from('missions').select('*, clients:client_id(id, nom), assignments(*, collaborateurs:collaborateur_id(id, prenom, nom, photo_url, poste, equipe))').eq('id', id).single();
    if (error) throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    return data;
  }

  async create(dto: any) {
    const { data, error } = await this.supabase.db.from('missions').insert(dto).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async update(id: string, dto: any) {
    const { data, error } = await this.supabase.db.from('missions').update(dto).eq('id', id).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async delete(id: string) {
    // Block deletion if any time entries are attached (via assignments cascade)
    const { data: assignments } = await this.supabase.db.from('assignments').select('id').eq('mission_id', id);
    const assignmentIds = (assignments || []).map(a => a.id);
    if (assignmentIds.length > 0) {
      const { count } = await this.supabase.db.from('time_entries').select('id', { count: 'exact', head: true }).in('assignment_id', assignmentIds);
      if (count && count > 0) {
        throw new HttpException(
          `Impossible de supprimer : ${count} saisie(s) de temps existe(nt) sur cette mission. Archivez-la (statut "terminée") plutôt que de la supprimer.`,
          HttpStatus.CONFLICT,
        );
      }
    }
    const { error } = await this.supabase.db.from('missions').delete().eq('id', id);
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return { success: true };
  }
}
