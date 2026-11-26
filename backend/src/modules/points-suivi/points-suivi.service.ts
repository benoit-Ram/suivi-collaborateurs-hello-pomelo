import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../../config/database.service';

@Injectable()
export class PointsSuiviService {
  constructor(private database: DatabaseService) {}

  private static readonly ALLOWED_FILTERS = ['collaborateur_id', 'mois', 'type'] as const;

  async findAll(filters?: Record<string, string>) {
    try {
      let query = this.database.db
        .selectFrom('points_suivi')
        .selectAll()
        .orderBy('created_at', 'desc');
      if (filters) {
        for (const [col, val] of Object.entries(filters)) {
          if (val && (PointsSuiviService.ALLOWED_FILTERS as readonly string[]).includes(col)) {
            query = query.where(col as any, '=', val);
          }
        }
      }
      return await query.execute();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur points_suivi', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOne(id: string) {
    const row = await this.database.db
      .selectFrom('points_suivi')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) throw new HttpException(`Point de suivi ${id} introuvable`, HttpStatus.NOT_FOUND);
    return row;
  }

  async create(dto: any) {
    try {
      return await this.database.db
        .insertInto('points_suivi')
        .values(dto as any)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur create point_suivi', HttpStatus.BAD_REQUEST);
    }
  }

  private isEntretienMensuelLocked(mois: string | null | undefined): boolean {
    if (!mois) return false;
    const [year, month] = mois.split('-').map(Number);
    // Verrouillé à partir du 5 du mois suivant (mois est 1-12; Date(year, month, 5) = jour 5 du mois +1)
    return new Date() >= new Date(year, month, 5);
  }

  async update(id: string, dto: any) {
    const current = await this.database.db
      .selectFrom('points_suivi')
      .select(['mois', 'type'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!current) throw new HttpException(`Point de suivi ${id} introuvable`, HttpStatus.NOT_FOUND);
    if (current.type === 'mensuel' && this.isEntretienMensuelLocked(current.mois)) {
      throw new HttpException(
        `Cet entretien mensuel est verrouillé (au-delà du 5 du mois suivant). Les retours ne sont plus modifiables.`,
        HttpStatus.FORBIDDEN,
      );
    }
    try {
      const row = await this.database.db
        .updateTable('points_suivi')
        .set(dto)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw new HttpException(`Point de suivi ${id} introuvable`, HttpStatus.NOT_FOUND);
      return row;
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(e.message ?? 'Erreur update point_suivi', HttpStatus.BAD_REQUEST);
    }
  }

  async delete(id: string) {
    const res = await this.database.db
      .deleteFrom('points_suivi')
      .where('id', '=', id)
      .executeTakeFirst();
    if (res.numDeletedRows === 0n) {
      throw new HttpException(`Point de suivi ${id} introuvable`, HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }
}
