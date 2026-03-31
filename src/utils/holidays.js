// src/utils/holidays.js
// Calcul des jours fériés français
// Algorithme de Gauss pour la date de Pâques

const JOURS_FERIES_FIXES = [
  { m: 1,  d: 1  }, // Jour de l'an
  { m: 5,  d: 1  }, // Fête du Travail
  { m: 5,  d: 8  }, // Victoire 1945
  { m: 7,  d: 14 }, // Fête Nationale
  { m: 8,  d: 15 }, // Assomption
  { m: 11, d: 1  }, // Toussaint
  { m: 11, d: 11 }, // Armistice
  { m: 12, d: 25 }, // Noël
];

/**
 * Calcule la date de Pâques pour une année donnée (algorithme de Gauss)
 * @param {number} year
 * @returns {Date}
 */
export function getEasterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Retourne un Set des dates fériées au format YYYY-MM-DD pour une année
 * Inclut : fixes + Lundi de Pâques, Ascension, Lundi de Pentecôte
 * @param {number} year
 * @returns {Set<string>}
 */
export function getJoursFeriesSet(year) {
  const set = new Set();
  JOURS_FERIES_FIXES.forEach(f =>
    set.add(`${year}-${String(f.m).padStart(2, '0')}-${String(f.d).padStart(2, '0')}`)
  );
  const easter = getEasterDate(year);
  // +1 = Lundi de Pâques, +39 = Ascension, +50 = Lundi de Pentecôte
  [1, 39, 50].forEach(offset => {
    const d = new Date(easter);
    d.setDate(easter.getDate() + offset);
    set.add(d.toISOString().split('T')[0]);
  });
  return set;
}

/**
 * Compte les jours ouvrés (hors week-ends et fériés) entre deux dates ISO
 * @param {string} d1 — date de début (incluse)
 * @param {string} d2 — date de fin (incluse)
 * @returns {number}
 */
export function countWorkDays(d1, d2) {
  const start = new Date(d1);
  const end = new Date(d2);

  // Collecte toutes les années concernées
  const years = new Set();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    years.add(d.getFullYear());
  }

  // Union de tous les jours fériés des années concernées
  const feries = new Set();
  years.forEach(y => getJoursFeriesSet(y).forEach(f => feries.add(f)));

  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !feries.has(d.toISOString().split('T')[0])) {
      count++;
    }
  }
  return count;
}
