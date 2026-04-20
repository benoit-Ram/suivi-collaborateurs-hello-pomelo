import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../../config/supabase.service';
import { getPeriodeInfo, Recurrence } from './objectifs.recurrence';

@Injectable()
export class ObjectifsService {
  private readonly logger = new Logger(ObjectifsService.name);
  constructor(private supabase: SupabaseService) {}

  private static readonly ALLOWED_FILTERS = ['collaborateur_id', 'statut', 'type'];

  async findAll(filters?: Record<string, string>) {
    let query = this.supabase.db.from('objectifs').select('*').order('created_at', { ascending: false });
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => { if (val && ObjectifsService.ALLOWED_FILTERS.includes(key)) query = query.eq(key, val); });
    }
    const { data, error } = await query;
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db.from('objectifs').select('*').eq('id', id).single();
    if (error) throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    return data;
  }

  async create(dto: any, requester?: any) {
    await this.assertCanEdit(dto?.collaborateur_id, requester);
    this.validateObjectifDto(dto);
    const { data, error } = await this.supabase.db.from('objectifs').insert(dto).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    // If this is a recurrent template (has recurrence, no parent), create the first instance immediately
    if (data?.recurrence && !data.parent_id) {
      try { await this.ensureInstanceForPeriod(data, new Date()); }
      catch (e) { this.logger.warn(`Failed to seed first recurrent instance for ${data.id}: ${(e as Error).message}`); }
    }
    return data;
  }

  async update(id: string, dto: any, requester?: any) {
    this.validateObjectifDto(dto);
    if (requester && !requester.isAdmin) {
      const { data: existing } = await this.supabase.db.from('objectifs').select('collaborateur_id').eq('id', id).single();
      await this.assertCanEdit(existing?.collaborateur_id, requester);
    }
    const { data, error } = await this.supabase.db.from('objectifs').update(dto).eq('id', id).select().single();
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return data;
  }

  async delete(id: string, requester?: any) {
    if (requester && !requester.isAdmin) {
      const { data: existing } = await this.supabase.db.from('objectifs').select('collaborateur_id').eq('id', id).single();
      await this.assertCanEdit(existing?.collaborateur_id, requester);
    }
    const { error } = await this.supabase.db.from('objectifs').delete().eq('id', id);
    if (error) throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    return { success: true };
  }

  /** Throws 403 unless requester is admin, or is the direct manager of `collabId`. */
  private async assertCanEdit(collabId: string | undefined, requester: any): Promise<void> {
    if (!requester) return; // internal calls (e.g. cron) bypass
    if (requester.isAdmin) return;
    if (!collabId) throw new HttpException('collaborateur_id requis.', HttpStatus.BAD_REQUEST);
    const { data: collab } = await this.supabase.db.from('collaborateurs').select('manager_id').eq('id', collabId).single();
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
    const { data: existing } = await this.supabase.db
      .from('objectifs').select('id').eq('parent_id', template.id).eq('periode', info.periode).maybeSingle();
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
    const { error: insErr } = await this.supabase.db.from('objectifs').insert(row);
    if (insErr && insErr.code !== '23505') {  // ignore unique-violation races
      throw new Error(insErr.message);
    }
    return true;
  }

  /** Scan active recurrent templates and create missing instances for the current period. */
  private async generateMissingInstances(recurrence: Recurrence): Promise<number> {
    const { data: templates, error } = await this.supabase.db
      .from('objectifs').select('*').eq('recurrence', recurrence).is('parent_id', null).neq('statut', 'atteint');
    if (error) throw new Error(error.message);
    let created = 0;
    for (const tpl of templates || []) {
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
