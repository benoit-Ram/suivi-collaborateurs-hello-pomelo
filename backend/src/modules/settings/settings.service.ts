import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class SettingsService {
  constructor(private supabase: SupabaseService) {}

  async findAll(filters?: Record<string, string>) {
    let query = this.supabase.db.from('settings').select('*').order('created_at', { ascending: false });
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => { if (val) query = query.eq(key, val); });
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db.from('settings').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async create(dto: any) {
    const { data, error } = await this.supabase.db.from('settings').insert(dto).select().single();
    if (error) throw error;
    return data;
  }

  async update(id: string, dto: any) {
    const { data, error } = await this.supabase.db.from('settings').update(dto).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabase.db.from('settings').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  }
}
