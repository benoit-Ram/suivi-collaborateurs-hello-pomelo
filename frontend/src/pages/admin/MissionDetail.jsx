import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
import { api } from '../../services/api';
import { PageHeader, Badge, Avatar, FadeIn, Skeleton, fmtDate, getAbsenceDays } from '../../components/UI';

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

export default function MissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { collabs, absences: allAbsences, settings, showToast } = useData();
  const approvedAbsences = (allAbsences || []).filter(a => a.statut === 'approuve');
  const missionCategories = settings?.mission_categories || ['Web','Mobile','ERP','DevOps','Design','Data','Conseil','TMA'];
  const missionRoles = settings?.mission_roles || [
    {label:'Directeur Projet',tjm:900},{label:'Product Manager',tjm:700},{label:'Product Owner',tjm:650},
    {label:'Tech Lead',tjm:900},{label:'Développeur',tjm:600},{label:'Ingénieur QA',tjm:700},
    {label:'Lead Devops',tjm:900},{label:'Designer (UX/UI)',tjm:650}
  ];

  const [mission, setMission] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('equipe');
  const [form, setForm] = useState({});
  const [addForm, setAddForm] = useState({ collaborateur_id:'', role:'', jours_par_semaine:5, tjm:'' });
  const [editingCell, setEditingCell] = useState(null); // {assignId, weekIdx}
  const [editCellValue, setEditCellValue] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [bulkForm, setBulkForm] = useState({ assignId:'', jours:5, debut:'', fin:'' });

  async function loadMission() {
    try {
      const [missions, c] = await Promise.all([api.getMissions(), api.getClients()]);
      setClients(c || []);
      const m = (missions || []).find(x => x.id === id);
      if (m) {
        setMission(m);
        setForm({ nom:m.nom, client_id:m.client_id||'', description:m.description||'', categorie:m.categorie||'', date_debut:m.date_debut||'', date_fin:m.date_fin||'', budget_vendu:m.budget_vendu||'', methode_facturation:m.methode_facturation||'regie', responsable_id:m.responsable_id||'', lien_propale:m.lien_propale||'' });
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadMission(); }, [id]);

  if (loading) return <div style={{maxWidth:600,margin:'40px auto'}}><Skeleton lines={8} /></div>;
  if (!mission) return <div style={{textAlign:'center',padding:48,color:'var(--muted)'}}>Mission non trouvée. <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/admin/missions')}>← Retour</button></div>;

  const team = (mission.assignments || []).filter(a => a.statut === 'actif' || !a.statut);
  const clientName = mission.clients?.nom || mission.client || '—';
  const todayStr = new Date().toISOString().split('T')[0];
  const isActive = !mission.date_fin || mission.date_fin >= todayStr;
  const now = new Date();

  const saveInfos = async () => {
    try {
      const clientObj = clients.find(c => c.id === form.client_id);
      const row = { ...form, client: clientObj?.nom||'', budget_vendu: form.budget_vendu ? parseFloat(form.budget_vendu) : null, responsable_id: form.responsable_id||null, lien_propale: form.lien_propale||null, description: form.description||null, categorie: form.categorie||null, date_debut: form.date_debut||null, date_fin: form.date_fin||null };
      await api.updateMission(id, row);
      await loadMission();
      showToast('Mission mise à jour');
    } catch(e) { showToast('Erreur: '+e.message); }
  };

  const updateAssign = async (assignId, field, value) => {
    try {
      const data = { [field]: value };
      if (field === 'jours_par_semaine') data.taux_staffing = tauxFromJPS(parseFloat(value)||0);
      await api.updateAssignment(assignId, data);
      await loadMission();
    } catch(e) { showToast('Erreur: '+e.message); }
  };

  const addCollab = async () => {
    if (!addForm.collaborateur_id || !addForm.role) { showToast('Collaborateur et rôle requis'); return; }
    try {
      const jps = parseFloat(addForm.jours_par_semaine)||5;
      const tjm = addForm.tjm ? parseFloat(addForm.tjm) : (missionRoles.find(r=>r.label===addForm.role)?.tjm || 0);
      await api.createAssignment({ collaborateur_id: addForm.collaborateur_id, mission_id: id, role: addForm.role, jours_par_semaine: jps, taux_staffing: tauxFromJPS(jps), tjm, statut:'actif', date_debut: mission.date_debut||null, date_fin: mission.date_fin||null });
      setAddForm({ collaborateur_id:'', role:'', jours_par_semaine:5, tjm:'' });
      await loadMission();
      showToast('Collaborateur affecté');
    } catch(e) { showToast('Erreur: '+e.message); }
  };

  const removeAssign = async (assignId) => {
    try { await api.deleteAssignment(assignId); await loadMission(); showToast('Retrait effectué'); } catch(e) { showToast('Erreur: '+e.message); }
  };

  // Finance calculations
  const totalCA = calcConsumedBudget(team, now);
  const totalCAMensuel = calcMonthlyCA(team);
  const totalJours = team.reduce((s,a) => s+(a.jours_par_semaine||a.taux_staffing/100*5), 0);
  const budgetPct = mission.budget_vendu > 0 ? Math.round(totalCA/mission.budget_vendu*100) : null;

  // Week key helper
  const getWeekKey = (d) => { const wn = Math.ceil(((d - new Date(d.getFullYear(),0,1))/86400000+1)/7); return `${d.getFullYear()}-W${String(wn).padStart(2,'0')}`; };
  const getEffectiveTaux = (a, wk) => { const ov = a.staffing_overrides || {}; return ov[wk] !== undefined ? ov[wk] : (a.taux_staffing || 0); };
  const tauxToJours = (taux) => Math.round(taux / 100 * 5 * 10) / 10;
  const joursToTaux = (jours) => Math.round(jours / 5 * 100);

  // Update a single cell (week override)
  const updateWeekCell = async (a, weekKey, jours) => {
    const taux = joursToTaux(jours);
    const overrides = {...(a.staffing_overrides || {})};
    if (taux === (a.taux_staffing || 0)) { delete overrides[weekKey]; } else { overrides[weekKey] = taux; }
    try { await api.updateAssignment(a.id, { staffing_overrides: overrides }); await loadMission(); } catch(e) { showToast('Erreur: '+e.message); }
  };

  // Bulk update: set jours for all weeks in a date range
  const applyBulkUpdate = async () => {
    const a = team.find(x => x.id === bulkForm.assignId);
    if (!a || !bulkForm.debut || !bulkForm.fin) return;
    const taux = joursToTaux(parseFloat(bulkForm.jours) || 0);
    const overrides = {...(a.staffing_overrides || {})};
    const cursor = new Date(bulkForm.debut);
    cursor.setDate(cursor.getDate() - ((cursor.getDay()+6)%7)); // align to Monday
    const endDate = new Date(bulkForm.fin);
    while (cursor <= endDate) {
      const wk = getWeekKey(cursor);
      if (taux === (a.taux_staffing || 0)) { delete overrides[wk]; } else { overrides[wk] = taux; }
      cursor.setDate(cursor.getDate() + 7);
    }
    try { await api.updateAssignment(a.id, { staffing_overrides: overrides }); setBulkForm({assignId:'',jours:5,debut:'',fin:''}); await loadMission(); showToast('Planning mis à jour'); } catch(e) { showToast('Erreur: '+e.message); }
  };

  // Timeline: 16 weeks with offset
  const WEEKS = 16;
  const startMon = new Date(now); startMon.setDate(now.getDate() - ((now.getDay()+6)%7) + weekOffset*WEEKS); startMon.setHours(0,0,0,0);
  const weeks = Array.from({length:WEEKS},(_,i) => {
    const d = new Date(startMon); d.setDate(startMon.getDate()+i*7);
    const wn = Math.ceil(((d - new Date(d.getFullYear(),0,1))/86400000+1)/7);
    const end = new Date(d.getTime()+4*86400000);
    return { label:`S${wn}`, start:d.toISOString().split('T')[0], end:end.toISOString().split('T')[0], isCurrent:todayStr>=d.toISOString().split('T')[0]&&todayStr<=end.toISOString().split('T')[0], weekKey:`${d.getFullYear()}-W${String(wn).padStart(2,'0')}` };
  });
  const COLORS = ['#3B82F6','#8B5CF6','#EC4899','#F59E0B','#10B981','#6366F1'];

  const inputStyle = {border:'1px solid var(--lavender)',borderRadius:6,padding:'4px 6px',fontFamily:'inherit',fontSize:'0.75rem',background:'var(--offwhite)',color:'var(--navy)',width:'100%'};

  return (
    <div>
      {/* Breadcrumb + back */}
      <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:8,fontSize:'0.78rem',color:'var(--muted)',fontWeight:600}}>
        <a href="/admin" style={{color:'var(--muted)',textDecoration:'none'}}>Dashboard</a>
        <span style={{opacity:0.4}}>›</span>
        <a href="/admin/missions" style={{color:'var(--muted)',textDecoration:'none'}}>Missions</a>
        <span style={{opacity:0.4}}>›</span>
        <span style={{color:'var(--navy)'}}>{mission.nom}</span>
      </div>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:'clamp(1.1rem,4vw,1.5rem)',fontWeight:700,color:'var(--navy)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{mission.nom}</h1>
          <div style={{fontSize:'0.88rem',color:'var(--muted)',marginTop:4}}>{clientName}{mission.categorie ? ` · ${mission.categorie}` : ''}</div>
          <div style={{display:'flex',gap:6,marginTop:8}}>
            <Badge type={isActive?'blue':'gray'}>{isActive?'En cours':'Passée'}</Badge>
            {mission.methode_facturation && <Badge type="gray">{mission.methode_facturation==='forfait'?'Forfait':'Régie'}</Badge>}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/admin/missions')}>← Retour</button>
      </div>

      {/* Tabs */}
      <div className="tabs-scroll" style={{display:'flex',gap:6,marginBottom:24,background:'var(--offwhite)',padding:6,borderRadius:12,overflowX:'auto'}}>
        {[['equipe','👥 Équipe'],['infos','📝 Infos'],['finance','💰 Finance']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:'1 0 auto',padding:'10px 14px',borderRadius:10,border:'none',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',background:tab===k?'var(--pink)':'transparent',color:tab===k?'white':'var(--muted)',border:tab===k?'none':'1.5px solid var(--lavender)',boxShadow:tab===k?'0 4px 14px rgba(255,50,133,0.3)':'none'}}>{l}</button>
        ))}
      </div>

      {/* TAB: EQUIPE */}
      {tab==='equipe' && <FadeIn><div>
        <div className="section-title" style={{marginTop:0}}>Équipe ({team.length})</div>

        {/* Editable team table */}
        <div className="card" style={{overflowX:'auto',marginBottom:16,padding:0}}>
          <table style={{fontSize:'0.78rem'}}>
            <thead><tr><th style={{minWidth:140}}>Collaborateur</th><th style={{minWidth:110}}>Rôle</th><th style={{width:65}}>J/sem</th><th style={{width:65}}>TJM</th><th style={{width:110}}>Du</th><th style={{width:110}}>Au</th><th style={{minWidth:100}}>Notes</th><th style={{textAlign:'right',width:80}}>CA est.</th><th style={{width:50}}></th></tr></thead>
            <tbody>
              {team.map((a, idx) => {
                const c = a.collaborateurs;
                const ca = calcConsumedBudget([a], now);
                return <tr key={a.id}>
                  <td><div style={{display:'flex',alignItems:'center',gap:6}}>
                    {c && <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={24} />}
                    <span style={{fontWeight:700,color:'var(--navy)'}}>{c ? `${c.prenom} ${c.nom}` : '—'}</span>
                  </div></td>
                  <td><select defaultValue={a.role||''} onChange={e=>updateAssign(a.id,'role',e.target.value)} style={{...inputStyle,width:110}}>
                    <option value="">—</option>{missionRoles.map(r=><option key={r.label} value={r.label}>{r.label}</option>)}
                  </select></td>
                  <td><input type="number" step="0.5" min="0.5" max="5" defaultValue={a.jours_par_semaine||Math.round(a.taux_staffing/100*5*10)/10} onBlur={e=>{const v=parseFloat(e.target.value);if(!isNaN(v)&&v>0)updateAssign(a.id,'jours_par_semaine',v);}} style={{...inputStyle,width:55}} /></td>
                  <td><input type="number" defaultValue={a.tjm||''} onBlur={e=>{const v=parseFloat(e.target.value);if(!isNaN(v))updateAssign(a.id,'tjm',v);}} style={{...inputStyle,width:60}} /></td>
                  <td><input type="date" defaultValue={a.date_debut||''} onBlur={e=>updateAssign(a.id,'date_debut',e.target.value||null)} style={{...inputStyle,width:110}} /></td>
                  <td><input type="date" defaultValue={a.date_fin||''} onBlur={e=>updateAssign(a.id,'date_fin',e.target.value||null)} style={{...inputStyle,width:110}} /></td>
                  <td><input defaultValue={a.notes||''} placeholder="..." onBlur={e=>updateAssign(a.id,'notes',e.target.value||null)} style={{...inputStyle,width:100,fontSize:'0.68rem'}} /></td>
                  <td style={{textAlign:'right',fontWeight:700,color:'var(--blue)',whiteSpace:'nowrap'}}>{fmtEuro(Math.round(ca))}</td>
                  <td style={{whiteSpace:'nowrap'}}><div style={{display:'flex',gap:2}}>
                    <button className="btn btn-ghost btn-sm" style={{padding:'2px 5px',fontSize:'0.6rem'}} title="Dupliquer" onClick={()=>{setAddForm({collaborateur_id:a.collaborateur_id,role:a.role||'',jours_par_semaine:a.jours_par_semaine||5,tjm:String(a.tjm||'')});}}>📋</button>
                    <button className="btn btn-danger btn-sm" style={{padding:'2px 5px',fontSize:'0.6rem'}} onClick={()=>removeAssign(a.id)}>✕</button>
                  </div></td>
                </tr>;
              })}
              {team.length === 0 && <tr><td colSpan={9} style={{textAlign:'center',color:'var(--muted)',padding:24}}>Aucun collaborateur affecté</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Quick add */}
        <div className="mobile-stack" style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',marginBottom:24}}>
          <select value={addForm.collaborateur_id} onChange={e=>setAddForm({...addForm,collaborateur_id:e.target.value})} style={{...inputStyle,flex:1,minWidth:120,padding:'8px 10px'}}>
            <option value="">+ Collaborateur...</option>
            {collabs.map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom} — {c.poste||''}{team.some(a=>a.collaborateur_id===c.id)?' (déjà affecté)':''}</option>)}
          </select>
          <select value={addForm.role} onChange={e=>{const role=missionRoles.find(r=>r.label===e.target.value); setAddForm({...addForm, role:e.target.value, tjm:role?String(role.tjm):''}); }} style={{...inputStyle,flex:1,minWidth:120,padding:'8px 10px'}}>
            <option value="">Rôle...</option>
            {missionRoles.map(r=><option key={r.label} value={r.label}>{r.label} ({r.tjm}€)</option>)}
          </select>
          <div style={{display:'flex',alignItems:'center',gap:3}}>
            <input type="number" step="0.5" min="0.5" max="5" value={addForm.jours_par_semaine} onChange={e=>setAddForm({...addForm,jours_par_semaine:e.target.value})} style={{...inputStyle,width:50,padding:'8px 6px'}} />
            <span style={{fontSize:'0.68rem',color:'var(--muted)'}}>j/sem</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={addCollab} disabled={!addForm.collaborateur_id||!addForm.role}>+ Ajouter</button>
        </div>

        {/* Interactive Gantt */}
        <div className="section-title">Planning mission</div>
        <div className="card" style={{overflowX:'auto',padding:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',borderBottom:'1px solid var(--lavender)'}}>
            <button className="btn btn-ghost btn-sm" style={{padding:'3px 8px',fontSize:'0.68rem'}} onClick={()=>setWeekOffset(weekOffset-1)}>← {WEEKS} sem.</button>
            <span style={{fontSize:'0.72rem',fontWeight:700,color:'var(--navy)'}}>Planning staffing</span>
            <div style={{display:'flex',gap:4}}>
              {weekOffset!==0 && <button className="btn btn-ghost btn-sm" style={{padding:'3px 8px',fontSize:'0.68rem'}} onClick={()=>setWeekOffset(0)}>Aujourd'hui</button>}
              <button className="btn btn-ghost btn-sm" style={{padding:'3px 8px',fontSize:'0.68rem'}} onClick={()=>setWeekOffset(weekOffset+1)}>{WEEKS} sem. →</button>
            </div>
          </div>
          <table style={{fontSize:'0.65rem',width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              <th style={{textAlign:'left',padding:'6px 10px',minWidth:120,position:'sticky',left:0,background:'var(--white)',zIndex:1}}>Collab</th>
              {weeks.map((w,i)=><th key={i} style={{textAlign:'center',padding:'4px 2px',minWidth:44,fontWeight:w.isCurrent?800:600,color:w.isCurrent?'var(--pink)':'var(--muted)'}}>{w.label}</th>)}
            </tr></thead>
            <tbody>
              {team.map((a,idx) => {
                const c = a.collaborateurs;
                return <tr key={a.id} style={{borderBottom:'1px solid var(--lavender)'}}>
                  <td style={{padding:'6px 10px',position:'sticky',left:0,background:'var(--white)',zIndex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      {c && <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={18} />}
                      <div>
                        <span style={{fontWeight:700,color:'var(--navy)',fontSize:'0.68rem'}}>{c?c.prenom+' '+c.nom[0]+'.':'—'}</span>
                        <div style={{fontSize:'0.55rem',color:'var(--muted)'}}>{a.role||''}{a.notes?` · ${a.notes}`:''}</div>
                      </div>
                    </div>
                  </td>
                  {weeks.map((w,wi) => {
                    const isInRange = (!a.date_debut || a.date_debut <= w.end) && (!a.date_fin || a.date_fin >= w.start);
                    const missionInRange = (!mission.date_debut || mission.date_debut <= w.end) && (!mission.date_fin || mission.date_fin >= w.start);
                    const inRange = isInRange && missionInRange;
                    const effectiveTaux = getEffectiveTaux(a, w.weekKey);
                    const jps = tauxToJours(effectiveTaux);
                    const defaultJps = tauxToJours(a.taux_staffing || 0);
                    const isOverridden = (a.staffing_overrides||{})[w.weekKey] !== undefined;
                    const isEditing = editingCell && editingCell.assignId === a.id && editingCell.weekIdx === wi;
                    const barPct = Math.min(jps/5*100, 100);
                    const absJ = getAbsenceDays(a.collaborateur_id, w.start, w.end, approvedAbsences);

                    return <td key={wi} style={{padding:1,background:absJ>0?'rgba(249,115,22,0.08)':w.isCurrent?'rgba(255,50,133,0.04)':'transparent',textAlign:'center',cursor:inRange?'pointer':'default',verticalAlign:'bottom'}}
                      onClick={inRange && !isEditing ? ()=>{setEditingCell({assignId:a.id,weekIdx:wi}); setEditCellValue(String(jps));} : undefined}>
                      {isEditing ? (
                        <input type="number" step="0.5" min="0" max="5" value={editCellValue} autoFocus
                          style={{width:38,padding:'1px 2px',fontSize:'0.55rem',fontWeight:700,textAlign:'center',border:'1.5px solid var(--pink)',borderRadius:3,outline:'none',background:'white',color:'var(--navy)'}}
                          onChange={e=>setEditCellValue(e.target.value)}
                          onBlur={()=>{const v=parseFloat(editCellValue); if(!isNaN(v)&&v>=0&&v<=5) updateWeekCell(a,w.weekKey,v); setEditingCell(null);}}
                          onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditingCell(null);}}
                          onClick={e=>e.stopPropagation()}
                        />
                      ) : inRange ? (
                        <div style={{position:'relative',height:20,borderRadius:3,overflow:'hidden',background:absJ>0?'repeating-linear-gradient(45deg,var(--offwhite),var(--offwhite) 3px,rgba(249,115,22,0.1) 3px,rgba(249,115,22,0.1) 6px)':'var(--offwhite)'}}>
                          <div style={{position:'absolute',top:0,left:0,bottom:0,width:`${barPct}%`,background:COLORS[idx%COLORS.length],opacity:jps>0?0.85:0,borderRadius:3,transition:'width 0.15s',border:isOverridden?'1px dashed rgba(255,255,255,0.7)':'none'}} />
                          <div style={{position:'relative',zIndex:1,fontSize:'0.48rem',fontWeight:700,color:jps>2.5?'white':'var(--navy)',lineHeight:'20px',paddingLeft:3}} title={absJ>0?`🏖️ ${absJ}j absence`:isOverridden?`Override: ${jps}j (défaut: ${defaultJps}j)`:''}>{jps>0?jps+'j':''}</div>
                          {absJ>0 && <div style={{position:'absolute',top:1,right:1,width:5,height:5,borderRadius:'50%',background:'var(--orange)',zIndex:2}} title={`${absJ}j absence`} />}
                        </div>
                      ) : <div style={{height:22}} />}
                    </td>;
                  })}
                </tr>;
              })}
              {/* Total row */}
              {team.length > 0 && <tr style={{borderTop:'2px solid var(--lavender)',background:'var(--offwhite)'}}>
                <td style={{padding:'6px 10px',position:'sticky',left:0,background:'var(--offwhite)',zIndex:1,fontWeight:700,fontSize:'0.65rem',color:'var(--navy)'}}>Total jours</td>
                {weeks.map((w,wi) => {
                  const total = team.reduce((s,a) => {
                    const inRange = (!a.date_debut||a.date_debut<=w.end)&&(!a.date_fin||a.date_fin>=w.start)&&(!mission.date_debut||mission.date_debut<=w.end)&&(!mission.date_fin||mission.date_fin>=w.start);
                    return s + (inRange ? tauxToJours(getEffectiveTaux(a, w.weekKey)) : 0);
                  }, 0);
                  return <td key={wi} style={{textAlign:'center',padding:2,fontSize:'0.55rem',fontWeight:700,color:total>0?'var(--navy)':'var(--muted)',background:w.isCurrent?'rgba(255,50,133,0.06)':'transparent'}}>{total>0?`${Math.round(total*10)/10}j`:''}</td>;
                })}
              </tr>}
              {/* Cost row */}
              {team.length > 0 && <tr style={{background:'var(--offwhite)'}}>
                <td style={{padding:'4px 10px',position:'sticky',left:0,background:'var(--offwhite)',zIndex:1,fontWeight:700,fontSize:'0.55rem',color:'var(--muted)'}}>Coût €/sem</td>
                {weeks.map((w,wi) => {
                  const cost = team.reduce((s,a) => {
                    const inRange = (!a.date_debut||a.date_debut<=w.end)&&(!a.date_fin||a.date_fin>=w.start)&&(!mission.date_debut||mission.date_debut<=w.end)&&(!mission.date_fin||mission.date_fin>=w.start);
                    if (!inRange || !a.tjm) return s;
                    return s + (a.tjm * tauxToJours(getEffectiveTaux(a, w.weekKey)));
                  }, 0);
                  return <td key={wi} style={{textAlign:'center',padding:2,fontSize:'0.48rem',fontWeight:600,color:cost>0?'var(--blue)':'transparent',background:w.isCurrent?'rgba(255,50,133,0.06)':'transparent'}}>{cost>0?`${Math.round(cost/100)/10}k`:''}</td>;
                })}
              </tr>}
            </tbody>
          </table>
        </div>

        {/* Bulk update */}
        {team.length > 0 && <div style={{marginTop:12,padding:'10px 12px',border:'1.5px dashed var(--lavender)',borderRadius:10}}>
          <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',marginBottom:6}}>📅 Modifier une période</div>
          <div className="mobile-stack" style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            <select value={bulkForm.assignId} onChange={e=>setBulkForm({...bulkForm,assignId:e.target.value})} style={{...inputStyle,flex:1,minWidth:120,padding:'6px 8px'}}>
              <option value="">Collaborateur...</option>
              {team.map(a=><option key={a.id} value={a.id}>{a.collaborateurs?a.collaborateurs.prenom+' '+a.collaborateurs.nom:'—'}</option>)}
            </select>
            <div style={{display:'flex',alignItems:'center',gap:3}}>
              <input type="number" step="0.5" min="0" max="5" value={bulkForm.jours} onChange={e=>setBulkForm({...bulkForm,jours:e.target.value})} style={{...inputStyle,width:50,padding:'6px 8px'}} />
              <span style={{fontSize:'0.68rem',color:'var(--muted)'}}>j/sem</span>
            </div>
            <span style={{fontSize:'0.68rem',color:'var(--muted)'}}>du</span>
            <input type="date" value={bulkForm.debut} onChange={e=>setBulkForm({...bulkForm,debut:e.target.value})} style={{...inputStyle,width:120,padding:'6px 8px'}} />
            <span style={{fontSize:'0.68rem',color:'var(--muted)'}}>au</span>
            <input type="date" value={bulkForm.fin} onChange={e=>setBulkForm({...bulkForm,fin:e.target.value})} style={{...inputStyle,width:120,padding:'6px 8px'}} />
            <button className="btn btn-primary btn-sm" onClick={applyBulkUpdate} disabled={!bulkForm.assignId||!bulkForm.debut||!bulkForm.fin}>Appliquer</button>
          </div>
        </div>}
      </div></FadeIn>}

      {/* TAB: INFOS */}
      {tab==='infos' && <FadeIn><div>
        <div className="form-grid">
          <div className="form-field"><label>Nom</label><input value={form.nom||''} onChange={e=>setForm({...form,nom:e.target.value})} /></div>
          <div className="form-field"><label>Client</label><select value={form.client_id||''} onChange={e=>setForm({...form,client_id:e.target.value})}><option value="">—</option>{clients.map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</select></div>
          <div className="form-field"><label>Catégorie</label><select value={form.categorie||''} onChange={e=>setForm({...form,categorie:e.target.value})}><option value="">—</option>{missionCategories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div className="form-field"><label>Facturation</label><select value={form.methode_facturation||'regie'} onChange={e=>setForm({...form,methode_facturation:e.target.value})}><option value="regie">Régie</option><option value="forfait">Forfait</option></select></div>
          <div className="form-field"><label>Date début</label><input type="date" value={form.date_debut||''} onChange={e=>setForm({...form,date_debut:e.target.value})} /></div>
          <div className="form-field"><label>Date fin</label><input type="date" value={form.date_fin||''} onChange={e=>setForm({...form,date_fin:e.target.value})} /></div>
          <div className="form-field"><label>Budget vendu (€)</label><input type="number" value={form.budget_vendu||''} onChange={e=>setForm({...form,budget_vendu:e.target.value})} /></div>
          <div className="form-field"><label>Responsable</label><select value={form.responsable_id||''} onChange={e=>setForm({...form,responsable_id:e.target.value})}><option value="">Aucun</option>{collabs.map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}</select></div>
          <div className="form-field"><label>Lien propale</label><input type="url" value={form.lien_propale||''} onChange={e=>setForm({...form,lien_propale:e.target.value})} placeholder="https://..." /></div>
        </div>
        <div className="form-field" style={{marginTop:8}}><label>Description</label><textarea value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})} style={{minHeight:80}} /></div>
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}><button className="btn btn-primary" onClick={saveInfos}>💾 Enregistrer</button></div>
      </div></FadeIn>}

      {/* TAB: FINANCE */}
      {tab==='finance' && <FadeIn><div>
        <div className="mobile-grid-2" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:24}}>
          <div className="card" style={{textAlign:'center',padding:16}}>
            <div style={{fontSize:'clamp(1.4rem,5vw,2rem)',fontWeight:700,color:'var(--navy)'}}>{fmtEuro(Math.round((mission.budget_vendu||0)/1000)*1000)}</div>
            <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Budget vendu</div>
          </div>
          <div className="card" style={{textAlign:'center',padding:16}}>
            <div style={{fontSize:'clamp(1.4rem,5vw,2rem)',fontWeight:700,color:budgetPct>90?'var(--red)':'var(--blue)'}}>{fmtEuro(Math.round(totalCA))}</div>
            <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Consommé (est.)</div>
          </div>
          <div className="card" style={{textAlign:'center',padding:16}}>
            <div style={{fontSize:'clamp(1.4rem,5vw,2rem)',fontWeight:700,color:'var(--green)'}}>{fmtEuro(Math.round(totalCAMensuel))}</div>
            <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>CA / mois</div>
          </div>
          <div className="card" style={{textAlign:'center',padding:16}}>
            <div style={{fontSize:'clamp(1.4rem,5vw,2rem)',fontWeight:700,color:'var(--navy)'}}>{budgetPct !== null ? budgetPct+'%' : '—'}</div>
            <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Budget utilisé</div>
          </div>
        </div>

        {/* Budget bar */}
        {budgetPct !== null && <div style={{marginBottom:20}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.78rem',marginBottom:4}}>
            <span style={{color:'var(--muted)'}}>Progression budget</span>
            <span style={{fontWeight:700,color:budgetPct>90?'var(--red)':'var(--navy)'}}>{fmtEuro(Math.round(totalCA))} / {fmtEuro(mission.budget_vendu)}</span>
          </div>
          <div style={{height:10,background:'var(--offwhite)',borderRadius:6,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${Math.min(budgetPct,100)}%`,background:budgetPct>90?'var(--red)':budgetPct>70?'var(--orange)':'var(--green)',borderRadius:6}} />
          </div>
        </div>}

        {/* Detail table */}
        {team.length > 0 && <div className="card" style={{overflowX:'auto'}}>
          <table style={{fontSize:'0.78rem'}}>
            <thead><tr><th>Collaborateur</th><th>Rôle</th><th>J/sem</th><th>TJM</th><th>Période</th><th style={{textAlign:'right'}}>CA estimé</th><th style={{textAlign:'right'}}>CA/mois</th></tr></thead>
            <tbody>
              {team.map(a => {
                const ca = calcConsumedBudget([a], now);
                const cam = calcMonthlyCA([{...a, statut:'actif'}]);
                return <tr key={a.id}>
                  <td style={{fontWeight:700,color:'var(--navy)'}}>{a.collaborateurs?a.collaborateurs.prenom+' '+a.collaborateurs.nom:'—'}</td>
                  <td style={{color:'var(--muted)'}}>{a.role||'—'}</td>
                  <td style={{fontWeight:600}}>{a.jours_par_semaine||Math.round(a.taux_staffing/100*5*10)/10}j</td>
                  <td style={{fontWeight:600}}>{a.tjm?a.tjm+'€':'—'}</td>
                  <td style={{color:'var(--muted)'}}>{fmtDate(a.date_debut)} → {fmtDate(a.date_fin)}</td>
                  <td style={{textAlign:'right',fontWeight:700,color:'var(--navy)'}}>{fmtEuro(Math.round(ca))}</td>
                  <td style={{textAlign:'right',fontWeight:600,color:'var(--blue)'}}>{fmtEuro(Math.round(cam))}</td>
                </tr>;
              })}
              <tr style={{borderTop:'2px solid var(--lavender)',fontWeight:700}}>
                <td>Total</td><td></td>
                <td>{Math.round(totalJours*10)/10}j/sem</td>
                <td></td><td></td>
                <td style={{textAlign:'right',color:'var(--navy)'}}>{fmtEuro(Math.round(totalCA))}</td>
                <td style={{textAlign:'right',color:'var(--blue)'}}>{fmtEuro(Math.round(totalCAMensuel))}</td>
              </tr>
            </tbody>
          </table>
        </div>}
      </div></FadeIn>}
    </div>
  );
}
