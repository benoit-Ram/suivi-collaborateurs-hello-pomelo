import React, { useState } from 'react';
import { api } from '../../../services/api';
import { Avatar, Badge, Modal, ProgressBar, EmptyState, fmtDate, moisLabel, absenceDays, ABS_TYPES, STATUS_COLORS, STATUS_LABELS } from '../../../components/UI';
import { getManagerQuestions, getCollabQuestions } from '../utils/questions';
import ManagerTeamCalendar from './ManagerTeamCalendar';

export default 
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
      await api.updateAbsence(refuseId, { statut:'refuse', motif_refus: refuseMotif.trim(), approved_by: managerName, approved_at: new Date().toISOString() });
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
                    <button className="btn btn-sm" style={{background:'var(--green)',color:'white',padding:'5px 12px'}} onClick={async()=>{try{await api.updateAbsence(a.id,{statut:'approuve',approved_by:managerName,approved_at:new Date().toISOString()});if(onAbsenceUpdate)onAbsenceUpdate();}catch(e){alert('Erreur: '+e.message);}}}>✓ Approuver</button>
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
            </> : (()=>{
              const mgrQ = getManagerQuestions(settings);
              const keyToLabel = {}; mgrQ.questions.forEach(q => { keyToLabel[q.key] = q.label; });
              return Object.entries(md).filter(([k])=>k!=='objectifs').map(([k,v])=>(
                <div key={k} style={{marginBottom:6}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)'}}>{keyToLabel[k]||k}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:v?'var(--navy)':'var(--muted)',fontStyle:v?'normal':'italic'}}>{v||'Non renseigné'}</div></div>
              ));
            })()}
            {/* Collab responses (read-only) */}
            {Object.keys(cd).filter(k=>k!=='objectifs'&&k!=='_commentaire').length>0 && (()=>{
              const collabQ = getCollabQuestions(settings);
              const keyToLabel = {}; collabQ.forEach(q => { keyToLabel[q.key] = q.label; });
              return <>
              <div style={{marginTop:12,fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginBottom:8}}>👤 Réponses de {m.prenom}</div>
              {Object.entries(cd).filter(([k])=>k!=='objectifs'&&k!=='_commentaire').map(([k,v])=>(
                <div key={k} style={{marginBottom:6}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)'}}>{keyToLabel[k]||k}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:v?'var(--navy)':'var(--muted)',fontStyle:v?'normal':'italic'}}>{v||'—'}</div></div>
              ))}
              {cd._commentaire && <div style={{marginBottom:6}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)'}}>Commentaire libre</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:'var(--navy)'}}>{cd._commentaire}</div></div>}
            </>;
            })()}
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
              <button className="btn btn-sm" style={{background:'var(--green)',color:'white',padding:'4px 10px'}} onClick={async()=>{try{await api.updateAbsence(a.id,{statut:'approuve',approved_by:managerName,approved_at:new Date().toISOString()});loadMemberAbs(m.id);if(onAbsenceUpdate)onAbsenceUpdate();}catch(e){alert('Erreur: '+e.message);}}}>✓</button>
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
