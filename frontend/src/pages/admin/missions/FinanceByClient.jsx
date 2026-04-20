import React, { useState } from 'react';
import { calcMonthlyCA, fmtEuro } from '../../../utils/missionCalcs';

/** Finance par client — table avec expansion vers les missions. */
export default function FinanceByClient({ clients, missions, isMissionActive }) {
  const activeMissions = missions.filter(isMissionActive);

  const clientData = clients.map(c => {
    const cMissions = activeMissions.filter(m => m.client_id === c.id);
    const budget = cMissions.reduce((s, m) => s + (m.budget_vendu || 0), 0);
    const caMonth = cMissions.reduce((s, m) => s + calcMonthlyCA(m.assignments), 0);
    const nbCollabs = new Set(cMissions.flatMap(m => (m.assignments || []).filter(a => a.statut === 'actif').map(a => a.collaborateur_id))).size;
    return { client: c, missions: cMissions, budget, caMonth, nbCollabs };
  }).filter(d => d.missions.length > 0).sort((a, b) => b.caMonth - a.caMonth);

  const totalCA = clientData.reduce((s, d) => s + d.caMonth, 0);
  const [expandedClient, setExpandedClient] = useState(null);

  return (
    <div>
      <div className="section-title">CA par client</div>
      <div style={{fontSize:'0.82rem',color:'var(--muted)',marginBottom:12}}>CA mensuel estimé total : <strong style={{color:'var(--navy)',fontSize:'1rem'}}>{fmtEuro(Math.round(totalCA))}</strong> · {activeMissions.length} missions sur la période</div>
      <div className="card" style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Client</th><th>Missions</th><th>Collabs</th><th>Budget total</th><th>CA mensuel est.</th><th></th></tr></thead>
          <tbody>{clientData.map(d => (
            <React.Fragment key={d.client.id}>
              <tr style={{cursor:'pointer',background:expandedClient===d.client.id?'var(--offwhite)':'transparent'}} onClick={()=>setExpandedClient(expandedClient===d.client.id?null:d.client.id)}>
                <td style={{fontWeight:700,color:'var(--navy)'}}>{d.client.nom}</td>
                <td>{d.missions.length}</td>
                <td>{d.nbCollabs}</td>
                <td style={{fontWeight:600}}>{fmtEuro(d.budget)}</td>
                <td style={{fontWeight:700,color:'var(--blue)'}}>{fmtEuro(Math.round(d.caMonth))}</td>
                <td style={{color:'var(--muted)'}}>{expandedClient===d.client.id ? '▲' : '▼'}</td>
              </tr>
              {expandedClient===d.client.id && d.missions.map(m => (
                <tr key={m.id} style={{background:'var(--offwhite)',fontSize:'0.82rem'}}>
                  <td style={{paddingLeft:32,color:'var(--muted)'}}>{m.nom}</td>
                  <td>{(m.assignments||[]).filter(a=>a.statut==='actif').length}</td>
                  <td></td>
                  <td style={{color:'var(--muted)'}}>{fmtEuro(m.budget_vendu)}</td>
                  <td style={{color:'var(--muted)'}}>{fmtEuro(Math.round(calcMonthlyCA(m.assignments)))}</td>
                  <td></td>
                </tr>
              ))}
            </React.Fragment>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
