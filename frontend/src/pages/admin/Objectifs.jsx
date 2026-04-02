import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
import { api } from '../../services/api';
import { PageHeader, Badge, ProgressBar, EmptyState, Modal, fmtDate, STATUS_LABELS, STATUS_COLORS } from '../../components/UI';

export default function Objectifs() {
  const { collabs, settings, showToast, reload } = useData();
  const navigate = useNavigate();
  const [tab, setTab] = useState('individuel');
  const [selectedCollab, setSelectedCollab] = useState('');
  const [objModal, setObjModal] = useState(false);
  const [editingObj, setEditingObj] = useState(null);
  const [objCollabId, setObjCollabId] = useState('');
  const [objForm, setObjForm] = useState({});
  const [teamObjEquipe, setTeamObjEquipe] = useState('');
  const [newTeamObj, setNewTeamObj] = useState({ titre:'', date_debut:'', date_fin:'' });

  const equipes = settings.equipes || [];
  const teamObjs = teamObjEquipe ? (settings['team_objectifs_'+teamObjEquipe]||[]).map(o =>
    typeof o === 'string' ? { titre:o, dateDebut:'', dateFin:'', progression:0 } : o
  ) : [];

  const addTeamObj = async () => {
    if (!newTeamObj.titre.trim()) { showToast('Titre obligatoire'); return; }
    const list = [...teamObjs, { titre:newTeamObj.titre.trim(), dateDebut:newTeamObj.date_debut, dateFin:newTeamObj.date_fin, progression:0 }];
    await api.upsertSetting('team_objectifs_'+teamObjEquipe, list);
    setNewTeamObj({ titre:'', date_debut:'', date_fin:'' });
    await reload();
    showToast('Objectif d\'équipe ajouté !');
  };

  const removeTeamObj = async (index) => {
    const list = [...teamObjs]; list.splice(index,1);
    await api.upsertSetting('team_objectifs_'+teamObjEquipe, list);
    await reload();
    showToast('Supprimé');
  };

  const editTeamObjProg = async (index, prog) => {
    const list = [...teamObjs]; list[index] = { ...list[index], progression: parseInt(prog)||0 };
    await api.upsertSetting('team_objectifs_'+teamObjEquipe, list);
    await reload();
  };

  return (
    <div>
      <PageHeader title="Objectifs" subtitle="Objectifs individuels et d'équipe" />

      <div style={{ display:'flex', gap:6, marginBottom:24, background:'var(--offwhite)', padding:6, borderRadius:12, maxWidth:400 }}>
        {[['individuel','👤 Individuels'],['equipe','👥 Par équipe']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex:1, padding:'10px 16px', borderRadius:10, border:'none', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:700, cursor:'pointer', background: tab===k?'white':'transparent', color: tab===k?'var(--navy)':'var(--muted)', boxShadow: tab===k?'0 2px 8px rgba(5,5,109,0.1)':'none' }}>{l}</button>
        ))}
      </div>

      {tab === 'individuel' && <div>
        <select value={selectedCollab} onChange={e => setSelectedCollab(e.target.value)} style={{ border:'1.5px solid var(--lavender)', borderRadius:10, padding:'10px 14px', fontFamily:'inherit', fontSize:'0.9rem', marginBottom:16, minWidth:300 }}>
          <option value="">— Tous les collaborateurs —</option>
          {collabs.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom} — {c.poste}</option>)}
        </select>

        {(selectedCollab ? [collabs.find(c => c.id === selectedCollab)].filter(Boolean) : collabs).map(c => {
          const objs = c.objectifs || [];
          if (!objs.length && !selectedCollab) return null;
          return (
            <div key={c.id} style={{ marginBottom:24 }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{ fontWeight:700, color:'var(--blue)', cursor:'pointer' }} onClick={()=>navigate(`/admin/collaborateurs/${c.id}`)}>{c.prenom} {c.nom} — {objs.length} objectif{objs.length>1?'s':''}</div>
                <button className="btn btn-primary btn-sm" onClick={()=>{setObjCollabId(c.id);setEditingObj(null);setObjForm({titre:'',description:'',date_debut:'',date_fin:'',statut:'en-cours',progression:0,recurrence:''});setObjModal(true);}}>+ Objectif</button>
              </div>
              {objs.map((o,i) => (
                <div key={o.id} className="card" style={{ marginBottom:8, padding:14, borderLeft:`4px solid ${o.statut==='atteint'?'var(--green)':'var(--pink)'}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontWeight:700, color:'var(--navy)', flex:1 }}>{o.titre}</span>
                    <Badge type={STATUS_COLORS[o.statut]}>{STATUS_LABELS[o.statut]}</Badge>
                    {o.recurrence && <Badge type="blue">🔄</Badge>}
                    <button className="btn btn-ghost btn-sm" style={{padding:'4px 8px'}} onClick={()=>{setObjCollabId(c.id);setEditingObj(o.id);setObjForm({titre:o.titre,description:o.description||'',date_debut:o.date_debut||'',date_fin:o.date_fin||'',statut:o.statut,progression:o.progression||0,recurrence:o.recurrence||''});setObjModal(true);}}>✏️</button>
                    <button className="btn btn-danger btn-sm" style={{padding:'4px 8px'}} onClick={async()=>{if(!window.confirm('Supprimer ?'))return;await api.deleteObjectif(o.id);await reload();showToast('Supprimé');}}>🗑️</button>
                  </div>
                  <ProgressBar value={o.statut==='atteint'?100:(o.progression||0)} />
                  <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginTop:4 }}>📅 {fmtDate(o.date_debut)} → {fmtDate(o.date_fin)}</div>
                  {o.historique?.length>0 && <details style={{marginTop:6}}><summary style={{fontSize:'0.72rem',color:'var(--muted)',cursor:'pointer',fontWeight:700}}>📜 Historique ({o.historique.length})</summary>
                    {[...o.historique].reverse().map((h,hi)=><div key={hi} style={{display:'flex',gap:8,padding:'4px 8px',background:'var(--offwhite)',borderRadius:6,marginTop:4,fontSize:'0.75rem'}}><span style={{color:'var(--muted)',fontWeight:600,minWidth:70}}>{fmtDate(h.date)}</span><div><strong>{h.auteur}</strong>{h.changes?.map((ch,ci)=><div key={ci} style={{color:'var(--muted)'}}>{ch.champ}: <span style={{textDecoration:'line-through',color:'var(--red)'}}>{ch.avant}</span> → <span style={{color:'var(--green)',fontWeight:600}}>{ch.apres}</span></div>)}</div></div>)}
                  </details>}
                </div>
              ))}
              {objs.length===0 && <p style={{color:'var(--muted)',fontSize:'0.82rem',fontStyle:'italic'}}>Aucun objectif</p>}
            </div>
          );
        })}
        <Modal open={objModal} onClose={()=>setObjModal(false)} title={editingObj?'Modifier l\'objectif':'Nouvel objectif'}>
          <div className="form-grid">
            <div className="form-field full"><label>Titre *</label><input value={objForm.titre||''} onChange={e=>setObjForm({...objForm,titre:e.target.value})} /></div>
            <div className="form-field full"><label>Description</label><textarea value={objForm.description||''} onChange={e=>setObjForm({...objForm,description:e.target.value})} /></div>
            <div className="form-field"><label>Début</label><input type="date" value={objForm.date_debut||''} onChange={e=>setObjForm({...objForm,date_debut:e.target.value})} /></div>
            <div className="form-field"><label>Fin</label><input type="date" value={objForm.date_fin||''} onChange={e=>setObjForm({...objForm,date_fin:e.target.value})} /></div>
            <div className="form-field"><label>Statut</label><select value={objForm.statut||'en-cours'} onChange={e=>setObjForm({...objForm,statut:e.target.value})}>{Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
            <div className="form-field"><label>Progression ({objForm.progression||0}%)</label><input type="range" min="0" max="100" value={objForm.progression||0} onChange={e=>setObjForm({...objForm,progression:e.target.value})} style={{accentColor:'var(--pink)'}} /></div>
            <div className="form-field full"><label>Récurrence</label><select value={objForm.recurrence||''} onChange={e=>setObjForm({...objForm,recurrence:e.target.value})}><option value="">Aucune</option><option value="hebdo">Hebdomadaire</option><option value="mensuel">Mensuel</option></select></div>
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
            <button className="btn btn-ghost" onClick={()=>setObjModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={async()=>{
              if (!objForm.titre) { showToast('Titre obligatoire'); return; }
              const prog = objForm.statut==='atteint'?100:parseInt(objForm.progression)||0;
              const row = {collaborateur_id:objCollabId,titre:objForm.titre,description:objForm.description||null,date_debut:objForm.date_debut||null,date_fin:objForm.date_fin||null,statut:objForm.statut,progression:prog,recurrence:objForm.recurrence||null};
              try {
                if (editingObj) {
                  const c2 = collabs.find(x=>x.id===objCollabId);
                  const existing = (c2?.objectifs||[]).find(o=>o.id===editingObj);
                  const changes = [];
                  if (existing) {
                    if (existing.titre!==objForm.titre) changes.push({champ:'Titre',avant:existing.titre,apres:objForm.titre});
                    if (existing.statut!==objForm.statut) changes.push({champ:'Statut',avant:STATUS_LABELS[existing.statut],apres:STATUS_LABELS[objForm.statut]});
                    if ((existing.progression||0)!==prog) changes.push({champ:'Progression',avant:(existing.progression||0)+'%',apres:prog+'%'});
                  }
                  if (changes.length) row.historique = [...(existing?.historique||[]),{date:new Date().toISOString().split('T')[0],auteur:'Admin',changes}];
                  await api.updateObjectif(editingObj, row);
                } else {
                  row.historique = [{date:new Date().toISOString().split('T')[0],auteur:'Admin',changes:[{champ:'Création',avant:'',apres:objForm.titre}]}];
                  await api.createObjectif(row);
                }
                await reload(); setObjModal(false); showToast('Objectif enregistré !');
              } catch(e) { showToast('Erreur: '+e.message); }
            }}>Enregistrer</button>
          </div>
        </Modal>
      </div>}

      {tab === 'equipe' && <div>
        <div style={{ marginBottom:16 }}>
          <select value={teamObjEquipe} onChange={e => setTeamObjEquipe(e.target.value)}
            style={{ border:'1.5px solid var(--lavender)', borderRadius:10, padding:'10px 14px', fontFamily:'inherit', fontSize:'0.9rem', minWidth:250 }}>
            <option value="">— Choisir une équipe —</option>
            {equipes.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {!teamObjEquipe ? (
          <div className="card" style={{overflowX:'auto'}}>
            <table><thead><tr><th>Équipe</th><th>Objectifs</th></tr></thead>
            <tbody>{equipes.map(eq => {
              const n = (settings['team_objectifs_'+eq]||[]).length;
              return <tr key={eq}><td style={{fontWeight:700}}>{eq}</td><td>{n} objectif{n>1?'s':''}</td></tr>;
            })}</tbody></table>
          </div>
        ) : <>
          {teamObjs.length === 0 && <p style={{ color:'var(--muted)', fontSize:'0.85rem', fontStyle:'italic', marginBottom:12 }}>Aucun objectif pour cette équipe.</p>}
          {teamObjs.map((o, i) => (
            <div key={i} className="card" style={{ marginBottom:8, padding:14, borderLeft:'4px solid var(--blue)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ fontWeight:700, color:'var(--navy)', flex:1 }}>{o.titre}</span>
                <Badge type="blue">Équipe</Badge>
                <button className="btn btn-danger btn-sm" style={{padding:'4px 8px'}} onClick={() => removeTeamObj(i)}>✕</button>
              </div>
              <div style={{marginBottom:6}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',marginBottom:4}}><span>Progression</span><span>{o.progression||0}%</span></div>
                <input type="range" min="0" max="100" value={o.progression||0} onChange={e => editTeamObjProg(i, e.target.value)} style={{width:'100%',accentColor:'var(--blue)'}} />
              </div>
              {(o.dateDebut || o.dateFin) && <div style={{ fontSize:'0.72rem', color:'var(--muted)' }}>📅 {fmtDate(o.dateDebut)} → {fmtDate(o.dateFin)}</div>}
            </div>
          ))}
          <div className="card" style={{marginTop:12}}>
            <div className="form-grid">
              <div className="form-field"><label>Titre</label><input value={newTeamObj.titre} onChange={e => setNewTeamObj({...newTeamObj, titre:e.target.value})} placeholder="Objectif d'équipe..." /></div>
              <div className="form-field"><label>Début</label><input type="date" value={newTeamObj.date_debut} onChange={e => setNewTeamObj({...newTeamObj, date_debut:e.target.value})} /></div>
              <div className="form-field"><label>Fin</label><input type="date" value={newTeamObj.date_fin} onChange={e => setNewTeamObj({...newTeamObj, date_fin:e.target.value})} /></div>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}><button className="btn btn-primary btn-sm" onClick={addTeamObj}>+ Ajouter</button></div>
          </div>
        </>}
      </div>}
    </div>
  );
}
