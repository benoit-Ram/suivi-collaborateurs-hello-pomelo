import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class CollaborateursService {
  constructor(private supabase: SupabaseService) {}

  async findAll() {
    const { data, error } = await this.supabase.db
      .from('collaborateurs')
      .select('*, points_suivi(*), objectifs(*)');
    if (error) throw error;
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db
      .from('collaborateurs')
      .select('*, points_suivi(*), objectifs(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async create(dto: any) {
    const { data, error } = await this.supabase.db
      .from('collaborateurs')
      .insert(dto)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, dto: any) {
    const { data, error } = await this.supabase.db
      .from('collaborateurs')
      .update(dto)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabase.db
      .from('collaborateurs')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  }
}
