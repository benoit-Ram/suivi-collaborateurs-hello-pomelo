import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
import { useAuth } from '../../services/AuthContext';
import { api } from '../../services/api';
import { PageHeader, Badge, Avatar, Modal, FadeIn, Skeleton, fmtDate, getAbsenceDays } from '../../components/UI';
import { calcConsumedBudget, calcMonthlyCA, fmtEuro, tauxFromJPS, exportCSV } from '../../utils/missionCalcs';
import MissionCard from './missions/MissionCard';
import TimelineView from './missions/TimelineView';
import FinanceByClient from './missions/FinanceByClient';

export default function Missions() {
  const navigate = useNavigate();
  const { collabs, absences: allAbsences, settings, showToast, loading: ctxLoading } = useData();
  const approvedAbsences = (allAbsences || []).filter(a => a.statut === 'approuve');
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
  // Client modal + detail
  const [clientModal, setClientModal] = useState(null);
  const [clientForm, setClientForm] = useState({});
  const [sirenResults, setSirenResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  // Timeline/Staffing filters
  const [calGroupBy, setCalGroupBy] = useState('collab');
  const [calDisplayMode, setCalDisplayMode] = useState('pct');
  // Dispo tab filters
  const [dispoFilterComp, setDispoFilterComp] = useState('');
  const [dispoFilterEq, setDispoFilterEq] = useState('');
  const [dispoFilterBur, setDispoFilterBur] = useState('');
  const [dispoShowAll, setDispoShowAll] = useState(false);
  // Staffing requests
  const [staffReqs, setStaffReqs] = useState([]);
  const [refuseId, setRefuseId] = useState(null);
  const [refuseMotif, setRefuseMotif] = useState('');
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
  useEffect(() => { api.getStaffingRequests({statut:'en_attente'}).then(setStaffReqs).catch(()=>{}); }, []);

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
        api.logActivity('Création mission', authUser?.name, row.nom, `Client: ${row.client}`);
        showToast('Mission créée ✓');
      } else {
        await api.updateMission(modal.id, row);
        api.logActivity('Modification mission', authUser?.name, row.nom, '');
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
        api.logActivity('Création client', authUser?.name, cleaned.nom, '');
        showToast('Client créé ✓');
      } else {
        await api.updateClient(clientModal.id, cleaned);
        api.logActivity('Modification client', authUser?.name, cleaned.nom, '');
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
    try { const cl=clients.find(c=>c.id===id); await api.deleteClient(id); api.logActivity('Suppression client',authUser?.name,cl?.nom||id,''); loadData(); showToast('Client supprimé'); } catch(e) { showToast('Erreur: ' + e.message); }
  };

  const deleteMission = async (id) => {
    if (!window.confirm('Supprimer cette mission et toutes ses affectations ?')) return;
    try { const mi=missions.find(m=>m.id===id); await api.deleteMission(id); api.logActivity('Suppression mission',authUser?.name,mi?.nom||id,''); loadData(); showToast('Mission supprimée'); } catch(e) { showToast('Erreur: ' + e.message); }
  };

  const saveAssignment = async () => {
    if (!assignForm.collaborateur_id) { showToast('Sélectionnez un collaborateur'); return; }
    if (!assignForm.role) { showToast('Sélectionnez un rôle'); return; }
    if (!assignForm.tjm) { showToast('Le TJM est obligatoire'); return; }
    try {
      const jps = parseFloat(assignForm.jours_par_semaine) || 5;
      const taux = tauxFromJPS(jps);
      await api.createAssignment({ ...assignForm, mission_id: assignModal, taux_staffing: taux, jours_par_semaine: jps, tjm: assignForm.tjm ? parseFloat(assignForm.tjm) : null, date_debut: assignForm.date_debut||null, date_fin: assignForm.date_fin||null });
      const collabName = collabs.find(c=>c.id===assignForm.collaborateur_id);
      api.logActivity('Affectation collab', authUser?.name, collabName?`${collabName.prenom} ${collabName.nom}`:'', `Rôle: ${assignForm.role}`);
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

  // Current week key for override lookup
  const nowDate = new Date();
  const monDate = new Date(nowDate); monDate.setDate(nowDate.getDate() - ((nowDate.getDay() + 6) % 7));
  const currentWeekNum = Math.ceil(((monDate - new Date(monDate.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
  const currentWeekKey = `${monDate.getFullYear()}-W${String(currentWeekNum).padStart(2, '0')}`;
  const getEffectiveTaux = (a) => { const ov = a.staffing_overrides || {}; return ov[currentWeekKey] !== undefined ? ov[currentWeekKey] : (a.taux_staffing || 0); };
  const isMissionActive = (m) => (!m.date_fin || m.date_fin >= periodStart) && (!m.date_debut || m.date_debut <= periodEnd);
  const active = missions.filter(isMissionActive);

  // Staffing calculation
  const staffingMap = {};
  collabs.forEach(c => { staffingMap[c.id] = { collab: c, taux: 0, missions: [] }; });
  active.forEach(m => {
    (m.assignments || []).filter(a => a.statut === 'actif').forEach(a => {
      if (staffingMap[a.collaborateur_id]) {
        const effectiveTaux = getEffectiveTaux(a);
        staffingMap[a.collaborateur_id].taux += effectiveTaux;
        staffingMap[a.collaborateur_id].missions.push({ nom: m.nom, client: getClientName(m), taux: effectiveTaux, role: a.role });
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
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:16}}>
              {cMissions.map(m => <MissionCard key={m.id} m={m} collabs={collabs} onEdit={openEdit} onDelete={deleteMission} onAssign={()=>{setAssignModal(m.id);setAssignForm({collaborateur_id:'',role:'',taux_staffing:100,jours_par_semaine:5,tjm:'',date_debut:m.date_debut||'',date_fin:m.date_fin||''});}} onRemoveAssign={removeAssignment} onDetail={(m)=>navigate(`/admin/missions/${m.id}`)} onDuplicate={duplicateMission} />)}
            </div>}
          </div>;
        })() : <>
        {/* Barre de filtres */}
        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher client, mission, catégorie..." style={{flex:1,minWidth:0,border:'1.5px solid var(--lavender)',borderRadius:10,padding:'8px 14px',fontFamily:'inherit',fontSize:'0.82rem',outline:'none',background:'var(--offwhite)',color:'var(--navy)'}} />
          <button className="btn btn-ghost btn-sm" onClick={()=>{setClientModal('create');setClientForm({nom:'',description:'',secteur:'',siren:'',siret:'',tva_intra:'',adresse:'',code_postal:'',ville:'',categorie_entreprise:'',referent_id:'',contact_signature_nom:'',contact_signature_email:'',contact_signature_tel:'',contact_facturation_nom:'',contact_facturation_email:'',contact_facturation_tel:''});}}>+ Client</button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Mission</button>
          <div style={{display:'flex',gap:2}}>
            <button onClick={()=>{setViewMode('cartes');setSelectedClient(null);}} className={`btn btn-sm ${viewMode==='cartes'?'btn-primary':'btn-ghost'}`} style={{padding:'5px 10px',fontSize:'0.72rem'}}>Cartes</button>
            <button onClick={()=>setViewMode('liste')} className={`btn btn-sm ${viewMode==='liste'?'btn-primary':'btn-ghost'}`} style={{padding:'5px 10px',fontSize:'0.72rem'}}>Liste</button>
          </div>
        </div>

        {(()=>{
          const q = (search || '').trim().toLowerCase();
          const matchMission = (m) => !q || [m.nom, m.description, m.categorie, m.client].some(v => (v || '').toLowerCase().includes(q));
          const matchClient = (c) => !q || [c.nom, c.secteur, c.ville, c.siren, c.siret].some(v => (v || '').toLowerCase().includes(q));
          const missionsFor = (clientId) => {
            const base = missions.filter(m => m.client_id === clientId);
            if (!q) return base;
            // If client itself matches, show all its missions; else only show matching missions
            const client = clients.find(c => c.id === clientId);
            return (client && matchClient(client)) ? base : base.filter(matchMission);
          };
          const filteredClients = clients.filter(c => matchClient(c) || missions.some(m => m.client_id === c.id && matchMission(m)));
          if (filteredClients.length === 0) return <div className="card" style={{textAlign:'center',padding:32,color:'var(--muted)'}}>Aucun résultat pour « {search} »</div>;

          if (viewMode === 'liste') return <div className="card" style={{overflowX:'auto'}}><table>
            <thead><tr><th style={{minWidth:160}}>Client</th><th>Secteur</th><th>Référent</th><th>Missions</th><th></th></tr></thead>
            <tbody>{filteredClients.map(c => {
              const cMissions = missionsFor(c.id);
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
                      <span style={{fontWeight:700,color:'var(--navy)',cursor:'pointer'}} onClick={()=>navigate(`/admin/missions/${m.id}`)}>{m.nom}</span>
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
          return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:12}}>
            {filteredClients.map(c => {
              const cMissions = missionsFor(c.id);
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
          <TimelineView missions={filterClient ? active.filter(m=>m.client_id===filterClient) : active} collabs={filteredCollabs} staffingMap={staffingMap} allMissions={active} clients={clients} groupBy={calGroupBy} displayMode={'jours'} onUpdateAssignment={async(id,data)=>{try{await api.updateAssignment(id,data);await loadData();showToast('Staffing mis à jour');}catch(e){showToast('Erreur: '+e.message);}}} />
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
        // Jours ouvrés sur la période sélectionnée
        const periodWeeks = Math.max(1, (new Date(periodEnd) - new Date(periodStart)) / (7 * 86400000));
        const periodWorkDays = Math.round(periodWeeks * 5 * 10) / 10;
        // Taux staffing sur la période = jours staffés / (jours ouvrés - absences)
        const calcPeriodTaux = (collabId) => {
          const days = calcStaffedDays(collabId);
          const abs = getAbsenceDays(collabId, periodStart, periodEnd, approvedAbsences);
          const disponible = Math.max(1, periodWorkDays - abs);
          return Math.round(days / disponible * 100);
        };

        const filteredStaffing = Object.values(staffingMap).filter(({collab:c}) => filterEquipes.length===0 || filterEquipes.some(eq=>(c.equipe||'').includes(eq)));
        const avg = filteredStaffing.length ? Math.round(filteredStaffing.reduce((s,{collab:c})=>s+calcPeriodTaux(c.id),0)/filteredStaffing.length) : 0;

        const approveReq = async (reqId) => { try { await api.approveStaffingRequest(reqId); setStaffReqs(prev=>prev.filter(r=>r.id!==reqId)); await loadData(); showToast('Demande approuvée — assignment créé'); } catch(e) { showToast('Erreur: '+e.message); } };
        const doRefuse = async () => { if (!refuseId) return; try { await api.refuseStaffingRequest(refuseId, refuseMotif); setStaffReqs(prev=>prev.filter(r=>r.id!==refuseId)); setRefuseId(null); setRefuseMotif(''); showToast('Demande refusée'); } catch(e) { showToast('Erreur: '+e.message); } };

        return <FadeIn><div>
        {/* Demandes de staffing en attente */}
        {staffReqs.length > 0 && <div className="card" style={{marginBottom:16,borderLeft:'4px solid var(--orange)',padding:'16px 20px'}}>
          <div style={{fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase',color:'var(--orange)',marginBottom:10}}>📩 Demandes de staffing ({staffReqs.length})</div>
          {staffReqs.map(r => (
            <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'var(--bg-warning)',borderRadius:10,marginBottom:6,flexWrap:'wrap'}}>
              {r.collaborateurs && <Avatar prenom={r.collaborateurs.prenom} nom={r.collaborateurs.nom} photoUrl={r.collaborateurs.photo_url} size={28} />}
              <div style={{flex:1,minWidth:150}}>
                <div style={{fontWeight:700,fontSize:'0.82rem',color:'var(--navy)'}}>{r.collaborateurs?`${r.collaborateurs.prenom} ${r.collaborateurs.nom}`:'—'}</div>
                <div style={{fontSize:'0.7rem',color:'var(--muted)'}}>
                  {r.missions?.nom||'—'} · {r.role||'—'} · {r.jours_par_semaine}j/sem · {fmtDate(r.date_debut)} → {fmtDate(r.date_fin)}
                </div>
                <div style={{fontSize:'0.68rem',color:'var(--text-warning)'}}>Demandé par {r.demandeurs?`${r.demandeurs.prenom} ${r.demandeurs.nom}`:'—'}{r.motif?` — "${r.motif}"`:''}</div>
              </div>
              <div style={{display:'flex',gap:4}}>
                <button className="btn btn-primary btn-sm" style={{padding:'5px 10px',fontSize:'0.7rem'}} onClick={()=>approveReq(r.id)}>✓ Approuver</button>
                <button className="btn btn-danger btn-sm" style={{padding:'5px 10px',fontSize:'0.7rem'}} onClick={()=>{setRefuseId(r.id);setRefuseMotif('');}}>✕ Refuser</button>
              </div>
            </div>
          ))}
          {/* Refuse modal inline */}
          {refuseId && <div style={{padding:'10px 12px',background:'var(--bg-danger)',borderRadius:8,marginTop:6}}>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text-danger)',marginBottom:6}}>Motif du refus</div>
            <div style={{display:'flex',gap:6}}>
              <input value={refuseMotif} onChange={e=>setRefuseMotif(e.target.value)} placeholder="Raison du refus..." style={{flex:1,border:'1.5px solid var(--border-danger)',borderRadius:8,padding:'6px 10px',fontFamily:'inherit',fontSize:'0.78rem'}} />
              <button className="btn btn-danger btn-sm" onClick={doRefuse}>Confirmer</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>setRefuseId(null)}>Annuler</button>
            </div>
          </div>}
        </div>}

        <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:'0.78rem',color:'var(--muted)',fontWeight:600}}>Taux moyen: {avg}%</span>
          <button className="btn btn-ghost btn-sm" style={{marginLeft:'auto',fontSize:'0.7rem'}} onClick={()=>exportCSV('staffing.csv',['Collaborateur','Poste','Taux staffing période','Jours staffés','Missions'],filteredStaffing.sort((a,b)=>calcPeriodTaux(b.collab.id)-calcPeriodTaux(a.collab.id)).map(({collab:c,missions:ms})=>[`${c.prenom} ${c.nom}`,c.poste||'',`${calcPeriodTaux(c.id)}%`,`${Math.round(calcStaffedDays(c.id)*10)/10}`,ms.map(m=>`${m.nom} (${m.taux}%)`).join(', ')||'Non staffé']))}>📥 Export CSV</button>
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
          <thead><tr><th>Collaborateur</th><th>Poste</th><th>Taux staffing</th><th>Jours staffés</th><th>Absences</th><th>Missions</th></tr></thead>
          <tbody>{filteredStaffing.sort((a,b)=>calcPeriodTaux(b.collab.id)-calcPeriodTaux(a.collab.id)).map(({collab:c,missions:ms})=>{
            const totalDays = Math.round(calcStaffedDays(c.id)*10)/10;
            const absJours = Math.round(getAbsenceDays(c.id, periodStart, periodEnd, approvedAbsences)*10)/10;
            const pTaux = calcPeriodTaux(c.id);
            return <tr key={c.id}>
              <td><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={28} /><span style={{fontWeight:700,color:'var(--navy)'}}>{c.prenom} {c.nom}</span></div></td>
              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{c.poste||'—'}</td>
              <td><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:80,height:8,background:'var(--offwhite)',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(pTaux,100)}%`,background:pTaux>100?'var(--red)':pTaux>=80?'var(--orange)':'var(--green)',borderRadius:4}} /></div><span style={{fontWeight:700,fontSize:'0.85rem',color:pTaux>100?'var(--red)':pTaux>=80?'var(--orange)':'var(--green)'}}>{pTaux}%</span></div></td>
              <td style={{fontWeight:700,color:totalDays>0?'var(--blue)':'var(--muted)'}}>{totalDays}j</td>
              <td style={{fontWeight:600,color:absJours>0?'var(--orange)':'var(--muted)'}}>{absJours>0?`${absJours}j`:'—'}</td>
              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{ms.length===0?'Non staffé':ms.map(m=>`${m.nom} (${m.taux}%)`).join(', ')}</td>
            </tr>;
          })}</tbody>
        </table>
      </div></div></FadeIn>})()}

      {/* FINANCE */}
      {tab==='finance' && <FadeIn><div>
        <div className="mobile-grid-2" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:24}}>
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
        const selectStyle = {border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 10px',fontFamily:'inherit',fontSize:'0.78rem',background:'var(--offwhite)',color:'var(--navy)'};

        // Calculate availability per collab (subtracting absences this week)
        const nowD = new Date();
        const monD = new Date(nowD); monD.setDate(nowD.getDate()-((nowD.getDay()+6)%7));
        const friD = new Date(monD); friD.setDate(monD.getDate()+4);
        const wkStart = monD.toISOString().split('T')[0];
        const wkEnd = friD.toISOString().split('T')[0];

        const dispoData = collabs.map(c => {
          const taux = staffingMap[c.id]?.taux || 0;
          const absJours = getAbsenceDays(c.id, wkStart, wkEnd, approvedAbsences);
          const joursStaffes = taux / 100 * 5;
          const joursDispo = Math.max(0, 5 - joursStaffes - absJours);
          const dispo = Math.round(joursDispo / 5 * 100);
          return { collab: c, taux, dispo, joursDispo, absJours, missions: staffingMap[c.id]?.missions || [] };
        }).filter(d => {
          if (!dispoShowAll && d.dispo === 0) return false;
          if (dispoFilterEq && !(d.collab.equipe||'').includes(dispoFilterEq)) return false;
          if (dispoFilterBur && d.collab.bureau !== dispoFilterBur) return false;
          if (dispoFilterComp && !(d.collab.competences||[]).includes(dispoFilterComp)) return false;
          return true;
        }).sort((a,b) => b.dispo - a.dispo);

        const totalDispo = dispoData.reduce((s,d) => s + d.joursDispo, 0);
        const interContrat = dispoData.filter(d => d.dispo === 100);

        return <FadeIn><div>
        {/* Stats */}
        <div className="mobile-grid-2" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10,marginBottom:20}}>
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
          <select value={dispoFilterComp} onChange={e=>setDispoFilterComp(e.target.value)} style={selectStyle}>
            <option value="">Toutes compétences</option>
            {allCompetences.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select value={dispoFilterEq} onChange={e=>setDispoFilterEq(e.target.value)} style={selectStyle}>
            <option value="">Toutes équipes</option>
            {allEquipes.map(e=><option key={e} value={e}>{e}</option>)}
          </select>
          <select value={dispoFilterBur} onChange={e=>setDispoFilterBur(e.target.value)} style={selectStyle}>
            <option value="">Tous bureaux</option>
            {allBureaux.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'0.78rem',fontWeight:600,color:'var(--muted)',cursor:'pointer'}}>
            <input type="checkbox" checked={dispoShowAll} onChange={e=>setDispoShowAll(e.target.checked)} style={{accentColor:'var(--pink)'}} />
            Inclure staffés 100%
          </label>
          <button className="btn btn-ghost btn-sm" style={{marginLeft:'auto',fontSize:'0.7rem'}} onClick={()=>exportCSV('disponibilites.csv',['Collaborateur','Poste','Équipe','Bureau','Compétences','Staffing','Dispo','Jours dispo'],dispoData.map(({collab:c,taux,dispo,joursDispo})=>[`${c.prenom} ${c.nom}`,c.poste||'',c.equipe||'',c.bureau||'',(c.competences||[]).join(', '),`${taux}%`,`${dispo}%`,`${joursDispo.toFixed(1)}`]))}>📥 Export CSV</button>
        </div>
        {/* Table */}
        <div className="card" style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Collaborateur</th><th>Poste</th><th>Équipe</th><th>Bureau</th><th>Compétences</th><th>Staffing</th><th>Absences</th><th>Dispo</th><th>Jours dispo</th></tr></thead>
          <tbody>{dispoData.map(({collab:c,taux,dispo,joursDispo,absJours,missions:ms})=>(
            <tr key={c.id} style={{background:dispo===100?'rgba(249,115,22,0.05)':dispo>0?'rgba(34,197,94,0.04)':'transparent'}}>
              <td><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={28} /><span style={{fontWeight:700,color:'var(--navy)'}}>{c.prenom} {c.nom}</span></div></td>
              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{c.poste||'—'}</td>
              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{c.equipe||'—'}</td>
              <td style={{fontSize:'0.78rem',color:'var(--muted)'}}>{c.bureau||'—'}</td>
              <td><div style={{display:'flex',gap:3,flexWrap:'wrap'}}>{(c.competences||[]).map(comp=><span key={comp} style={{padding:'2px 6px',borderRadius:4,fontSize:'0.6rem',fontWeight:700,background:'var(--bg-info)',color:'var(--text-info)'}}>{comp}</span>)}</div></td>
              <td><span style={{fontWeight:700,fontSize:'0.82rem',color:taux>100?'var(--red)':taux>=80?'var(--orange)':'var(--green)'}}>{taux}%</span></td>
              <td style={{fontWeight:600,color:absJours>0?'var(--orange)':'var(--muted)'}}>{absJours>0?`🏖️ ${absJours}j`:'—'}</td>
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

