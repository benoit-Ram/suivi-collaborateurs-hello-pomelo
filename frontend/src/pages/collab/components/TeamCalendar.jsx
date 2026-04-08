import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { getFeriesSet } from '../../../components/UI';

export default function TeamCalendar({ collab, fermetures = [] }) {
  const [teammates, setTeammates] = useState([]);
  const [teamAbs, setTeamAbs] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  useEffect(() => {
    const equipes = (collab.equipe||'').split(',').map(s=>s.trim()).filter(Boolean);
    if (!equipes.length) return;
    (async () => {
      try {
        const [all, abs] = await Promise.all([api.getCollaborateurs(), api.getAbsences()]);
        const mates = (all||[]).filter(c => c.equipe && equipes.some(e => c.equipe.includes(e)));
        mates.sort((a,b) => a.id===collab.id ? -1 : b.id===collab.id ? 1 : 0);
        setTeammates(mates);
        const ids = mates.map(m=>m.id);
        setTeamAbs((abs||[]).filter(a => ids.includes(a.collaborateur_id) && (a.statut==='approuve'||a.statut==='en_attente')));
      } catch(e) { console.error('Erreur chargement calendrier équipe:', e); }
    })();
  }, [collab.id]);

  if (!teammates.length) return <p style={{color:'var(--muted)',fontSize:'0.85rem'}}>Aucun collègue dans vos équipes.</p>;

  const prev = () => { if(month===0){setMonth(11);setYear(year-1)}else setMonth(month-1) };
  const next = () => { if(month===11){setMonth(0);setYear(year+1)}else setMonth(month+1) };
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  const feries = getFeriesSet(year);

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <button className="btn btn-ghost btn-sm" onClick={prev}>←</button>
        <span style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem',textTransform:'capitalize'}}>{monthLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={next}>→</button>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{fontSize:'0.72rem',width:'100%'}}>
          <thead><tr><th style={{textAlign:'left',padding:'4px 8px'}}>Collegue</th>
            {Array.from({length:daysInMonth},(_,i)=>{
              const dow=new Date(year,month,i+1).getDay();
              const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
              const isOff=dow===0||dow===6||feries.has(ds);
              return <th key={i} style={{padding:'2px 4px',textAlign:'center',color:isOff?'#8F8FBC':'var(--muted)',fontWeight:isOff?400:700}}>{i+1}</th>;
            })}
          </tr></thead>
          <tbody>{teammates.map(c => {
            const abs = teamAbs.filter(a=>a.collaborateur_id===c.id);
            return <tr key={c.id}><td style={{padding:'4px 8px',fontWeight:c.id===collab.id?800:600,whiteSpace:'nowrap',color:c.id===collab.id?'var(--pink)':'var(--navy)'}}>{c.prenom}{c.id===collab.id?' (moi)':''}</td>
              {Array.from({length:daysInMonth},(_,d)=>{
                const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d+1).padStart(2,'0')}`;
                const dow = new Date(year,month,d+1).getDay();
                const isWE = dow===0||dow===6;
                const isFerie = feries.has(ds);
                const isFerm = fermetures.some(f=>ds>=f.debut&&ds<=f.fin);
                const a = abs.find(x=>ds>=x.date_debut&&ds<=x.date_fin);
                let bg = isWE||isFerie?'var(--lavender)':isFerm?'#EF444422':'transparent';
                if(a && !isWE && !isFerie) bg = a.statut==='approuve'?'var(--bg-success)':'var(--bg-warning)';
                return <td key={d} title={isFerm?fermetures.find(f=>ds>=f.debut&&ds<=f.fin)?.label:isFerie?'Jour ferie':''} style={{padding:2,textAlign:'center',background:bg,borderRadius:2}} />;
              })}
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
