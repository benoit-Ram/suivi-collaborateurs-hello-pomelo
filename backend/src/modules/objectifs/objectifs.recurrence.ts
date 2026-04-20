// Helpers for recurrent objectifs (hebdo / mensuel).

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export type Recurrence = 'hebdo' | 'mensuel';

/** ISO week number of the Monday of the given date's week. */
function isoWeekOfMonday(monday: Date): { year: number; week: number } {
  // Thursday of the same week (ISO 8601)
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const firstJan = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - firstJan.getTime()) / 86400000 + 1) / 7);
  return { year: thursday.getFullYear(), week };
}

function mondayOf(d: Date): Date {
  const ref = new Date(d);
  ref.setHours(0, 0, 0, 0);
  const day = ref.getDay(); // 0=Sun, 1=Mon
  const offset = day === 0 ? -6 : 1 - day;
  ref.setDate(ref.getDate() + offset);
  return ref;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface PeriodeInfo {
  periode: string;        // 'W16-2026' or 'M04-2026'
  dateDebut: string;      // YYYY-MM-DD
  dateFin: string;        // YYYY-MM-DD
  titreSuffix: string;    // ' — S16' or ' — Avril 2026'
}

/** Returns period info for the current week/month relative to `now`. */
export function getPeriodeInfo(recurrence: Recurrence, now: Date = new Date()): PeriodeInfo {
  if (recurrence === 'hebdo') {
    const mon = mondayOf(now);
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    const { year, week } = isoWeekOfMonday(mon);
    return {
      periode: `W${String(week).padStart(2, '0')}-${year}`,
      dateDebut: toDateStr(mon),
      dateFin: toDateStr(fri),
      titreSuffix: ` — S${String(week).padStart(2, '0')}`,
    };
  }
  // mensuel
  const y = now.getFullYear();
  const m = now.getMonth();
  const debut = new Date(y, m, 1);
  const fin = new Date(y, m + 1, 0);
  return {
    periode: `M${String(m + 1).padStart(2, '0')}-${y}`,
    dateDebut: toDateStr(debut),
    dateFin: toDateStr(fin),
    titreSuffix: ` — ${MONTHS_FR[m]} ${y}`,
  };
}
