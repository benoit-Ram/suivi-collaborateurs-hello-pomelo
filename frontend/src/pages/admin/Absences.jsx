import React, { useState } from 'react';
import { useData } from '../../services/DataContext';
import { api } from '../../services/api';
import { PageHeader, Badge, fmtDate, ABS_TYPES, ABS_STATUTS } from '../../components/UI';

const ABS_BADGE = { en_attente:'orange', approuve:'green', refuse:'pink' };

export default function Absences() {
  const { absences, collabs, showToast, reload, getCollab } = useData();
  const [fStatut, setFStatut] = useState('');
  const [fCollab, setFCollab] = useState('');

  let list = absences;
  if (fStatut) list = list.filter(a => a.statut === fStatut);
  if (fCollab) list = list.filter(a => a.collaborateur_id === fCollab);

  const approve = async (id) => {
    try { await api.updateAbsence(id, { statut: 'approuve' }); await reload(); showToast('Approuvé ✓'); } catch(e) { showToast('Erreur: '+e.message); }
  };
  const refuse = async (id) => {
    const motif = window.prompt('Motif du refus :');
    if (!motif) return;
    try { await api.updateAbsence(id, { statut: 'refuse', motif_refus: motif }); await reload(); showToast('Refusé'); } catch(e) { showToast('Erreur: '+e.message); }
  };
  const del = async (id) => {
    if (!window.confirm('Supprimer ?')) return;
    try { await api.deleteAbsence(id); await reload(); showToast('Supprimé'); } catch(e) { showToast('Erreur: '+e.message); }
  };

  return (
    <div>
      <PageHeader title="Congés & Absences" subtitle="Suivi des demandes" />

      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
        <select value={fStatut} onChange={e => setFStatut(e.target.value)} style={{ border:'1.5px solid var(--lavender)', borderRadius:10, padding:'8px 12px', fontFamily:'inherit', fontSize:'0.82rem' }}>
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="approuve">Approuvé</option>
          <option value="refuse">Refusé</option>
        </select>
        <select value={fCollab} onChange={e => setFCollab(e.target.value)} style={{ border:'1.5px solid var(--lavender)', borderRadius:10, padding:'8px 12px', fontFamily:'inherit', fontSize:'0.82rem', minWidth:200 }}>
          <option value="">Tous les collaborateurs</option>
          {collabs.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
        </select>
      </div>

      <div className="card" style={{ overflowX:'auto' }}>
        <table>
          <thead><tr>
            <th>Collaborateur</th><th>Type</th><th>Du</th><th>Au</th><th>Statut</th><th>Actions</th>
          </tr></thead>
          <tbody>{list.length === 0 ? (
            <tr><td colSpan={6} style={{textAlign:'center',color:'var(--muted)',padding:32}}>Aucune absence</td></tr>
          ) : list.map(a => {
            const c = collabs.find(x => x.id === a.collaborateur_id);
            return (
              <tr key={a.id}>
                <td style={{fontWeight:700}}>{c ? `${c.prenom} ${c.nom}` : '—'}</td>
                <td>{ABS_TYPES[a.type]||a.type}</td>
                <td>{fmtDate(a.date_debut)}</td>
                <td>{fmtDate(a.date_fin)}</td>
                <td>
                  <Badge type={ABS_BADGE[a.statut]}>{ABS_STATUTS[a.statut]||a.statut}</Badge>
                  {a.statut==='refuse' && a.motif_refus && <div style={{fontSize:'0.72rem',color:'#881337',marginTop:4}}>Motif: {a.motif_refus}</div>}
                </td>
                <td><div style={{display:'flex',gap:6}}>
                  {a.statut==='en_attente' && <>
                    <button className="btn btn-sm" style={{background:'var(--green)',color:'white'}} onClick={()=>approve(a.id)}>✓</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>refuse(a.id)}>✕</button>
                  </>}
                  <button className="btn btn-danger btn-sm" onClick={()=>del(a.id)}>🗑️</button>
                </div></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>

      {/* Solde congés */}
      <div className="section-title" style={{marginTop:28}}>Soldes de congés</div>
      <div className="card" style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Collaborateur</th><th>Solde initial</th><th>Acquisition/mois</th><th>Pris</th><th>Solde</th><th></th></tr></thead>
          <tbody>{collabs.map(c => {
            const pris = absences.filter(a => a.collaborateur_id===c.id && a.statut==='approuve' && a.type==='conge').length;
            const soldeInit = c.solde_conges||0;
            const acq = c.acquisition_conges||2.08;
            let moisAcq = 0;
            if (c.date_entree) { const e=new Date(c.date_entree); const n=new Date(); moisAcq=Math.max(0,(n.getFullYear()-e.getFullYear())*12+(n.getMonth()-e.getMonth())); }
            const acquis = Math.round(moisAcq*acq*100)/100;
            const solde = Math.round((soldeInit+acquis-pris)*100)/100;
            const color = solde<=0?'var(--red)':solde<=5?'var(--orange)':'var(--green)';
            return <tr key={c.id}>
              <td style={{fontWeight:700}}>{c.prenom} {c.nom}</td>
              <td>{soldeInit}j</td>
              <td>{acq}j/mois</td>
              <td>{pris}j</td>
              <td style={{fontWeight:700,color}}>{solde}j</td>
              <td><button className="btn btn-ghost btn-sm" onClick={async()=>{
                const newSolde = window.prompt('Solde initial :',soldeInit);
                if(newSolde===null) return;
                const newAcq = window.prompt('Acquisition/mois :',acq);
                if(newAcq===null) return;
                try { await api.updateCollaborateur(c.id,{solde_conges:parseFloat(newSolde),acquisition_conges:parseFloat(newAcq)}); await reload(); showToast('Mis à jour'); } catch(e2) { showToast('Erreur: '+e2.message); }
              }}>✏️</button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
