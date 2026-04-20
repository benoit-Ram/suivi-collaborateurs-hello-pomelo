import React from 'react';
import { Badge, Avatar, fmtDate } from '../../../components/UI';
import { calcConsumedBudget, getClientName } from '../../../utils/missionCalcs';

export default function MissionCard({ m, collabs, onEdit, onDelete, onAssign, onRemoveAssign, onDetail, onDuplicate }) {
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
          <div style={{fontSize:'0.82rem',color:'var(--muted)',marginTop:2}}>{getClientName(m)}{m.categorie ? ` · ${m.categorie}` : ''}</div>
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
