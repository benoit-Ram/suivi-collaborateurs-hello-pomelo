import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { getFeriesSet } from '../../../components/UI';

export default 
function ManagerTeamCalendar({ team, teamPendingAbs = [] }) {
  const [allAbs, setAllAbs] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  useEffect(() => {
    if (!team.length) return;
    const ids = team.map(m => m.id);
    api.getAbsences().then(data => {
      setAllAbs((data||[]).filter(a => ids.includes(a.collaborateur_id) && (a.statut==='approuve'||a.statut==='en_attente')));
    }).catch(e => console.error('Team calendar error:', e));
  }, [team, teamPendingAbs]);

  if (!team.length) return null;

  const prev = () => { if(month===0){setMonth(11);setYear(year-1)}else setMonth(month-1) };
  const next = () => { if(month===11){setMonth(0);setYear(year+1)}else setMonth(month+1) };
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  const feries = getFeriesSet(year);

  return (
    <div className="card" style={{marginBottom:20,padding:16}}>
      <div style={{fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
        📅 Planning equipe
        <span style={{flex:1,height:1,background:'var(--lavender)'}} />
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <button className="btn btn-ghost btn-sm" onClick={prev}>←</button>
        <span style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem',textTransform:'capitalize'}}>{monthLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={next}>→</button>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{fontSize:'0.72rem',width:'100%',borderCollapse:'collapse'}}>
          <thead><tr><th style={{textAlign:'left',padding:'4px 8px',position:'sticky',left:0,background:'var(--white)',zIndex:1}}>Membre</th>
            {Array.from({length:daysInMonth},(_,i)=>{
              const dow = new Date(year,month,i+1).getDay();
              const isWE = dow===0||dow===6;
              const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
              const isFerie = feries.has(ds);
              return <th key={i} style={{padding:'2px 4px',textAlign:'center',color:isWE||isFerie?'var(--lavender)':'var(--muted)',fontWeight:isWE||isFerie?400:700}}>{i+1}</th>;
            })}
          </tr></thead>
          <tbody>{team.map(c => {
            const abs = allAbs.filter(a=>a.collaborateur_id===c.id);
            return <tr key={c.id}><td style={{padding:'4px 8px',fontWeight:600,whiteSpace:'nowrap',color:'var(--navy)',position:'sticky',left:0,background:'var(--white)',zIndex:1}}>{c.prenom}</td>
              {Array.from({length:daysInMonth},(_,d)=>{
                const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d+1).padStart(2,'0')}`;
                const dow = new Date(year,month,d+1).getDay();
                const isWE = dow===0||dow===6;
                const isFerie = feries.has(ds);
                const a = abs.find(x=>ds>=x.date_debut&&ds<=x.date_fin);
                let bg = isWE||isFerie?'var(--lavender)':'transparent';
                let title = isFerie?'Jour férié':'';
                if(a && !isWE && !isFerie) { bg = a.statut==='approuve'?'#22C55E':'#F97316'; title = a.statut==='approuve'?'Approuvé':'En attente'; }
                return <td key={d} title={title} style={{padding:2,textAlign:'center',background:bg,borderRadius:2,minWidth:18}} />;
              })}
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div style={{display:'flex',gap:16,marginTop:10,fontSize:'0.7rem',color:'var(--muted)'}}>
        <span><span style={{display:'inline-block',width:12,height:12,background:'#22C55E',borderRadius:2,verticalAlign:'middle',marginRight:4}} />Approuve</span>
        <span><span style={{display:'inline-block',width:12,height:12,background:'#F97316',borderRadius:2,verticalAlign:'middle',marginRight:4}} />En attente</span>
        <span><span style={{display:'inline-block',width:12,height:12,background:'var(--lavender)',borderRadius:2,verticalAlign:'middle',marginRight:4}} />Weekend</span>
      </div>
    </div>
  );
}
