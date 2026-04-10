import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { Avatar, Badge, FadeIn, Skeleton, Modal, fmtDate } from '../../../components/UI';

export default function ReferentTab({ collabId, collabs, settings }) {
  const [missions, setMissions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestModal, setRequestModal] = useState(null); // mission object
  const [selectedCollab, setSelectedCollab] = useState(null);
  const [form, setForm] = useState({ role:'', jours_par_semaine:5, date_debut:'', date_fin:'', motif:'' });
  const [filterComp, setFilterComp] = useState('');
  const [filterEquipe, setFilterEquipe] = useState('');

  const missionRoles = settings?.mission_roles || [
    {label:'Tech Lead',tjm:900},{label:'Développeur',tjm:600},{label:'Designer (UX/UI)',tjm:650},
    {label:'Product Owner',tjm:650},{label:'Ingénieur QA',tjm:700}
  ];

  useEffect(() => { loadData(); }, [collabId]);

  async function loadData() {
    try {
      const [m, r] = await Promise.all([
        api.getMissions(),
        api.getStaffingRequests()
      ]);
      // Only missions where I'm the responsable
      setMissions((m||[]).filter(mi => mi.responsable_id === collabId));
      setRequests(r || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  if (loading) return <Skeleton lines={5} />;

  const todayStr = new Date().toISOString().split('T')[0];
  const activeMissions = missions.filter(m => !m.date_fin || m.date_fin >= todayStr);

  // Available collabs for staffing request
  const getAvailableCollabs = () => {
    return (collabs||[]).filter(c => {
      if (filterComp && !(c.competences||[]).includes(filterComp)) return false;
      if (filterEquipe && !(c.equipe||'').includes(filterEquipe)) return false;
      return true;
    });
  };

  const submitRequest = async () => {
    if (!requestModal || !selectedCollab || !form.role) { alert('Collaborateur et rôle requis'); return; }
    try {
      await api.createStaffingRequest({
        mission_id: requestModal.id,
        collaborateur_id: selectedCollab,
        role: form.role,
        jours_par_semaine: parseFloat(form.jours_par_semaine) || 5,
        date_debut: form.date_debut || requestModal.date_debut || null,
        date_fin: form.date_fin || requestModal.date_fin || null,
        motif: form.motif || null,
      });
      setRequestModal(null);
      setSelectedCollab(null);
      setForm({ role:'', jours_par_semaine:5, date_debut:'', date_fin:'', motif:'' });
      await loadData();
      alert('Demande envoyée !');
    } catch(e) { alert('Erreur: ' + e.message); }
  };

  const allCompetences = [...new Set((collabs||[]).flatMap(c => c.competences||[]))].sort();
  const allEquipes = [...new Set((collabs||[]).flatMap(c => (c.equipe||'').split(',').map(s=>s.trim())).filter(Boolean))].sort();
  const selectStyle = {border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 10px',fontFamily:'inherit',fontSize:'0.78rem',background:'var(--offwhite)',color:'var(--navy)'};

  return (
    <div>
      {/* Mes missions en tant que référent */}
      <div className="section-title" style={{marginTop:0}}>Mes projets ({activeMissions.length})</div>

      {activeMissions.length === 0 ? (
        <div className="card" style={{textAlign:'center',padding:32,color:'var(--muted)'}}>Aucun projet dont vous êtes référent</div>
      ) : activeMissions.map(m => {
        const team = (m.assignments||[]).filter(a => !a.statut || a.statut === 'actif');
        const mRequests = requests.filter(r => r.mission_id === m.id);
        const pendingReqs = mRequests.filter(r => r.statut === 'en_attente');
        return (
          <div key={m.id} className="card" style={{marginBottom:12,padding:16,borderLeft:'4px solid var(--blue)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div>
                <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem'}}>{m.nom}</div>
                <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:2}}>{m.clients?.nom||m.client||'—'}{m.categorie?' · '+m.categorie:''}</div>
                <div style={{fontSize:'0.72rem',color:'var(--muted)',marginTop:2}}>📅 {fmtDate(m.date_debut)} → {fmtDate(m.date_fin)}</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={()=>{setRequestModal(m);setSelectedCollab(null);setForm({role:'',jours_par_semaine:5,date_debut:m.date_debut||'',date_fin:m.date_fin||'',motif:''});}}>+ Demander un renfort</button>
            </div>

            {/* Équipe actuelle */}
            {team.length > 0 && <div style={{marginBottom:8}}>
              <div style={{fontSize:'0.68rem',fontWeight:700,color:'var(--muted)',marginBottom:4}}>👥 Équipe ({team.length})</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {team.map(a => {
                  const c = a.collaborateurs || collabs?.find(x=>x.id===a.collaborateur_id);
                  return <span key={a.id} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:6,fontSize:'0.7rem',fontWeight:600,background:'var(--offwhite)',color:'var(--navy)'}}>
                    {c && <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={18} />}
                    {c ? `${c.prenom} ${c.nom}` : '—'} · {a.role||'—'} · {a.jours_par_semaine||Math.round((a.taux_staffing||0)/100*5*10)/10}j/sem
                  </span>;
                })}
              </div>
            </div>}

            {/* Demandes en cours */}
            {pendingReqs.length > 0 && <div>
              <div style={{fontSize:'0.68rem',fontWeight:700,color:'var(--orange)',marginBottom:4}}>⏳ Demandes en attente ({pendingReqs.length})</div>
              {pendingReqs.map(r => (
                <div key={r.id} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 8px',background:'var(--bg-warning)',borderRadius:6,marginBottom:4,fontSize:'0.72rem'}}>
                  <span style={{fontWeight:600,color:'var(--text-warning)'}}>{r.collaborateurs?`${r.collaborateurs.prenom} ${r.collaborateurs.nom}`:'—'}</span>
                  <span style={{color:'var(--text-warning)'}}>{r.role||''} · {r.jours_par_semaine}j/sem</span>
                  <Badge type="orange">En attente</Badge>
                </div>
              ))}
            </div>}

            {/* Demandes refusées */}
            {mRequests.filter(r=>r.statut==='refuse').length > 0 && <div style={{marginTop:4}}>
              {mRequests.filter(r=>r.statut==='refuse').map(r => (
                <div key={r.id} style={{fontSize:'0.68rem',color:'var(--text-danger)',padding:'2px 8px',background:'var(--bg-danger)',borderRadius:4,marginBottom:2}}>
                  ✕ {r.collaborateurs?`${r.collaborateurs.prenom} ${r.collaborateurs.nom}`:'—'} — {r.motif_refus||'Refusé'}
                </div>
              ))}
            </div>}
          </div>
        );
      })}

      {/* MODAL : Demander un renfort */}
      <Modal open={!!requestModal} onClose={()=>setRequestModal(null)} title={requestModal?`Demander un renfort — ${requestModal.nom}`:''} size="lg">
        {requestModal && <>
          {/* Filtres */}
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
            <select value={filterComp} onChange={e=>setFilterComp(e.target.value)} style={selectStyle}>
              <option value="">Toutes compétences</option>
              {allCompetences.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterEquipe} onChange={e=>setFilterEquipe(e.target.value)} style={selectStyle}>
              <option value="">Toutes équipes</option>
              {allEquipes.map(e=><option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* Liste collabs disponibles */}
          <div style={{maxHeight:250,overflowY:'auto',marginBottom:16}}>
            {getAvailableCollabs().map(c => {
              const isSelected = selectedCollab === c.id;
              return <div key={c.id} onClick={()=>setSelectedCollab(c.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,marginBottom:4,cursor:'pointer',border:isSelected?'2px solid var(--pink)':'2px solid var(--lavender)',background:isSelected?'var(--bg-accent)':'white',transition:'all 0.15s'}}>
                <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={28} />
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:'0.82rem',color:'var(--navy)'}}>{c.prenom} {c.nom}</div>
                  <div style={{fontSize:'0.68rem',color:'var(--muted)'}}>{c.poste||''}{c.equipe?' · '+c.equipe:''}</div>
                </div>
                {(c.competences||[]).length > 0 && <div style={{display:'flex',gap:2,flexWrap:'wrap'}}>
                  {c.competences.slice(0,3).map(comp=><span key={comp} style={{padding:'1px 5px',borderRadius:4,fontSize:'0.55rem',fontWeight:700,background:'var(--bg-info)',color:'var(--text-info)'}}>{comp}</span>)}
                </div>}
              </div>;
            })}
          </div>

          {/* Formulaire */}
          {selectedCollab && <div style={{padding:'12px 16px',background:'var(--offwhite)',borderRadius:10,marginBottom:12}}>
            <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.85rem',marginBottom:8}}>
              {(()=>{const c=collabs?.find(x=>x.id===selectedCollab); return c?`${c.prenom} ${c.nom}`:'—';})()}
            </div>
            <div className="form-grid">
              <div className="form-field"><label>Rôle souhaité *</label><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="">Sélectionner...</option>{missionRoles.map(r=><option key={r.label} value={r.label}>{r.label}</option>)}</select></div>
              <div className="form-field"><label>Jours/semaine</label><input type="number" step="0.5" min="0.5" max="5" value={form.jours_par_semaine} onChange={e=>setForm({...form,jours_par_semaine:e.target.value})} /></div>
              <div className="form-field"><label>Du</label><input type="date" value={form.date_debut} onChange={e=>setForm({...form,date_debut:e.target.value})} /></div>
              <div className="form-field"><label>Au</label><input type="date" value={form.date_fin} onChange={e=>setForm({...form,date_fin:e.target.value})} /></div>
            </div>
            <div className="form-field" style={{marginTop:8}}><label>Motif / justification</label><textarea value={form.motif} onChange={e=>setForm({...form,motif:e.target.value})} placeholder="Pourquoi cette personne ? Quel besoin ?" style={{minHeight:60}} /></div>
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
              <button className="btn btn-primary" onClick={submitRequest} disabled={!form.role}>📩 Envoyer la demande</button>
            </div>
          </div>}
        </>}
      </Modal>
    </div>
  );
}
