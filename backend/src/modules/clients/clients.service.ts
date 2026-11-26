import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { DatabaseService } from '../../config/database.service';

@Injectable()
export class ClientsService {
  constructor(private database: DatabaseService) {}

  private static readonly ALLOWED_FILTERS = ['nom', 'statut'] as const;

  async findAll(filters?: Record<string, string>) {
    try {
      let query = this.database.db
        .selectFrom('clients')
        .selectAll()
        .select((eb) => [
          jsonArrayFrom(
            eb.selectFrom('missions')
              .select(['id', 'nom', 'statut', 'date_debut', 'date_fin'])
              .whereRef('missions.client_id', '=', 'clients.id'),
          ).as('missions'),
        ])
        .orderBy('clients.nom', 'asc');

      if (filters) {
        for (const [col, val] of Object.entries(filters)) {
          if (val && (ClientsService.ALLOWED_FILTERS as readonly string[]).includes(col)) {
            query = query.where(`clients.${col}` as any, '=', val);
          }
        }
      }
      return await query.execute();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur clients', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOne(id: string) {
    const row = await this.database.db
      .selectFrom('clients')
      .selectAll()
      .select((eb) => [
        // Missions du client + pour chacune, ses assignments + le collaborateur
        jsonArrayFrom(
          eb.selectFrom('missions')
            .selectAll('missions')
            .select((eb2) => [
              jsonArrayFrom(
                eb2.selectFrom('assignments')
                  .selectAll('assignments')
                  .select((eb3) => [
                    eb3.selectFrom('collaborateurs')
                      .select(['id', 'prenom', 'nom', 'photo_url', 'poste'])
                      .whereRef('collaborateurs.id', '=', 'assignments.collaborateur_id')
                      .limit(1)
                      .as('collaborateurs'),
                  ])
                  .whereRef('assignments.mission_id', '=', 'missions.id'),
              ).as('assignments'),
            ])
            .whereRef('missions.client_id', '=', 'clients.id'),
        ).as('missions'),
      ])
      .where('clients.id', '=', id)
      .executeTakeFirst();

    if (!row) throw new HttpException(`Client ${id} introuvable`, HttpStatus.NOT_FOUND);
    return row;
  }

  async create(dto: any) {
    if (!dto?.nom) throw new HttpException('nom requis', HttpStatus.BAD_REQUEST);
    try {
      return await this.database.db
        .insertInto('clients')
        .values(dto as any)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur create client', HttpStatus.BAD_REQUEST);
    }
  }

  async update(id: string, dto: any) {
    try {
      const row = await this.database.db
        .updateTable('clients')
        .set(dto)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw new HttpException(`Client ${id} introuvable`, HttpStatus.NOT_FOUND);
      return row;
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(e.message ?? 'Erreur update client', HttpStatus.BAD_REQUEST);
    }
  }

  async delete(id: string) {
    const res = await this.database.db
      .deleteFrom('clients')
      .where('id', '=', id)
      .executeTakeFirst();
    if (res.numDeletedRows === 0n) {
      throw new HttpException(`Client ${id} introuvable`, HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }
}
