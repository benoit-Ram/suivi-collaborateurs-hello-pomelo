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

  private isEntretienMensuelLocked(mois: string | null | undefined): boolean {
    if (!mois) return false;
    const [year, month] = mois.split('-').map(Number);
    // Verrouillé à partir du 5 du mois suivant (mois est 1-12; Date(year, month, 5) = jour 5 du mois +1)
    return new Date() >= new Date(year, month, 5);
  }

  async update(id: string, dto: any) {
    const { data: current, error: fetchErr } = await this.supabase.db.from('points_suivi').select('mois, type').eq('id', id).single();
    if (fetchErr) throw new HttpException(fetchErr.message, HttpStatus.NOT_FOUND);
    if (current?.type === 'mensuel' && this.isEntretienMensuelLocked(current.mois)) {
      throw new HttpException(
        `Cet entretien mensuel est verrouillé (au-delà du 5 du mois suivant). Les retours ne sont plus modifiables.`,
        HttpStatus.FORBIDDEN,
      );
    }
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
