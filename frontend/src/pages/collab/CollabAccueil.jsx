import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Avatar, Badge, ProgressBar, fmtDate, moisLabel, currentMois, STATUS_LABELS, STATUS_COLORS, ABS_TYPES } from '../../components/UI';

export default function CollabAccueil() {
  const [collabs, setCollabs] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCollaborateurs().then(data => { setCollabs(data || []); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Chargement...</div>;

  if (!selectedId) {
    return (
      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Choisir un compte</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 20 }}>Sélectionnez un collaborateur pour accéder à son espace.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {collabs.map(c => (
            <div key={c.id} className="card" onClick={() => setSelectedId(c.id)} style={{ cursor: 'pointer', padding: 16, transition: 'all 0.15s', border: '2px solid transparent' }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--pink)'} onMouseOut={e => e.currentTarget.style.borderColor = 'transparent'}>
              <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={36} />
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--navy)', marginTop: 8 }}>{c.prenom} {c.nom}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{c.poste}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const c = collabs.find(x => x.id === selectedId);
  if (!c) return null;

  const objs = c.objectifs || [];
  const enCours = objs.filter(o => o.statut === 'en-cours').length;
  const atteints = objs.filter(o => o.statut === 'atteint').length;
  const cm = currentMois();
  const point = (c.points_suivi || []).find(p => p.mois === cm);

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => setSelectedId('')} style={{ marginBottom: 16 }}>← Changer de compte</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, background: 'linear-gradient(135deg, #F0F0FF, #FFF0F8)', borderRadius: 16, padding: 24, border: '1.5px solid #E0D8FF' }}>
        <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={64} />
        <div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy)' }}>{c.prenom} {c.nom}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 2 }}>{c.poste}</div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>Bonjour {c.prenom} 👋</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center', padding: 18 }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--pink)' }}>{enCours}</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Objectifs en cours</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 18 }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--green)' }}>{atteints}</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Atteints</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 18 }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--navy)' }}>{(c.solde_conges || 0)}j</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Congés restants</div>
        </div>
      </div>

      {objs.filter(o => o.statut === 'en-cours').length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title" style={{ marginTop: 0 }}>🎯 Objectifs en cours</div>
          {objs.filter(o => o.statut === 'en-cours').map(o => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--lavender)' }}>
              <div style={{ flex: 1, fontWeight: 600, fontSize: '0.88rem', color: 'var(--navy)' }}>{o.titre}</div>
              <div style={{ minWidth: 50, textAlign: 'right', fontWeight: 700, fontSize: '0.82rem', color: 'var(--pink)' }}>{o.progression || 0}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
