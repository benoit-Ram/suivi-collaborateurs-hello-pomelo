import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { Badge, FadeIn, Skeleton, fmtDate, ProgressBar } from '../../../components/UI';

const STATUT_LABEL = { en_cours:'En cours', termine:'Terminé', annule:'Annulé', en_attente:'En attente' };
const STATUT_BADGE = { en_cours:'blue', termine:'green', annule:'pink', en_attente:'orange' };

export default function MissionsTab({ collabId, isResponsable = false }) {
  const [assignments, setAssignments] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmWeek, setConfirmWeek] = useState(null); // week being confirmed

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

  if (loading) return <Skeleton lines={4} />;

  const active = assignments.filter(a => a.statut === 'actif' && a.missions?.statut === 'en_cours');
  const past = assignments.filter(a => a.statut !== 'actif' || a.missions?.statut !== 'en_cours');

  // Calculate total staffing
  const totalStaffing = active.reduce((s, a) => s + (a.taux_staffing || 0), 0);

  // Get current week dates
  const getWeekDates = () => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };
  const weekDates = getWeekDates();
  const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];

  const confirmDay = async (assignmentId, date, tempsPrevu) => {
    const existing = timeEntries.find(t => t.assignment_id === assignmentId && t.date === date);
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

  const modifyDay = async (assignmentId, date, tempsReel, commentaire) => {
    const existing = timeEntries.find(t => t.assignment_id === assignmentId && t.date === date);
    try {
      if (existing) {
        await api.updateTimeEntry(existing.id, { temps_reel: parseFloat(tempsReel), statut: 'modifie', commentaire });
      } else {
        await api.createTimeEntry({ assignment_id: assignmentId, collaborateur_id: collabId, date, temps_prevu: 1, temps_reel: parseFloat(tempsReel), statut: 'modifie', commentaire });
      }
      const t = await api.getTimeEntries({ collaborateur_id: collabId });
      setTimeEntries(t || []);
    } catch(e) { alert('Erreur: ' + e.message); }
  };

  return (
    <div>
      {/* Taux de staffing global */}
      <div className="card" style={{marginBottom:20,padding:16,textAlign:'center'}}>
        <div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginBottom:8}}>Mon taux de staffing</div>
        <div style={{fontSize:'2rem',fontWeight:700,color:totalStaffing>100?'var(--red)':totalStaffing>=80?'var(--orange)':'var(--green)'}}>{totalStaffing}%</div>
        <div style={{maxWidth:200,margin:'8px auto'}}><ProgressBar value={Math.min(totalStaffing,100)} color={totalStaffing>100?'var(--red)':totalStaffing>=80?'var(--orange)':'var(--green)'} /></div>
      </div>

      {/* Missions en cours */}
      {active.length > 0 && <>
        <div className="section-title">Missions en cours ({active.length})</div>
        {active.map(a => (
          <div key={a.id} className="card" style={{marginBottom:10,padding:16,borderLeft:'4px solid var(--blue)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div>
                <div style={{fontWeight:700,color:'var(--navy)',fontSize:'0.95rem'}}>{a.missions?.nom || '—'}</div>
                <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>{a.missions?.client || '—'} · {a.role || 'Non défini'}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:700,color:'var(--blue)',fontSize:'1.1rem'}}>{a.taux_staffing}%</div>
                <div style={{fontSize:'0.68rem',color:'var(--muted)'}}>staffing</div>
              </div>
            </div>
            <div style={{fontSize:'0.75rem',color:'var(--muted)',marginBottom:10}}>📅 {fmtDate(a.date_debut)} → {fmtDate(a.date_fin)}</div>

            {/* Fiche de présence — semaine en cours */}
            <div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--pink)',textTransform:'uppercase',marginBottom:6}}>📋 Ma semaine</div>
            <div style={{display:'flex',gap:4}}>
              {weekDates.map((date, i) => {
                const entry = timeEntries.find(t => t.assignment_id === a.id && t.date === date);
                const isConfirmed = entry?.statut === 'confirme' || entry?.statut === 'modifie';
                const tempsPrevu = a.taux_staffing >= 100 ? 1 : a.taux_staffing / 100;
                return (
                  <div key={date} style={{flex:1,textAlign:'center',padding:'6px 2px',borderRadius:8,background:isConfirmed?'var(--bg-success)':'var(--offwhite)',border:`1.5px solid ${isConfirmed?'var(--green)':'var(--lavender)'}`}}>
                    <div style={{fontSize:'0.65rem',fontWeight:700,color:'var(--muted)'}}>{dayLabels[i]}</div>
                    <div style={{fontSize:'0.8rem',fontWeight:700,color:isConfirmed?'var(--green)':'var(--navy)',marginTop:2}}>{entry?.temps_reel ?? tempsPrevu}j</div>
                    {!isConfirmed && (
                      <button onClick={()=>confirmDay(a.id, date, tempsPrevu)} style={{marginTop:4,fontSize:'0.6rem',background:'var(--green)',color:'white',border:'none',borderRadius:4,padding:'2px 6px',cursor:'pointer',fontWeight:700}}>✓</button>
                    )}
                    {isConfirmed && <div style={{fontSize:'0.55rem',color:'var(--green)',marginTop:2}}>✓</div>}
                  </div>
                );
              })}
            </div>
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
                <div style={{fontSize:'0.75rem',color:'var(--muted)'}}>{a.missions?.client || '—'} · {a.role || '—'} · {a.taux_staffing}%</div>
              </div>
              <Badge type={STATUT_BADGE[a.missions?.statut]||'gray'}>{STATUT_LABEL[a.missions?.statut]||'—'}</Badge>
            </div>
          </div>
        ))}
      </>}
    </div>
  );
}
