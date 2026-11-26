import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { DatabaseService } from '../../config/database.service';

@Injectable()
export class StaffingRequestsService {
  constructor(private database: DatabaseService) {}

  async findAll(filters?: Record<string, string>) {
    try {
      let query = this.database.db
        .selectFrom('staffing_requests')
        .selectAll('staffing_requests')
        .select((eb) => [
          jsonObjectFrom(
            eb.selectFrom('missions')
              .select(['missions.id', 'missions.nom', 'missions.client'])
              .select((eb2) => [
                jsonObjectFrom(
                  eb2.selectFrom('clients')
                    .select(['clients.id', 'clients.nom'])
                    .whereRef('clients.id', '=', 'missions.client_id'),
                ).as('clients'),
              ])
              .whereRef('missions.id', '=', 'staffing_requests.mission_id'),
          ).as('missions'),
          jsonObjectFrom(
            eb.selectFrom('collaborateurs')
              .select(['id', 'prenom', 'nom', 'photo_url', 'poste', 'equipe', 'bureau', 'competences'])
              .whereRef('collaborateurs.id', '=', 'staffing_requests.collaborateur_id'),
          ).as('collaborateurs'),
          jsonObjectFrom(
            eb.selectFrom('collaborateurs')
              .select(['id', 'prenom', 'nom'])
              .whereRef('collaborateurs.id', '=', 'staffing_requests.demandeur_id'),
          ).as('demandeurs'),
        ])
        .orderBy('created_at', 'desc');

      if (filters?.demandeur_id) query = query.where('staffing_requests.demandeur_id', '=', filters.demandeur_id);
      if (filters?.statut) query = query.where('staffing_requests.statut', '=', filters.statut);
      if (filters?.mission_id) query = query.where('staffing_requests.mission_id', '=', filters.mission_id);
      return await query.execute();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur staffing_requests', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async create(dto: any) {
    try {
      return await this.database.db
        .insertInto('staffing_requests')
        .values(dto as any)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur create staffing_request', HttpStatus.BAD_REQUEST);
    }
  }

  /** Transition atomique en_attente → approuve, puis création assignment. */
  async approve(id: string) {
    // Atomic guard : UPDATE ... WHERE statut='en_attente' AND id=:id.
    // Si quelqu'un d'autre a déjà passé la ligne à "approuve", notre UPDATE affectera 0 rows.
    const req = await this.database.db
      .updateTable('staffing_requests')
      .set({ statut: 'approuve' })
      .where('id', '=', id)
      .where('statut', '=', 'en_attente')
      .returningAll()
      .executeTakeFirst();
    if (!req) {
      throw new HttpException('Demande déjà traitée ou introuvable', HttpStatus.CONFLICT);
    }

    try {
      const jps = Number(req.jours_par_semaine) || 5;
      await this.database.db
        .insertInto('assignments')
        .values({
          mission_id: req.mission_id,
          collaborateur_id: req.collaborateur_id,
          role: req.role,
          jours_par_semaine: jps,
          taux_staffing: Math.round((jps / 5) * 100),
          date_debut: req.date_debut,
          date_fin: req.date_fin,
          statut: 'actif',
        } as any)
        .execute();
      return req;
    } catch (e: any) {
      // Rollback de la transition pour laisser la demande ré-approvable
      await this.database.db
        .updateTable('staffing_requests')
        .set({ statut: 'en_attente' })
        .where('id', '=', id)
        .execute();
      throw new HttpException(e.message ?? 'Erreur création assignment', HttpStatus.BAD_REQUEST);
    }
  }

  async refuse(id: string, motif_refus: string) {
    try {
      const row = await this.database.db
        .updateTable('staffing_requests')
        .set({ statut: 'refuse', motif_refus })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw new HttpException(`Staffing request ${id} introuvable`, HttpStatus.NOT_FOUND);
      return row;
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(e.message ?? 'Erreur refuse staffing_request', HttpStatus.BAD_REQUEST);
    }
  }
}
