import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { Badge, FadeIn, Skeleton, fmtDate, ProgressBar } from '../../../components/UI';

const STATUT_LABEL = { en_cours:'En cours', termine:'Terminé', annule:'Annulé', en_attente:'En attente' };
const STATUT_BADGE = { en_cours:'blue', termine:'green', annule:'pink', en_attente:'orange' };
const ENTRY_COLORS = { planifie:'#E2E8F0', confirme:'#BBF7D0', modifie:'#FDE68A', en_attente:'#DDD6FE', approuve:'#A7F3D0' };
const ENTRY_LABELS = { planifie:'Prévisionnel', confirme:'Confirmé', modifie:'Modifié', en_attente:'En attente', approuve:'Approuvé' };
const DAY_LABELS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];
const DAY_SHORT = ['Lun','Mar','Mer','Jeu','Ven'];

/** Get Monday of a given week offset from current week */
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
  const [editCell, setEditCell] = useState(null); // {assignmentId, date}
  const [editValue, setEditValue] = useState('');
  const [editComment, setEditComment] = useState('');

  useEffect(() => {
    if (!collabId) return;
    Promise.all([
      api.getAssignments({ collaborateur_id: collabId }),
      api.getTimeEntries({ collaborateur_id: collabId })
    ]).then(([a, t]) => {
      setAssignments(a || []);
      setTimeEntries(t || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [collabId]);

  if (loading) return <Skeleton lines={5} />;

  const monday = getWeekMonday(weekOffset);
  const weekDates = getWeekDates(monday);
  const weekLabel = getWeekLabel(monday);

  const active = assignments.filter(a => a.statut === 'actif' && a.missions?.statut === 'en_cours');
  const past = assignments.filter(a => a.statut !== 'actif' || a.missions?.statut !== 'en_cours');
  const totalStaffing = active.reduce((s, a) => s + (a.taux_staffing || 0), 0);

  const getEntry = (assignmentId, date) => timeEntries.find(t => t.assignment_id === assignmentId && t.date === date);

  const confirmEntry = async (assignmentId, date, tempsPrevu) => {
    const existing = getEntry(assignmentId, date);
    try {
      if (existing) {
        await api.updateTimeEntry(existing.id, { temps_reel: tempsPrevu, statut: 'confirme' });
      } else {
        await api.createTimeEntry({ assignment_id: assignmentId, collaborateur_id: collabId, date, temps_prevu: tempsPrevu, temps_reel: tempsPrevu, statut: 'confirme' });
      }
      const t = await api.getTimeEntries({ collaborateur_id: collabId });
      setTimeEntries(t || []);
    } catch(e) { alert('Erreur: ' + e.message); }
  };

  const saveModifiedEntry = async (assignmentId, date) => {
    const existing = getEntry(assignmentId, date);
    try {
      if (existing) {
        await api.updateTimeEntry(existing.id, { temps_reel: parseFloat(editValue) || 0, statut: 'modifie', commentaire: editComment });
      } else {
        await api.createTimeEntry({ assignment_id: assignmentId, collaborateur_id: collabId, date, temps_prevu: 1, temps_reel: parseFloat(editValue) || 0, statut: 'modifie', commentaire: editComment });
      }
      const t = await api.getTimeEntries({ collaborateur_id: collabId });
      setTimeEntries(t || []);
      setEditCell(null);
    } catch(e) { alert('Erreur: ' + e.message); }
  };

  // Calculate daily totals
  const dayTotals = weekDates.map(date => {
    return active.reduce((total, a) => {
      const entry = getEntry(a.id, date);
      const prevu = (a.taux_staffing || 100) >= 100 ? 7 : Math.round((a.taux_staffing / 100) * 7 * 10) / 10;
      return total + (entry?.temps_reel != null ? entry.temps_reel : (prevu / active.length || 0));
    }, 0);
  });

  return (
    <div>
      {/* Taux de staffing global */}
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

      {/* Feuille de temps hebdomadaire */}
      <div className="card" style={{marginBottom:20,padding:0,overflow:'hidden'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:'1px solid var(--lavender)'}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(weekOffset-1)}>← Sem. préc.</button>
          <div style={{textAlign:'center'}}>
            <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem'}}>📋 Feuille de temps</div>
            <div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:2}}>{weekLabel}</div>
          </div>
          <div style={{display:'flex',gap:6}}>
            {weekOffset !== 0 && <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(0)}>Aujourd'hui</button>}
            <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(weekOffset+1)}>Sem. suiv. →</button>
          </div>
        </div>

        {active.length === 0 ? (
          <div style={{padding:32,textAlign:'center',color:'var(--muted)'}}>Aucune mission active — pas de feuille de temps</div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',fontSize:'0.8rem',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'var(--offwhite)'}}>
                  <th style={{textAlign:'left',padding:'10px 14px',fontWeight:700,color:'var(--navy)',minWidth:180}}>Projet</th>
                  {weekDates.map((date, i) => {
                    const isToday = date === new Date().toISOString().split('T')[0];
                    return <th key={date} style={{textAlign:'center',padding:'8px 6px',minWidth:80,fontWeight:700,color:isToday?'var(--pink)':'var(--navy)',background:isToday?'rgba(255,50,133,0.05)':'transparent'}}>
                      <div>{DAY_SHORT[i]}</div>
                      <div style={{fontSize:'0.68rem',fontWeight:600,color:'var(--muted)'}}>{date.split('-')[2]}/{date.split('-')[1]}</div>
                    </th>;
                  })}
                  <th style={{textAlign:'center',padding:'8px 6px',fontWeight:700,color:'var(--navy)',minWidth:60}}>Total</th>
                </tr>
              </thead>
              <tbody>
                {active.map(a => {
                  const weekTotal = weekDates.reduce((s, date) => {
                    const entry = getEntry(a.id, date);
                    return s + (entry?.temps_reel ?? 0);
                  }, 0);
                  return (
                    <tr key={a.id} style={{borderBottom:'1px solid var(--lavender)'}}>
                      <td style={{padding:'10px 14px'}}>
                        <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.85rem'}}>{a.missions?.nom || '—'}</div>
                        <div style={{fontSize:'0.7rem',color:'var(--muted)'}}>{a.missions?.clients?.nom || a.missions?.client} · {a.role || '—'} · {a.taux_staffing}%</div>
                      </td>
                      {weekDates.map((date, i) => {
                        const entry = getEntry(a.id, date);
                        const isToday = date === new Date().toISOString().split('T')[0];
                        const isEditing = editCell?.assignmentId === a.id && editCell?.date === date;
                        const status = entry?.statut || 'planifie';
                        const prevu = (a.taux_staffing || 100) / 100;
                        const heures = entry?.temps_reel ?? null;

                        if (isEditing) {
                          return <td key={date} style={{padding:4,textAlign:'center',background:isToday?'rgba(255,50,133,0.03)':'transparent'}}>
                            <input type="number" step="0.5" min="0" max="1" value={editValue} onChange={e=>setEditValue(e.target.value)} style={{width:50,textAlign:'center',border:'1.5px solid var(--pink)',borderRadius:6,padding:'4px',fontFamily:'inherit',fontSize:'0.8rem'}} autoFocus />
                            <input type="text" value={editComment} onChange={e=>setEditComment(e.target.value)} placeholder="Motif..." style={{width:'100%',border:'1px solid var(--lavender)',borderRadius:4,padding:'2px 4px',fontSize:'0.65rem',marginTop:2}} />
                            <div style={{display:'flex',gap:2,marginTop:2,justifyContent:'center'}}>
                              <button onClick={()=>saveModifiedEntry(a.id,date)} style={{fontSize:'0.6rem',background:'var(--green)',color:'white',border:'none',borderRadius:3,padding:'2px 6px',cursor:'pointer'}}>✓</button>
                              <button onClick={()=>setEditCell(null)} style={{fontSize:'0.6rem',background:'var(--lavender)',color:'var(--navy)',border:'none',borderRadius:3,padding:'2px 6px',cursor:'pointer'}}>✕</button>
                            </div>
                          </td>;
                        }

                        return <td key={date} style={{padding:4,textAlign:'center',background:isToday?'rgba(255,50,133,0.03)':'transparent'}}>
                          <div style={{
                            padding:'6px 4px',borderRadius:8,
                            background:ENTRY_COLORS[status]||'#F1F5F9',
                            cursor:status==='planifie'||status==='confirme'?'pointer':'default',
                            transition:'all 0.15s',
                            minHeight:36,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'
                          }}
                          onClick={()=>{
                            if (status === 'planifie') confirmEntry(a.id, date, prevu);
                            else if (status === 'confirme' || status === 'modifie') { setEditCell({assignmentId:a.id,date}); setEditValue(String(heures != null ? heures : prevu)); setEditComment(entry?.commentaire || ''); }
                          }}
                          title={status==='planifie'?'Cliquer pour confirmer':status==='confirme'?'Cliquer pour modifier':''}
                          >
                            <div style={{fontWeight:700,fontSize:'0.85rem',color:'var(--navy)'}}>{heures !== null ? `${heures}j` : `${prevu}j`}</div>
                            <div style={{fontSize:'0.55rem',fontWeight:600,color:'var(--muted)',marginTop:1}}>{ENTRY_LABELS[status]||status}</div>
                          </div>
                          {entry?.commentaire && <div style={{fontSize:'0.55rem',color:'var(--muted)',marginTop:1,fontStyle:'italic'}} title={entry.commentaire}>💬</div>}
                        </td>;
                      })}
                      <td style={{padding:8,textAlign:'center',fontWeight:700,color:'var(--navy)'}}>{weekTotal > 0 ? `${weekTotal}j` : '—'}</td>
                    </tr>
                  );
                })}
                {/* Disponibilité row */}
                <tr style={{background:'var(--offwhite)'}}>
                  <td style={{padding:'10px 14px',fontWeight:700,color:'var(--muted)',fontSize:'0.82rem'}}>Disponibilité</td>
                  {weekDates.map((date, i) => {
                    const dailyBooked = active.reduce((s,a) => s + (a.taux_staffing||0)/100, 0);
                    const dispo = Math.max(0, 1 - dailyBooked);
                    return <td key={date} style={{textAlign:'center',padding:8}}>
                      <div style={{fontWeight:700,fontSize:'0.85rem',color:dispo>0?'var(--green)':'var(--muted)'}}>{Math.round(dispo*7*10)/10}h</div>
                    </td>;
                  })}
                  <td style={{textAlign:'center',padding:8,fontWeight:700,color:'var(--muted)'}}>{Math.round(Math.max(0,5-active.reduce((s,a)=>s+(a.taux_staffing||0)/100*5,0))*10)/10}j</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Légende */}
        <div style={{display:'flex',gap:12,padding:'10px 18px',borderTop:'1px solid var(--lavender)',flexWrap:'wrap',fontSize:'0.68rem',color:'var(--muted)'}}>
          {Object.entries(ENTRY_LABELS).map(([k,v])=>(
            <span key={k} style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:3,background:ENTRY_COLORS[k]}} />{v}</span>
          ))}
        </div>
      </div>

      {/* Missions actives — cartes */}
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
          </div>
        ))}
      </>}

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
