import React, { useState } from 'react';
import { useData } from '../../services/DataContext';
import { PageHeader, EmptyState } from '../../components/UI';

const SETTINGS_KEYS = [
  { key: 'equipes', label: 'Équipes' },
  { key: 'bureaux', label: 'Bureaux' },
  { key: 'contrats', label: 'Types de contrat' },
  { key: 'typePostes', label: 'Types de poste' },
];

export default function Settings() {
  const { settings } = useData();

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Listes de référence et configuration" />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
        {SETTINGS_KEYS.map(({ key, label }) => {
          const items = settings[key] || [];
          return (
            <div key={key} className="card">
              <div className="section-title" style={{ marginTop:0 }}>{label}</div>
              {items.length ? items.map((v,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', border:'1.5px solid var(--lavender)', borderRadius:10, marginBottom:8 }}>
                  <span style={{ fontWeight:600, color:'var(--navy)' }}>{v}</span>
                </div>
              )) : <p style={{ color:'var(--muted)', fontSize:'0.85rem', fontStyle:'italic' }}>Aucun élément.</p>}
            </div>
          );
        })}
      </div>

      {/* Questions configurables */}
      <div className="section-title">Questions du point mensuel</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
        {['questions_manager','questions_collab'].map(key => {
          const questions = settings[key] || [];
          return (
            <div key={key} className="card">
              <div className="section-title" style={{marginTop:0}}>{key==='questions_manager'?'👔 Manager':'👤 Collaborateur'}</div>
              {questions.length ? questions.map((q,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', border:'1.5px solid var(--lavender)', borderRadius:10, marginBottom:8 }}>
                  <span style={{ flex:1, fontWeight:600, color:'var(--navy)', fontSize:'0.88rem' }}>{q.label || q}</span>
                  <span className={`badge badge-${q.type==='notation'?'orange':q.type==='qcm'?'green':'blue'}`}>{q.type || 'texte'}</span>
                </div>
              )) : <p style={{color:'var(--muted)',fontSize:'0.85rem',fontStyle:'italic'}}>Questions par défaut.</p>}
            </div>
          );
        })}
      </div>

      {/* Périodes de fermeture */}
      <div className="section-title">Périodes de fermeture</div>
      <div className="card">
        {(settings['periodes_fermeture']||[]).length ? (settings['periodes_fermeture']||[]).map((f,i) => (
          <div key={i} style={{ padding:'9px 12px', border:'1.5px solid var(--lavender)', borderRadius:10, marginBottom:8 }}>
            <span style={{ fontWeight:600, color:'var(--navy)' }}>{f.label} — {f.debut} → {f.fin}</span>
          </div>
        )) : <p style={{color:'var(--muted)',fontSize:'0.85rem',fontStyle:'italic'}}>Aucune période définie.</p>}
      </div>
    </div>
  );
}
