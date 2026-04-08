import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../services/DataContext';
import { useAuth } from '../../services/AuthContext';
import { api } from '../../services/api';
import { PageHeader, Badge, Avatar, Modal, FadeIn, Skeleton, fmtDate } from '../../components/UI';

// Statut is now determined by dates (active = date_fin >= today or no date_fin)

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
  const [tab, setTab] = useState('missions');
  const [search, setSearch] = useState('');
  const [expandedClients, setExpandedClients] = useState(new Set());
  const toggleClient = (id) => setExpandedClients(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  // Create/Edit modal
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  // Assignment modal
  const [assignModal, setAssignModal] = useState(null);
  const [assignForm, setAssignForm] = useState({ collaborateur_id:'', role:'', taux_staffing:100, jours_par_semaine:5, tjm:'', date_debut:'', date_fin:'' });
  // Detail modal
  const [detail, setDetail] = useState(null);
  const [detailForm, setDetailForm] = useState({});
  const [detailAssignForm, setDetailAssignForm] = useState({ collaborateur_id:'', role:'', taux_staffing:100, jours_par_semaine:5, tjm:'', date_debut:'', date_fin:'' });
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
  const [filterBureau, setFilterBureau] = useState('');
  // Missions view
  const [viewMode, setViewMode] = useState('cartes'); // cartes | liste
  const [missionDateDebut, setMissionDateDebut] = useState('');
  const [missionDateFin, setMissionDateFin] = useState('');

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (detail) {
      setDetailForm({ nom:detail.nom, client_id:detail.client_id||'', description:detail.description||'', categorie:detail.categorie||'', date_debut:detail.date_debut||'', date_fin:detail.date_fin||'', budget_vendu:detail.budget_vendu||'', methode_facturation:detail.methode_facturation||'regie', responsable_id:detail.responsable_id||'', lien_propale:detail.lien_propale||'' });
      setDetailAssignForm({ collaborateur_id:'', role:'', taux_staffing:100, jours_par_semaine:5, tjm:'', date_debut:detail.date_debut||'', date_fin:detail.date_fin||'' });
    }
  }, [detail]);

  async function loadData() {
    try {
      const [m, c] = await Promise.all([api.getMissions(), api.getClients()]);
      setMissions(m || []);
      setClients(c || []);
    } catch(e) { console.error('Erreur chargement:', e); }
    setLoading(false);
  }

  const getClientName = (m) => m.clients?.nom || m.client || '—';

  const openCreate = (clientId) => { setForm({ nom:'', client_id:clientId||'', description:'', categorie:'', date_debut:'', date_fin:'', budget_vendu:'', methode_facturation:'regie', responsable_id:'', lien_propale:'' }); setModal('create'); };
  const openEdit = (m) => { setForm({ nom:m.nom, client_id:m.client_id||'', description:m.description||'', categorie:m.categorie||'', date_debut:m.date_debut||'', date_fin:m.date_fin||'', budget_vendu:m.budget_vendu||'', methode_facturation:m.methode_facturation||'regie', responsable_id:m.responsable_id||'', lien_propale:m.lien_propale||'' }); setModal(m); };

  const saveMission = async () => {
    if (!form.nom || !form.client_id) { showToast('Nom et client sont obligatoires'); return; }
    setFormLoading(true);
    try {
      const clientObj = clients.find(c => c.id === form.client_id);
      const row = { ...form, client: clientObj?.nom || '', budget_vendu: form.budget_vendu ? parseFloat(form.budget_vendu) : null, responsable_id: form.responsable_id || null, lien_propale: form.lien_propale || null };
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

  const duplicateMission = (m) => {
    setForm({ nom: m.nom + ' (copie)', client_id: m.client_id||'', description: m.description||'', categorie: m.categorie||'', date_debut: '', date_fin: '', budget_vendu: m.budget_vendu||'', methode_facturation: m.methode_facturation||'regie', responsable_id: m.responsable_id||'', lien_propale: '' });
    setModal('create');
  };

  const removeAssignment = async (id) => {
    try { await api.deleteAssignment(id); loadData(); showToast('Affectation retirée'); } catch(e) { showToast('Erreur: ' + e.message); }
  };

  if (loading || ctxLoading) return <div style={{maxWidth:600,margin:'40px auto'}}><Skeleton lines={5} /></div>;

  const todayStr = new Date().toISOString().split('T')[0];
  const periodStart = missionDateDebut || todayStr;
  const periodEnd = missionDateFin || todayStr;
  const isMissionActive = (m) => (!m.date_fin || m.date_fin >= periodStart) && (!m.date_debut || m.date_debut <= periodEnd);
  const active = missions.filter(isMissionActive);

  // Staffing calculation
  const staffingMap = {};
  collabs.forEach(c => { staffingMap[c.id] = { collab: c, taux: 0, missions: [] }; });
  active.forEach(m => {
    (m.assignments || []).filter(a => a.statut === 'actif').forEach(a => {
      if (staffingMap[a.collaborateur_id]) {
        staffingMap[a.collaborateur_id].taux += (a.taux_staffing || 0);
        staffingMap[a.collaborateur_id].missions.push({ nom: m.nom, client: getClientName(m), taux: a.taux_staffing, role: a.role });
      }
    });
  });

  // Financial calculations
  const now = new Date();
  const currentMonth = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const caPrevu = active.reduce((s,m) => s + (m.assignments||[]).reduce((s2,a) => s2 + ((a.tjm||0) * (a.jours_par_semaine||a.taux_staffing/100*5) * 4.33), 0), 0); // monthly
  const budgetTotal = missions.reduce((s,m) => s + (m.budget_vendu||0), 0);
  const budgetConsomme = missions.reduce((s,m) => {
    return s + (m.assignments||[]).reduce((s2,a) => {
      // Estimate consumed: TJM × days per week × weeks since start
      if (!a.date_debut || !a.tjm) return s2;
      const start = new Date(a.date_debut);
      const end = a.date_fin ? new Date(Math.min(new Date(a.date_fin), now)) : now;
      const weeks = Math.max(0, (end - start) / (7*86400000));
      return s2 + (a.tjm * (a.jours_par_semaine||a.taux_staffing/100*5) * weeks);
    }, 0);
  }, 0);
  const staffingMoyen = collabs.length ? Math.round(Object.values(staffingMap).reduce((s,v) => s+v.taux, 0) / collabs.length) : 0;

  // Alerts
  const alerts = [];
  active.forEach(m => {
    if (m.date_fin) {
      const daysLeft = Math.ceil((new Date(m.date_fin) - now) / 86400000);
      if (daysLeft >= 0 && daysLeft <= 30) alerts.push({ icon:'⏰', text:`${m.nom} termine dans ${daysLeft}j`, type:'warning' });
    }
    if (m.budget_vendu) {
      const consumed = (m.assignments||[]).reduce((s,a) => {
        if (!a.date_debut || !a.tjm) return s;
        const start = new Date(a.date_debut);
        const end = a.date_fin ? new Date(Math.min(new Date(a.date_fin), now)) : now;
        const weeks = Math.max(0, (end - start) / (7*86400000));
        return s + (a.tjm * (a.jours_par_semaine||a.taux_staffing/100*5) * weeks);
      }, 0);
      if (consumed > m.budget_vendu * 0.9) alerts.push({ icon:'💰', text:`${m.nom} : budget à ${Math.round(consumed/m.budget_vendu*100)}%`, type:'danger' });
    }
  });
  collabs.forEach(c => {
    const taux = staffingMap[c.id]?.taux || 0;
    if (taux === 0) alerts.push({ icon:'👤', text:`${c.prenom} ${c.nom} non staffé`, type:'info' });
  });

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:8}}>
        <PageHeader title="Missions" subtitle="Gestion des projets et du staffing" />
        <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nouvelle mission</button>
      </div>

      {/* Global date filter + stat cards */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <span style={{fontSize:'0.78rem',fontWeight:700,color:'var(--muted)'}}>Période :</span>
          <input type="date" value={missionDateDebut} onChange={e=>setMissionDateDebut(e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'5px 8px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)',color:'var(--navy)'}} />
          <span style={{color:'var(--muted)',fontSize:'0.75rem'}}>→</span>
          <input type="date" value={missionDateFin} onChange={e=>setMissionDateFin(e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'5px 8px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)',color:'var(--navy)'}} />
        </div>
        <div style={{display:'flex',gap:3}}>
          {[['','Tout'],['month','Ce mois'],['q','Ce trimestre'],['year','Cette année']].map(([k,l])=>(
            <button key={k} onClick={()=>{
              const y=now.getFullYear(),m=now.getMonth();
              if (!k) { setMissionDateDebut(''); setMissionDateFin(''); }
              else if (k==='month') { setMissionDateDebut(`${y}-${String(m+1).padStart(2,'0')}-01`); setMissionDateFin(new Date(y,m+1,0).toISOString().split('T')[0]); }
              else if (k==='q') { const qs=Math.floor(m/3)*3; setMissionDateDebut(`${y}-${String(qs+1).padStart(2,'0')}-01`); setMissionDateFin(new Date(y,qs+3,0).toISOString().split('T')[0]); }
              else if (k==='year') { setMissionDateDebut(`${y}-01-01`); setMissionDateFin(`${y}-12-31`); }
            }} className="btn btn-ghost btn-sm" style={{padding:'3px 8px',fontSize:'0.68rem',background:(!missionDateDebut&&!k)?'var(--pink)':'transparent',color:(!missionDateDebut&&!k)?'white':'var(--muted)'}}>{l}</button>
          ))}
        </div>
      </div>

      <div className="tabs-scroll" style={{display:'flex',gap:6,marginBottom:24,background:'var(--offwhite)',padding:6,borderRadius:12,overflowX:'auto'}}>
        {[['missions',`🏢 Clients & Missions`],['timeline','📅 Calendrier'],['staffing','📊 Staffing'],['finance','💰 Finance']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:'1 0 auto',padding:'10px 14px',borderRadius:10,border:'none',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',background:tab===k?'var(--pink)':'transparent',color:tab===k?'white':'var(--muted)',border:tab===k?'none':'1.5px solid var(--lavender)',boxShadow:tab===k?'0 4px 14px rgba(255,50,133,0.3)':'none'}}>{l}</button>
        ))}
      </div>

      {/* CLIENTS & MISSIONS (fusionné) */}
      {tab==='missions' && <FadeIn><div>
        {/* Mode carte : vue détail client */}
        {viewMode==='cartes' && selectedClient ? (()=>{
          const sc = clients.find(x=>x.id===selectedClient);
          if (!sc) return null;
          const cMissions = missions.filter(m => m.client_id === sc.id);
          return <div>
            <button className="btn btn-ghost btn-sm" onClick={()=>setSelectedClient(null)} style={{marginBottom:16}}>← Retour</button>
            <div className="card" style={{marginBottom:20,padding:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:'1.3rem',color:'var(--navy)'}}>{sc.nom}</div>
                  {sc.secteur && <Badge type="blue">{sc.secteur}</Badge>}
                  {sc.description && <p style={{color:'var(--muted)',fontSize:'0.85rem',marginTop:8}}>{sc.description}</p>}
                  {sc.contact_nom && <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:6}}>👤 {sc.contact_nom}{sc.contact_email ? ` · ${sc.contact_email}` : ''}</div>}
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{setClientModal(sc);setClientForm({nom:sc.nom,description:sc.description||'',secteur:sc.secteur||'',contact_nom:sc.contact_nom||'',contact_email:sc.contact_email||''});}}>✏️</button>
                  <button className="btn btn-primary btn-sm" onClick={()=>openCreate(sc.id)}>+ Mission</button>
                </div>
              </div>
            </div>
            {cMissions.length === 0 ? <div className="card" style={{textAlign:'center',padding:24,color:'var(--muted)'}}>Aucune mission</div> :
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:16}}>
              {cMissions.map(m => <MissionCard key={m.id} m={m} collabs={collabs} onEdit={openEdit} onDelete={deleteMission} onAssign={()=>{setAssignModal(m.id);setAssignForm({collaborateur_id:'',role:'',taux_staffing:100,jours_par_semaine:5,tjm:'',date_debut:m.date_debut||'',date_fin:m.date_fin||''});}} onRemoveAssign={removeAssignment} onDetail={setDetail} onDuplicate={duplicateMission} />)}
            </div>}
          </div>;
        })() : <>
        {/* Barre de filtres */}
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher..." style={{flex:1,maxWidth:250,border:'1.5px solid var(--lavender)',borderRadius:10,padding:'8px 14px',fontFamily:'inherit',fontSize:'0.82rem',outline:'none',background:'var(--offwhite)',color:'var(--navy)'}} />
          <button className="btn btn-ghost btn-sm" onClick={()=>{setClientModal('create');setClientForm({nom:'',description:'',secteur:'',siren:'',siret:'',tva_intra:'',adresse:'',code_postal:'',ville:'',categorie_entreprise:'',referent_id:'',contact_signature_nom:'',contact_signature_email:'',contact_signature_tel:'',contact_facturation_nom:'',contact_facturation_email:'',contact_facturation_tel:''});}}>+ Client</button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Mission</button>
          <div style={{display:'flex',gap:2,marginLeft:'auto'}}>
            <button onClick={()=>{setViewMode('cartes');setSelectedClient(null);}} className={`btn btn-sm ${viewMode==='cartes'?'btn-primary':'btn-ghost'}`} style={{padding:'5px 10px',fontSize:'0.72rem'}}>Cartes</button>
            <button onClick={()=>setViewMode('liste')} className={`btn btn-sm ${viewMode==='liste'?'btn-primary':'btn-ghost'}`} style={{padding:'5px 10px',fontSize:'0.72rem'}}>Liste</button>
          </div>
        </div>

        {(()=>{
          const filteredClients = clients.filter(c => !search || (c.nom+(c.secteur||'')+missions.filter(m=>m.client_id===c.id).map(m=>m.nom).join('')).toLowerCase().includes(search.toLowerCase()));
          if (filteredClients.length === 0) return <div className="card" style={{textAlign:'center',padding:32,color:'var(--muted)'}}>Aucun client trouvé</div>;

          if (viewMode === 'liste') return <div className="card" style={{overflowX:'auto'}}><table>
            <thead><tr><th style={{minWidth:160}}>Client</th><th>Secteur</th><th>Référent</th><th>Missions</th><th></th></tr></thead>
            <tbody>{filteredClients.map(c => {
              const cMissions = missions.filter(m => m.client_id === c.id);
              const activeMissions = cMissions.filter(isMissionActive);
              const isExpanded = expandedClients.has(c.id);
              return <React.Fragment key={c.id}>
                <tr style={{cursor:'pointer',background:isExpanded?'rgba(255,50,133,0.03)':'transparent',borderBottom:isExpanded?'none':'1px solid var(--lavender)'}} onClick={()=>toggleClient(c.id)}>
                  <td style={{fontWeight:700,color:'var(--navy)'}}>
                    <span style={{color:'var(--muted)',fontSize:'0.7rem',marginRight:8}}>{isExpanded?'▼':'▶'}</span>
                    {c.nom}
                  </td>
                  <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{c.secteur||'—'}</td>
                  <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{(()=>{const ref=c.referent_id?collabs.find(x=>x.id===c.referent_id):null; return ref?`${ref.prenom} ${ref.nom}`:'—';})()}</td>
                  <td><span style={{fontWeight:700,color:activeMissions.length>0?'var(--blue)':'var(--muted)'}}>{activeMissions.length}</span><span style={{color:'var(--muted)',fontSize:'0.75rem'}}>/{cMissions.length}</span></td>
                  <td><div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm" style={{padding:'3px 8px'}} onClick={()=>{setClientModal(c);setClientForm({nom:c.nom,description:c.description||'',secteur:c.secteur||'',siren:c.siren||'',siret:c.siret||'',tva_intra:c.tva_intra||'',adresse:c.adresse||'',code_postal:c.code_postal||'',ville:c.ville||'',categorie_entreprise:c.categorie_entreprise||'',referent_id:c.referent_id||'',contact_signature_nom:c.contact_signature_nom||'',contact_signature_email:c.contact_signature_email||'',contact_signature_tel:c.contact_signature_tel||'',contact_facturation_nom:c.contact_facturation_nom||'',contact_facturation_email:c.contact_facturation_email||'',contact_facturation_tel:c.contact_facturation_tel||''});}}>✏️</button>
                    <button className="btn btn-ghost btn-sm" style={{padding:'3px 8px'}} onClick={()=>openCreate(c.id)}>+</button>
                    <button className="btn btn-danger btn-sm" style={{padding:'3px 8px'}} onClick={()=>deleteClient(c.id)}>🗑️</button>
                  </div></td>
                </tr>
                {isExpanded && (cMissions.length === 0
                  ? <tr><td colSpan={5} style={{paddingLeft:40,fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic',borderBottom:'1px solid var(--lavender)'}}>Aucune mission</td></tr>
                  : cMissions.map(m => (
                  <tr key={m.id} style={{background:'rgba(255,50,133,0.02)',borderBottom:'1px solid var(--lavender)'}}>
                    <td style={{paddingLeft:40}}>
                      <span style={{fontWeight:700,color:'var(--navy)',cursor:'pointer'}} onClick={()=>setDetail(m)}>{m.nom}</span>
                      {m.categorie && <span style={{fontSize:'0.72rem',color:'var(--muted)',marginLeft:8}}>{m.categorie}</span>}
                    </td>
                    <td><Badge type={isMissionActive(m)?'blue':'gray'}>{isMissionActive(m)?'En cours':'Passée'}</Badge></td>
                    <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{fmtDate(m.date_debut)} → {fmtDate(m.date_fin)}</td>
                    <td><div style={{display:'flex',gap:-4}}>{(m.assignments||[]).slice(0,4).map(a=>a.collaborateurs&&<Avatar key={a.id} prenom={a.collaborateurs.prenom} nom={a.collaborateurs.nom} photoUrl={a.collaborateurs.photo_url} size={22} />)}{(m.assignments||[]).length>4&&<span style={{fontSize:'0.65rem',color:'var(--muted)'}}>+{(m.assignments||[]).length-4}</span>}</div></td>
                    <td><div style={{display:'flex',gap:4,alignItems:'center'}}>
                      {m.budget_vendu && <span style={{fontSize:'0.78rem',fontWeight:600,color:'var(--navy)',marginRight:8}}>{m.budget_vendu.toLocaleString('fr-FR')}€</span>}
                      <button className="btn btn-ghost btn-sm" style={{padding:'3px 8px'}} onClick={()=>openEdit(m)}>✏️</button>
                      <button className="btn btn-ghost btn-sm" style={{padding:'3px 8px'}} onClick={()=>{setAssignModal(m.id);setAssignForm({collaborateur_id:'',role:'',taux_staffing:100,jours_par_semaine:5,tjm:'',date_debut:m.date_debut||'',date_fin:m.date_fin||''});}}>👤+</button>
                      <button className="btn btn-danger btn-sm" style={{padding:'3px 8px'}} onClick={()=>deleteMission(m.id)}>🗑️</button>
                    </div></td>
                  </tr>
                )))}
              </React.Fragment>;
            })}</tbody>
          </table></div>;

          // Mode cartes
          return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
            {filteredClients.map(c => {
              const cMissions = missions.filter(m => m.client_id === c.id);
              const activeMissions = cMissions.filter(isMissionActive);
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
          </div>;
        })()}
        </>}
      </div></FadeIn>}

      {/* TIMELINE / CALENDRIER GLOBAL */}
      {tab==='timeline' && (()=>{
        const allEquipes = [...new Set(collabs.flatMap(c=>(c.equipe||'').split(',').map(s=>s.trim())).filter(Boolean))].sort();
        const allBureaux = [...new Set(collabs.map(c=>c.bureau).filter(Boolean))].sort();
        const toggleEquipe = (eq) => setFilterEquipes(prev => prev.includes(eq) ? prev.filter(e=>e!==eq) : [...prev, eq]);
        let filteredCollabs = collabs;
        if (filterEquipes.length > 0) filteredCollabs = filteredCollabs.filter(c => filterEquipes.some(eq=>(c.equipe||'').includes(eq)));
        if (filterBureau) filteredCollabs = filteredCollabs.filter(c => c.bureau === filterBureau);
        return <FadeIn><div>
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <select value={filterClient} onChange={e=>setFilterClient(e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 10px',fontFamily:'inherit',fontSize:'0.78rem',background:'var(--offwhite)',color:'var(--navy)'}}>
            <option value="">Tous les clients</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select value={filterBureau} onChange={e=>setFilterBureau(e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 10px',fontFamily:'inherit',fontSize:'0.78rem',background:'var(--offwhite)',color:'var(--navy)'}}>
            <option value="">Tous les bureaux</option>
            {allBureaux.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
          <div ref={equipeDropdownRef} style={{position:'relative'}}>
            <button onClick={()=>setShowEquipeDropdown(!showEquipeDropdown)} className="btn btn-ghost btn-sm" style={{fontSize:'0.75rem'}}>
              Equipes {filterEquipes.length>0?`(${filterEquipes.length})`:''} ▾
            </button>
            {showEquipeDropdown && <div style={{position:'absolute',top:'100%',left:0,background:'var(--white)',border:'1.5px solid var(--lavender)',borderRadius:10,padding:8,zIndex:100,boxShadow:'0 8px 24px rgba(5,5,109,0.15)',minWidth:200,maxHeight:250,overflowY:'auto'}}>
              <button onClick={()=>{setFilterEquipes([]);setShowEquipeDropdown(false);}} style={{width:'100%',textAlign:'left',padding:'6px 8px',border:'none',background:'transparent',fontFamily:'inherit',fontSize:'0.78rem',color:'var(--muted)',cursor:'pointer',fontWeight:600}}>Tout decocher</button>
              {allEquipes.map(eq=>(
                <label key={eq} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',cursor:'pointer',borderRadius:6,fontSize:'0.78rem',fontWeight:600,color:'var(--navy)',background:filterEquipes.includes(eq)?'var(--offwhite)':'transparent'}}>
                  <input type="checkbox" checked={filterEquipes.includes(eq)} onChange={()=>toggleEquipe(eq)} style={{accentColor:'var(--pink)'}} />
                  {eq}
                </label>
              ))}
            </div>}
          </div>
          {(filterClient || filterBureau || filterEquipes.length > 0) && <button className="btn btn-ghost btn-sm" style={{fontSize:'0.72rem',color:'var(--muted)'}} onClick={()=>{setFilterClient('');setFilterBureau('');setFilterEquipes([]);}}>Reinitialiser</button>}
        </div>
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <TimelineView missions={filterClient ? active.filter(m=>m.client_id===filterClient) : active} collabs={filteredCollabs} staffingMap={staffingMap} allMissions={active} />
        </div>
      </div></FadeIn>})()}

      {/* STAFFING */}
      {tab==='staffing' && (()=>{
        const allEquipes = [...new Set(collabs.flatMap(c=>(c.equipe||'').split(',').map(s=>s.trim())).filter(Boolean))].sort();
        const toggleEquipe = (eq) => setFilterEquipes(prev => prev.includes(eq) ? prev.filter(e=>e!==eq) : [...prev, eq]);
        const filteredStaffing = Object.values(staffingMap).filter(({collab:c}) => filterEquipes.length===0 || filterEquipes.some(eq=>(c.equipe||'').includes(eq)));
        const avg = filteredStaffing.length ? Math.round(filteredStaffing.reduce((s,v)=>s+v.taux,0)/filteredStaffing.length) : 0;

        return <FadeIn><div>
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:'0.78rem',color:'var(--muted)',fontWeight:600}}>Taux moyen: {avg}%</span>
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

      {/* FINANCE */}
      {tab==='finance' && <FadeIn><div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16,marginBottom:24}}>
          <div className="card" style={{textAlign:'center',padding:20}}>
            <div style={{fontSize:'2rem',fontWeight:700,color:'var(--navy)'}}>{Math.round(budgetTotal/1000)}k€</div>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',marginTop:4}}>Budget total vendu</div>
          </div>
          <div className="card" style={{textAlign:'center',padding:20}}>
            <div style={{fontSize:'2rem',fontWeight:700,color:budgetConsomme>budgetTotal*0.9?'var(--red)':'var(--blue)'}}>{Math.round(budgetConsomme/1000)}k€</div>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',marginTop:4}}>Budget consommé (est.)</div>
          </div>
          <div className="card" style={{textAlign:'center',padding:20}}>
            <div style={{fontSize:'2rem',fontWeight:700,color:'var(--green)'}}>{Math.round(caPrevu/1000)}k€</div>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',marginTop:4}}>CA mensuel prévu</div>
          </div>
          <div className="card" style={{textAlign:'center',padding:20}}>
            <div style={{fontSize:'2rem',fontWeight:700,color:'var(--navy)'}}>{budgetTotal>0?Math.round((budgetTotal-budgetConsomme)/budgetTotal*100):0}%</div>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',marginTop:4}}>Budget restant</div>
          </div>
        </div>
        <FinanceByClient clients={clients} missions={missions} isMissionActive={isMissionActive} getClientName={getClientName} periodStart={periodStart} periodEnd={periodEnd} />
      </div></FadeIn>}

      {/* CREATE/EDIT MODAL */}
      <Modal open={!!modal} onClose={()=>setModal(null)} title={modal==='create'?'Nouvelle mission':'Modifier la mission'}>
        <div className="form-grid">
          <div className="form-field"><label>Nom <span style={{color:'var(--red)'}}>*</span></label><input autoFocus value={form.nom||''} onChange={e=>setForm({...form,nom:e.target.value})} /></div>
          <div className="form-field"><label>Client <span style={{color:'var(--red)'}}>*</span></label><select value={form.client_id||''} onChange={e=>setForm({...form,client_id:e.target.value})}><option value="">Sélectionner un client...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
          <div className="form-field"><label>Catégorie</label><select value={form.categorie||''} onChange={e=>setForm({...form,categorie:e.target.value})}><option value="">—</option>{missionCategories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
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

      {/* DETAIL MODAL — vue complète mission */}
      <Modal open={!!detail} onClose={()=>setDetail(null)} title={detail?`${detail.nom} — ${getClientName(detail)}`:''}>
        {detail && (()=>{
          const team = (detail.assignments||[]).filter(a=>a.statut==='actif');
          const calcCA = (a) => {
            if (!a.tjm || !a.date_debut) return 0;
            const start = new Date(a.date_debut);
            const end = a.date_fin ? new Date(a.date_fin) : new Date();
            const weeks = Math.max(0, (end - start) / (7*86400000));
            return a.tjm * (a.jours_par_semaine || a.taux_staffing/100*5) * weeks;
          };
          const calcCAMensuel = (a) => a.tjm ? a.tjm * (a.jours_par_semaine || a.taux_staffing/100*5) * 4.33 : 0;
          const totalCA = team.reduce((s,a)=>s+calcCA(a),0);
          const totalCAMensuel = team.reduce((s,a)=>s+calcCAMensuel(a),0);
          const totalJours = team.reduce((s,a)=>s+(a.jours_par_semaine||a.taux_staffing/100*5),0);
          const budgetPct = detail.budget_vendu > 0 ? Math.round(totalCA/detail.budget_vendu*100) : null;

          const saveDetail = async () => {
            try {
              const clientObj = clients.find(c=>c.id===detailForm.client_id);
              const row = { ...detailForm, client: clientObj?.nom||'', budget_vendu: detailForm.budget_vendu ? parseFloat(detailForm.budget_vendu) : null, responsable_id: detailForm.responsable_id||null, lien_propale: detailForm.lien_propale||null };
              await api.updateMission(detail.id, row);
              await loadData();
              const updated = (await api.getMissions()).find(m=>m.id===detail.id);
              if (updated) setDetail(updated);
              showToast('Mission mise à jour');
            } catch(e) { showToast('Erreur: '+e.message); }
          };

          const addAssignInline = async () => {
            if (!detailAssignForm.collaborateur_id || !detailAssignForm.role || !detailAssignForm.tjm) { showToast('Collaborateur, rôle et TJM requis'); return; }
            try {
              await api.createAssignment({ ...detailAssignForm, mission_id: detail.id, tjm: parseFloat(detailAssignForm.tjm), statut:'actif' });
              await loadData();
              const updated = (await api.getMissions()).find(m=>m.id===detail.id);
              if (updated) setDetail(updated);
              setDetailAssignForm({ collaborateur_id:'', role:'', taux_staffing:100, jours_par_semaine:5, tjm:'', date_debut:detail.date_debut||'', date_fin:detail.date_fin||'' });
              showToast('Collaborateur affecté');
            } catch(e) { showToast('Erreur: '+e.message); }
          };

          return <>
          {/* Section 1 : Infos mission */}
          <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginBottom:8}}>Informations</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
            <Badge type={isMissionActive(detail)?'blue':'gray'}>{isMissionActive(detail)?'En cours':'Passée'}</Badge>
            {detail.categorie && <Badge type="blue">{detail.categorie}</Badge>}
            {detail.methode_facturation && <Badge type="gray">{detail.methode_facturation==='forfait'?'Forfait':'Régie'}</Badge>}
          </div>
          <div className="form-grid">
            <div className="form-field"><label>Nom</label><input value={detailForm.nom||''} onChange={e=>setDetailForm({...detailForm,nom:e.target.value})} /></div>
            <div className="form-field"><label>Client</label><select value={detailForm.client_id||''} onChange={e=>setDetailForm({...detailForm,client_id:e.target.value})}><option value="">—</option>{clients.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
            <div className="form-field"><label>Catégorie</label><select value={detailForm.categorie||''} onChange={e=>setDetailForm({...detailForm,categorie:e.target.value})}><option value="">—</option>{missionCategories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div className="form-field"><label>Facturation</label><select value={detailForm.methode_facturation||'regie'} onChange={e=>setDetailForm({...detailForm,methode_facturation:e.target.value})}><option value="regie">Régie</option><option value="forfait">Forfait</option></select></div>
            <div className="form-field"><label>Date début</label><input type="date" value={detailForm.date_debut||''} onChange={e=>setDetailForm({...detailForm,date_debut:e.target.value})} /></div>
            <div className="form-field"><label>Date fin</label><input type="date" value={detailForm.date_fin||''} onChange={e=>setDetailForm({...detailForm,date_fin:e.target.value})} /></div>
            <div className="form-field"><label>Budget vendu (€)</label><input type="number" value={detailForm.budget_vendu||''} onChange={e=>setDetailForm({...detailForm,budget_vendu:e.target.value})} /></div>
            <div className="form-field"><label>Responsable</label><select value={detailForm.responsable_id||''} onChange={e=>setDetailForm({...detailForm,responsable_id:e.target.value})}><option value="">Aucun</option>{collabs.map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}</select></div>
            <div className="form-field"><label>Lien propale</label><input type="url" value={detailForm.lien_propale||''} onChange={e=>setDetailForm({...detailForm,lien_propale:e.target.value})} placeholder="https://..." /></div>
          </div>
          <div className="form-field" style={{marginTop:8}}><label>Description</label><textarea value={detailForm.description||''} onChange={e=>setDetailForm({...detailForm,description:e.target.value})} style={{minHeight:50}} /></div>
          <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}><button className="btn btn-primary btn-sm" onClick={saveDetail}>💾 Enregistrer</button></div>

          <div style={{height:1,background:'var(--lavender)',margin:'16px 0'}} />

          {/* Section 2 : Équipe */}
          <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginBottom:8}}>Équipe ({team.length})</div>
          {team.length === 0 ? <p style={{color:'var(--muted)',fontSize:'0.82rem',fontStyle:'italic',marginBottom:12}}>Aucun collaborateur affecté</p> :
          team.map(a=>(
            <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',border:'1px solid var(--lavender)',borderRadius:10,marginBottom:6}}>
              {a.collaborateurs && <Avatar prenom={a.collaborateurs.prenom} nom={a.collaborateurs.nom} photoUrl={a.collaborateurs.photo_url} size={28} />}
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:'0.85rem',color:'var(--navy)'}}>{a.collaborateurs?a.collaborateurs.prenom+' '+a.collaborateurs.nom:'—'}</div>
                <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>{a.role||'—'} · {a.jours_par_semaine||Math.round(a.taux_staffing/100*5*10)/10}j/sem · {a.taux_staffing}% · {a.tjm?a.tjm+'€/j':'—'}</div>
              </div>
              <div style={{textAlign:'right',minWidth:80}}>
                <div style={{fontSize:'0.78rem',fontWeight:700,color:'var(--blue)'}}>{Math.round(calcCA(a)).toLocaleString('fr-FR')} €</div>
                <div style={{fontSize:'0.65rem',color:'var(--muted)'}}>{fmtDate(a.date_debut)} → {fmtDate(a.date_fin)}</div>
              </div>
              <button className="btn btn-danger btn-sm" style={{padding:'2px 6px',fontSize:'0.65rem'}} onClick={async()=>{await removeAssignment(a.id);const updated=(await api.getMissions()).find(m=>m.id===detail.id);if(updated)setDetail(updated);}}>✕</button>
            </div>
          ))}

          {/* Formulaire ajout inline */}
          <div style={{padding:'10px 12px',border:'1.5px dashed var(--lavender)',borderRadius:10,marginTop:8}}>
            <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',marginBottom:6}}>+ Ajouter un collaborateur</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <select value={detailAssignForm.collaborateur_id} onChange={e=>setDetailAssignForm({...detailAssignForm,collaborateur_id:e.target.value})} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 8px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)',color:'var(--navy)'}}>
                <option value="">Collaborateur...</option>
                {collabs.map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
              </select>
              <select value={detailAssignForm.role} onChange={e=>{const role=missionRoles.find(r=>r.label===e.target.value);setDetailAssignForm({...detailAssignForm,role:e.target.value,tjm:role?String(role.tjm):detailAssignForm.tjm});}} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 8px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)',color:'var(--navy)'}}>
                <option value="">Rôle...</option>
                {missionRoles.map(r=><option key={r.label} value={r.label}>{r.label} ({r.tjm}€)</option>)}
              </select>
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <input type="number" step="0.5" min="0.5" max="5" value={detailAssignForm.jours_par_semaine} onChange={e=>{const jps=parseFloat(e.target.value)||0;setDetailAssignForm({...detailAssignForm,jours_par_semaine:jps,taux_staffing:Math.round(jps/5*100)});}} style={{width:60,border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 8px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)',color:'var(--navy)'}} />
                <span style={{fontSize:'0.68rem',color:'var(--muted)'}}>j/sem</span>
              </div>
              <input type="number" placeholder="TJM €" value={detailAssignForm.tjm} onChange={e=>setDetailAssignForm({...detailAssignForm,tjm:e.target.value})} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 8px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)',color:'var(--navy)'}} />
              <input type="date" value={detailAssignForm.date_debut} onChange={e=>setDetailAssignForm({...detailAssignForm,date_debut:e.target.value})} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 8px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)',color:'var(--navy)'}} />
              <input type="date" value={detailAssignForm.date_fin} onChange={e=>setDetailAssignForm({...detailAssignForm,date_fin:e.target.value})} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 8px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)',color:'var(--navy)'}} />
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}><button className="btn btn-primary btn-sm" onClick={addAssignInline}>+ Affecter</button></div>
          </div>

          <div style={{height:1,background:'var(--lavender)',margin:'16px 0'}} />

          {/* Section 3 : Planning & Finance */}
          <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginBottom:8}}>Planning & Finance</div>
          {team.length > 0 && <>
            <div className="card" style={{overflowX:'auto',marginBottom:12}}>
              <table style={{fontSize:'0.78rem'}}>
                <thead><tr><th>Collaborateur</th><th>Rôle</th><th>Jours/sem</th><th>TJM</th><th>Période</th><th style={{textAlign:'right'}}>CA estimé</th><th style={{textAlign:'right'}}>CA/mois</th></tr></thead>
                <tbody>
                  {team.map(a=>(
                    <tr key={a.id}>
                      <td style={{fontWeight:700,color:'var(--navy)'}}>{a.collaborateurs?a.collaborateurs.prenom+' '+a.collaborateurs.nom:'—'}</td>
                      <td style={{color:'var(--muted)'}}>{a.role||'—'}</td>
                      <td style={{fontWeight:600}}>{a.jours_par_semaine||Math.round(a.taux_staffing/100*5*10)/10}j</td>
                      <td style={{fontWeight:600}}>{a.tjm?a.tjm+'€':'—'}</td>
                      <td style={{color:'var(--muted)'}}>{fmtDate(a.date_debut)} → {fmtDate(a.date_fin)}</td>
                      <td style={{textAlign:'right',fontWeight:700,color:'var(--navy)'}}>{Math.round(calcCA(a)).toLocaleString('fr-FR')} €</td>
                      <td style={{textAlign:'right',fontWeight:600,color:'var(--blue)'}}>{Math.round(calcCAMensuel(a)).toLocaleString('fr-FR')} €</td>
                    </tr>
                  ))}
                  <tr style={{borderTop:'2px solid var(--lavender)',fontWeight:700}}>
                    <td>Total</td><td></td>
                    <td>{Math.round(totalJours*10)/10}j/sem</td>
                    <td></td><td></td>
                    <td style={{textAlign:'right',color:'var(--navy)'}}>{Math.round(totalCA).toLocaleString('fr-FR')} €</td>
                    <td style={{textAlign:'right',color:'var(--blue)'}}>{Math.round(totalCAMensuel).toLocaleString('fr-FR')} €</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>}

          {/* Budget progress */}
          {budgetPct !== null && <div style={{marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem',marginBottom:4}}>
              <span style={{color:'var(--muted)'}}>Budget consommé (est.)</span>
              <span style={{fontWeight:700,color:budgetPct>90?'var(--red)':'var(--navy)'}}>{Math.round(totalCA).toLocaleString('fr-FR')} € / {detail.budget_vendu?.toLocaleString('fr-FR')} € ({budgetPct}%)</span>
            </div>
            <div style={{height:8,background:'var(--offwhite)',borderRadius:4,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${Math.min(budgetPct,100)}%`,background:budgetPct>90?'var(--red)':budgetPct>70?'var(--orange)':'var(--green)',borderRadius:4}} />
            </div>
          </div>}

          <div style={{display:'flex',gap:16,fontSize:'0.82rem',color:'var(--muted)',marginTop:8}}>
            <span>CA mensuel estimé : <strong style={{color:'var(--blue)'}}>{Math.round(totalCAMensuel).toLocaleString('fr-FR')} €</strong></span>
            {detail.lien_propale && <a href={detail.lien_propale} target="_blank" rel="noopener noreferrer" style={{color:'var(--blue)',textDecoration:'none'}}>📄 Propale signée</a>}
          </div>
        </>;
        })()}
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

function MissionCard({ m, collabs, onEdit, onDelete, onAssign, onRemoveAssign, onDetail, onDuplicate }) {
  const team = (m.assignments || []).filter(a => a.statut === 'actif');
  const resp = m.responsable_id ? collabs.find(c => c.id === m.responsable_id) : null;
  const todayStr = new Date().toISOString().split('T')[0];
  const isActive = !m.date_fin || m.date_fin >= todayStr;
  const daysLeft = m.date_fin ? Math.ceil((new Date(m.date_fin) - new Date()) / 86400000) : null;
  // Budget progress
  const consumed = (m.assignments||[]).reduce((s,a) => {
    if (!a.date_debut || !a.tjm) return s;
    const start = new Date(a.date_debut);
    const end = a.date_fin ? new Date(Math.min(new Date(a.date_fin), new Date())) : new Date();
    const weeks = Math.max(0, (end - start) / (7*86400000));
    return s + (a.tjm * (a.jours_par_semaine||a.taux_staffing/100*5) * weeks);
  }, 0);
  const budgetPct = m.budget_vendu > 0 ? Math.round(consumed/m.budget_vendu*100) : null;

  return (
    <div className="card" style={{padding:20,borderLeft:`4px solid ${isActive?'var(--blue)':'var(--lavender)'}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div style={{cursor:'pointer'}} onClick={()=>onDetail(m)}>
          <div style={{fontWeight:700,fontSize:'1rem',color:'var(--navy)'}}>{m.nom}</div>
          <div style={{fontSize:'0.82rem',color:'var(--muted)',marginTop:2}}>{m.clients?.nom || m.client || '—'}{m.categorie ? ` · ${m.categorie}` : ''}</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
          <Badge type={isActive?'blue':'gray'}>{isActive?'En cours':'Passée'}</Badge>
          {daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && <span style={{fontSize:'0.65rem',fontWeight:700,color:'var(--orange)'}}>⏰ {daysLeft}j restants</span>}
        </div>
      </div>
      <div style={{display:'flex',gap:12,fontSize:'0.78rem',color:'var(--muted)',marginBottom:8,flexWrap:'wrap'}}>
        <span>📅 {fmtDate(m.date_debut)} → {fmtDate(m.date_fin)}</span>
        {m.budget_vendu && <span>💰 {m.budget_vendu.toLocaleString('fr-FR')} €</span>}
        {m.methode_facturation && <span>{m.methode_facturation==='forfait'?'📦 Forfait':'⏱️ Régie'}</span>}
        {m.lien_propale && <a href={m.lien_propale} target="_blank" rel="noopener noreferrer" style={{color:'var(--blue)',textDecoration:'none'}} onClick={e=>e.stopPropagation()}>📄 Propale</a>}
      </div>
      {/* Budget bar */}
      {budgetPct !== null && <div style={{marginBottom:10}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.68rem',color:'var(--muted)',marginBottom:3}}><span>Budget</span><span style={{fontWeight:700,color:budgetPct>90?'var(--red)':'var(--navy)'}}>{budgetPct}%</span></div>
        <div style={{height:6,background:'var(--offwhite)',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(budgetPct,100)}%`,background:budgetPct>90?'var(--red)':budgetPct>70?'var(--orange)':'var(--green)',borderRadius:4}} /></div>
      </div>}
      {resp && <div style={{fontSize:'0.75rem',color:'var(--muted)',marginBottom:8}}>👔 {resp.prenom} {resp.nom}</div>}
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
        {team.slice(0,5).map(a => a.collaborateurs && <Avatar key={a.id} prenom={a.collaborateurs.prenom} nom={a.collaborateurs.nom} photoUrl={a.collaborateurs.photo_url} size={28} tooltip={true} />)}
        {team.length > 5 && <span style={{fontSize:'0.72rem',color:'var(--muted)',fontWeight:700}}>+{team.length-5}</span>}
        {team.length === 0 && <span style={{fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic'}}>Aucun collaborateur affecté</span>}
      </div>
      <div style={{display:'flex',gap:6}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>onAssign()}>+ Affecter</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>onEdit(m)}>✏️</button>
        {onDuplicate && <button className="btn btn-ghost btn-sm" onClick={()=>onDuplicate(m)} title="Dupliquer">📋</button>}
        <button className="btn btn-danger btn-sm" style={{padding:'5px 8px'}} onClick={()=>onDelete(m.id)}>🗑️</button>
      </div>
    </div>
  );
}

/** Vue timeline Gantt — collabs en lignes × semaines/mois en colonnes, barres de staffing */
function TimelineView({ missions, collabs, staffingMap, allMissions }) {
  const [offset, setOffset] = useState(0);
  const [selectedCollab, setSelectedCollab] = useState(null);
  const [viewUnit, setViewUnit] = useState('week'); // 'week' | 'month'
  const WEEKS = 16;
  const MONTHS_COUNT = 6;
  const MISSION_COLORS = ['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#6366F1'];

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Build columns based on viewUnit
  const columns = viewUnit === 'week'
    ? Array.from({length:WEEKS},(_,i) => {
        const startMonday = new Date(now);
        startMonday.setDate(now.getDate() - ((now.getDay()+6)%7) + (offset*WEEKS) + i*7);
        startMonday.setHours(0,0,0,0);
        const weekNum = Math.ceil(((startMonday - new Date(startMonday.getFullYear(),0,1)) / 86400000 + 1) / 7);
        const end = new Date(startMonday.getTime()+4*86400000);
        return { label:`S${weekNum}`, start:startMonday.toISOString().split('T')[0], end:end.toISOString().split('T')[0], month:startMonday.toLocaleDateString('fr-FR',{month:'short'}), year:startMonday.getFullYear(), isCurrent: todayStr >= startMonday.toISOString().split('T')[0] && todayStr <= end.toISOString().split('T')[0] };
      })
    : Array.from({length:MONTHS_COUNT},(_,i) => {
        const d = new Date(now.getFullYear(), now.getMonth() + offset*MONTHS_COUNT + i, 1);
        const endD = new Date(d.getFullYear(), d.getMonth()+1, 0);
        return { label:d.toLocaleDateString('fr-FR',{month:'short',year:'numeric'}), start:d.toISOString().split('T')[0], end:endD.toISOString().split('T')[0], isCurrent: d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear() };
      });

  // Group week columns by month for header row
  const monthHeaders = [];
  if (viewUnit === 'week') {
    let lastKey = '';
    columns.forEach((col,i) => {
      const key = col.month + ' ' + col.year;
      if (key !== lastKey) { monthHeaders.push({label:key,start:i,span:1}); lastKey = key; }
      else monthHeaders[monthHeaders.length-1].span++;
    });
  }

  const assignedCollabs = collabs.filter(c => staffingMap[c.id]?.missions?.length > 0).sort((a,b) => (staffingMap[b.id]?.taux||0) - (staffingMap[a.id]?.taux||0));
  const nonStaffedCount = collabs.filter(c => !staffingMap[c.id]?.missions?.length).length;
  const navLabel = viewUnit === 'week' ? `${WEEKS} sem.` : `${MONTHS_COUNT} mois`;
  const colCount = columns.length + 1;

  // Get assignments for a collab across all missions
  const getCollabAssignments = (collabId) => (allMissions||missions).flatMap(m => (m.assignments||[]).filter(a => a.collaborateur_id === collabId && a.statut === 'actif').map(a => ({...a, mission: m})));

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 18px',borderBottom:'1px solid var(--lavender)'}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>setOffset(offset-1)}>← {navLabel}</button>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontWeight:700,color:'var(--navy)'}}>📅 Calendrier</span>
          <div style={{display:'flex',gap:2,background:'var(--offwhite)',borderRadius:8,padding:2}}>
            <button onClick={()=>{setViewUnit('week');setOffset(0);}} className="btn btn-sm" style={{padding:'3px 10px',fontSize:'0.68rem',fontWeight:700,background:viewUnit==='week'?'var(--pink)':'transparent',color:viewUnit==='week'?'white':'var(--muted)',border:'none',borderRadius:6}}> Semaine</button>
            <button onClick={()=>{setViewUnit('month');setOffset(0);}} className="btn btn-sm" style={{padding:'3px 10px',fontSize:'0.68rem',fontWeight:700,background:viewUnit==='month'?'var(--pink)':'transparent',color:viewUnit==='month'?'white':'var(--muted)',border:'none',borderRadius:6}}>Mois</button>
          </div>
        </div>
        <div style={{display:'flex',gap:6}}>
          {offset !== 0 && <button className="btn btn-ghost btn-sm" onClick={()=>setOffset(0)}>Aujourd'hui</button>}
          <button className="btn btn-ghost btn-sm" onClick={()=>setOffset(offset+1)}>{navLabel} →</button>
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{fontSize:'0.7rem',width:'100%',borderCollapse:'collapse'}}>
          <thead>
            {viewUnit === 'week' && <tr>
              <th style={{minWidth:180,position:'sticky',left:0,background:'var(--white)',zIndex:2}} />
              {monthHeaders.map((m,i)=><th key={i} colSpan={m.span} style={{textAlign:'center',padding:'6px 2px',fontWeight:700,color:'var(--navy)',textTransform:'capitalize',borderBottom:'1px solid var(--lavender)'}}>{m.label}</th>)}
            </tr>}
            <tr>
              <th style={{textAlign:'left',padding:'6px 14px',fontWeight:700,color:'var(--navy)',minWidth:180,position:'sticky',left:0,background:'var(--white)',zIndex:2}}>Collaborateur</th>
              {columns.map((col,i)=>(
                <th key={i} style={{textAlign:'center',padding:'4px 2px',minWidth:viewUnit==='week'?45:80,fontWeight:col.isCurrent?800:600,color:col.isCurrent?'var(--pink)':'var(--muted)',background:col.isCurrent?'rgba(255,50,133,0.05)':'transparent',textTransform:'capitalize'}}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assignedCollabs.map(c => {
              const isSelected = selectedCollab === c.id;
              const myAssignments = isSelected ? getCollabAssignments(c.id) : [];
              return <React.Fragment key={c.id}>
                <tr style={{borderBottom:isSelected?'none':'1px solid var(--lavender)',background:isSelected?'rgba(255,50,133,0.04)':'transparent',cursor:'pointer'}} onClick={()=>setSelectedCollab(isSelected?null:c.id)}>
                  <td style={{padding:'8px 14px',position:'sticky',left:0,background:isSelected?'rgba(255,50,133,0.06)':'var(--white)',zIndex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={24} />
                      <div>
                        <div style={{fontWeight:700,color:isSelected?'var(--pink)':'var(--navy)',fontSize:'0.75rem'}}>{c.prenom} {c.nom[0]}.</div>
                        <div style={{fontSize:'0.6rem',color:'var(--muted)'}}>{c.poste}</div>
                      </div>
                      {isSelected && <span style={{fontSize:'0.55rem',color:'var(--pink)',fontWeight:700}}>▼</span>}
                    </div>
                  </td>
                  {columns.map((col,ci) => {
                    const colMissions = (allMissions||missions).filter(m => {
                      if (!m.date_debut || !m.date_fin) return false;
                      return (m.assignments||[]).some(a => a.collaborateur_id === c.id && a.statut === 'actif') && m.date_debut <= col.end && m.date_fin >= col.start;
                    });
                    return <td key={ci} style={{padding:1,background:col.isCurrent?'rgba(255,50,133,0.03)':'transparent'}}>
                      {colMissions.length > 0 ? (
                        <div style={{display:'flex',flexDirection:'column',gap:1}}>
                          {colMissions.map(m => {
                            const a = (m.assignments||[]).find(x=>x.collaborateur_id===c.id);
                            const taux = a?.taux_staffing || 0;
                            const colorIdx = missions.indexOf(m) % MISSION_COLORS.length;
                            return <div key={m.id} title={`${m.nom} — ${m.clients?.nom||m.client||''} (${taux}%)`} style={{background:MISSION_COLORS[colorIdx],color:'white',borderRadius:3,padding:'2px 3px',fontSize:'0.55rem',fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',opacity:0.85}}>{taux}%</div>;
                          })}
                        </div>
                      ) : <div style={{height:20}} />}
                    </td>;
                  })}
                </tr>
                {/* Sous-lignes inline : détail missions du collab */}
                {isSelected && myAssignments.map(a => {
                  const colorIdx = missions.indexOf(a.mission) % MISSION_COLORS.length;
                  const mColor = MISSION_COLORS[colorIdx >= 0 ? colorIdx : 0];
                  return <tr key={a.id} style={{background:'rgba(255,50,133,0.02)',borderBottom:'1px solid var(--lavender)'}}>
                    <td style={{padding:'4px 14px 4px 46px',position:'sticky',left:0,background:'rgba(255,50,133,0.03)',zIndex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <div style={{width:8,height:8,borderRadius:2,background:mColor,flexShrink:0}} />
                        <div style={{fontSize:'0.68rem'}}>
                          <span style={{fontWeight:700,color:'var(--navy)'}}>{a.mission.nom}</span>
                          <span style={{color:'var(--muted)'}}> · {a.mission.clients?.nom || '—'} · {a.role||'—'} · </span>
                          <span style={{fontWeight:700,color:mColor}}>{a.taux_staffing}%</span>
                          <span style={{color:'var(--muted)'}}> · {fmtDate(a.date_debut)} → {fmtDate(a.date_fin)}</span>
                        </div>
                      </div>
                    </td>
                    {columns.map((col,ci) => {
                      const isActive = a.mission.date_debut && a.mission.date_fin && a.mission.date_debut <= col.end && a.mission.date_fin >= col.start;
                      return <td key={ci} style={{padding:1,background:col.isCurrent?'rgba(255,50,133,0.03)':'transparent'}}>
                        {isActive ? <div style={{background:mColor,opacity:0.3,borderRadius:2,height:10,margin:'0 1px'}} /> : <div style={{height:10}} />}
                      </td>;
                    })}
                  </tr>;
                })}
              </React.Fragment>;
            })}
            {nonStaffedCount > 0 && (
              <tr><td colSpan={colCount} style={{padding:'8px 14px',fontSize:'0.75rem',color:'var(--muted)',fontStyle:'italic'}}>
                + {nonStaffedCount} collaborateurs non staffés
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Finance par client — utilise la période globale */
function FinanceByClient({ clients, missions, isMissionActive, getClientName, periodStart, periodEnd }) {
  const activeMissions = missions.filter(isMissionActive);

  const clientData = clients.map(c => {
    const cMissions = activeMissions.filter(m => m.client_id === c.id);
    const budget = cMissions.reduce((s,m) => s+(m.budget_vendu||0), 0);
    const caMonth = cMissions.reduce((s,m) => s + (m.assignments||[]).reduce((s2,a) => {
      if (!a.tjm) return s2;
      return s2 + (a.tjm * (a.jours_par_semaine || a.taux_staffing/100*5) * 4.33);
    }, 0), 0);
    const nbCollabs = new Set(cMissions.flatMap(m => (m.assignments||[]).filter(a=>a.statut==='actif').map(a=>a.collaborateur_id))).size;
    return { client: c, missions: cMissions, budget, caMonth, nbCollabs };
  }).filter(d => d.missions.length > 0).sort((a,b) => b.caMonth - a.caMonth);

  const totalCA = clientData.reduce((s,d) => s+d.caMonth, 0);

  const [expandedClient, setExpandedClient] = useState(null);

  return (
    <div>
      <div className="section-title">CA par client</div>
      <div style={{fontSize:'0.82rem',color:'var(--muted)',marginBottom:12}}>CA mensuel estimé total : <strong style={{color:'var(--navy)',fontSize:'1rem'}}>{Math.round(totalCA).toLocaleString('fr-FR')} €</strong> · {activeMissions.length} missions sur la période</div>
      <div className="card" style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Client</th><th>Missions</th><th>Collabs</th><th>Budget total</th><th>CA mensuel est.</th><th></th></tr></thead>
          <tbody>{clientData.map(d => (
            <React.Fragment key={d.client.id}>
              <tr style={{cursor:'pointer',background:expandedClient===d.client.id?'var(--offwhite)':'transparent'}} onClick={()=>setExpandedClient(expandedClient===d.client.id?null:d.client.id)}>
                <td style={{fontWeight:700,color:'var(--navy)'}}>{d.client.nom}</td>
                <td>{d.missions.length}</td>
                <td>{d.nbCollabs}</td>
                <td style={{fontWeight:600}}>{d.budget ? d.budget.toLocaleString('fr-FR')+' €' : '—'}</td>
                <td style={{fontWeight:700,color:'var(--blue)'}}>{Math.round(d.caMonth).toLocaleString('fr-FR')} €</td>
                <td style={{color:'var(--muted)'}}>{expandedClient===d.client.id ? '▲' : '▼'}</td>
              </tr>
              {expandedClient===d.client.id && d.missions.map(m => (
                <tr key={m.id} style={{background:'var(--offwhite)',fontSize:'0.82rem'}}>
                  <td style={{paddingLeft:32,color:'var(--muted)'}}>{m.nom}</td>
                  <td>{(m.assignments||[]).filter(a=>a.statut==='actif').length}</td>
                  <td></td>
                  <td style={{color:'var(--muted)'}}>{m.budget_vendu ? m.budget_vendu.toLocaleString('fr-FR')+' €' : '—'}</td>
                  <td style={{color:'var(--muted)'}}>{Math.round((m.assignments||[]).reduce((s,a)=>s+((a.tjm||0)*(a.jours_par_semaine||a.taux_staffing/100*5)*4.33),0)).toLocaleString('fr-FR')} €</td>
                  <td></td>
                </tr>
              ))}
            </React.Fragment>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
