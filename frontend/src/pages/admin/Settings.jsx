import React, { useState } from 'react';
import { useData } from '../../services/DataContext';
import { PageHeader } from '../../components/UI';

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
      <PageHeader title="Paramètres" subtitle="Gérer les listes de référence" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {SETTINGS_KEYS.map(({ key, label }) => {
          const items = settings[key] || [];
          return (
            <div key={key} className="card">
              <div className="section-title" style={{ marginTop: 0 }}>{label}</div>
              {items.length ? items.map(v => (
                <div key={v} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', border: '1.5px solid var(--lavender)', borderRadius: 10, marginBottom: 8, background: 'white' }}>
                  <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{v}</span>
                </div>
              )) : <p style={{ color: 'var(--muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>Aucun élément.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
