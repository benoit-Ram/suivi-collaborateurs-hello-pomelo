// Shared financial calculations for missions & assignments.
// Keep these in sync with backend/src/modules/assignments/assignments.service.ts (assignmentCost).

export const tauxFromJPS = (jps) => Math.round((Number(jps) || 0) / 5 * 100);

export const jpsFromAssignment = (a) => {
  if (!a) return 0;
  if (a.jours_par_semaine != null) return Number(a.jours_par_semaine) || 0;
  return (Number(a.taux_staffing) || 0) / 100 * 5;
};

// Consumed budget = sum over assignments of (tjm * jours/semaine * weeks elapsed up to `now`)
export const calcConsumedBudget = (assignments, now) => (assignments || []).reduce((s, a) => {
  if (!a.date_debut || !a.tjm) return s;
  const start = new Date(a.date_debut);
  const end = a.date_fin ? new Date(Math.min(new Date(a.date_fin).getTime(), now.getTime())) : now;
  const weeks = Math.max(0, (end - start) / (7 * 86400000));
  return s + (Number(a.tjm) * jpsFromAssignment(a) * weeks);
}, 0);

// Monthly CA forecast for active assignments (4.33 weeks per month average)
export const calcMonthlyCA = (assignments) => (assignments || [])
  .filter(a => a.statut === 'actif')
  .reduce((s, a) => s + ((Number(a.tjm) || 0) * jpsFromAssignment(a) * 4.33), 0);

export const fmtEuro = (v) => v ? Number(v).toLocaleString('fr-FR') + ' €' : '—';
