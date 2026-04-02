import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Avatar, Badge, ProgressBar, EmptyState, fmtDate, moisLabel, currentMois, STATUS_LABELS, STATUS_COLORS, ABS_TYPES, ABS_STATUTS, isEntretienLocked, getEntretienStatus, ENTRETIEN_STATUS_BADGE } from '../../components/UI';

export default function CollabAccueil() {
  const [collabs, setCollabs] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [settings, setSettings] = useState({});
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState('accueil');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getCollaborateurs(), api.getSettings()]).then(([data, s]) => {
      setCollabs(data||[]);
      const sm = {}; (s||[]).forEach(r => { sm[r.key] = r.value; }); setSettings(sm);
      setLoading(false);
      // Auto-select from URL param (admin impersonate)
      const params = new URLSearchParams(window.location.search);
      const impId = params.get('impersonate');
      if (impId && (data||[]).find(c=>c.id===impId)) { setSelectedId(impId); }
    });
  }, []);

  if (loading) return <div style={{textAlign:'center',padding:48,color:'var(--muted)'}}>Chargement...</div>;

  // Account selector
  if (!selectedId) {
    return (
      <div>
        <h2 style={{fontSize:'1.3rem',fontWeight:700,color:'var(--navy)',marginBottom:8}}>Choisir un compte</h2>
        <p style={{color:'var(--muted)',marginBottom:20}}>Sélectionnez un collaborateur.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
          {collabs.map(c => (
            <div key={c.id} className="card" onClick={() => { setSelectedId(c.id); loadAbsences(c.id); }} style={{cursor:'pointer',padding:16,transition:'all 0.15s',border:'2px solid transparent'}}
              onMouseOver={e=>e.currentTarget.style.borderColor='var(--pink)'} onMouseOut={e=>e.currentTarget.style.borderColor='transparent'}>
              <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={36} />
              <div style={{fontWeight:700,fontSize:'0.88rem',color:'var(--navy)',marginTop:8}}>{c.prenom} {c.nom}</div>
              <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>{c.poste}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  async function loadAbsences(cid) {
    const data = await api.getAbsences({ collaborateur_id: cid });
    setAbsences(data || []);
  }

  const c = collabs.find(x => x.id === selectedId);
  if (!c) return null;

  const objs = c.objectifs||[];
  const enCours = objs.filter(o => o.statut==='en-cours');
  const atteints = objs.filter(o => o.statut==='atteint');
  const cm = currentMois();
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
  const pris = absences.filter(a=>a.statut==='approuve'&&a.type==='conge').length;
  const solde = Math.round((soldeInit+acquis-pris)*100)/100;

  const tabs = [['accueil','🏠 Accueil'],['objectifs','🎯 Objectifs'],['points','📋 Entretien RH'],['conges','🏖️ Congés']];
  if (myTeam.length) tabs.splice(3, 0, ['management','👔 Management']);

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={()=>{setSelectedId('');setTab('accueil');}} style={{marginBottom:16}}>← Changer de compte</button>

      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24,background:'linear-gradient(135deg,#F0F0FF,#FFF0F8)',borderRadius:16,padding:24,border:'1.5px solid #E0D8FF'}}>
        <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={64} />
        <div>
          <div style={{fontSize:'1.2rem',fontWeight:700,color:'var(--navy)'}}>{c.prenom} {c.nom}</div>
          <div style={{fontSize:'0.85rem',color:'var(--muted)',marginTop:2}}>{c.poste}{c.equipe ? ` · ${c.equipe}` : ''}</div>
        </div>
      </div>

      <div style={{display:'flex',gap:6,marginBottom:24,background:'var(--offwhite)',padding:6,borderRadius:12,overflowX:'auto'}}>
        {tabs.map(([k,l]) => (
          <button key={k} onClick={()=>{setTab(k); if(k==='conges') loadAbsences(selectedId);}} style={{flex:1,padding:'10px 14px',borderRadius:10,border:'none',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',background:tab===k?'white':'transparent',color:tab===k?'var(--navy)':'var(--muted)',boxShadow:tab===k?'0 2px 8px rgba(5,5,109,0.1)':'none'}}>{l}</button>
        ))}
      </div>

      {/* ACCUEIL */}
      {tab==='accueil' && <div>
        <h3 style={{fontSize:'1.1rem',fontWeight:700,color:'var(--navy)',marginBottom:16}}>Bonjour {c.prenom} 👋</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:14,marginBottom:24}}>
          <div className="card" style={{textAlign:'center',padding:18}}><div style={{fontSize:'2rem',fontWeight:700,color:'var(--pink)'}}>{enCours.length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>En cours</div></div>
          <div className="card" style={{textAlign:'center',padding:18}}><div style={{fontSize:'2rem',fontWeight:700,color:'var(--green)'}}>{atteints.length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Atteints</div></div>
          <div className="card" style={{textAlign:'center',padding:18}}><div style={{fontSize:'2rem',fontWeight:700,color:'var(--navy)'}}>{solde}j</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Congés</div></div>
        </div>
        {enCours.length > 0 && <div className="card"><div className="section-title" style={{marginTop:0}}>🎯 Objectifs en cours</div>
          {enCours.slice(0,3).map(o => <div key={o.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--lavender)'}}><div style={{flex:1,fontWeight:600,color:'var(--navy)',fontSize:'0.88rem'}}>{o.titre}</div><span style={{fontWeight:700,fontSize:'0.82rem',color:'var(--pink)'}}>{o.progression||0}%</span></div>)}
        </div>}
      </div>}

      {/* OBJECTIFS */}
      {tab==='objectifs' && <div>
        {enCours.length > 0 && <><div className="section-title">En cours ({enCours.length})</div>{enCours.map((o,i)=><ObjCard key={o.id} o={o} i={i} />)}</>}
        {atteints.length > 0 && <><div className="section-title" style={{marginTop:24}}>✅ Atteints ({atteints.length})</div>{atteints.map((o,i)=><ObjCard key={o.id} o={o} i={i} />)}</>}
        {objs.length===0 && <EmptyState icon="🎯" text="Aucun objectif" />}
      </div>}

      {/* POINTS */}
      {tab==='points' && <div>
        {points.length===0 ? <EmptyState icon="📋" text="Aucun entretien RH" /> : points.map(p => <PointCard key={p.id} p={p} collabId={c.id} settings={settings} />)}
      </div>}

      {/* CONGÉS */}
      {tab==='conges' && <CongesTab c={c} absences={absences} solde={solde} onReload={() => loadAbsences(c.id)} api={api} />}

      {/* MANAGEMENT */}
      {tab==='management' && <ManagementTab manager={c} team={myTeam} collabs={collabs} />}
    </div>
  );
}

function ObjCard({ o, i }) {
  const pct = o.statut==='atteint'?100:(o.progression||0);
  const colors = { 'en-cours':'linear-gradient(90deg,var(--pink),var(--blue))', 'atteint':'var(--green)', 'non-atteint':'var(--orange)', 'en-attente':'var(--lavender)' };
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
    </div>
  );
}

const DEFAULT_COLLAB_Q = ['Comment t\'es-tu senti(e) au travail ?','Réussites du mois','Objectifs M-1 atteints ?','Suggestions process','Objectifs mois suivant','Autres sujets','Axe d\'amélioration'];

function PointCard({ p, collabId, settings }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const md = p.manager_data||{}; const cd = p.collab_data||{};
  const locked = isEntretienLocked(p.mois);
  const status = getEntretienStatus(p);
  const statusBadge = locked ? {label:'🔒 Verrouillé',type:'gray'} : ENTRETIEN_STATUS_BADGE[status];

  // Dynamic questions from settings or defaults
  const collabQuestions = (settings?.questions_collab||[]).length > 0
    ? (settings.questions_collab).map((q,i) => ({key:'cq'+i, label:q.label||q, type:q.type||'texte'}))
    : DEFAULT_COLLAB_Q.map((q,i) => ({key:'cq'+i, label:q, type:'texte'}));

  const managerQuestions = (settings?.questions_manager||[]).length > 0
    ? (settings.questions_manager).map((q,i) => ({key:'q'+i, label:q.label||q, type:q.type||'texte'}))
    : [{key:'retoursMissions',label:'Retours sur les missions'},{key:'tauxStaffing',label:'Taux de staffing'},{key:'qualites',label:'Qualités'},{key:'axeAmelioration',label:'Axe d\'amélioration'}];

  const startEdit = () => {
    const data = {};
    collabQuestions.forEach(q => { data[q.key] = cd[q.key] || ''; });
    data._commentaire = cd._commentaire || '';
    setFormData(data);
    setEditing(true);
  };

  const saveResponses = async () => {
    setSaving(true);
    try {
      await api.updatePointSuivi(p.id, { collab_data: formData });
      Object.assign(cd, formData);
      setEditing(false);
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  const exportPDF = () => {
    const win = window.open('','_blank');
    win.document.write(`<html><head><title>Entretien RH ${moisLabel(p.mois)}</title><style>body{font-family:Quicksand,Arial,sans-serif;padding:32px;max-width:800px;margin:0 auto;color:#05056D}h1{font-size:1.3rem}h2{font-size:1rem;color:#FF3285;margin:20px 0 8px}.field{margin-bottom:12px}.field-label{font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#6B6B9A;margin-bottom:2px}.field-value{font-size:0.9rem;line-height:1.5;padding:8px 0;border-bottom:1px solid #CFD0E5}@media print{body{padding:16px}}</style></head><body>`);
    win.document.write(`<h1>Entretien RH — ${moisLabel(p.mois)}</h1>`);
    win.document.write(`<h2>👔 Manager</h2>`);
    managerQuestions.forEach(q => { win.document.write(`<div class="field"><div class="field-label">${q.label}</div><div class="field-value">${md[q.key]||'—'}</div></div>`); });
    win.document.write(`<h2>👤 Collaborateur</h2>`);
    collabQuestions.forEach(q => { win.document.write(`<div class="field"><div class="field-label">${q.label}</div><div class="field-value">${cd[q.key]||'—'}</div></div>`); });
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
              {q.type==='notation' ? <div style={{display:'flex',alignItems:'center',gap:8}}><input type="range" min="1" max="5" value={formData[q.key]||3} onChange={e=>setFormData({...formData,[q.key]:e.target.value})} style={{flex:1,accentColor:'var(--pink)'}} /><span style={{fontWeight:700}}>{formData[q.key]||3}/5</span></div>
              : <textarea value={formData[q.key]||''} onChange={e=>setFormData({...formData,[q.key]:e.target.value})} placeholder="Votre réponse..." style={{width:'100%',border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.85rem',minHeight:60,resize:'vertical',outline:'none'}} />}
            </div>
          ))}
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
            return v ? <div key={q.key} style={{marginBottom:8,marginTop:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>{q.label}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:'var(--navy)'}}>{q.type==='notation'?v+'/5':v}</div></div> : null;
          })}
          {cd._commentaire && <div style={{marginBottom:8,marginTop:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>Commentaire libre</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:'var(--navy)'}}>{cd._commentaire}</div></div>}
          {!Object.keys(cd).some(k=>cd[k]) && <p style={{fontSize:'0.82rem',color:'var(--muted)',fontStyle:'italic',marginTop:8}}>Vous n'avez pas encore rempli vos réponses.</p>}
        </>}
      </div>}
    </div>
  );
}

// ── CONGÉS TAB with request form ──
function CongesTab({ c, absences, solde, onReload }) {
  const [form, setForm] = useState({ type:'conge', date_debut:'', date_fin:'', commentaire:'' });
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!form.date_debut || !form.date_fin) { setError('Veuillez renseigner les dates de début et de fin.'); return; }
    if (form.date_fin < form.date_debut) { setError('La date de fin doit être après la date de début.'); return; }
    setSubmitting(true);
    try {
      await api.createAbsence({ collaborateur_id: c.id, type: form.type, date_debut: form.date_debut, date_fin: form.date_fin, statut: 'en_attente', commentaire: form.commentaire || null });
      setForm({ type:'conge', date_debut:'', date_fin:'', commentaire:'' });
      onReload();
    } catch(e) { setError('Erreur: ' + e.message); }
    setSubmitting(false);
  };

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
        <div className="card" style={{textAlign:'center',padding:16}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--green)'}}>{solde}j</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Solde</div></div>
        <div className="card" style={{textAlign:'center',padding:16}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--pink)'}}>{absences.filter(a=>a.statut==='approuve').length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Approuvés</div></div>
        <div className="card" style={{textAlign:'center',padding:16}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--orange)'}}>{absences.filter(a=>a.statut==='en_attente').length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>En attente</div></div>
      </div>

      {/* Formulaire de demande */}
      <div className="card" style={{marginBottom:24}}>
        <div className="section-title" style={{marginTop:0}}>Nouvelle demande</div>
        <div className="form-grid">
          <div className="form-field"><label>Type</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{Object.entries(ABS_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          <div className="form-field"><label>Du</label><input type="date" value={form.date_debut} onChange={e=>setForm({...form,date_debut:e.target.value})} /></div>
          <div className="form-field"><label>Au</label><input type="date" value={form.date_fin} onChange={e=>setForm({...form,date_fin:e.target.value})} /></div>
          <div className="form-field"><label>Commentaire</label><input type="text" value={form.commentaire} onChange={e=>setForm({...form,commentaire:e.target.value})} placeholder="Optionnel..." /></div>
        </div>
        {error && <div style={{marginTop:10,padding:'10px 14px',background:'#FFF1F2',color:'#881337',borderRadius:10,fontSize:'0.85rem',fontWeight:600,borderLeft:'4px solid #EF4444'}}>{error}</div>}
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>🏖️ Demander</button>
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
          <div key={a.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',borderRadius:12,border:'1.5px solid var(--orange)',marginBottom:8,background:'#FFF7ED'}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:'0.9rem',color:'var(--navy)'}}>{ABS_TYPES[a.type]||a.type}</div>
              <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:2}}>Du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)}</div>
              {a.commentaire && <div style={{fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic',marginTop:2}}>{a.commentaire}</div>}
            </div>
            <Badge type="orange">En attente</Badge>
          </div>
        ))}
      </>}

      {/* Historique (approuvés + refusés) */}
      <div className="section-title">📋 Historique</div>
      {absences.filter(a=>a.statut!=='en_attente').length===0 ? <p style={{color:'var(--muted)',fontSize:'0.82rem',fontStyle:'italic'}}>Aucun historique.</p> : absences.filter(a=>a.statut!=='en_attente').map(a => (
        <div key={a.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',borderRadius:12,border:`1.5px solid ${a.statut==='approuve'?'#86EFAC':'#F43F5E'}`,marginBottom:8,background:a.statut==='approuve'?'#F0FDF4':'#FFF1F2'}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:'0.9rem',color:'var(--navy)'}}>{ABS_TYPES[a.type]||a.type}</div>
            <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:2}}>Du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)}</div>
            {a.commentaire && <div style={{fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic',marginTop:2}}>{a.commentaire}</div>}
            {a.statut==='refuse' && a.motif_refus && <div style={{fontSize:'0.78rem',color:'#881337',marginTop:4,background:'white',padding:'6px 10px',borderRadius:6,borderLeft:'3px solid #F43F5E'}}>❌ Motif du refus : {a.motif_refus}</div>}
          </div>
          <Badge type={a.statut==='approuve'?'green':'pink'}>{a.statut==='approuve'?'✅ Approuvé':'❌ Refusé'}</Badge>
        </div>
      ))}
    </div>
  );
}

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
        if(isFerie) { bg='#EFF6FF'; color='#1E40AF'; }
        if(abs) { bg=abs.statut==='approuve'?'#DCFCE7':abs.statut==='en_attente'?'#FFF7ED':'#FFF1F2'; color=abs.statut==='approuve'?'#166534':abs.statut==='en_attente'?'#9A3412':'#881337'; }
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
        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'#DCFCE7'}} /> Approuvé</div>
        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'#FFF7ED'}} /> En attente</div>
        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'#EFF6FF'}} /> Férié</div>
        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--pink)'}} /> Aujourd'hui</div>
      </div>
    </div>
  );
}

