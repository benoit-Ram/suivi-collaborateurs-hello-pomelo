import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../../services/DataContext';
import { useAuth } from '../../services/AuthContext';
import { api } from '../../services/api';
import { PageHeader, Badge, Avatar, Modal, FadeIn, Skeleton, fmtDate } from '../../components/UI';

// Helpers
const calcConsumedBudget = (assignments, now) => (assignments || []).reduce((s, a) => {
  if (!a.date_debut || !a.tjm) return s;
  const start = new Date(a.date_debut);
  const end = a.date_fin ? new Date(Math.min(new Date(a.date_fin), now)) : now;
  const weeks = Math.max(0, (end - start) / (7 * 86400000));
  return s + (a.tjm * (a.jours_par_semaine || a.taux_staffing / 100 * 5) * weeks);
}, 0);

const calcMonthlyCA = (assignments) => (assignments || []).filter(a => a.statut === 'actif').reduce((s, a) => s + ((a.tjm || 0) * (a.jours_par_semaine || a.taux_staffing / 100 * 5) * 4.33), 0);

const fmtEuro = (v) => v ? v.toLocaleString('fr-FR') + ' €' : '—';
const tauxFromJPS = (jps) => Math.round(jps / 5 * 100);

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
  const [calGroupBy, setCalGroupBy] = useState('collab');
  const [calDisplayMode, setCalDisplayMode] = useState('pct');
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
  const [periodType, setPeriodType] = useState(''); // '', 'week', 'month', 'q', 'year'

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
      const row = { ...form, client: clientObj?.nom || '', budget_vendu: form.budget_vendu ? parseFloat(form.budget_vendu) : null, responsable_id: form.responsable_id || null, lien_propale: form.lien_propale || null, description: form.description || null, categorie: form.categorie || null, date_debut: form.date_debut || null, date_fin: form.date_fin || null };
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
      // Clean empty strings to null for optional/FK fields
      const cleaned = {};
      Object.entries(clientForm).forEach(([k, v]) => { cleaned[k] = (v === '' && k !== 'nom') ? null : v; });
      if (clientModal === 'create') {
        await api.createClient(cleaned);
        showToast('Client créé ✓');
      } else {
        await api.updateClient(clientModal.id, cleaned);
        showToast('Client mis à jour ✓');
      }
      setClientModal(null);
      loadData();
    } catch(e) { showToast('Erreur: ' + e.message); }
  };

  const deleteClient = async (id) => {
    const clientMissions = missions.filter(m => m.client_id === id);
    if (clientMissions.length > 0) { showToast('Impossible : ce client a des missions actives'); return; }
    if (!window.confirm('Supprimer ce client ?')) return;
    try { await api.deleteClient(id); loadData(); showToast('Client supprimé'); } catch(e) { showToast('Erreur: ' + e.message); }
  };

  const deleteMission = async (id) => {
    if (!window.confirm('Supprimer cette mission et toutes ses affectations ?')) return;
    try { await api.deleteMission(id); loadData(); showToast('Mission supprimée'); } catch(e) { showToast('Erreur: ' + e.message); }
  };

  const saveAssignment = async () => {
    if (!assignForm.collaborateur_id) { showToast('Sélectionnez un collaborateur'); return; }
    if (!assignForm.role) { showToast('Sélectionnez un rôle'); return; }
    if (!assignForm.tjm) { showToast('Le TJM est obligatoire'); return; }
    try {
      const jps = parseFloat(assignForm.jours_par_semaine) || 5;
      const taux = tauxFromJPS(jps);
      await api.createAssignment({ ...assignForm, mission_id: assignModal, taux_staffing: taux, jours_par_semaine: jps, tjm: assignForm.tjm ? parseFloat(assignForm.tjm) : null, date_debut: assignForm.date_debut||null, date_fin: assignForm.date_fin||null });
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

  const searchSiren = (q) => {
    if (!q) return;
    fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&page=1&per_page=5`)
      .then(r => r.json())
      .then(d => {
        const results = d.results || [];
        const applySiren = (r) => setClientForm(f => ({...f, nom:r.nom_raison_sociale||r.nom_complet||'', siren:r.siren||'', siret:r.siege?.siret||'', tva_intra:r.siren?`FR${(12+3*(parseInt(r.siren)%97))%97}${r.siren}`:'', adresse:r.siege?.geo_adresse||'', code_postal:r.siege?.code_postal||'', ville:r.siege?.libelle_commune||'', categorie_entreprise:r.categorie_entreprise||'', secteur:''}));
        if (results.length === 1) { applySiren(results[0]); setSirenResults([]); showToast('Entreprise trouvée !'); }
        else if (results.length > 1) { setSirenResults(results); }
        else { showToast('Aucun résultat'); setSirenResults([]); }
      })
      .catch(() => showToast('Erreur de recherche'));
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
  const caPrevu = active.reduce((s, m) => s + calcMonthlyCA(m.assignments), 0);
  const budgetTotal = missions.reduce((s, m) => s + (m.budget_vendu || 0), 0);
  const budgetConsomme = missions.reduce((s, m) => s + calcConsumedBudget(m.assignments, now), 0);
  const staffingMoyen = collabs.length ? Math.round(Object.values(staffingMap).reduce((s,v) => s+v.taux, 0) / collabs.length) : 0;

  // Alerts
  const alerts = [];
  active.forEach(m => {
    if (m.date_fin) {
      const daysLeft = Math.ceil((new Date(m.date_fin) - now) / 86400000);
      if (daysLeft >= 0 && daysLeft <= 30) alerts.push({ icon:'⏰', text:`${m.nom} termine dans ${daysLeft}j`, type:'warning' });
    }
    if (m.budget_vendu) {
      const consumed = calcConsumedBudget(m.assignments, now);
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

      {/* Global period filter with arrows */}
      {(()=>{
        const dateStyle = {border:'1.5px solid var(--lavender)',borderRadius:8,padding:'5px 8px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)',color:'var(--navy)'};
        const btnStyle = (active) => ({padding:'3px 8px',fontSize:'0.68rem',background:active?'var(--pink)':'transparent',color:active?'white':'var(--muted)'});
        const arrowStyle = {padding:'3px 6px',fontSize:'0.75rem',lineHeight:1};

        const setPeriod = (type, refDate) => {
          const d = refDate || new Date();
          const y = d.getFullYear(), m = d.getMonth();
          setPeriodType(type);
          if (!type) { setMissionDateDebut(''); setMissionDateFin(''); }
          else if (type==='week') { const mon=new Date(d); mon.setDate(d.getDate()-((d.getDay()+6)%7)); const fri=new Date(mon); fri.setDate(mon.getDate()+4); setMissionDateDebut(mon.toISOString().split('T')[0]); setMissionDateFin(fri.toISOString().split('T')[0]); }
          else if (type==='month') { setMissionDateDebut(`${y}-${String(m+1).padStart(2,'0')}-01`); setMissionDateFin(new Date(y,m+1,0).toISOString().split('T')[0]); }
          else if (type==='q') { const qs=Math.floor(m/3)*3; setMissionDateDebut(`${y}-${String(qs+1).padStart(2,'0')}-01`); setMissionDateFin(new Date(y,qs+3,0).toISOString().split('T')[0]); }
          else if (type==='year') { setMissionDateDebut(`${y}-01-01`); setMissionDateFin(`${y}-12-31`); }
        };

        const shiftPeriod = (dir) => {
          if (!missionDateDebut || !periodType) return;
          const base = new Date(missionDateDebut);
          if (periodType==='week') base.setDate(base.getDate() + dir*7);
          else if (periodType==='month') base.setMonth(base.getMonth() + dir);
          else if (periodType==='q') base.setMonth(base.getMonth() + dir*3);
          else if (periodType==='year') base.setFullYear(base.getFullYear() + dir);
          setPeriod(periodType, base);
        };

        return <div className="period-filter" style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <div className="period-dates" style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
            <span className="hide-mobile" style={{fontSize:'0.78rem',fontWeight:700,color:'var(--muted)'}}>Période :</span>
            {periodType && <button className="btn btn-ghost btn-sm" style={arrowStyle} onClick={()=>shiftPeriod(-1)}>←</button>}
            <input type="date" value={missionDateDebut} onChange={e=>{setMissionDateDebut(e.target.value);setPeriodType('');}} style={dateStyle} />
            <span style={{color:'var(--muted)',fontSize:'0.75rem'}}>→</span>
            <input type="date" value={missionDateFin} onChange={e=>{setMissionDateFin(e.target.value);setPeriodType('');}} style={dateStyle} />
            {periodType && <button className="btn btn-ghost btn-sm" style={arrowStyle} onClick={()=>shiftPeriod(1)}>→</button>}
          </div>
          <div className="period-presets" style={{display:'flex',gap:3,flexWrap:'wrap'}}>
            {[['','Tout'],['week','Sem.'],['month','Mois'],['q','Trim.'],['year','Année']].map(([k,l])=>(
              <button key={k} onClick={()=>setPeriod(k)} className="btn btn-ghost btn-sm" style={btnStyle(periodType===k)}>{l}</button>
            ))}
          </div>
        </div>;
      })()}

      <div className="tabs-scroll" style={{display:'flex',gap:6,marginBottom:24,background:'var(--offwhite)',padding:6,borderRadius:12,overflowX:'auto'}}>
        {[['missions',`🏢 Clients & Missions`],['timeline','📅 Calendrier'],['staffing','📊 Staffing'],['dispo','👤 Disponibilités'],['finance','💰 Finance']].map(([k,l])=>(
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
        const selectStyle = {border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 10px',fontFamily:'inherit',fontSize:'0.78rem',background:'var(--offwhite)',color:'var(--navy)'};
        const toggleBtnStyle = (active) => ({padding:'4px 10px',fontSize:'0.7rem',fontWeight:700,background:active?'var(--pink)':'transparent',color:active?'white':'var(--muted)',border:'none',borderRadius:6,cursor:'pointer',fontFamily:'inherit'});
        return <FadeIn><div>
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <select value={calGroupBy} onChange={e=>setCalGroupBy(e.target.value)} style={selectStyle}>
            <optgroup label="Afficher par">
              <option value="collab">👤 Collaborateur</option>
              <option value="client">🏢 Client</option>
              <option value="mission">🚀 Mission</option>
              <option value="bureau">📍 Bureau</option>
              <option value="equipe">🏷️ Equipe</option>
            </optgroup>
          </select>
          <select value={calDisplayMode} onChange={e=>setCalDisplayMode(e.target.value)} style={selectStyle}>
            <optgroup label="Valeurs">
              <option value="pct">% Occupation</option>
              <option value="jours">Jours occupés</option>
              <option value="dispo">Jours disponibles</option>
            </optgroup>
          </select>
          <select value={filterClient} onChange={e=>setFilterClient(e.target.value)} style={selectStyle}>
            <option value="">Tous les clients</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select value={filterBureau} onChange={e=>setFilterBureau(e.target.value)} style={selectStyle}>
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
          <TimelineView missions={filterClient ? active.filter(m=>m.client_id===filterClient) : active} collabs={filteredCollabs} staffingMap={staffingMap} allMissions={active} clients={clients} groupBy={calGroupBy} displayMode={calDisplayMode} onUpdateAssignment={async(id,data)=>{try{await api.updateAssignment(id,data);await loadData();showToast('Staffing mis à jour');}catch(e){showToast('Erreur: '+e.message);}}} />
        </div>
      </div></FadeIn>})()}

      {/* STAFFING */}
      {tab==='staffing' && (()=>{
        const allEquipes = [...new Set(collabs.flatMap(c=>(c.equipe||'').split(',').map(s=>s.trim())).filter(Boolean))].sort();
        const toggleEquipe = (eq) => setFilterEquipes(prev => prev.includes(eq) ? prev.filter(e=>e!==eq) : [...prev, eq]);
        // Calculate total staffed days per collab over the period
        const calcStaffedDays = (collabId) => {
          return active.reduce((total, m) => {
            const a = (m.assignments||[]).find(x => x.collaborateur_id === collabId && x.statut === 'actif');
            if (!a || !a.date_debut) return total;
            const start = new Date(Math.max(new Date(a.date_debut), new Date(periodStart)));
            const end = a.date_fin ? new Date(Math.min(new Date(a.date_fin), new Date(periodEnd))) : new Date(periodEnd);
            if (end < start) return total;
            const weeks = Math.max(0, (end - start) / (7 * 86400000));
            return total + (a.taux_staffing || 0) / 100 * 5 * weeks;
          }, 0);
        };
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
          <thead><tr><th>Collaborateur</th><th>Poste</th><th>Taux staffing</th><th>Jours/sem.</th><th>Jours staffés</th><th>Missions</th></tr></thead>
          <tbody>{filteredStaffing.sort((a,b)=>b.taux-a.taux).map(({collab:c,taux,missions:ms})=>{
            const totalDays = Math.round(calcStaffedDays(c.id)*10)/10;
            return <tr key={c.id}>
              <td><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={28} /><span style={{fontWeight:700,color:'var(--navy)'}}>{c.prenom} {c.nom}</span></div></td>
              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{c.poste||'—'}</td>
              <td><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:80,height:8,background:'var(--offwhite)',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(taux,100)}%`,background:taux>100?'var(--red)':taux>=80?'var(--orange)':'var(--green)',borderRadius:4}} /></div><span style={{fontWeight:700,fontSize:'0.85rem',color:taux>100?'var(--red)':taux>=80?'var(--orange)':'var(--green)'}}>{taux}%</span></div></td>
              <td style={{fontWeight:600,color:'var(--navy)'}}>{(taux/100*5).toFixed(1)}j</td>
              <td style={{fontWeight:700,color:totalDays>0?'var(--blue)':'var(--muted)'}}>{totalDays}j</td>
              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{ms.length===0?'Non staffé':ms.map(m=>`${m.nom} (${m.taux}%)`).join(', ')}</td>
            </tr>;
          })}</tbody>
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
        <FinanceByClient clients={clients} missions={missions} isMissionActive={isMissionActive} />
      </div></FadeIn>}

      {/* DISPONIBILITÉS / INTER-CONTRAT */}
      {tab==='dispo' && (()=>{
        const allEquipes = [...new Set(collabs.flatMap(c=>(c.equipe||'').split(',').map(s=>s.trim())).filter(Boolean))].sort();
        const allBureaux = [...new Set(collabs.map(c=>c.bureau).filter(Boolean))].sort();
        const allCompetences = [...new Set(collabs.flatMap(c=>c.competences||[]))].sort();
        const [filterComp, setFilterComp] = useState('');
        const [filterEq, setFilterEq] = useState('');
        const [filterBur, setFilterBur] = useState('');
        const [showAll, setShowAll] = useState(false);
        const selectStyle = {border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 10px',fontFamily:'inherit',fontSize:'0.78rem',background:'var(--offwhite)',color:'var(--navy)'};

        // Calculate availability per collab
        const dispoData = collabs.map(c => {
          const taux = staffingMap[c.id]?.taux || 0;
          const dispo = Math.max(0, 100 - taux);
          const joursDispo = dispo / 100 * 5;
          return { collab: c, taux, dispo, joursDispo, missions: staffingMap[c.id]?.missions || [] };
        }).filter(d => {
          if (!showAll && d.dispo === 0) return false;
          if (filterEq && !(d.collab.equipe||'').includes(filterEq)) return false;
          if (filterBur && d.collab.bureau !== filterBur) return false;
          if (filterComp && !(d.collab.competences||[]).includes(filterComp)) return false;
          return true;
        }).sort((a,b) => b.dispo - a.dispo);

        const totalDispo = dispoData.reduce((s,d) => s + d.joursDispo, 0);
        const interContrat = dispoData.filter(d => d.dispo === 100);

        return <FadeIn><div>
        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
          <div className="stat-card" style={{borderColor:'var(--orange)'}}>
            <div className="stat-num" style={{fontSize:'clamp(1.4rem,5vw,2rem)',fontWeight:700,color:'var(--orange)',lineHeight:1}}>{interContrat.length}</div>
            <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Inter-contrat</div>
          </div>
          <div className="stat-card" style={{borderColor:'var(--blue)'}}>
            <div className="stat-num" style={{fontSize:'clamp(1.4rem,5vw,2rem)',fontWeight:700,color:'var(--blue)',lineHeight:1}}>{Math.round(totalDispo*10)/10}j</div>
            <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Jours dispo / sem.</div>
          </div>
          <div className="stat-card" style={{borderColor:'var(--green)'}}>
            <div className="stat-num" style={{fontSize:'clamp(1.4rem,5vw,2rem)',fontWeight:700,color:'var(--green)',lineHeight:1}}>{dispoData.filter(d=>d.dispo>0&&d.dispo<100).length}</div>
            <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Partiellement dispo</div>
          </div>
        </div>
        {/* Filtres */}
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <select value={filterComp} onChange={e=>setFilterComp(e.target.value)} style={selectStyle}>
            <option value="">Toutes compétences</option>
            {allCompetences.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterEq} onChange={e=>setFilterEq(e.target.value)} style={selectStyle}>
            <option value="">Toutes équipes</option>
            {allEquipes.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filterBur} onChange={e=>setFilterBur(e.target.value)} style={selectStyle}>
            <option value="">Tous bureaux</option>
            {allBureaux.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'0.78rem',fontWeight:600,color:'var(--muted)',cursor:'pointer'}}>
            <input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)} style={{accentColor:'var(--pink)'}} />
            Inclure staffés 100%
          </label>
        </div>
        {/* Table */}
        <div className="card" style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Collaborateur</th><th>Poste</th><th>Équipe</th><th>Bureau</th><th>Compétences</th><th>Staffing</th><th>Dispo</th><th>Jours dispo</th></tr></thead>
          <tbody>{dispoData.map(({collab:c,taux,dispo,joursDispo,missions:ms})=>(
            <tr key={c.id} style={{background:dispo===100?'rgba(249,115,22,0.05)':dispo>0?'rgba(34,197,94,0.04)':'transparent'}}>
              <td><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={28} /><span style={{fontWeight:700,color:'var(--navy)'}}>{c.prenom} {c.nom}</span></div></td>
              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{c.poste||'—'}</td>
              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{c.equipe||'—'}</td>
              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{c.bureau||'—'}</td>
              <td><div style={{display:'flex',gap:3,flexWrap:'wrap'}}>{(c.competences||[]).map(comp=><span key={comp} style={{padding:'2px 6px',borderRadius:4,fontSize:'0.6rem',fontWeight:700,background:'var(--bg-info)',color:'var(--text-info)'}}>{comp}</span>)}</div></td>
              <td><span style={{fontWeight:700,fontSize:'0.82rem',color:taux>100?'var(--red)':taux>=80?'var(--orange)':'var(--green)'}}>{taux}%</span></td>
              <td><span style={{fontWeight:700,fontSize:'0.82rem',color:dispo===100?'var(--orange)':dispo>0?'var(--green)':'var(--muted)'}}>{dispo}%</span></td>
              <td style={{fontWeight:700,color:joursDispo>0?'var(--blue)':'var(--muted)'}}>{joursDispo.toFixed(1)}j</td>
            </tr>
          ))}</tbody>
        </table>
        </div>
      </div></FadeIn>;
      })()}

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
      <Modal open={!!detail} onClose={()=>setDetail(null)} title={detail?`${detail.nom} — ${getClientName(detail)}`:''} size="xl">
        {detail && (()=>{
          const team = (detail.assignments||[]).filter(a=>a.statut==='actif');
          const calcCA = (a) => calcConsumedBudget([a], new Date());
          const calcCAMensuel = (a) => calcMonthlyCA([{...a, statut:'actif'}]);
          const totalCA = team.reduce((s,a)=>s+calcCA(a),0);
          const totalCAMensuel = team.reduce((s,a)=>s+calcCAMensuel(a),0);
          const totalJours = team.reduce((s,a)=>s+(a.jours_par_semaine||a.taux_staffing/100*5),0);
          const budgetPct = detail.budget_vendu > 0 ? Math.round(totalCA/detail.budget_vendu*100) : null;

          const saveDetail = async () => {
            try {
              const clientObj = clients.find(c=>c.id===detailForm.client_id);
              const row = { ...detailForm, client: clientObj?.nom||'', budget_vendu: detailForm.budget_vendu ? parseFloat(detailForm.budget_vendu) : null, responsable_id: detailForm.responsable_id||null, lien_propale: detailForm.lien_propale||null, description: detailForm.description||null, categorie: detailForm.categorie||null, date_debut: detailForm.date_debut||null, date_fin: detailForm.date_fin||null };
              await api.updateMission(detail.id, row);
              const [newMissions] = await Promise.all([api.getMissions(), loadData()]);
              const updated = (newMissions||[]).find(m=>m.id===detail.id);
              if (updated) setDetail(updated);
              showToast('Mission mise à jour');
            } catch(e) { showToast('Erreur: '+e.message); }
          };

          const addAssignInline = async () => {
            if (!detailAssignForm.collaborateur_id || !detailAssignForm.role || !detailAssignForm.tjm) { showToast('Collaborateur, rôle et TJM requis'); return; }
            try {
              const jps = parseFloat(detailAssignForm.jours_par_semaine)||5;
              await api.createAssignment({ ...detailAssignForm, mission_id: detail.id, tjm: parseFloat(detailAssignForm.tjm), taux_staffing: tauxFromJPS(jps), jours_par_semaine: jps, statut:'actif', date_debut: detailAssignForm.date_debut||null, date_fin: detailAssignForm.date_fin||null });
              const [newMissions] = await Promise.all([api.getMissions(), loadData()]);
              const updated = (newMissions||[]).find(m=>m.id===detail.id);
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
            <input id="siren-search" placeholder="SIREN ou nom d'entreprise..." style={{flex:1,border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.85rem'}} onKeyDown={e=>{if(e.key==='Enter') searchSiren(e.target.value.trim());}} />
            <button className="btn btn-ghost btn-sm" onClick={()=>searchSiren(document.getElementById('siren-search')?.value?.trim())}>Rechercher</button>
          </div>
          {sirenResults.length > 1 && <div style={{marginTop:8,maxHeight:200,overflowY:'auto',border:'1px solid var(--lavender)',borderRadius:8}}>
            <div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--navy)',padding:'8px 10px',borderBottom:'1px solid var(--lavender)'}}>Plusieurs résultats — choisissez :</div>
            {sirenResults.map((r,i)=>(
              <div key={i} style={{padding:'8px 10px',borderBottom:'1px solid var(--lavender)',cursor:'pointer',fontSize:'0.78rem',transition:'background 0.1s'}}
                onMouseOver={e=>e.currentTarget.style.background='var(--offwhite)'} onMouseOut={e=>e.currentTarget.style.background=''}
                onClick={()=>{setClientForm(f=>({...f,nom:r.nom_raison_sociale||r.nom_complet||'',siren:r.siren||'',siret:r.siege?.siret||'',tva_intra:r.siren?`FR${(12+3*(parseInt(r.siren)%97))%97}${r.siren}`:'',adresse:r.siege?.geo_adresse||'',code_postal:r.siege?.code_postal||'',ville:r.siege?.libelle_commune||'',categorie_entreprise:r.categorie_entreprise||'',secteur:''}));setSirenResults([]);showToast('Entreprise sélectionnée !');}}>
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
  const consumed = calcConsumedBudget(m.assignments, new Date());
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

/** Vue timeline Gantt — configurable par groupBy, displayMode, viewUnit */
function TimelineView({ missions, collabs, staffingMap, allMissions, clients, groupBy, displayMode, onUpdateAssignment }) {
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState(new Set());
  const [expandedSub, setExpandedSub] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null); // {assignmentId, colIdx}
  const [editValue, setEditValue] = useState('');
  const [viewUnit, setViewUnit] = useState('week');
  const toggleSub = (id) => setExpandedSub(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const DAYS = 10; const WEEKS = 16; const MONTHS_COUNT = 6;
  const COLORS = ['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#6366F1'];
  const now = new Date(); const todayStr = now.toISOString().split('T')[0];
  const toggleRow = (id) => setExpanded(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

  // Week key helper: "2026-W14" format
  const getWeekKey = (d) => { const wn = Math.ceil(((d - new Date(d.getFullYear(),0,1))/86400000+1)/7); return `${d.getFullYear()}-W${String(wn).padStart(2,'0')}`; };
  const getMonthKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

  // Resolve taux for an assignment in a column (overrides > default)
  const getAssignmentTaux = (a, col) => {
    const overrides = a.staffing_overrides || {};
    // Try week key first, then month key
    const colDate = new Date(col.start);
    const wk = getWeekKey(colDate);
    const mk = getMonthKey(colDate);
    if (overrides[wk] !== undefined) return overrides[wk];
    if (viewUnit === 'month' && overrides[mk] !== undefined) return overrides[mk];
    // Day view: use week key
    if (viewUnit === 'day') { if (overrides[wk] !== undefined) return overrides[wk]; }
    return a.taux_staffing || 0;
  };

  // Build columns
  const columns = viewUnit === 'day'
    ? Array.from({length:DAYS},(_,i) => {
        const d = new Date(now); d.setDate(now.getDate() - ((now.getDay()+6)%7) + offset*7 + Math.floor(i/5)*7 + (i%5));
        d.setHours(0,0,0,0);
        const ds = d.toISOString().split('T')[0];
        return { label:d.toLocaleDateString('fr-FR',{weekday:'short'})+' '+d.getDate(), start:ds, end:ds, isCurrent:ds===todayStr, month:d.toLocaleDateString('fr-FR',{month:'short'}), year:d.getFullYear(), periodKey:getWeekKey(d) };
      })
    : viewUnit === 'week'
    ? Array.from({length:WEEKS},(_,i) => {
        const sm = new Date(now); sm.setDate(now.getDate()-((now.getDay()+6)%7)+offset*WEEKS+i*7); sm.setHours(0,0,0,0);
        const wn = Math.ceil(((sm - new Date(sm.getFullYear(),0,1))/86400000+1)/7);
        const end = new Date(sm.getTime()+4*86400000);
        return { label:`S${wn}`, start:sm.toISOString().split('T')[0], end:end.toISOString().split('T')[0], month:sm.toLocaleDateString('fr-FR',{month:'short'}), year:sm.getFullYear(), isCurrent:todayStr>=sm.toISOString().split('T')[0]&&todayStr<=end.toISOString().split('T')[0], periodKey:`${sm.getFullYear()}-W${String(wn).padStart(2,'0')}` };
      })
    : Array.from({length:MONTHS_COUNT},(_,i) => {
        const d = new Date(now.getFullYear(),now.getMonth()+offset*MONTHS_COUNT+i,1);
        const endD = new Date(d.getFullYear(),d.getMonth()+1,0);
        return { label:d.toLocaleDateString('fr-FR',{month:'short',year:'numeric'}), start:d.toISOString().split('T')[0], end:endD.toISOString().split('T')[0], isCurrent:d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(), periodKey:getMonthKey(d) };
      });

  // Month headers for week/day views
  const monthHeaders = [];
  if (viewUnit === 'week' || viewUnit === 'day') {
    let lastKey = '';
    columns.forEach((col,i) => {
      const key = (col.month||'') + ' ' + (col.year||'');
      if (key !== lastKey) { monthHeaders.push({label:key,start:i,span:1}); lastKey = key; }
      else monthHeaders[monthHeaders.length-1].span++;
    });
  }

  const navLabels = { day:'1 sem.', week:`${WEEKS} sem.`, month:`${MONTHS_COUNT} mois` };
  const colCount = columns.length + 1;
  const minW = viewUnit==='day'?55:viewUnit==='week'?45:80;

  // Helper: get taux for a collab in a column period (respects overrides)
  const getCollabTaux = (collabId, col) => {
    return (allMissions||missions).reduce((total, m) => {
      if (!m.date_debut || !m.date_fin || m.date_debut > col.end || m.date_fin < col.start) return total;
      const a = (m.assignments||[]).find(x => x.collaborateur_id === collabId && x.statut === 'actif');
      return total + (a ? getAssignmentTaux(a, col) : 0);
    }, 0);
  };

  // Format cell value — adapt days to period: 1j/day, 5j/week, ~21.7j/month
  const daysPerPeriod = viewUnit === 'day' ? 1 : viewUnit === 'month' ? 21.67 : 5;
  const fmtCell = (taux) => {
    if (taux === 0) return null;
    if (displayMode === 'jours') return `${(taux/100*daysPerPeriod).toFixed(1)}j`;
    if (displayMode === 'dispo') return `${((100-taux)/100*daysPerPeriod).toFixed(1)}j`;
    return `${taux}%`;
  };
  const cellColor = (taux) => taux > 100 ? 'var(--red)' : taux >= 80 ? 'var(--blue)' : taux > 0 ? 'var(--green)' : 'transparent';
  const cellBg = (taux) => taux > 100 ? 'rgba(255,50,50,0.15)' : taux >= 80 ? 'rgba(59,130,246,0.12)' : taux > 0 ? 'rgba(16,185,129,0.1)' : 'transparent';

  // Build rows based on groupBy
  const getCollabAssignments = (cid) => (allMissions||missions).flatMap(m => (m.assignments||[]).filter(a => a.collaborateur_id === cid && a.statut === 'actif').map(a => ({...a, mission: m})));

  const rows = (() => {
    switch (groupBy) {
      case 'client': return (clients||[]).filter(c => missions.some(m => m.client_id === c.id)).map(c => ({
        id:c.id, label:c.nom, sub:c.secteur||'', subRows: missions.filter(m => m.client_id === c.id).map(m => ({
          id:m.id, label:m.nom, sub:m.categorie||'', missionRef:m,
          assignmentRows: (m.assignments||[]).filter(a=>a.statut==='actif').map(a => { const collab=collabs.find(x=>x.id===a.collaborateur_id); return {
            id:a.id, assignmentId:a.id, label:collab?collab.prenom+' '+collab.nom:'—', sub:a.role||'', avatar:collab, taux:a.taux_staffing||0, assignment:a,
            getCellTaux:(col)=>(!m.date_debut||!m.date_fin||m.date_debut>col.end||m.date_fin<col.start)?0:getAssignmentTaux(a,col)
          };}),
          getCellTaux:(col) => (m.assignments||[]).filter(a=>a.statut==='actif').reduce((s,a)=>s+((!m.date_debut||!m.date_fin||m.date_debut>col.end||m.date_fin<col.start)?0:getAssignmentTaux(a,col)),0)
        })),
        getCellTaux:(col) => missions.filter(m=>m.client_id===c.id).reduce((s,m)=>{if(!m.date_debut||!m.date_fin||m.date_debut>col.end||m.date_fin<col.start)return s;return s+(m.assignments||[]).filter(a=>a.statut==='actif').reduce((s2,a)=>s2+getAssignmentTaux(a,col),0);},0)
      }));
      case 'mission': return missions.map(m => ({
        id:m.id, label:m.nom, sub:(m.clients?.nom||m.client||'')+(m.categorie?' · '+m.categorie:''),
        subRows: (m.assignments||[]).filter(a=>a.statut==='actif').map(a => { const c=collabs.find(x=>x.id===a.collaborateur_id); return {
          id:a.id, assignmentId:a.id, label:c?c.prenom+' '+c.nom:'—', sub:a.role||'', avatar:c, taux:a.taux_staffing||0, assignment:a,
          getCellTaux:(col)=>(!m.date_debut||!m.date_fin||m.date_debut>col.end||m.date_fin<col.start)?0:getAssignmentTaux(a,col)
        };}),
        getCellTaux:(col)=>(!m.date_debut||!m.date_fin||m.date_debut>col.end||m.date_fin<col.start)?0:(m.assignments||[]).filter(a=>a.statut==='actif').reduce((s,a)=>s+getAssignmentTaux(a,col),0)
      }));
      case 'bureau': return [...new Set(collabs.map(c=>c.bureau).filter(Boolean))].sort().map(b => {
        const bCollabs = collabs.filter(c=>c.bureau===b);
        return { id:b, label:b, sub:`${bCollabs.length} collabs`,
          subRows: bCollabs.filter(c=>staffingMap[c.id]?.missions?.length>0).map(c=>({
            id:c.id, label:c.prenom+' '+c.nom[0]+'.', sub:c.poste||'', avatar:c,
            getCellTaux:(col)=>getCollabTaux(c.id,col)
          })),
          getCellTaux:(col)=>bCollabs.reduce((s,c)=>s+getCollabTaux(c.id,col),0)/Math.max(bCollabs.length,1)
        };
      });
      case 'equipe': return [...new Set(collabs.flatMap(c=>(c.equipe||'').split(',').map(s=>s.trim())).filter(Boolean))].sort().map(eq => {
        const eqCollabs = collabs.filter(c=>(c.equipe||'').includes(eq));
        return { id:eq, label:eq, sub:`${eqCollabs.length} collabs`,
          subRows: eqCollabs.filter(c=>staffingMap[c.id]?.missions?.length>0).map(c=>({
            id:c.id, label:c.prenom+' '+c.nom[0]+'.', sub:c.poste||'', avatar:c,
            getCellTaux:(col)=>getCollabTaux(c.id,col)
          })),
          getCellTaux:(col)=>eqCollabs.reduce((s,c)=>s+getCollabTaux(c.id,col),0)/Math.max(eqCollabs.length,1)
        };
      });
      default: // collab
        return collabs.filter(c=>staffingMap[c.id]?.missions?.length>0).sort((a,b)=>(staffingMap[b.id]?.taux||0)-(staffingMap[a.id]?.taux||0)).map(c => ({
          id:c.id, label:c.prenom+' '+c.nom[0]+'.', sub:c.poste||'', avatar:c,
          subRows: getCollabAssignments(c.id).map(a=>({
            id:a.id, assignmentId:a.id, label:a.mission.nom, sub:(a.mission.clients?.nom||'—')+' · '+(a.role||'—'), taux:a.taux_staffing||0, assignment:a,
            getCellTaux:(col)=>(a.mission.date_debut&&a.mission.date_fin&&a.mission.date_debut<=col.end&&a.mission.date_fin>=col.start)?getAssignmentTaux(a,col):0
          })),
          getCellTaux:(col)=>getCollabTaux(c.id,col)
        }));
    }
  })();

  const stickyStyle = {position:'sticky',left:0,background:'var(--white)',zIndex:1};

  if (rows.length === 0) return <div style={{padding:32,textAlign:'center',color:'var(--muted)',fontSize:'0.85rem'}}>Aucune donnée à afficher pour cette période</div>;

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 18px',borderBottom:'1px solid var(--lavender)'}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>setOffset(offset-1)}>← {navLabels[viewUnit]}</button>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontWeight:700,color:'var(--navy)'}}>📅 Calendrier</span>
          <div style={{display:'flex',gap:2,background:'var(--offwhite)',borderRadius:8,padding:2}}>
            {[['day','Jour'],['week','Semaine'],['month','Mois']].map(([k,l])=>(
              <button key={k} onClick={()=>{setViewUnit(k);setOffset(0);}} className="btn btn-sm" style={{padding:'3px 10px',fontSize:'0.68rem',fontWeight:700,background:viewUnit===k?'var(--pink)':'transparent',color:viewUnit===k?'white':'var(--muted)',border:'none',borderRadius:6}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:6}}>
          {offset!==0 && <button className="btn btn-ghost btn-sm" onClick={()=>setOffset(0)}>Aujourd'hui</button>}
          <button className="btn btn-ghost btn-sm" onClick={()=>setOffset(offset+1)}>{navLabels[viewUnit]} →</button>
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{fontSize:'0.7rem',width:'100%',borderCollapse:'collapse'}}>
          <thead>
            {(viewUnit==='week'||viewUnit==='day') && <tr>
              <th style={{minWidth:180,...stickyStyle,zIndex:2}} />
              {monthHeaders.map((m,i)=><th key={i} colSpan={m.span} style={{textAlign:'center',padding:'6px 2px',fontWeight:700,color:'var(--navy)',textTransform:'capitalize',borderBottom:'1px solid var(--lavender)'}}>{m.label}</th>)}
            </tr>}
            <tr>
              <th style={{textAlign:'left',padding:'6px 14px',fontWeight:700,color:'var(--navy)',minWidth:180,...stickyStyle,zIndex:2}}>
                {{collab:'Collaborateur',client:'Client',mission:'Mission',bureau:'Bureau',equipe:'Équipe'}[groupBy]}
              </th>
              {columns.map((col,i)=>(
                <th key={i} style={{textAlign:'center',padding:'4px 2px',minWidth:minW,fontWeight:col.isCurrent?800:600,color:col.isCurrent?'var(--pink)':'var(--muted)',background:col.isCurrent?'rgba(255,50,133,0.05)':'transparent',textTransform:'capitalize'}}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isExp = expanded.has(row.id);
              return <React.Fragment key={row.id}>
                <tr style={{borderBottom:isExp?'none':'1px solid var(--lavender)',background:isExp?'rgba(255,50,133,0.04)':'transparent',cursor:'pointer'}} onClick={()=>toggleRow(row.id)}>
                  <td style={{padding:'8px 14px',...stickyStyle,background:isExp?'rgba(255,50,133,0.06)':'var(--white)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {row.avatar && <Avatar prenom={row.avatar.prenom} nom={row.avatar.nom} photoUrl={row.avatar.photo_url} size={24} />}
                      <div>
                        <div style={{fontWeight:700,color:isExp?'var(--pink)':'var(--navy)',fontSize:'0.75rem'}}>
                          <span style={{fontSize:'0.6rem',color:'var(--muted)',marginRight:4}}>{isExp?'▼':'▶'}</span>
                          {row.label}
                        </div>
                        {row.sub && <div style={{fontSize:'0.6rem',color:'var(--muted)'}}>{row.sub}</div>}
                      </div>
                    </div>
                  </td>
                  {columns.map((col,ci) => {
                    const taux = Math.round(row.getCellTaux(col));
                    const val = fmtCell(taux);
                    return <td key={ci} style={{padding:1,background:col.isCurrent?'rgba(255,50,133,0.03)':'transparent',textAlign:'center'}}>
                      {val ? <div style={{background:cellBg(taux),color:cellColor(taux),borderRadius:3,padding:'2px 3px',fontSize:'0.55rem',fontWeight:700}}>{val}</div> : <div style={{height:20}} />}
                    </td>;
                  })}
                </tr>
                {isExp && (row.subRows||[]).map(sr => {
                  const isSubExp = expandedSub.has(sr.id);
                  const hasDetails = sr.assignmentRows && sr.assignmentRows.length > 0;
                  return <React.Fragment key={sr.id}>
                  <tr style={{background:'rgba(255,50,133,0.02)',borderBottom:(isSubExp&&hasDetails)?'none':'1px solid var(--lavender)',cursor:hasDetails?'pointer':'default'}} onClick={()=>hasDetails&&toggleSub(sr.id)}>
                    <td style={{padding:'4px 14px 4px 40px',...stickyStyle,background:'rgba(255,50,133,0.03)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        {hasDetails && <span style={{fontSize:'0.55rem',color:'var(--muted)'}}>{isSubExp?'▼':'▶'}</span>}
                        {sr.avatar && <Avatar prenom={sr.avatar.prenom} nom={sr.avatar.nom} photoUrl={sr.avatar.photo_url} size={20} />}
                        <div style={{fontSize:'0.68rem'}}>
                          <span style={{fontWeight:700,color:'var(--navy)'}}>{sr.label}</span>
                          {sr.sub && <span style={{color:'var(--muted)'}}> · {sr.sub}</span>}
                        </div>
                      </div>
                    </td>
                    {columns.map((col,ci) => {
                      const taux = Math.round(sr.getCellTaux(col));
                      const val = fmtCell(taux);
                      const canEdit = sr.assignmentId && onUpdateAssignment;
                      const isEditing2 = editingCell && editingCell.assignmentId === sr.assignmentId && editingCell.colIdx === ci;
                      return <td key={ci} style={{padding:1,background:col.isCurrent?'rgba(255,50,133,0.03)':'transparent',textAlign:'center',cursor:canEdit?'pointer':'default'}} onClick={canEdit?(e)=>{e.stopPropagation();setEditingCell({assignmentId:sr.assignmentId,colIdx:ci,periodKey:col.periodKey,assignment:sr.assignment});setEditValue(String(taux));}:undefined}>
                        {isEditing2 ? (
                          <input type="number" min="0" max="200" step="10" value={editValue} autoFocus
                            style={{width:36,padding:'1px 2px',fontSize:'0.5rem',fontWeight:700,textAlign:'center',border:'1.5px solid var(--pink)',borderRadius:3,outline:'none',background:'white',color:'var(--navy)'}}
                            onChange={e=>setEditValue(e.target.value)}
                            onBlur={()=>{const v=parseInt(editValue);if(!isNaN(v)&&v>=0&&v<=200){const a=editingCell.assignment;const key=editingCell.periodKey;const overrides={...(a.staffing_overrides||{})};if(v===(a.taux_staffing||0)){delete overrides[key];}else{overrides[key]=v;}onUpdateAssignment(sr.assignmentId,{staffing_overrides:overrides});}setEditingCell(null);}}
                            onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditingCell(null);}}
                            onClick={e=>e.stopPropagation()}
                          />
                        ) : val ? <div style={{background:cellBg(taux),color:cellColor(taux),borderRadius:3,padding:'2px 2px',fontSize:'0.5rem',fontWeight:700,opacity:canEdit&&taux!==(sr.taux||0)?1:0.8,border:canEdit&&taux!==(sr.taux||0)?'1px dashed var(--pink)':'none'}}>{val}</div> : <div style={{height:14}} />}
                      </td>;
                    })}
                  </tr>
                  {/* Level 3: individual assignments (editable cells) */}
                  {isSubExp && hasDetails && sr.assignmentRows.map(ar => (
                    <tr key={ar.id} style={{background:'rgba(59,130,246,0.03)',borderBottom:'1px solid var(--lavender)'}}>
                      <td style={{padding:'3px 14px 3px 60px',...stickyStyle,background:'rgba(59,130,246,0.04)'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          {ar.avatar && <Avatar prenom={ar.avatar.prenom} nom={ar.avatar.nom} photoUrl={ar.avatar.photo_url} size={18} />}
                          <div style={{fontSize:'0.62rem'}}>
                            <span style={{fontWeight:600,color:'var(--navy)'}}>{ar.label}</span>
                            <span style={{color:'var(--muted)'}}> · {ar.sub} · {ar.taux}%</span>
                          </div>
                        </div>
                      </td>
                      {columns.map((col,ci) => {
                        const taux = Math.round(ar.getCellTaux(col));
                        const val = fmtCell(taux);
                        const isEditing = editingCell && editingCell.assignmentId === ar.assignmentId && editingCell.colIdx === ci;
                        return <td key={ci} style={{padding:1,background:col.isCurrent?'rgba(255,50,133,0.03)':'transparent',textAlign:'center',cursor:onUpdateAssignment?'pointer':'default'}} onClick={(e)=>{
                          e.stopPropagation();
                          if (onUpdateAssignment) { setEditingCell({assignmentId:ar.assignmentId, colIdx:ci, periodKey:col.periodKey, assignment:ar.assignment}); setEditValue(String(taux)); }
                        }}>
                          {isEditing ? (
                            <input type="number" min="0" max="200" step="10" value={editValue} autoFocus
                              style={{width:36,padding:'1px 2px',fontSize:'0.55rem',fontWeight:700,textAlign:'center',border:'1.5px solid var(--pink)',borderRadius:3,outline:'none',background:'white',color:'var(--navy)'}}
                              onChange={e=>setEditValue(e.target.value)}
                              onBlur={()=>{
                                const v=parseInt(editValue);
                                if(!isNaN(v)&&v>=0&&v<=200) {
                                  const a = editingCell.assignment;
                                  const key = editingCell.periodKey;
                                  const overrides = {...(a.staffing_overrides||{})};
                                  if (v === (a.taux_staffing||0)) { delete overrides[key]; } else { overrides[key] = v; }
                                  onUpdateAssignment(ar.assignmentId, { staffing_overrides: overrides });
                                }
                                setEditingCell(null);
                              }}
                              onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditingCell(null);}}
                              onClick={e=>e.stopPropagation()}
                            />
                          ) : val ? <div style={{background:cellBg(taux),color:cellColor(taux),borderRadius:3,padding:'1px 2px',fontSize:'0.48rem',fontWeight:700,opacity:taux!==(ar.taux||0)?1:0.7,border:taux!==(ar.taux||0)?'1px dashed var(--pink)':'none'}}>{val}</div> : <div style={{height:12}} />}
                        </td>;
                      })}
                    </tr>
                  ))}
                  </React.Fragment>;
                })}
              </React.Fragment>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Finance par client */
function FinanceByClient({ clients, missions, isMissionActive }) {
  const activeMissions = missions.filter(isMissionActive);

  const clientData = clients.map(c => {
    const cMissions = activeMissions.filter(m => m.client_id === c.id);
    const budget = cMissions.reduce((s, m) => s + (m.budget_vendu || 0), 0);
    const caMonth = cMissions.reduce((s, m) => s + calcMonthlyCA(m.assignments), 0);
    const nbCollabs = new Set(cMissions.flatMap(m => (m.assignments || []).filter(a => a.statut === 'actif').map(a => a.collaborateur_id))).size;
    return { client: c, missions: cMissions, budget, caMonth, nbCollabs };
  }).filter(d => d.missions.length > 0).sort((a, b) => b.caMonth - a.caMonth);

  const totalCA = clientData.reduce((s, d) => s + d.caMonth, 0);
  const [expandedClient, setExpandedClient] = useState(null);

  return (
    <div>
      <div className="section-title">CA par client</div>
      <div style={{fontSize:'0.82rem',color:'var(--muted)',marginBottom:12}}>CA mensuel estimé total : <strong style={{color:'var(--navy)',fontSize:'1rem'}}>{fmtEuro(Math.round(totalCA))}</strong> · {activeMissions.length} missions sur la période</div>
      <div className="card" style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Client</th><th>Missions</th><th>Collabs</th><th>Budget total</th><th>CA mensuel est.</th><th></th></tr></thead>
          <tbody>{clientData.map(d => (
            <React.Fragment key={d.client.id}>
              <tr style={{cursor:'pointer',background:expandedClient===d.client.id?'var(--offwhite)':'transparent'}} onClick={()=>setExpandedClient(expandedClient===d.client.id?null:d.client.id)}>
                <td style={{fontWeight:700,color:'var(--navy)'}}>{d.client.nom}</td>
                <td>{d.missions.length}</td>
                <td>{d.nbCollabs}</td>
                <td style={{fontWeight:600}}>{fmtEuro(d.budget)}</td>
                <td style={{fontWeight:700,color:'var(--blue)'}}>{fmtEuro(Math.round(d.caMonth))}</td>
                <td style={{color:'var(--muted)'}}>{expandedClient===d.client.id ? '▲' : '▼'}</td>
              </tr>
              {expandedClient===d.client.id && d.missions.map(m => (
                <tr key={m.id} style={{background:'var(--offwhite)',fontSize:'0.82rem'}}>
                  <td style={{paddingLeft:32,color:'var(--muted)'}}>{m.nom}</td>
                  <td>{(m.assignments||[]).filter(a=>a.statut==='actif').length}</td>
                  <td></td>
                  <td style={{color:'var(--muted)'}}>{fmtEuro(m.budget_vendu)}</td>
                  <td style={{color:'var(--muted)'}}>{fmtEuro(Math.round(calcMonthlyCA(m.assignments)))}</td>
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
