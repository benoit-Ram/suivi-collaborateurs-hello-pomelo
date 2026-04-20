import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
import { api } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { PageHeader, Badge, Avatar, Modal, FadeIn, Skeleton, Tabs, FormField, fmtDate, countWorkDays, absenceDays, getFeriesSet, calculateSolde, ABS_TYPES, ABS_STATUTS, getAbsenceTypes, absenceDeductsSolde } from '../../components/UI';

const ABS_BADGE = { en_attente:'orange', approuve:'green', refuse:'pink' };

export default function Absences() {
  const { absences, collabs, settings, showToast, reload, loading } = useData();
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const absTypes = getAbsenceTypes(settings);
  const [tab, setTab] = useState('pending');
  const [histFilter, setHistFilter] = useState('');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  // Refuse modal
  const [refuseId, setRefuseId] = useState(null);
  const [refuseMotif, setRefuseMotif] = useState('');
  const [refuseLoading, setRefuseLoading] = useState(false);
  // Solde modal
  const [soldeModal, setSoldeModal] = useState(null);
  const [soldeForm, setSoldeForm] = useState({ solde: 0, acq: 2.08 });
  const [soldeLoading, setSoldeLoading] = useState(false);
  // Create absence for collab
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ collaborateur_id:'', type:'conge', date_debut:'', date_fin:'', demi_journee:'', commentaire:'', statut:'approuve' });
  const [createLoading, setCreateLoading] = useState(false);
  // Action loading
  const [approving, setApproving] = useState(null);
  // Calendar filters
  const [calFilterEquipe, setCalFilterEquipe] = useState('');
  const [calFilterType, setCalFilterType] = useState('');
  // Soldes search
  const [soldeSearch, setSoldeSearch] = useState('');

  if (loading) return <div style={{maxWidth:600,margin:'40px auto'}}><Skeleton lines={5} /></div>;

  const pending = absences.filter(a => a.statut === 'en_attente' || a.statut === 'annulation_demandee');
  const history = absences.filter(a => a.statut !== 'en_attente' && a.statut !== 'annulation_demandee');
  const filteredHist = histFilter ? history.filter(a => a.collaborateur_id === histFilter) : history;

  const approve = async (id) => {
    setApproving(id);
    try { await api.updateAbsence(id, { statut: 'approuve', approved_by: authUser?.name || 'Admin', approved_at: new Date().toISOString() }); await reload(); showToast('Congé approuvé ✓'); } catch(e) { showToast('Erreur: '+e.message); }
    setApproving(null);
  };
  const submitRefuse = async () => {
    if (!refuseMotif.trim()) return;
    setRefuseLoading(true);
    try { await api.updateAbsence(refuseId, { statut: 'refuse', motif_refus: refuseMotif.trim(), approved_by: authUser?.name || 'Admin', approved_at: new Date().toISOString() }); await reload(); showToast('Congé refusé'); setRefuseId(null); setRefuseMotif(''); } catch(e) { showToast('Erreur: '+e.message); }
    setRefuseLoading(false);
  };
  const submitSolde = async () => {
    setSoldeLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await api.updateCollaborateur(soldeModal, {
        solde_conges: parseFloat(soldeForm.solde),
        acquisition_conges: parseFloat(soldeForm.acq),
        solde_reference_date: today,
      });
      await reload(); showToast('Solde mis à jour ✓'); setSoldeModal(null);
    } catch(e) { showToast('Erreur: '+e.message); }
    setSoldeLoading(false);
  };
  const submitCreate = async () => {
    if (!createForm.collaborateur_id || !createForm.date_debut || !createForm.date_fin) { showToast('Remplissez tous les champs obligatoires.'); return; }
    setCreateLoading(true);
    try {
      await api.createAbsence({ ...createForm, demi_journee: createForm.demi_journee||null, commentaire: createForm.commentaire||null, approved_by: authUser?.name||'Admin', approved_at: new Date().toISOString() });
      await reload(); showToast('Absence créée ✓'); setCreateModal(false);
      setCreateForm({ collaborateur_id:'', type:'conge', date_debut:'', date_fin:'', demi_journee:'', commentaire:'', statut:'approuve' });
    } catch(e) { showToast('Erreur: '+e.message); }
    setCreateLoading(false);
  };
  const deleteAbsence = async (id) => {
    if (!confirm('Supprimer definitivement cette absence ?')) return;
    try { await api.deleteAbsence(id); await reload(); showToast('Absence supprimée'); } catch(e) { showToast('Erreur: '+e.message); }
  };

  const getName = (id) => { const c = collabs.find(x=>x.id===id); return c ? `${c.prenom} ${c.nom}` : '—'; };

  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  const calPrev = () => { if(calMonth===0){setCalMonth(11);setCalYear(calYear-1)}else setCalMonth(calMonth-1) };
  const calNext = () => { if(calMonth===11){setCalMonth(0);setCalYear(calYear+1)}else setCalMonth(calMonth+1) };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12,marginBottom:8}}>
        <PageHeader title="Congés & Absences" subtitle="Gestion des demandes et suivi des soldes" />
        <button className="btn btn-primary btn-sm" onClick={()=>setCreateModal(true)}>+ Creer une absence</button>
      </div>

      <div style={{maxWidth:560}}><Tabs items={[['pending',`⏳ En attente (${pending.length})`],['history','📋 Historique'],['calendar','📅 Calendrier'],['soldes','💰 Soldes']]} active={tab} onChange={setTab} /></div>

      {/* PENDING */}
      {tab==='pending' && <FadeIn><div>
        {pending.length===0 ? <div className="card" style={{textAlign:'center',padding:32,color:'var(--muted)'}}>✅ Aucune demande en attente</div> : pending.map(a => {
          const c = collabs.find(x=>x.id===a.collaborateur_id);
          const isCancelRequest = a.statut === 'annulation_demandee';
          return <div key={a.id} className="card" style={{marginBottom:10,padding:16,borderLeft:`4px solid ${isCancelRequest?'var(--red)':'var(--orange)'}`}}>
            <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              {c && <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={36} />}
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontWeight:700,color:'var(--blue)',cursor:'pointer',fontSize:'0.9rem'}} onClick={()=>c&&navigate(`/admin/collaborateurs/${c.id}`)}>{getName(a.collaborateur_id)}</div>
                <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>{absTypes[a.type]||a.type} · Du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)} · {absenceDays(a)}j ouvres{a.demi_journee ? ` (${a.demi_journee})` : ''}</div>
                {a.commentaire && <div style={{fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic',marginTop:2}}>{a.commentaire}</div>}
                {isCancelRequest && <div style={{fontSize:'0.78rem',color:'var(--red)',fontWeight:600,marginTop:4}}>🔄 Demande d'annulation{a.commentaire_annulation ? ' : '+a.commentaire_annulation : ''}</div>}
              </div>
              <div style={{display:'flex',gap:6}}>
                {isCancelRequest ? <>
                  <button className="btn btn-sm" style={{background:'var(--green)',color:'white'}} onClick={async()=>{try{await api.updateAbsence(a.id,{statut:'annule',approved_by:authUser?.name||'Admin',approved_at:new Date().toISOString()});await reload();showToast('Annulation validee');}catch(e){showToast('Erreur: '+e.message);}}} disabled={approving===a.id}>✓ Valider annulation</button>
                  <button className="btn btn-danger btn-sm" onClick={async()=>{try{await api.updateAbsence(a.id,{statut:'approuve',commentaire_annulation:null});await reload();showToast('Annulation refusee — conge maintenu');}catch(e){showToast('Erreur: '+e.message);}}}>✕ Refuser annulation</button>
                </> : <>
                  <button className="btn btn-sm" style={{background:'var(--green)',color:'white'}} onClick={()=>approve(a.id)} disabled={approving===a.id}>{approving===a.id ? '⏳...' : '✓ Approuver'}</button>
                  <button className="btn btn-danger btn-sm" onClick={()=>{setRefuseId(a.id);setRefuseMotif('');}}>✕ Refuser</button>
                </>}
              </div>
            </div>
          </div>;
        })}
      </div></FadeIn>}

      {/* HISTORY */}
      {tab==='history' && <FadeIn><div>
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <select value={histFilter} onChange={e=>setHistFilter(e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:10,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.82rem',minWidth:250,background:'var(--offwhite)',color:'var(--navy)'}}>
            <option value="">Tous les collaborateurs</option>
            {collabs.map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={()=>{
            const BOM = '\uFEFF';
            const rows = filteredHist.map(a => {
              const c = collabs.find(x=>x.id===a.collaborateur_id);
              return [c?c.nom:'',c?c.prenom:'',c?.equipe||'',absTypes[a.type]||a.type,a.date_debut,a.date_fin,absenceDays(a),a.demi_journee||'',ABS_STATUTS[a.statut]||a.statut,a.commentaire||'',a.motif_refus||'',a.approved_by||'',a.approved_at?fmtDate(a.approved_at.split('T')[0]):''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';');
            });
            const csv = BOM + ['Nom;Prenom;Equipe;Type;Du;Au;Jours;Demi-journee;Statut;Commentaire;Motif refus;Traite par;Date traitement',...rows].join('\n');
            const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href=url; a.download=`absences_export_${new Date().toISOString().split('T')[0]}.csv`; a.click();
            URL.revokeObjectURL(url);
          }}>📥 Exporter CSV</button>
        </div>
        <div className="card" style={{overflowX:'auto'}}>
          <table>
            <thead><tr><th>Collaborateur</th><th>Type</th><th>Du</th><th>Au</th><th>Jours</th><th>Statut</th><th>Traite par</th><th>Motif</th><th></th></tr></thead>
            <tbody>{filteredHist.length===0 ? <tr><td colSpan={9} style={{textAlign:'center',color:'var(--muted)',padding:32}}>Aucun historique</td></tr> : filteredHist.map(a=>(
              <tr key={a.id}>
                <td style={{fontWeight:700,cursor:'pointer',color:'var(--blue)'}} onClick={()=>navigate(`/admin/collaborateurs/${collabs.find(x=>x.id===a.collaborateur_id)?.id}`)}>{getName(a.collaborateur_id)}</td>
                <td>{absTypes[a.type]||a.type}</td>
                <td>{fmtDate(a.date_debut)}</td>
                <td>{fmtDate(a.date_fin)}</td>
                <td style={{fontWeight:700}}>{absenceDays(a)}j{a.demi_journee ? ` (${a.demi_journee})` : ''}</td>
                <td><Badge type={ABS_BADGE[a.statut]}>{ABS_STATUTS[a.statut]}</Badge></td>
                <td style={{fontSize:'0.75rem',color:'var(--muted)'}}>{a.approved_by ? `${a.approved_by}${a.approved_at ? ' — '+fmtDate(a.approved_at.split('T')[0]) : ''}` : '—'}</td>
                <td style={{fontSize:'0.78rem',color:'var(--text-danger)'}}>{a.motif_refus||'—'}</td>
                <td><button className="btn btn-danger btn-sm" style={{padding:'2px 6px',fontSize:'0.65rem'}} onClick={()=>deleteAbsence(a.id)}>🗑️</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div></FadeIn>}

      {/* CALENDAR */}
      {tab==='calendar' && <FadeIn><div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <button className="btn btn-ghost btn-sm" onClick={calPrev}>←</button>
          <span style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem',textTransform:'capitalize'}}>{monthLabel}</span>
          <button className="btn btn-ghost btn-sm" onClick={calNext}>→</button>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
          <select value={calFilterEquipe} onChange={e=>setCalFilterEquipe(e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'6px 10px',fontFamily:'inherit',fontSize:'0.78rem',background:'var(--offwhite)',color:'var(--navy)'}}>
            <option value="">Toutes equipes</option>
            {[...new Set(collabs.flatMap(c=>(c.equipe||'').split(',').map(s=>s.trim())).filter(Boolean))].map(e=><option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        {(()=>{
          const fermetures = settings?.periodes_fermeture || [];
          const feries = getFeriesSet(calYear);
          const filteredCollabs = calFilterEquipe ? collabs.filter(c=>(c.equipe||'').includes(calFilterEquipe)) : collabs;
          return <>
          <div style={{overflowX:'auto'}}>
            <table style={{fontSize:'0.72rem',width:'100%'}}>
              <thead><tr><th style={{textAlign:'left',padding:'4px 8px',minWidth:120,position:'sticky',left:0,background:'var(--white)',zIndex:1}}>Collaborateur</th>
                {Array.from({length:daysInMonth},(_,i)=>{
                  const dow=new Date(calYear,calMonth,i+1).getDay();
                  return <th key={i} style={{padding:'2px 3px',textAlign:'center',minWidth:22,color:dow===0||dow===6?'var(--lavender)':'var(--muted)'}}>{i+1}</th>;
                })}
              </tr></thead>
              <tbody>{filteredCollabs.map(c => {
                const cAbs = absences.filter(a=>a.collaborateur_id===c.id&&(a.statut==='approuve'||a.statut==='en_attente'));
                return <tr key={c.id}>
                  <td style={{padding:'4px 8px',fontWeight:600,whiteSpace:'nowrap',cursor:'pointer',color:'var(--blue)',position:'sticky',left:0,background:'var(--white)',zIndex:1}} onClick={()=>navigate(`/admin/collaborateurs/${c.id}`)}>{c.prenom} {c.nom[0]}.</td>
                  {Array.from({length:daysInMonth},(_,d)=>{
                    const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d+1).padStart(2,'0')}`;
                    const dow=new Date(calYear,calMonth,d+1).getDay();
                    const isWE=dow===0||dow===6;
                    const isFerie=feries.has(ds);
                    const isFerm = fermetures.some(f=>ds>=f.debut&&ds<=f.fin);
                    const a=cAbs.find(x=>ds>=x.date_debut&&ds<=x.date_fin);
                    let bg=isWE||isFerie?'var(--lavender)':isFerm?'#EF444433':'transparent';
                    if(a && !isWE && !isFerie) bg=a.statut==='approuve'?'var(--bg-success)':'var(--bg-warning)';
                    const title=isFerie?'Jour férié':isFerm?fermetures.find(f=>ds>=f.debut&&ds<=f.fin)?.label:'';
                    return <td key={d} title={title} style={{padding:1,background:bg,borderRadius:2}} />;
                  })}
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div style={{display:'flex',gap:12,marginTop:12,fontSize:'0.7rem',color:'var(--muted)',fontWeight:600,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--bg-success)'}} /> Approuve</div>
            <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--bg-warning)'}} /> En attente</div>
            <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--lavender)'}} /> Weekend / Ferié</div>
            {fermetures.length>0 && <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'#EF444433'}} /> Fermeture</div>}
          </div>
          </>;
        })()}
      </div></FadeIn>}

      {/* SOLDES */}
      {tab==='soldes' && <FadeIn><div>
        <div style={{background:'var(--bg-info)',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:'0.82rem',color:'var(--text-info)',borderLeft:'3px solid var(--border-info)'}}>
          ℹ️ L'acquisition mensuelle est <strong>automatique</strong> : au 1<sup>er</sup> de chaque mois, le compteur "Acquis depuis" augmente du nombre défini (par défaut 2,08 j/mois). Modifiez manuellement le solde d'un collaborateur en cliquant sur ✏️ — la valeur saisie représente alors son solde réel à aujourd'hui.
        </div>
        <div style={{marginBottom:16}}>
          <input type="text" value={soldeSearch} onChange={e=>setSoldeSearch(e.target.value)} placeholder="🔍 Rechercher un collaborateur..." style={{width:'100%',maxWidth:400,border:'1.5px solid var(--lavender)',borderRadius:10,padding:'10px 16px',fontFamily:'inherit',fontSize:'0.9rem',outline:'none',background:'var(--offwhite)',color:'var(--navy)'}} />
        </div>
        <div className="card" style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Collaborateur</th><th>Solde aujourd'hui</th><th>Acquisition/mois</th><th>Acquis depuis</th><th>Pris depuis</th><th>Solde</th><th></th></tr></thead>
          <tbody>{collabs.filter(c => !soldeSearch || (c.prenom+' '+c.nom).toLowerCase().includes(soldeSearch.toLowerCase())).map(c => {
            const s = calculateSolde(c, absences.filter(a=>a.collaborateur_id===c.id), settings);
            const color = s.solde<=0?'var(--red)':s.solde<=5?'var(--orange)':'var(--green)';
            return <tr key={c.id}>
              <td style={{fontWeight:700,cursor:'pointer',color:'var(--blue)'}} onClick={()=>navigate(`/admin/collaborateurs/${c.id}`)}>{c.prenom} {c.nom}</td>
              <td>{s.soldeInit}j</td>
              <td>{s.acq}j/mois</td>
              <td>{s.acquis}j</td>
              <td>{s.pris}j</td>
              <td style={{fontWeight:700,color}}>{s.solde}j</td>
              <td><button className="btn btn-ghost btn-sm" aria-label="Modifier le solde" onClick={()=>{setSoldeModal(c.id);setSoldeForm({solde:s.soldeInit,acq:s.acq});}}>✏️</button></td>
            </tr>;
          })}</tbody>
        </table>
      </div></div></FadeIn>}

      {/* REFUSE MODAL */}
      <Modal open={!!refuseId} onClose={()=>setRefuseId(null)} title="Refuser la demande">
        <p style={{fontSize:'0.88rem',color:'var(--muted)',marginBottom:16}}>Veuillez indiquer le motif du refus :</p>
        <div className="form-field">
          <label>Motif <span style={{color:'var(--red)'}}>*</span></label>
          <textarea autoFocus value={refuseMotif} onChange={e=>setRefuseMotif(e.target.value)} placeholder="Ex: Période de forte activité, chevauchement avec un collègue..." style={{minHeight:80}} />
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost" onClick={()=>setRefuseId(null)}>Annuler</button>
          <button className="btn btn-danger" onClick={submitRefuse} disabled={refuseLoading || !refuseMotif.trim()}>{refuseLoading ? '⏳ En cours...' : '✕ Refuser'}</button>
        </div>
      </Modal>

      {/* SOLDE MODAL */}
      <Modal open={!!soldeModal} onClose={()=>setSoldeModal(null)} title="Modifier le solde congés">
        <div style={{fontSize:'0.82rem',color:'var(--muted)',marginBottom:12,background:'var(--bg-info)',padding:'8px 12px',borderRadius:8,color:'var(--text-info)'}}>
          ℹ️ La valeur saisie est le <strong>solde réel à aujourd'hui</strong>. L'acquisition mensuelle et les absences s'ajouteront/se déduiront à partir de ce jour.
        </div>
        <div className="form-grid">
          <FormField label="Solde aujourd'hui (jours)">
            <input type="number" step="0.01" autoFocus value={soldeForm.solde} onChange={e=>setSoldeForm({...soldeForm,solde:e.target.value})} />
          </FormField>
          <FormField label="Acquisition/mois (jours)">
            <input type="number" step="0.01" value={soldeForm.acq} onChange={e=>setSoldeForm({...soldeForm,acq:e.target.value})} />
          </FormField>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost" onClick={()=>setSoldeModal(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={submitSolde} disabled={soldeLoading}>{soldeLoading ? '⏳ En cours...' : '💾 Enregistrer'}</button>
        </div>
      </Modal>

      {/* CREATE ABSENCE MODAL */}
      <Modal open={createModal} onClose={()=>setCreateModal(false)} title="Creer une absence">
        <div className="form-grid">
          <div className="form-field">
            <label>Collaborateur <span style={{color:'var(--red)'}}>*</span></label>
            <select value={createForm.collaborateur_id} onChange={e=>setCreateForm({...createForm,collaborateur_id:e.target.value})}>
              <option value="">Selectionner...</option>
              {collabs.map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Type</label>
            <select value={createForm.type} onChange={e=>setCreateForm({...createForm,type:e.target.value})}>
              {Object.entries(absTypes).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-field"><label>Du <span style={{color:'var(--red)'}}>*</span></label><input type="date" value={createForm.date_debut} onChange={e=>setCreateForm({...createForm,date_debut:e.target.value,date_fin:createForm.date_fin||e.target.value})} /></div>
          <div className="form-field"><label>Au <span style={{color:'var(--red)'}}>*</span></label><input type="date" value={createForm.date_fin} onChange={e=>setCreateForm({...createForm,date_fin:e.target.value})} disabled={!!createForm.demi_journee} /></div>
          <div className="form-field">
            <label>Duree</label>
            <select value={createForm.demi_journee} onChange={e=>setCreateForm({...createForm,demi_journee:e.target.value,date_fin:e.target.value?createForm.date_debut:createForm.date_fin})}>
              <option value="">Journee(s) complete(s)</option>
              <option value="AM">Demi-journee matin</option>
              <option value="PM">Demi-journee apres-midi</option>
            </select>
          </div>
          <div className="form-field">
            <label>Statut</label>
            <select value={createForm.statut} onChange={e=>setCreateForm({...createForm,statut:e.target.value})}>
              <option value="approuve">Approuve</option>
              <option value="en_attente">En attente</option>
            </select>
          </div>
          <div className="form-field"><label>Commentaire</label><input type="text" value={createForm.commentaire} onChange={e=>setCreateForm({...createForm,commentaire:e.target.value})} placeholder="Optionnel..." /></div>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost" onClick={()=>setCreateModal(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={submitCreate} disabled={createLoading}>{createLoading ? '⏳...' : '💾 Creer'}</button>
        </div>
      </Modal>
    </div>
  );
}
