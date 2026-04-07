import React, { useState, useEffect } from 'react';
import { useData } from '../../services/DataContext';
import { useAuth } from '../../services/AuthContext';
import { api } from '../../services/api';
import { PageHeader, Badge, Avatar, Modal, FadeIn, Skeleton, fmtDate } from '../../components/UI';

const STATUT_BADGE = { en_cours:'blue', termine:'green', annule:'pink', en_attente:'orange' };
const STATUT_LABEL = { en_cours:'En cours', termine:'Terminé', annule:'Annulé', en_attente:'En attente' };

export default function Missions() {
  const { collabs, showToast, loading: ctxLoading } = useData();
  const { user: authUser } = useAuth();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [search, setSearch] = useState('');
  // Create/Edit modal
  const [modal, setModal] = useState(null); // null | 'create' | mission object
  const [form, setForm] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  // Assignment modal
  const [assignModal, setAssignModal] = useState(null); // mission id
  const [assignForm, setAssignForm] = useState({ collaborateur_id:'', role:'', taux_staffing:100, date_debut:'', date_fin:'' });
  // Detail modal
  const [detail, setDetail] = useState(null);

  useEffect(() => { loadMissions(); }, []);

  async function loadMissions() {
    try {
      const data = await api.getMissions();
      setMissions(data || []);
    } catch(e) { console.error('Erreur missions:', e); }
    setLoading(false);
  }

  const openCreate = () => { setForm({ nom:'', client:'', description:'', categorie:'', statut:'en_cours', date_debut:'', date_fin:'', tjm:'', budget_vendu:'', methode_facturation:'regie', responsable_id:'' }); setModal('create'); };
  const openEdit = (m) => { setForm({ nom:m.nom, client:m.client, description:m.description||'', categorie:m.categorie||'', statut:m.statut, date_debut:m.date_debut||'', date_fin:m.date_fin||'', tjm:m.tjm||'', budget_vendu:m.budget_vendu||'', methode_facturation:m.methode_facturation||'regie', responsable_id:m.responsable_id||'' }); setModal(m); };

  const saveMission = async () => {
    if (!form.nom || !form.client) { showToast('Nom et client sont obligatoires'); return; }
    setFormLoading(true);
    try {
      const row = { ...form, tjm: form.tjm ? parseFloat(form.tjm) : null, budget_vendu: form.budget_vendu ? parseFloat(form.budget_vendu) : null, responsable_id: form.responsable_id || null };
      if (modal === 'create') {
        await api.createMission(row);
        showToast('Mission créée ✓');
      } else {
        await api.updateMission(modal.id, row);
        showToast('Mission mise à jour ✓');
      }
      setModal(null);
      loadMissions();
    } catch(e) { showToast('Erreur: ' + e.message); }
    setFormLoading(false);
  };

  const deleteMission = async (id) => {
    if (!confirm('Supprimer cette mission et toutes ses affectations ?')) return;
    try { await api.deleteMission(id); loadMissions(); showToast('Mission supprimée'); } catch(e) { showToast('Erreur: ' + e.message); }
  };

  const saveAssignment = async () => {
    if (!assignForm.collaborateur_id) { showToast('Sélectionnez un collaborateur'); return; }
    try {
      await api.createAssignment({ ...assignForm, mission_id: assignModal, taux_staffing: parseFloat(assignForm.taux_staffing) || 100 });
      setAssignModal(null);
      loadMissions();
      showToast('Collaborateur affecté ✓');
    } catch(e) { showToast('Erreur: ' + e.message); }
  };

  const removeAssignment = async (id) => {
    try { await api.deleteAssignment(id); loadMissions(); showToast('Affectation retirée'); } catch(e) { showToast('Erreur: ' + e.message); }
  };

  if (loading || ctxLoading) return <div style={{maxWidth:600,margin:'40px auto'}}><Skeleton lines={5} /></div>;

  const active = missions.filter(m => m.statut === 'en_cours');
  const filtered = search ? missions.filter(m => (m.nom+m.client+(m.categorie||'')).toLowerCase().includes(search.toLowerCase())) : missions;

  // Staffing calculation
  const staffingMap = {};
  collabs.forEach(c => { staffingMap[c.id] = { collab: c, taux: 0, missions: [] }; });
  missions.filter(m => m.statut === 'en_cours').forEach(m => {
    (m.assignments || []).filter(a => a.statut === 'actif').forEach(a => {
      if (staffingMap[a.collaborateur_id]) {
        staffingMap[a.collaborateur_id].taux += (a.taux_staffing || 0);
        staffingMap[a.collaborateur_id].missions.push({ nom: m.nom, client: m.client, taux: a.taux_staffing, role: a.role });
      }
    });
  });

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:8}}>
        <PageHeader title="Missions" subtitle="Gestion des projets et du staffing" />
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nouvelle mission</button>
      </div>

      <div className="tabs-scroll" style={{display:'flex',gap:6,marginBottom:24,background:'var(--offwhite)',padding:6,borderRadius:12,overflowX:'auto'}}>
        {[['active',`🚀 En cours (${active.length})`],['all','📋 Toutes'],['staffing','📊 Staffing']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:'1 0 auto',padding:'10px 14px',borderRadius:10,border:'none',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',background:tab===k?'var(--pink)':'transparent',color:tab===k?'white':'var(--muted)',border:tab===k?'none':'1.5px solid var(--lavender)',boxShadow:tab===k?'0 4px 14px rgba(255,50,133,0.3)':'none'}}>{l}</button>
        ))}
      </div>

      {/* EN COURS */}
      {tab==='active' && <FadeIn><div>
        {active.length === 0 ? <div className="card" style={{textAlign:'center',padding:32,color:'var(--muted)'}}>Aucune mission en cours</div> :
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:16}}>
          {active.map(m => <MissionCard key={m.id} m={m} collabs={collabs} onEdit={openEdit} onDelete={deleteMission} onAssign={()=>{setAssignModal(m.id);setAssignForm({collaborateur_id:'',role:'',taux_staffing:100,date_debut:m.date_debut||'',date_fin:m.date_fin||''});}} onRemoveAssign={removeAssignment} onDetail={setDetail} />)}
        </div>}
      </div></FadeIn>}

      {/* TOUTES */}
      {tab==='all' && <FadeIn><div>
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher une mission..." style={{width:'100%',maxWidth:400,border:'1.5px solid var(--lavender)',borderRadius:10,padding:'10px 16px',fontFamily:'inherit',fontSize:'0.9rem',outline:'none',background:'var(--offwhite)',color:'var(--navy)',marginBottom:16}} />
        <div className="card" style={{overflowX:'auto'}}>
          <table>
            <thead><tr><th>Mission</th><th>Client</th><th>Statut</th><th>Dates</th><th>Equipe</th><th>Budget</th><th></th></tr></thead>
            <tbody>{filtered.map(m=>(
              <tr key={m.id}>
                <td style={{fontWeight:700,color:'var(--navy)',cursor:'pointer'}} onClick={()=>setDetail(m)}>{m.nom}</td>
                <td>{m.client}</td>
                <td><Badge type={STATUT_BADGE[m.statut]}>{STATUT_LABEL[m.statut]||m.statut}</Badge></td>
                <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{fmtDate(m.date_debut)} → {fmtDate(m.date_fin)}</td>
                <td><div style={{display:'flex',gap:-4}}>{(m.assignments||[]).slice(0,4).map(a=>a.collaborateurs&&<Avatar key={a.id} prenom={a.collaborateurs.prenom} nom={a.collaborateurs.nom} photoUrl={a.collaborateurs.photo_url} size={24} />)}{(m.assignments||[]).length>4&&<span style={{fontSize:'0.7rem',color:'var(--muted)'}}>+{(m.assignments||[]).length-4}</span>}</div></td>
                <td style={{fontWeight:600}}>{m.budget_vendu?m.budget_vendu.toLocaleString('fr-FR')+'€':'—'}</td>
                <td><div style={{display:'flex',gap:4}}><button className="btn btn-ghost btn-sm" style={{padding:'3px 8px'}} onClick={()=>openEdit(m)}>✏️</button><button className="btn btn-danger btn-sm" style={{padding:'3px 8px'}} onClick={()=>deleteMission(m.id)}>🗑️</button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div></FadeIn>}

      {/* STAFFING */}
      {tab==='staffing' && <FadeIn><div className="card" style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Collaborateur</th><th>Taux staffing</th><th>Missions</th></tr></thead>
          <tbody>{Object.values(staffingMap).sort((a,b)=>b.taux-a.taux).map(({collab:c,taux,missions:ms})=>(
            <tr key={c.id}>
              <td><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={28} /><span style={{fontWeight:700,color:'var(--navy)'}}>{c.prenom} {c.nom}</span></div></td>
              <td><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:80,height:8,background:'var(--offwhite)',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(taux,100)}%`,background:taux>100?'var(--red)':taux>=80?'var(--orange)':'var(--green)',borderRadius:4}} /></div><span style={{fontWeight:700,fontSize:'0.85rem',color:taux>100?'var(--red)':taux>=80?'var(--orange)':'var(--green)'}}>{taux}%</span></div></td>
              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{ms.length===0?'Non staffé':ms.map(m=>`${m.nom} (${m.taux}%)`).join(', ')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div></FadeIn>}

      {/* CREATE/EDIT MODAL */}
      <Modal open={!!modal} onClose={()=>setModal(null)} title={modal==='create'?'Nouvelle mission':'Modifier la mission'}>
        <div className="form-grid">
          <div className="form-field"><label>Nom <span style={{color:'var(--red)'}}>*</span></label><input autoFocus value={form.nom||''} onChange={e=>setForm({...form,nom:e.target.value})} /></div>
          <div className="form-field"><label>Client <span style={{color:'var(--red)'}}>*</span></label><input value={form.client||''} onChange={e=>setForm({...form,client:e.target.value})} /></div>
          <div className="form-field"><label>Catégorie</label><input value={form.categorie||''} onChange={e=>setForm({...form,categorie:e.target.value})} placeholder="Ex: Web, Mobile, ERP..." /></div>
          <div className="form-field"><label>Statut</label><select value={form.statut||'en_cours'} onChange={e=>setForm({...form,statut:e.target.value})}>{Object.entries(STATUT_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          <div className="form-field"><label>Date début</label><input type="date" value={form.date_debut||''} onChange={e=>setForm({...form,date_debut:e.target.value})} /></div>
          <div className="form-field"><label>Date fin</label><input type="date" value={form.date_fin||''} onChange={e=>setForm({...form,date_fin:e.target.value})} /></div>
          <div className="form-field"><label>TJM moyen (€)</label><input type="number" value={form.tjm||''} onChange={e=>setForm({...form,tjm:e.target.value})} /></div>
          <div className="form-field"><label>Budget vendu (€)</label><input type="number" value={form.budget_vendu||''} onChange={e=>setForm({...form,budget_vendu:e.target.value})} /></div>
          <div className="form-field"><label>Facturation</label><select value={form.methode_facturation||'regie'} onChange={e=>setForm({...form,methode_facturation:e.target.value})}><option value="regie">Régie</option><option value="forfait">Forfait</option></select></div>
          <div className="form-field"><label>Responsable</label><select value={form.responsable_id||''} onChange={e=>setForm({...form,responsable_id:e.target.value})}><option value="">Aucun</option>{collabs.map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}</select></div>
        </div>
        <div className="form-field" style={{marginTop:8}}><label>Description</label><textarea value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description de la mission..." style={{minHeight:60}} /></div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost" onClick={()=>setModal(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={saveMission} disabled={formLoading}>{formLoading?'⏳...':'💾 Enregistrer'}</button>
        </div>
      </Modal>

      {/* ASSIGN MODAL */}
      <Modal open={!!assignModal} onClose={()=>setAssignModal(null)} title="Affecter un collaborateur">
        <div className="form-grid">
          <div className="form-field"><label>Collaborateur <span style={{color:'var(--red)'}}>*</span></label><select value={assignForm.collaborateur_id} onChange={e=>setAssignForm({...assignForm,collaborateur_id:e.target.value})}><option value="">Sélectionner...</option>{collabs.map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom} — {c.poste||''}</option>)}</select></div>
          <div className="form-field"><label>Rôle</label><input value={assignForm.role} onChange={e=>setAssignForm({...assignForm,role:e.target.value})} placeholder="Ex: Développeur, Designer..." /></div>
          <div className="form-field"><label>Taux staffing (%)</label><input type="number" min="0" max="100" value={assignForm.taux_staffing} onChange={e=>setAssignForm({...assignForm,taux_staffing:e.target.value})} /></div>
          <div className="form-field"><label>Du</label><input type="date" value={assignForm.date_debut} onChange={e=>setAssignForm({...assignForm,date_debut:e.target.value})} /></div>
          <div className="form-field"><label>Au</label><input type="date" value={assignForm.date_fin} onChange={e=>setAssignForm({...assignForm,date_fin:e.target.value})} /></div>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost" onClick={()=>setAssignModal(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={saveAssignment}>✓ Affecter</button>
        </div>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal open={!!detail} onClose={()=>setDetail(null)} title={detail?`${detail.nom} — ${detail.client}`:''}>
        {detail && <>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
            <Badge type={STATUT_BADGE[detail.statut]}>{STATUT_LABEL[detail.statut]}</Badge>
            {detail.categorie && <Badge type="blue">{detail.categorie}</Badge>}
            {detail.methode_facturation && <Badge type="gray">{detail.methode_facturation==='forfait'?'Forfait':'Régie'}</Badge>}
          </div>
          {detail.description && <p style={{color:'var(--muted)',fontSize:'0.85rem',marginBottom:12}}>{detail.description}</p>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
            <div><div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>Dates</div><div style={{fontWeight:600}}>{fmtDate(detail.date_debut)} → {fmtDate(detail.date_fin)}</div></div>
            <div><div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>Budget vendu</div><div style={{fontWeight:700,color:'var(--navy)'}}>{detail.budget_vendu?detail.budget_vendu.toLocaleString('fr-FR')+' €':'—'}</div></div>
            <div><div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>TJM moyen</div><div style={{fontWeight:600}}>{detail.tjm?detail.tjm+' €/j':'—'}</div></div>
            <div><div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>Responsable</div><div style={{fontWeight:600}}>{(()=>{const r=collabs.find(c=>c.id===detail.responsable_id);return r?r.prenom+' '+r.nom:'—';})()}</div></div>
          </div>
          <div style={{fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginBottom:8}}>Équipe ({(detail.assignments||[]).length})</div>
          {(detail.assignments||[]).map(a=>(
            <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',border:'1px solid var(--lavender)',borderRadius:10,marginBottom:6}}>
              {a.collaborateurs && <Avatar prenom={a.collaborateurs.prenom} nom={a.collaborateurs.nom} photoUrl={a.collaborateurs.photo_url} size={28} />}
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:'0.85rem',color:'var(--navy)'}}>{a.collaborateurs?a.collaborateurs.prenom+' '+a.collaborateurs.nom:'—'}</div><div style={{fontSize:'0.72rem',color:'var(--muted)'}}>{a.role||'—'} · {a.taux_staffing}%</div></div>
              <button className="btn btn-danger btn-sm" style={{padding:'2px 6px',fontSize:'0.65rem'}} onClick={()=>removeAssignment(a.id)}>✕</button>
            </div>
          ))}
        </>}
      </Modal>
    </div>
  );
}

function MissionCard({ m, collabs, onEdit, onDelete, onAssign, onRemoveAssign, onDetail }) {
  const team = (m.assignments || []).filter(a => a.statut === 'actif');
  const resp = m.responsable_id ? collabs.find(c => c.id === m.responsable_id) : null;
  return (
    <div className="card" style={{padding:20,borderLeft:`4px solid ${m.statut==='en_cours'?'var(--blue)':'var(--lavender)'}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div style={{cursor:'pointer'}} onClick={()=>onDetail(m)}>
          <div style={{fontWeight:700,fontSize:'1rem',color:'var(--navy)'}}>{m.nom}</div>
          <div style={{fontSize:'0.82rem',color:'var(--muted)',marginTop:2}}>{m.client}</div>
        </div>
        <Badge type={STATUT_BADGE[m.statut]}>{STATUT_LABEL[m.statut]}</Badge>
      </div>
      <div style={{display:'flex',gap:16,fontSize:'0.78rem',color:'var(--muted)',marginBottom:12,flexWrap:'wrap'}}>
        <span>📅 {fmtDate(m.date_debut)} → {fmtDate(m.date_fin)}</span>
        {m.budget_vendu && <span>💰 {m.budget_vendu.toLocaleString('fr-FR')} €</span>}
        {m.tjm && <span>📊 {m.tjm} €/j</span>}
        {m.methode_facturation && <span>{m.methode_facturation==='forfait'?'📦 Forfait':'⏱️ Régie'}</span>}
      </div>
      {resp && <div style={{fontSize:'0.75rem',color:'var(--muted)',marginBottom:8}}>👔 {resp.prenom} {resp.nom}</div>}
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
        {team.slice(0,5).map(a => a.collaborateurs && <Avatar key={a.id} prenom={a.collaborateurs.prenom} nom={a.collaborateurs.nom} photoUrl={a.collaborateurs.photo_url} size={28} tooltip={true} />)}
        {team.length > 5 && <span style={{fontSize:'0.72rem',color:'var(--muted)',fontWeight:700}}>+{team.length-5}</span>}
        {team.length === 0 && <span style={{fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic'}}>Aucun collaborateur affecté</span>}
      </div>
      <div style={{display:'flex',gap:6}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onAssign()}>+ Affecter</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>onEdit(m)}>✏️</button>
        <button className="btn btn-danger btn-sm" style={{padding:'5px 8px'}} onClick={()=>onDelete(m.id)}>🗑️</button>
      </div>
    </div>
  );
}
