import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { DatabaseService } from '../../config/database.service';

@Injectable()
export class AssignmentsService {
  constructor(private database: DatabaseService) {}

  private static readonly ALLOWED_FILTERS = ['mission_id', 'collaborateur_id', 'statut'] as const;

  async findAll(filters?: Record<string, string>) {
    try {
      let query = this.database.db
        .selectFrom('assignments')
        .selectAll('assignments')
        .select((eb) => [
          jsonObjectFrom(
            eb.selectFrom('missions')
              .select(['missions.id', 'missions.nom', 'missions.statut'])
              .select((eb2) => [
                jsonObjectFrom(
                  eb2.selectFrom('clients')
                    .select(['clients.id', 'clients.nom'])
                    .whereRef('clients.id', '=', 'missions.client_id'),
                ).as('clients'),
              ])
              .whereRef('missions.id', '=', 'assignments.mission_id'),
          ).as('missions'),
          jsonObjectFrom(
            eb.selectFrom('collaborateurs')
              .select(['id', 'prenom', 'nom', 'photo_url', 'poste'])
              .whereRef('collaborateurs.id', '=', 'assignments.collaborateur_id'),
          ).as('collaborateurs'),
        ])
        .orderBy('created_at', 'desc');

      if (filters) {
        for (const [col, val] of Object.entries(filters)) {
          if (val && (AssignmentsService.ALLOWED_FILTERS as readonly string[]).includes(col)) {
            query = query.where(`assignments.${col}` as any, '=', val);
          }
        }
      }
      return await query.execute();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur assignments', HttpStatus.INTERNAL_SERVER_ERROR);
    }
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
    const mission = await this.database.db
      .selectFrom('missions')
      .select(['id', 'date_fin', 'budget_vendu'])
      .select((eb) => [
        jsonArrayFrom(
          eb.selectFrom('assignments')
            .selectAll('assignments')
            .whereRef('assignments.mission_id', '=', 'missions.id'),
        ).as('assignments'),
      ])
      .where('id', '=', dto.mission_id)
      .executeTakeFirst();
    if (!mission || !mission.budget_vendu) return;
    const assignments = (mission as any).assignments || [];
    const others = assignments.filter((a: any) => a.id !== excludeId);
    const existing = others.reduce(
      (s: number, a: any) => s + this.assignmentCost(a, mission.date_fin as any),
      0,
    );
    let projected: any = dto;
    if (excludeId) {
      const current = assignments.find((a: any) => a.id === excludeId) || {};
      projected = { ...current, ...dto };
    }
    const projectedCost = this.assignmentCost(projected, mission.date_fin as any);
    const total = existing + projectedCost;
    if (total > Number(mission.budget_vendu)) {
      const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €';
      throw new HttpException(
        `Budget dépassé : cette affectation porterait le consommé à ${fmt(total)} (budget vendu ${fmt(Number(mission.budget_vendu))}). Ajustez le TJM, la durée ou le budget de la mission, ou ajoutez "force_over_budget": true pour forcer.`,
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
    try {
      return await this.database.db
        .insertInto('assignments')
        .values(insertDto as any)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur create assignment', HttpStatus.BAD_REQUEST);
    }
  }

  async update(id: string, dto: any) {
    this.validateAssignmentDto(dto);
    await this.validateBudget(dto, id);
    const { force_over_budget, ...updateDto } = dto || {};
    try {
      const row = await this.database.db
        .updateTable('assignments')
        .set(updateDto)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw new HttpException(`Assignment ${id} introuvable`, HttpStatus.NOT_FOUND);
      return row;
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(e.message ?? 'Erreur update assignment', HttpStatus.BAD_REQUEST);
    }
  }

  async delete(id: string) {
    const res = await this.database.db
      .deleteFrom('assignments')
      .where('id', '=', id)
      .executeTakeFirst();
    if (res.numDeletedRows === 0n) {
      throw new HttpException(`Assignment ${id} introuvable`, HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }
}
