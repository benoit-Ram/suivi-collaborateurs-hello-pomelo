// src/utils/dates.js
// Utilitaires de dates et formatage

/**
 * Formate une date ISO (YYYY-MM-DD) en DD/MM/YYYY
 * @param {string | null} d
 * @returns {string}
 */
export function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

/**
 * Retourne le mois courant au format YYYY-MM
 * @returns {string}
 */
export function currentMois() {
  const n = new Date();
  return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
}

/**
 * Un point de suivi est verrouillé à partir du 5 du mois suivant
 * @param {string} mois — format YYYY-MM
 * @returns {boolean}
 */
export function isPointLocked(mois) {
  const [year, month] = mois.split('-').map(Number);
  return new Date() >= new Date(year, month, 5);
}

/**
 * Retourne le libellé français d'un mois (ex: "mars 2025")
 * @param {string | null} mois — format YYYY-MM
 * @returns {string}
 */
export function moisLabel(mois) {
  if (!mois) return '—';
  const [y, m] = mois.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/**
 * Nombre de jours calendaires entre deux dates ISO
 * @param {string} dateStr1
 * @param {string} dateStr2
 * @returns {number}
 */
export function daysBetween(dateStr1, dateStr2) {
  return Math.ceil((new Date(dateStr2) - new Date(dateStr1)) / (1000 * 60 * 60 * 24));
}

/**
 * Nombre de jours depuis aujourd'hui jusqu'à une date
 * @param {string | null} dateStr
 * @returns {number | null}
 */
export function daysFromNow(dateStr) {
  if (!dateStr) return null;
  return daysBetween(new Date().toISOString().split('T')[0], dateStr);
}
