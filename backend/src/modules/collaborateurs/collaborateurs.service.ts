import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class CollaborateursService {
  constructor(private supabase: SupabaseService) {}

  async findAll() {
    const { data, error } = await this.supabase.db
      .from('collaborateurs')
      .select('*, points_suivi(*), objectifs(*)');
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db
      .from('collaborateurs')
      .select('*, points_suivi(*), objectifs(*)')
      .eq('id', id)
      .single();
    if (error) throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    return data;
  }

  async create(dto: any) {
    const { data, error } = await this.supabase.db
      .from('collaborateurs')
      .insert(dto)
      .select()
      .single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async update(id: string, dto: any, requestUser?: any) {
    // Block is_admin field unless super admin
    if ('is_admin' in dto && !requestUser?.isSuperAdmin) {
      delete dto.is_admin;
    }
    const { data, error } = await this.supabase.db
      .from('collaborateurs')
      .update(dto)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabase.db
      .from('collaborateurs')
      .delete()
      .eq('id', id);
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return { success: true };
  }
}
