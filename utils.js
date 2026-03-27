// ─────────────────────────────────────────
// UTILITAIRES PARTAGÉS — Hello Pomelo
// index.html + collaborateur.html
// ─────────────────────────────────────────

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
