import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class ObjectifsService {
  constructor(private supabase: SupabaseService) {}

  async findAll(filters?: Record<string, string>) {
    let query = this.supabase.db.from('objectifs').select('*').order('created_at', { ascending: false });
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => { if (val) query = query.eq(key, val); });
    }
    const { data, error } = await query;
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db.from('objectifs').select('*').eq('id', id).single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async create(dto: any) {
    const { data, error } = await this.supabase.db.from('objectifs').insert(dto).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async update(id: string, dto: any) {
    const { data, error } = await this.supabase.db.from('objectifs').update(dto).eq('id', id).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabase.db.from('objectifs').delete().eq('id', id);
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return { success: true };
  }
}
