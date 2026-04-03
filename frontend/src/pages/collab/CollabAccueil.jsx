import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { Avatar, Badge, ProgressBar, EmptyState, FadeIn, Modal, Skeleton, fmtDate, moisLabel, countWorkDays, absenceDays, getFeriesSet, STATUS_LABELS, STATUS_COLORS, ABS_TYPES, ABS_STATUTS, getAbsenceTypes, absenceDeductsSolde, isEntretienLocked, getEntretienStatus, ENTRETIEN_STATUS_BADGE } from '../../components/UI';

// ── UTILS ──

/** Récupère les objectifs d'équipe depuis les settings pour les équipes données */
function getTeamObjectives(equipes, settings) {
  const teamObjs = [];
  (equipes||[]).forEach(eq => {
    (settings['team_objectifs_'+eq]||[]).forEach(o => {
      teamObjs.push({...(typeof o==='string'?{titre:o,progression:0,dateDebut:'',dateFin:''}:o), equipe:eq});
    });
  });
  return teamObjs;
}

/** Récupère les questions manager depuis les settings ou les questions par défaut */
function getManagerQuestions(settings) {
  if ((settings?.questions_manager||[]).length > 0) {
    return {
      keys: settings.questions_manager.map((_,i) => 'q'+i),
      labels: settings.questions_manager.map(q => q.label||q),
      questions: settings.questions_manager.map((q,i) => ({key:'q'+i, label:q.label||q, type:q.type||'texte'})),
    };
  }
  const defaults = ['Retours sur les missions','Taux de staffing','Qualités','Axe d\'amélioration'];
  return {
    keys: ['retoursMissions','tauxStaffing','qualites','axeAmelioration'],
    labels: defaults,
    questions: defaults.map((l,i) => ({key:['retoursMissions','tauxStaffing','qualites','axeAmelioration'][i], label:l, type:'texte'})),
  };
}

/** Récupère les questions collab depuis les settings ou les questions par défaut */
function getCollabQuestions(settings) {
  const DEFAULT_Q = ['Comment t\'es-tu senti(e) au travail ?','Réussites du mois','Objectifs M-1 atteints ?','Suggestions process','Objectifs mois suivant','Autres sujets','Axe d\'amélioration'];
  if ((settings?.questions_collab||[]).length > 0) {
    return settings.questions_collab.map((q,i) => ({key:'cq'+i, label:q.label||q, type:q.type||'texte'}));
  }
  return DEFAULT_Q.map((q,i) => ({key:'cq'+i, label:q, type:'texte'}));
}

// ── MAIN COMPONENT ──

