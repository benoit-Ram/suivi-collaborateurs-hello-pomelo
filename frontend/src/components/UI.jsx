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
      <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', marginTop: 4 }}>{label}</div>
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
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h1>
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
export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay-react" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content-react" style={{ maxWidth: wide ? 620 : 560 }}>
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
    <div style={{ position:'fixed', bottom:24, right:24, background:'#05056D', color:'white', padding:'12px 20px', borderRadius:12, fontSize:'0.85rem', fontWeight:700, boxShadow:'0 8px 24px rgba(5,5,109,0.3)', zIndex:500, animation:'slideUp 0.3s ease' }}>
      ✓ {message}
    </div>
  );
}

// ── SKELETON LOADER ──
export function Skeleton({ lines = 3 }) {
  return (
    <div style={{ padding: 24 }}>
      {Array(lines).fill(0).map((_, i) => (
        <div key={i} style={{ height: i===0?20:14, background:'linear-gradient(90deg, var(--lavender) 25%, #E8E8F0 50%, var(--lavender) 75%)', backgroundSize:'200%', borderRadius:6, marginBottom:10, width: i===0?'60%':i===1?'80%':'45%', animation:'shimmer 1.5s infinite' }} />
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
export const ABS_TYPES = { conge: 'Congé', sans_solde: 'Sans solde' };
export const ABS_STATUTS = { en_attente: 'En attente', approuve: 'Approuvé', refuse: 'Refusé' };

// ── UTILS ──
export function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
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

// ── ENTRETIEN RH HELPERS ──
export function isEntretienLocked(mois) {
  if (!mois) return false;
  const [year, month] = mois.split('-').map(Number);
  // Verrouillé le 5 du mois suivant
  return new Date() >= new Date(year, month, 5);
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
