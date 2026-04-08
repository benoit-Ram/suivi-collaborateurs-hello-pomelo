import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { Badge, FadeIn, Skeleton, fmtDate, ProgressBar, Modal } from '../../../components/UI';

const STATUT_LABEL = { en_cours:'En cours', termine:'Terminé', annule:'Annulé', en_attente:'En attente' };
const STATUT_BADGE = { en_cours:'blue', termine:'green', annule:'pink', en_attente:'orange' };
const ENTRY_COLORS = { planifie:'#E2E8F0', confirme:'#FDE68A', valide:'#BBF7D0' };
const ENTRY_LABELS = { planifie:'À valider', confirme:'Confirmé', valide:'Validé', modifie:'Modifié' };
const DAY_SHORT = ['Lun','Mar','Mer','Jeu','Ven'];

function getWeekMonday(offset = 0) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + (offset * 7));
  monday.setHours(0,0,0,0);
  return monday;
}

function getWeekDates(monday) {
  return Array.from({length:5}, (_,i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function getWeekLabel(monday) {
  const end = new Date(monday);
  end.setDate(monday.getDate() + 4);
  const weekNum = Math.ceil(((monday - new Date(monday.getFullYear(),0,1)) / 86400000 + 1) / 7);
  return `S${weekNum} — ${monday.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} au ${end.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}`;
}

export default function MissionsTab({ collabId }) {
  const [assignments, setAssignments] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  // Validation popup
  const [validateDate, setValidateDate] = useState(null); // date string to validate
  const [validateForm, setValidateForm] = useState({}); // { [assignmentId]: { temps_reel, commentaire, confirmed } }
  const [validateLoading, setValidateLoading] = useState(false);

  useEffect(() => {
    if (!collabId) return;
    loadData();
  }, [collabId]);

  async function loadData() {
    try {
      const [a, t, m] = await Promise.all([
        api.getAssignments({ collaborateur_id: collabId }),
        api.getTimeEntries({ collaborateur_id: collabId }),
        api.getMissions()
      ]);
      // Enrich assignments with full mission data (including team)
      const enriched = (a||[]).map(assign => {
        const fullMission = (m||[]).find(mi => mi.id === assign.mission_id);
        return fullMission ? { ...assign, missions: fullMission } : assign;
      });
      setAssignments(enriched);
      setTimeEntries(t || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  if (loading) return <Skeleton lines={5} />;

  const monday = getWeekMonday(weekOffset);
  const weekDates = getWeekDates(monday);
  const weekLabel = getWeekLabel(monday);
  const today = new Date().toISOString().split('T')[0];

  const active = assignments.filter(a => a.statut === 'actif' && a.missions?.statut === 'en_cours');
  const past = assignments.filter(a => a.statut !== 'actif' || a.missions?.statut !== 'en_cours');
  const totalStaffing = active.reduce((s, a) => s + (a.taux_staffing || 0), 0);

  const getEntry = (assignmentId, date) => timeEntries.find(t => t.assignment_id === assignmentId && t.date === date);

  // Open validation popup for a specific date
  const openValidate = (date) => {
    if (date > today) return; // Can't validate future days
    const form = {};
    active.forEach(a => {
      const entry = getEntry(a.id, date);
      const prevu = (a.taux_staffing || 100) / 100;
      form[a.id] = {
        temps_reel: entry?.temps_reel != null ? entry.temps_reel : prevu,
        prevu,
        commentaire: entry?.commentaire || '',
        confirmed: true, // default: confirm planned time
        existing: entry,
        missionNom: a.missions?.nom || '—',
        missionClient: a.missions?.clients?.nom || a.missions?.client || '—',
        role: a.role || '—',
      };
    });
    setValidateForm(form);
    setValidateDate(date);
  };

  // Submit validation for a day
  const submitValidation = async () => {
    setValidateLoading(true);
    try {
      for (const [assignmentId, entry] of Object.entries(validateForm)) {
        const existing = getEntry(assignmentId, validateDate);
        const data = {
          temps_reel: entry.confirmed ? entry.prevu : parseFloat(entry.temps_reel) || 0,
          statut: 'valide',
          commentaire: entry.confirmed ? null : (entry.commentaire || null),
        };
        if (existing) {
          await api.updateTimeEntry(existing.id, data);
        } else {
          await api.createTimeEntry({
            assignment_id: assignmentId,
            collaborateur_id: collabId,
            date: validateDate,
            temps_prevu: entry.prevu,
            ...data,
          });
        }
      }
      await loadData();
      setValidateDate(null);
    } catch(e) { alert('Erreur: ' + e.message); }
    setValidateLoading(false);
  };

  // Check if a day is fully validated
  const isDayValidated = (date) => {
    return active.every(a => {
      const entry = getEntry(a.id, date);
      return entry?.statut === 'valide';
    });
  };

  const isPast = (date) => date <= today;

  return (
    <div>
      {/* Stats */}
      <div style={{display:'flex',gap:12,marginBottom:20}}>
        <div className="card" style={{flex:1,textAlign:'center',padding:16}}>
          <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:6}}>Staffing global</div>
          <div style={{fontSize:'2rem',fontWeight:700,color:totalStaffing>100?'var(--red)':totalStaffing>=80?'var(--orange)':'var(--green)'}}>{totalStaffing}%</div>
          <div style={{maxWidth:120,margin:'6px auto'}}><ProgressBar value={Math.min(totalStaffing,100)} color={totalStaffing>100?'var(--red)':totalStaffing>=80?'var(--orange)':'var(--green)'} /></div>
        </div>
        <div className="card" style={{flex:1,textAlign:'center',padding:16}}>
          <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:6}}>Missions actives</div>
          <div style={{fontSize:'2rem',fontWeight:700,color:'var(--blue)'}}>{active.length}</div>
        </div>
      </div>

      {/* Feuille de temps */}
      <div className="card" style={{marginBottom:20,padding:0,overflow:'hidden'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:'1px solid var(--lavender)'}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(weekOffset-1)}>←</button>
          <div style={{textAlign:'center'}}>
            <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem'}}>📋 Feuille de temps</div>
            <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:2}}>{weekLabel}</div>
          </div>
          <div style={{display:'flex',gap:6}}>
            {weekOffset !== 0 && <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(0)}>Auj.</button>}
            <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(weekOffset+1)}>→</button>
          </div>
        </div>

        {active.length === 0 ? (
          <div style={{padding:32,textAlign:'center',color:'var(--muted)'}}>Aucune mission active</div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',fontSize:'0.8rem',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'var(--offwhite)'}}>
                  <th style={{textAlign:'left',padding:'10px 14px',fontWeight:700,color:'var(--navy)',minWidth:160}}>Mission</th>
                  {weekDates.map((date, i) => {
                    const isToday = date === today;
                    const validated = isDayValidated(date);
                    return <th key={date} style={{textAlign:'center',padding:'8px 4px',minWidth:70,fontWeight:700,color:isToday?'var(--pink)':'var(--navy)',background:isToday?'rgba(255,50,133,0.05)':'transparent'}}>
                      <div>{DAY_SHORT[i]}</div>
                      <div style={{fontSize:'0.65rem',fontWeight:600,color:'var(--muted)'}}>{date.split('-')[2]}/{date.split('-')[1]}</div>
                      {validated && <div style={{fontSize:'0.6rem',color:'var(--green)'}}>✓</div>}
                    </th>;
                  })}
                  <th style={{textAlign:'center',padding:'8px 4px',fontWeight:700,minWidth:50}}>Total</th>
                </tr>
              </thead>
              <tbody>
                {active.map(a => {
                  const weekTotal = weekDates.reduce((s, date) => {
                    const entry = getEntry(a.id, date);
                    return s + (entry?.temps_reel != null ? entry.temps_reel : 0);
                  }, 0);
                  return (
                    <tr key={a.id} style={{borderBottom:'1px solid var(--lavender)'}}>
                      <td style={{padding:'10px 14px'}}>
                        <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.85rem'}}>{a.missions?.nom || '—'}</div>
                        <div style={{fontSize:'0.68rem',color:'var(--muted)'}}>{a.missions?.clients?.nom || a.missions?.client || '—'} · {a.role || '—'}</div>
                      </td>
                      {weekDates.map((date, i) => {
                        const entry = getEntry(a.id, date);
                        const isToday = date === today;
                        const status = entry?.statut || 'planifie';
                        const prevu = (a.taux_staffing || 100) / 100;
                        const isValidated = status === 'valide';
                        const value = entry?.temps_reel != null ? entry.temps_reel : prevu;

                        return <td key={date} style={{padding:3,textAlign:'center',background:isToday?'rgba(255,50,133,0.03)':'transparent'}}>
                          <div style={{
                            padding:'6px 2px',borderRadius:8,
                            background: isValidated ? ENTRY_COLORS.valide : isPast(date) ? ENTRY_COLORS.planifie : '#F8F8FC',
                            minHeight:36,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                            opacity: !isPast(date) ? 0.5 : 1,
                          }}>
                            <div style={{fontWeight:700,fontSize:'0.85rem',color:isValidated?'var(--green)':'var(--navy)'}}>{value}j</div>
                            <div style={{fontSize:'0.5rem',fontWeight:600,color:isValidated?'var(--green)':'var(--muted)'}}>
                              {isValidated ? '✓ Validé' : isPast(date) ? 'À valider' : 'Futur'}
                            </div>
                          </div>
                          {entry?.commentaire && <div style={{fontSize:'0.5rem',color:'var(--muted)',marginTop:1}} title={entry.commentaire}>💬</div>}
                        </td>;
                      })}
                      <td style={{padding:8,textAlign:'center',fontWeight:700,color:'var(--navy)'}}>{weekTotal > 0 ? `${weekTotal}j` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Day validation buttons */}
        {active.length > 0 && (
          <div style={{padding:'12px 18px',borderTop:'1px solid var(--lavender)',display:'flex',gap:4,flexWrap:'wrap',justifyContent:'center'}}>
            {weekDates.map((date, i) => {
              const validated = isDayValidated(date);
              const past = isPast(date);
              return <button key={date} disabled={!past || validated} onClick={()=>openValidate(date)}
                className={`btn btn-sm ${validated ? '' : past ? 'btn-primary' : 'btn-ghost'}`}
                style={{padding:'6px 12px',fontSize:'0.72rem',opacity:!past?0.4:1}}>
                {validated ? `✓ ${DAY_SHORT[i]}` : `${DAY_SHORT[i]} ${date.split('-')[2]}/${date.split('-')[1]}`}
              </button>;
            })}
          </div>
        )}

        {/* Légende */}
        <div style={{display:'flex',gap:12,padding:'8px 18px',borderTop:'1px solid var(--lavender)',fontSize:'0.65rem',color:'var(--muted)'}}>
          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:3,background:ENTRY_COLORS.planifie}} />À valider</span>
          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:3,background:ENTRY_COLORS.valide}} />Validé</span>
        </div>
      </div>

      {/* VALIDATION POPUP */}
      <Modal open={!!validateDate} onClose={()=>setValidateDate(null)} title={`Valider le ${validateDate ? validateDate.split('-')[2]+'/'+validateDate.split('-')[1]+'/'+validateDate.split('-')[0] : ''}`}>
        <p style={{fontSize:'0.85rem',color:'var(--muted)',marginBottom:16}}>Pour chaque mission, confirmez le temps prévu ou indiquez le temps réel.</p>
        {Object.entries(validateForm).map(([assignmentId, entry]) => (
          <div key={assignmentId} style={{padding:'14px 16px',border:'1.5px solid var(--lavender)',borderRadius:12,marginBottom:10,background:entry.confirmed?'var(--offwhite)':'white'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div>
                <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.9rem'}}>{entry.missionNom}</div>
                <div style={{fontSize:'0.75rem',color:'var(--muted)'}}>{entry.missionClient} · {entry.role}</div>
              </div>
              <div style={{fontWeight:700,color:'var(--blue)',fontSize:'1rem'}}>{entry.prevu}j prévu</div>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:entry.confirmed?0:10}}>
              <button onClick={()=>setValidateForm({...validateForm,[assignmentId]:{...entry,confirmed:true}})}
                style={{flex:1,padding:'10px',borderRadius:10,border:`2px solid ${entry.confirmed?'var(--green)':'var(--lavender)'}`,background:entry.confirmed?'var(--bg-success)':'white',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'0.82rem',color:entry.confirmed?'var(--green)':'var(--muted)',transition:'all 0.15s'}}>
                ✓ Temps prévu confirmé ({entry.prevu}j)
              </button>
              <button onClick={()=>setValidateForm({...validateForm,[assignmentId]:{...entry,confirmed:false,temps_reel:entry.temps_reel}})}
                style={{flex:1,padding:'10px',borderRadius:10,border:`2px solid ${!entry.confirmed?'var(--orange)':'var(--lavender)'}`,background:!entry.confirmed?'var(--bg-warning)':'white',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:'0.82rem',color:!entry.confirmed?'var(--orange)':'var(--muted)',transition:'all 0.15s'}}>
                ✏️ Temps différent
              </button>
            </div>
            {!entry.confirmed && (
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <div className="form-field" style={{flex:1,margin:0}}>
                  <label style={{fontSize:'0.7rem'}}>Temps réel (jours)</label>
                  <input type="number" step="0.1" min="0" max="1" value={entry.temps_reel}
                    onChange={e=>setValidateForm({...validateForm,[assignmentId]:{...entry,temps_reel:e.target.value}})}
                    style={{padding:'6px 10px',fontSize:'0.85rem'}} />
                </div>
                <div className="form-field" style={{flex:2,margin:0}}>
                  <label style={{fontSize:'0.7rem'}}>Motif <span style={{color:'var(--red)'}}>*</span></label>
                  <input value={entry.commentaire}
                    onChange={e=>setValidateForm({...validateForm,[assignmentId]:{...entry,commentaire:e.target.value}})}
                    placeholder="Pourquoi le temps est différent ?" style={{padding:'6px 10px',fontSize:'0.85rem'}} />
                </div>
              </div>
            )}
          </div>
        ))}
        <div style={{background:'var(--offwhite)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:'0.82rem',color:'var(--navy)',fontWeight:600}}>
          ⚠️ Une fois validé, ce jour ne sera plus modifiable.
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button className="btn btn-ghost" onClick={()=>setValidateDate(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={submitValidation} disabled={validateLoading || Object.values(validateForm).some(e=>!e.confirmed && !e.commentaire?.trim())}>
            {validateLoading ? '⏳...' : '✓ Valider cette journée'}
          </button>
        </div>
      </Modal>

      {/* Missions actives */}
      {active.length > 0 && <>
        <div className="section-title">Mes missions ({active.length})</div>
        {active.map(a => (
          <div key={a.id} className="card" style={{marginBottom:10,padding:16,borderLeft:'4px solid var(--blue)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem'}}>{a.missions?.nom || '—'}</div>
                <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:2}}>{a.missions?.clients?.nom || a.missions?.client || '—'} · {a.role || 'Non défini'}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <Badge type={STATUT_BADGE[a.missions?.statut]||'gray'}>{STATUT_LABEL[a.missions?.statut]||'—'}</Badge>
                <div style={{fontWeight:700,color:'var(--blue)',fontSize:'1rem',marginTop:4}}>{a.taux_staffing}%</div>
              </div>
            </div>
            <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:6}}>📅 {fmtDate(a.date_debut)} → {fmtDate(a.date_fin)}</div>
            {/* Team members on same mission */}
            {a.missions?.assignments?.filter(x=>x.collaborateur_id!==collabId&&x.statut==='actif').length > 0 && (
              <div style={{marginTop:8,paddingTop:8,borderTop:'1px dashed var(--lavender)'}}>
                <div style={{fontSize:'0.68rem',fontWeight:700,color:'var(--muted)',marginBottom:4}}>👥 Équipe mission</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {a.missions.assignments.filter(x=>x.collaborateur_id!==collabId&&x.statut==='actif').map(x => (
                    <span key={x.id} style={{fontSize:'0.7rem',color:'var(--navy)',background:'var(--offwhite)',padding:'3px 8px',borderRadius:6,fontWeight:600}}>
                      {x.collaborateurs ? `${x.collaborateurs.prenom} ${x.collaborateurs.nom[0]}.` : '—'} · {x.role||'—'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </>}

      {active.length === 0 && <div className="card" style={{textAlign:'center',padding:32,color:'var(--muted)'}}>🚀 Aucune mission en cours</div>}

      {/* Historique */}
      {past.length > 0 && <>
        <div className="section-title" style={{marginTop:24}}>Missions passées ({past.length})</div>
        {past.map(a => (
          <div key={a.id} className="card" style={{marginBottom:8,padding:14,opacity:0.7}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.88rem'}}>{a.missions?.nom || '—'}</div>
                <div style={{fontSize:'0.75rem',color:'var(--muted)'}}>{a.missions?.clients?.nom || a.missions?.client || '—'} · {a.role || '—'} · {a.taux_staffing}%</div>
              </div>
              <Badge type={STATUT_BADGE[a.missions?.statut]||'gray'}>{STATUT_LABEL[a.missions?.statut]||'—'}</Badge>
            </div>
          </div>
        ))}
      </>}
    </div>
  );
}
