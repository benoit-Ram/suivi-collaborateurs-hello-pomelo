import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export default function Dashboard() {
  const [collabs, setCollabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getCollaborateurs().then(data => { setCollabs(data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Chargement...</div>;

  const total = collabs.length;
  const now = new Date();
  const thisMonth = collabs.filter(c => c.date_entree && new Date(c.date_entree).getMonth() === now.getMonth() && new Date(c.date_entree).getFullYear() === now.getFullYear()).length;
  const managers = new Set(collabs.map(c => c.manager_id).filter(Boolean)).size;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tableau de bord</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: 4 }}>Vue d'ensemble de vos collaborateurs</p>
      </div>
      <div className="divider" />

      <div className="stats-grid">
        <div className="stat-card" style={{ borderColor: 'var(--pink)' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--navy)' }}>{total}</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Collaborateurs</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'var(--blue)' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--navy)' }}>{thisMonth}</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Arrivées ce mois</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'var(--skyblue)' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--navy)' }}>{managers}</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Managers</div>
        </div>
        <div className="stat-card" style={{ borderColor: 'var(--green)' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--navy)' }}>{total}</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 }}>Actifs</div>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 28 }}>Collaborateurs</div>
      <div className="collab-grid">
        {collabs.map(c => (
          <div key={c.id} className="card" onClick={() => navigate(`/admin/collaborateurs/${c.id}`)}
            style={{ cursor: 'pointer', padding: 20, transition: 'all 0.2s', border: '2px solid transparent' }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--lavender)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'transparent'; }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, var(--pink), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem', fontWeight: 700, marginBottom: 12 }}>
              {((c.prenom||'')[0]||'').toUpperCase()}{((c.nom||'')[0]||'').toUpperCase()}
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)' }}>{c.prenom} {c.nom}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>{c.poste}</div>
            {c.equipe && <div style={{ fontSize: '0.72rem', color: 'var(--lilac)', marginTop: 6, fontWeight: 600 }}>{c.equipe}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
