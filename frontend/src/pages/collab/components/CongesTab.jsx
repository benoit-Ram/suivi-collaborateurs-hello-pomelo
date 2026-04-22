import React, { useState } from 'react';
import { api } from '../../../services/api';
import { useData } from '../../../services/DataContext';
import { Badge, FadeIn, Modal, fmtDate, countWorkDays, absenceDays, ABS_TYPES, getAbsenceTypes, absenceDeductsSolde } from '../../../components/UI';
import LeaveCalendar from './LeaveCalendar';
import TeamCalendar from './TeamCalendar';

export default
function CongesTab({ c, absences, solde, onReload, settings }) {
  const { showToast } = useData();
  const absTypes = getAbsenceTypes(settings);
  const [form, setForm] = useState({ type: Object.keys(absTypes)[0] || 'conge', date_debut:'', date_fin:'', demi_journee:'', commentaire:'' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cancelId, setCancelId] = useState(null);
  const [cancelMotif, setCancelMotif] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [editingId, setEditingId] = useState(null); // editing a pending request

  const submitCancel = async () => {
    if (!cancelMotif.trim()) return;
    setCancelLoading(true);
    try {
      await api.updateAbsence(cancelId, { statut: 'annulation_demandee', commentaire_annulation: cancelMotif.trim() });
      setCancelId(null); setCancelMotif('');
      onReload();
      showToast('🔄 Demande d\'annulation envoyée');
    } catch(e) { setError('Erreur: ' + e.message); showToast('❌ Erreur — ' + e.message); }
    setCancelLoading(false);
  };

  // Compute days for current form
  const formDays = form.date_debut && form.date_fin && form.date_fin >= form.date_debut
    ? (form.demi_journee ? 0.5 : countWorkDays(form.date_debut, form.date_fin)) : 0;
  const typeDeducts = absenceDeductsSolde(form.type, settings);
  const newSolde = typeDeducts ? solde - formDays : solde;

  const submit = async () => {
    setError('');
    if (!form.date_debut || !form.date_fin) { setError('Veuillez renseigner les dates.'); return; }
    if (form.date_fin < form.date_debut) { setError('La date de fin doit etre apres la date de debut.'); return; }
    if (form.demi_journee && form.date_debut !== form.date_fin) { setError('Pour une demi-journee, les dates doivent etre identiques.'); return; }
    // Block past dates
    const today = new Date().toISOString().split('T')[0];
    if (form.date_debut < today) { setError('Impossible de poser des conges dans le passe.'); return; }
    // Block 0-day requests (weekends, holidays)
    if (formDays === 0) { setError('Cette periode ne contient aucun jour ouvre (weekend ou jour ferie).'); return; }
    // Comment required for "autre" type
    if (form.type === 'autre' && !form.commentaire?.trim()) { setError('Le commentaire est obligatoire pour une absence de type "Autre".'); return; }
    // Balance check
    if (typeDeducts && newSolde < 0) { setError(`Solde insuffisant (${solde.toFixed(2)}j). Cette absence necessite ${formDays}j.`); return; }
    // Overlap check (handles AM/PM half-days, exclude self if editing)
    const overlap = absences.find(a => {
      if (a.id === editingId) return false; // skip self when editing
      if (a.statut === 'refuse' || a.statut === 'annule') return false;
      if (form.date_debut > a.date_fin || form.date_fin < a.date_debut) return false;
      if (form.demi_journee && a.demi_journee && form.date_debut === a.date_debut) {
        return form.demi_journee === a.demi_journee;
      }
      return true;
    });
    if (overlap) { setError(`Chevauchement avec une absence existante du ${fmtDate(overlap.date_debut)} au ${fmtDate(overlap.date_fin)}.`); return; }

    setSubmitting(true);
    try {
      if (editingId) {
        await api.updateAbsence(editingId, { type: form.type, date_debut: form.date_debut, date_fin: form.date_fin, demi_journee: form.demi_journee || null, commentaire: form.commentaire || null });
        setEditingId(null);
        showToast('✓ Demande modifiée');
      } else {
        await api.createAbsence({ collaborateur_id: c.id, type: form.type, date_debut: form.date_debut, date_fin: form.date_fin, demi_journee: form.demi_journee || null, statut: 'en_attente', commentaire: form.commentaire || null });
        showToast('✓ Demande envoyée — ton manager a été notifié');
      }
      setForm({ type: Object.keys(absTypes)[0] || 'conge', date_debut:'', date_fin:'', demi_journee:'', commentaire:'' });
      onReload();
    } catch(e) { setError('Erreur: ' + e.message); showToast('❌ Erreur — ' + e.message); }
    setSubmitting(false);
  };

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:10,marginBottom:20}}>
        <div className="card" style={{textAlign:'center',padding:16}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--green)'}}>{solde.toFixed(2)}j</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Solde</div></div>
        <div className="card" style={{textAlign:'center',padding:16}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--pink)'}}>{absences.filter(a=>a.statut==='approuve').length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Approuves</div></div>
        <div className="card" style={{textAlign:'center',padding:16}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--orange)'}}>{absences.filter(a=>a.statut==='en_attente').length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>En attente</div></div>
      </div>

      {/* Formulaire de demande */}
      <div className="card" style={{marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div className="section-title" style={{marginTop:0}}>{editingId ? '✏️ Modifier la demande' : 'Nouvelle demande'}</div>{editingId && <button className="btn btn-ghost btn-sm" onClick={()=>{setEditingId(null);setForm({type:Object.keys(absTypes)[0]||'conge',date_debut:'',date_fin:'',demi_journee:'',commentaire:''});}}>Annuler modification</button>}</div>
        <div className="form-grid">
          <div className="form-field"><label>Type</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{Object.entries(absTypes).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          <div className="form-field"><label>Du</label><input type="date" min={new Date().toISOString().split('T')[0]} value={form.date_debut} onChange={e=>{const v=e.target.value; const next=new Date(v); next.setDate(next.getDate()+1); const nextStr=next.toISOString().split('T')[0]; setForm({...form,date_debut:v, date_fin: form.demi_journee ? v : (form.date_fin && form.date_fin > v ? form.date_fin : nextStr)});}} /></div>
          <div className="form-field"><label>Au</label><input type="date" min={form.date_debut||new Date().toISOString().split('T')[0]} value={form.date_fin} onChange={e=>setForm({...form,date_fin:e.target.value})} disabled={!!form.demi_journee} /></div>
          <div className="form-field"><label>Duree</label><select value={form.demi_journee} onChange={e=>setForm({...form,demi_journee:e.target.value, date_fin: e.target.value ? form.date_debut : form.date_fin})}>
            <option value="">Journee(s) complete(s)</option>
            <option value="AM">Demi-journee matin</option>
            <option value="PM">Demi-journee apres-midi</option>
          </select></div>
          <div className="form-field"><label>Commentaire</label><input type="text" value={form.commentaire} onChange={e=>setForm({...form,commentaire:e.target.value})} placeholder="Optionnel..." /></div>
        </div>
        {/* Calcul temps réel */}
        {formDays > 0 && (
          <div style={{marginTop:10,padding:'12px 16px',background:'var(--bg-info)',borderRadius:10,fontSize:'0.85rem',color:'var(--text-info)',display:'flex',gap:20,flexWrap:'wrap'}}>
            <span><strong>{formDays}</strong> jour{formDays>1?'s':''} ouvre{formDays>1?'s':''}{form.demi_journee ? ` (${form.demi_journee === 'AM' ? 'matin' : 'apres-midi'})` : ''}</span>
            {typeDeducts && <span>Solde apres : <strong style={{color:newSolde<0?'var(--red)':'var(--text-info)'}}>{newSolde.toFixed(2)}j</strong></span>}
            {!typeDeducts && <span style={{fontStyle:'italic'}}>Ce type ne decompte pas du solde</span>}
          </div>
        )}
        {error && <div style={{marginTop:10,padding:'10px 14px',background:'var(--bg-danger)',color:'var(--text-danger)',borderRadius:10,fontSize:'0.85rem',fontWeight:600,borderLeft:'4px solid var(--border-danger)'}}>{error}</div>}
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>{submitting ? '⏳ En cours...' : editingId ? '💾 Modifier' : '🏖️ Demander'}</button>
        </div>
      </div>

      {/* Calendrier personnel */}
      <div className="card" style={{marginBottom:24}}>
        <div className="section-title" style={{marginTop:0}}>📅 Mon calendrier</div>
        <LeaveCalendar absences={absences} fermetures={settings?.periodes_fermeture||[]} />
      </div>

      {/* Calendrier équipe */}
      <div className="card" style={{marginBottom:24}}>
        <div className="section-title" style={{marginTop:0}}>👥 Calendrier d'equipe</div>
        <TeamCalendar collab={c} fermetures={settings?.periodes_fermeture||[]} />
      </div>

      {/* En attente + annulation demandée */}
      {absences.filter(a=>a.statut==='en_attente'||a.statut==='annulation_demandee').length > 0 && <>
        <div className="section-title">⏳ Demandes en attente</div>
        {absences.filter(a=>a.statut==='en_attente'||a.statut==='annulation_demandee').map(a => (
          <div key={a.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',borderRadius:12,border:`1.5px solid ${a.statut==='annulation_demandee'?'var(--red)':'var(--orange)'}`,marginBottom:8,background:a.statut==='annulation_demandee'?'var(--bg-danger)':'var(--bg-warning)'}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:'0.9rem',color:'var(--navy)'}}>{ABS_TYPES[a.type]||a.type}</div>
              <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:2}}>Du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)} · {absenceDays(a)}j ouvré{absenceDays(a)>1?'s':''}</div>
              {a.commentaire && <div style={{fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic',marginTop:2}}>{a.commentaire}</div>}
              {a.statut==='annulation_demandee' && <div style={{fontSize:'0.78rem',color:'var(--red)',fontWeight:600,marginTop:4}}>🔄 Annulation demandee{a.commentaire_annulation ? ' : '+a.commentaire_annulation : ''}</div>}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
              <Badge type={a.statut==='annulation_demandee'?'pink':'orange'}>{a.statut==='annulation_demandee'?'🔄 Annulation':'⏳ En attente'}</Badge>
              {a.statut==='en_attente' && <div style={{display:'flex',gap:4}}>
                <button className="btn btn-ghost btn-sm" style={{padding:'4px 10px',fontSize:'0.68rem'}} onClick={()=>{setEditingId(a.id);setForm({type:a.type,date_debut:a.date_debut,date_fin:a.date_fin,demi_journee:a.demi_journee||'',commentaire:a.commentaire||''});window.scrollTo({top:0,behavior:'smooth'});}}>✏️ Modifier</button>
                <button className="btn btn-danger btn-sm" style={{padding:'4px 10px',fontSize:'0.68rem'}} onClick={async()=>{if(!confirm('Supprimer cette demande ?'))return;try{await api.deleteAbsence(a.id);onReload();}catch(e){setError('Erreur: '+e.message);}}}>✕</button>
              </div>}
            </div>
          </div>
        ))}
      </>}

      {/* Cancel modal */}
      <Modal open={!!cancelId} onClose={()=>setCancelId(null)} title="Demander l'annulation">
        <p style={{fontSize:'0.85rem',color:'var(--muted)',marginBottom:12}}>Votre demande d'annulation sera soumise a votre manager pour validation.</p>
        <div className="form-field">
          <label>Motif de l'annulation <span style={{color:'var(--red)'}}>*</span></label>
          <textarea autoFocus value={cancelMotif} onChange={e=>setCancelMotif(e.target.value)} placeholder="Expliquez la raison de l'annulation..." style={{minHeight:80}} />
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost" onClick={()=>setCancelId(null)}>Fermer</button>
          <button className="btn btn-danger" onClick={submitCancel} disabled={cancelLoading||!cancelMotif.trim()}>{cancelLoading?'⏳...':'Demander l\'annulation'}</button>
        </div>
      </Modal>

      {/* Historique (approuvés + refusés) */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div className="section-title">📋 Historique</div>
        {absences.filter(a=>a.statut==='approuve').length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={()=>{
            const approved = absences.filter(a=>a.statut==='approuve');
            const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Hello Pomelo//Conges//FR'];
            approved.forEach(a=>{
              const end = new Date(a.date_fin); end.setDate(end.getDate()+1);
              const endStr = end.toISOString().split('T')[0].replace(/-/g,'');
              lines.push('BEGIN:VEVENT',`DTSTART;VALUE=DATE:${a.date_debut.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${endStr}`,`SUMMARY:${absTypes[a.type]||a.type}${a.demi_journee?' ('+a.demi_journee+')':''}`,`DESCRIPTION:${a.commentaire||''}`,`UID:hp-abs-${a.id}@hello-pomelo.com`,'END:VEVENT');
            });
            lines.push('END:VCALENDAR');
            const blob = new Blob([lines.join('\r\n')],{type:'text/calendar'});
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href=url; link.download=`conges_${c.prenom}_${c.nom}.ics`; link.click();
            URL.revokeObjectURL(url);
          }}>📅 Exporter ICS</button>
        )}
      </div>
      {(()=>{
        const hist = absences.filter(a=>a.statut!=='en_attente'&&a.statut!=='annulation_demandee');
        const badgeMap = {approuve:'green',refuse:'pink',annule:'gray'};
        const labelMap = {approuve:'✅ Approuve',refuse:'❌ Refuse',annule:'🚫 Annule'};
        return hist.length===0 ? <p style={{color:'var(--muted)',fontSize:'0.82rem',fontStyle:'italic'}}>Aucun historique.</p> : hist.map(a => (
          <div key={a.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',borderRadius:12,border:`1.5px solid ${a.statut==='approuve'?'var(--text-success)':a.statut==='annule'?'var(--lavender)':'var(--border-danger)'}`,marginBottom:8,background:a.statut==='approuve'?'var(--bg-success)':a.statut==='annule'?'var(--offwhite)':'var(--bg-danger)',opacity:a.statut==='annule'?0.7:1}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:'0.9rem',color:'var(--navy)'}}>{ABS_TYPES[a.type]||a.type}</div>
              <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:2}}>Du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)} · {absenceDays(a)}j ouvre{absenceDays(a)>1?'s':''}</div>
              {a.commentaire && <div style={{fontSize:'0.78rem',color:'var(--muted)',fontStyle:'italic',marginTop:2}}>{a.commentaire}</div>}
              {a.statut==='refuse' && a.motif_refus && <div style={{fontSize:'0.78rem',color:'var(--text-danger)',marginTop:4,background:'var(--white)',padding:'6px 10px',borderRadius:6,borderLeft:'3px solid var(--border-danger)'}}>❌ Motif : {a.motif_refus}</div>}
              {a.approved_by && <div style={{fontSize:'0.7rem',color:'var(--muted)',marginTop:4}}>Traite par {a.approved_by}{a.approved_at?' le '+fmtDate(a.approved_at.split('T')[0]):''}</div>}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
              <Badge type={badgeMap[a.statut]||'gray'}>{labelMap[a.statut]||a.statut}</Badge>
              {a.statut==='approuve' && <>
                {(()=>{const end=new Date(a.date_fin);end.setDate(end.getDate()+1);const gcalUrl=`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent((absTypes[a.type]||a.type)+(a.demi_journee?' ('+a.demi_journee+')':''))}&dates=${a.date_debut.replace(/-/g,'')}/${end.toISOString().split('T')[0].replace(/-/g,'')}&details=${encodeURIComponent(a.commentaire||'')}`;return <a href={gcalUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:'0.68rem',color:'var(--blue)',fontWeight:700,textDecoration:'none'}} onClick={e=>e.stopPropagation()}>📅 Agenda</a>;})()}
                <button className="btn btn-danger btn-sm" style={{padding:'3px 8px',fontSize:'0.65rem'}} onClick={()=>{setCancelId(a.id);setCancelMotif('');}}>Demander annulation</button>
              </>}
            </div>
          </div>
        ));
      })()}
    </div>
  );
}

