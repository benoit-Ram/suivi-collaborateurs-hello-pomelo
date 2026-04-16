import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { Badge, ProgressBar, STATUS_COLORS, STATUS_LABELS, fmtDate } from '../../../components/UI';

export default function ObjCard({ o, i, collabId }) {
  const pct = o.statut==='atteint'?100:(o.progression||0);
  const colors = { 'en-cours':'linear-gradient(90deg,var(--pink),var(--blue))', 'atteint':'var(--green)', 'non-atteint':'var(--orange)', 'en-attente':'var(--lavender)' };
  const hist = o.historique || [];
  const canPropose = o.statut === 'en-cours';

  const [showForm, setShowForm] = useState(false);
  const [newProg, setNewProg] = useState(pct);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingReq, setPendingReq] = useState(null);
  const [sent, setSent] = useState(false);

  // Check if there's already a pending request for this objective
  useEffect(() => {
    if (!collabId || !o.id) return;
    api.getObjectifRequests({ statut: 'en_attente' }).then(reqs => {
      const mine = (reqs || []).find(r => r.objectif_id === o.id);
      if (mine) setPendingReq(mine);
    }).catch(() => {});
  }, [collabId, o.id, sent]);

  const submitProposal = async () => {
    if (newProg === pct && !comment) return;
    setSubmitting(true);
    try {
      await api.createObjectifRequest({
        objectif_id: o.id,
        type: 'progression',
        data: { progression: newProg, commentaire: comment, ancienne_progression: pct },
        motif: comment || null,
        manager_id: null, // Will be handled by the manager's view
      });
      setSent(true);
      setShowForm(false);
      setComment('');
    } catch(e) { alert('Erreur: ' + e.message); }
    setSubmitting(false);
  };

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

      {/* Pending request indicator */}
      {pendingReq && <div style={{marginTop:8,padding:'6px 10px',background:'var(--bg-warning)',borderRadius:8,fontSize:'0.75rem',color:'var(--text-warning)',fontWeight:600}}>
        ⏳ Proposition en attente : {pendingReq.data?.progression}% {pendingReq.motif ? `— "${pendingReq.motif}"` : ''}
      </div>}

      {/* Sent confirmation */}
      {sent && !pendingReq && <div style={{marginTop:8,padding:'6px 10px',background:'var(--bg-success)',borderRadius:8,fontSize:'0.75rem',color:'var(--text-success)',fontWeight:600}}>
        ✓ Proposition envoyée !
      </div>}

      {/* Propose progression button + form */}
      {canPropose && !pendingReq && !sent && <>
        {!showForm ? (
          <button className="btn btn-ghost btn-sm" style={{marginTop:8,fontSize:'0.72rem'}} onClick={()=>{setShowForm(true);setNewProg(pct);}}>📈 Proposer une progression</button>
        ) : (
          <div style={{marginTop:10,padding:'10px 12px',background:'var(--offwhite)',borderRadius:10,border:'1.5px dashed var(--lavender)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <span style={{fontSize:'0.72rem',fontWeight:700,color:'var(--navy)'}}>Nouvelle progression :</span>
              <input type="range" min="0" max="100" step="5" value={newProg} onChange={e=>setNewProg(parseInt(e.target.value))} style={{flex:1,accentColor:'var(--pink)'}} />
              <span style={{fontWeight:700,color:'var(--pink)',fontSize:'0.9rem',minWidth:35}}>{newProg}%</span>
            </div>
            <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Commentaire / justification (optionnel)" style={{width:'100%',border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px 10px',fontFamily:'inherit',fontSize:'0.82rem',minHeight:50,resize:'vertical',outline:'none',marginBottom:8}} />
            <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowForm(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" onClick={submitProposal} disabled={submitting || (newProg===pct && !comment)}>{submitting ? '⏳...' : '📩 Envoyer'}</button>
            </div>
          </div>
        )}
      </>}

      {/* History */}
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
