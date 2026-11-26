import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../../config/database.service';

@Injectable()
export class PointsSuiviService {
  constructor(private database: DatabaseService) {}

  private static readonly ALLOWED_FILTERS = ['collaborateur_id', 'mois', 'type'] as const;

  /** Returns IDs des collabs dont `userId` est le manager. Sert au scoping non-admin. */
  private async managedCollabIds(userId: string): Promise<string[]> {
    const rows = await this.database.db
      .selectFrom('collaborateurs')
      .select('id')
      .where('manager_id', '=', userId)
      .execute();
    return rows.map((r) => r.id);
  }

  async findAll(filters: Record<string, string> | undefined, requester?: any) {
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
      // Non-admin : limite aux entretiens dont il est le sujet ou le manager du sujet.
      if (requester && !requester.isAdmin) {
        const managed = await this.managedCollabIds(requester.sub);
        const allowedIds = [requester.sub, ...managed];
        query = query.where('collaborateur_id', 'in', allowedIds);
      }
      return await query.execute();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur points_suivi', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOne(id: string, requester?: any) {
    const row = await this.database.db
      .selectFrom('points_suivi')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) throw new HttpException(`Point de suivi ${id} introuvable`, HttpStatus.NOT_FOUND);
    if (requester && !requester.isAdmin) {
      const managed = await this.managedCollabIds(requester.sub);
      const allowed = row.collaborateur_id === requester.sub || managed.includes(row.collaborateur_id);
      if (!allowed) throw new HttpException(`Point de suivi ${id} introuvable`, HttpStatus.NOT_FOUND);
    }
    return row;
  }

  async create(dto: any, requester?: any) {
    // Non-admin : ne peut créer QUE pour lui-même (les managers passent par l'UI admin ou laissent l'auto-création).
    if (requester && !requester.isAdmin) {
      dto.collaborateur_id = requester.sub;
    }
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

  async update(id: string, dto: any, requester?: any) {
    const current = await this.database.db
      .selectFrom('points_suivi')
      .select(['mois', 'type', 'collaborateur_id'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!current) throw new HttpException(`Point de suivi ${id} introuvable`, HttpStatus.NOT_FOUND);
    // Non-admin : self ou manager du collab. Sinon 404 (masque l'existence).
    if (requester && !requester.isAdmin) {
      const managed = await this.managedCollabIds(requester.sub);
      const allowed = current.collaborateur_id === requester.sub || managed.includes(current.collaborateur_id);
      if (!allowed) throw new HttpException(`Point de suivi ${id} introuvable`, HttpStatus.NOT_FOUND);
    }
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
