import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
import { api } from '../../services/api';
import { Avatar, Badge, ProgressBar, EmptyState, Modal, FadeIn, Tabs, fmtDate, moisLabel, currentMois, isEntretienLocked, STATUS_LABELS, STATUS_COLORS } from '../../components/UI';
import { getManagerQuestions, getCollabQuestions } from '../collab/utils/questions';
import SynthesePDFModal from '../../components/SynthesePDFModal';

function exportCollabCSV(c, getManagerName) {
  const BOM = '\uFEFF';
  const lines = [
    ['Prénom','Nom','Poste','Email','Bureau','Équipe','Contrat','Manager','Date entrée'].join(';'),
    [c.prenom,c.nom,c.poste,c.email,c.bureau,c.equipe,c.contrat,c.manager_id?getManagerName(c.manager_id):'',c.date_entree].map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(';')
  ];
  const blob = new Blob([BOM+lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`${c.prenom}_${c.nom}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

export default function CollabProfile() {
  const { id } = useParams();
  const { collabs, absences, settings, showToast, getManagerName, reload } = useData();
  const [pdfModal, setPdfModal] = useState(false);
  const [tab, setTab] = useState('objectifs');
  const [objModal, setObjModal] = useState(false);
  const [objForm, setObjForm] = useState({});
  const [editingObj, setEditingObj] = useState(null);
  const navigate = useNavigate();
  const c = collabs.find(x => x.id === id);
  if (!c) return <EmptyState icon="👤" text="Collaborateur non trouvé" />;

  const objs = c.objectifs || [];
  const objsEnCours = objs.filter(o => o.statut !== 'atteint');
  const objsAtteints = objs.filter(o => o.statut === 'atteint');
  const points = (c.points_suivi||[]).filter(p => p.type==='mensuel').sort((a,b) => (b.mois||'')>(a.mois||'')?1:-1);
  const entretiens = (c.points_suivi||[]).filter(p => ['annuel','semestriel','fin_pe','professionnel'].includes(p.type)).sort((a,b) => (b.date||'')>(a.date||'')?1:-1);
  const manager = c.manager_id ? getManagerName(c.manager_id) : null;

  const openAddObj = () => { setEditingObj(null); setObjForm({ titre:'', description:'', date_debut:'', date_fin:'', statut:'en-cours', progression:0, recurrence:'' }); setObjModal(true); };
  const openEditObj = (o) => { setEditingObj(o.id); setObjForm({ titre:o.titre, description:o.description||'', date_debut:o.date_debut||'', date_fin:o.date_fin||'', statut:o.statut, progression:o.progression||0, recurrence:o.recurrence||'' }); setObjModal(true); };
  const saveObj = async () => {
    if (!objForm.titre) { showToast('Titre obligatoire'); return; }
    const prog = objForm.statut==='atteint'?100:parseInt(objForm.progression)||0;
    const row = { collaborateur_id:id, titre:objForm.titre, description:objForm.description||null, date_debut:objForm.date_debut||null, date_fin:objForm.date_fin||null, statut:objForm.statut, progression:prog, recurrence:objForm.recurrence||null };
    try {
      if (editingObj) {
        const existing = objs.find(o=>o.id===editingObj);
        const changes = [];
        if (existing) {
          if (existing.titre!==objForm.titre) changes.push({champ:'Titre',avant:existing.titre,apres:objForm.titre});
          if (existing.statut!==objForm.statut) changes.push({champ:'Statut',avant:STATUS_LABELS[existing.statut],apres:STATUS_LABELS[objForm.statut]});
          if ((existing.progression||0)!==prog) changes.push({champ:'Progression',avant:(existing.progression||0)+'%',apres:prog+'%'});
          if ((existing.date_debut||'')!==(objForm.date_debut||'')) changes.push({champ:'Date début',avant:fmtDate(existing.date_debut),apres:fmtDate(objForm.date_debut)});
          if ((existing.date_fin||'')!==(objForm.date_fin||'')) changes.push({champ:'Date fin',avant:fmtDate(existing.date_fin),apres:fmtDate(objForm.date_fin)});
        }
        if (changes.length) {
          const hist = [...(existing?.historique||[]), {date:new Date().toISOString().split('T')[0], auteur:'Admin', changes}];
          row.historique = hist;
        }
        await api.updateObjectif(editingObj, row);
      } else {
        row.historique = [{date:new Date().toISOString().split('T')[0], auteur:'Admin', changes:[{champ:'Création',avant:'',apres:objForm.titre}]}];
        await api.createObjectif(row);
      }
      await reload(); setObjModal(false); showToast('Objectif enregistré !');
    } catch(e) { showToast('Erreur: '+e.message); }
  };
  const deleteObj = async (oid) => {
    if (!window.confirm('Supprimer ?')) return;
    try { await api.deleteObjectif(oid); await reload(); showToast('Supprimé'); } catch(e) { showToast('Erreur: '+e.message); }
  };

  const voirComme = () => window.open(`/collab?impersonate=${id}`, '_blank');

  const tabs = [['objectifs','🎯 Objectifs'],['missions','🚀 Missions'],['points','📋 Entretien RH'],['onboarding','📁 Onboarding']];

  return (
    <div>
      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:16, fontSize:'0.78rem', color:'var(--muted)', fontWeight:600 }}>
        <a href="/admin" style={{color:'var(--muted)',textDecoration:'none'}}>Dashboard</a>
        <span style={{opacity:0.4}}>›</span>
        <a href="/admin/collaborateurs" style={{color:'var(--muted)',textDecoration:'none'}}>Collaborateurs</a>
        <span style={{opacity:0.4}}>›</span>
        <span style={{color:'var(--navy)'}}>{c.prenom} {c.nom}</span>
      </div>
      <div className="card" style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom:24, flexWrap:'wrap' }}>
        <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={72} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'1.3rem', fontWeight:700, color:'var(--navy)' }}>{c.prenom} {c.nom}</div>
          <div style={{ fontSize:'0.88rem', color:'var(--muted)', marginTop:2 }}>{c.poste}</div>
          <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginTop:10, fontSize:'0.78rem', color:'var(--muted)', fontWeight:600 }}>
            {c.email && <span>✉️ {c.email}</span>}
            {c.date_entree && <span>📅 {fmtDate(c.date_entree)}</span>}
            {c.bureau && <span>🏢 {c.bureau}</span>}
            {c.equipe && <span>👥 {c.equipe}</span>}
            {c.contrat && <span>📄 {c.contrat}</span>}
            {manager && <span>👔 {manager}</span>}
            {c.date_fin_essai && <span>⏰ Fin PE: {fmtDate(c.date_fin_essai)}</span>}
            {c.google_drive && <a href={c.google_drive} target="_blank" rel="noreferrer" style={{color:'var(--blue)'}}>📁 Drive</a>}
          </div>
          {(c.competences||[]).length > 0 && <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:10}}>
            {c.competences.map(comp => <span key={comp} style={{padding:'3px 8px',borderRadius:6,fontSize:'0.68rem',fontWeight:700,background:'var(--bg-info)',color:'var(--text-info)'}}>{comp}</span>)}
          </div>}
          {c.notes && <div style={{ marginTop:10, padding:'8px 12px', background:'var(--bg-warning)', borderRadius:8, borderLeft:'3px solid var(--border-warning)', fontSize:'0.82rem', color:'var(--text-warning)' }}>Notes: {c.notes}</div>}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/admin/collaborateurs?edit=${c.id}`)}>✏️ Modifier</button>
          <button className="btn btn-navy btn-sm" onClick={voirComme}>👁 {c.prenom}</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>exportCollabCSV(c,getManagerName)}>📥 CSV</button>
          <button className="btn btn-navy btn-sm" onClick={()=>setPdfModal(true)}>📄 Synthèse PDF</button>
        </div>
      </div>

      <Tabs items={tabs} active={tab} onChange={setTab} />

      {tab === 'objectifs' && <FadeIn><div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}><button className="btn btn-primary btn-sm" onClick={openAddObj}>+ Objectif</button></div>
        {objsEnCours.length > 0 && <><div className="section-title">En cours ({objsEnCours.length})</div>{objsEnCours.map((o,i)=><ObjCard key={o.id} o={o} i={i} onEdit={openEditObj} onDelete={deleteObj} />)}</>}
        {objsAtteints.length > 0 && <><div className="section-title" style={{marginTop:24}}>✅ Atteints ({objsAtteints.length})</div>{objsAtteints.map((o,i)=><ObjCard key={o.id} o={o} i={i} onEdit={openEditObj} onDelete={deleteObj} />)}</>}
        {objs.length===0 && <EmptyState icon="🎯" text="Aucun objectif" />}
        <Modal open={objModal} onClose={()=>setObjModal(false)} title={editingObj?'Modifier':'Nouvel objectif'}>
          <div className="form-grid">
            <div className="form-field full"><label>Titre *</label><input value={objForm.titre||''} onChange={e=>setObjForm({...objForm,titre:e.target.value})} /></div>
            <div className="form-field full"><label>Description</label><textarea value={objForm.description||''} onChange={e=>setObjForm({...objForm,description:e.target.value})} /></div>
            <div className="form-field"><label>Début</label><input type="date" value={objForm.date_debut||''} onChange={e=>setObjForm({...objForm,date_debut:e.target.value})} /></div>
            <div className="form-field"><label>Fin</label><input type="date" value={objForm.date_fin||''} onChange={e=>setObjForm({...objForm,date_fin:e.target.value})} /></div>
            <div className="form-field"><label>Statut</label><select value={objForm.statut||'en-cours'} onChange={e=>setObjForm({...objForm,statut:e.target.value})}>{Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
            <div className="form-field"><label>Progression ({objForm.progression||0}%)</label><input type="range" min="0" max="100" value={objForm.progression||0} onChange={e=>setObjForm({...objForm,progression:e.target.value})} /></div>
            <div className="form-field full"><label>Récurrence</label><select value={objForm.recurrence||''} onChange={e=>setObjForm({...objForm,recurrence:e.target.value})}><option value="">Aucune</option><option value="hebdo">Hebdomadaire</option><option value="mensuel">Mensuel</option></select></div>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
            <button className="btn btn-ghost" onClick={()=>setObjModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={saveObj}>Enregistrer</button>
          </div>
        </Modal>
      </div></FadeIn>}

      {tab === 'missions' && <FadeIn><CollabMissionsTab collabId={c.id} collabName={`${c.prenom} ${c.nom}`} navigate={navigate} /></FadeIn>}

      {tab === 'points' && <FadeIn><div>{points.length===0?<EmptyState icon="📋" text="Aucun point" />:points.map(p=><PointCard key={p.id} p={p} collab={c} settings={settings} objectifs={objs} onSave={async(pid,md)=>{try{await api.updatePointSuivi(pid,{manager_data:md});await reload();showToast('Point enregistré !')}catch(e){showToast('Erreur: '+e.message)}}} />)}</div></FadeIn>}

      {tab === 'onboarding' && <FadeIn><OnboardingTab collab={c} onSave={async(data)=>{try{await api.updateCollaborateur(c.id,{onboarding:data});await reload();showToast('Onboarding mis à jour !')}catch(e){showToast('Erreur: '+e.message)}}} /></FadeIn>}

      <SynthesePDFModal open={pdfModal} onClose={()=>setPdfModal(false)} collab={c} absences={absences} getManagerName={getManagerName} />
    </div>
  );
}

