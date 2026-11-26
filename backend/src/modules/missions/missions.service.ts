import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';
import { DatabaseService } from '../../config/database.service';

@Injectable()
export class MissionsService {
  constructor(private database: DatabaseService) {}

  private static readonly ALLOWED_FILTERS = ['client_id', 'statut'] as const;

  async findAll(filters?: Record<string, string>) {
    try {
      let query = this.database.db
        .selectFrom('missions')
        .selectAll('missions')
        .select((eb) => [
          jsonObjectFrom(
            eb.selectFrom('clients')
              .select(['clients.id', 'clients.nom'])
              .whereRef('clients.id', '=', 'missions.client_id'),
          ).as('clients'),
          jsonArrayFrom(
            eb.selectFrom('assignments')
              .selectAll('assignments')
              .select((eb2) => [
                jsonObjectFrom(
                  eb2.selectFrom('collaborateurs')
                    .select(['id', 'prenom', 'nom', 'photo_url', 'poste'])
                    .whereRef('collaborateurs.id', '=', 'assignments.collaborateur_id'),
                ).as('collaborateurs'),
              ])
              .whereRef('assignments.mission_id', '=', 'missions.id'),
          ).as('assignments'),
        ])
        .orderBy('created_at', 'desc');

      if (filters) {
        for (const [col, val] of Object.entries(filters)) {
          if (val && (MissionsService.ALLOWED_FILTERS as readonly string[]).includes(col)) {
            query = query.where(`missions.${col}` as any, '=', val);
          }
        }
      }
      return await query.execute();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur missions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOne(id: string) {
    const row = await this.database.db
      .selectFrom('missions')
      .selectAll('missions')
      .select((eb) => [
        jsonObjectFrom(
          eb.selectFrom('clients')
            .select(['clients.id', 'clients.nom'])
            .whereRef('clients.id', '=', 'missions.client_id'),
        ).as('clients'),
        jsonArrayFrom(
          eb.selectFrom('assignments')
            .selectAll('assignments')
            .select((eb2) => [
              jsonObjectFrom(
                eb2.selectFrom('collaborateurs')
                  .select(['id', 'prenom', 'nom', 'photo_url', 'poste', 'equipe'])
                  .whereRef('collaborateurs.id', '=', 'assignments.collaborateur_id'),
              ).as('collaborateurs'),
            ])
            .whereRef('assignments.mission_id', '=', 'missions.id'),
        ).as('assignments'),
      ])
      .where('missions.id', '=', id)
      .executeTakeFirst();
    if (!row) throw new HttpException(`Mission ${id} introuvable`, HttpStatus.NOT_FOUND);
    return row;
  }

  async create(dto: any) {
    try {
      return await this.database.db
        .insertInto('missions')
        .values(dto as any)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur create mission', HttpStatus.BAD_REQUEST);
    }
  }

  async update(id: string, dto: any) {
    try {
      const row = await this.database.db
        .updateTable('missions')
        .set(dto)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw new HttpException(`Mission ${id} introuvable`, HttpStatus.NOT_FOUND);
      return row;
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(e.message ?? 'Erreur update mission', HttpStatus.BAD_REQUEST);
    }
  }

  async delete(id: string) {
    // Block deletion if any time entries are attached (via assignments cascade)
    const assignments = await this.database.db
      .selectFrom('assignments')
      .select('id')
      .where('mission_id', '=', id)
      .execute();
    const assignmentIds = assignments.map((a) => a.id);
    if (assignmentIds.length > 0) {
      const { count } = await this.database.db
        .selectFrom('time_entries')
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .where('assignment_id', 'in', assignmentIds)
        .executeTakeFirst() ?? { count: 0 };
      const n = Number(count) || 0;
      if (n > 0) {
        throw new HttpException(
          `Impossible de supprimer : ${n} saisie(s) de temps existe(nt) sur cette mission. Archivez-la (statut "terminée") plutôt que de la supprimer.`,
          HttpStatus.CONFLICT,
        );
      }
    }
    const res = await this.database.db
      .deleteFrom('missions')
      .where('id', '=', id)
      .executeTakeFirst();
    if (res.numDeletedRows === 0n) {
      throw new HttpException(`Mission ${id} introuvable`, HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }
}
