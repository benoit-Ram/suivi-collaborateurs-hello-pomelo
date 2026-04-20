import React, { useState, useEffect, useCallback } from 'react';

// ── AVATAR with tooltip ──
export function Avatar({ prenom, nom, photoUrl, size = 40, tooltip = true }) {
  const initials = ((prenom||'')[0]||'').toUpperCase() + ((nom||'')[0]||'').toUpperCase();
  const fullName = `${prenom||''} ${nom||''}`.trim();
  const style = { width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 };
  if (photoUrl) return <img src={photoUrl} alt={fullName} title={tooltip ? fullName : undefined} style={style} />;
  const fs = size < 36 ? '0.7rem' : size < 56 ? '1rem' : '1.4rem';
  return (
    <div title={tooltip ? fullName : undefined} style={{ ...style, background: 'linear-gradient(135deg, var(--pink), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: fs, fontWeight: 700 }}>
      {initials}
    </div>
  );
}

// ── BADGE with team colors ──
const TEAM_COLORS = { Direction:'#05056D', Growth:'#FF3285', Product:'#5BB6F4', Tech:'#0000EA', Design:'#8F8FBC', 'e-commerce':'#F97316', ERP:'#22C55E', RH:'#EF4444', Devs:'#0000EA' };
export function Badge({ type, team, children }) {
  if (team && TEAM_COLORS[team]) {
    return <span style={{ padding:'3px 8px', borderRadius:6, fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', background: TEAM_COLORS[team]+'20', color: TEAM_COLORS[team] }}>{children}</span>;
  }
  const cls = { green:'badge-green', orange:'badge-orange', blue:'badge-blue', pink:'badge-pink', gray:'badge-gray' };
  return <span className={`badge ${cls[type]||'badge-gray'}`}>{children}</span>;
}

// ── STAT CARD ──
export function StatCard({ value, label, color }) {
  return (
    <div className="stat-card" style={{ borderColor: `var(--${color})` }}>
      <div className="stat-num" style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)', fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 'clamp(0.65rem, 2vw, 0.75rem)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── PAGE HEADER with breadcrumbs ──
export function PageHeader({ title, subtitle, breadcrumbs }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {breadcrumbs && (
        <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:8, fontSize:'0.78rem', color:'var(--muted)', fontWeight:600 }}>
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ opacity:0.4 }}>›</span>}
              {b.to ? <a href={b.to} style={{ color:'var(--muted)', textDecoration:'none' }} onMouseOver={e=>e.target.style.color='var(--pink)'} onMouseOut={e=>e.target.style.color='var(--muted)'}>{b.label}</a> : <span style={{ color:'var(--navy)' }}>{b.label}</span>}
            </React.Fragment>
          ))}
        </div>
      )}
      <h1 style={{ fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h1>
      {subtitle && <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: 4 }}>{subtitle}</p>}
      <div className="divider" />
    </div>
  );
}

// ── EMPTY STATE ──
export function EmptyState({ icon, text, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: '3rem', marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: action ? 16 : 0 }}>{text}</p>
      {action}
    </div>
  );
}

// ── PROGRESS BAR ──
export function ProgressBar({ value, color }) {
  return (
    <div className="progress-wrap">
      <div className="progress-bar" style={{ width: `${value}%`, background: color || 'linear-gradient(90deg, var(--pink), var(--blue))', transition: 'width 0.4s ease' }} />
    </div>
  );
}

