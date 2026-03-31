// src/features/dashboard/service.js
// Calcul des statistiques et alertes du tableau de bord
//
// Migration depuis admin.js :
//   renderDashboard(), renderAlerts(), renderAnalytics(), renderTrendChart()

import { daysFromNow } from '../../utils/dates.js';

/**
 * Calcule les statistiques globales à partir de la liste des collaborateurs
 * @param {object[]} collabs
 * @returns {object}
 */
export function computeStats(collabs) {
  const actifs = collabs.filter(c => c.statut === 'actif');
  const today = new Date().toISOString().split('T')[0];

  return {
    total:         collabs.length,
    actifs:        actifs.length,
    enOnboarding:  actifs.filter(c => c.dateEntree && c.dateEntree >= today).length,
    byEquipe:      groupBy(actifs, c => c.equipes?.[0] || 'Sans équipe'),
    byBureau:      groupBy(actifs, c => c.bureau || 'Non défini'),
    byContrat:     groupBy(actifs, c => c.typeContrat || 'Non défini'),
  };
}

/**
 * Génère les alertes (fins de contrat, périodes d'essai, anniversaires)
 * @param {object[]} collabs
 * @returns {{ type: string, label: string, collab: object, daysLeft: number }[]}
 */
export function computeAlerts(collabs) {
  const alerts = [];
  const actifs = collabs.filter(c => c.statut === 'actif');

  actifs.forEach(c => {
    // Fin de contrat CDD
    if (c.typeContrat === 'cdd' && c.dateSortie) {
      const days = daysFromNow(c.dateSortie);
      if (days !== null && days >= 0 && days <= 60) {
        alerts.push({ type: 'fin_contrat', label: 'Fin de contrat', collab: c, daysLeft: days });
      }
    }

    // Fin de période d'essai (estimation : 3 mois après entrée)
    if (c.dateEntree) {
      const essaiEnd = new Date(c.dateEntree);
      essaiEnd.setMonth(essaiEnd.getMonth() + 3);
      const days = daysFromNow(essaiEnd.toISOString().split('T')[0]);
      if (days !== null && days >= 0 && days <= 14) {
        alerts.push({ type: 'fin_essai', label: "Fin de période d'essai", collab: c, daysLeft: days });
      }
    }
  });

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Groupe un tableau par une clé
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => string} keyFn
 * @returns {Record<string, number>}
 */
function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
