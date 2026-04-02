import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
import { api } from '../../services/api';
import { PageHeader, Badge, Avatar, fmtDate, countWorkDays, ABS_TYPES, ABS_STATUTS } from '../../components/UI';

const ABS_BADGE = { en_attente:'orange', approuve:'green', refuse:'pink' };

export default function Absences() {
  const { absences, collabs, showToast, reload } = useData();
  const navigate = useNavigate();
  const [tab, setTab] = useState('pending');
  const [histFilter, setHistFilter] = useState('');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const pending = absences.filter(a => a.statut === 'en_attente');
  const history = absences.filter(a => a.statut !== 'en_attente');
  const filteredHist = histFilter ? history.filter(a => a.collaborateur_id === histFilter) : history;

  const approve = async (id) => {
    try { await api.updateAbsence(id, { statut: 'approuve' }); await reload(); showToast('Approuvé ✓'); } catch(e) { showToast('Erreur: '+e.message); }
  };
  const refuse = async (id) => {
    const motif = window.prompt('Motif du refus :');
    if (!motif) return;
    try { await api.updateAbsence(id, { statut: 'refuse', motif_refus: motif }); await reload(); showToast('Refusé'); } catch(e) { showToast('Erreur: '+e.message); }
  };

  const getName = (id) => { const c = collabs.find(x=>x.id===id); return c ? `${c.prenom} ${c.nom}` : '—'; };

  // Calendar data
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
      {tab==='pending' && <div>
        {pending.length===0 ? <div className="card" style={{textAlign:'center',padding:32,color:'var(--muted)'}}>✅ Aucune demande en attente</div> : pending.map(a => {
          const c = collabs.find(x=>x.id===a.collaborateur_id);
          return <div key={a.id} className="card" style={{marginBottom:10,padding:16,borderLeft:'4px solid var(--orange)'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              {c && <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={36} />}
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:'var(--blue)',cursor:'pointer',fontSize:'0.9rem'}} onClick={()=>c&&navigate(`/admin/collaborateurs/${c.id}`)}>{getName(a.collaborateur_id)}</div>
                <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>{ABS_TYPES[a.type]||a.type} · Du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)} · {countWorkDays(a.date_debut,a.date_fin)}j ouvrés</div>
                {a.commentaire && <div style={{fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic',marginTop:2}}>{a.commentaire}</div>}
              </div>
              <div style={{display:'flex',gap:6}}>
                <button className="btn btn-sm" style={{background:'var(--green)',color:'white'}} onClick={()=>approve(a.id)}>✓ Approuver</button>
                <button className="btn btn-danger btn-sm" onClick={()=>refuse(a.id)}>✕ Refuser</button>
              </div>
            </div>
          </div>;
        })}
      </div>}

      {/* HISTORY */}
      {tab==='history' && <div>
        <div style={{marginBottom:16}}>
          <select value={histFilter} onChange={e=>setHistFilter(e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:10,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.82rem',minWidth:250,background:'var(--offwhite)',color:'var(--navy)'}}>
            <option value="">Tous les collaborateurs</option>
            {collabs.map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
          </select>
        </div>
        <div className="card" style={{overflowX:'auto'}}>
          <table>
            <thead><tr><th>Collaborateur</th><th>Type</th><th>Du</th><th>Au</th><th>Jours</th><th>Statut</th><th>Motif</th></tr></thead>
            <tbody>{filteredHist.length===0 ? <tr><td colSpan={7} style={{textAlign:'center',color:'var(--muted)',padding:32}}>Aucun historique</td></tr> : filteredHist.map(a=>(
              <tr key={a.id}>
                <td style={{fontWeight:700,cursor:'pointer',color:'var(--blue)'}} onClick={()=>navigate(`/admin/collaborateurs/${collabs.find(x=>x.id===a.collaborateur_id)?.id}`)}>{getName(a.collaborateur_id)}</td>
                <td>{ABS_TYPES[a.type]||a.type}</td>
                <td>{fmtDate(a.date_debut)}</td>
                <td>{fmtDate(a.date_fin)}</td>
                <td style={{fontWeight:700}}>{countWorkDays(a.date_debut,a.date_fin)}j</td>
                <td><Badge type={ABS_BADGE[a.statut]}>{ABS_STATUTS[a.statut]}</Badge></td>
                <td style={{fontSize:'0.78rem',color:'var(--text-danger)'}}>{a.motif_refus||'—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>}

      {/* CALENDAR */}
      {tab==='calendar' && <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <button className="btn btn-ghost btn-sm" onClick={calPrev}>←</button>
          <span style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem',textTransform:'capitalize'}}>{monthLabel}</span>
          <button className="btn btn-ghost btn-sm" onClick={calNext}>→</button>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{fontSize:'0.72rem',width:'100%'}}>
            <thead><tr><th style={{textAlign:'left',padding:'4px 8px',minWidth:120}}>Collaborateur</th>
              {Array.from({length:daysInMonth},(_,i)=><th key={i} style={{padding:'2px 3px',textAlign:'center',minWidth:22}}>{i+1}</th>)}
            </tr></thead>
            <tbody>{collabs.map(c => {
              const cAbs = absences.filter(a=>a.collaborateur_id===c.id&&(a.statut==='approuve'||a.statut==='en_attente'));
              return <tr key={c.id}>
                <td style={{padding:'4px 8px',fontWeight:600,whiteSpace:'nowrap',cursor:'pointer',color:'var(--blue)'}} onClick={()=>navigate(`/admin/collaborateurs/${c.id}`)}>{c.prenom} {c.nom[0]}.</td>
                {Array.from({length:daysInMonth},(_,d)=>{
                  const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d+1).padStart(2,'0')}`;
                  const dow=new Date(calYear,calMonth,d+1).getDay();
                  const isWE=dow===0||dow===6;
                  const a=cAbs.find(x=>ds>=x.date_debut&&ds<=x.date_fin);
                  let bg=isWE?'var(--lavender)':'transparent';
                  if(a) bg=a.statut==='approuve'?'var(--bg-success)':'var(--bg-warning)';
                  return <td key={d} style={{padding:1,background:bg,borderRadius:2}} />;
                })}
              </tr>;
            })}</tbody>
          </table>
        </div>
        <div style={{display:'flex',gap:12,marginTop:12,fontSize:'0.7rem',color:'var(--muted)',fontWeight:600}}>
          <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--bg-success)'}} /> Approuvé</div>
          <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--bg-warning)'}} /> En attente</div>
          <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--lavender)'}} /> Weekend</div>
        </div>
      </div>}

      {/* SOLDES */}
      {tab==='soldes' && <div className="card" style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Collaborateur</th><th>Solde initial</th><th>Acquisition/mois</th><th>Acquis</th><th>Pris</th><th>Solde</th><th></th></tr></thead>
          <tbody>{collabs.map(c => {
            const pris = absences.filter(a => a.collaborateur_id===c.id && a.statut==='approuve' && a.type==='conge').reduce((s,a)=>s+countWorkDays(a.date_debut,a.date_fin),0);
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
              <td><button className="btn btn-ghost btn-sm" onClick={async()=>{
                const newSolde = window.prompt('Solde initial :',soldeInit);
                if(newSolde===null) return;
                const newAcq = window.prompt('Acquisition/mois :',acq);
                if(newAcq===null) return;
                try { await api.updateCollaborateur(c.id,{solde_conges:parseFloat(newSolde),acquisition_conges:parseFloat(newAcq)}); await reload(); showToast('Mis à jour'); } catch(e2) { showToast('Erreur: '+e2.message); }
              }}>✏️</button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    </div>
  );
}
