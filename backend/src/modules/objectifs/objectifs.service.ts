import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../../config/database.service';
import { getPeriodeInfo, Recurrence } from './objectifs.recurrence';

@Injectable()
export class ObjectifsService {
  private readonly logger = new Logger(ObjectifsService.name);
  constructor(private database: DatabaseService) {}

  private static readonly ALLOWED_FILTERS = ['collaborateur_id', 'statut', 'type'] as const;

  async findAll(filters?: Record<string, string>) {
    try {
      let query = this.database.db
        .selectFrom('objectifs')
        .selectAll()
        .orderBy('created_at', 'desc');
      if (filters) {
        for (const [col, val] of Object.entries(filters)) {
          if (val && (ObjectifsService.ALLOWED_FILTERS as readonly string[]).includes(col)) {
            query = query.where(col as any, '=', val);
          }
        }
      }
      return await query.execute();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur objectifs', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOne(id: string) {
    const row = await this.database.db
      .selectFrom('objectifs')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) throw new HttpException(`Objectif ${id} introuvable`, HttpStatus.NOT_FOUND);
    return row;
  }

  async create(dto: any, requester?: any) {
    await this.assertCanEdit(dto?.collaborateur_id, requester);
    this.validateObjectifDto(dto);
    let data: any;
    try {
      data = await this.database.db
        .insertInto('objectifs')
        .values(dto as any)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur create objectif', HttpStatus.BAD_REQUEST);
    }
    // If this is a recurrent template, create the first instance immediately
    if (data?.recurrence && !data.parent_id) {
      try { await this.ensureInstanceForPeriod(data, new Date()); }
      catch (e) { this.logger.warn(`Failed to seed first recurrent instance for ${data.id}: ${(e as Error).message}`); }
    }
    return data;
  }

  async update(id: string, dto: any, requester?: any) {
    this.validateObjectifDto(dto);
    if (requester && !requester.isAdmin) {
      const existing = await this.database.db
        .selectFrom('objectifs')
        .select('collaborateur_id')
        .where('id', '=', id)
        .executeTakeFirst();
      await this.assertCanEdit(existing?.collaborateur_id, requester);
    }
    try {
      const row = await this.database.db
        .updateTable('objectifs')
        .set(dto)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw new HttpException(`Objectif ${id} introuvable`, HttpStatus.NOT_FOUND);
      return row;
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(e.message ?? 'Erreur update objectif', HttpStatus.BAD_REQUEST);
    }
  }

  async delete(id: string, requester?: any) {
    if (requester && !requester.isAdmin) {
      const existing = await this.database.db
        .selectFrom('objectifs')
        .select('collaborateur_id')
        .where('id', '=', id)
        .executeTakeFirst();
      await this.assertCanEdit(existing?.collaborateur_id, requester);
    }
    const res = await this.database.db
      .deleteFrom('objectifs')
      .where('id', '=', id)
      .executeTakeFirst();
    if (res.numDeletedRows === 0n) {
      throw new HttpException(`Objectif ${id} introuvable`, HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  /** Throws 403 unless requester is admin, or is the direct manager of `collabId`. */
  private async assertCanEdit(collabId: string | undefined, requester: any): Promise<void> {
    if (!requester) return; // internal calls (e.g. cron) bypass
    if (requester.isAdmin) return;
    if (!collabId) throw new HttpException('collaborateur_id requis.', HttpStatus.BAD_REQUEST);
    const collab = await this.database.db
      .selectFrom('collaborateurs')
      .select('manager_id')
      .where('id', '=', collabId)
      .executeTakeFirst();
    if (collab?.manager_id === requester.sub) return;
    throw new HttpException('Vous ne pouvez gérer que les objectifs de vos managés directs.', HttpStatus.FORBIDDEN);
  }

  private validateObjectifDto(dto: any): void {
    if (!dto) return;
    if (dto.progression !== undefined && dto.progression !== null) {
      const p = Number(dto.progression);
      if (!Number.isFinite(p) || p < 0 || p > 100) {
        throw new HttpException('Progression doit être entre 0 et 100.', HttpStatus.BAD_REQUEST);
      }
    }
    if (dto.recurrence && !['hebdo', 'mensuel'].includes(dto.recurrence)) {
      throw new HttpException('Récurrence invalide.', HttpStatus.BAD_REQUEST);
    }
    if (dto.statut && !['en-cours', 'atteint', 'non-atteint', 'en-attente'].includes(dto.statut)) {
      throw new HttpException('Statut d\'objectif invalide.', HttpStatus.BAD_REQUEST);
    }
    if (dto.date_debut && dto.date_fin && dto.date_fin < dto.date_debut) {
      throw new HttpException('Date de fin antérieure à la date de début.', HttpStatus.BAD_REQUEST);
    }
  }

  /** Create an instance for `template` matching the period containing `now`, if it doesn't already exist. */
  private async ensureInstanceForPeriod(template: any, now: Date): Promise<boolean> {
    if (!template?.id || !template.recurrence || !['hebdo', 'mensuel'].includes(template.recurrence)) return false;
    const info = getPeriodeInfo(template.recurrence as Recurrence, now);
    const existing = await this.database.db
      .selectFrom('objectifs')
      .select('id')
      .where('parent_id', '=', template.id)
      .where('periode', '=', info.periode)
      .executeTakeFirst();
    if (existing) return false;
    const today = now.toISOString().split('T')[0];
    const row = {
      collaborateur_id: template.collaborateur_id,
      titre: (template.titre || '') + info.titreSuffix,
      description: template.description || null,
      date_debut: info.dateDebut,
      date_fin: info.dateFin,
      statut: 'en-cours',
      progression: 0,
      recurrence: null,
      parent_id: template.id,
      periode: info.periode,
      historique: [{ date: today, auteur: 'Auto', changes: [{ champ: 'Création automatique', avant: '', apres: `Instance ${info.periode} de l'objectif récurrent` }] }],
    };
    try {
      await this.database.db.insertInto('objectifs').values(row as any).execute();
      return true;
    } catch (e: any) {
      // 23505 = unique-violation (race condition acceptable)
      if (e?.code === '23505') return false;
      throw new Error(e?.message ?? 'Erreur ensureInstanceForPeriod');
    }
  }

  /** Scan active recurrent templates and create missing instances for the current period. */
  private async generateMissingInstances(recurrence: Recurrence): Promise<number> {
    const templates = await this.database.db
      .selectFrom('objectifs')
      .selectAll()
      .where('recurrence', '=', recurrence)
      .where('parent_id', 'is', null)
      .where('statut', '!=', 'atteint')
      .execute();
    let created = 0;
    for (const tpl of templates) {
      try {
        if (await this.ensureInstanceForPeriod(tpl, new Date())) created++;
      } catch (e) {
        this.logger.warn(`Skipping template ${tpl.id}: ${(e as Error).message}`);
      }
    }
    return created;
  }

  // Hebdo: every Monday at 00:05 Europe/Paris
  @Cron('0 5 0 * * 1', { timeZone: 'Europe/Paris' })
  async cronHebdo() {
    this.logger.log('Running hebdo recurrent objectifs cron...');
    const n = await this.generateMissingInstances('hebdo');
    this.logger.log(`Created ${n} hebdo instance(s).`);
  }

  // Mensuel: 1st of each month at 00:10 Europe/Paris
  @Cron('0 10 0 1 * *', { timeZone: 'Europe/Paris' })
  async cronMensuel() {
    this.logger.log('Running mensuel recurrent objectifs cron...');
    const n = await this.generateMissingInstances('mensuel');
    this.logger.log(`Created ${n} mensuel instance(s).`);
  }
}
