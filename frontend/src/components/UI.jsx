import React from 'react';

export function Avatar({ prenom, nom, photoUrl, size = 40 }) {
  const initials = ((prenom||'')[0]||'').toUpperCase() + ((nom||'')[0]||'').toUpperCase();
  if (photoUrl) return <img src={photoUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  const fs = size < 36 ? '0.7rem' : size < 56 ? '1rem' : '1.4rem';
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, var(--pink), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: fs, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

export function Badge({ type, children }) {
  const cls = { green: 'badge-green', orange: 'badge-orange', blue: 'badge-blue', pink: 'badge-pink', gray: 'badge-gray' };
  return <span className={`badge ${cls[type] || 'badge-gray'}`}>{children}</span>;
}

export function StatCard({ value, label, color }) {
  return (
    <div className="stat-card" style={{ borderColor: `var(--${color})` }}>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h1>
      {subtitle && <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: 4 }}>{subtitle}</p>}
      <div className="divider" />
    </div>
  );
}

export function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: '3rem', marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>{text}</p>
    </div>
  );
}

export function ProgressBar({ value, color }) {
  return (
    <div className="progress-wrap">
      <div className="progress-bar" style={{ width: `${value}%`, background: color || 'linear-gradient(90deg, var(--pink), var(--blue))' }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,109,0.4)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 32, maxWidth: wide ? 620 : 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(5,5,109,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#05056D', color: 'white', padding: '12px 20px', borderRadius: 12, fontSize: '0.85rem', fontWeight: 700, boxShadow: '0 8px 24px rgba(5,5,109,0.3)', zIndex: 500 }}>
      ✓ {message}
    </div>
  );
}

export const STATUS_LABELS = { 'en-cours': 'En cours', 'atteint': 'Atteint ✓', 'non-atteint': 'Non atteint', 'en-attente': 'En attente' };
export const STATUS_COLORS = { 'en-cours': 'blue', 'atteint': 'green', 'non-atteint': 'orange', 'en-attente': 'gray' };
export const ABS_TYPES = { conge: 'Congé', sans_solde: 'Sans solde' };
export const ABS_STATUTS = { en_attente: 'En attente', approuve: 'Approuvé', refuse: 'Refusé' };

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
