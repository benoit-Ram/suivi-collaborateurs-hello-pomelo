import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { DatabaseService } from '../../config/database.service';

// Fields that a non-admin user should never see on other collaborateurs.
// Kept for self or admins; redacted otherwise.
const SENSITIVE_FIELDS = ['notes', 'solde_conges', 'solde_rtt', 'acquisition_conges', 'solde_reference_date', 'cycle_conges_debut', 'date_fin_essai', 'is_admin', 'missions_access'] as const;

// Fields a collab cannot write on themselves (admin-only fields).
const ADMIN_ONLY_WRITE_FIELDS = ['is_admin', 'missions_access', 'objectifs_access', 'entretiens_access', 'solde_conges', 'solde_rtt', 'acquisition_conges', 'solde_reference_date', 'manager_id', 'valideur_conges_id', 'date_entree', 'date_fin_essai', 'contrat', 'type_poste', 'groupe_entretien', 'cycle_conges_debut'] as const;

function redactCollab(collab: any, requester: any): any {
  if (!collab) return collab;
  if (requester?.isAdmin) return collab;
  if (collab.id === requester?.sub) return collab; // self sees everything
  const redacted: any = { ...collab };
  SENSITIVE_FIELDS.forEach(f => { delete redacted[f]; });
  // Les jointures points_suivi (entretiens RH) et objectifs sont privées :
  // visibles uniquement par l'admin ou le collab lui-même (traités au-dessus).
  if ('points_suivi' in redacted) redacted.points_suivi = [];
  if ('objectifs' in redacted) redacted.objectifs = [];
  return redacted;
}

@Injectable()
export class CollaborateursService {
  constructor(private database: DatabaseService) {}

  async findAll(requester?: any) {
    try {
      const rows = await this.database.db
        .selectFrom('collaborateurs')
        .selectAll()
        .select((eb) => [
          jsonArrayFrom(
            eb.selectFrom('points_suivi')
              .selectAll('points_suivi')
              .whereRef('points_suivi.collaborateur_id', '=', 'collaborateurs.id'),
          ).as('points_suivi'),
          jsonArrayFrom(
            eb.selectFrom('objectifs')
              .selectAll('objectifs')
              .whereRef('objectifs.collaborateur_id', '=', 'collaborateurs.id'),
          ).as('objectifs'),
        ])
        .orderBy('nom', 'asc')
        .orderBy('prenom', 'asc')
        .execute();
      return rows.map((c) => redactCollab(c, requester));
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur collaborateurs', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOne(id: string, requester?: any) {
    const row = await this.database.db
      .selectFrom('collaborateurs')
      .selectAll()
      .select((eb) => [
        jsonArrayFrom(
          eb.selectFrom('points_suivi')
            .selectAll('points_suivi')
            .whereRef('points_suivi.collaborateur_id', '=', 'collaborateurs.id'),
        ).as('points_suivi'),
        jsonArrayFrom(
          eb.selectFrom('objectifs')
            .selectAll('objectifs')
            .whereRef('objectifs.collaborateur_id', '=', 'collaborateurs.id'),
        ).as('objectifs'),
      ])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) throw new HttpException(`Collaborateur ${id} introuvable`, HttpStatus.NOT_FOUND);
    return redactCollab(row, requester);
  }

  async create(dto: any, requester?: any) {
    if (!dto?.prenom || !dto?.nom) throw new HttpException('prenom et nom requis', HttpStatus.BAD_REQUEST);
    // Un admin non super_admin ne peut pas créer directement un autre admin (parité avec update).
    if (!requester?.isSuperAdmin && 'is_admin' in dto) delete dto.is_admin;
    try {
      return await this.database.db
        .insertInto('collaborateurs')
        .values(dto as any)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur create collaborateur', HttpStatus.BAD_REQUEST);
    }
  }

  async update(id: string, dto: any, requester?: any) {
    if (!requester?.isAdmin) {
      // Non-admin: must be self, with restricted field set
      if (requester?.sub !== id) {
        throw new HttpException('Vous ne pouvez modifier que votre propre profil.', HttpStatus.FORBIDDEN);
      }
      // Strip admin-only fields
      ADMIN_ONLY_WRITE_FIELDS.forEach((f) => { if (f in dto) delete dto[f]; });
    } else if (!requester?.isSuperAdmin) {
      // Admin (not super): cannot grant is_admin
      if ('is_admin' in dto) delete dto.is_admin;
    }
    try {
      const row = await this.database.db
        .updateTable('collaborateurs')
        .set(dto)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw new HttpException(`Collaborateur ${id} introuvable`, HttpStatus.NOT_FOUND);
      return row;
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(e.message ?? 'Erreur update collaborateur', HttpStatus.BAD_REQUEST);
    }
  }

  async delete(id: string) {
    const res = await this.database.db
      .deleteFrom('collaborateurs')
      .where('id', '=', id)
      .executeTakeFirst();
    if (res.numDeletedRows === 0n) {
      throw new HttpException(`Collaborateur ${id} introuvable`, HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }
}
