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

  private assignmentCost(a: any, missionFin?: string | null): number {
    if (!a || !a.date_debut || !a.tjm) return 0;
    const start = new Date(a.date_debut);
    const endSrc = a.date_fin || missionFin || new Date().toISOString().split('T')[0];
    const end = new Date(endSrc);
    const weeks = Math.max(0, (end.getTime() - start.getTime()) / (7 * 86400000));
    const jps = Number(a.jours_par_semaine) || ((Number(a.taux_staffing) || 0) / 100) * 5 || 5;
    return Number(a.tjm) * jps * weeks;
  }

  private async validateBudget(dto: any, excludeId?: string) {
    if (!dto || !dto.mission_id || dto.force_over_budget) return;
    const { data: mission } = await this.supabase.db.from('missions').select('id, date_fin, budget_vendu, assignments(*)').eq('id', dto.mission_id).single();
    if (!mission || !mission.budget_vendu) return;
    const others = ((mission as any).assignments || []).filter((a: any) => a.id !== excludeId);
    const existing = others.reduce((s: number, a: any) => s + this.assignmentCost(a, (mission as any).date_fin), 0);
    // For update, merge existing row with new fields to compute projected cost
    let projected: any = dto;
    if (excludeId) {
      const current = ((mission as any).assignments || []).find((a: any) => a.id === excludeId) || {};
      projected = { ...current, ...dto };
    }
    const projectedCost = this.assignmentCost(projected, (mission as any).date_fin);
    const total = existing + projectedCost;
    if (total > Number((mission as any).budget_vendu)) {
      const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €';
      throw new HttpException(
        `Budget dépassé : cette affectation porterait le consommé à ${fmt(total)} (budget vendu ${fmt(Number((mission as any).budget_vendu))}). Ajustez le TJM, la durée ou le budget de la mission, ou ajoutez "force_over_budget": true pour forcer.`,
        HttpStatus.CONFLICT,
      );
    }
  }

  private validateAssignmentDto(dto: any): void {
    if (!dto) return;
    if (dto.tjm !== undefined && dto.tjm !== null) {
      const tjm = Number(dto.tjm);
      if (!Number.isFinite(tjm) || tjm < 0 || tjm > 5000) {
        throw new HttpException('TJM doit être compris entre 0 et 5000 €.', HttpStatus.BAD_REQUEST);
      }
    }
    if (dto.jours_par_semaine !== undefined && dto.jours_par_semaine !== null) {
      const jps = Number(dto.jours_par_semaine);
      if (!Number.isFinite(jps) || jps < 0 || jps > 5) {
        throw new HttpException('Jours par semaine doit être entre 0 et 5.', HttpStatus.BAD_REQUEST);
      }
    }
    if (dto.taux_staffing !== undefined && dto.taux_staffing !== null) {
      const t = Number(dto.taux_staffing);
      if (!Number.isFinite(t) || t < 0 || t > 100) {
        throw new HttpException('Taux de staffing doit être entre 0 et 100.', HttpStatus.BAD_REQUEST);
      }
    }
    if (dto.date_debut && dto.date_fin && dto.date_fin < dto.date_debut) {
      throw new HttpException('Date de fin antérieure à la date de début.', HttpStatus.BAD_REQUEST);
    }
  }

  async create(dto: any) {
    this.validateAssignmentDto(dto);
    await this.validateBudget(dto);
    const { force_over_budget, ...insertDto } = dto || {};
    const { data, error } = await this.supabase.db.from('assignments').insert(insertDto).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async update(id: string, dto: any) {
    this.validateAssignmentDto(dto);
    await this.validateBudget(dto, id);
    const { force_over_budget, ...updateDto } = dto || {};
    const { data, error } = await this.supabase.db.from('assignments').update(updateDto).eq('id', id).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabase.db.from('assignments').delete().eq('id', id);
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return { success: true };
  }
}
