import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { DatabaseService } from '../../config/database.service';

@Injectable()
export class ObjectifRequestsService {
  constructor(private database: DatabaseService) {}

  async findAll(filters?: Record<string, string>) {
    try {
      let query = this.database.db
        .selectFrom('objectif_requests')
        .selectAll('objectif_requests')
        .select((eb) => [
          jsonObjectFrom(
            eb.selectFrom('objectifs')
              .select(['objectifs.id', 'objectifs.titre', 'objectifs.progression', 'objectifs.statut', 'objectifs.collaborateur_id'])
              .whereRef('objectifs.id', '=', 'objectif_requests.objectif_id'),
          ).as('objectifs'),
          jsonObjectFrom(
            eb.selectFrom('collaborateurs')
              .select(['id', 'prenom', 'nom', 'photo_url'])
              .whereRef('collaborateurs.id', '=', 'objectif_requests.collaborateur_id'),
          ).as('collaborateurs'),
        ])
        .orderBy('created_at', 'desc');

      if (filters?.collaborateur_id) query = query.where('objectif_requests.collaborateur_id', '=', filters.collaborateur_id);
      if (filters?.statut) query = query.where('objectif_requests.statut', '=', filters.statut);
      if (filters?.manager_id) query = query.where('objectif_requests.manager_id', '=', filters.manager_id);
      return await query.execute();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur objectif_requests', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async create(dto: any) {
    try {
      return await this.database.db
        .insertInto('objectif_requests')
        .values(dto as any)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur create objectif_request', HttpStatus.BAD_REQUEST);
    }
  }

  async approve(id: string) {
    const req = await this.database.db
      .selectFrom('objectif_requests')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!req) throw new HttpException('Demande non trouvée', HttpStatus.NOT_FOUND);
    if (req.statut !== 'en_attente') throw new HttpException('Demande déjà traitée', HttpStatus.BAD_REQUEST);

    const requestData: any = req.data || {};

    // Update the objectif progression
    if (requestData.progression !== undefined && req.objectif_id) {
      const obj = await this.database.db
        .selectFrom('objectifs')
        .select(['progression', 'historique'])
        .where('id', '=', req.objectif_id)
        .executeTakeFirst();

      const historique = [
        ...((obj?.historique as any[]) || []),
        {
          date: new Date().toISOString().split('T')[0],
          auteur: 'Collab (validé)',
          changes: [{ champ: 'Progression', avant: (obj?.progression || 0) + '%', apres: requestData.progression + '%' }],
        },
      ];

      await this.database.db
        .updateTable('objectifs')
        .set({
          progression: requestData.progression,
          historique,
        })
        .where('id', '=', req.objectif_id)
        .execute();
    }

    try {
      const row = await this.database.db
        .updateTable('objectif_requests')
        .set({ statut: 'approuve' })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return row;
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur approve objectif_request', HttpStatus.BAD_REQUEST);
    }
  }

  async refuse(id: string, motif_refus: string) {
    try {
      const row = await this.database.db
        .updateTable('objectif_requests')
        .set({ statut: 'refuse', motif_refus })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw new HttpException(`Demande ${id} introuvable`, HttpStatus.NOT_FOUND);
      return row;
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(e.message ?? 'Erreur refuse objectif_request', HttpStatus.BAD_REQUEST);
    }
  }
}