function TeamCalendar({ collab }) {
  const [teammates, setTeammates] = useState([]);
  const [teamAbs, setTeamAbs] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  useEffect(() => {
    const equipes = (collab.equipe||'').split(',').map(s=>s.trim()).filter(Boolean);
    if (!equipes.length) return;
    api.getCollaborateurs().then(all => {
      const mates = (all||[]).filter(c => c.id!==collab.id && c.equipe && equipes.some(e => c.equipe.includes(e)));
      setTeammates(mates);
      if (mates.length) {
        api.getAbsences().then(abs => setTeamAbs((abs||[]).filter(a => mates.some(m=>m.id===a.collaborateur_id) && (a.statut==='approuve'||a.statut==='en_attente'))));
      }
    });
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
            return <tr key={c.id}><td style={{padding:'4px 8px',fontWeight:600,whiteSpace:'nowrap'}}>{c.prenom}</td>
              {Array.from({length:daysInMonth},(_,d)=>{
                const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d+1).padStart(2,'0')}`;
                const dow = new Date(year,month,d+1).getDay();
                const isWE = dow===0||dow===6;
                const a = abs.find(x=>ds>=x.date_debut&&ds<=x.date_fin);
                let bg = isWE?'var(--lavender)':'transparent';
                if(a) bg = a.statut==='approuve'?'#DCFCE7':'#FFF7ED';
                return <td key={d} style={{padding:2,textAlign:'center',background:bg,borderRadius:2}} />;
              })}
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

function ManagementTab({ manager, team, collabs }) {
  const [view, setView] = useState('overview'); // overview | detail
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberTab, setMemberTab] = useState('objectifs');
  const [memberAbs, setMemberAbs] = useState([]);
  const [overviewTab, setOverviewTab] = useState('objectifs');
  const [objModal, setObjModal] = useState(false);
  const [editingObj, setEditingObj] = useState(null);
  const [objForm, setObjForm] = useState({});
  const [editingPoint, setEditingPoint] = useState(null);
  const [pointForm, setPointForm] = useState({});

  const loadMemberAbs = async (id) => { const data = await api.getAbsences({collaborateur_id:id}); setMemberAbs(data||[]); };
  const managerName = manager.prenom+' '+manager.nom;

  // ── OVERVIEW ──
  if (view === 'overview') {
    return (
      <div>
        <div style={{display:'flex',gap:6,marginBottom:20,background:'var(--offwhite)',padding:6,borderRadius:12}}>
          {[['objectifs','🎯 Objectifs'],['points','📋 Entretiens RH'],['conges','🏖️ Congés']].map(([k,l])=>(
            <button key={k} onClick={()=>setOverviewTab(k)} style={{flex:1,padding:'10px 14px',borderRadius:10,border:'none',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',background:overviewTab===k?'white':'transparent',color:overviewTab===k?'var(--navy)':'var(--muted)',boxShadow:overviewTab===k?'0 2px 8px rgba(5,5,109,0.1)':'none'}}>{l}</button>
          ))}
        </div>

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
        {overviewTab==='conges' && team.map(m => {
          return <div key={m.id} className="card" style={{marginBottom:12,padding:16,cursor:'pointer'}} onClick={()=>{setSelectedMember(m);setView('detail');setMemberTab('conges');loadMemberAbs(m.id);}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <Avatar prenom={m.prenom} nom={m.nom} photoUrl={m.photo_url} size={36} />
              <div style={{flex:1}}><div style={{fontWeight:700,color:'var(--blue)',fontSize:'0.9rem'}}>{m.prenom} {m.nom}</div></div>
              <span style={{fontSize:'0.82rem',fontWeight:700,color:'var(--navy)'}}>{m.solde_conges||0}j</span>
            </div>
          </div>;
        })}
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
    // Refresh member data
    const fresh = await api.getCollaborateur(m.id);
    setSelectedMember(fresh);
  };

  const deleteObj = async (oid) => {
    if (!window.confirm('Supprimer ?')) return;
    await api.deleteObjectif(oid);
    const fresh = await api.getCollaborateur(m.id);
    setSelectedMember(fresh);
  };

  const startEditPoint = (p) => { setEditingPoint(p.id); setPointForm({...p.manager_data}); };
  const savePoint = async () => {
    await api.updatePointSuivi(editingPoint, {manager_data:pointForm});
    setEditingPoint(null);
    const fresh = await api.getCollaborateur(m.id);
    setSelectedMember(fresh);
  };

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={()=>{setView('overview');setSelectedMember(null);}} style={{marginBottom:16}}>← Retour</button>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20}}>
        <Avatar prenom={m.prenom} nom={m.nom} photoUrl={m.photo_url} size={56} />
        <div><div style={{fontSize:'1.1rem',fontWeight:700,color:'var(--navy)'}}>{m.prenom} {m.nom}</div><div style={{fontSize:'0.85rem',color:'var(--muted)'}}>{m.poste}</div></div>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:20,background:'var(--offwhite)',padding:6,borderRadius:12}}>
        {[['objectifs','🎯 Objectifs'],['points','📋 Entretien RH'],['conges','🏖️ Congés']].map(([k,l])=>(
          <button key={k} onClick={()=>{setMemberTab(k);if(k==='conges')loadMemberAbs(m.id);}} style={{flex:1,padding:'10px 14px',borderRadius:10,border:'none',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',background:memberTab===k?'white':'transparent',color:memberTab===k?'var(--navy)':'var(--muted)',boxShadow:memberTab===k?'0 2px 8px rgba(5,5,109,0.1)':'none'}}>{l}</button>
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
              {Object.keys(pointForm).filter(k=>k!=='objectifs').map(k=>(
                <div key={k} style={{marginBottom:8}}><label style={{fontSize:'0.72rem',fontWeight:700,color:'var(--pink)',display:'block',marginBottom:4}}>{k}</label>
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
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:16}}>
          <div className="card" style={{textAlign:'center',padding:14}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--green)'}}>{m.solde_conges||0}j</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Solde</div></div>
          <div className="card" style={{textAlign:'center',padding:14}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--pink)'}}>{memberAbs.filter(a=>a.statut==='approuve').length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Approuvés</div></div>
          <div className="card" style={{textAlign:'center',padding:14}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--orange)'}}>{memberAbs.filter(a=>a.statut==='en_attente').length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>En attente</div></div>
        </div>
        {memberAbs.map(a=>(
          <div key={a.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',borderRadius:10,border:'1.5px solid var(--lavender)',marginBottom:8}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.88rem'}}>{ABS_TYPES[a.type]||a.type}</div>
              <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>Du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)}</div>
            </div>
            <Badge type={a.statut==='approuve'?'green':a.statut==='refuse'?'pink':'orange'}>{ABS_STATUTS[a.statut]}</Badge>
            {a.statut==='en_attente' && <>
              <button className="btn btn-sm" style={{background:'var(--green)',color:'white',padding:'4px 10px'}} onClick={async()=>{await api.updateAbsence(a.id,{statut:'approuve'});loadMemberAbs(m.id);}}>✓</button>
              <button className="btn btn-danger btn-sm" style={{padding:'4px 10px'}} onClick={async()=>{const motif=window.prompt('Motif :');if(!motif)return;await api.updateAbsence(a.id,{statut:'refuse',motif_refus:motif});loadMemberAbs(m.id);}}>✕</button>
            </>}
          </div>
        ))}
        {memberAbs.length===0 && <EmptyState icon="🏖️" text="Aucune demande" />}
      </div>}
    </div>
  );
}
