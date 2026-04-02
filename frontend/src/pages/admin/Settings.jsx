import React, { useState } from 'react';
import { useData } from '../../services/DataContext';
import { api } from '../../services/api';
import { PageHeader, Badge, fmtDate } from '../../components/UI';

const SETTINGS_KEYS = [
  { key: 'equipes', label: 'Équipes', placeholder: 'Nouvelle équipe...' },
  { key: 'bureaux', label: 'Bureaux', placeholder: 'Nouveau bureau...' },
  { key: 'contrats', label: 'Types de contrat', placeholder: 'Nouveau type...' },
  { key: 'typePostes', label: 'Types de poste', placeholder: 'Ex : Senior, Lead...' },
];

export default function Settings() {
  const { settings, collabs, showToast, reload } = useData();
  const [newVals, setNewVals] = useState({});
  const [newFerm, setNewFerm] = useState({ label:'', debut:'', fin:'' });

  const addItem = async (key) => {
    const val = (newVals[key]||'').trim();
    if (!val) return;
    const list = [...(settings[key]||[])];
    if (list.includes(val)) { showToast('Déjà dans la liste.'); return; }
    list.push(val);
    await api.upsertSetting(key, list);
    setNewVals({...newVals, [key]:''});
    await reload();
    showToast(`"${val}" ajouté !`);
  };

  const removeItem = async (key, val) => {
    const fieldMap = { equipes:'equipe', bureaux:'bureau', contrats:'contrat', typePostes:'type_poste' };
    const field = fieldMap[key];
    if (field && collabs.some(c => (c[field]||'').split(',').map(s=>s.trim()).includes(val))) {
      showToast('Impossible : utilisé par un collaborateur.');
      return;
    }
    const list = (settings[key]||[]).filter(v => v !== val);
    await api.upsertSetting(key, list);
    await reload();
    showToast(`"${val}" supprimé.`);
  };

  const renameItem = async (key, oldVal) => {
    const newVal = window.prompt(`Renommer "${oldVal}" en :`, oldVal);
    if (!newVal || !newVal.trim() || newVal.trim() === oldVal) return;
    const list = (settings[key]||[]).map(v => v === oldVal ? newVal.trim() : v);
    await api.upsertSetting(key, list);
    const fieldMap = { equipes:'equipe', bureaux:'bureau', contrats:'contrat', typePostes:'type_poste' };
    const field = fieldMap[key];
    if (field) {
      const toUpdate = collabs.filter(c => (c[field]||'').includes(oldVal));
      for (const c of toUpdate) {
        const newFieldVal = key === 'equipes' ? (c[field]||'').split(',').map(s=>s.trim()===oldVal?newVal.trim():s.trim()).join(',') : newVal.trim();
        await api.updateCollaborateur(c.id, { [field]: newFieldVal });
      }
    }
    await reload();
    showToast(`Renommé en "${newVal.trim()}"`);
  };

  const isUsed = (key, val) => {
    const fieldMap = { equipes:'equipe', bureaux:'bureau', contrats:'contrat', typePostes:'type_poste' };
    const field = fieldMap[key];
    return field && collabs.some(c => (c[field]||'').split(',').map(s=>s.trim()).includes(val));
  };

  // Périodes de fermeture
  const fermetures = settings['periodes_fermeture'] || [];
  const addFermeture = async () => {
    if (!newFerm.label || !newFerm.debut || !newFerm.fin) { showToast('Remplissez tous les champs.'); return; }
    const list = [...fermetures, { label:newFerm.label, debut:newFerm.debut, fin:newFerm.fin }];
    await api.upsertSetting('periodes_fermeture', list);
    setNewFerm({ label:'', debut:'', fin:'' });
    await reload();
    showToast('Période ajoutée !');
  };
  const removeFermeture = async (i) => {
    const list = [...fermetures]; list.splice(i,1);
    await api.upsertSetting('periodes_fermeture', list);
    await reload();
    showToast('Période supprimée.');
  };

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Listes de référence et configuration" />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
        {SETTINGS_KEYS.map(({ key, label, placeholder }) => (
          <div key={key} className="card">
            <div className="section-title" style={{ marginTop:0 }}>{label}</div>
            {(settings[key]||[]).map(v => (
              <div key={v} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', border:'1.5px solid var(--lavender)', borderRadius:10, marginBottom:8 }}>
                <span style={{ fontWeight:600, color:'var(--navy)' }}>{v}</span>
                <div style={{ display:'flex', gap:4 }}>
                  <button className="btn btn-ghost btn-sm" style={{padding:'4px 8px'}} onClick={() => renameItem(key, v)}>✏️</button>
                  {isUsed(key, v) ? <span title="Utilisé" style={{color:'var(--muted)',fontSize:'0.72rem',padding:'4px 8px',cursor:'help'}}>🔒</span>
                    : <button className="btn btn-danger btn-sm" style={{padding:'4px 8px'}} onClick={() => removeItem(key, v)}>✕</button>}
                </div>
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <input value={newVals[key]||''} onChange={e => setNewVals({...newVals,[key]:e.target.value})} onKeyDown={e => {if(e.key==='Enter')addItem(key)}} placeholder={placeholder}
                style={{ flex:1, border:'1.5px solid var(--lavender)', borderRadius:10, padding:'9px 12px', fontFamily:'inherit', fontSize:'0.9rem', outline:'none' }} />
              <button className="btn btn-primary btn-sm" onClick={() => addItem(key)}>+</button>
            </div>
          </div>
        ))}
      </div>

      {/* Questions */}
      <div className="section-title">Questions de l'entretien RH mensuel</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
        {['questions_manager','questions_collab'].map(key => (
          <div key={key} className="card">
            <div className="section-title" style={{marginTop:0}}>{key==='questions_manager'?'👔 Manager':'👤 Collaborateur'}</div>
            {(settings[key]||[]).length ? (settings[key]||[]).map((q,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', border:'1.5px solid var(--lavender)', borderRadius:10, marginBottom:8 }}>
                <span style={{ flex:1, fontWeight:600, color:'var(--navy)', fontSize:'0.88rem' }}>{q.label||q}</span>
                <Badge type={q.type==='notation'?'orange':q.type==='qcm'?'green':'blue'}>{q.type||'texte'}</Badge>
              </div>
            )) : <p style={{color:'var(--muted)',fontSize:'0.85rem',fontStyle:'italic'}}>Questions par défaut.</p>}
          </div>
        ))}
      </div>

      {/* Périodes de fermeture */}
      <div className="section-title">Périodes de fermeture entreprise</div>
      <div className="card" style={{marginBottom:24}}>
        {fermetures.map((f,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', border:'1.5px solid var(--lavender)', borderRadius:10, marginBottom:8 }}>
            <span style={{ fontWeight:600, color:'var(--navy)' }}>{f.label} — {fmtDate(f.debut)} → {fmtDate(f.fin)}</span>
            <button className="btn btn-danger btn-sm" style={{padding:'4px 8px'}} onClick={() => removeFermeture(i)}>✕</button>
          </div>
        ))}
        {!fermetures.length && <p style={{color:'var(--muted)',fontSize:'0.85rem',fontStyle:'italic',marginBottom:12}}>Aucune période définie.</p>}
        <div className="form-grid" style={{marginTop:8}}>
          <div className="form-field"><label>Libellé</label><input value={newFerm.label} onChange={e=>setNewFerm({...newFerm,label:e.target.value})} placeholder="Ex: Fermeture Noël" /></div>
          <div className="form-field"><label>Du</label><input type="date" value={newFerm.debut} onChange={e=>setNewFerm({...newFerm,debut:e.target.value})} /></div>
          <div className="form-field"><label>Au</label><input type="date" value={newFerm.fin} onChange={e=>setNewFerm({...newFerm,fin:e.target.value})} /></div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}><button className="btn btn-primary btn-sm" onClick={addFermeture}>+ Ajouter</button></div>
      </div>
    </div>
  );
}
