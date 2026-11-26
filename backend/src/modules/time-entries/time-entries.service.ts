import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { DatabaseService } from '../../config/database.service';

@Injectable()
export class TimeEntriesService {
  constructor(private database: DatabaseService) {}

  private static readonly ALLOWED_FILTERS = ['assignment_id', 'collaborateur_id', 'date'] as const;

  async findAll(filters?: Record<string, string>) {
    try {
      let query = this.database.db
        .selectFrom('time_entries')
        .selectAll('time_entries')
        .select((eb) => [
          jsonObjectFrom(
            eb.selectFrom('assignments')
              .selectAll('assignments')
              .select((eb2) => [
                jsonObjectFrom(
                  eb2.selectFrom('missions')
                    .select(['missions.id', 'missions.nom'])
                    .select((eb3) => [
                      jsonObjectFrom(
                        eb3.selectFrom('clients')
                          .select(['clients.id', 'clients.nom'])
                          .whereRef('clients.id', '=', 'missions.client_id'),
                      ).as('clients'),
                    ])
                    .whereRef('missions.id', '=', 'assignments.mission_id'),
                ).as('missions'),
              ])
              .whereRef('assignments.id', '=', 'time_entries.assignment_id'),
          ).as('assignments'),
        ])
        .orderBy('date', 'desc');

      if (filters) {
        for (const [col, val] of Object.entries(filters)) {
          if (val && (TimeEntriesService.ALLOWED_FILTERS as readonly string[]).includes(col)) {
            query = query.where(`time_entries.${col}` as any, '=', val);
          }
        }
      }
      return await query.execute();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur time_entries', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOne(id: string) {
    const row = await this.database.db
      .selectFrom('time_entries')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) throw new HttpException(`Time entry ${id} introuvable`, HttpStatus.NOT_FOUND);
    return row;
  }

  async create(dto: any) {
    try {
      return await this.database.db
        .insertInto('time_entries')
        .values(dto as any)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur create time_entry', HttpStatus.BAD_REQUEST);
    }
  }

  async update(id: string, dto: any) {
    try {
      const row = await this.database.db
        .updateTable('time_entries')
        .set(dto)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw new HttpException(`Time entry ${id} introuvable`, HttpStatus.NOT_FOUND);
      return row;
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(e.message ?? 'Erreur update time_entry', HttpStatus.BAD_REQUEST);
    }
  }
}
