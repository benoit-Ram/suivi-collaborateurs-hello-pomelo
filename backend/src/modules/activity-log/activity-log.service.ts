import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class ActivityLogService {
  constructor(private supabase: SupabaseService) {}

  async findAll(limit = 50) {
    const { data, error } = await this.supabase.db
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return data;
  }

  async create(dto: any) {
    const { data, error } = await this.supabase.db
      .from('activity_log')
      .insert(dto)
      .select()
      .single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }
}
