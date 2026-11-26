import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../../config/database.service';

// pg attend du JSON stringifié (pas un array/object JS brut) pour les colonnes jsonb.
// Ce helper produit un fragment Kysely qui fait le cast côté serveur.
function jsonb(value: any) {
  return sql`${JSON.stringify(value)}::jsonb`;
}

// Table settings : PK = `key` (pas `id`). Le controller route sur :id mais
// le paramètre désigne bien la `key` — on le traite comme tel ici.
@Injectable()
export class SettingsService {
  constructor(private database: DatabaseService) {}

  private static readonly ALLOWED_FILTERS = ['key'] as const;

  async findAll(filters?: Record<string, string>) {
    try {
      let query = this.database.db.selectFrom('settings').selectAll();
      if (filters) {
        for (const [col, val] of Object.entries(filters)) {
          if (val && (SettingsService.ALLOWED_FILTERS as readonly string[]).includes(col)) {
            query = query.where(col as 'key', '=', val);
          }
        }
      }
      return await query.execute();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur settings', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /** Upsert par `key` — c'est le point d'entrée principal côté frontend. */
  async upsertByKey(key: string, value: any) {
    try {
      await this.database.db
        .insertInto('settings')
        .values({ key, value: jsonb(value) as any })
        .onConflict((oc) => oc.column('key').doUpdateSet({ value: jsonb(value) as any }))
        .execute();
      return { success: true };
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur upsert', HttpStatus.BAD_REQUEST);
    }
  }

  async findOne(key: string) {
    const row = await this.database.db
      .selectFrom('settings')
      .selectAll()
      .where('key', '=', key)
      .executeTakeFirst();
    if (!row) throw new HttpException(`Setting ${key} introuvable`, HttpStatus.NOT_FOUND);
    return row;
  }

  async create(dto: { key: string; value: any }) {
    if (!dto?.key) throw new HttpException('key requis', HttpStatus.BAD_REQUEST);
    try {
      return await this.database.db
        .insertInto('settings')
        .values({ key: dto.key, value: jsonb(dto.value) as any })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur create', HttpStatus.BAD_REQUEST);
    }
  }

  async update(key: string, dto: { value?: any; key?: string }) {
    try {
      const row = await this.database.db
        .updateTable('settings')
        .set({
          ...(dto.value !== undefined ? { value: jsonb(dto.value) as any } : {}),
          ...(dto.key !== undefined ? { key: dto.key } : {}),
        })
        .where('key', '=', key)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw new HttpException(`Setting ${key} introuvable`, HttpStatus.NOT_FOUND);
      return row;
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(e.message ?? 'Erreur update', HttpStatus.BAD_REQUEST);
    }
  }

  async delete(key: string) {
    const res = await this.database.db
      .deleteFrom('settings')
      .where('key', '=', key)
      .executeTakeFirst();
    if (res.numDeletedRows === 0n) {
      throw new HttpException(`Setting ${key} introuvable`, HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }
}