// ── MODAL with Escape key ──
export function Modal({ open, onClose, title, children, wide, size }) {
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay-react" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content-react" style={{ maxWidth: size==='xl' ? 900 : size==='lg' ? 720 : wide ? 620 : 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h2>
          <button onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── CONFIRM MODAL ──
export function ConfirmModal({ open, onClose, onConfirm, message }) {
  if (!open) return null;
  return (
    <div className="modal-overlay-react" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content-react" style={{ maxWidth: 400 }}>
        <div style={{ fontSize:'0.95rem', fontWeight:700, color:'var(--navy)', marginBottom:6 }}>Confirmation</div>
        <div style={{ fontSize:'0.88rem', color:'var(--muted)', lineHeight:1.6, marginBottom:20 }}>{message}</div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-danger" onClick={() => { onConfirm(); onClose(); }}>Confirmer</button>
        </div>
      </div>
    </div>
  );
}

// ── TOAST with animation ──
export function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{ position:'fixed', bottom:24, right:24, background:'var(--navy)', color:'var(--white)', padding:'12px 20px', borderRadius:12, fontSize:'0.85rem', fontWeight:700, boxShadow:'0 8px 24px rgba(5,5,109,0.3)', zIndex:500, animation:'slideUp 0.3s ease' }}>
      ✓ {message}
    </div>
  );
}

// ── SKELETON LOADER ──
export function Skeleton({ lines = 3 }) {
  return (
    <div style={{ padding: 24 }}>
      {Array(lines).fill(0).map((_, i) => (
        <div key={i} style={{ height: i===0?20:14, background:'linear-gradient(90deg, var(--lavender) 25%, var(--shimmer-mid) 50%, var(--lavender) 75%)', backgroundSize:'200%', borderRadius:6, marginBottom:10, width: i===0?'60%':i===1?'80%':'45%', animation:'shimmer 1.5s infinite' }} />
      ))}
    </div>
  );
}

// ── TEXTAREA with character count ──
export function TextareaWithCount({ value, onChange, maxLength = 500, ...props }) {
  return (
    <div style={{ position:'relative' }}>
      <textarea value={value} onChange={onChange} maxLength={maxLength} {...props} />
      <span style={{ position:'absolute', bottom:8, right:12, fontSize:'0.68rem', color:'var(--muted)', fontWeight:600 }}>{(value||'').length}/{maxLength}</span>
    </div>
  );
}

// ── FADE IN WRAPPER ──
export function FadeIn({ children }) {
  return <div style={{ animation: 'fadeIn 0.25s ease' }}>{children}</div>;
}

// ── CONSTANTS ──
export const STATUS_LABELS = { 'en-cours': 'En cours', 'atteint': 'Atteint ✓', 'non-atteint': 'Non atteint', 'en-attente': 'En attente' };
export const STATUS_COLORS = { 'en-cours': 'blue', 'atteint': 'green', 'non-atteint': 'orange', 'en-attente': 'gray' };
/** Form field wrapper: label (with optional required *), children (input/select/textarea), optional hint.
 * Replaces the inline pattern `<div className="form-field"><label>...</label><input/></div>`.
 * Props: label, required, hint, full (spans both grid columns), children, labelFor. */
