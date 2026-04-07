import React, { useState } from 'react';
import { getFeriesSet } from '../../../components/UI';

export default function LeaveCalendar({ absences, fermetures = [] }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const feriesSet = getFeriesSet(year);
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month+1, 0);
  const startDow = (firstDay.getDay()+6)%7;
  const today = new Date().toISOString().split('T')[0];
  const monthLabel = firstDay.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});

  const prev = () => { if(month===0){setMonth(11);setYear(year-1)}else setMonth(month-1) };
  const next = () => { if(month===11){setMonth(0);setYear(year+1)}else setMonth(month+1) };

  const rows = [];
  let dayNum = 1;
  for (let row=0; row<6; row++) {
    if (dayNum > lastDay.getDate()) break;
    const cells = [];
    for (let col=0; col<7; col++) {
      if ((row===0 && col<startDow) || dayNum>lastDay.getDate()) { cells.push(<td key={col} />); }
      else {
        const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
        const isFerie = feriesSet.has(ds);
        const isFerm = fermetures.some(f=>ds>=f.debut&&ds<=f.fin);
        const isWE = col>=5;
        const isToday = ds===today;
        const abs = absences.find(a => ds>=a.date_debut && ds<=a.date_fin && a.statut!=='annule');
        let bg='transparent',color='var(--navy)';
        if(isWE||isFerie) { bg='#8F8FBC33'; color='#8F8FBC'; }
        if(isFerm) { bg='#EF444422'; color='#EF4444'; }
        if(abs) { bg=abs.statut==='approuve'?'var(--bg-success)':abs.statut==='en_attente'?'var(--bg-warning)':'var(--bg-danger)'; color=abs.statut==='approuve'?'var(--text-success)':abs.statut==='en_attente'?'var(--text-warning)':'var(--text-danger)'; }
        if(isToday) { bg='var(--pink)'; color='white'; }
        cells.push(<td key={col} title={isFerm?fermetures.find(f=>ds>=f.debut&&ds<=f.fin)?.label:isFerie?'Jour ferie':''} style={{padding:2,textAlign:'center'}}><div style={{width:28,height:28,lineHeight:'28px',margin:'0 auto',borderRadius:8,background:bg,color,fontWeight:isToday||abs?700:500,fontSize:'0.78rem'}}>{dayNum}</div></td>);
        dayNum++;
      }
    }
    rows.push(<tr key={row}>{cells}</tr>);
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <button className="btn btn-ghost btn-sm" onClick={prev}>←</button>
        <span style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem',textTransform:'capitalize'}}>{monthLabel}</span>
        <button className="btn btn-ghost btn-sm" onClick={next}>→</button>
      </div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.78rem'}}>
        <thead><tr>{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=><th key={d} style={{padding:'6px 4px',textAlign:'center',color:'var(--muted)',fontSize:'0.68rem',fontWeight:700}}>{d}</th>)}</tr></thead>
        <tbody>{rows}</tbody>
      </table>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:12,fontSize:'0.7rem',fontWeight:600,color:'var(--muted)'}}>
        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--bg-success)'}} /> Approuvé</div>
        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--bg-warning)'}} /> En attente</div>
        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--bg-info)'}} /> Férié</div>
        <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:12,height:12,borderRadius:3,background:'var(--pink)'}} /> Aujourd'hui</div>
      </div>
    </div>
  );
}