function ObjCard({ o, i, onEdit, onDelete }) {
  const pct = o.statut==='atteint'?100:(o.progression||0);
  const colors = { 'en-cours':'linear-gradient(90deg,var(--pink),var(--blue))', 'atteint':'var(--green)', 'non-atteint':'var(--orange)', 'en-attente':'var(--lavender)' };
  const [showHist, setShowHist] = useState(false);
  return (
    <div className="card" style={{ marginBottom:10, padding:16, borderLeft:`4px solid ${o.statut==='atteint'?'var(--green)':'var(--pink)'}`, opacity:o.statut==='atteint'?0.85:1 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <span style={{ background:o.statut==='atteint'?'var(--green)':'var(--pink)', color:'white', borderRadius:'50%', width:24, height:24, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:800 }}>{o.statut==='atteint'?'✓':i+1}</span>
        <span style={{ flex:1, fontWeight:700, color:'var(--navy)' }}>{o.titre}</span>
        <Badge type={STATUS_COLORS[o.statut]}>{STATUS_LABELS[o.statut]}</Badge>
        {o.recurrence && <Badge type="blue">🔄 {o.recurrence==='hebdo'?'Hebdo':'Mensuel'}</Badge>}
        <button className="btn btn-ghost btn-sm" aria-label="Modifier" onClick={()=>onEdit(o)}>✏️</button>
        <button className="btn btn-danger btn-sm" aria-label="Supprimer" onClick={()=>onDelete(o.id)}>🗑️</button>
      </div>
      {o.description && <div style={{ fontSize:'0.82rem', color:'var(--muted)', marginBottom:8 }}>{o.description}</div>}
      <div style={{marginBottom:6}}><div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',marginBottom:4}}><span>Progression</span><span>{pct}%</span></div><ProgressBar value={pct} color={colors[o.statut]} /></div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:'var(--muted)' }}>
        <span>📅 Du {fmtDate(o.date_debut)} au {fmtDate(o.date_fin)}</span>
        {o.historique?.length > 0 && <button onClick={()=>setShowHist(!showHist)} style={{background:'none',border:'none',color:'var(--muted)',fontSize:'0.72rem',fontWeight:700,cursor:'pointer',textDecoration:'underline'}}>📜 Historique ({o.historique.length})</button>}
      </div>
      {showHist && o.historique && <div style={{marginTop:10,paddingTop:10,borderTop:'1px dashed var(--lavender)'}}>
        {[...o.historique].reverse().map((h,hi) => (
          <div key={hi} style={{display:'flex',gap:10,padding:'6px 8px',background:'var(--offwhite)',borderRadius:6,marginBottom:4,fontSize:'0.78rem'}}>
            <span style={{color:'var(--muted)',fontWeight:600,minWidth:70}}>{fmtDate(h.date)}</span>
            <div style={{flex:1}}><strong>{h.auteur}</strong>{h.changes?.map((ch,ci)=><div key={ci} style={{color:'var(--muted)',marginTop:2}}>{ch.champ}: <span style={{textDecoration:'line-through',color:'var(--red)'}}>{ch.avant}</span> → <span style={{color:'var(--green)',fontWeight:600}}>{ch.apres}</span></div>)}</div>
          </div>
        ))}
      </div>}
    </div>
  );
}

function PointCard({ p, onSave, settings, collab, objectifs = [] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const md = p.manager_data||{}; const cd = p.collab_data||{};
  const locked = isEntretienLocked(p.mois);
  const managerQs = getManagerQuestions(settings || {}, collab).questions;
  const collabQs = getCollabQuestions(settings || {}, collab);
  const managerKeySet = new Set(managerQs.map(q => q.key));
  const collabKeySet = new Set(collabQs.map(q => q.key));
  const objById = Object.fromEntries((objectifs || []).map(o => [o.id, o]));
  const hasM = managerQs.some(q => md[q.key]);
  const hasC = collabQs.some(q => cd[q.key]) || Object.keys(cd).some(k => k.startsWith('obj_'));
  const status = hasM&&hasC?'green':hasM||hasC?'orange':'pink';
  const statusBadge = locked ? {label:'🔒 Verrouillé',type:'gray'} : {label: status==='green'?'✅ Complet':status==='orange'?'🟡 Partiel':'🔴 Vide', type: status};

  const startEdit = () => {
    const data = {};
    managerQs.forEach(q => { data[q.key] = md[q.key] || ''; });
    setFormData(data);
    setEditing(true);
  };
  const save = () => { onSave(p.id, formData); setEditing(false); };

  // Answers from data that correspond to an existing objectif (filter orphans)
  const collabObjAnswers = Object.entries(cd).filter(([k, v]) => k.startsWith('obj_') && v && objById[k.slice(4)]);

  return (
    <div className="card" style={{marginBottom:10,padding:0,overflow:'hidden'}}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',cursor:'pointer'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontWeight:700,color:'var(--navy)'}}>📅 {moisLabel(p.mois)}</span>
          <Badge type={statusBadge.type}>{statusBadge.label}</Badge>
        </div>
        <span style={{color:'var(--muted)'}}>{open?'▲':'▼'}</span>
      </div>
      {open && <div style={{padding:'0 18px 18px',borderTop:'1px solid var(--lavender)'}}>
        {locked && <div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.78rem',color:'var(--muted)',marginTop:10}}>🔒 Entretien verrouillé (au-delà du 5 du mois suivant) — non modifiable.</div>}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:14}}>
          <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--skyblue)'}}>👔 Manager</div>
          {!editing && !locked && <button className="btn btn-ghost btn-sm" onClick={startEdit}>✏️ Modifier</button>}
        </div>
        {editing ? <>
          {managerQs.map(q=>(
            <div key={q.key} style={{marginBottom:8,marginTop:8}}><label style={{fontSize:'0.72rem',fontWeight:700,color:'var(--pink)',display:'block',marginBottom:4}}>{q.label}</label>
            <textarea value={formData[q.key]||''} onChange={e=>setFormData({...formData,[q.key]:e.target.value})} style={{width:'100%',border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.85rem',minHeight:60,resize:'vertical',outline:'none'}} /></div>
          ))}
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(false)}>Annuler</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={locked}>💾 Enregistrer</button>
          </div>
        </> : managerQs.map(q=>(
          <div key={q.key} style={{marginBottom:8,marginTop:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>{q.label}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:md[q.key]?'var(--navy)':'var(--muted)',fontStyle:md[q.key]?'normal':'italic'}}>{md[q.key]||'Non renseigné'}</div></div>
        ))}
        {(collabQs.some(q=>cd[q.key]) || collabObjAnswers.length>0 || cd._commentaire) && <>
          <div style={{marginTop:14,fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginBottom:8}}>👤 Collaborateur</div>
          {collabQs.filter(q => cd[q.key]).map(q=>(
            <div key={q.key} style={{marginBottom:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>{q.label}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:'var(--navy)'}}>{cd[q.key]}</div></div>
          ))}
          {collabObjAnswers.length>0 && <>
            <div style={{marginTop:10,fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--green)',marginBottom:6}}>🎯 Avancement objectifs</div>
            {collabObjAnswers.map(([k, v]) => {
              const o = objById[k.slice(4)];
              return <div key={k} style={{marginBottom:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>{o.titre}{o.progression!=null && <span style={{color:'var(--muted)',fontWeight:600}}> ({o.progression}%)</span>}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:'var(--navy)'}}>{v}</div></div>;
            })}
          </>}
          {cd._commentaire && <div style={{marginBottom:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>Commentaire libre</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:'var(--navy)'}}>{cd._commentaire}</div></div>}
        </>}
      </div>}
    </div>
  );
}

function OnboardingTab({ collab, onSave }) {
  const onb = collab.onboarding || {};
  const [form, setForm] = useState({ notes: onb.notes||'', materiel: onb.materiel||'', acces: onb.acces||'' });
  const [customFields, setCustomFields] = useState(onb.customFields || []);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [showHist, setShowHist] = useState(false);
  const historique = onb.historique || [];

  const save = () => {
    const changes = [];
    if (form.notes !== (onb.notes||'')) changes.push({ champ:'Notes', avant: onb.notes||'(vide)', apres: form.notes||'(vide)' });
    if (form.materiel !== (onb.materiel||'')) changes.push({ champ:'Matériel', avant: onb.materiel||'(vide)', apres: form.materiel||'(vide)' });
    if (form.acces !== (onb.acces||'')) changes.push({ champ:'Accès', avant: onb.acces||'(vide)', apres: form.acces||'(vide)' });
    const oldCustom = JSON.stringify(onb.customFields||[]);
    const newCustom = JSON.stringify(customFields);
    if (oldCustom !== newCustom) changes.push({ champ:'Champs personnalisés', avant:'(modifié)', apres:'(modifié)' });

    const newHist = [...historique];
    if (changes.length) newHist.push({ date: new Date().toISOString().split('T')[0], auteur: 'Admin', changes });

    onSave({ ...onb, ...form, customFields, historique: newHist });
  };

  const addField = () => {
    if (!newFieldLabel.trim()) return;
    setCustomFields([...customFields, { label: newFieldLabel.trim(), value: '' }]);
    setNewFieldLabel('');
  };

  const updateField = (i, val) => {
    const f = [...customFields]; f[i] = { ...f[i], value: val }; setCustomFields(f);
  };

  const removeField = (i) => {
    const f = [...customFields]; f.splice(i, 1); setCustomFields(f);
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginTop: 0 }}>Informations onboarding</div>
        <div className="form-grid">
          <div className="form-field full"><label>Notes d'onboarding</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Informations spécifiques..." /></div>
          <div className="form-field"><label>PC / Matériel fourni</label><input value={form.materiel} onChange={e => setForm({...form, materiel: e.target.value})} placeholder="MacBook Pro 14''" /></div>
          <div className="form-field"><label>Accès créés</label><input value={form.acces} onChange={e => setForm({...form, acces: e.target.value})} placeholder="Gmail, Notion, Slack..." /></div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginTop: 0 }}>Éléments personnalisés</div>
        {customFields.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy)', minWidth: 120 }}>{f.label}</span>
            <input value={f.value} onChange={e => updateField(i, e.target.value)} placeholder="..." style={{ flex: 1, border: '1.5px solid var(--lavender)', borderRadius: 8, padding: '8px 12px', fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none' }} />
            <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => removeField(i)}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addField(); }} placeholder="Nom du champ..." style={{ flex: 1, border: '1.5px solid var(--lavender)', borderRadius: 8, padding: '8px 12px', fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none' }} />
          <button className="btn btn-ghost btn-sm" onClick={addField}>+ Ajouter un champ</button>
        </div>
      </div>

      {/* Historique des modifications */}
      {historique.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div className="section-title" style={{ marginTop: 0, marginBottom: 0 }}>📜 Historique ({historique.length})</div>
            <button onClick={() => setShowHist(!showHist)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', textDecoration:'underline' }}>{showHist ? 'Masquer' : 'Afficher'}</button>
          </div>
          {showHist && <div style={{ marginTop: 12 }}>
            {[...historique].reverse().map((h, hi) => (
              <div key={hi} style={{ display:'flex', gap:10, padding:'8px 10px', background:'var(--offwhite)', borderRadius:6, marginBottom:4, fontSize:'0.78rem' }}>
                <span style={{ color:'var(--muted)', fontWeight:600, minWidth:70 }}>{fmtDate(h.date)}</span>
                <div style={{ flex:1 }}>
                  <strong>{h.auteur}</strong>
                  {h.changes?.map((ch, ci) => (
                    <div key={ci} style={{ color:'var(--muted)', marginTop:2 }}>
                      {ch.champ} : {ch.avant ? <><span style={{ textDecoration:'line-through', color:'var(--red)' }}>{ch.avant}</span> → </> : ''}
                      <span style={{ color:'var(--green)', fontWeight:600 }}>{ch.apres}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={save}>💾 Enregistrer</button>
      </div>
    </div>
  );
}

/** Missions affectées à un collaborateur — vue admin */
function CollabMissionsTab({ collabId, collabName, navigate }) {
  const [assignments, setAssignments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api.getAssignments({ collaborateur_id: collabId }).then(data => {
      setAssignments(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [collabId]);

  if (loading) return <div style={{padding:20,color:'var(--muted)'}}>Chargement...</div>;

  const active = assignments.filter(a => a.statut === 'actif');
  const past = assignments.filter(a => a.statut !== 'actif');
  const totalStaffing = active.reduce((s, a) => s + (a.taux_staffing || 0), 0);

  return (
    <div>
      {/* Stats */}
      <div style={{display:'flex',gap:12,marginBottom:20}}>
        <div className="card" style={{flex:1,textAlign:'center',padding:14}}>
          <div style={{fontSize:'1.5rem',fontWeight:700,color:totalStaffing>100?'var(--red)':totalStaffing>=80?'var(--orange)':'var(--green)'}}>{totalStaffing}%</div>
          <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Staffing total</div>
        </div>
        <div className="card" style={{flex:1,textAlign:'center',padding:14}}>
          <div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--blue)'}}>{active.length}</div>
          <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Missions actives</div>
        </div>
        <div className="card" style={{flex:1,textAlign:'center',padding:14}}>
          <div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--navy)'}}>{(totalStaffing/100*5).toFixed(1)}j</div>
          <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Jours/sem.</div>
        </div>
      </div>

      {/* Active missions */}
      {active.length === 0 ? (
        <EmptyState icon="🚀" text={`${collabName} n'est affecte a aucune mission`} />
      ) : <>
        <div className="section-title">Missions en cours ({active.length})</div>
        {active.map(a => (
          <div key={a.id} className="card" style={{marginBottom:10,padding:16,borderLeft:'4px solid var(--blue)',cursor:'pointer'}} onClick={()=>navigate('/admin/missions')}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem'}}>{a.missions?.nom || '—'}</div>
                <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:2}}>{a.missions?.clients?.nom || a.missions?.client || '—'}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:700,color:'var(--blue)',fontSize:'1.1rem'}}>{a.taux_staffing}%</div>
                <div style={{fontSize:'0.68rem',color:'var(--muted)'}}>{(a.jours_par_semaine || (a.taux_staffing/100*5)).toFixed(1)}j/sem</div>
              </div>
            </div>
            <div style={{display:'flex',gap:12,fontSize:'0.75rem',color:'var(--muted)',marginTop:8,flexWrap:'wrap'}}>
              {a.role && <span>👤 {a.role}</span>}
              <span>📅 {fmtDate(a.date_debut)} → {fmtDate(a.date_fin)}</span>
              {a.tjm && <span>💰 {a.tjm} €/j</span>}
            </div>
          </div>
        ))}
      </>}

      {/* Past missions */}
      {past.length > 0 && <>
        <div className="section-title" style={{marginTop:20}}>Missions passées ({past.length})</div>
        {past.map(a => (
          <div key={a.id} className="card" style={{marginBottom:8,padding:14,opacity:0.7}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.88rem'}}>{a.missions?.nom || '—'}</div>
                <div style={{fontSize:'0.75rem',color:'var(--muted)'}}>{a.missions?.clients?.nom || a.missions?.client || '—'} · {a.role || '—'} · {a.taux_staffing}%</div>
              </div>
              <Badge type="gray">Terminé</Badge>
            </div>
          </div>
        ))}
      </>}
    </div>
  );
}
