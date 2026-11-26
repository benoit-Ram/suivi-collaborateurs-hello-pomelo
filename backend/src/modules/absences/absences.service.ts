import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../../config/database.service';
import { NotificationsService } from '../google-integration/notifications.service';

@Injectable()
export class AbsencesService {
  constructor(private database: DatabaseService, private notifications: NotificationsService) {}

  /** Count working days (weekdays) in [start, end] inclusive, accounting for half-days. */
  private countWorkDays(start: string, end: string, demi?: string | null): number {
    const s = new Date(start);
    const e = new Date(end);
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return demi && start === end ? 0.5 : count;
  }

  private async getCollabForNotif(id: string) {
    return await this.database.db
      .selectFrom('collaborateurs')
      .select(['id', 'prenom', 'nom', 'email', 'manager_id'])
      .where('id', '=', id)
      .executeTakeFirst();
  }

  private async getManagerEmail(managerId: string | null | undefined) {
    if (!managerId) return null;
    return await this.database.db
      .selectFrom('collaborateurs')
      .select(['email', 'prenom'])
      .where('id', '=', managerId)
      .executeTakeFirst();
  }

  private absenceTypeLabel(key: string): string {
    const m: Record<string, string> = {
      conge: 'Congé payé',
      sans_solde: 'Sans solde',
      maladie: 'Maladie',
      formation: 'Formation / Cours',
    };
    return m[key] || key;
  }

  private static readonly ALLOWED_FILTERS = ['collaborateur_id', 'statut', 'type'] as const;

  async findAll(filters?: Record<string, string>) {
    try {
      let query = this.database.db
        .selectFrom('absences')
        .selectAll()
        .orderBy('date_debut', 'desc');
      if (filters) {
        for (const [col, val] of Object.entries(filters)) {
          if (val && (AbsencesService.ALLOWED_FILTERS as readonly string[]).includes(col)) {
            query = query.where(col as any, '=', val);
          }
        }
      }
      return await query.execute();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur absences', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOne(id: string) {
    const row = await this.database.db
      .selectFrom('absences')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!row) throw new HttpException(`Absence ${id} introuvable`, HttpStatus.NOT_FOUND);
    return row;
  }

  async create(dto: any) {
    if (!dto.collaborateur_id) throw new HttpException('collaborateur_id requis', HttpStatus.BAD_REQUEST);
    if (!dto.type) throw new HttpException('type requis', HttpStatus.BAD_REQUEST);
    if (!dto.date_debut) throw new HttpException('date_debut requis', HttpStatus.BAD_REQUEST);
    if (!dto.date_fin) throw new HttpException('date_fin requis', HttpStatus.BAD_REQUEST);
    if (dto.date_fin < dto.date_debut) throw new HttpException('date_fin doit être >= date_debut', HttpStatus.BAD_REQUEST);

    const existing = await this.database.db
      .selectFrom('absences')
      .select(['id', 'date_debut', 'date_fin', 'demi_journee', 'statut'])
      .where('collaborateur_id', '=', dto.collaborateur_id)
      .where('statut', 'in', ['en_attente', 'approuve'])
      .where('date_debut', '<=', dto.date_fin)
      .where('date_fin', '>=', dto.date_debut)
      .execute();

    if (existing.length > 0) {
      const hasRealOverlap = existing.some((a) => {
        if (dto.demi_journee && a.demi_journee && dto.date_debut === a.date_debut) {
          return dto.demi_journee === a.demi_journee;
        }
        return true; // Full overlap
      });
      if (hasRealOverlap) {
        throw new HttpException('Chevauchement avec une absence existante', HttpStatus.BAD_REQUEST);
      }
    }

    let created: any;
    try {
      created = await this.database.db
        .insertInto('absences')
        .values(dto as any)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur create absence', HttpStatus.BAD_REQUEST);
    }

    if (created.statut === 'en_attente') {
      const collab = await this.getCollabForNotif(created.collaborateur_id);
      const manager = await this.getManagerEmail(collab?.manager_id);
      if (manager?.email) {
        this.notifications.onAbsencePending({
          managerEmail: manager.email,
          managerPrenom: manager.prenom,
          collabPrenom: collab?.prenom || '',
          collabNom: collab?.nom || '',
          type: this.absenceTypeLabel(created.type),
          date_debut: created.date_debut,
          date_fin: created.date_fin,
          jours: this.countWorkDays(created.date_debut, created.date_fin, created.demi_journee),
          commentaire: created.commentaire,
        });
      }
    }
    return created;
  }

  async update(id: string, dto: any) {
    const before = await this.database.db
      .selectFrom('absences')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    let data: any;
    try {
      data = await this.database.db
        .updateTable('absences')
        .set(dto)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    } catch (e: any) {
      throw new HttpException(e.message ?? 'Erreur update absence', HttpStatus.BAD_REQUEST);
    }
    if (!data) throw new HttpException(`Absence ${id} introuvable`, HttpStatus.NOT_FOUND);

    if (before && before.statut !== data.statut) {
      const collab = await this.getCollabForNotif(data.collaborateur_id);
      if (collab?.email) {
        const common = {
          collabEmail: collab.email,
          collabPrenom: collab.prenom,
          absenceId: data.id,
          type: this.absenceTypeLabel(data.type),
          date_debut: data.date_debut,
          date_fin: data.date_fin,
        };
        if (data.statut === 'approuve') {
          this.notifications.onAbsenceApproved({
            ...common,
            managerEmail: null,
            jours: this.countWorkDays(data.date_debut, data.date_fin, data.demi_journee),
            commentaire: data.commentaire,
          });
        } else if (data.statut === 'refuse') {
          this.notifications.onAbsenceRefused({ ...common, motif_refus: data.motif_refus });
        } else if (data.statut === 'annule') {
          this.notifications.onAbsenceCancelled({ collabEmail: collab.email, absenceId: data.id });
        }
      }
    }
    return data;
  }

  /** Collab can only cancel their own pending/approved absences */
  async updateForCollab(id: string, dto: any, collabId: string) {
    const absence = await this.database.db
      .selectFrom('absences')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!absence) throw new HttpException('Absence non trouvée', HttpStatus.NOT_FOUND);
    if (absence.collaborateur_id !== collabId) throw new HttpException('Non autorisé', HttpStatus.FORBIDDEN);

    const allowed: Record<string, string[]> = {
      'en_attente': ['annule'],
      'approuve': ['annulation_demandee'],
    };
    if (dto.statut && (!allowed[absence.statut] || !allowed[absence.statut].includes(dto.statut))) {
      throw new HttpException(`Transition ${absence.statut} → ${dto.statut} non autorisée`, HttpStatus.BAD_REQUEST);
    }

    const safeDto: any = {};
    if (dto.statut) safeDto.statut = dto.statut;
    if (dto.commentaire_annulation) safeDto.commentaire_annulation = dto.commentaire_annulation;

    try {
      const row = await this.database.db
        .updateTable('absences')
        .set(safeDto)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      if (!row) throw new HttpException(`Absence ${id} introuvable`, HttpStatus.NOT_FOUND);
      return row;
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      throw new HttpException(e.message ?? 'Erreur update absence', HttpStatus.BAD_REQUEST);
    }
  }

  async delete(id: string) {
    const res = await this.database.db
      .deleteFrom('absences')
      .where('id', '=', id)
      .executeTakeFirst();
    if (res.numDeletedRows === 0n) {
      throw new HttpException(`Absence ${id} introuvable`, HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }
}
