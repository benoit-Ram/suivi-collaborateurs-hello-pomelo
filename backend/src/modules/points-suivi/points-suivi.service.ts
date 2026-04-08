import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class PointsSuiviService {
  constructor(private supabase: SupabaseService) {}

  private static readonly ALLOWED_FILTERS = ['collaborateur_id', 'mois', 'type'];

  async findAll(filters?: Record<string, string>) {
    let query = this.supabase.db.from('points_suivi').select('*').order('created_at', { ascending: false });
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => { if (val && PointsSuiviService.ALLOWED_FILTERS.includes(key)) query = query.eq(key, val); });
    }
    const { data, error } = await query;
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db.from('points_suivi').select('*').eq('id', id).single();
    if (error) throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    return data;
  }

  async create(dto: any) {
    const { data, error } = await this.supabase.db.from('points_suivi').insert(dto).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async update(id: string, dto: any) {
    const { data, error } = await this.supabase.db.from('points_suivi').update(dto).eq('id', id).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabase.db.from('points_suivi').delete().eq('id', id);
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return { success: true };
  }
}
