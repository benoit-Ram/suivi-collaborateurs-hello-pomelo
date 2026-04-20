import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
import { api } from '../../services/api';
import { Avatar, StatCard, PageHeader, EmptyState, Badge, ProgressBar, Skeleton, currentMois, moisLabel, fmtDate, getEntretienStatus, STATUS_LABELS, ABS_TYPES } from '../../components/UI';

export default function Dashboard() {
  const { collabs, absences, loading, settings } = useData();
  const [search, setSearch] = useState('');
  const [filterEquipe, setFilterEquipe] = useState('');
  const [staffingMoyen, setStaffingMoyen] = useState(null);
  const [missionAlerts, setMissionAlerts] = useState([]);
  const [missionStats, setMissionStats] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [objRequests, setObjRequests] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.getMissions().then(missions => {
      const todayStr = new Date().toISOString().split('T')[0];
      const now = new Date();
      // Current week key for override lookup
      const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const wn = Math.ceil(((mon - new Date(mon.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
      const weekKey = `${mon.getFullYear()}-W${String(wn).padStart(2, '0')}`;
      const getEffTaux = (a) => { const ov = a.staffing_overrides || {}; return ov[weekKey] !== undefined ? ov[weekKey] : (a.taux_staffing || 0); };

      const activeMissions = (missions||[]).filter(m => (!m.date_fin || m.date_fin >= todayStr));
      const taux = {};
      collabs.forEach(c => { taux[c.id] = 0; });
      activeMissions.forEach(m => {
        (m.assignments||[]).filter(a=>a.statut==='actif').forEach(a => {
          if (taux[a.collaborateur_id] !== undefined) taux[a.collaborateur_id] += getEffTaux(a);
        });
      });
      const vals = Object.values(taux);
      setStaffingMoyen(vals.length ? Math.round(vals.reduce((s,v)=>s+v,0)/vals.length) : 0);

      // Mission alerts
      const alerts = [];
      activeMissions.forEach(m => {
        if (m.date_fin) {
          const days = Math.ceil((new Date(m.date_fin) - now) / 86400000);
          if (days >= 0 && days <= 30) alerts.push({icon:'⏰',text:`${m.nom} termine dans ${days}j`,type:'warning',id:m.id});
        }
        if (m.budget_vendu) {
          const consumed = (m.assignments||[]).reduce((s,a) => { if (!a.date_debut||!a.tjm) return s; const w=Math.max(0,(Math.min(a.date_fin?new Date(a.date_fin):now,now)-new Date(a.date_debut))/(7*86400000)); return s+(a.tjm*(a.jours_par_semaine||a.taux_staffing/100*5)*w); },0);
          if (consumed > m.budget_vendu*0.9) alerts.push({icon:'💰',text:`${m.nom} : budget ${Math.round(consumed/m.budget_vendu*100)}%`,type:'danger',id:m.id});
        }
      });
      const nonStaffed = collabs.filter(c => !taux[c.id] || taux[c.id]===0);
      setMissionAlerts(alerts);
      setMissionStats({ active: activeMissions.length, total: (missions||[]).length, nonStaffed: nonStaffed.length });
    }).catch(e => console.error('Staffing load error:', e));
  }, [collabs]);

  useEffect(() => {
    api.getActivityLog(15).then(setActivityLog).catch(e => console.warn('Activity log fetch failed:', e.message));
    api.getObjectifRequests({statut:'en_attente'}).then(reqs => {
      // Admin sees only requests without a manager (manager handles their own)
      setObjRequests((reqs||[]).filter(r => !r.manager_id));
    }).catch(e => console.warn('Objectif requests fetch failed:', e.message));
  }, []);

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
    return p && getEntretienStatus(p) === 'complet';
  }).length;

  // Previous month alerts
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const prevMois = prevYear + '-' + String(prevMonth).padStart(2, '0');

  const alerts = [];
  collabs.forEach(c => {
    const prevPoint = (c.points_suivi||[]).find(p => p.mois === prevMois && p.type === 'mensuel');
    if (prevPoint) {
      const status = getEntretienStatus(prevPoint);
      const md = prevPoint.manager_data || {};
      const cd = prevPoint.collab_data || {};
      const mdDone = Object.keys(md).filter(k=>k!=='objectifs').some(k=>md[k] && String(md[k]).trim());
      const cdDone = Object.keys(cd).filter(k=>k!=='objectifs').some(k=>cd[k] && String(cd[k]).trim());
      if (status === 'vide') alerts.push({ type:'danger', icon:'🔴', text:`${c.prenom} ${c.nom} — Point ${moisLabel(prevMois)} non rempli`, id:c.id, email:c.email, prenom:c.prenom });
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
      return p && getEntretienStatus(p) === 'complet';
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

      <div className="mobile-grid-2" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:12, marginBottom:24 }}>
        <StatCard value={total} label="Collaborateurs" color="pink" />
        <StatCard value={thisMonth} label="Arrivées ce mois" color="blue" />
        <StatCard value={`${pointsComplete}/${total}`} label="Points complets" color="skyblue" />
        <StatCard value={pendingAbs} label="Congés en attente" color="orange" />
        {staffingMoyen !== null && <StatCard value={`${staffingMoyen}%`} label="Staffing moyen" color="blue" />}
      </div>

      {/* Alerts — grouped by type */}
      {(alerts.length > 0 || pendingAbs > 0) && (
        <div className="card" style={{ marginBottom:24, borderLeft:'4px solid var(--orange)', padding:'20px 24px' }}>
          <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:'var(--navy)', marginBottom:16, textTransform:'uppercase' }}>⚠️ Actions requises ({alerts.length + pendingAbs})</h3>

          {/* Congés en attente */}
          {pendingAbs > 0 && <>
            <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--orange)',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>🏖️ Conges en attente ({pendingAbs})<span style={{flex:1,height:1,background:'var(--lavender)'}} /></div>
            {absences.filter(a=>a.statut==='en_attente').slice(0,5).map(a => {
              const c = collabs.find(x=>x.id===a.collaborateur_id);
              return <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:10,marginBottom:6,background:'var(--bg-warning)',cursor:'pointer'}} onClick={()=>navigate('/admin/absences')}>
                {c && <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={28} />}
                <span style={{flex:1,fontSize:'0.82rem',fontWeight:600,color:'var(--text-warning)'}}>{c?`${c.prenom} ${c.nom}`:'—'} — {ABS_TYPES[a.type]||a.type} du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)}</span>
                <span style={{fontSize:'0.72rem',fontWeight:700,color:'var(--orange)'}}>Gérer →</span>
              </div>;
            })}
            {pendingAbs > 5 && <div style={{fontSize:'0.78rem',color:'var(--muted)',cursor:'pointer',marginBottom:8}} onClick={()=>navigate('/admin/absences')}>+ {pendingAbs-5} autres...</div>}
          </>}

          {/* Alertes points/objectifs/essai */}
          {alerts.length > 0 && <>
            <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--text-danger)',marginBottom:8,marginTop:pendingAbs?12:0,display:'flex',alignItems:'center',gap:6}}>📋 Suivi & objectifs ({alerts.length})<span style={{flex:1,height:1,background:'var(--lavender)'}} /></div>
            {alerts.slice(0,10).map((a,i) => (
              <div key={i} onClick={() => navigate(`/admin/collaborateurs/${a.id}`)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:10, marginBottom:6, fontSize:'0.82rem', fontWeight:600, cursor:'pointer', background: a.type==='danger'?'var(--bg-danger)':'var(--bg-warning)', color: a.type==='danger'?'var(--text-danger)':'var(--text-warning)' }}>
                <span>{a.icon}</span>
                <span style={{ flex:1 }}>{a.text}</span>
                <span style={{fontSize:'0.72rem',fontWeight:700}}>Voir →</span>
              </div>
            ))}
            {alerts.length > 10 && <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>+ {alerts.length-10} autres alertes</div>}
          </>}
        </div>
      )}

      {/* Missions summary */}
      {missionStats && (missionAlerts.length > 0 || missionStats.nonStaffed > 0) && (
        <div className="card" style={{marginBottom:24,borderLeft:'4px solid var(--blue)',padding:'20px 24px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <h3 style={{fontSize:'0.85rem',fontWeight:700,color:'var(--navy)',textTransform:'uppercase'}}>🚀 Missions ({missionStats.active} en cours)</h3>
            <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/admin/missions')}>Voir tout →</button>
          </div>
          {missionStats.nonStaffed > 0 && (
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:10,marginBottom:6,background:'var(--bg-info)',cursor:'pointer'}} onClick={()=>navigate('/admin/missions')}>
              <span>👤</span>
              <span style={{flex:1,fontSize:'0.82rem',fontWeight:600,color:'var(--text-info)'}}>{missionStats.nonStaffed} collaborateur{missionStats.nonStaffed>1?'s':''} non staffé{missionStats.nonStaffed>1?'s':''}</span>
            </div>
          )}
          {missionAlerts.map((a,i) => (
            <div key={i} onClick={()=>navigate('/admin/missions')} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:10,marginBottom:6,fontSize:'0.82rem',fontWeight:600,cursor:'pointer',background:a.type==='danger'?'var(--bg-danger)':'var(--bg-warning)',color:a.type==='danger'?'var(--text-danger)':'var(--text-warning)'}}>
              <span>{a.icon}</span><span style={{flex:1}}>{a.text}</span><span style={{fontSize:'0.72rem',fontWeight:700}}>Voir →</span>
            </div>
          ))}
        </div>
      )}

      {/* Objective progression requests */}
      {objRequests.length > 0 && (
        <div className="card" style={{marginBottom:24,borderLeft:'4px solid var(--green)',padding:'20px 24px'}}>
          <h3 style={{fontSize:'0.85rem',fontWeight:700,color:'var(--navy)',textTransform:'uppercase',marginBottom:12}}>📈 Demandes de progression ({objRequests.length})</h3>
          {objRequests.map(r => {
            const data = r.data || {};
            return <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--bg-info)',borderRadius:10,marginBottom:6,flexWrap:'wrap'}}>
              {r.collaborateurs && <Avatar prenom={r.collaborateurs.prenom} nom={r.collaborateurs.nom} photoUrl={r.collaborateurs.photo_url} size={28} />}
              <div style={{flex:1,minWidth:150}}>
                <div style={{fontWeight:700,fontSize:'0.82rem',color:'var(--navy)'}}>{r.objectifs?.titre||'—'}</div>
                <div style={{fontSize:'0.7rem',color:'var(--muted)'}}>
                  {r.collaborateurs?`${r.collaborateurs.prenom} ${r.collaborateurs.nom}`:'—'} · {data.ancienne_progression||0}% → <strong style={{color:'var(--blue)'}}>{data.progression||0}%</strong>
                  {r.motif && <span> — "{r.motif}"</span>}
                </div>
              </div>
              <div style={{display:'flex',gap:4}}>
                <button className="btn btn-primary btn-sm" style={{padding:'5px 10px',fontSize:'0.7rem'}} onClick={async()=>{try{await api.approveObjectifRequest(r.id);setObjRequests(prev=>prev.filter(x=>x.id!==r.id));showToast('Progression approuvée');}catch(e){showToast('Erreur: '+e.message);}}}>✓ Approuver</button>
                <button className="btn btn-danger btn-sm" style={{padding:'5px 10px',fontSize:'0.7rem'}} onClick={async()=>{const motif=prompt('Motif du refus :');if(motif!==null){try{await api.refuseObjectifRequest(r.id,motif);setObjRequests(prev=>prev.filter(x=>x.id!==r.id));showToast('Demande refusée');}catch(e){showToast('Erreur: '+e.message);}}}}>✕ Refuser</button>
              </div>
            </div>;
          })}
        </div>
      )}

      {/* Analytics */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:12, marginBottom:24 }}>
        <div className="card">
          <div className="section-title" style={{marginTop:0}}>Objectifs par statut</div>
          {Object.entries(objByStatus).map(([k,v]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--navy)', minWidth:70, textAlign:'right' }}>{STATUS_LABELS[k]}</span>
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
              <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--navy)', minWidth:70, textAlign:'right' }}>{k}</span>
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
            <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--navy)', minWidth:70, textAlign:'right', textTransform:'capitalize' }}>{d.month}</span>
            <div style={{ flex:1, height:22, background:'var(--offwhite)', borderRadius:6, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${d.pct}%`, background: d.pct>=80?'var(--green)':d.pct>=50?'var(--orange)':'var(--pink)', borderRadius:6, display:'flex', alignItems:'center', paddingLeft:8, fontSize:'0.7rem', fontWeight:700, color:'white', minWidth:d.pct?30:0 }}>{d.pct}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity log */}
      {activityLog.length > 0 && (
        <div className="card" style={{marginBottom:24}}>
          <div className="section-title" style={{marginTop:0}}>Activité récente</div>
          {activityLog.slice(0,10).map((a,i) => (
            <div key={a.id||i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<9?'1px solid var(--lavender)':'none',fontSize:'0.82rem'}}>
              <span style={{fontSize:'0.9rem'}}>{{
                'Création mission':'🚀','Modification mission':'✏️','Suppression mission':'🗑️',
                'Création client':'🏢','Modification client':'✏️','Suppression client':'🗑️',
                'Affectation collab':'👤','Retrait affectation':'❌'
              }[a.action]||'📋'}</span>
              <div style={{flex:1}}>
                <span style={{fontWeight:700,color:'var(--navy)'}}>{a.auteur||'—'}</span>
                <span style={{color:'var(--muted)'}}> {a.action?.toLowerCase()} </span>
                {a.cible && <span style={{fontWeight:600,color:'var(--navy)'}}>{a.cible}</span>}
                {a.details && <span style={{color:'var(--muted)',fontSize:'0.75rem'}}> · {a.details}</span>}
              </div>
              <span style={{fontSize:'0.68rem',color:'var(--muted)',whiteSpace:'nowrap'}}>{a.created_at ? new Date(a.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Collaborateurs */}
      <div className="section-title">Collaborateurs</div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input type="text" placeholder="🔍 Rechercher..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:0, border:'1.5px solid var(--lavender)', borderRadius:10, padding:'10px 16px', fontFamily:'inherit', fontSize:'0.9rem', outline:'none', background:'var(--offwhite)', color:'var(--navy)' }} />
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
