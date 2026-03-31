// src/utils/html.js
// Helpers de rendu HTML et manipulation DOM

/**
 * Échappe les caractères HTML pour prévenir les injections XSS
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function escHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Initiales d'un collaborateur (Prénom Nom → "PN")
 * @param {{ prenom?: string, nom?: string }} c
 * @returns {string}
 */
export function initials(c) {
  return ((c.prenom || '')[0] || '').toUpperCase() + ((c.nom || '')[0] || '').toUpperCase();
}

/**
 * Parse une valeur d'équipes (string CSV ou tableau)
 * @param {string | string[] | null} val
 * @returns {string[]}
 */
export function parseEquipes(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Génère le HTML d'un avatar (photo ou initiales)
 * @param {{ prenom?: string, nom?: string, photoUrl?: string }} c
 * @param {number} size — taille en pixels (défaut: 52)
 * @returns {string}
 */
export function avatarHTML(c, size = 52) {
  if (c.photoUrl) {
    return `<img src="${escHTML(c.photoUrl)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;" alt="${escHTML(initials(c))}" />`;
  }
  const fs = size < 40 ? '0.7rem' : size < 60 ? '1.2rem' : '1.6rem';
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#FF3285,#0000EA);display:flex;align-items:center;justify-content:center;color:white;font-size:${fs};font-weight:700;flex-shrink:0;" aria-label="${escHTML(initials(c))}">${escHTML(initials(c))}</div>`;
}

/**
 * Génère un placeholder de chargement (skeleton)
 * @param {number} lines — nombre de lignes (défaut: 3)
 * @returns {string}
 */
export function skeletonHTML(lines = 3) {
  const widths = ['60%', '80%', '45%', '70%', '55%'];
  return Array(lines).fill(0).map((_, i) =>
    `<div style="height:${i === 0 ? '20px' : '14px'};background:linear-gradient(90deg,var(--lavender) 25%,#E8E8F0 50%,var(--lavender) 75%);background-size:200%;border-radius:6px;margin-bottom:10px;width:${widths[i % widths.length]};animation:shimmer 1.5s infinite;"></div>`
  ).join('');
}
