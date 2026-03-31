import React, { useState } from 'react';
import { useData } from '../../services/DataContext';
import { PageHeader, Badge, ProgressBar, EmptyState, fmtDate, STATUS_LABELS, STATUS_COLORS } from '../../components/UI';

export default function Objectifs() {
  const { collabs } = useData();
  const [tab, setTab] = useState('individuel');
  const [selectedCollab, setSelectedCollab] = useState('');

  return (
    <div>
      <PageHeader title="Objectifs" subtitle="Objectifs individuels et d'équipe" />

      <div style={{ display:'flex', gap:6, marginBottom:24, background:'var(--offwhite)', padding:6, borderRadius:12, maxWidth:400 }}>
        {[['individuel','👤 Individuels'],['equipe','👥 Par équipe']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex:1, padding:'10px 16px', borderRadius:10, border:'none', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:700, cursor:'pointer', background: tab===k?'white':'transparent', color: tab===k?'var(--navy)':'var(--muted)', boxShadow: tab===k?'0 2px 8px rgba(5,5,109,0.1)':'none' }}>{l}</button>
        ))}
      </div>

      {tab === 'individuel' && <div>
        <select value={selectedCollab} onChange={e => setSelectedCollab(e.target.value)} style={{ border:'1.5px solid var(--lavender)', borderRadius:10, padding:'10px 14px', fontFamily:'inherit', fontSize:'0.9rem', marginBottom:16, minWidth:300 }}>
          <option value="">— Tous les collaborateurs —</option>
          {collabs.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom} — {c.poste}</option>)}
        </select>

        {(selectedCollab ? [collabs.find(c => c.id === selectedCollab)].filter(Boolean) : collabs).map(c => {
          const objs = c.objectifs || [];
          if (!objs.length) return null;
          return (
            <div key={c.id} style={{ marginBottom:24 }}>
              <div style={{ fontWeight:700, color:'var(--navy)', marginBottom:8 }}>{c.prenom} {c.nom} — {objs.length} objectif{objs.length>1?'s':''}</div>
              {objs.map((o,i) => (
                <div key={o.id} className="card" style={{ marginBottom:8, padding:14, borderLeft:`4px solid ${o.statut==='atteint'?'var(--green)':'var(--pink)'}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontWeight:700, color:'var(--navy)', flex:1 }}>{o.titre}</span>
                    <Badge type={STATUS_COLORS[o.statut]}>{STATUS_LABELS[o.statut]}</Badge>
                    {o.recurrence && <Badge type="blue">🔄</Badge>}
                  </div>
                  <ProgressBar value={o.statut==='atteint'?100:(o.progression||0)} />
                  <div style={{ fontSize:'0.72rem', color:'var(--muted)', marginTop:4 }}>📅 {fmtDate(o.date_debut)} → {fmtDate(o.date_fin)}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>}

      {tab === 'equipe' && <EmptyState icon="👥" text="Objectifs d'équipe — à configurer dans Paramètres" />}
    </div>
  );
}
