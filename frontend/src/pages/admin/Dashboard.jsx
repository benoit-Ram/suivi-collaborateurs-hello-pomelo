import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
import { Avatar, StatCard, PageHeader, EmptyState, currentMois, moisLabel } from '../../components/UI';

export default function Dashboard() {
  const { collabs, absences, loading } = useData();
  const [search, setSearch] = useState('');
  const [filterEquipe, setFilterEquipe] = useState('');
  const navigate = useNavigate();

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Chargement...</div>;

  const total = collabs.length;
  const now = new Date();
  const cm = currentMois();
  const thisMonth = collabs.filter(c => c.date_entree && new Date(c.date_entree).getMonth() === now.getMonth() && new Date(c.date_entree).getFullYear() === now.getFullYear()).length;
  const pendingAbs = absences.filter(a => a.statut === 'en_attente').length;
  const pointsComplete = collabs.filter(c => {
    const p = (c.points_suivi || []).find(x => x.mois === cm);
    if (!p) return false;
    const md = p.manager_data || {};
    const cd = p.collab_data || {};
    return Object.keys(md).some(k => k !== 'objectifs' && md[k]) && Object.keys(cd).some(k => k !== 'objectifs' && cd[k]);
  }).length;

  const equipes = [...new Set(collabs.map(c => c.equipe).filter(Boolean).flatMap(e => e.split(',')))];
  const filtered = collabs.filter(c => {
    if (search && !(c.prenom + ' ' + c.nom + ' ' + c.poste).toLowerCase().includes(search.toLowerCase())) return false;
    if (filterEquipe && !(c.equipe || '').split(',').includes(filterEquipe)) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de vos collaborateurs" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard value={total} label="Collaborateurs" color="pink" />
        <StatCard value={thisMonth} label="Arrivées ce mois" color="blue" />
        <StatCard value={`${pointsComplete}/${total}`} label="Points complets" color="skyblue" />
        <StatCard value={pendingAbs} label="Congés en attente" color="orange" />
      </div>

      <div className="section-title">Collaborateurs</div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, border: '1.5px solid var(--lavender)', borderRadius: 10, padding: '10px 16px', fontFamily: 'inherit', fontSize: '0.9rem', color: 'var(--navy)', background: 'white', outline: 'none' }} />
        <select value={filterEquipe} onChange={e => setFilterEquipe(e.target.value)}
          style={{ border: '1.5px solid var(--lavender)', borderRadius: 10, padding: '8px 12px', fontFamily: 'inherit', fontSize: '0.82rem', color: 'var(--navy)', background: 'white' }}>
          <option value="">Toutes les équipes</option>
          {equipes.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600, alignSelf: 'center' }}>
          {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="👤" text="Aucun collaborateur trouvé" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {filtered.map(c => (
            <div key={c.id} className="card" onClick={() => navigate(`/admin/collaborateurs/${c.id}`)}
              style={{ cursor: 'pointer', padding: 20, transition: 'all 0.2s', border: '2px solid transparent' }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--lavender)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'transparent'; }}>
              <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={48} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)', marginTop: 10 }}>{c.prenom} {c.nom}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>{c.poste}</div>
              {c.equipe && <div style={{ fontSize: '0.72rem', color: 'var(--lilac)', marginTop: 6, fontWeight: 600 }}>{c.equipe}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
