import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../config/supabase.service';

@Injectable()
export class AbsencesService {
  constructor(private supabase: SupabaseService) {}

  async findAll(filters?: Record<string, string>) {
    let query = this.supabase.db.from('absences').select('*').order('created_at', { ascending: false });
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => { if (val) query = query.eq(key, val); });
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase.db.from('absences').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async create(dto: any) {
    const { date_debut, date_fin, collaborateur_id, type, demi_journee } = dto;

    if (!date_debut || !date_fin || !collaborateur_id || !type) {
      throw new BadRequestException('Champs obligatoires manquants (date_debut, date_fin, collaborateur_id, type).');
    }

    if (date_fin < date_debut) {
      throw new BadRequestException('La date de fin doit être après la date de début.');
    }

    // Bloquer les demandes rétroactives
    const today = new Date().toISOString().split('T')[0];
    if (date_debut < today) {
      throw new BadRequestException('Impossible de poser un congé sur des dates passées.');
    }

    // Bloquer le chevauchement
    const { data: existing } = await this.supabase.db
      .from('absences')
      .select('id, date_debut, date_fin')
      .eq('collaborateur_id', collaborateur_id)
      .in('statut', ['en_attente', 'approuve'])
      .lte('date_debut', date_fin)
      .gte('date_fin', date_debut);

    if (existing && existing.length > 0) {
      throw new BadRequestException('Chevauchement avec une demande existante.');
    }

    // Bloquer le solde négatif pour les congés payés
    if (type === 'conge') {
      const { data: collab } = await this.supabase.db
        .from('collaborateurs')
        .select('solde_conges, acquisition_conges, date_entree')
        .eq('id', collaborateur_id)
        .single();

      if (collab) {
        const soldeInitial = collab.solde_conges || 0;
        const acquisition = collab.acquisition_conges || 2.08;
        let moisAcquis = 0;
        if (collab.date_entree) {
          const entree = new Date(collab.date_entree);
          const now = new Date();
          moisAcquis = Math.max(0, (now.getFullYear() - entree.getFullYear()) * 12 + (now.getMonth() - entree.getMonth()));
        }
        const acquis = Math.round(moisAcquis * acquisition * 100) / 100;

        // Jours déjà pris (approuvés) + en attente
        const { data: allAbs } = await this.supabase.db
          .from('absences')
          .select('date_debut, date_fin, demi_journee, statut')
          .eq('collaborateur_id', collaborateur_id)
          .eq('type', 'conge')
          .in('statut', ['approuve', 'en_attente']);

        const joursUtilises = (allAbs || []).reduce((sum, a) => {
          return sum + (a.demi_journee ? 0.5 : this.countWorkDays(a.date_debut, a.date_fin));
        }, 0);

        const joursDemandesNow = demi_journee ? 0.5 : this.countWorkDays(date_debut, date_fin);
        const soldeApres = Math.round((soldeInitial + acquis - joursUtilises - joursDemandesNow) * 100) / 100;

        if (soldeApres < 0) {
          throw new BadRequestException(`Solde insuffisant (${soldeApres}j après cette demande).`);
        }
      }
    }

    const { data, error } = await this.supabase.db.from('absences').insert(dto).select().single();
    if (error) throw error;
    return data;
  }

  async update(id: string, dto: any) {
    const { data, error } = await this.supabase.db.from('absences').update(dto).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabase.db.from('absences').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  }

  private countWorkDays(d1: string, d2: string): number {
    let count = 0;
    const start = new Date(d1);
    const end = new Date(d2);
    const feries = new Set<string>();
    const years = new Set<number>();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) years.add(d.getFullYear());
    years.forEach(y => this.getJoursFeries(y).forEach(f => feries.add(f)));
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6 && !feries.has(d.toISOString().split('T')[0])) count++;
    }
    return count;
  }

  private getJoursFeries(year: number): string[] {
    const pad = (n: number) => String(n).padStart(2, '0');
    const fixes = [
      `${year}-01-01`, `${year}-05-01`, `${year}-05-08`, `${year}-07-14`,
      `${year}-08-15`, `${year}-11-01`, `${year}-11-11`, `${year}-12-25`
    ];
    // Easter (Meeus/Jones/Butcher)
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const easter = new Date(year, month - 1, day);
    [1, 39, 50].forEach(offset => {
      const d = new Date(easter);
      d.setDate(easter.getDate() + offset);
      fixes.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    });
    return fixes;
  }
}
