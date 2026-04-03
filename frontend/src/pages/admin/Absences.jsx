import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
import { api } from '../../services/api';
import { useAuth } from '../../services/AuthContext';
import { PageHeader, Badge, Avatar, Modal, FadeIn, Skeleton, fmtDate, countWorkDays, ABS_TYPES, ABS_STATUTS, getAbsenceTypes, absenceDeductsSolde } from '../../components/UI';

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
  // Action loading
  const [approving, setApproving] = useState(null);
  // Calendar filters
  const [calFilterEquipe, setCalFilterEquipe] = useState('');
  const [calFilterType, setCalFilterType] = useState('');

  if (loading) return <div style={{maxWidth:600,margin:'40px auto'}}><Skeleton lines={5} /></div>;

  const pending = absences.filter(a => a.statut === 'en_attente');
  const history = absences.filter(a => a.statut !== 'en_attente');
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
    try { await api.updateCollaborateur(soldeModal, { solde_conges: parseFloat(soldeForm.solde), acquisition_conges: parseFloat(soldeForm.acq) }); await reload(); showToast('Solde mis à jour ✓'); setSoldeModal(null); } catch(e) { showToast('Erreur: '+e.message); }
    setSoldeLoading(false);
  };

  const getName = (id) => { const c = collabs.find(x=>x.id===id); return c ? `${c.prenom} ${c.nom}` : '—'; };

  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  const calPrev = () => { if(calMonth===0){setCalMonth(11);setCalYear(calYear-1)}else setCalMonth(calMonth-1) };
  const calNext = () => { if(calMonth===11){setCalMonth(0);setCalYear(calYear+1)}else setCalMonth(calMonth+1) };

  return (
    <div>
      <PageHeader title="Congés & Absences" subtitle="Gestion des demandes et suivi des soldes" />

      <div style={{display:'flex',gap:6,marginBottom:24,background:'var(--offwhite)',padding:6,borderRadius:12,maxWidth:560,flexWrap:'wrap'}}>
        {[['pending',`⏳ En attente (${pending.length})`],['history','📋 Historique'],['calendar','📅 Calendrier'],['soldes','💰 Soldes']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'10px 14px',borderRadius:10,border:'none',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',background:tab===k?'var(--pink)':'transparent',color:tab===k?'white':'var(--muted)',border:tab===k?'none':'1.5px solid var(--lavender)',boxShadow:tab===k?'0 4px 14px rgba(255,50,133,0.3)':'none'}}>{l}</button>
        ))}
      </div>

      {/* PENDING */}
      {tab==='pending' && <FadeIn><div>
        {pending.length===0 ? <div className="card" style={{textAlign:'center',padding:32,color:'var(--muted)'}}>✅ Aucune demande en attente</div> : pending.map(a => {
          const c = collabs.find(x=>x.id===a.collaborateur_id);
          return <div key={a.id} className="card" style={{marginBottom:10,padding:16,borderLeft:'4px solid var(--orange)'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              {c && <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={36} />}
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontWeight:700,color:'var(--blue)',cursor:'pointer',fontSize:'0.9rem'}} onClick={()=>c&&navigate(`/admin/collaborateurs/${c.id}`)}>{getName(a.collaborateur_id)}</div>
                <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>{ABS_TYPES[a.type]||a.type} · Du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)} · {countWorkDays(a.date_debut,a.date_fin)}j ouvrés</div>
                {a.commentaire && <div style={{fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic',marginTop:2}}>{a.commentaire}</div>}
              </div>
              <div style={{display:'flex',gap:6}}>
                <button className="btn btn-sm" style={{background:'var(--green)',color:'white'}} onClick={()=>approve(a.id)} disabled={approving===a.id}>{approving===a.id ? '⏳...' : '✓ Approuver'}</button>
                <button className="btn btn-danger btn-sm" onClick={()=>{setRefuseId(a.id);setRefuseMotif('');}}>✕ Refuser</button>
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
              return [c?c.nom:'',c?c.prenom:'',absTypes[a.type]||a.type,a.date_debut,a.date_fin,countWorkDays(a.date_debut,a.date_fin),ABS_STATUTS[a.statut]||a.statut,a.commentaire||'',a.motif_refus||'',a.approved_by||'',a.approved_at?fmtDate(a.approved_at.split('T')[0]):''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';');
            });
            const csv = BOM + ['Nom;Prenom;Type;Du;Au;Jours;Statut;Commentaire;Motif refus;Traite par;Date traitement',...rows].join('\n');
            const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href=url; a.download=`absences_export_${new Date().toISOString().split('T')[0]}.csv`; a.click();
            URL.revokeObjectURL(url);
          }}>📥 Exporter CSV</button>
        </div>
        <div className="card" style={{overflowX:'auto'}}>
          <table>
            <thead><tr><th>Collaborateur</th><th>Type</th><th>Du</th><th>Au</th><th>Jours</th><th>Statut</th><th>Traite par</th><th>Motif</th></tr></thead>
            <tbody>{filteredHist.length===0 ? <tr><td colSpan={8} style={{textAlign:'center',color:'var(--muted)',padding:32}}>Aucun historique</td></tr> : filteredHist.map(a=>(
              <tr key={a.id}>
                <td style={{fontWeight:700,cursor:'pointer',color:'var(--blue)'}} onClick={()=>navigate(`/admin/collaborateurs/${collabs.find(x=>x.id===a.collaborateur_id)?.id}`)}>{getName(a.collaborateur_id)}</td>
                <td>{absTypes[a.type]||a.type}</td>
                <td>{fmtDate(a.date_debut)}</td>
                <td>{fmtDate(a.date_fin)}</td>
                <td style={{fontWeight:700}}>{countWorkDays(a.date_debut,a.date_fin)}j{a.demi_journee ? ` (${a.demi_journee})` : ''}</td>
                <td><Badge type={ABS_BADGE[a.statut]}>{ABS_STATUTS[a.statut]}</Badge></td>
                <td style={{fontSize:'0.75rem',color:'var(--muted)'}}>{a.approved_by ? `${a.approved_by}${a.approved_at ? ' — '+fmtDate(a.approved_at.split('T')[0]) : ''}` : '—'}</td>
                <td style={{fontSize:'0.78rem',color:'var(--text-danger)'}}>{a.motif_refus||'—'}</td>
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
                    const isFerm = fermetures.some(f=>ds>=f.debut&&ds<=f.fin);
                    const a=cAbs.find(x=>ds>=x.date_debut&&ds<=x.date_fin);
                    let bg=isWE?'var(--lavender)':isFerm?'#EF444433':'transparent';
                    if(a) bg=a.statut==='approuve'?'var(--bg-success)':'var(--bg-warning)';
                    return <td key={d} title={isFerm?fermetures.find(f=>ds>=f.debut&&ds<=f.fin)?.label:''} style={{padding:1,background:bg,borderRadius:2}} />;
                  })}
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div style={{display:'flex',gap:12,marginTop:12,fontSize:'0.7rem',color:'var(--muted)',fontWeight:600,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--bg-success)'}} /> Approuve</div>
            <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--bg-warning)'}} /> En attente</div>
            <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--lavender)'}} /> Weekend</div>
            {fermetures.length>0 && <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'#EF444433'}} /> Fermeture</div>}
          </div>
          </>;
        })()}
      </div></FadeIn>}

      {/* SOLDES */}
      {tab==='soldes' && <FadeIn><div className="card" style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Collaborateur</th><th>Solde initial</th><th>Acquisition/mois</th><th>Acquis</th><th>Pris</th><th>Solde</th><th></th></tr></thead>
          <tbody>{collabs.map(c => {
            const pris = absences.filter(a => a.collaborateur_id===c.id && a.statut==='approuve' && absenceDeductsSolde(a.type,settings)).reduce((s,a)=>s+countWorkDays(a.date_debut,a.date_fin),0);
            const soldeInit = c.solde_conges||0;
            const acq = c.acquisition_conges||2.08;
            let moisAcq = 0;
            if (c.date_entree) { const e=new Date(c.date_entree); const n=new Date(); moisAcq=Math.max(0,(n.getFullYear()-e.getFullYear())*12+(n.getMonth()-e.getMonth())); }
            const acquis = Math.round(moisAcq*acq*100)/100;
            const solde = Math.round((soldeInit+acquis-pris)*100)/100;
            const color = solde<=0?'var(--red)':solde<=5?'var(--orange)':'var(--green)';
            return <tr key={c.id}>
              <td style={{fontWeight:700,cursor:'pointer',color:'var(--blue)'}} onClick={()=>navigate(`/admin/collaborateurs/${c.id}`)}>{c.prenom} {c.nom}</td>
              <td>{soldeInit}j</td>
              <td>{acq}j/mois</td>
              <td>{acquis}j</td>
              <td>{pris}j</td>
              <td style={{fontWeight:700,color}}>{solde}j</td>
              <td><button className="btn btn-ghost btn-sm" aria-label="Modifier le solde" onClick={()=>{setSoldeModal(c.id);setSoldeForm({solde:soldeInit,acq});}}>✏️</button></td>
            </tr>;
          })}</tbody>
        </table>
      </div></FadeIn>}

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
        <div className="form-grid">
          <div className="form-field">
            <label>Solde initial (jours)</label>
            <input type="number" autoFocus value={soldeForm.solde} onChange={e=>setSoldeForm({...soldeForm,solde:e.target.value})} />
          </div>
          <div className="form-field">
            <label>Acquisition/mois (jours)</label>
            <input type="number" step="0.01" value={soldeForm.acq} onChange={e=>setSoldeForm({...soldeForm,acq:e.target.value})} />
          </div>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost" onClick={()=>setSoldeModal(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={submitSolde} disabled={soldeLoading}>{soldeLoading ? '⏳ En cours...' : '💾 Enregistrer'}</button>
        </div>
      </Modal>
    </div>
  );
}
