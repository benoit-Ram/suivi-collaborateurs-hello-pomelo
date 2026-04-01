import React, { useState } from 'react';
import { useData } from '../../services/DataContext';
import { api } from '../../services/api';
import { PageHeader, Badge, ProgressBar, fmtDate } from '../../components/UI';

const SETTINGS_KEYS = [
  { key: 'equipes', label: 'Équipes', placeholder: 'Nouvelle équipe...' },
  { key: 'bureaux', label: 'Bureaux', placeholder: 'Nouveau bureau...' },
  { key: 'contrats', label: 'Types de contrat', placeholder: 'Nouveau type...' },
  { key: 'typePostes', label: 'Types de poste', placeholder: 'Ex : Senior, Lead...' },
];

export default function Settings() {
  const { settings, collabs, showToast, reload } = useData();
  const [newVals, setNewVals] = useState({});
  const [teamObjEquipe, setTeamObjEquipe] = useState('');
  const [newTeamObj, setNewTeamObj] = useState({ titre: '', date_debut: '', date_fin: '' });

  // ── CRUD settings lists ──
  const addItem = async (key) => {
    const val = (newVals[key] || '').trim();
    if (!val) return;
    const list = [...(settings[key] || [])];
    if (list.includes(val)) { showToast('Déjà dans la liste.'); return; }
    list.push(val);
    await api.upsertSetting(key, list);
    setNewVals({ ...newVals, [key]: '' });
    await reload();
    showToast(`"${val}" ajouté !`);
  };

  const removeItem = async (key, val) => {
    // Check if used by a collaborateur
    const fieldMap = { equipes: 'equipe', bureaux: 'bureau', contrats: 'contrat', typePostes: 'type_poste' };
    const field = fieldMap[key];
    if (field && collabs.some(c => (c[field] || '').split(',').map(s => s.trim()).includes(val))) {
      showToast('Impossible : utilisé par au moins un collaborateur.');
      return;
    }
    const list = (settings[key] || []).filter(v => v !== val);
    await api.upsertSetting(key, list);
    await reload();
    showToast(`"${val}" supprimé.`);
  };

  const renameItem = async (key, oldVal) => {
    const newVal = window.prompt(`Renommer "${oldVal}" en :`, oldVal);
    if (!newVal || !newVal.trim() || newVal.trim() === oldVal) return;
    const list = (settings[key] || []).map(v => v === oldVal ? newVal.trim() : v);
    await api.upsertSetting(key, list);
    // Update collaborateurs using old value
    const fieldMap = { equipes: 'equipe', bureaux: 'bureau', contrats: 'contrat', typePostes: 'type_poste' };
    const field = fieldMap[key];
    if (field) {
      const toUpdate = collabs.filter(c => (c[field] || '').includes(oldVal));
      for (const c of toUpdate) {
        const newFieldVal = key === 'equipes'
          ? (c[field] || '').split(',').map(s => s.trim() === oldVal ? newVal.trim() : s.trim()).join(',')
          : newVal.trim();
        await api.updateCollaborateur(c.id, { [field]: newFieldVal });
      }
    }
    await reload();
    showToast(`Renommé en "${newVal.trim()}"`);
  };

  // ── Team objectives ──
  const equipes = settings.equipes || [];
  const teamObjs = teamObjEquipe ? (settings['team_objectifs_' + teamObjEquipe] || []).map(o =>
    typeof o === 'string' ? { titre: o, date_debut: '', date_fin: '', progression: 0 } : o
  ) : [];

  const addTeamObj = async () => {
    if (!newTeamObj.titre.trim()) { showToast('Titre obligatoire'); return; }
    const list = [...teamObjs, { titre: newTeamObj.titre.trim(), dateDebut: newTeamObj.date_debut, dateFin: newTeamObj.date_fin, progression: 0 }];
    await api.upsertSetting('team_objectifs_' + teamObjEquipe, list);
    setNewTeamObj({ titre: '', date_debut: '', date_fin: '' });
    await reload();
    showToast('Objectif d\'équipe ajouté !');
  };

  const removeTeamObj = async (index) => {
    const list = [...teamObjs];
    list.splice(index, 1);
    await api.upsertSetting('team_objectifs_' + teamObjEquipe, list);
    await reload();
  };

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Listes de référence et configuration" />

      {/* Settings lists */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {SETTINGS_KEYS.map(({ key, label, placeholder }) => {
          const items = settings[key] || [];
          const isUsed = (val) => {
            const fieldMap = { equipes: 'equipe', bureaux: 'bureau', contrats: 'contrat', typePostes: 'type_poste' };
            const field = fieldMap[key];
            return field && collabs.some(c => (c[field] || '').split(',').map(s => s.trim()).includes(val));
          };
          return (
            <div key={key} className="card">
              <div className="section-title" style={{ marginTop: 0 }}>{label}</div>
              {items.map(v => (
                <div key={v} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', border: '1.5px solid var(--lavender)', borderRadius: 10, marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{v}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => renameItem(key, v)}>✏️</button>
                    {isUsed(v)
                      ? <span title="Utilisé par un collaborateur" style={{ color: 'var(--muted)', fontSize: '0.72rem', padding: '4px 8px', cursor: 'help' }}>🔒</span>
                      : <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => removeItem(key, v)}>✕</button>
                    }
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input value={newVals[key] || ''} onChange={e => setNewVals({ ...newVals, [key]: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') addItem(key); }}
                  placeholder={placeholder}
                  style={{ flex: 1, border: '1.5px solid var(--lavender)', borderRadius: 10, padding: '9px 12px', fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none' }} />
                <button className="btn btn-primary btn-sm" onClick={() => addItem(key)}>+</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Questions configurables */}
      <div className="section-title">Questions du point mensuel</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {['questions_manager', 'questions_collab'].map(key => {
          const questions = settings[key] || [];
          return (
            <div key={key} className="card">
              <div className="section-title" style={{ marginTop: 0 }}>{key === 'questions_manager' ? '👔 Manager' : '👤 Collaborateur'}</div>
              {questions.length ? questions.map((q, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1.5px solid var(--lavender)', borderRadius: 10, marginBottom: 8 }}>
                  <span style={{ flex: 1, fontWeight: 600, color: 'var(--navy)', fontSize: '0.88rem' }}>{q.label || q}</span>
                  <Badge type={q.type === 'notation' ? 'orange' : q.type === 'qcm' ? 'green' : 'blue'}>{q.type || 'texte'}</Badge>
                </div>
              )) : <p style={{ color: 'var(--muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>Questions par défaut.</p>}
            </div>
          );
        })}
      </div>

      {/* Objectifs d'équipe */}
      <div className="section-title">Objectifs d'équipe</div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <select value={teamObjEquipe} onChange={e => setTeamObjEquipe(e.target.value)}
            style={{ border: '1.5px solid var(--lavender)', borderRadius: 10, padding: '10px 14px', fontFamily: 'inherit', fontSize: '0.9rem', minWidth: 220 }}>
            <option value="">— Choisir une équipe —</option>
            {equipes.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {teamObjEquipe && <>
          {teamObjs.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: 12 }}>Aucun objectif pour cette équipe.</p>}
          {teamObjs.map((o, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1.5px solid var(--lavender)', borderRadius: 10, marginBottom: 8, borderLeft: '4px solid var(--blue)' }}>
              <span style={{ flex: 1, fontWeight: 600, color: 'var(--navy)' }}>{o.titre}</span>
              {(o.dateDebut || o.dateFin) && <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{fmtDate(o.dateDebut)} → {fmtDate(o.dateFin)}</span>}
              <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => removeTeamObj(i)}>✕</button>
            </div>
          ))}
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="form-field"><label>Titre</label><input value={newTeamObj.titre} onChange={e => setNewTeamObj({ ...newTeamObj, titre: e.target.value })} placeholder="Objectif d'équipe..." /></div>
            <div className="form-field"><label>Début</label><input type="date" value={newTeamObj.date_debut} onChange={e => setNewTeamObj({ ...newTeamObj, date_debut: e.target.value })} /></div>
            <div className="form-field"><label>Fin</label><input type="date" value={newTeamObj.date_fin} onChange={e => setNewTeamObj({ ...newTeamObj, date_fin: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={addTeamObj}>+ Ajouter</button>
          </div>
        </>}
      </div>

      {/* Périodes de fermeture */}
      <div className="section-title">Périodes de fermeture</div>
      <div className="card">
        {(settings['periodes_fermeture'] || []).length ? (settings['periodes_fermeture'] || []).map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', border: '1.5px solid var(--lavender)', borderRadius: 10, marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{f.label} — {fmtDate(f.debut)} → {fmtDate(f.fin)}</span>
          </div>
        )) : <p style={{ color: 'var(--muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>Aucune période définie.</p>}
      </div>
    </div>
  );
}
