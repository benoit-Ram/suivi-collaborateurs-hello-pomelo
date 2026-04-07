import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class ClientsService {
  constructor(private supabase: SupabaseService) {}

  async findAll(filters?: Record<string, string>) {
    let query = this.supabase.db.from('clients').select('*, missions(id, nom, statut, date_debut, date_fin)').order('nom', { ascending: true });
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => { if (val) query = query.eq(key, val); });
    }
    const { data, error } = await query;
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db.from('clients').select('*, missions(*, assignments(*, collaborateurs:collaborateur_id(id, prenom, nom, photo_url, poste)))').eq('id', id).single();
    if (error) throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    return data;
  }

  async create(dto: any) {
    const { data, error } = await this.supabase.db.from('clients').insert(dto).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async update(id: string, dto: any) {
    const { data, error } = await this.supabase.db.from('clients').update(dto).eq('id', id).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabase.db.from('clients').delete().eq('id', id);
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return { success: true };
  }
}
