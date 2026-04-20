import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

// Fields that a non-admin user should never see on other collaborateurs.
// Kept for self or admins; redacted otherwise.
const SENSITIVE_FIELDS = ['notes', 'solde_conges', 'solde_rtt', 'acquisition_conges', 'solde_reference_date', 'cycle_conges_debut', 'date_fin_essai', 'is_admin', 'missions_access'] as const;

// Fields a collab cannot write on themselves (admin-only fields).
const ADMIN_ONLY_WRITE_FIELDS = ['is_admin', 'missions_access', 'solde_conges', 'solde_rtt', 'acquisition_conges', 'solde_reference_date', 'manager_id', 'valideur_conges_id', 'date_entree', 'date_fin_essai', 'contrat', 'type_poste', 'groupe_entretien', 'cycle_conges_debut'] as const;

function redactCollab(collab: any, requester: any): any {
  if (!collab) return collab;
  if (requester?.isAdmin) return collab;
  if (collab.id === requester?.sub) return collab; // self sees everything
  const redacted: any = { ...collab };
  SENSITIVE_FIELDS.forEach(f => { delete redacted[f]; });
  return redacted;
}

@Injectable()
export class CollaborateursService {
  constructor(private supabase: SupabaseService) {}

  async findAll(requester?: any) {
    const { data, error } = await this.supabase.db
      .from('collaborateurs')
      .select('*, points_suivi(*), objectifs(*)');
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return (data || []).map(c => redactCollab(c, requester));
  }

  async findOne(id: string, requester?: any) {
    const { data, error } = await this.supabase.db
      .from('collaborateurs')
      .select('*, points_suivi(*), objectifs(*)')
      .eq('id', id)
      .single();
    if (error) throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    return redactCollab(data, requester);
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

  async update(id: string, dto: any, requester?: any) {
    if (!requester?.isAdmin) {
      // Non-admin: must be self, with restricted field set
      if (requester?.sub !== id) {
        throw new HttpException('Vous ne pouvez modifier que votre propre profil.', HttpStatus.FORBIDDEN);
      }
      // Strip admin-only fields
      ADMIN_ONLY_WRITE_FIELDS.forEach(f => { if (f in dto) delete dto[f]; });
    } else if (!requester?.isSuperAdmin) {
      // Admin (not super): cannot grant is_admin
      if ('is_admin' in dto) delete dto.is_admin;
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
