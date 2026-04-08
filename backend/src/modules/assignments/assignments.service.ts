import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class AssignmentsService {
  constructor(private supabase: SupabaseService) {}

  private static readonly ALLOWED_FILTERS = ['mission_id', 'collaborateur_id', 'statut'];

  async findAll(filters?: Record<string, string>) {
    let query = this.supabase.db.from('assignments').select('*, missions:mission_id(id, nom, statut, clients:client_id(id, nom)), collaborateurs:collaborateur_id(id, prenom, nom, photo_url, poste)').order('created_at', { ascending: false });
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => { if (val && AssignmentsService.ALLOWED_FILTERS.includes(key)) query = query.eq(key, val); });
    }
    const { data, error } = await query;
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return data;
  }

  async create(dto: any) {
    const { data, error } = await this.supabase.db.from('assignments').insert(dto).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async update(id: string, dto: any) {
    const { data, error } = await this.supabase.db.from('assignments').update(dto).eq('id', id).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabase.db.from('assignments').delete().eq('id', id);
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return { success: true };
  }
}
