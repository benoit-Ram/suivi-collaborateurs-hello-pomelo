import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../../config/database.service';

@Injectable()
export class ActivityLogService {
  constructor(private database: DatabaseService) {}

  async findAll(limit = 50) {
    try {
      return await this.database.db
        .selectFrom('activity_log')
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur activity_log', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async create(dto: { action: string; auteur?: string | null; cible?: string | null; details?: string | null }) {
    if (!dto?.action) throw new HttpException('action requise', HttpStatus.BAD_REQUEST);
    try {
      // `as any` : tsconfig.strictNullChecks=false empêche Kysely de rendre les
      // colonnes Generated<> optionnelles. Correctif structurant = activer strict,
      // chantier à part.
      return await this.database.db
        .insertInto('activity_log')
        .values({
          action: dto.action,
          auteur: dto.auteur ?? null,
          cible: dto.cible ?? null,
          details: dto.details ?? null,
        } as any)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur create activity_log', HttpStatus.BAD_REQUEST);
    }
  }
}
