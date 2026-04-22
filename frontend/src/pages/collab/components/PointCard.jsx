import React, { useState } from 'react';
import { api } from '../../../services/api';
import { Badge, Modal, moisLabel, fmtDate, isEntretienLocked, daysUntilEntretienLock, getEntretienStatus, escapeHtml, ENTRETIEN_STATUS_BADGE } from '../../../components/UI';
import { useData } from '../../../services/DataContext';
import { getCollabQuestions, getManagerQuestions } from '../utils/questions';

export default function PointCard({ p, collabId, collab, settings, objectifs = [] }) {
  const { showToast } = useData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const md = p.manager_data||{}; const cd = p.collab_data||{};
  const locked = isEntretienLocked(p.mois);
  const daysLeft = daysUntilEntretienLock(p.mois);
  const closeToLock = !locked && daysLeft !== null && daysLeft <= 10;
  const status = getEntretienStatus(p);
  const statusBadge = locked ? {label:'🔒 Verrouillé',type:'gray'} : ENTRETIEN_STATUS_BADGE[status];

  const collabQuestions = getCollabQuestions(settings, collab);
  const managerQuestions = getManagerQuestions(settings, collab).questions;
  const activeObjectifs = objectifs.filter(o => o.statut !== 'atteint');

  const startEdit = () => {
    const data = {};
    collabQuestions.forEach(q => { data[q.key] = cd[q.key] || ''; });
    activeObjectifs.forEach(o => { data['obj_'+o.id] = cd['obj_'+o.id] || ''; });
    data._commentaire = cd._commentaire || '';
    setFormData(data);
    setEditing(true);
  };

  const saveResponses = async () => {
    setSaving(true);
    try {
      await api.updatePointSuivi(p.id, { collab_data: formData });
      setEditing(false);
      showToast('✓ Tes réponses ont été enregistrées');
    } catch(e) { console.error(e); showToast('❌ Erreur : ' + e.message); }
    setSaving(false);
  };

  const exportPDF = () => {
    const win = window.open('','_blank');
    if (!win) { alert('Le popup a été bloqué. Autorisez les popups pour exporter en PDF.'); return; }
    win.document.write(`<html><head><title>Entretien RH ${moisLabel(p.mois)}</title><style>body{font-family:Quicksand,Arial,sans-serif;padding:32px;max-width:800px;margin:0 auto;color:#05056D}h1{font-size:1.3rem}h2{font-size:1rem;color:#FF3285;margin:20px 0 8px}.field{margin-bottom:12px}.field-label{font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#6B6B9A;margin-bottom:2px}.field-value{font-size:0.9rem;line-height:1.5;padding:8px 0;border-bottom:1px solid #CFD0E5}@media print{body{padding:16px}}</style></head><body>`);
    win.document.write(`<h1>Entretien RH — ${escapeHtml(moisLabel(p.mois))}</h1>`);
    win.document.write(`<h2>👔 Manager</h2>`);
    managerQuestions.forEach(q => { win.document.write(`<div class="field"><div class="field-label">${escapeHtml(q.label)}</div><div class="field-value">${md[q.key]?escapeHtml(md[q.key]):'—'}</div></div>`); });
    win.document.write(`<h2>👤 Collaborateur</h2>`);
    collabQuestions.forEach(q => { win.document.write(`<div class="field"><div class="field-label">${escapeHtml(q.label)}</div><div class="field-value">${cd[q.key]?escapeHtml(cd[q.key]):'—'}</div></div>`); });
    if (activeObjectifs.some(o=>cd['obj_'+o.id])) { win.document.write(`<h2>🎯 Avancement objectifs</h2>`); activeObjectifs.filter(o=>cd['obj_'+o.id]).forEach(o => { win.document.write(`<div class="field"><div class="field-label">${escapeHtml(o.titre)} (${Number(o.progression)||0}%)</div><div class="field-value">${escapeHtml(cd['obj_'+o.id])}</div></div>`); }); }
    if (cd._commentaire) win.document.write(`<div class="field"><div class="field-label">Commentaire libre</div><div class="field-value">${escapeHtml(cd._commentaire)}</div></div>`);
    win.document.write(`<div style="margin-top:40px;font-size:0.75rem;color:#6B6B9A">Exporté le ${new Date().toLocaleDateString('fr-FR')}</div></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="card" style={{marginBottom:10,padding:0,overflow:'hidden'}}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',cursor:'pointer'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontWeight:700,color:'var(--navy)'}}>📅 {moisLabel(p.mois)}</span>
          <Badge type={statusBadge.type}>{statusBadge.label}</Badge>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {locked && <button className="btn btn-ghost btn-sm" style={{padding:'3px 8px',fontSize:'0.68rem'}} onClick={e=>{e.stopPropagation();exportPDF();}}>📄 PDF</button>}
          <span style={{color:'var(--muted)'}}>{open?'▲':'▼'}</span>
        </div>
      </div>
      {open && <div style={{padding:'0 18px 18px',borderTop:'1px solid var(--lavender)'}}>
        {locked && <div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.78rem',color:'var(--muted)',marginTop:10,marginBottom:10}}>🔒 Cet entretien est verrouillé et n'est plus modifiable.</div>}
        {closeToLock && <div style={{background:'var(--bg-warning)',borderRadius:8,padding:'8px 12px',fontSize:'0.78rem',color:'var(--text-warning)',marginTop:10,marginBottom:10,borderLeft:'3px solid var(--border-warning)'}}>⏰ Il reste <strong>{daysLeft} jour{daysLeft>1?'s':''}</strong> pour compléter cet entretien (verrouillage le 5 du mois suivant).</div>}

        <div style={{marginTop:10,fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--skyblue)',marginBottom:8}}>👔 Retours Manager</div>
        {managerQuestions.map(q=>(<div key={q.key} style={{marginBottom:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>{q.label}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:md[q.key]?'var(--navy)':'var(--muted)',fontStyle:md[q.key]?'normal':'italic'}}>{md[q.key]||'Non renseigné'}</div></div>))}

        <div style={{marginTop:16,paddingTop:14,borderTop:'1px dashed var(--lavender)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)'}}>✏️ Mes réponses</div>
          {!editing && !locked && <button className="btn btn-ghost btn-sm" onClick={startEdit}>✏️ Remplir</button>}
        </div>
        {editing ? <>
          {collabQuestions.map(q => (
            <div key={q.key} style={{marginBottom:10,marginTop:8}}>
              <label style={{fontSize:'0.72rem',fontWeight:700,color:'var(--pink)',display:'block',marginBottom:4}}>{q.label}</label>
              {q.type==='notation' ? <div style={{display:'flex',gap:6,marginTop:4}}>{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setFormData({...formData,[q.key]:String(n)})} style={{width:40,height:40,borderRadius:10,border:`2px solid ${String(formData[q.key])===String(n)?'var(--pink)':'var(--lavender)'}`,background:String(formData[q.key])===String(n)?'var(--pink)':'white',color:String(formData[q.key])===String(n)?'white':'var(--navy)',fontSize:'0.95rem',fontWeight:700,cursor:'pointer',transition:'all 0.15s'}}>{n}</button>)}</div>
              : <textarea value={formData[q.key]||''} onChange={e=>setFormData({...formData,[q.key]:e.target.value})} placeholder="Votre réponse..." style={{width:'100%',border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.85rem',minHeight:60,resize:'vertical',outline:'none'}} />}
            </div>
          ))}
          {activeObjectifs.length > 0 && <>
            <div style={{marginTop:14,paddingTop:12,borderTop:'1px dashed var(--lavender)',fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--green)',marginBottom:8}}>🎯 Avancement de mes objectifs</div>
            {activeObjectifs.map(o => (
              <div key={o.id} style={{marginBottom:10}}>
                <label style={{fontSize:'0.72rem',fontWeight:700,color:'var(--navy)',display:'block',marginBottom:4}}>{o.titre} <span style={{color:'var(--muted)',fontWeight:600}}>({o.progression||0}%)</span></label>
                <textarea value={formData['obj_'+o.id]||''} onChange={e=>setFormData({...formData,['obj_'+o.id]:e.target.value})} placeholder="Avancement, blocages, prochaines etapes..." style={{width:'100%',border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.85rem',minHeight:50,resize:'vertical',outline:'none'}} />
              </div>
            ))}
          </>}
          <div style={{marginBottom:10,marginTop:12}}>
            <label style={{fontSize:'0.72rem',fontWeight:700,color:'var(--pink)',display:'block',marginBottom:4}}>💬 Commentaire libre (optionnel)</label>
            <textarea value={formData._commentaire||''} onChange={e=>setFormData({...formData,_commentaire:e.target.value})} placeholder="Ajoutez tout élément supplémentaire..." style={{width:'100%',border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.85rem',minHeight:60,resize:'vertical',outline:'none'}} />
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(false)}>Annuler</button>
            <button className="btn btn-primary btn-sm" onClick={saveResponses} disabled={saving}>💾 Sauvegarder</button>
          </div>
        </> : <>
          {collabQuestions.map(q => {
            const v = cd[q.key];
            return v ? <div key={q.key} style={{marginBottom:8,marginTop:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>{q.label}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:'var(--navy)'}}>{q.type==='notation'?<div style={{display:'flex',gap:4}}>{[1,2,3,4,5].map(n=><span key={n} style={{width:28,height:28,borderRadius:6,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'0.8rem',fontWeight:700,background:Number(v)>=n?'var(--pink)':'var(--lavender)',color:Number(v)>=n?'white':'var(--muted)'}}>{n}</span>)}</div>:v}</div></div> : null;
          })}
          {activeObjectifs.some(o=>cd['obj_'+o.id]) && <>
            <div style={{marginTop:12,paddingTop:10,borderTop:'1px dashed var(--lavender)',fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--green)',marginBottom:8}}>🎯 Avancement objectifs</div>
            {activeObjectifs.filter(o=>cd['obj_'+o.id]).map(o=>(
              <div key={o.id} style={{marginBottom:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>{o.titre}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:'var(--navy)'}}>{cd['obj_'+o.id]}</div></div>
            ))}
          </>}
          {cd._commentaire && <div style={{marginBottom:8,marginTop:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>Commentaire libre</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:'var(--navy)'}}>{cd._commentaire}</div></div>}
          {!Object.keys(cd).some(k=>cd[k]) && <p style={{fontSize:'0.82rem',color:'var(--muted)',fontStyle:'italic',marginTop:8}}>Vous n'avez pas encore rempli vos réponses.</p>}
        </>}
      </div>}
    </div>
  );
}