export function FormField({ label, required, hint, full, labelFor, children }) {
  return (
    <div className={full ? 'form-field full' : 'form-field'}>
      {label != null && (
        <label htmlFor={labelFor}>
          {label}
          {required && <span style={{ color: 'var(--red)' }}> *</span>}
        </label>
      )}
      {children}
      {hint && <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/** Consistent tabs component used across admin pages (Missions, Absences, CollabProfile, ...).
 * Props: items = [[key, label], ...] or [{key, label, badge}], active, onChange, compact. */
export function Tabs({ items, active, onChange, compact = false, scrollable = true }) {
  const normalized = (items || []).map(it => Array.isArray(it) ? { key: it[0], label: it[1] } : it);
  return (
    <div className={scrollable ? 'tabs-scroll' : ''} style={{ display: 'flex', gap: 6, marginBottom: compact ? 12 : 24, background: 'var(--offwhite)', padding: 6, borderRadius: 12, overflowX: scrollable ? 'auto' : 'visible' }}>
      {normalized.map(t => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              position: 'relative',
              flex: '1 0 auto',
              padding: compact ? '8px 12px' : '10px 14px',
              borderRadius: 10,
              fontFamily: 'inherit',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: isActive ? 'var(--pink)' : 'transparent',
              color: isActive ? 'var(--white)' : 'var(--muted)',
              border: isActive ? 'none' : '1.5px solid var(--lavender)',
              boxShadow: isActive ? '0 4px 14px rgba(255,50,133,0.3)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--orange)', color: 'var(--white)', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, boxShadow: '0 2px 6px rgba(249,115,22,0.4)' }}>{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** HTML-escape user-supplied text before injecting it into a document.write() or innerHTML sink.
 * Prevents XSS when exporting PDFs (notes, objectifs, entretien answers). */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Default absence types (used as fallback if settings not loaded)
export const ABS_TYPES = { conge: 'Congé payé', sans_solde: 'Sans solde', maladie: 'Maladie', formation: 'Formation / Cours' };
export const ABS_STATUTS = { en_attente: 'En attente', approuve: 'Approuvé', refuse: 'Refusé', annulation_demandee: 'Annulation demandée', annule: 'Annulé' };

// Default absence type configs with decompte_solde flag
export const DEFAULT_ABSENCE_TYPES = [
  { key: 'conge', label: 'Congé payé', decompte: true },
  { key: 'sans_solde', label: 'Sans solde', decompte: false },
  { key: 'maladie', label: 'Maladie', decompte: false },
  { key: 'formation', label: 'Formation / Cours', decompte: false },
];

/** Build ABS_TYPES map from settings or defaults */
export function getAbsenceTypes(settings) {
  const types = settings?.absence_types || DEFAULT_ABSENCE_TYPES;
  const map = {};
  types.forEach(t => { map[t.key] = t.label; });
  return map;
}

/** Check if an absence type deducts from balance */
export function absenceDeductsSolde(type, settings) {
  const types = settings?.absence_types || DEFAULT_ABSENCE_TYPES;
  const t = types.find(x => x.key === type);
  return t ? t.decompte : false;
}

// ── UTILS ──
export function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ── WORK DAYS CALCULATION (excludes weekends + French holidays) ──
const FERIES_FIXES = [[1,1],[5,1],[5,8],[7,14],[8,15],[11,1],[11,11],[12,25]];

function getEasterDate(year) {
  // Oudin's algorithm — verified correct for 2024-2033+
  const c = Math.floor(year / 100);
  const n = year - 19 * Math.floor(year / 19);
  const k = Math.floor((c - 17) / 25);
  let i = c - Math.floor(c / 4) - Math.floor((c - k) / 3) + 19 * n + 15;
  i = i - 30 * Math.floor(i / 30);
  i = i - Math.floor(i / 28) * (1 - Math.floor(i / 28) * Math.floor(29 / (i + 1)) * Math.floor((21 - n) / 11));
  let j = year + Math.floor(year / 4) + i + 2 - c + Math.floor(c / 4);
  j = j - 7 * Math.floor(j / 7);
  const l = i - j;
  const month = 3 + Math.floor((l + 40) / 44);
  const day = l + 28 - 31 * Math.floor(month / 4);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function getFeriesSet(year) {
  const set = new Set();
  FERIES_FIXES.forEach(([m,d]) => set.add(`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`));
  const easter = getEasterDate(year);
  // Dimanche de Pâques + Lundi de Pâques + Ascension (jeu +39) + Lundi de Pentecôte (+50)
  [0, 1, 39, 50].forEach(offset => {
    const d2 = new Date(easter.getTime()); d2.setDate(easter.getDate() + offset);
    set.add(d2.toISOString().split('T')[0]);
  });
  return set;
}

export function countWorkDays(d1, d2) {
  if (!d1 || !d2) return 0;
  let count = 0;
  const start = new Date(d1);
  const end = new Date(d2);
  const years = new Set();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) years.add(d.getFullYear());
  const feries = new Set();
  years.forEach(y => getFeriesSet(y).forEach(f => feries.add(f)));
  for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && !feries.has(d.toISOString().split('T')[0])) count++;
  }
  return count;
}

export function currentMois() {
  const n = new Date();
  return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
}

export function moisLabel(mois) {
  if (!mois) return '—';
  const [y, m] = mois.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** Count days for an absence record (handles demi_journee) */
export function absenceDays(a) {
  if (!a || !a.date_debut || !a.date_fin) return 0;
  if (a.demi_journee) return 0.5;
  return countWorkDays(a.date_debut, a.date_fin);
}

/** Get absence days for a collab within a date range (only approved) */
export function getAbsenceDays(collabId, rangeStart, rangeEnd, absences) {
  if (!collabId || !rangeStart || !rangeEnd || !absences) return 0;
  let total = 0;
  absences.filter(a => a.collaborateur_id === collabId).forEach(a => {
    if (!a.date_debut || !a.date_fin) return;
    // Overlap between absence and query range
    const start = a.date_debut > rangeStart ? a.date_debut : rangeStart;
    const end = a.date_fin < rangeEnd ? a.date_fin : rangeEnd;
    if (start > end) return;
    if (a.demi_journee) { total += 0.5; return; }
    total += countWorkDays(start, end);
  });
  return total;
}

/** Calculate leave balance for a collaborateur.
 * `solde_conges` = balance as of `solde_reference_date` (or `date_entree` if no manual edit).
 * Accrual and taken days are counted from that anchor onward. */
export function calculateSolde(collab, absences, settings) {
  const soldeInit = collab.solde_conges || 0;
  const acq = collab.acquisition_conges || 2.08;
  const anchor = collab.solde_reference_date || collab.date_entree;
  let moisAcq = 0;
  if (anchor) {
    const e = new Date(anchor);
    const n = new Date();
    moisAcq = Math.max(0, (n.getFullYear() - e.getFullYear()) * 12 + (n.getMonth() - e.getMonth()));
  }
  const acquis = Math.round(moisAcq * acq * 100) / 100;
  const anchorStr = anchor ? (typeof anchor === 'string' ? anchor : new Date(anchor).toISOString().split('T')[0]) : null;
  const pris = (absences || [])
    .filter(a => a.statut === 'approuve' && absenceDeductsSolde(a.type, settings))
    .filter(a => !anchorStr || (a.date_debut && a.date_debut >= anchorStr))
    .reduce((s, a) => s + absenceDays(a), 0);
  return { soldeInit, acq, moisAcq, acquis, pris, anchor: anchorStr, solde: Math.round((soldeInit + acquis - pris) * 100) / 100 };
}

// ── ENTRETIEN RH HELPERS ──
export function isEntretienLocked(mois) {
  if (!mois) return false;
  const [year, month] = mois.split('-').map(Number);
  // Verrouillé le 5 du mois suivant
  return new Date() >= new Date(year, month, 5);
}

/** Days remaining before a mensuel entretien locks on the 5th of month after `mois`.
 * Returns null if already locked or no mois provided. */
export function daysUntilEntretienLock(mois) {
  if (!mois) return null;
  const [year, month] = mois.split('-').map(Number);
  const lockDate = new Date(year, month, 5); // 5th of month after `mois`
  const now = new Date();
  if (now >= lockDate) return null;
  return Math.ceil((lockDate - now) / 86400000);
}

export function getEntretienStatus(point) {
  const md = point.manager_data || {};
  const cd = point.collab_data || {};
  const mdKeys = Object.keys(md).filter(k => k !== 'objectifs');
  const cdKeys = Object.keys(cd).filter(k => k !== 'objectifs');
  const managerDone = mdKeys.length > 0 && mdKeys.some(k => md[k] && String(md[k]).trim());
  const collabDone = cdKeys.length > 0 && cdKeys.some(k => cd[k] && String(cd[k]).trim());
  if (managerDone && collabDone) return 'complet';
  if (managerDone || collabDone) return 'partiel';
  return 'vide';
}

export const ENTRETIEN_STATUS_BADGE = {
  complet: { label: '✅ Complet', type: 'green' },
  partiel: { label: '🟡 Partiel', type: 'orange' },
  vide: { label: '🔴 À remplir', type: 'pink' }
};

// ── KEYBOARD SHORTCUT HOOK ──
export function useKeyboard(key, callback) {
  useEffect(() => {
    const handler = e => {
      if (key === 'ctrl+k' && e.ctrlKey && e.key === 'k') { e.preventDefault(); callback(); }
      else if (key === 'Escape' && e.key === 'Escape') callback();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback]);
}
