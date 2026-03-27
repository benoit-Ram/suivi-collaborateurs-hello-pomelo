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
const TOGGLABLE_DOCS = ['fichePoste', 'lettreObjectif', 'contrat'];

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

function currentMois() {
  const n = new Date();
  return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
}

function isPointLocked(mois) {
  const [year, month] = mois.split('-').map(Number);
  return new Date() >= new Date(year, month, 1);
}

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
