import React from 'react';
import { Badge, ProgressBar, STATUS_COLORS, STATUS_LABELS, fmtDate } from '../../../components/UI';

export default function ObjCard({ o, i }) {
  const pct = o.statut==='atteint'?100:(o.progression||0);
  const colors = { 'en-cours':'linear-gradient(90deg,var(--pink),var(--blue))', 'atteint':'var(--green)', 'non-atteint':'var(--orange)', 'en-attente':'var(--lavender)' };
  const hist = o.historique || [];
  return (
    <div className="card" style={{marginBottom:10,padding:16,borderLeft:`4px solid ${o.statut==='atteint'?'var(--green)':'var(--pink)'}`,opacity:o.statut==='atteint'?0.85:1}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <span style={{background:o.statut==='atteint'?'var(--green)':'var(--pink)',color:'white',borderRadius:'50%',width:24,height:24,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',fontWeight:800}}>{o.statut==='atteint'?'✓':i+1}</span>
        <span style={{flex:1,fontWeight:700,color:'var(--navy)'}}>{o.titre}</span>
        <Badge type={STATUS_COLORS[o.statut]}>{STATUS_LABELS[o.statut]}</Badge>
        {o.recurrence && <Badge type="blue">🔄</Badge>}
      </div>
      {o.description && <div style={{fontSize:'0.82rem',color:'var(--muted)',marginBottom:8}}>{o.description}</div>}
      <div style={{marginBottom:6}}><div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',marginBottom:4}}><span>Progression</span><span>{pct}%</span></div><ProgressBar value={pct} color={colors[o.statut]} /></div>
      <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>📅 {fmtDate(o.date_debut)} → {fmtDate(o.date_fin)}</div>
      {hist.length > 0 && (
        <details style={{marginTop:8}}>
          <summary style={{fontSize:'0.72rem',color:'var(--muted)',cursor:'pointer',fontWeight:700}}>📜 Historique ({hist.length})</summary>
          <div style={{marginTop:6,paddingLeft:8,borderLeft:'2px solid var(--lavender)'}}>
            {hist.map((h,idx)=>(
              <div key={idx} style={{marginBottom:6,fontSize:'0.75rem'}}>
                <div style={{fontWeight:700,color:'var(--navy)'}}>{fmtDate(h.date)} — {h.auteur || 'Inconnu'}</div>
                {(h.changes||[]).map((ch,j)=>(
                  <div key={j} style={{color:'var(--muted)',marginLeft:8}}>
                    {ch.champ === 'Création' ? <span>✨ Création : <strong>{ch.apres}</strong></span>
                      : <span>{ch.champ} : <span style={{textDecoration:'line-through',opacity:0.6}}>{ch.avant}</span> → <strong>{ch.apres}</strong></span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
