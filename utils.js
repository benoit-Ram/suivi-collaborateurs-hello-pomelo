// ─────────────────────────────────────────
// UTILITAIRES PARTAGÉS — Hello Pomelo
// index.html + collaborateur.html
// ─────────────────────────────────────────

// ── SHARED CONSTANTS ──
const DOCS_LABELS = {
  contrat: 'Contrat de travail',
  rib: 'RIB bancaire',
  cni: 'Carte d\'identité / Passeport',
  attestationSecu: 'Attestation Sécurité Sociale',
  fichePoste: 'Fiche de poste signée',
  lettreObjectif: 'Lettre d\'objectif signée',
};
const STATUS_COLORS = { 'en-cours': 'badge-blue', 'atteint': 'badge-green', 'non-atteint': 'badge-orange', 'en-attente': 'badge-gray' };
const STATUS_LABELS = { 'en-cours': 'En cours', 'atteint': 'Atteint ✓', 'non-atteint': 'Non atteint', 'en-attente': 'En attente' };
const BAR_COLORS = { 'en-cours': 'linear-gradient(90deg,var(--pink),var(--blue))', 'atteint': 'linear-gradient(90deg,#22C55E,#16A34A)', 'non-atteint': 'linear-gradient(90deg,#F97316,#EA580C)', 'en-attente': 'var(--lavender)' };

// ── DATE & FORMAT ──
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function initials(c) {
  return ((c.prenom||'')[0]||'').toUpperCase() + ((c.nom||'')[0]||'').toUpperCase();
}

function avatarHTML(c, size) {
  size = size || 52;
  if (c.photoUrl) return `<img src="${c.photoUrl}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;" />`;
  const fs = size < 40 ? '0.7rem' : size < 60 ? '1.2rem' : '1.6rem';
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#FF3285,#0000EA);display:flex;align-items:center;justify-content:center;color:white;font-size:${fs};font-weight:700;flex-shrink:0;">${initials(c)}</div>`;
}

function currentMois() {
  const n = new Date();
  return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
}

function isPointLocked(mois) {
  const [year, month] = mois.split('-').map(Number);
  return new Date() >= new Date(year, month, 5); // verrouillé le 5 du mois suivant
}

const MANAGER_FIELDS = ['retoursMissions','tauxStaffing','qualites','axeAmelioration'];
const COLLAB_FIELDS = ['ressenti','reussites','objectifsAtteints','suggestions','objectifsMoisSuivant','autresSujets','axeAmeliorationSoi'];

function getPointStatus(point) {
  const md = point.managerData || {};
  const cd = point.collabData || {};
  const mdKeys = Object.keys(md).filter(k => k !== 'objectifs');
  const cdKeys = Object.keys(cd).filter(k => k !== 'objectifs');
  const managerDone = mdKeys.length > 0 && mdKeys.some(k => md[k] && String(md[k]).trim());
  const collabDone = cdKeys.length > 0 && cdKeys.some(k => cd[k] && String(cd[k]).trim());
  const managerFull = mdKeys.length > 0 && mdKeys.every(k => md[k] && String(md[k]).trim());
  const collabFull = cdKeys.length > 0 && cdKeys.every(k => cd[k] && String(cd[k]).trim());
  if (managerFull && collabFull) return 'complet';
  if (managerDone || collabDone) return 'partiel';
  return 'vide';
}

const POINT_STATUS_BADGE = { complet: { label: '✅ Complet', cls: 'badge-green' }, partiel: { label: '🟡 Partiel', cls: 'badge-orange' }, vide: { label: '🔴 Vide', cls: 'badge-pink' } };

function moisLabel(mois) {
  if (!mois) return '—';
  const [y, m] = mois.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// ── UI HELPERS ──
function toggleAcc(id) {
  const el = document.getElementById(id);
  const pointId = id.replace('acc-', '');
  const icon = document.getElementById('acc-icon-' + pointId);
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (icon) icon.textContent = open ? '▼' : '▲';
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#05056D;color:white;padding:12px 20px;border-radius:12px;font-size:0.85rem;font-weight:700;box-shadow:0 8px 24px rgba(5,5,109,0.3);z-index:500;transition:opacity 0.3s;';
  t.textContent = '✓ ' + msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
}

// ── DAYS CALCULATION ──
function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
}

function daysFromNow(dateStr) {
  if (!dateStr) return null;
  return daysBetween(new Date().toISOString().split('T')[0], dateStr);
}

// ── ABSENCES CONSTANTS ──
const ABS_TYPES = { conge:'Congé', sans_solde:'Sans solde' };
const ABS_STATUTS = { en_attente:'En attente', approuve:'Approuvé', refuse:'Refusé' };
const ABS_STATUT_BADGE = { en_attente:'badge-orange', approuve:'badge-green', refuse:'badge-pink' };

// ── DEBOUNCE ──
function debounce(fn, delay) {
  let timer;
  return function(...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
}

// ── TEXT ESCAPE (anti-XSS) ──
function escHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ── JOURS FÉRIÉS FRANÇAIS ──
const JOURS_FERIES_FIXES = [
  { m: 1, d: 1 }, { m: 5, d: 1 }, { m: 5, d: 8 }, { m: 7, d: 14 },
  { m: 8, d: 15 }, { m: 11, d: 1 }, { m: 11, d: 11 }, { m: 12, d: 25 },
];

function getEasterDate(year) {
  const a = year % 19, b = Math.floor(year/100), c = year % 100;
  const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25);
  const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30;
  const i = Math.floor(c/4), k = c % 4;
  const l = (32+2*e+2*i-h-k) % 7;
  const m = Math.floor((a+11*h+22*l)/451);
  const month = Math.floor((h+l-7*m+114)/31);
  const day = ((h+l-7*m+114) % 31) + 1;
  return new Date(year, month-1, day);
}

function getJoursFeriesSet(year) {
  const set = new Set();
  JOURS_FERIES_FIXES.forEach(f => set.add(`${year}-${String(f.m).padStart(2,'0')}-${String(f.d).padStart(2,'0')}`));
  const easter = getEasterDate(year);
  [1, 39, 50].forEach(offset => {
    const d = new Date(easter); d.setDate(easter.getDate() + offset);
    set.add(d.toISOString().split('T')[0]);
  });
  return set;
}

function countWorkDays(d1, d2) {
  let count = 0;
  const start = new Date(d1);
  const end = new Date(d2);
  const years = new Set();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) years.add(d.getFullYear());
  const feries = new Set();
  years.forEach(y => getJoursFeriesSet(y).forEach(f => feries.add(f)));
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !feries.has(d.toISOString().split('T')[0])) count++;
  }
  return count;
}

// ── EXPORT HELPERS ──
function exportCSV(filename, headers, rows) {
  const BOM = '\uFEFF';
  const csv = BOM + [headers.join(';'), ...rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(';'))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportPrintHTML(title, contentHTML) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body { font-family: 'Quicksand', Arial, sans-serif; padding: 32px; color: #05056D; max-width: 800px; margin: 0 auto; }
      h1 { font-size: 1.3rem; color: #05056D; margin-bottom: 4px; }
      h2 { font-size: 1rem; color: #FF3285; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
      .field { margin-bottom: 12px; }
      .field-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #6B6B9A; margin-bottom: 2px; }
      .field-value { font-size: 0.9rem; line-height: 1.5; padding: 8px 0; border-bottom: 1px solid #CFD0E5; }
      .meta { font-size: 0.8rem; color: #6B6B9A; margin-bottom: 20px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; }
      @media print { body { padding: 16px; } }
    </style>
  </head><body>${contentHTML}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 300);
}
