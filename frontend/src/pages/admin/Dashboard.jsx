import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
import { Avatar, StatCard, PageHeader, EmptyState, Badge, ProgressBar, Skeleton, currentMois, moisLabel, fmtDate, STATUS_LABELS, ABS_TYPES } from '../../components/UI';

export default function Dashboard() {
  const { collabs, absences, loading, settings } = useData();
  const [search, setSearch] = useState('');
  const [filterEquipe, setFilterEquipe] = useState('');
  const navigate = useNavigate();

  if (loading) return <div style={{maxWidth:600,margin:'40px auto'}}><Skeleton lines={5} /></div>;

  const total = collabs.length;
  const now = new Date();
  const cm = currentMois();
  const today = now.toISOString().split('T')[0];
  const thisMonth = collabs.filter(c => c.date_entree && new Date(c.date_entree).getMonth() === now.getMonth() && new Date(c.date_entree).getFullYear() === now.getFullYear()).length;
  const pendingAbs = absences.filter(a => a.statut === 'en_attente').length;

  // Points completion
  const pointsComplete = collabs.filter(c => {
    const p = (c.points_suivi || []).find(x => x.mois === cm && x.type === 'mensuel');
    if (!p) return false;
    const md = p.manager_data || {};
    const cd = p.collab_data || {};
    const mdDone = Object.keys(md).filter(k=>k!=='objectifs').some(k=>md[k]);
    const cdDone = Object.keys(cd).filter(k=>k!=='objectifs').some(k=>cd[k]);
    return mdDone && cdDone;
  }).length;

  // Previous month alerts
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevMois = prevYear + '-' + String(prevMonth).padStart(2, '0');

  const alerts = [];
  collabs.forEach(c => {
    const prevPoint = (c.points_suivi||[]).find(p => p.mois === prevMois && p.type === 'mensuel');
    if (prevPoint) {
      const md = prevPoint.manager_data || {};
      const cd = prevPoint.collab_data || {};
      const mdDone = Object.keys(md).filter(k=>k!=='objectifs').some(k=>md[k]);
      const cdDone = Object.keys(cd).filter(k=>k!=='objectifs').some(k=>cd[k]);
      if (!mdDone && !cdDone) alerts.push({ type:'danger', icon:'🔴', text:`${c.prenom} ${c.nom} — Point ${moisLabel(prevMois)} non rempli`, id:c.id, email:c.email, prenom:c.prenom });
      else if (!mdDone) alerts.push({ type:'warning', icon:'🟡', text:`${c.prenom} ${c.nom} — Retours manager manquants ${moisLabel(prevMois)}`, id:c.id });
      else if (!cdDone) alerts.push({ type:'warning', icon:'🟡', text:`${c.prenom} ${c.nom} — Réponses collab manquantes ${moisLabel(prevMois)}`, id:c.id, email:c.email, prenom:c.prenom });
    }
    // Expired objectives
    (c.objectifs||[]).forEach(o => {
      if (o.statut === 'en-cours' && o.date_fin && o.date_fin < today) {
        alerts.push({ type:'danger', icon:'🎯', text:`${c.prenom} ${c.nom} — Objectif "${o.titre}" expiré depuis ${fmtDate(o.date_fin)}`, id:c.id });
      }
    });
    // Trial period
    if (c.date_fin_essai) {
      const days = Math.ceil((new Date(c.date_fin_essai) - now) / 86400000);
      if (days >= 0 && days <= 30) alerts.push({ type:'danger', icon:'⏰', text:`${c.prenom} ${c.nom} — Fin période d'essai dans ${days}j`, id:c.id });
    }
  });

  // Analytics
  const allObjs = collabs.flatMap(c => c.objectifs||[]);
  const objByStatus = { 'en-cours':0, 'atteint':0, 'non-atteint':0, 'en-attente':0 };
  allObjs.forEach(o => { objByStatus[o.statut] = (objByStatus[o.statut]||0)+1; });
  const maxObj = Math.max(...Object.values(objByStatus), 1);
  const objColors = { 'en-cours':'var(--blue)', 'atteint':'var(--green)', 'non-atteint':'var(--orange)', 'en-attente':'var(--lavender)' };

  const teamCounts = {};
  collabs.forEach(c => { (c.equipe||'Non assigné').split(',').forEach(e => { teamCounts[e.trim()] = (teamCounts[e.trim()]||0)+1; }); });
  const maxTeam = Math.max(...Object.values(teamCounts), 1);
  const teamColors = ['var(--pink)','var(--blue)','var(--skyblue)','var(--green)','var(--orange)','var(--lilac)'];

  // Trend (last 6 months)
  const trendMonths = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    trendMonths.push(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'));
  }
  const trendData = trendMonths.map(m => {
    const complete = collabs.filter(c => {
      const p = (c.points_suivi||[]).find(x => x.mois === m && x.type === 'mensuel');
      if (!p) return false;
      const md = p.manager_data||{};
      const cd = p.collab_data||{};
      return Object.keys(md).filter(k=>k!=='objectifs').some(k=>md[k]) && Object.keys(cd).filter(k=>k!=='objectifs').some(k=>cd[k]);
    }).length;
    return { month: moisLabel(m), pct: total > 0 ? Math.round(complete/total*100) : 0 };
  });

  const equipes = [...new Set(collabs.map(c => c.equipe).filter(Boolean).flatMap(e => e.split(',')))];
  const filtered = collabs.filter(c => {
    if (search && !(c.prenom+' '+c.nom+' '+c.poste).toLowerCase().includes(search.toLowerCase())) return false;
    if (filterEquipe && !(c.equipe||'').split(',').includes(filterEquipe)) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de vos collaborateurs" />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:16, marginBottom:24 }}>
        <StatCard value={total} label="Collaborateurs" color="pink" />
        <StatCard value={thisMonth} label="Arrivées ce mois" color="blue" />
        <StatCard value={`${pointsComplete}/${total}`} label="Points complets" color="skyblue" />
        <StatCard value={pendingAbs} label="Congés en attente" color="orange" />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="card" style={{ marginBottom:24, borderLeft:'4px solid var(--orange)', padding:'20px 24px' }}>
          <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--navy)', marginBottom:12, textTransform:'uppercase' }}>⚠️ Actions requises ({alerts.length})</h3>
          {alerts.slice(0,10).map((a,i) => (
            <div key={i} onClick={() => navigate(`/admin/collaborateurs/${a.id}`)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, marginBottom:6, fontSize:'0.82rem', fontWeight:600, cursor:'pointer', background: a.type==='danger'?'var(--bg-danger)':a.type==='warning'?'var(--bg-warning)':'var(--bg-info)', color: a.type==='danger'?'var(--text-danger)':a.type==='warning'?'var(--text-warning)':'var(--text-info)' }}>
              <span>{a.icon}</span>
              <span style={{ flex:1 }}>{a.text}</span>
              {a.email && <a href={`mailto:${a.email}?subject=Rappel — Point de suivi ${moisLabel(prevMois)}&body=Bonjour ${a.prenom||''},\n\nN'oublie pas de compléter ton point de suivi.\n\nMerci !`} onClick={e=>e.stopPropagation()} className="btn btn-navy btn-sm" style={{ padding:'3px 8px', fontSize:'0.68rem' }}>📧</a>}
            </div>
          ))}
        </div>
      )}

      {/* Analytics */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16, marginBottom:24 }}>
        <div className="card">
          <div className="section-title" style={{marginTop:0}}>Objectifs par statut</div>
          {Object.entries(objByStatus).map(([k,v]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--navy)', minWidth:90, textAlign:'right' }}>{STATUS_LABELS[k]}</span>
              <div style={{ flex:1, height:22, background:'var(--offwhite)', borderRadius:6, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.round(v/maxObj*100)}%`, background:objColors[k], borderRadius:6, display:'flex', alignItems:'center', paddingLeft:8, fontSize:'0.7rem', fontWeight:700, color:'white', minWidth: v?24:0 }}>{v||''}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="section-title" style={{marginTop:0}}>Répartition par équipe</div>
          {Object.entries(teamCounts).sort((a,b)=>b[1]-a[1]).map(([k,v],i) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--navy)', minWidth:90, textAlign:'right' }}>{k}</span>
              <div style={{ flex:1, height:22, background:'var(--offwhite)', borderRadius:6, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${Math.round(v/maxTeam*100)}%`, background:teamColors[i%teamColors.length], borderRadius:6, display:'flex', alignItems:'center', paddingLeft:8, fontSize:'0.7rem', fontWeight:700, color:'white', minWidth:24 }}>{v}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trend */}
      <div className="card" style={{ marginBottom:24 }}>
        <div className="section-title" style={{marginTop:0}}>📊 Complétion points mensuels (6 mois)</div>
        {trendData.map(d => (
          <div key={d.month} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--navy)', minWidth:100, textAlign:'right', textTransform:'capitalize' }}>{d.month}</span>
            <div style={{ flex:1, height:22, background:'var(--offwhite)', borderRadius:6, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${d.pct}%`, background: d.pct>=80?'var(--green)':d.pct>=50?'var(--orange)':'var(--pink)', borderRadius:6, display:'flex', alignItems:'center', paddingLeft:8, fontSize:'0.7rem', fontWeight:700, color:'white', minWidth:d.pct?30:0 }}>{d.pct}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* Collaborateurs */}
      <div className="section-title">Collaborateurs</div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input type="text" placeholder="🔍 Rechercher..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:200, border:'1.5px solid var(--lavender)', borderRadius:10, padding:'10px 16px', fontFamily:'inherit', fontSize:'0.9rem', outline:'none', background:'var(--offwhite)', color:'var(--navy)' }} />
        <select value={filterEquipe} onChange={e => setFilterEquipe(e.target.value)} style={{ border:'1.5px solid var(--lavender)', borderRadius:10, padding:'8px 12px', fontFamily:'inherit', fontSize:'0.82rem', background:'var(--offwhite)', color:'var(--navy)' }}>
          <option value="">Toutes équipes</option>
          {equipes.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <span style={{ fontSize:'0.78rem', color:'var(--muted)', fontWeight:600, alignSelf:'center' }}>{filtered.length} résultat{filtered.length>1?'s':''}</span>
      </div>
      {filtered.length === 0 ? <EmptyState icon="👤" text="Aucun collaborateur trouvé" /> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
          {filtered.map(c => (
            <div key={c.id} className="card" onClick={() => navigate(`/admin/collaborateurs/${c.id}`)} style={{ cursor:'pointer', padding:20, transition:'all 0.2s', border:'2px solid transparent' }}
              onMouseOver={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.borderColor='var(--lavender)'; }}
              onMouseOut={e => { e.currentTarget.style.transform=''; e.currentTarget.style.borderColor='transparent'; }}>
              <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={48} />
              <div style={{ fontWeight:700, fontSize:'0.95rem', color:'var(--navy)', marginTop:10 }}>{c.prenom} {c.nom}</div>
              <div style={{ fontSize:'0.78rem', color:'var(--muted)', marginTop:2 }}>{c.poste}</div>
              {c.equipe && <div style={{ fontSize:'0.72rem', color:'var(--lilac)', marginTop:6, fontWeight:600 }}>{c.equipe}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
