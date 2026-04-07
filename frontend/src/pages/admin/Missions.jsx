import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../services/DataContext';
import { useAuth } from '../../services/AuthContext';
import { api } from '../../services/api';
import { PageHeader, Badge, Avatar, Modal, FadeIn, Skeleton, fmtDate } from '../../components/UI';

const STATUT_BADGE = { en_cours:'blue', termine:'green', annule:'pink', en_attente:'orange' };
const STATUT_LABEL = { en_cours:'En cours', termine:'Terminé', annule:'Annulé', en_attente:'En attente' };

export default function Missions() {
  const { collabs, settings, showToast, loading: ctxLoading } = useData();
  const missionCategories = settings?.mission_categories || ['Web','Mobile','ERP','DevOps','Design','Data','Conseil','TMA'];
  const missionRoles = settings?.mission_roles || [
    {label:'Directeur Projet',tjm:900},{label:'Product Manager',tjm:700},{label:'Product Owner',tjm:650},
    {label:'Proxi Product Owner',tjm:600},{label:'Lead Designer',tjm:800},{label:'Designer (UX/UI)',tjm:650},
    {label:'Tech Lead',tjm:900},{label:'Team Lead',tjm:800},{label:'Développeur',tjm:600},
    {label:'Ingénieur QA',tjm:700},{label:'Lead Devops',tjm:900},{label:'Ingénieur Devops',tjm:700},
    {label:'Architecte cloud',tjm:900},{label:'Chef de projet ERP',tjm:900},
    {label:'Consultant fonctionnel',tjm:800},{label:'Développeur intégrateur',tjm:900}
  ];
  const { user: authUser } = useAuth();
  const [missions, setMissions] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('clients');
  const [search, setSearch] = useState('');
  // Create/Edit modal
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  // Assignment modal
  const [assignModal, setAssignModal] = useState(null);
  const [assignForm, setAssignForm] = useState({ collaborateur_id:'', role:'', taux_staffing:100, jours_par_semaine:5, tjm:'', date_debut:'', date_fin:'' });
  // Detail modal
  const [detail, setDetail] = useState(null);
  // Client modal + detail
  const [clientModal, setClientModal] = useState(null);
  const [clientForm, setClientForm] = useState({});
  const [sirenResults, setSirenResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  // Timeline/Staffing filters
  const [filterClient, setFilterClient] = useState('');
  const [filterEquipes, setFilterEquipes] = useState([]); // multi-select
  const [showEquipeDropdown, setShowEquipeDropdown] = useState(false);
  const equipeDropdownRef = useRef(null);

  // Close equipe dropdown on outside click
  useEffect(() => {
    if (!showEquipeDropdown) return;
    const handler = (e) => { if (equipeDropdownRef.current && !equipeDropdownRef.current.contains(e.target)) setShowEquipeDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEquipeDropdown]);
  const [staffingDateDebut, setStaffingDateDebut] = useState('');
  const [staffingDateFin, setStaffingDateFin] = useState('');
  // Missions view
  const [viewMode, setViewMode] = useState('cartes'); // cartes | liste
  const [missionDateDebut, setMissionDateDebut] = useState('');
  const [missionDateFin, setMissionDateFin] = useState('');
  const [missionStatut, setMissionStatut] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [m, c] = await Promise.all([api.getMissions(), api.getClients()]);
      setMissions(m || []);
      setClients(c || []);
    } catch(e) { console.error('Erreur chargement:', e); }
    setLoading(false);
  }

  const getClientName = (m) => m.clients?.nom || m.client || '—';

  const openCreate = (clientId) => { setForm({ nom:'', client_id:clientId||'', description:'', categorie:'', statut:'en_cours', date_debut:'', date_fin:'', budget_vendu:'', methode_facturation:'regie', responsable_id:'', lien_propale:'' }); setModal('create'); };
  const openEdit = (m) => { setForm({ nom:m.nom, client_id:m.client_id||'', description:m.description||'', categorie:m.categorie||'', statut:m.statut, date_debut:m.date_debut||'', date_fin:m.date_fin||'', budget_vendu:m.budget_vendu||'', methode_facturation:m.methode_facturation||'regie', responsable_id:m.responsable_id||'', lien_propale:m.lien_propale||'' }); setModal(m); };

  const saveMission = async () => {
    if (!form.nom || !form.client_id) { showToast('Nom et client sont obligatoires'); return; }
    setFormLoading(true);
    try {
      const row = { ...form, budget_vendu: form.budget_vendu ? parseFloat(form.budget_vendu) : null, responsable_id: form.responsable_id || null, lien_propale: form.lien_propale || null };
      if (modal === 'create') {
        await api.createMission(row);
        showToast('Mission créée ✓');
      } else {
        await api.updateMission(modal.id, row);
        showToast('Mission mise à jour ✓');
      }
      setModal(null);
      loadData();
    } catch(e) { showToast('Erreur: ' + e.message); }
    setFormLoading(false);
  };

  const saveClient = async () => {
    if (!clientForm.nom) { showToast('Le nom du client est obligatoire'); return; }
    try {
      if (clientModal === 'create') {
        await api.createClient(clientForm);
        showToast('Client créé ✓');
      } else {
        await api.updateClient(clientModal.id, clientForm);
        showToast('Client mis à jour ✓');
      }
      setClientModal(null);
      loadData();
    } catch(e) { showToast('Erreur: ' + e.message); }
  };

  const deleteClient = async (id) => {
    const clientMissions = missions.filter(m => m.client_id === id);
    if (clientMissions.length > 0) { showToast('Impossible : ce client a des missions actives'); return; }
    if (!confirm('Supprimer ce client ?')) return;
    try { await api.deleteClient(id); loadData(); showToast('Client supprimé'); } catch(e) { showToast('Erreur: ' + e.message); }
  };

  const deleteMission = async (id) => {
    if (!confirm('Supprimer cette mission et toutes ses affectations ?')) return;
    try { await api.deleteMission(id); loadData(); showToast('Mission supprimée'); } catch(e) { showToast('Erreur: ' + e.message); }
  };

  const saveAssignment = async () => {
    if (!assignForm.collaborateur_id) { showToast('Sélectionnez un collaborateur'); return; }
    if (!assignForm.role) { showToast('Sélectionnez un rôle'); return; }
    if (!assignForm.tjm) { showToast('Le TJM est obligatoire'); return; }
    try {
      const jps = parseFloat(assignForm.jours_par_semaine) || 5;
      const taux = Math.round(jps / 5 * 100);
      await api.createAssignment({ ...assignForm, mission_id: assignModal, taux_staffing: taux, jours_par_semaine: jps, tjm: assignForm.tjm ? parseFloat(assignForm.tjm) : null });
      setAssignModal(null);
      loadData();
      showToast('Collaborateur affecté ✓');
    } catch(e) { showToast('Erreur: ' + e.message); }
  };

  const removeAssignment = async (id) => {
    try { await api.deleteAssignment(id); loadData(); showToast('Affectation retirée'); } catch(e) { showToast('Erreur: ' + e.message); }
  };

  if (loading || ctxLoading) return <div style={{maxWidth:600,margin:'40px auto'}}><Skeleton lines={5} /></div>;

  const active = missions.filter(m => m.statut === 'en_cours');
  const filtered = search ? missions.filter(m => (m.nom+getClientName(m)+(m.categorie||'')).toLowerCase().includes(search.toLowerCase())) : missions;

  // Staffing calculation
  const staffingMap = {};
  collabs.forEach(c => { staffingMap[c.id] = { collab: c, taux: 0, missions: [] }; });
  missions.filter(m => m.statut === 'en_cours').forEach(m => {
    (m.assignments || []).filter(a => a.statut === 'actif').forEach(a => {
      if (staffingMap[a.collaborateur_id]) {
        staffingMap[a.collaborateur_id].taux += (a.taux_staffing || 0);
        staffingMap[a.collaborateur_id].missions.push({ nom: m.nom, client: getClientName(m), taux: a.taux_staffing, role: a.role });
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
        {[['clients',`🏢 Clients (${clients.length})`],['missions',`🚀 Missions (${missions.length})`],['timeline','📅 Calendrier'],['staffing','📊 Staffing']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:'1 0 auto',padding:'10px 14px',borderRadius:10,border:'none',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',background:tab===k?'var(--pink)':'transparent',color:tab===k?'white':'var(--muted)',border:tab===k?'none':'1.5px solid var(--lavender)',boxShadow:tab===k?'0 4px 14px rgba(255,50,133,0.3)':'none'}}>{l}</button>
        ))}
      </div>

      {/* CLIENTS */}
      {tab==='clients' && <FadeIn><div>
        {selectedClient ? (()=>{
          const sc = clients.find(x=>x.id===selectedClient);
          if (!sc) return null;
          const cMissions = missions.filter(m => m.client_id === sc.id);
          return <div>
            <button className="btn btn-ghost btn-sm" onClick={()=>setSelectedClient(null)} style={{marginBottom:16}}>← Retour aux clients</button>
            <div className="card" style={{marginBottom:20,padding:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:'1.3rem',color:'var(--navy)'}}>{sc.nom}</div>
                  {sc.secteur && <Badge type="blue">{sc.secteur}</Badge>}
                  {sc.description && <p style={{color:'var(--muted)',fontSize:'0.85rem',marginTop:8}}>{sc.description}</p>}
                  {sc.contact_nom && <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:6}}>👤 {sc.contact_nom}{sc.contact_email ? ` · ${sc.contact_email}` : ''}</div>}
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{setClientModal(sc);setClientForm({nom:sc.nom,description:sc.description||'',secteur:sc.secteur||'',contact_nom:sc.contact_nom||'',contact_email:sc.contact_email||''});}}>✏️ Modifier</button>
                  <button className="btn btn-primary btn-sm" onClick={()=>openCreate(sc.id)}>+ Mission</button>
                </div>
              </div>
            </div>
            <div className="section-title">Missions ({cMissions.length})</div>
            {cMissions.length === 0 ? <div className="card" style={{textAlign:'center',padding:24,color:'var(--muted)'}}>Aucune mission pour ce client</div> :
            cMissions.map(m => <MissionCard key={m.id} m={m} collabs={collabs} onEdit={openEdit} onDelete={(id)=>{deleteMission(id);}} onAssign={()=>{setAssignModal(m.id);setAssignForm({collaborateur_id:'',role:'',taux_staffing:100,jours_par_semaine:5,tjm:'',date_debut:m.date_debut||'',date_fin:m.date_fin||''});}} onRemoveAssign={removeAssignment} onDetail={setDetail} />)}
          </div>;
        })() : <>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher un client..." style={{flex:1,maxWidth:300,border:'1.5px solid var(--lavender)',borderRadius:10,padding:'8px 14px',fontFamily:'inherit',fontSize:'0.85rem',outline:'none',background:'var(--offwhite)',color:'var(--navy)'}} />
          <button className="btn btn-primary btn-sm" onClick={()=>{setClientModal('create');setClientForm({nom:'',description:'',secteur:'',siren:'',siret:'',tva_intra:'',adresse:'',code_postal:'',ville:'',categorie_entreprise:'',referent_id:'',contact_signature_nom:'',contact_signature_email:'',contact_signature_tel:'',contact_facturation_nom:'',contact_facturation_email:'',contact_facturation_tel:''});}}>+ Nouveau client</button>
        </div>
        {clients.length === 0 ? <div className="card" style={{textAlign:'center',padding:32,color:'var(--muted)'}}>Aucun client</div> :
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
          {clients.filter(c=>!search||(c.nom+(c.secteur||'')).toLowerCase().includes(search.toLowerCase())).map(c => {
            const cMissions = missions.filter(m => m.client_id === c.id);
            const activeMissions = cMissions.filter(m => m.statut === 'en_cours');
            return (
              <div key={c.id} className="card" style={{padding:20,borderLeft:`4px solid ${activeMissions.length>0?'var(--blue)':'var(--lavender)'}`,cursor:'pointer'}} onClick={()=>setSelectedClient(c.id)}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:'1rem',color:'var(--navy)'}}>{c.nom}</div>
                    {c.secteur && <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:2}}>{c.secteur}</div>}
                  </div>
                  <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm" style={{padding:'3px 8px'}} onClick={()=>{setClientModal(c);setClientForm({nom:c.nom,description:c.description||'',secteur:c.secteur||'',siren:c.siren||'',siret:c.siret||'',tva_intra:c.tva_intra||'',adresse:c.adresse||'',code_postal:c.code_postal||'',ville:c.ville||'',categorie_entreprise:c.categorie_entreprise||'',referent_id:c.referent_id||'',contact_signature_nom:c.contact_signature_nom||'',contact_signature_email:c.contact_signature_email||'',contact_signature_tel:c.contact_signature_tel||'',contact_facturation_nom:c.contact_facturation_nom||'',contact_facturation_email:c.contact_facturation_email||'',contact_facturation_tel:c.contact_facturation_tel||''});}}>✏️</button>
                    <button className="btn btn-danger btn-sm" style={{padding:'3px 8px'}} onClick={()=>deleteClient(c.id)}>🗑️</button>
                  </div>
                </div>
                {c.siren && <div style={{fontSize:'0.7rem',color:'var(--muted)',marginBottom:4}}>SIREN {c.siren}{c.ville ? ` · ${c.ville}` : ''}</div>}
                {(()=>{const ref=c.referent_id?collabs.find(x=>x.id===c.referent_id):null; return ref?<div style={{fontSize:'0.7rem',color:'var(--muted)',marginBottom:4}}>👔 {ref.prenom} {ref.nom}</div>:null;})()}
                <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--navy)'}}>{activeMissions.length} en cours · {cMissions.length} au total</div>
              </div>
            );
          })}
        </div>}
        </>}
      </div></FadeIn>}

      {/* MISSIONS (unified) */}
      {tab==='missions' && <FadeIn><div>
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher..." style={{flex:1,maxWidth:250,border:'1.5px solid var(--lavender)',borderRadius:10,padding:'8px 14px',fontFamily:'inherit',fontSize:'0.82rem',outline:'none',background:'var(--offwhite)',color:'var(--navy)'}} />
          <select value={missionStatut} onChange={e=>setMissionStatut(e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 10px',fontFamily:'inherit',fontSize:'0.78rem',background:'var(--offwhite)',color:'var(--navy)'}}>
            <option value="">Tous statuts</option>
            {Object.entries(STATUT_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <input type="date" value={missionDateDebut} onChange={e=>setMissionDateDebut(e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'5px 8px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)'}} />
            <span style={{color:'var(--muted)',fontSize:'0.75rem'}}>→</span>
            <input type="date" value={missionDateFin} onChange={e=>setMissionDateFin(e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'5px 8px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)'}} />
          </div>
          <div style={{display:'flex',gap:2,marginLeft:'auto'}}>
            <button onClick={()=>setViewMode('cartes')} className={`btn btn-sm ${viewMode==='cartes'?'btn-primary':'btn-ghost'}`} style={{padding:'5px 10px',fontSize:'0.72rem'}}>🃏 Cartes</button>
            <button onClick={()=>setViewMode('liste')} className={`btn btn-sm ${viewMode==='liste'?'btn-primary':'btn-ghost'}`} style={{padding:'5px 10px',fontSize:'0.72rem'}}>📋 Liste</button>
          </div>
        </div>
        {(()=>{
          let list = missions;
          if (search) list = list.filter(m => (m.nom+getClientName(m)+(m.categorie||'')).toLowerCase().includes(search.toLowerCase()));
          if (missionStatut) list = list.filter(m => m.statut === missionStatut);
          if (missionDateDebut) list = list.filter(m => !m.date_fin || m.date_fin >= missionDateDebut);
          if (missionDateFin) list = list.filter(m => !m.date_debut || m.date_debut <= missionDateFin);
          if (list.length === 0) return <div className="card" style={{textAlign:'center',padding:32,color:'var(--muted)'}}>Aucune mission trouvée</div>;
          if (viewMode === 'cartes') return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:16}}>
            {list.map(m => <MissionCard key={m.id} m={m} collabs={collabs} onEdit={openEdit} onDelete={deleteMission} onAssign={()=>{setAssignModal(m.id);setAssignForm({collaborateur_id:'',role:'',taux_staffing:100,jours_par_semaine:5,tjm:'',date_debut:m.date_debut||'',date_fin:m.date_fin||''});}} onRemoveAssign={removeAssignment} onDetail={setDetail} />)}
          </div>;
          return <div className="card" style={{overflowX:'auto'}}><table>
            <thead><tr><th>Mission</th><th>Client</th><th>Catégorie</th><th>Statut</th><th>Dates</th><th>Équipe</th><th>Budget</th><th></th></tr></thead>
            <tbody>{list.map(m=>(
              <tr key={m.id}>
                <td style={{fontWeight:700,color:'var(--navy)',cursor:'pointer'}} onClick={()=>setDetail(m)}>{m.nom}</td>
                <td>{getClientName(m)}</td>
                <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{m.categorie||'—'}</td>
                <td><Badge type={STATUT_BADGE[m.statut]}>{STATUT_LABEL[m.statut]||m.statut}</Badge></td>
                <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{fmtDate(m.date_debut)} → {fmtDate(m.date_fin)}</td>
                <td><div style={{display:'flex',gap:-4}}>{(m.assignments||[]).slice(0,4).map(a=>a.collaborateurs&&<Avatar key={a.id} prenom={a.collaborateurs.prenom} nom={a.collaborateurs.nom} photoUrl={a.collaborateurs.photo_url} size={24} />)}{(m.assignments||[]).length>4&&<span style={{fontSize:'0.7rem',color:'var(--muted)'}}>+{(m.assignments||[]).length-4}</span>}</div></td>
                <td style={{fontWeight:600}}>{m.budget_vendu?m.budget_vendu.toLocaleString('fr-FR')+'€':'—'}</td>
                <td><div style={{display:'flex',gap:4}}><button className="btn btn-ghost btn-sm" style={{padding:'3px 8px'}} onClick={()=>openEdit(m)}>✏️</button><button className="btn btn-danger btn-sm" style={{padding:'3px 8px'}} onClick={()=>deleteMission(m.id)}>🗑️</button></div></td>
              </tr>
            ))}</tbody>
          </table></div>;
        })()}
      </div></FadeIn>}

      {/* TIMELINE / CALENDRIER GLOBAL */}
      {tab==='timeline' && <FadeIn><div>
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
          <select value={filterClient} onChange={e=>setFilterClient(e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 10px',fontFamily:'inherit',fontSize:'0.78rem',background:'var(--offwhite)',color:'var(--navy)'}}>
            <option value="">Tous les clients</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <TimelineView missions={filterClient ? active.filter(m=>m.client_id===filterClient) : active} collabs={filterEquipes.length>0 ? collabs.filter(c=>filterEquipes.some(eq=>(c.equipe||'').includes(eq))) : collabs} staffingMap={staffingMap} allMissions={active} />
        </div>
      </div></FadeIn>}

      {/* STAFFING */}
      {tab==='staffing' && (()=>{
        const allEquipes = [...new Set(collabs.flatMap(c=>(c.equipe||'').split(',').map(s=>s.trim())).filter(Boolean))].sort();
        const toggleEquipe = (eq) => setFilterEquipes(prev => prev.includes(eq) ? prev.filter(e=>e!==eq) : [...prev, eq]);
        const filteredStaffing = Object.values(staffingMap).filter(({collab:c}) => filterEquipes.length===0 || filterEquipes.some(eq=>(c.equipe||'').includes(eq)));
        const avg = filteredStaffing.length ? Math.round(filteredStaffing.reduce((s,v)=>s+v.taux,0)/filteredStaffing.length) : 0;

        // Quick date presets
        const setPreset = (type) => {
          const now = new Date();
          const y = now.getFullYear();
          const m = now.getMonth();
          if (type==='week') { const mon=new Date(now); mon.setDate(now.getDate()-((now.getDay()+6)%7)); const fri=new Date(mon); fri.setDate(mon.getDate()+4); setStaffingDateDebut(mon.toISOString().split('T')[0]); setStaffingDateFin(fri.toISOString().split('T')[0]); }
          else if (type==='month') { setStaffingDateDebut(`${y}-${String(m+1).padStart(2,'0')}-01`); setStaffingDateFin(new Date(y,m+1,0).toISOString().split('T')[0]); }
          else if (type==='q1') { setStaffingDateDebut(`${y}-01-01`); setStaffingDateFin(`${y}-03-31`); }
          else if (type==='q2') { setStaffingDateDebut(`${y}-04-01`); setStaffingDateFin(`${y}-06-30`); }
          else if (type==='q3') { setStaffingDateDebut(`${y}-07-01`); setStaffingDateFin(`${y}-09-30`); }
          else if (type==='q4') { setStaffingDateDebut(`${y}-10-01`); setStaffingDateFin(`${y}-12-31`); }
          else if (type==='year') { setStaffingDateDebut(`${y}-01-01`); setStaffingDateFin(`${y}-12-31`); }
          else { setStaffingDateDebut(''); setStaffingDateFin(''); }
        };

        return <FadeIn><div>
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
          {/* Date presets */}
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {[['','Tout'],['week','Semaine'],['month','Mois'],['q1','T1'],['q2','T2'],['q3','T3'],['q4','T4'],['year','Année']].map(([k,l])=>(
              <button key={k} onClick={()=>setPreset(k)} className="btn btn-ghost btn-sm" style={{padding:'4px 10px',fontSize:'0.7rem',background:(!staffingDateDebut&&!k)?'var(--pink)':'transparent',color:(!staffingDateDebut&&!k)?'white':'var(--muted)'}}>{l}</button>
            ))}
          </div>
          <span style={{fontSize:'0.78rem',color:'var(--muted)',fontWeight:600}}>Taux moyen: {avg}%</span>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          {/* Date picker */}
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <input type="date" value={staffingDateDebut} onChange={e=>setStaffingDateDebut(e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'5px 8px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)',color:'var(--navy)'}} />
            <span style={{color:'var(--muted)',fontSize:'0.75rem'}}>→</span>
            <input type="date" value={staffingDateFin} onChange={e=>setStaffingDateFin(e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'5px 8px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)',color:'var(--navy)'}} />
          </div>
          {/* Multi-select équipes */}
          <div ref={equipeDropdownRef} style={{position:'relative'}}>
            <button onClick={()=>setShowEquipeDropdown(!showEquipeDropdown)} className="btn btn-ghost btn-sm" style={{fontSize:'0.75rem'}}>
              🏷️ Équipes {filterEquipes.length>0?`(${filterEquipes.length})`:''} ▾
            </button>
            {showEquipeDropdown && <div style={{position:'absolute',top:'100%',left:0,background:'var(--white)',border:'1.5px solid var(--lavender)',borderRadius:10,padding:8,zIndex:100,boxShadow:'0 8px 24px rgba(5,5,109,0.15)',minWidth:200,maxHeight:250,overflowY:'auto'}}>
              <button onClick={()=>{setFilterEquipes([]);setShowEquipeDropdown(false);}} style={{width:'100%',textAlign:'left',padding:'6px 8px',border:'none',background:'transparent',fontFamily:'inherit',fontSize:'0.78rem',color:'var(--muted)',cursor:'pointer',fontWeight:600}}>✕ Tout décocher</button>
              {allEquipes.map(eq=>(
                <label key={eq} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',cursor:'pointer',borderRadius:6,fontSize:'0.78rem',fontWeight:600,color:'var(--navy)',background:filterEquipes.includes(eq)?'var(--offwhite)':'transparent'}}>
                  <input type="checkbox" checked={filterEquipes.includes(eq)} onChange={()=>toggleEquipe(eq)} style={{accentColor:'var(--pink)'}} />
                  {eq}
                </label>
              ))}
            </div>}
          </div>
        </div>
        <div className="card" style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Collaborateur</th><th>Poste</th><th>Taux staffing</th><th>Jours/sem.</th><th>Missions</th></tr></thead>
          <tbody>{filteredStaffing.sort((a,b)=>b.taux-a.taux).map(({collab:c,taux,missions:ms})=>(
            <tr key={c.id}>
              <td><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={28} /><span style={{fontWeight:700,color:'var(--navy)'}}>{c.prenom} {c.nom}</span></div></td>
              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{c.poste||'—'}</td>
              <td><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:80,height:8,background:'var(--offwhite)',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(taux,100)}%`,background:taux>100?'var(--red)':taux>=80?'var(--orange)':'var(--green)',borderRadius:4}} /></div><span style={{fontWeight:700,fontSize:'0.85rem',color:taux>100?'var(--red)':taux>=80?'var(--orange)':'var(--green)'}}>{taux}%</span></div></td>
              <td style={{fontWeight:600,color:'var(--navy)'}}>{(taux/100*5).toFixed(1)}j</td>
              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{ms.length===0?'Non staffé':ms.map(m=>`${m.nom} (${m.taux}%)`).join(', ')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div></div></FadeIn>})()}

      {/* CREATE/EDIT MODAL */}
      <Modal open={!!modal} onClose={()=>setModal(null)} title={modal==='create'?'Nouvelle mission':'Modifier la mission'}>
        <div className="form-grid">
          <div className="form-field"><label>Nom <span style={{color:'var(--red)'}}>*</span></label><input autoFocus value={form.nom||''} onChange={e=>setForm({...form,nom:e.target.value})} /></div>
          <div className="form-field"><label>Client <span style={{color:'var(--red)'}}>*</span></label><select value={form.client_id||''} onChange={e=>setForm({...form,client_id:e.target.value})}><option value="">Sélectionner un client...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
          <div className="form-field"><label>Catégorie</label><select value={form.categorie||''} onChange={e=>setForm({...form,categorie:e.target.value})}><option value="">—</option>{missionCategories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div className="form-field"><label>Statut</label><select value={form.statut||'en_cours'} onChange={e=>setForm({...form,statut:e.target.value})}>{Object.entries(STATUT_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          <div className="form-field"><label>Date début</label><input type="date" value={form.date_debut||''} onChange={e=>setForm({...form,date_debut:e.target.value})} /></div>
          <div className="form-field"><label>Date fin</label><input type="date" value={form.date_fin||''} onChange={e=>setForm({...form,date_fin:e.target.value})} /></div>
          <div className="form-field"><label>Lien propale signée</label><input type="url" value={form.lien_propale||''} onChange={e=>setForm({...form,lien_propale:e.target.value})} placeholder="https://drive.google.com/..." /></div>
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
          <div className="form-field"><label>Rôle <span style={{color:'var(--red)'}}>*</span></label><select value={assignForm.role} onChange={e=>{const role=missionRoles.find(r=>r.label===e.target.value); setAssignForm({...assignForm, role:e.target.value, tjm:role?String(role.tjm):assignForm.tjm});}}><option value="">Sélectionner un rôle...</option>{missionRoles.map(r=><option key={r.label} value={r.label}>{r.label} ({r.tjm}€/j)</option>)}</select></div>
          <div className="form-field"><label>Jours / semaine</label><input type="number" step="0.1" min="0.1" max="5" value={assignForm.jours_par_semaine} onChange={e=>{const jps=parseFloat(e.target.value)||0; setAssignForm({...assignForm,jours_par_semaine:jps,taux_staffing:Math.round(jps/5*100)});}} /><div style={{fontSize:'0.7rem',color:'var(--muted)',marginTop:2}}>= {Math.round((parseFloat(assignForm.jours_par_semaine)||0)/5*100)}% du temps</div></div>
          <div className="form-field"><label>Du</label><input type="date" value={assignForm.date_debut} onChange={e=>setAssignForm({...assignForm,date_debut:e.target.value})} /></div>
          <div className="form-field"><label>Au</label><input type="date" value={assignForm.date_fin} onChange={e=>setAssignForm({...assignForm,date_fin:e.target.value})} /></div>
          <div className="form-field"><label>TJM (€/jour) <span style={{color:'var(--red)'}}>*</span></label><input type="number" value={assignForm.tjm} onChange={e=>setAssignForm({...assignForm,tjm:e.target.value})} /><div style={{fontSize:'0.68rem',color:'var(--muted)',marginTop:2}}>Pré-rempli selon le rôle, modifiable</div></div>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost" onClick={()=>setAssignModal(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={saveAssignment}>✓ Affecter</button>
        </div>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal open={!!detail} onClose={()=>setDetail(null)} title={detail?`${detail.nom} — ${getClientName(detail)}`:''}>
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
            <div><div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase'}}>Propale</div><div style={{fontWeight:600}}>{detail.lien_propale?<a href={detail.lien_propale} target="_blank" rel="noopener noreferrer" style={{color:'var(--blue)',textDecoration:'none'}}>📄 Voir</a>:'—'}</div></div>
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

      {/* CLIENT MODAL */}
      <Modal open={!!clientModal} onClose={()=>setClientModal(null)} title={clientModal==='create'?'Nouveau client':'Modifier le client'}>
        {/* SIREN lookup */}
        {clientModal==='create' && <div style={{marginBottom:16,padding:'12px 16px',background:'var(--offwhite)',borderRadius:10,border:'1px dashed var(--lavender)'}}>
          <div style={{fontSize:'0.78rem',fontWeight:700,color:'var(--navy)',marginBottom:6}}>🔍 Recherche par SIREN ou raison sociale</div>
          <div style={{display:'flex',gap:6}}>
            <input id="siren-search" placeholder="SIREN ou nom d'entreprise..." style={{flex:1,border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.85rem'}} onKeyDown={e=>{if(e.key==='Enter'){const q=e.target.value.trim();if(!q)return;fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&page=1&per_page=5`).then(r=>r.json()).then(d=>{const results=d.results||[];if(results.length===1){const r=results[0];setClientForm({...clientForm,nom:r.nom_raison_sociale||r.nom_complet||'',siren:r.siren||'',siret:r.siege?.siret||'',tva_intra:r.siren?`FR${(12+3*(parseInt(r.siren)%97))%97}${r.siren}`:'',adresse:r.siege?.geo_adresse||'',code_postal:r.siege?.code_postal||'',ville:r.siege?.libelle_commune||'',categorie_entreprise:r.categorie_entreprise||'',secteur:''});setSirenResults([]);showToast('Entreprise trouvee !');}else if(results.length>1){setSirenResults(results);}else{showToast('Aucun resultat');setSirenResults([]);}}).catch(()=>showToast('Erreur de recherche'));}}} />
            <button className="btn btn-ghost btn-sm" onClick={()=>{const q=document.getElementById('siren-search')?.value?.trim();if(!q)return;fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&page=1&per_page=5`).then(r=>r.json()).then(d=>{const results=d.results||[];if(results.length===1){const r=results[0];setClientForm({...clientForm,nom:r.nom_raison_sociale||r.nom_complet||'',siren:r.siren||'',siret:r.siege?.siret||'',tva_intra:r.siren?`FR${(12+3*(parseInt(r.siren)%97))%97}${r.siren}`:'',adresse:r.siege?.geo_adresse||'',code_postal:r.siege?.code_postal||'',ville:r.siege?.libelle_commune||'',categorie_entreprise:r.categorie_entreprise||'',secteur:''});setSirenResults([]);showToast('Entreprise trouvee !');}else if(results.length>1){setSirenResults(results);}else{showToast('Aucun resultat');setSirenResults([]);}}).catch(()=>showToast('Erreur de recherche'))}}>Rechercher</button>
          </div>
          {sirenResults.length > 1 && <div style={{marginTop:8,maxHeight:200,overflowY:'auto',border:'1px solid var(--lavender)',borderRadius:8}}>
            <div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--navy)',padding:'8px 10px',borderBottom:'1px solid var(--lavender)'}}>Plusieurs résultats — choisissez :</div>
            {sirenResults.map((r,i)=>(
              <div key={i} style={{padding:'8px 10px',borderBottom:'1px solid var(--lavender)',cursor:'pointer',fontSize:'0.78rem',transition:'background 0.1s'}}
                onMouseOver={e=>e.currentTarget.style.background='var(--offwhite)'} onMouseOut={e=>e.currentTarget.style.background=''}
                onClick={()=>{setClientForm({...clientForm,nom:r.nom_raison_sociale||r.nom_complet||'',siren:r.siren||'',siret:r.siege?.siret||'',tva_intra:r.siren?`FR${(12+3*(parseInt(r.siren)%97))%97}${r.siren}`:'',adresse:r.siege?.geo_adresse||'',code_postal:r.siege?.code_postal||'',ville:r.siege?.libelle_commune||'',categorie_entreprise:r.categorie_entreprise||'',secteur:''});setSirenResults([]);showToast('Entreprise sélectionnée !');}}>
                <div style={{fontWeight:700,color:'var(--navy)'}}>{r.nom_raison_sociale||r.nom_complet}</div>
                <div style={{color:'var(--muted)',fontSize:'0.7rem'}}>SIREN {r.siren} · {r.siege?.libelle_commune||'—'} · {r.categorie_entreprise||'—'}</div>
              </div>
            ))}
          </div>}
          <div style={{fontSize:'0.68rem',color:'var(--muted)',marginTop:4}}>Source : API Entreprise (data.gouv.fr)</div>
        </div>}

        <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginBottom:8}}>Informations entreprise</div>
        <div className="form-grid">
          <div className="form-field"><label>Raison sociale <span style={{color:'var(--red)'}}>*</span></label><input autoFocus value={clientForm.nom||''} onChange={e=>setClientForm({...clientForm,nom:e.target.value})} /></div>
          <div className="form-field"><label>SIREN</label><input value={clientForm.siren||''} onChange={e=>setClientForm({...clientForm,siren:e.target.value})} placeholder="9 chiffres" /></div>
          <div className="form-field"><label>SIRET</label><input value={clientForm.siret||''} onChange={e=>setClientForm({...clientForm,siret:e.target.value})} placeholder="14 chiffres" /></div>
          <div className="form-field"><label>TVA intracommunautaire</label><input value={clientForm.tva_intra||''} onChange={e=>setClientForm({...clientForm,tva_intra:e.target.value})} placeholder="FR..." /></div>
          <div className="form-field"><label>Secteur</label><input value={clientForm.secteur||''} onChange={e=>setClientForm({...clientForm,secteur:e.target.value})} /></div>
          <div className="form-field"><label>Catégorie</label><input value={clientForm.categorie_entreprise||''} onChange={e=>setClientForm({...clientForm,categorie_entreprise:e.target.value})} placeholder="PME, ETI, GE..." /></div>
          <div className="form-field"><label>Adresse</label><input value={clientForm.adresse||''} onChange={e=>setClientForm({...clientForm,adresse:e.target.value})} /></div>
          <div className="form-field"><label>Code postal</label><input value={clientForm.code_postal||''} onChange={e=>setClientForm({...clientForm,code_postal:e.target.value})} /></div>
          <div className="form-field"><label>Ville</label><input value={clientForm.ville||''} onChange={e=>setClientForm({...clientForm,ville:e.target.value})} /></div>
        </div>

        <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginTop:16,marginBottom:8}}>Référent interne</div>
        <div className="form-grid">
          <div className="form-field"><label>Référent Hello Pomelo</label><select value={clientForm.referent_id||''} onChange={e=>setClientForm({...clientForm,referent_id:e.target.value})}><option value="">Sélectionner...</option>{collabs.map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}</select></div>
        </div>

        <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginTop:16,marginBottom:8}}>Contact signature (client)</div>
        <div className="form-grid">
          <div className="form-field"><label>Nom</label><input value={clientForm.contact_signature_nom||''} onChange={e=>setClientForm({...clientForm,contact_signature_nom:e.target.value})} /></div>
          <div className="form-field"><label>Email</label><input type="email" value={clientForm.contact_signature_email||''} onChange={e=>setClientForm({...clientForm,contact_signature_email:e.target.value})} /></div>
          <div className="form-field"><label>Téléphone</label><input value={clientForm.contact_signature_tel||''} onChange={e=>setClientForm({...clientForm,contact_signature_tel:e.target.value})} /></div>
        </div>

        <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginTop:16,marginBottom:8}}>Contact facturation (client)</div>
        <div className="form-grid">
          <div className="form-field"><label>Nom</label><input value={clientForm.contact_facturation_nom||''} onChange={e=>setClientForm({...clientForm,contact_facturation_nom:e.target.value})} /></div>
          <div className="form-field"><label>Email</label><input type="email" value={clientForm.contact_facturation_email||''} onChange={e=>setClientForm({...clientForm,contact_facturation_email:e.target.value})} /></div>
          <div className="form-field"><label>Téléphone</label><input value={clientForm.contact_facturation_tel||''} onChange={e=>setClientForm({...clientForm,contact_facturation_tel:e.target.value})} /></div>
        </div>

        <div className="form-field" style={{marginTop:12}}><label>Description / Notes</label><textarea value={clientForm.description||''} onChange={e=>setClientForm({...clientForm,description:e.target.value})} style={{minHeight:50}} /></div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost" onClick={()=>setClientModal(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={saveClient}>💾 Enregistrer</button>
        </div>
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
          <div style={{fontSize:'0.82rem',color:'var(--muted)',marginTop:2}}>{m.clients?.nom || m.client || '—'}</div>
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

/** Vue timeline Gantt — collabs en lignes × semaines en colonnes, barres de staffing */
function TimelineView({ missions, collabs, staffingMap, allMissions }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedCollab, setSelectedCollab] = useState(null);
  const WEEKS = 16; // show 16 weeks

  // Calculate start Monday
  const now = new Date();
  const startMonday = new Date(now);
  startMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + (weekOffset * WEEKS));
  startMonday.setHours(0,0,0,0);

  const weeks = Array.from({length:WEEKS},(_,i) => {
    const mon = new Date(startMonday); mon.setDate(startMonday.getDate() + i * 7);
    const weekNum = Math.ceil(((mon - new Date(mon.getFullYear(),0,1)) / 86400000 + 1) / 7);
    return { date: mon, label: `S${weekNum}`, month: mon.toLocaleDateString('fr-FR',{month:'short'}), year: mon.getFullYear(), start: mon.toISOString().split('T')[0], end: new Date(mon.getTime()+4*86400000).toISOString().split('T')[0] };
  });

  // Group weeks by month
  const months = [];
  let lastMonth = '';
  weeks.forEach((w,i) => {
    const key = w.month + ' ' + w.year;
    if (key !== lastMonth) { months.push({label:key,start:i,span:1}); lastMonth = key; }
    else months[months.length-1].span++;
  });

  // Get assigned collabs
  const assignedCollabs = collabs.filter(c => staffingMap[c.id]?.missions?.length > 0).sort((a,b) => (staffingMap[b.id]?.taux||0) - (staffingMap[a.id]?.taux||0));
  const todayStr = now.toISOString().split('T')[0];

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 18px',borderBottom:'1px solid var(--lavender)'}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(weekOffset-1)}>← {WEEKS} sem.</button>
        <div style={{fontWeight:700,color:'var(--navy)'}}>📅 Calendrier global</div>
        <div style={{display:'flex',gap:6}}>
          {weekOffset !== 0 && <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(0)}>Aujourd'hui</button>}
          <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(weekOffset+1)}>{WEEKS} sem. →</button>
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{fontSize:'0.7rem',width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr>{/* Month headers */}
              <th style={{minWidth:180,position:'sticky',left:0,background:'var(--white)',zIndex:2}} />
              {months.map((m,i)=><th key={i} colSpan={m.span} style={{textAlign:'center',padding:'6px 2px',fontWeight:700,color:'var(--navy)',textTransform:'capitalize',borderBottom:'1px solid var(--lavender)'}}>{m.label}</th>)}
            </tr>
            <tr>{/* Week headers */}
              <th style={{textAlign:'left',padding:'6px 14px',fontWeight:700,color:'var(--navy)',minWidth:180,position:'sticky',left:0,background:'var(--white)',zIndex:2}}>Collaborateur</th>
              {weeks.map((w,i)=>{
                const isCurrent = todayStr >= w.start && todayStr <= w.end;
                return <th key={i} style={{textAlign:'center',padding:'4px 2px',minWidth:45,fontWeight:isCurrent?800:600,color:isCurrent?'var(--pink)':'var(--muted)',background:isCurrent?'rgba(255,50,133,0.05)':'transparent'}}>{w.label}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {assignedCollabs.map(c => {
              const myMissions = staffingMap[c.id]?.missions || [];
              return <tr key={c.id} style={{borderBottom:'1px solid var(--lavender)',background:selectedCollab===c.id?'rgba(255,50,133,0.04)':'transparent',cursor:'pointer'}} onClick={()=>setSelectedCollab(selectedCollab===c.id?null:c.id)}>
                <td style={{padding:'8px 14px',position:'sticky',left:0,background:selectedCollab===c.id?'rgba(255,50,133,0.06)':'var(--white)',zIndex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={24} />
                    <div>
                      <div style={{fontWeight:700,color:selectedCollab===c.id?'var(--pink)':'var(--navy)',fontSize:'0.75rem'}}>{c.prenom} {c.nom[0]}.</div>
                      <div style={{fontSize:'0.6rem',color:'var(--muted)'}}>{c.poste}</div>
                    </div>
                  </div>
                </td>
                {weeks.map((w,wi) => {
                  const isCurrent = todayStr >= w.start && todayStr <= w.end;
                  // Find missions active this week
                  const weekMissions = (allMissions||missions).filter(m => {
                    if (!m.date_debut || !m.date_fin) return false;
                    return (m.assignments||[]).some(a => a.collaborateur_id === c.id && a.statut === 'actif') && m.date_debut <= w.end && m.date_fin >= w.start;
                  });
                  return <td key={wi} style={{padding:1,background:isCurrent?'rgba(255,50,133,0.03)':'transparent',position:'relative'}}>
                    {weekMissions.length > 0 ? (
                      <div style={{display:'flex',flexDirection:'column',gap:1}}>
                        {weekMissions.map(m => {
                          const a = (m.assignments||[]).find(x=>x.collaborateur_id===c.id);
                          const taux = a?.taux_staffing || 0;
                          const colors = ['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#6366F1'];
                          const colorIdx = missions.indexOf(m) % colors.length;
                          return <div key={m.id} title={`${m.nom} — ${m.clients?.nom||m.client||''} (${taux}%)`} style={{
                            background:colors[colorIdx],color:'white',borderRadius:3,
                            padding:'2px 3px',fontSize:'0.55rem',fontWeight:700,
                            whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
                            opacity:0.85
                          }}>{taux}%</div>;
                        })}
                      </div>
                    ) : (
                      <div style={{height:20}} />
                    )}
                  </td>;
                })}
              </tr>;
            })}
            {/* Non staffés */}
            {collabs.filter(c => !staffingMap[c.id]?.missions?.length).length > 0 && (
              <tr><td colSpan={WEEKS+1} style={{padding:'8px 14px',fontSize:'0.75rem',color:'var(--muted)',fontStyle:'italic'}}>
                + {collabs.filter(c => !staffingMap[c.id]?.missions?.length).length} collaborateurs non staffés
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Detail panel when a collab is selected */}
      {selectedCollab && (()=>{
        const c = collabs.find(x=>x.id===selectedCollab);
        if (!c) return null;
        const myAssignments = (allMissions||missions).flatMap(m => (m.assignments||[]).filter(a => a.collaborateur_id === selectedCollab && a.statut === 'actif').map(a => ({...a, mission: m})));
        const totalTaux = myAssignments.reduce((s,a) => s + (a.taux_staffing||0), 0);
        return <div style={{padding:'16px 18px',borderTop:'2px solid var(--pink)',background:'rgba(255,50,133,0.02)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={36} />
              <div>
                <div style={{fontWeight:700,color:'var(--navy)',fontSize:'1rem'}}>{c.prenom} {c.nom}</div>
                <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>{c.poste} · Staffing: <strong style={{color:totalTaux>100?'var(--red)':totalTaux>=80?'var(--orange)':'var(--green)'}}>{totalTaux}%</strong> ({(totalTaux/100*5).toFixed(1)}j/sem)</div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={(e)=>{e.stopPropagation();setSelectedCollab(null);}}>✕ Fermer</button>
          </div>
          {myAssignments.length === 0 ? <p style={{color:'var(--muted)',fontSize:'0.82rem',fontStyle:'italic'}}>Aucune mission active</p> :
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
            {myAssignments.map(a => (
              <div key={a.id} style={{padding:'12px 16px',border:'1.5px solid var(--lavender)',borderRadius:12,borderLeft:'4px solid var(--blue)',background:'white'}}>
                <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.88rem'}}>{a.mission.nom}</div>
                <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:2}}>{a.mission.clients?.nom || a.mission.client || '—'}</div>
                <div style={{display:'flex',gap:12,marginTop:8,fontSize:'0.75rem',color:'var(--muted)'}}>
                  <span>👤 {a.role || '—'}</span>
                  <span style={{fontWeight:700,color:'var(--blue)'}}>{a.taux_staffing}%</span>
                </div>
                <div style={{fontSize:'0.72rem',color:'var(--muted)',marginTop:4}}>📅 {fmtDate(a.date_debut)} → {fmtDate(a.date_fin)}</div>
                {a.tjm && <div style={{fontSize:'0.72rem',color:'var(--muted)',marginTop:2}}>💰 {a.tjm} €/j</div>}
              </div>
            ))}
          </div>}
        </div>;
      })()}
    </div>
  );
}
