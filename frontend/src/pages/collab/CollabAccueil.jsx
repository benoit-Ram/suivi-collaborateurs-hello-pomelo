import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { Avatar, Badge, ProgressBar, EmptyState, FadeIn, Skeleton, fmtDate, moisLabel, calculateSolde, getAbsenceDays, STATUS_LABELS, STATUS_COLORS } from '../../components/UI';
import { getTeamObjectives } from './utils/questions';
import ObjCard from './components/ObjCard';
import PointCard from './components/PointCard';
import CongesTab from './components/CongesTab';
import ManagementTab from './components/ManagementTab';
import MissionsTab from './components/MissionsTab';
import ReferentTab from './components/ReferentTab';

// ── MAIN COMPONENT ──

export default function CollabAccueil() {
  const { user: authUser, collabs: authCollabs } = useAuth();
  const [collabs, setCollabs] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [settings, setSettings] = useState({});
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState('accueil');
  useEffect(() => {
    const goHome = () => setTab('accueil');
    window.addEventListener('collab-go-home', goHome);
    return () => window.removeEventListener('collab-go-home', goHome);
  }, []);

  const [loading, setLoading] = useState(true);
  const [teamPendingAbs, setTeamPendingAbs] = useState([]);
  const [staffingGlobal, setStaffingGlobal] = useState(null);
  const [isReferent, setIsReferent] = useState(false);

  // Expose setTab for notification navigation
  useEffect(() => { window.__collabSetTab = setTab; return () => { delete window.__collabSetTab; }; }, []);

  // Expose data for notification system in CollabLayout
  useEffect(() => {
    const c2 = collabs.find(x=>x.id===selectedId);
    if (!c2) return;
    const pts = (c2.points_suivi||[]).filter(p=>p.type==='mensuel').sort((a,b)=>(b.mois||'')>(a.mois||'')?1:-1);
    const objs2 = c2.objectifs||[];
    window.__collabNotifData = { absences, points: pts, objectifs: objs2, solde: c2.solde_conges||0, teamPendingAbs, collabId: c2.id };
    window.dispatchEvent(new Event('collab-data-update'));
    return () => { delete window.__collabNotifData; };
  }, [absences, collabs, selectedId, teamPendingAbs]);

  useEffect(() => {
    if (!authUser) return;

    // Load collabs + settings in parallel
    Promise.all([
      authCollabs?.length ? Promise.resolve(authCollabs) : api.getCollaborateurs(),
      api.getSettings()
    ]).then(([data, s]) => {
      const allCollabs = data || [];
      setCollabs(allCollabs);
      const sm = {}; (s||[]).forEach(r => { sm[r.key] = r.value; }); setSettings(sm);

      // Auto-select from URL param (admin impersonate — admin only)
      const params = new URLSearchParams(window.location.search);
      const impId = params.get('impersonate');
      if (impId && authUser?.isAdmin && allCollabs.find(c=>c.id===impId)) {
        setSelectedId(impId);
        loadAbsences(impId);
        loadTeamPendingAbs(impId, allCollabs);
      } else if (authUser?.collabId) {
        setSelectedId(authUser.collabId);
        loadAbsences(authUser.collabId);
        loadTeamPendingAbs(authUser.collabId, allCollabs);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [authUser]);

  // Staffing moyen annuel : parcourt chaque semaine depuis le 1er janv (ou date_entree) et calcule le taux effectif
  useEffect(() => {
    if (!selectedId) return;
    const collab = collabs.find(x => x.id === selectedId);
    if (!collab) return;
    Promise.all([api.getMissions(), api.getAbsences({collaborateur_id:selectedId})]).then(([missions, abs]) => {
      const now = new Date();
      const janFirst = new Date(now.getFullYear(), 0, 1);
      const startDate = collab.date_entree && new Date(collab.date_entree) > janFirst ? new Date(collab.date_entree) : janFirst;
      const myAbs = (abs||[]).filter(a=>a.statut==='approuve');

      // Iterate week by week from startDate to now
      const cursor = new Date(startDate);
      cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
      let totalStaffedDays = 0;
      let totalAvailableDays = 0;

      while (cursor <= now) {
        const wn = Math.ceil(((cursor - new Date(cursor.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
        const weekKey = `${cursor.getFullYear()}-W${String(wn).padStart(2, '0')}`;
        const weekStart = cursor.toISOString().split('T')[0];
        const weekEnd = new Date(cursor.getTime() + 4 * 86400000).toISOString().split('T')[0];

        const absDays = getAbsenceDays(selectedId, weekStart, weekEnd, myAbs);
        const availDays = Math.max(0, 5 - absDays);

        let weekStaffedDays = 0;
        (missions || []).forEach(m => {
          if (m.date_debut && m.date_debut > weekEnd) return;
          if (m.date_fin && m.date_fin < weekStart) return;
          (m.assignments || []).forEach(a => {
            if (a.collaborateur_id !== selectedId) return;
            if (a.statut && a.statut !== 'actif') return;
            if (a.date_debut && a.date_debut > weekEnd) return;
            if (a.date_fin && a.date_fin < weekStart) return;
            const ov = a.staffing_overrides || {};
            const taux = ov[weekKey] !== undefined ? ov[weekKey] : (a.taux_staffing || 0);
            weekStaffedDays += taux / 100 * 5;
          });
        });

        totalStaffedDays += Math.min(weekStaffedDays, availDays);
        totalAvailableDays += availDays;
        cursor.setDate(cursor.getDate() + 7);
      }

      setStaffingGlobal(totalAvailableDays > 0 ? Math.round(totalStaffedDays / totalAvailableDays * 100) : 0);
    }).catch(e => console.error('Staffing calc error:', e));
  }, [selectedId, collabs]);

  // Check if referent of any mission
  useEffect(() => {
    if (!selectedId) return;
    api.getMissions().then(m => setIsReferent((m||[]).some(mi => mi.responsable_id === selectedId))).catch(e => console.error('Referent check error:', e));
  }, [selectedId]);

  if (loading) return <div style={{maxWidth:600,margin:'40px auto'}}><Skeleton lines={5} /></div>;

  /** Charge les absences d'un collaborateur */
  async function loadAbsences(cid) {
    try {
      const data = await api.getAbsences({ collaborateur_id: cid });
      setAbsences(data || []);
    } catch(e) {
      console.error('Erreur chargement absences:', e);
      setAbsences([]);
    }
  }

  /** Charge les demandes de congés en attente des membres de l'équipe du manager */
  async function loadTeamPendingAbs(managerId, allCollabs) {
    const myTeam = (allCollabs||collabs).filter(m => m.manager_id === managerId);
    if (!myTeam.length) { setTeamPendingAbs([]); return; }
    try {
      const allAbs = await api.getAbsences();
      const teamIds = myTeam.map(m => m.id);
      setTeamPendingAbs((allAbs||[]).filter(a => teamIds.includes(a.collaborateur_id) && a.statut === 'en_attente'));
    } catch(e) {
      console.error('Erreur chargement congés équipe:', e);
      setTeamPendingAbs([]);
    }
  }

  const c = collabs.find(x => x.id === selectedId);
  if (!c) return <div style={{textAlign:'center',padding:48,color:'var(--muted)'}}>Collaborateur non trouvé.</div>;

  const objs = c.objectifs||[];
  const enCours = objs.filter(o => o.statut==='en-cours');
  const atteints = objs.filter(o => o.statut==='atteint');
  const points = (c.points_suivi||[]).filter(p => p.type==='mensuel').sort((a,b)=>(b.mois||'')>(a.mois||'')?1:-1);
  const manager = c.manager_id ? collabs.find(x=>x.id===c.manager_id) : null;
  const managerName = manager ? `${manager.prenom} ${manager.nom}` : '—';
  const myTeam = collabs.filter(m => m.manager_id === c.id);
  const { solde } = calculateSolde(c, absences, settings);

  const pendingCount = teamPendingAbs.length;
  const isManager = myTeam.length > 0;

  const tabs = [['objectifs', isManager ? '🎯 Mes objectifs' : '🎯 Objectifs'],['missions','🚀 Missions'],['points', isManager ? '📋 Mes entretiens RH' : '📋 Entretien RH'],['conges', isManager ? '🏖️ Mes congés' : '🏖️ Congés']];
  if (isManager) tabs.splice(3, 0, ['management', pendingCount > 0 ? `👔 Management (${pendingCount})` : '👔 Management']);
  if (isReferent) tabs.splice(2, 0, ['referent', '📋 Mes projets']);

  return (
    <div>
      {/* Profile card */}

      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16,background:'var(--bg-highlight)',borderRadius:16,padding:'clamp(14px, 3vw, 24px)',border:'1.5px solid var(--border-highlight)',flexWrap:'wrap'}}>
        <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={64} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:'1.2rem',fontWeight:700,color:'var(--navy)'}}>{c.prenom} {c.nom}</div>
          <div style={{fontSize:'0.85rem',color:'var(--muted)',marginTop:2}}>{c.poste}{c.equipe ? ` · ${c.equipe}` : ''}</div>
          {/* Compétences self-tag */}
          <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:8}}>
            {(c.competences||[]).map(comp => (
              <span key={comp} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:6,fontSize:'0.68rem',fontWeight:700,background:'var(--bg-info)',color:'var(--text-info)'}}>
                {comp}
                <button onClick={async()=>{
                  const next = (c.competences||[]).filter(x=>x!==comp);
                  try { await api.updateCollaborateur(c.id,{competences:next}); const data=await api.getCollaborateurs(); setCollabs(data||[]); } catch(e) { alert('Erreur: '+e.message); }
                }} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-info)',fontSize:'0.7rem',padding:0,lineHeight:1}}>×</button>
              </span>
            ))}
            {(()=>{
              const available = (settings.competences_list||[]).filter(comp => !(c.competences||[]).includes(comp));
              if (available.length === 0) return null;
              return <select onChange={async(e)=>{
                const val = e.target.value; if (!val) return;
                const next = [...(c.competences||[]), val];
                try { await api.updateCollaborateur(c.id,{competences:next}); const data=await api.getCollaborateurs(); setCollabs(data||[]); } catch(err) { alert('Erreur: '+err.message); }
                e.target.value = '';
              }} style={{padding:'2px 6px',borderRadius:6,fontSize:'0.68rem',border:'1px dashed var(--lavender)',background:'transparent',color:'var(--muted)',cursor:'pointer'}}>
                <option value="">+ Compétence</option>
                {available.sort().map(comp => <option key={comp} value={comp}>{comp}</option>)}
              </select>;
            })()}
          </div>
        </div>
      </div>

      <div className="tabs-scroll" style={{display:'flex',gap:6,marginBottom:24,background:'var(--offwhite)',padding:6,borderRadius:12,overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        {tabs.map(([k,l]) => (
          <button key={k} onClick={()=>{setTab(k); if(k==='conges') loadAbsences(selectedId);}} style={{position:'relative',flex:'1 0 auto',padding:'10px 14px',borderRadius:10,border:'none',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',background:tab===k?'var(--pink)':'transparent',color:tab===k?'white':'var(--muted)',border:tab===k?'none':'1.5px solid var(--lavender)',boxShadow:tab===k?'0 4px 14px rgba(255,50,133,0.3)':'none'}}>
            {l}
            {k==='missions' && <span style={{marginLeft:4,padding:'1px 5px',borderRadius:4,fontSize:'0.55rem',fontWeight:800,background:'#FDE68A',color:'#92400E',verticalAlign:'middle'}}>bêta</span>}
            {k==='management' && pendingCount > 0 && <span style={{position:'absolute',top:-4,right:-4,background:'var(--orange)',color:'white',borderRadius:'50%',width:20,height:20,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontWeight:800,boxShadow:'0 2px 6px rgba(249,115,22,0.4)'}}>{pendingCount}</span>}
          </button>
        ))}
      </div>

      {/* ACCUEIL */}
      {tab==='accueil' && <FadeIn><div>
        <h3 style={{fontSize:'1.1rem',fontWeight:700,color:'var(--navy)',marginBottom:16}}>Bonjour {c.prenom} 👋</h3>

        {/* Notification congés en attente */}
        {pendingCount > 0 && (
          <div onClick={()=>setTab('management')} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 18px',background:'var(--bg-warning)',borderRadius:12,marginBottom:20,cursor:'pointer',border:'1.5px solid var(--border-warning)',transition:'all 0.15s'}}>
            <span style={{fontSize:'1.4rem'}}>🔔</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,color:'var(--text-warning)',fontSize:'0.88rem'}}>{pendingCount} demande{pendingCount>1?'s':''} de congés en attente</div>
              <div style={{fontSize:'0.78rem',color:'var(--text-warning)',opacity:0.8}}>
                {teamPendingAbs.slice(0,3).map(a => {
                  const m = collabs.find(x=>x.id===a.collaborateur_id);
                  return m ? `${m.prenom} ${m.nom}` : '';
                }).filter(Boolean).join(', ')}{pendingCount > 3 ? ` et ${pendingCount-3} autre${pendingCount-3>1?'s':''}` : ''}
              </div>
            </div>
            <span style={{fontWeight:700,color:'var(--text-warning)',fontSize:'0.82rem'}}>Valider →</span>
          </div>
        )}
        <div className="mobile-grid-2" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:10,marginBottom:24}}>
          {staffingGlobal !== null && <div className="card" style={{textAlign:'center',padding:14}}><div style={{fontSize:'clamp(1.4rem,5vw,2rem)',fontWeight:700,color:staffingGlobal>=80?'var(--green)':staffingGlobal>=50?'var(--orange)':'var(--red)'}}>{staffingGlobal}%</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Staffing {new Date().getFullYear()}</div></div>}
          <div className="card" style={{textAlign:'center',padding:14}}><div style={{fontSize:'clamp(1.4rem,5vw,2rem)',fontWeight:700,color:'var(--pink)'}}>{enCours.length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Obj. en cours</div></div>
          <div className="card" style={{textAlign:'center',padding:14}}><div style={{fontSize:'clamp(1.4rem,5vw,2rem)',fontWeight:700,color:'var(--green)'}}>{atteints.length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Obj. atteints</div></div>
          <div className="card" style={{textAlign:'center',padding:14}}><div style={{fontSize:'clamp(1.4rem,5vw,2rem)',fontWeight:700,color:'var(--navy)'}}>{solde.toFixed(2)}j</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Congés</div></div>
        </div>
        <div className="card">
          {/* Team objectives */}
          {(() => {
            const equipes2 = (c.equipe||'').split(',').map(s=>s.trim()).filter(Boolean);
            const tObjs = getTeamObjectives(equipes2, settings);
            return tObjs.length > 0 && <>
              <div className="section-title" style={{marginTop:0}}>👥 Objectifs d'équipe</div>
              {tObjs.map((o,i) => <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--lavender)'}}><div style={{flex:1,fontWeight:600,color:'var(--navy)',fontSize:'0.88rem'}}>{o.titre}</div><Badge type="blue">{o.equipe}</Badge><span style={{fontWeight:700,fontSize:'0.82rem',color:'var(--blue)'}}>{o.progression||0}%</span></div>)}
            </>;
          })()}
          {/* Individual objectives */}
          {enCours.length > 0 && <>
            <div className="section-title" style={{marginTop: 12}}>🎯 Objectifs individuels</div>
            {enCours.slice(0,3).map(o => <div key={o.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--lavender)'}}><div style={{flex:1,fontWeight:600,color:'var(--navy)',fontSize:'0.88rem'}}>{o.titre}</div><span style={{fontWeight:700,fontSize:'0.82rem',color:'var(--pink)'}}>{o.progression||0}%</span></div>)}
          </>}
        </div>
      </div></FadeIn>}

      {/* OBJECTIFS */}
      {tab==='objectifs' && <FadeIn><div>
        {/* Team objectives */}
        {(() => {
          const equipes = (c.equipe||'').split(',').map(s=>s.trim()).filter(Boolean);
          const teamObjs = getTeamObjectives(equipes, settings);
          return teamObjs.length > 0 && <>
            <div className="section-title">Objectifs d'équipe</div>
            {teamObjs.map((o,i) => (
              <div key={i} className="card" style={{marginBottom:8,padding:14,borderLeft:'4px solid var(--blue)'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <span style={{fontWeight:700,color:'var(--navy)',flex:1}}>{o.titre}</span>
                  <Badge type="blue">{o.equipe}</Badge>
                </div>
                <div style={{marginBottom:4}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',marginBottom:4}}><span>Progression</span><span>{o.progression||0}%</span></div>
                  <ProgressBar value={o.progression||0} color="linear-gradient(90deg, var(--skyblue), var(--blue))" />
                </div>
                {(o.dateDebut||o.dateFin) && <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>📅 {fmtDate(o.dateDebut)} → {fmtDate(o.dateFin)}</div>}
              </div>
            ))}
          </>;
        })()}

        {/* Individual objectives */}
        {enCours.length > 0 && <><div className="section-title">Objectifs individuels en cours ({enCours.length})</div>{enCours.map((o,i)=><ObjCard key={o.id} o={o} i={i} />)}</>}
        {atteints.length > 0 && <><div className="section-title" style={{marginTop:24}}>✅ Atteints ({atteints.length})</div>{atteints.map((o,i)=><ObjCard key={o.id} o={o} i={i} />)}</>}
        {objs.length===0 && getTeamObjectives((c.equipe||'').split(',').map(s=>s.trim()).filter(Boolean), settings).length===0 && <EmptyState icon="🎯" text="Aucun objectif" />}
      </div></FadeIn>}

      {/* POINTS */}
      {tab==='points' && <FadeIn><div>
        {points.length===0 ? <EmptyState icon="📋" text="Aucun entretien RH" /> : points.map(p => <PointCard key={p.id} p={p} collabId={c.id} settings={settings} objectifs={c.objectifs||[]} />)}
      </div></FadeIn>}

      {/* CONGÉS */}
      {tab==='missions' && <FadeIn><MissionsTab collabId={c.id} isResponsable={false} collabs={collabs} /></FadeIn>}

      {tab==='referent' && <FadeIn><ReferentTab collabId={c.id} collabs={collabs} settings={settings} /></FadeIn>}
      {tab==='conges' && <FadeIn><CongesTab c={c} absences={absences} solde={solde} settings={settings} onReload={() => loadAbsences(c.id)} api={api} /></FadeIn>}

      {/* MANAGEMENT */}
      {tab==='management' && <FadeIn><ManagementTab manager={c} team={myTeam} collabs={collabs} settings={settings} teamPendingAbs={teamPendingAbs} onAbsenceUpdate={()=>loadTeamPendingAbs(c.id)} /></FadeIn>}
    </div>
  );
}