export default function CollabAccueil() {
  const { user: authUser, collabs: authCollabs } = useAuth();
  const [collabs, setCollabs] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [settings, setSettings] = useState({});
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState('accueil');
  const [loading, setLoading] = useState(true);
  const [teamPendingAbs, setTeamPendingAbs] = useState([]);

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
  // Calcul solde réel
  const soldeInit = c.solde_conges||0;
  const acq = c.acquisition_conges||2.08;
  let moisAcq = 0;
  if (c.date_entree) { const e2=new Date(c.date_entree); const n2=new Date(); moisAcq=Math.max(0,(n2.getFullYear()-e2.getFullYear())*12+(n2.getMonth()-e2.getMonth())); }
  const acquis = Math.round(moisAcq*acq*100)/100;
  const pris = absences.filter(a=>a.statut==='approuve'&&absenceDeductsSolde(a.type,settings)).reduce((s,a)=>s+absenceDays(a),0);
  const solde = Math.round((soldeInit+acquis-pris)*100)/100;

  const pendingCount = teamPendingAbs.length;
  const isManager = myTeam.length > 0;
  const tabs = [['accueil','🏠 Accueil'],['objectifs', isManager ? '🎯 Mes objectifs' : '🎯 Objectifs'],['points', isManager ? '📋 Mes entretiens RH' : '📋 Entretien RH'],['conges', isManager ? '🏖️ Mes congés' : '🏖️ Congés']];
  if (isManager) tabs.splice(3, 0, ['management', pendingCount > 0 ? `👔 Management (${pendingCount})` : '👔 Management']);

  return (
    <div>
      {/* Profile card */}

      <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:24,background:'var(--bg-highlight)',borderRadius:16,padding:'clamp(14px, 3vw, 24px)',border:'1.5px solid var(--border-highlight)',flexWrap:'wrap'}}>
        <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={64} />
        <div>
          <div style={{fontSize:'1.2rem',fontWeight:700,color:'var(--navy)'}}>{c.prenom} {c.nom}</div>
          <div style={{fontSize:'0.85rem',color:'var(--muted)',marginTop:2}}>{c.poste}{c.equipe ? ` · ${c.equipe}` : ''}</div>
        </div>
      </div>

      <div className="tabs-scroll" style={{display:'flex',gap:6,marginBottom:24,background:'var(--offwhite)',padding:6,borderRadius:12,overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
        {tabs.map(([k,l]) => (
          <button key={k} onClick={()=>{setTab(k); if(k==='conges') loadAbsences(selectedId);}} style={{position:'relative',flex:'1 0 auto',padding:'10px 14px',borderRadius:10,border:'none',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',background:tab===k?'var(--pink)':'transparent',color:tab===k?'white':'var(--muted)',border:tab===k?'none':'1.5px solid var(--lavender)',boxShadow:tab===k?'0 4px 14px rgba(255,50,133,0.3)':'none'}}>
            {l}
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
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:14,marginBottom:24}}>
          <div className="card" style={{textAlign:'center',padding:18}}><div style={{fontSize:'2rem',fontWeight:700,color:'var(--pink)'}}>{enCours.length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>En cours</div></div>
          <div className="card" style={{textAlign:'center',padding:18}}><div style={{fontSize:'2rem',fontWeight:700,color:'var(--green)'}}>{atteints.length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Atteints</div></div>
          <div className="card" style={{textAlign:'center',padding:18}}><div style={{fontSize:'2rem',fontWeight:700,color:'var(--navy)'}}>{solde.toFixed(2)}j</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Congés</div></div>
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
      {tab==='conges' && <FadeIn><CongesTab c={c} absences={absences} solde={solde} settings={settings} onReload={() => loadAbsences(c.id)} api={api} /></FadeIn>}

      {/* MANAGEMENT */}
      {tab==='management' && <FadeIn><ManagementTab manager={c} team={myTeam} collabs={collabs} settings={settings} teamPendingAbs={teamPendingAbs} onAbsenceUpdate={()=>loadTeamPendingAbs(c.id)} /></FadeIn>}
    </div>
  );
}

function ObjCard({ o, i }) {
  const pct = o.statut==='atteint'?100:(o.progression||0);
  const colors = { 'en-cours':'linear-gradient(90deg,var(--pink),var(--blue))', 'atteint':'var(--green)', 'non-atteint':'var(--orange)', 'en-attente':'var(--lavender)' };
  const hist = o.historique || [];
  return (
    <div className="card" style={{marginBottom:10,padding:16,borderLeft:`4px solid ${o.statut==='atteint'?'var(--green)':'var(--pink)'}`,opacity:o.statut==='atteint'?0.85:1}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <span style={{background:o.statut==='atteint'?'var(--green)':'var(--pink)',color:'white',borderRadius:'50%',width:24,height:24,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',fontWeight:800}}>{o.statut==='atteint'?'✓':i+1}</span>
        <span style={{flex:1,fontWeight:700,color:'var(--navy)'}}>{o.titre}</span>
        <Badge type={STATUS_COLORS[o.statut]}>{STATUS_LABELS[o.statut]}</Badge>
        {o.recurrence && <Badge type="blue">🔄</Badge>}
      </div>
      {o.description && <div style={{fontSize:'0.82rem',color:'var(--muted)',marginBottom:8}}>{o.description}</div>}
      <div style={{marginBottom:6}}><div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',marginBottom:4}}><span>Progression</span><span>{pct}%</span></div><ProgressBar value={pct} color={colors[o.statut]} /></div>
      <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>📅 {fmtDate(o.date_debut)} → {fmtDate(o.date_fin)}</div>
      {hist.length > 0 && (
        <details style={{marginTop:8}}>
          <summary style={{fontSize:'0.72rem',color:'var(--muted)',cursor:'pointer',fontWeight:700}}>📜 Historique ({hist.length})</summary>
          <div style={{marginTop:6,paddingLeft:8,borderLeft:'2px solid var(--lavender)'}}>
            {hist.map((h,idx)=>(
              <div key={idx} style={{marginBottom:6,fontSize:'0.75rem'}}>
                <div style={{fontWeight:700,color:'var(--navy)'}}>{fmtDate(h.date)} — {h.auteur || 'Inconnu'}</div>
                {(h.changes||[]).map((ch,j)=>(
                  <div key={j} style={{color:'var(--muted)',marginLeft:8}}>
                    {ch.champ === 'Création' ? <span>✨ Création : <strong>{ch.apres}</strong></span>
                      : <span>{ch.champ} : <span style={{textDecoration:'line-through',opacity:0.6}}>{ch.avant}</span> → <strong>{ch.apres}</strong></span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** Carte d'entretien RH mensuel — affiche les réponses manager/collab, permet l'édition et l'export PDF */
function PointCard({ p, collabId, settings, objectifs = [] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const md = p.manager_data||{}; const cd = p.collab_data||{};
  const locked = isEntretienLocked(p.mois);
  const status = getEntretienStatus(p);
  const statusBadge = locked ? {label:'🔒 Verrouillé',type:'gray'} : ENTRETIEN_STATUS_BADGE[status];

  const collabQuestions = getCollabQuestions(settings);
  const managerQuestions = getManagerQuestions(settings).questions;
  // Objectifs non atteints pour ce mois
  const activeObjectifs = objectifs.filter(o => o.statut !== 'atteint');

  const startEdit = () => {
    const data = {};
    collabQuestions.forEach(q => { data[q.key] = cd[q.key] || ''; });
    activeObjectifs.forEach(o => { data['obj_'+o.id] = cd['obj_'+o.id] || ''; });
    data._commentaire = cd._commentaire || '';
    setFormData(data);
    setEditing(true);
  };

  const saveResponses = async () => {
    setSaving(true);
    try {
      await api.updatePointSuivi(p.id, { collab_data: formData });
      setEditing(false);
    } catch(e) { console.error(e); alert('Erreur lors de la sauvegarde.'); }
    setSaving(false);
  };

  const exportPDF = () => {
    const win = window.open('','_blank');
    if (!win) { alert('Le popup a été bloqué. Autorisez les popups pour exporter en PDF.'); return; }
    win.document.write(`<html><head><title>Entretien RH ${moisLabel(p.mois)}</title><style>body{font-family:Quicksand,Arial,sans-serif;padding:32px;max-width:800px;margin:0 auto;color:#05056D}h1{font-size:1.3rem}h2{font-size:1rem;color:#FF3285;margin:20px 0 8px}.field{margin-bottom:12px}.field-label{font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#6B6B9A;margin-bottom:2px}.field-value{font-size:0.9rem;line-height:1.5;padding:8px 0;border-bottom:1px solid #CFD0E5}@media print{body{padding:16px}}</style></head><body>`);
    win.document.write(`<h1>Entretien RH — ${moisLabel(p.mois)}</h1>`);
    win.document.write(`<h2>👔 Manager</h2>`);
    managerQuestions.forEach(q => { win.document.write(`<div class="field"><div class="field-label">${q.label}</div><div class="field-value">${md[q.key]||'—'}</div></div>`); });
    win.document.write(`<h2>👤 Collaborateur</h2>`);
    collabQuestions.forEach(q => { win.document.write(`<div class="field"><div class="field-label">${q.label}</div><div class="field-value">${cd[q.key]||'—'}</div></div>`); });
    if (activeObjectifs.some(o=>cd['obj_'+o.id])) { win.document.write(`<h2>🎯 Avancement objectifs</h2>`); activeObjectifs.filter(o=>cd['obj_'+o.id]).forEach(o => { win.document.write(`<div class="field"><div class="field-label">${o.titre} (${o.progression||0}%)</div><div class="field-value">${cd['obj_'+o.id]}</div></div>`); }); }
    if (cd._commentaire) win.document.write(`<div class="field"><div class="field-label">Commentaire libre</div><div class="field-value">${cd._commentaire}</div></div>`);
    win.document.write(`<div style="margin-top:40px;font-size:0.75rem;color:#6B6B9A">Exporté le ${new Date().toLocaleDateString('fr-FR')}</div></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="card" style={{marginBottom:10,padding:0,overflow:'hidden'}}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',cursor:'pointer'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontWeight:700,color:'var(--navy)'}}>📅 {moisLabel(p.mois)}</span>
          <Badge type={statusBadge.type}>{statusBadge.label}</Badge>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {locked && <button className="btn btn-ghost btn-sm" style={{padding:'3px 8px',fontSize:'0.68rem'}} onClick={e=>{e.stopPropagation();exportPDF();}}>📄 PDF</button>}
          <span style={{color:'var(--muted)'}}>{open?'▲':'▼'}</span>
        </div>
      </div>
      {open && <div style={{padding:'0 18px 18px',borderTop:'1px solid var(--lavender)'}}>
        {locked && <div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.78rem',color:'var(--muted)',marginTop:10,marginBottom:10}}>🔒 Cet entretien est verrouillé et n'est plus modifiable.</div>}

        {/* Manager section (read-only for collab) */}
        <div style={{marginTop:10,fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--skyblue)',marginBottom:8}}>👔 Retours Manager</div>
        {managerQuestions.map(q=>(<div key={q.key} style={{marginBottom:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>{q.label}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:md[q.key]?'var(--navy)':'var(--muted)',fontStyle:md[q.key]?'normal':'italic'}}>{md[q.key]||'Non renseigné'}</div></div>))}

        {/* Collab section */}
        <div style={{marginTop:16,paddingTop:14,borderTop:'1px dashed var(--lavender)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)'}}>✏️ Mes réponses</div>
          {!editing && !locked && <button className="btn btn-ghost btn-sm" onClick={startEdit}>✏️ Remplir</button>}
        </div>
        {editing ? <>
          {collabQuestions.map(q => (
            <div key={q.key} style={{marginBottom:10,marginTop:8}}>
              <label style={{fontSize:'0.72rem',fontWeight:700,color:'var(--pink)',display:'block',marginBottom:4}}>{q.label}</label>
              {q.type==='notation' ? <div style={{display:'flex',gap:6,marginTop:4}}>{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setFormData({...formData,[q.key]:String(n)})} style={{width:40,height:40,borderRadius:10,border:`2px solid ${String(formData[q.key])===String(n)?'var(--pink)':'var(--lavender)'}`,background:String(formData[q.key])===String(n)?'var(--pink)':'white',color:String(formData[q.key])===String(n)?'white':'var(--navy)',fontSize:'0.95rem',fontWeight:700,cursor:'pointer',transition:'all 0.15s'}}>{n}</button>)}</div>
              : <textarea value={formData[q.key]||''} onChange={e=>setFormData({...formData,[q.key]:e.target.value})} placeholder="Votre réponse..." style={{width:'100%',border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.85rem',minHeight:60,resize:'vertical',outline:'none'}} />}
            </div>
          ))}
          {/* Objectifs en cours */}
          {activeObjectifs.length > 0 && <>
            <div style={{marginTop:14,paddingTop:12,borderTop:'1px dashed var(--lavender)',fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--green)',marginBottom:8}}>🎯 Avancement de mes objectifs</div>
            {activeObjectifs.map(o => (
              <div key={o.id} style={{marginBottom:10}}>
                <label style={{fontSize:'0.72rem',fontWeight:700,color:'var(--navy)',display:'block',marginBottom:4}}>{o.titre} <span style={{color:'var(--muted)',fontWeight:600}}>({o.progression||0}%)</span></label>
                <textarea value={formData['obj_'+o.id]||''} onChange={e=>setFormData({...formData,['obj_'+o.id]:e.target.value})} placeholder="Avancement, blocages, prochaines etapes..." style={{width:'100%',border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.85rem',minHeight:50,resize:'vertical',outline:'none'}} />
              </div>
            ))}
          </>}
          <div style={{marginBottom:10,marginTop:12}}>
            <label style={{fontSize:'0.72rem',fontWeight:700,color:'var(--pink)',display:'block',marginBottom:4}}>💬 Commentaire libre (optionnel)</label>
            <textarea value={formData._commentaire||''} onChange={e=>setFormData({...formData,_commentaire:e.target.value})} placeholder="Ajoutez tout élément supplémentaire..." style={{width:'100%',border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.85rem',minHeight:60,resize:'vertical',outline:'none'}} />
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(false)}>Annuler</button>
            <button className="btn btn-primary btn-sm" onClick={saveResponses} disabled={saving}>💾 Sauvegarder</button>
          </div>
        </> : <>
          {collabQuestions.map(q => {
            const v = cd[q.key];
            return v ? <div key={q.key} style={{marginBottom:8,marginTop:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>{q.label}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:'var(--navy)'}}>{q.type==='notation'?<div style={{display:'flex',gap:4}}>{[1,2,3,4,5].map(n=><span key={n} style={{width:28,height:28,borderRadius:6,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',fontWeight:700,background:Number(v)>=n?'var(--pink)':'var(--lavender)',color:Number(v)>=n?'white':'var(--muted)'}}>{n}</span>)}</div>:v}</div></div> : null;
          })}
          {/* Réponses objectifs (lecture) */}
          {activeObjectifs.some(o=>cd['obj_'+o.id]) && <>
            <div style={{marginTop:12,paddingTop:10,borderTop:'1px dashed var(--lavender)',fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--green)',marginBottom:8}}>🎯 Avancement objectifs</div>
            {activeObjectifs.filter(o=>cd['obj_'+o.id]).map(o=>(
              <div key={o.id} style={{marginBottom:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>{o.titre}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:'var(--navy)'}}>{cd['obj_'+o.id]}</div></div>
            ))}
          </>}
          {cd._commentaire && <div style={{marginBottom:8,marginTop:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>Commentaire libre</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:'var(--navy)'}}>{cd._commentaire}</div></div>}
          {!Object.keys(cd).some(k=>cd[k]) && <p style={{fontSize:'0.82rem',color:'var(--muted)',fontStyle:'italic',marginTop:8}}>Vous n'avez pas encore rempli vos réponses.</p>}
        </>}
      </div>}
    </div>
  );
}

// ── CONGÉS TAB with request form ──
/** Onglet Congés — formulaire de demande, historique, solde, calendrier personnel et équipe */
function CongesTab({ c, absences, solde, onReload, settings }) {
  const absTypes = getAbsenceTypes(settings);
  const [form, setForm] = useState({ type: Object.keys(absTypes)[0] || 'conge', date_debut:'', date_fin:'', demi_journee:'', commentaire:'' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Compute days for current form
  const formDays = form.date_debut && form.date_fin && form.date_fin >= form.date_debut
    ? (form.demi_journee ? 0.5 : countWorkDays(form.date_debut, form.date_fin)) : 0;
  const typeDeducts = absenceDeductsSolde(form.type, settings);
  const newSolde = typeDeducts ? solde - formDays : solde;

  const submit = async () => {
    setError('');
    if (!form.date_debut || !form.date_fin) { setError('Veuillez renseigner les dates.'); return; }
    if (form.date_fin < form.date_debut) { setError('La date de fin doit etre apres la date de debut.'); return; }
    if (form.demi_journee && form.date_debut !== form.date_fin) { setError('Pour une demi-journee, les dates doivent etre identiques.'); return; }
    // Balance check
    if (typeDeducts && newSolde < 0) { setError(`Solde insuffisant (${solde.toFixed(2)}j). Cette absence necessite ${formDays}j.`); return; }
    // Overlap check
    const overlap = absences.find(a => a.statut !== 'refuse' && form.date_debut <= a.date_fin && form.date_fin >= a.date_debut);
    if (overlap) { setError(`Chevauchement avec une absence existante du ${fmtDate(overlap.date_debut)} au ${fmtDate(overlap.date_fin)}.`); return; }

    setSubmitting(true);
    try {
      await api.createAbsence({ collaborateur_id: c.id, type: form.type, date_debut: form.date_debut, date_fin: form.date_fin, demi_journee: form.demi_journee || null, statut: 'en_attente', commentaire: form.commentaire || null });
      setForm({ type: Object.keys(absTypes)[0] || 'conge', date_debut:'', date_fin:'', demi_journee:'', commentaire:'' });
      onReload();
    } catch(e) { setError('Erreur: ' + e.message); }
    setSubmitting(false);
  };

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:10,marginBottom:20}}>
        <div className="card" style={{textAlign:'center',padding:16}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--green)'}}>{solde.toFixed(2)}j</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Solde</div></div>
        <div className="card" style={{textAlign:'center',padding:16}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--pink)'}}>{absences.filter(a=>a.statut==='approuve').length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Approuves</div></div>
        <div className="card" style={{textAlign:'center',padding:16}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--orange)'}}>{absences.filter(a=>a.statut==='en_attente').length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>En attente</div></div>
      </div>

      {/* Formulaire de demande */}
      <div className="card" style={{marginBottom:24}}>
        <div className="section-title" style={{marginTop:0}}>Nouvelle demande</div>
        <div className="form-grid">
          <div className="form-field"><label>Type</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{Object.entries(absTypes).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          <div className="form-field"><label>Du</label><input type="date" value={form.date_debut} onChange={e=>setForm({...form,date_debut:e.target.value, date_fin: form.demi_journee ? e.target.value : form.date_fin})} /></div>
          <div className="form-field"><label>Au</label><input type="date" value={form.date_fin} onChange={e=>setForm({...form,date_fin:e.target.value})} disabled={!!form.demi_journee} /></div>
          <div className="form-field"><label>Duree</label><select value={form.demi_journee} onChange={e=>setForm({...form,demi_journee:e.target.value, date_fin: e.target.value ? form.date_debut : form.date_fin})}>
            <option value="">Journee(s) complete(s)</option>
            <option value="AM">Demi-journee matin</option>
            <option value="PM">Demi-journee apres-midi</option>
          </select></div>
          <div className="form-field"><label>Commentaire</label><input type="text" value={form.commentaire} onChange={e=>setForm({...form,commentaire:e.target.value})} placeholder="Optionnel..." /></div>
        </div>
        {/* Calcul temps réel */}
        {formDays > 0 && (
          <div style={{marginTop:10,padding:'12px 16px',background:'var(--bg-info)',borderRadius:10,fontSize:'0.85rem',color:'var(--text-info)',display:'flex',gap:20,flexWrap:'wrap'}}>
            <span><strong>{formDays}</strong> jour{formDays>1?'s':''} ouvre{formDays>1?'s':''}{form.demi_journee ? ` (${form.demi_journee === 'AM' ? 'matin' : 'apres-midi'})` : ''}</span>
            {typeDeducts && <span>Solde apres : <strong style={{color:newSolde<0?'var(--red)':'var(--text-info)'}}>{newSolde.toFixed(2)}j</strong></span>}
            {!typeDeducts && <span style={{fontStyle:'italic'}}>Ce type ne decompte pas du solde</span>}
          </div>
        )}
        {error && <div style={{marginTop:10,padding:'10px 14px',background:'var(--bg-danger)',color:'var(--text-danger)',borderRadius:10,fontSize:'0.85rem',fontWeight:600,borderLeft:'4px solid var(--border-danger)'}}>{error}</div>}
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>{submitting ? '⏳ En cours...' : '🏖️ Demander'}</button>
        </div>
      </div>

      {/* Calendrier personnel */}
      <div className="card" style={{marginBottom:24}}>
        <div className="section-title" style={{marginTop:0}}>📅 Mon calendrier</div>
        <LeaveCalendar absences={absences} />
      </div>

      {/* Calendrier équipe */}
      <div className="card" style={{marginBottom:24}}>
        <div className="section-title" style={{marginTop:0}}>👥 Calendrier d'équipe</div>
        <TeamCalendar collab={c} />
      </div>

      {/* En attente */}
      {absences.filter(a=>a.statut==='en_attente').length > 0 && <>
        <div className="section-title">⏳ Demandes en attente</div>
        {absences.filter(a=>a.statut==='en_attente').map(a => (
          <div key={a.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',borderRadius:12,border:'1.5px solid var(--orange)',marginBottom:8,background:'var(--bg-warning)'}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:'0.9rem',color:'var(--navy)'}}>{ABS_TYPES[a.type]||a.type}</div>
              <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:2}}>Du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)} · {absenceDays(a)}j ouvré{absenceDays(a)>1?'s':''}</div>
              {a.commentaire && <div style={{fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic',marginTop:2}}>{a.commentaire}</div>}
            </div>
            <Badge type="orange">En attente</Badge>
          </div>
        ))}
      </>}

      {/* Historique (approuvés + refusés) */}
      <div className="section-title">📋 Historique</div>
      {absences.filter(a=>a.statut!=='en_attente').length===0 ? <p style={{color:'var(--muted)',fontSize:'0.82rem',fontStyle:'italic'}}>Aucun historique.</p> : absences.filter(a=>a.statut!=='en_attente').map(a => (
        <div key={a.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',borderRadius:12,border:`1.5px solid ${a.statut==='approuve'?'var(--text-success)':'var(--border-danger)'}`,marginBottom:8,background:a.statut==='approuve'?'var(--bg-success)':'var(--bg-danger)'}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:'0.9rem',color:'var(--navy)'}}>{ABS_TYPES[a.type]||a.type}</div>
            <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:2}}>Du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)} · {absenceDays(a)}j ouvré{absenceDays(a)>1?'s':''}</div>
            {a.commentaire && <div style={{fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic',marginTop:2}}>{a.commentaire}</div>}
            {a.statut==='refuse' && a.motif_refus && <div style={{fontSize:'0.78rem',color:'var(--text-danger)',marginTop:4,background:'var(--white)',padding:'6px 10px',borderRadius:6,borderLeft:'3px solid var(--border-danger)'}}>❌ Motif du refus : {a.motif_refus}</div>}
          </div>
          <Badge type={a.statut==='approuve'?'green':'pink'}>{a.statut==='approuve'?'✅ Approuvé':'❌ Refusé'}</Badge>
        </div>
      ))}
    </div>
  );
}

/** Calendrier mensuel des congés personnels avec code couleur par statut */
function LeaveCalendar({ absences }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const FERIES_FIXES = [[1,1],[5,1],[5,8],[7,14],[8,15],[11,1],[11,11],[12,25]];
  const feriesSet = new Set(FERIES_FIXES.map(([m,d]) => `${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`));

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month+1, 0);
  const startDow = (firstDay.getDay()+6)%7;
  const today = new Date().toISOString().split('T')[0];
  const monthLabel = firstDay.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});

  const prev = () => { if(month===0){setMonth(11);setYear(year-1)}else setMonth(month-1) };
  const next = () => { if(month===11){setMonth(0);setYear(year+1)}else setMonth(month+1) };

  const rows = [];
  let dayNum = 1;
  for (let row=0; row<6; row++) {
    if (dayNum > lastDay.getDate()) break;
    const cells = [];
    for (let col=0; col<7; col++) {
      if ((row===0 && col<startDow) || dayNum>lastDay.getDate()) { cells.push(<td key={col} />); }
      else {
        const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
        const isFerie = feriesSet.has(ds);
        const isWE = col>=5;
        const isToday = ds===today;
        const abs = absences.find(a => ds>=a.date_debut && ds<=a.date_fin);
        let bg='transparent',color='var(--navy)';
        if(isWE) { bg='var(--offwhite)'; color='var(--muted)'; }
        if(isFerie) { bg='var(--bg-info)'; color='var(--text-info)'; }
        if(abs) { bg=abs.statut==='approuve'?'var(--bg-success)':abs.statut==='en_attente'?'var(--bg-warning)':'var(--bg-danger)'; color=abs.statut==='approuve'?'var(--text-success)':abs.statut==='en_attente'?'var(--text-warning)':'var(--text-danger)'; }
        if(isToday) { bg='var(--pink)'; color='white'; }
        cells.push(<td key={col} style={{padding:2,textAlign:'center'}}><div style={{width:28,height:28,lineHeight:'28px',margin:'0 auto',borderRadius:8,background:bg,color,fontWeight:isToday||abs?700:500,fontSize:'0.78rem'}}>{dayNum}</div></td>);
        dayNum++;
      }
    }
    rows.push(<tr key={row}>{cells}</tr>);
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <button className="btn btn-ghost btn-sm" onClick={prev}>←</button>
        <span style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem',textTransform:'capitalize'}}>{monthLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={next}>→</button>
      </div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.78rem'}}>
        <thead><tr>{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=><th key={d} style={{padding:'6px 4px',textAlign:'center',color:'var(--muted)',fontSize:'0.68rem',fontWeight:700}}>{d}</th>)}</tr></thead>
        <tbody>{rows}</tbody>
      </table>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:12,fontSize:'0.7rem',fontWeight:600,color:'var(--muted)'}}>
        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--bg-success)'}} /> Approuvé</div>
        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--bg-warning)'}} /> En attente</div>
        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--bg-info)'}} /> Férié</div>
        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--pink)'}} /> Aujourd'hui</div>
      </div>
    </div>
  );
}

/** Calendrier d'équipe — vue mensuelle des absences de tous les collègues des mêmes équipes */
function TeamCalendar({ collab }) {
  const [teammates, setTeammates] = useState([]);
  const [teamAbs, setTeamAbs] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  useEffect(() => {
    const equipes = (collab.equipe||'').split(',').map(s=>s.trim()).filter(Boolean);
    if (!equipes.length) return;
    (async () => {
      try {
        const [all, abs] = await Promise.all([api.getCollaborateurs(), api.getAbsences()]);
        const mates = (all||[]).filter(c => c.equipe && equipes.some(e => c.equipe.includes(e)));
        mates.sort((a,b) => a.id===collab.id ? -1 : b.id===collab.id ? 1 : 0);
        setTeammates(mates);
        const ids = mates.map(m=>m.id);
        setTeamAbs((abs||[]).filter(a => ids.includes(a.collaborateur_id) && (a.statut==='approuve'||a.statut==='en_attente')));
      } catch(e) {
        console.error('Erreur chargement calendrier équipe:', e);
      }
    })();
  }, [collab.id]);

  if (!teammates.length) return <p style={{color:'var(--muted)',fontSize:'0.85rem'}}>Aucun collègue dans vos équipes.</p>;

  const prev = () => { if(month===0){setMonth(11);setYear(year-1)}else setMonth(month-1) };
  const next = () => { if(month===11){setMonth(0);setYear(year+1)}else setMonth(month+1) };
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <button className="btn btn-ghost btn-sm" onClick={prev}>←</button>
        <span style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem',textTransform:'capitalize'}}>{monthLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={next}>→</button>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{fontSize:'0.72rem',width:'100%'}}>
          <thead><tr><th style={{textAlign:'left',padding:'4px 8px'}}>Collègue</th>
            {Array.from({length:daysInMonth},(_,i)=><th key={i} style={{padding:'2px 4px',textAlign:'center'}}>{i+1}</th>)}
          </tr></thead>
          <tbody>{teammates.map(c => {
            const abs = teamAbs.filter(a=>a.collaborateur_id===c.id);
            return <tr key={c.id}><td style={{padding:'4px 8px',fontWeight:c.id===collab.id?800:600,whiteSpace:'nowrap',color:c.id===collab.id?'var(--pink)':'var(--navy)'}}>{c.prenom}{c.id===collab.id?' (moi)':''}</td>
              {Array.from({length:daysInMonth},(_,d)=>{
                const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d+1).padStart(2,'0')}`;
                const dow = new Date(year,month,d+1).getDay();
                const isWE = dow===0||dow===6;
                const a = abs.find(x=>ds>=x.date_debut&&ds<=x.date_fin);
                let bg = isWE?'var(--lavender)':'transparent';
                if(a) bg = a.statut==='approuve'?'var(--bg-success)':'var(--bg-warning)';
                return <td key={d} style={{padding:2,textAlign:'center',background:bg,borderRadius:2}} />;
              })}
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

/** Calendrier d'équipe pour le manager — basé sur les managés directs */
function ManagerTeamCalendar({ team, teamPendingAbs = [] }) {
  const [allAbs, setAllAbs] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  useEffect(() => {
    if (!team.length) return;
    const ids = team.map(m => m.id);
    api.getAbsences().then(data => {
      setAllAbs((data||[]).filter(a => ids.includes(a.collaborateur_id) && (a.statut==='approuve'||a.statut==='en_attente')));
    }).catch(() => {});
  }, [team, teamPendingAbs]);

  if (!team.length) return null;

  const prev = () => { if(month===0){setMonth(11);setYear(year-1)}else setMonth(month-1) };
  const next = () => { if(month===11){setMonth(0);setYear(year+1)}else setMonth(month+1) };
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  const feries = getFeriesSet(year);

  return (
    <div className="card" style={{marginBottom:20,padding:16}}>
      <div style={{fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
        📅 Planning equipe
        <span style={{flex:1,height:1,background:'var(--lavender)'}} />
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <button className="btn btn-ghost btn-sm" onClick={prev}>←</button>
        <span style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem',textTransform:'capitalize'}}>{monthLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={next}>→</button>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{fontSize:'0.72rem',width:'100%',borderCollapse:'collapse'}}>
          <thead><tr><th style={{textAlign:'left',padding:'4px 8px',position:'sticky',left:0,background:'var(--white)',zIndex:1}}>Membre</th>
            {Array.from({length:daysInMonth},(_,i)=>{
              const dow = new Date(year,month,i+1).getDay();
              const isWE = dow===0||dow===6;
              const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
              const isFerie = feries.has(ds);
              return <th key={i} style={{padding:'2px 4px',textAlign:'center',color:isWE||isFerie?'var(--lavender)':'var(--muted)',fontWeight:isWE||isFerie?400:700}}>{i+1}</th>;
            })}
          </tr></thead>
          <tbody>{team.map(c => {
            const abs = allAbs.filter(a=>a.collaborateur_id===c.id);
            return <tr key={c.id}><td style={{padding:'4px 8px',fontWeight:600,whiteSpace:'nowrap',color:'var(--navy)',position:'sticky',left:0,background:'var(--white)',zIndex:1}}>{c.prenom}</td>
              {Array.from({length:daysInMonth},(_,d)=>{
                const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d+1).padStart(2,'0')}`;
                const dow = new Date(year,month,d+1).getDay();
                const isWE = dow===0||dow===6;
                const isFerie = feries.has(ds);
                const a = abs.find(x=>ds>=x.date_debut&&ds<=x.date_fin);
                let bg = isWE||isFerie?'var(--lavender)':'transparent';
                let title = isFerie?'Jour férié':'';
                if(a && !isWE && !isFerie) { bg = a.statut==='approuve'?'#22C55E':'#F97316'; title = a.statut==='approuve'?'Approuvé':'En attente'; }
                return <td key={d} title={title} style={{padding:2,textAlign:'center',background:bg,borderRadius:2,minWidth:18}} />;
              })}
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div style={{display:'flex',gap:16,marginTop:10,fontSize:'0.7rem',color:'var(--muted)'}}>
        <span><span style={{display:'inline-block',width:12,height:12,background:'#22C55E',borderRadius:2,verticalAlign:'middle',marginRight:4}} />Approuve</span>
        <span><span style={{display:'inline-block',width:12,height:12,background:'#F97316',borderRadius:2,verticalAlign:'middle',marginRight:4}} />En attente</span>
        <span><span style={{display:'inline-block',width:12,height:12,background:'var(--lavender)',borderRadius:2,verticalAlign:'middle',marginRight:4}} />Weekend</span>
      </div>
    </div>
  );
}

/** Onglet Management — vue d'équipe avec CRUD objectifs, édition entretiens RH et suivi congés par membre */
function ManagementTab({ manager, team, collabs, settings, teamPendingAbs = [], onAbsenceUpdate }) {
  const [view, setView] = useState('overview'); // overview | detail
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberTab, setMemberTab] = useState('objectifs');
  const [memberAbs, setMemberAbs] = useState([]);
  const [refuseId, setRefuseId] = useState(null);
  const [refuseMotif, setRefuseMotif] = useState('');
  const [refuseLoading, setRefuseLoading] = useState(false);
  const pendingCount = teamPendingAbs.length;
  const [overviewTab, setOverviewTab] = useState(pendingCount > 0 ? 'conges' : 'objectifs');
  const [objModal, setObjModal] = useState(false);
  const [editingObj, setEditingObj] = useState(null);
  const [objForm, setObjForm] = useState({});
  const [editingPoint, setEditingPoint] = useState(null);
  const [pointForm, setPointForm] = useState({});

  const loadMemberAbs = async (id) => { const data = await api.getAbsences({collaborateur_id:id}); setMemberAbs(data||[]); };
  const managerName = manager.prenom+' '+manager.nom;

  const submitRefuse = async () => {
    if (!refuseMotif.trim()) return;
    setRefuseLoading(true);
    try {
      await api.updateAbsence(refuseId, { statut:'refuse', motif_refus: refuseMotif.trim() });
      if(onAbsenceUpdate) onAbsenceUpdate();
      if(selectedMember) loadMemberAbs(selectedMember.id);
      setRefuseId(null); setRefuseMotif('');
    } catch(e) { alert('Erreur: '+e.message); }
    setRefuseLoading(false);
  };

  // ── OVERVIEW ──
  if (view === 'overview') {
    return (
      <div>
        <div style={{display:'flex',gap:6,marginBottom:20,background:'var(--offwhite)',padding:6,borderRadius:12}}>
          {[['affilies','👥 Affiliés'],['objectifs','🎯 Objectifs'],['points','📋 Entretiens équipe'],['conges','🏖️ Congés']].map(([k,l])=>(
            <button key={k} onClick={()=>setOverviewTab(k)} style={{position:'relative',flex:1,padding:'10px 14px',borderRadius:10,border:'none',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',background:overviewTab===k?'var(--pink)':'transparent',color:overviewTab===k?'white':'var(--muted)',border:overviewTab===k?'none':'1.5px solid var(--lavender)',boxShadow:overviewTab===k?'0 4px 14px rgba(255,50,133,0.3)':'none'}}>
              {l}
              {k==='conges' && pendingCount > 0 && <span style={{position:'absolute',top:-4,right:-4,background:'var(--orange)',color:'white',borderRadius:'50%',width:20,height:20,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontWeight:800,boxShadow:'0 2px 6px rgba(249,115,22,0.4)'}}>{pendingCount}</span>}
            </button>
          ))}
        </div>

        {/* Vue affiliés — liste des membres de l'équipe */}
        {overviewTab==='affilies' && <>
          <div style={{fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>👥 Mes affiliés ({team.length})<span style={{flex:1,height:1,background:'var(--lavender)'}} /></div>
          {team.map(m => {
            const mObjs = (m.objectifs||[]).filter(o=>o.statut!=='atteint').length;
            const mPoints = (m.points_suivi||[]).filter(p=>p.type==='mensuel');
            const lastPoint = mPoints.sort((a,b)=>(b.mois||'')>(a.mois||'')?1:-1)[0];
            const pointStatus = lastPoint ? (Object.keys(lastPoint.manager_data||{}).some(k=>k!=='objectifs'&&(lastPoint.manager_data||{})[k]) ? 'done' : 'pending') : 'none';
            return <div key={m.id} className="card" style={{marginBottom:10,padding:16,cursor:'pointer'}} onClick={()=>{setSelectedMember(m);setView('detail');setMemberTab('objectifs');loadMemberAbs(m.id);}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <Avatar prenom={m.prenom} nom={m.nom} photoUrl={m.photo_url} size={44} />
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:'var(--blue)',fontSize:'0.95rem'}}>{m.prenom} {m.nom}</div>
                  <div style={{fontSize:'0.75rem',color:'var(--muted)'}}>{m.poste}{m.equipe ? ` · ${m.equipe}` : ''}</div>
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {mObjs > 0 && <Badge type="pink">{mObjs} obj.</Badge>}
                  <Badge type={pointStatus==='done'?'green':pointStatus==='pending'?'orange':'gray'}>{pointStatus==='done'?'✅ Point':'⏳ Point'}</Badge>
                </div>
              </div>
            </div>;
          })}
        </>}

        {/* Vue objectifs de tous les managés */}
        {overviewTab==='objectifs' && team.map(m => {
          const objs = m.objectifs||[];
          return <div key={m.id} className="card" style={{marginBottom:16,padding:16}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,cursor:'pointer'}} onClick={()=>{setSelectedMember(m);setView('detail');setMemberTab('objectifs');}}>
              <Avatar prenom={m.prenom} nom={m.nom} photoUrl={m.photo_url} size={36} />
              <div><div style={{fontWeight:700,color:'var(--blue)',fontSize:'0.9rem'}}>{m.prenom} {m.nom}</div><div style={{fontSize:'0.72rem',color:'var(--muted)'}}>{m.poste}</div></div>
            </div>
            {objs.filter(o=>o.statut!=='atteint').map(o=>(
              <div key={o.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--lavender)'}}>
                <span style={{flex:1,fontWeight:600,color:'var(--navy)',fontSize:'0.85rem'}}>{o.titre}</span>
                <Badge type={STATUS_COLORS[o.statut]}>{STATUS_LABELS[o.statut]}</Badge>
                <span style={{fontSize:'0.78rem',fontWeight:700,color:'var(--pink)'}}>{o.progression||0}%</span>
              </div>
            ))}
            {objs.length===0 && <p style={{color:'var(--muted)',fontSize:'0.82rem',fontStyle:'italic'}}>Aucun objectif</p>}
          </div>;
        })}

        {/* Vue entretiens de tous les managés */}
        {overviewTab==='points' && team.map(m => {
          const pts = (m.points_suivi||[]).filter(p=>p.type==='mensuel').sort((a,b)=>(b.mois||'')>(a.mois||'')?1:-1);
          const last = pts[0];
          const md = last?.manager_data||{};
          const hasM = Object.keys(md).filter(k=>k!=='objectifs').some(k=>md[k]);
          return <div key={m.id} className="card" style={{marginBottom:12,padding:16}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,cursor:'pointer'}} onClick={()=>{setSelectedMember(m);setView('detail');setMemberTab('points');}}>
              <Avatar prenom={m.prenom} nom={m.nom} photoUrl={m.photo_url} size={36} />
              <div style={{flex:1}}><div style={{fontWeight:700,color:'var(--blue)',fontSize:'0.9rem'}}>{m.prenom} {m.nom}</div></div>
              <Badge type={hasM?'green':'orange'}>{hasM?'✅ Rempli':'⏳ À remplir'}</Badge>
            </div>
          </div>;
        })}

        {/* Vue congés de tous les managés */}
        {overviewTab==='conges' && <>
          {/* Calendrier équipe */}
          <ManagerTeamCalendar team={team} teamPendingAbs={teamPendingAbs} />

          {/* Demandes en attente */}
          {pendingCount > 0 && <>
            <div style={{fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase',color:'var(--orange)',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
              🔔 Demandes en attente ({pendingCount})
              <span style={{flex:1,height:1,background:'var(--lavender)'}} />
            </div>
            {teamPendingAbs.map(a => {
              const m = collabs.find(x=>x.id===a.collaborateur_id);
              return <div key={a.id} className="card" style={{marginBottom:10,padding:14,borderLeft:'4px solid var(--orange)'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  {m && <Avatar prenom={m.prenom} nom={m.nom} photoUrl={m.photo_url} size={36} />}
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.88rem'}}>{m ? `${m.prenom} ${m.nom}` : '—'}</div>
                    <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>{ABS_TYPES[a.type]||a.type} · Du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)} · {absenceDays(a)}j ouvré{absenceDays(a)>1?'s':''}</div>
                    {a.commentaire && <div style={{fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic',marginTop:2}}>{a.commentaire}</div>}
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-sm" style={{background:'var(--green)',color:'white',padding:'5px 12px'}} onClick={async()=>{try{await api.updateAbsence(a.id,{statut:'approuve'});if(onAbsenceUpdate)onAbsenceUpdate();}catch(e){alert('Erreur: '+e.message);}}}>✓ Approuver</button>
                    <button className="btn btn-danger btn-sm" style={{padding:'5px 12px'}} onClick={()=>{setRefuseId(a.id);setRefuseMotif('');}}>✕ Refuser</button>
                  </div>
                </div>
              </div>;
            })}
          </>}
          {/* Liste des membres */}
          <div style={{fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:10,marginTop:pendingCount?16:0,display:'flex',alignItems:'center',gap:8}}>
            👥 Équipe
            <span style={{flex:1,height:1,background:'var(--lavender)'}} />
          </div>
          {team.map(m => {
            const mPending = teamPendingAbs.filter(a=>a.collaborateur_id===m.id).length;
            return <div key={m.id} className="card" style={{marginBottom:12,padding:16,cursor:'pointer'}} onClick={()=>{setSelectedMember(m);setView('detail');setMemberTab('conges');loadMemberAbs(m.id);}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <Avatar prenom={m.prenom} nom={m.nom} photoUrl={m.photo_url} size={36} />
                <div style={{flex:1}}><div style={{fontWeight:700,color:'var(--blue)',fontSize:'0.9rem'}}>{m.prenom} {m.nom}</div></div>
                {mPending > 0 && <Badge type="orange">⏳ {mPending} en attente</Badge>}
                <span style={{fontSize:'0.82rem',fontWeight:700,color:'var(--navy)'}}>{(m.solde_conges||0).toFixed(2)}j</span>
              </div>
            </div>;
          })}
        </>}
      </div>
    );
  }

  // ── DETAIL VIEW ──
  const m = selectedMember;
  if (!m) return null;
  const mObjs = m.objectifs||[];
  const mPoints = (m.points_suivi||[]).filter(p=>p.type==='mensuel').sort((a,b)=>(b.mois||'')>(a.mois||'')?1:-1);

  const openAddObj = () => { setEditingObj(null); setObjForm({titre:'',description:'',date_debut:'',date_fin:'',statut:'en-cours',progression:0}); setObjModal(true); };
  const openEditObj = (o) => { setEditingObj(o.id); setObjForm({titre:o.titre,description:o.description||'',date_debut:o.date_debut||'',date_fin:o.date_fin||'',statut:o.statut,progression:o.progression||0}); setObjModal(true); };

  const saveObj = async () => {
    if (!objForm.titre) return;
    const prog = objForm.statut==='atteint'?100:parseInt(objForm.progression)||0;
    const row = {collaborateur_id:m.id,titre:objForm.titre,description:objForm.description||null,date_debut:objForm.date_debut||null,date_fin:objForm.date_fin||null,statut:objForm.statut,progression:prog};
    try {
      if (editingObj) {
        const existing = mObjs.find(o=>o.id===editingObj);
        const changes = [];
        if (existing) {
          if (existing.titre!==objForm.titre) changes.push({champ:'Titre',avant:existing.titre,apres:objForm.titre});
          if (existing.statut!==objForm.statut) changes.push({champ:'Statut',avant:STATUS_LABELS[existing.statut],apres:STATUS_LABELS[objForm.statut]});
          if ((existing.progression||0)!==prog) changes.push({champ:'Progression',avant:(existing.progression||0)+'%',apres:prog+'%'});
        }
        if (changes.length) row.historique = [...(existing?.historique||[]),{date:new Date().toISOString().split('T')[0],auteur:managerName,changes}];
        await api.updateObjectif(editingObj, row);
      } else {
        row.historique = [{date:new Date().toISOString().split('T')[0],auteur:managerName,changes:[{champ:'Création',avant:'',apres:objForm.titre}]}];
        await api.createObjectif(row);
      }
      setObjModal(false);
      const fresh = await api.getCollaborateur(m.id);
      setSelectedMember(fresh);
    } catch(e) {
      console.error('Erreur sauvegarde objectif:', e);
      alert('Erreur lors de la sauvegarde de l\'objectif.');
    }
  };

  const deleteObj = async (oid) => {
    if (!window.confirm('Supprimer ?')) return;
    try {
      await api.deleteObjectif(oid);
      const fresh = await api.getCollaborateur(m.id);
      setSelectedMember(fresh);
    } catch(e) {
      console.error('Erreur suppression objectif:', e);
      alert('Erreur lors de la suppression.');
    }
  };

  const startEditPoint = (p) => {
    const mgr = getManagerQuestions(settings);
    const data = {};
    mgr.keys.forEach(k => { data[k] = (p.manager_data||{})[k] || ''; });
    data._labels = mgr.labels;
    data._keys = mgr.keys;
    setEditingPoint(p.id);
    setPointForm(data);
  };
  const savePoint = async () => {
    const toSave = {};
    (pointForm._keys||[]).forEach(k => { toSave[k] = pointForm[k]; });
    try {
      await api.updatePointSuivi(editingPoint, {manager_data:toSave});
      setEditingPoint(null);
      const fresh = await api.getCollaborateur(m.id);
      setSelectedMember(fresh);
    } catch(e) {
      console.error('Erreur sauvegarde entretien:', e);
      alert('Erreur lors de la sauvegarde.');
    }
  };

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={()=>{setView('overview');setSelectedMember(null);}} style={{marginBottom:16}}>← Retour</button>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20}}>
        <Avatar prenom={m.prenom} nom={m.nom} photoUrl={m.photo_url} size={56} />
        <div><div style={{fontSize:'1.1rem',fontWeight:700,color:'var(--navy)'}}>{m.prenom} {m.nom}</div><div style={{fontSize:'0.85rem',color:'var(--muted)'}}>{m.poste}</div></div>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:20,background:'var(--offwhite)',padding:6,borderRadius:12}}>
        {[['affilies','👥 Affiliés'],['objectifs','🎯 Objectifs'],['points','📋 Entretiens équipe'],['conges','🏖️ Congés']].map(([k,l])=>(
          <button key={k} onClick={()=>{setMemberTab(k);if(k==='conges')loadMemberAbs(m.id);}} style={{flex:1,padding:'10px 14px',borderRadius:10,border:'none',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',background:memberTab===k?'var(--pink)':'transparent',color:memberTab===k?'white':'var(--muted)',border:memberTab===k?'none':'1.5px solid var(--lavender)',boxShadow:memberTab===k?'0 4px 14px rgba(255,50,133,0.3)':'none'}}>{l}</button>
        ))}
      </div>

      {/* Objectifs CRUD */}
      {memberTab==='objectifs' && <div>
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}><button className="btn btn-primary btn-sm" onClick={openAddObj}>+ Objectif</button></div>
        {mObjs.filter(o=>o.statut!=='atteint').map((o,i)=>(
          <div key={o.id} className="card" style={{marginBottom:8,padding:14,borderLeft:'4px solid var(--pink)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{fontWeight:700,color:'var(--navy)',flex:1}}>{o.titre}</span>
              <Badge type={STATUS_COLORS[o.statut]}>{STATUS_LABELS[o.statut]}</Badge>
              <button className="btn btn-ghost btn-sm" style={{padding:'4px 8px'}} onClick={()=>openEditObj(o)}>✏️</button>
              <button className="btn btn-danger btn-sm" style={{padding:'4px 8px'}} onClick={()=>deleteObj(o.id)}>🗑️</button>
            </div>
            {o.description && <div style={{fontSize:'0.82rem',color:'var(--muted)',marginBottom:6}}>{o.description}</div>}
            <div style={{marginBottom:4}}><div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',marginBottom:4}}><span>Progression</span><span>{o.progression||0}%</span></div><ProgressBar value={o.progression||0} /></div>
            {o.date_debut && <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>📅 {fmtDate(o.date_debut)} → {fmtDate(o.date_fin)}</div>}
            {o.historique?.length>0 && <details style={{marginTop:8}}><summary style={{fontSize:'0.72rem',color:'var(--muted)',cursor:'pointer',fontWeight:700}}>📜 Historique ({o.historique.length})</summary>
              {[...o.historique].reverse().map((h,hi)=><div key={hi} style={{display:'flex',gap:8,padding:'6px 8px',background:'var(--offwhite)',borderRadius:6,marginTop:4,fontSize:'0.75rem'}}><span style={{color:'var(--muted)',fontWeight:600,minWidth:70}}>{fmtDate(h.date)}</span><div><strong>{h.auteur}</strong>{h.changes?.map((ch,ci)=><div key={ci} style={{color:'var(--muted)'}}>{ch.champ}: <span style={{textDecoration:'line-through',color:'var(--red)'}}>{ch.avant}</span> → <span style={{color:'var(--green)',fontWeight:600}}>{ch.apres}</span></div>)}</div></div>)}
            </details>}
          </div>
        ))}
        {mObjs.filter(o=>o.statut==='atteint').length>0 && <><div className="section-title" style={{marginTop:16}}>✅ Atteints</div>{mObjs.filter(o=>o.statut==='atteint').map(o=>(<div key={o.id} className="card" style={{marginBottom:8,padding:14,borderLeft:'4px solid var(--green)',opacity:0.85}}><span style={{fontWeight:700,color:'var(--navy)'}}>{o.titre}</span></div>))}</>}
        {mObjs.length===0 && <EmptyState icon="🎯" text="Aucun objectif" />}
        {/* Obj Modal */}
        {objModal && <div className="modal-overlay-react" onClick={e=>{if(e.target===e.currentTarget)setObjModal(false)}}><div className="modal-content-react" style={{maxWidth:560}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}><h2 style={{fontSize:'1rem',fontWeight:700,color:'var(--navy)'}}>{editingObj?'Modifier':'Nouvel objectif'}</h2><button onClick={()=>setObjModal(false)} style={{background:'none',border:'none',fontSize:'1.3rem',cursor:'pointer',color:'var(--muted)'}}>✕</button></div>
          <div className="form-grid">
            <div className="form-field full"><label>Titre *</label><input value={objForm.titre||''} onChange={e=>setObjForm({...objForm,titre:e.target.value})} /></div>
            <div className="form-field full"><label>Description</label><textarea value={objForm.description||''} onChange={e=>setObjForm({...objForm,description:e.target.value})} /></div>
            <div className="form-field"><label>Début</label><input type="date" value={objForm.date_debut||''} onChange={e=>setObjForm({...objForm,date_debut:e.target.value})} /></div>
            <div className="form-field"><label>Fin</label><input type="date" value={objForm.date_fin||''} onChange={e=>setObjForm({...objForm,date_fin:e.target.value})} /></div>
            <div className="form-field"><label>Statut</label><select value={objForm.statut||'en-cours'} onChange={e=>setObjForm({...objForm,statut:e.target.value})}>{Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
            <div className="form-field"><label>Progression ({objForm.progression||0}%)</label><input type="range" min="0" max="100" value={objForm.progression||0} onChange={e=>setObjForm({...objForm,progression:e.target.value})} style={{accentColor:'var(--pink)'}} /></div>
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:12}}><button className="btn btn-ghost" onClick={()=>setObjModal(false)}>Annuler</button><button className="btn btn-primary" onClick={saveObj}>Enregistrer</button></div>
        </div></div>}
      </div>}

      {/* Entretien RH — éditable */}
      {memberTab==='points' && <div>
        {mPoints.length===0 ? <EmptyState icon="📋" text="Aucun entretien" /> : mPoints.map(p=>{
          const md=p.manager_data||{};
          const cd=p.collab_data||{};
          const isEditing = editingPoint===p.id;
          return <div key={p.id} className="card" style={{marginBottom:10,padding:16,borderLeft:'4px solid var(--skyblue)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontWeight:700,color:'var(--navy)'}}>📅 {moisLabel(p.mois)}</div>
              {!isEditing && <button className="btn btn-ghost btn-sm" onClick={()=>startEditPoint(p)}>✏️ Remplir</button>}
            </div>
            {/* Manager section */}
            <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--skyblue)',marginBottom:8}}>👔 Mes retours</div>
            {isEditing ? <>
              {(pointForm._keys||[]).map((k,i)=>(
                <div key={k} style={{marginBottom:8}}><label style={{fontSize:'0.72rem',fontWeight:700,color:'var(--pink)',display:'block',marginBottom:4}}>{(pointForm._labels||[])[i]||k}</label>
                <textarea value={pointForm[k]||''} onChange={e=>setPointForm({...pointForm,[k]:e.target.value})} style={{width:'100%',border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.85rem',minHeight:60,resize:'vertical',outline:'none'}} /></div>
              ))}
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>setEditingPoint(null)}>Annuler</button>
                <button className="btn btn-primary btn-sm" onClick={savePoint}>💾 Enregistrer</button>
              </div>
            </> : Object.entries(md).filter(([k])=>k!=='objectifs').map(([k,v])=>(
              <div key={k} style={{marginBottom:6}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)'}}>{k}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:v?'var(--navy)':'var(--muted)',fontStyle:v?'normal':'italic'}}>{v||'Non renseigné'}</div></div>
            ))}
            {/* Collab responses (read-only) */}
            {Object.keys(cd).filter(k=>k!=='objectifs').length>0 && <>
              <div style={{marginTop:12,fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginBottom:8}}>👤 Réponses de {m.prenom}</div>
              {Object.entries(cd).filter(([k])=>k!=='objectifs').map(([k,v])=>(
                <div key={k} style={{marginBottom:6}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)'}}>{k}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:v?'var(--navy)':'var(--muted)',fontStyle:v?'normal':'italic'}}>{v||'—'}</div></div>
              ))}
            </>}
          </div>;
        })}
      </div>}

      {/* Congés */}
      {memberTab==='conges' && <div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:10,marginBottom:16}}>
          <div className="card" style={{textAlign:'center',padding:14}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--green)'}}>{(m.solde_conges||0).toFixed(2)}j</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Solde</div></div>
          <div className="card" style={{textAlign:'center',padding:14}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--pink)'}}>{memberAbs.filter(a=>a.statut==='approuve').length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Approuvés</div></div>
          <div className="card" style={{textAlign:'center',padding:14}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--orange)'}}>{memberAbs.filter(a=>a.statut==='en_attente').length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>En attente</div></div>
        </div>
        {memberAbs.map(a=>(
          <div key={a.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',borderRadius:10,border:'1.5px solid var(--lavender)',marginBottom:8}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.88rem'}}>{ABS_TYPES[a.type]||a.type}</div>
              <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>Du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)} · {absenceDays(a)}j ouvré{absenceDays(a)>1?'s':''}</div>
            </div>
            <Badge type={a.statut==='approuve'?'green':a.statut==='refuse'?'pink':'orange'}>{ABS_STATUTS[a.statut]}</Badge>
            {a.statut==='en_attente' && <>
              <button className="btn btn-sm" style={{background:'var(--green)',color:'white',padding:'4px 10px'}} onClick={async()=>{try{await api.updateAbsence(a.id,{statut:'approuve'});loadMemberAbs(m.id);if(onAbsenceUpdate)onAbsenceUpdate();}catch(e){alert('Erreur: '+e.message);}}}>✓</button>
              <button className="btn btn-danger btn-sm" style={{padding:'4px 10px'}} onClick={()=>{setRefuseId(a.id);setRefuseMotif('');}}>✕</button>
            </>}
          </div>
        ))}
        {memberAbs.length===0 && <EmptyState icon="🏖️" text="Aucune demande" />}
      </div>}

      {/* REFUSE MODAL */}
      <Modal open={!!refuseId} onClose={()=>setRefuseId(null)} title="Refuser la demande">
        <p style={{fontSize:'0.88rem',color:'var(--muted)',marginBottom:16}}>Veuillez indiquer le motif du refus :</p>
        <div className="form-field">
          <label>Motif <span style={{color:'var(--red)'}}>*</span></label>
          <textarea autoFocus value={refuseMotif} onChange={e=>setRefuseMotif(e.target.value)} placeholder="Ex: Période de forte activité..." style={{minHeight:80}} />
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost" onClick={()=>setRefuseId(null)}>Annuler</button>
          <button className="btn btn-danger" onClick={submitRefuse} disabled={refuseLoading || !refuseMotif.trim()}>{refuseLoading ? '⏳ En cours...' : '✕ Refuser'}</button>
        </div>
      </Modal>
    </div>
  );
}
