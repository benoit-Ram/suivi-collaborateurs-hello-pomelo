import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from '../../config/database.service';
import { NotificationsService } from '../google-integration/notifications.service';

@Injectable()
export class AbsencesService {
  constructor(private database: DatabaseService, private notifications: NotificationsService) {}

  /** Jours fériés français fixes + mobiles (Lundi de Pâques, Ascension, Lundi Pentecôte).
   *  Calcul via Butcher-Meeus pour Pâques puis offsets.
   *  Les dates renvoyées sont au format YYYY-MM-DD en timezone locale.
   */
  private frenchHolidays(year: number): Set<string> {
    const fixed = [
      `${year}-01-01`, `${year}-05-01`, `${year}-05-08`, `${year}-07-14`,
      `${year}-08-15`, `${year}-11-01`, `${year}-11-11`, `${year}-12-25`,
    ];
    // Easter (Butcher-Meeus Gregorian)
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 or 4
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const easter = new Date(year, month - 1, day);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
    const easterMonday = addDays(easter, 1);
    const ascension = addDays(easter, 39);
    const pentecostMonday = addDays(easter, 50);
    return new Set([...fixed, fmt(easterMonday), fmt(ascension), fmt(pentecostMonday)]);
  }

  /** Count working days (weekdays, hors fériés FR) in [start, end] inclusive, accounting for half-days. */
  private countWorkDays(start: string | Date, end: string | Date, demi?: string | null): number {
    const toStr = (v: string | Date) => typeof v === 'string' ? v : v.toISOString().slice(0, 10);
    const s = new Date(toStr(start));
    const e = new Date(toStr(end));
    const years = new Set<number>();
    for (let y = s.getFullYear(); y <= e.getFullYear(); y++) years.add(y);
    const holidays = new Set<string>();
    years.forEach((y) => this.frenchHolidays(y).forEach((d) => holidays.add(d)));
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6 && !holidays.has(fmt(cur))) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return demi && toStr(start) === toStr(end) ? 0.5 : count;
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

    // Valide le type contre settings.absence_types pour éviter qu'un collab
    // crée une absence "formation" (pas de décompte) alors que seul `conge` est autorisé pour lui.
    const typesSetting = await this.database.db
      .selectFrom('settings').select('value').where('key', '=', 'absence_types').executeTakeFirst();
    const allowedTypes = Array.isArray(typesSetting?.value)
      ? (typesSetting!.value as any[]).map((t) => t.key).filter(Boolean)
      : ['conge', 'maladie', 'formation', 'sans_solde', 'autre'];
    if (!allowedTypes.includes(dto.type)) {
      throw new HttpException(`Type d'absence "${dto.type}" non autorisé`, HttpStatus.BAD_REQUEST);
    }

    // Overlap check : inclut aussi les absences avec annulation demandée (toujours actives tant que non validées).
    const existing = await this.database.db
      .selectFrom('absences')
      .select(['id', 'date_debut', 'date_fin', 'demi_journee', 'statut'])
      .where('collaborateur_id', '=', dto.collaborateur_id)
      .where('statut', 'in', ['en_attente', 'approuve', 'annulation_demandee'])
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
