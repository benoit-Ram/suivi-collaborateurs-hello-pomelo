import React, { useState } from 'react';
import { useData } from '../../services/DataContext';
import { useAuth } from '../../services/AuthContext';
import { api } from '../../services/api';
import { PageHeader, Badge, Avatar, Modal, fmtDate, DEFAULT_ABSENCE_TYPES } from '../../components/UI';
import { generateGuideAdmin, generateGuideCollab } from '../../components/GuidePDF';

const DEFAULT_MISSION_ROLES = [
  { label: 'Directeur Projet', tjm: 900 },
  { label: 'Product Manager', tjm: 700 },
  { label: 'Product Owner', tjm: 650 },
  { label: 'Proxi Product Owner', tjm: 600 },
  { label: 'Lead Designer', tjm: 800 },
  { label: 'Designer (UX/UI)', tjm: 650 },
  { label: 'Tech Lead', tjm: 900 },
  { label: 'Team Lead', tjm: 800 },
  { label: 'Développeur', tjm: 600 },
  { label: 'Ingénieur QA', tjm: 700 },
  { label: 'Lead Devops', tjm: 900 },
  { label: 'Ingénieur Devops', tjm: 700 },
  { label: 'Architecte cloud', tjm: 900 },
  { label: 'Chef de projet ERP', tjm: 900 },
  { label: 'Consultant fonctionnel', tjm: 800 },
  { label: 'Développeur intégrateur', tjm: 900 },
];

const SETTINGS_KEYS = [
  { key: 'equipes', label: 'Équipes', placeholder: 'Nouvelle équipe...' },
  { key: 'bureaux', label: 'Bureaux', placeholder: 'Nouveau bureau...' },
  { key: 'contrats', label: 'Types de contrat', placeholder: 'Nouveau type...' },
  { key: 'typePostes', label: 'Types de poste', placeholder: 'Ex : Senior, Lead...' },
  { key: 'mission_categories', label: 'Catégories de mission', placeholder: 'Ex : Web, Mobile, TMA...' },
  { key: 'competences_list', label: 'Compétences', placeholder: 'Ex : React, Node.js, DevOps...' },
];

export default function Settings() {
  const { settings, collabs, showToast, reload } = useData();
  const { isSuperAdmin, reloadCollabs } = useAuth();
  const SUPER_ADMIN_EMAIL = 'benoit@hello-pomelo.com';
  const [newVals, setNewVals] = useState({});
  const [newFerm, setNewFerm] = useState({ label:'', debut:'', fin:'' });
  const [renameModal, setRenameModal] = useState(null); // { key, oldVal }
  const [renameVal, setRenameVal] = useState('');

  const addItem = async (key) => {
    try {
      const val = (newVals[key]||'').trim();
      if (!val) return;
      const list = [...(settings[key]||[])];
      if (list.includes(val)) { showToast('Déjà dans la liste.'); return; }
      list.push(val);
      await api.upsertSetting(key, list);
      setNewVals({...newVals, [key]:''});
      await reload();
      showToast(`"${val}" ajouté !`);
    } catch(e) { showToast('Erreur : ' + e.message); }
  };

  const removeItem = async (key, val) => {
    try {
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
    } catch(e) { showToast('Erreur : ' + e.message); }
  };

  const openRename = (key, oldVal) => { setRenameModal({ key, oldVal }); setRenameVal(oldVal); };
  const renameItem = async () => {
    try {
      if (!renameModal) return;
      const { key, oldVal } = renameModal;
      const newVal = renameVal;
      if (!newVal || !newVal.trim() || newVal.trim() === oldVal) { setRenameModal(null); return; }
      if ((settings[key]||[]).includes(newVal.trim())) { showToast('Cette valeur existe déjà.'); return; }
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
      setRenameModal(null);
    } catch(e) { showToast('Erreur : ' + e.message); }
  };

  const isUsed = (key, val) => {
    const fieldMap = { equipes:'equipe', bureaux:'bureau', contrats:'contrat', typePostes:'type_poste' };
    const field = fieldMap[key];
    return field && collabs.some(c => (c[field]||'').split(',').map(s=>s.trim()).includes(val));
  };

  // Périodes de fermeture
  const fermetures = settings['periodes_fermeture'] || [];
  const addFermeture = async () => {
    try {
      if (!newFerm.label || !newFerm.debut || !newFerm.fin) { showToast('Remplissez tous les champs.'); return; }
      const list = [...fermetures, { label:newFerm.label, debut:newFerm.debut, fin:newFerm.fin }];
      await api.upsertSetting('periodes_fermeture', list);
      setNewFerm({ label:'', debut:'', fin:'' });
      await reload();
      showToast('Période ajoutée !');
    } catch(e) { showToast('Erreur : ' + e.message); }
  };
  const removeFermeture = async (i) => {
    try {
      const list = [...fermetures]; list.splice(i,1);
      await api.upsertSetting('periodes_fermeture', list);
      await reload();
      showToast('Période supprimée.');
    } catch(e) { showToast('Erreur : ' + e.message); }
  };

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Listes de référence et configuration" />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20, marginBottom:24 }}>
        {SETTINGS_KEYS.map(({ key, label, placeholder }) => (
          <div key={key} className="card">
            <div className="section-title" style={{ marginTop:0 }}>{label}</div>
            {(settings[key]||[]).map(v => (
              <div key={v} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', border:'1.5px solid var(--lavender)', borderRadius:10, marginBottom:8 }}>
                <span style={{ fontWeight:600, color:'var(--navy)' }}>{v}</span>
                <div style={{ display:'flex', gap:4 }}>
                  <button className="btn btn-ghost btn-sm" style={{padding:'4px 8px'}} onClick={() => openRename(key, v)} aria-label="Renommer">✏️</button>
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

      {/* Types d'absence */}
      {/* Rôles missions */}
      <MissionRolesEditor roles={settings['mission_roles']||DEFAULT_MISSION_ROLES} onSave={async(list)=>{try{await api.upsertSetting('mission_roles',list);await reload();showToast('Rôles missions mis à jour !');}catch(e){showToast('Erreur: '+e.message);}}} />

      <AbsenceTypesEditor types={settings['absence_types']||DEFAULT_ABSENCE_TYPES} onSave={async(list)=>{try{await api.upsertSetting('absence_types',list);await reload();showToast('Types d\'absence mis à jour !');}catch(e){showToast('Erreur: '+e.message);}}} />

      {/* Questions */}
      <div className="section-title" title="Les modifications s'appliqueront aux entretiens du mois prochain">Questions de l'entretien RH mensuel</div>
      <div style={{background:'var(--bg-warning)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:'0.82rem',color:'var(--text-warning)',fontWeight:600,borderLeft:'4px solid var(--border-warning)'}}>⚠️ Les modifications s'appliqueront aux entretiens du <strong>mois prochain</strong> uniquement. Les entretiens déjà créés ne sont pas impactés.</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20, marginBottom:24 }}>
        {['questions_manager','questions_collab'].map(key => <QuestionEditor key={key} settingsKey={key} label={key==='questions_manager'?'👔 Manager':'👤 Collaborateur'} questions={settings[key]||[]} onSave={async(list)=>{await api.upsertSetting(key,list);await reload();showToast('Questions mises à jour !');}} />)}
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

      {/* Report de congés */}
      <div className="section-title">Report de conges</div>
      <div className="card" style={{marginBottom:24}}>
        <p style={{color:'var(--muted)',fontSize:'0.82rem',marginBottom:12}}>Nombre maximum de jours reportables d'une annee sur l'autre (droit francais : 12 jours max).</p>
        <div className="form-grid">
          <div className="form-field">
            <label>Max jours reportables</label>
            <input type="number" min="0" value={settings.max_report_conges ?? 12} onChange={async(e)=>{try{await api.upsertSetting('max_report_conges',parseInt(e.target.value)||0);await reload();showToast('Report mis a jour');}catch(err){showToast('Erreur: '+err.message);}}} />
          </div>
        </div>
      </div>

      {/* Gestion des administrateurs — super admin uniquement */}
      {isSuperAdmin && (
        <>
          <div className="section-title">Administrateurs</div>
          <div className="card" style={{marginBottom:24}}>
            <p style={{color:'var(--muted)',fontSize:'0.82rem',marginBottom:16}}>Les administrateurs peuvent accéder à l'espace de gestion.</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {collabs.map(c => {
                const isSA = (c.email||'').toLowerCase() === SUPER_ADMIN_EMAIL;
                const isAdm = c.is_admin === true;
                return (
                  <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,border:'1.5px solid var(--lavender)',background: isAdm ? 'var(--bg-success, #DCFCE7)' : 'transparent'}}>
                    <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={32} />
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:'0.88rem',color:'var(--navy)'}}>{c.prenom} {c.nom}</div>
                      <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>{c.email || '(pas d\'email)'}{isSA ? ' — Super Admin' : ''}</div>
                    </div>
                    {isSA ? (
                      <span style={{fontSize:'0.7rem',color:'var(--muted)',fontWeight:700}}>🔒 Permanent</span>
                    ) : (
                      <button className={`btn btn-sm ${isAdm ? 'btn-danger' : 'btn-primary'}`}
                        onClick={async () => {
                          await api.updateCollaborateur(c.id, { is_admin: !isAdm });
                          await reload();
                          await reloadCollabs();
                          showToast(isAdm ? `${c.prenom} n'est plus admin.` : `${c.prenom} est maintenant admin !`);
                        }}>
                        {isAdm ? 'Retirer admin' : 'Rendre admin'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Guides utilisateurs */}
      <div className="section-title">Guides utilisateurs</div>
      <div className="card" style={{marginBottom:24}}>
        <p style={{color:'var(--muted)',fontSize:'0.82rem',marginBottom:14}}>Generez les guides au format PDF pour vos equipes. Un document HTML s'ouvrira dans un nouvel onglet — utilisez <strong>Ctrl+P</strong> pour l'imprimer ou le sauvegarder en PDF.</p>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button className="btn btn-primary" onClick={generateGuideAdmin}>📥 Guide Administrateur</button>
          <button className="btn btn-navy" onClick={generateGuideCollab}>📥 Guide Collaborateur</button>
        </div>
      </div>

      {/* RENAME MODAL */}
      <Modal open={!!renameModal} onClose={()=>setRenameModal(null)} title="Renommer">
        <div className="form-field">
          <label>Nouvelle valeur <span style={{color:'var(--red)'}}>*</span></label>
          <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')renameItem();}} />
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-ghost" onClick={()=>setRenameModal(null)}>Annuler</button>
          <button className="btn btn-primary" onClick={renameItem} disabled={!renameVal.trim()}>💾 Renommer</button>
        </div>
      </Modal>
    </div>
  );
}

function QuestionEditor({ settingsKey, label, questions, onSave }) {
  const [list, setList] = useState(questions.map(q => typeof q==='string'?{label:q,type:'texte',obligatoire:true}:q));
  const [newQ, setNewQ] = useState({label:'',type:'texte',obligatoire:true});
  const [preview, setPreview] = useState(false);

  const save = () => onSave(list);
  const add = () => {
    if (!newQ.label.trim()) return;
    setList([...list, {...newQ, label:newQ.label.trim()}]);
    setNewQ({label:'',type:'texte',obligatoire:true});
  };
  const remove = (i) => { const l=[...list]; l.splice(i,1); setList(l); };
  const move = (i, dir) => {
    const l=[...list]; const ni=i+dir;
    if (ni<0||ni>=l.length) return;
    [l[i],l[ni]]=[l[ni],l[i]]; setList(l);
  };
  const edit = (i, field, val) => {
    const l=[...list]; l[i]={...l[i],[field]:val}; setList(l);
  };

  const hasChanges = JSON.stringify(list) !== JSON.stringify(questions.map(q => typeof q==='string'?{label:q,type:'texte',obligatoire:true}:q));

  return (
    <div className="card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div className="section-title" style={{marginTop:0}}>{label}</div>
        <div style={{display:'flex',gap:6}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setPreview(!preview)}>{preview?'✏️ Éditer':'👁 Aperçu'}</button>
          {hasChanges && <button className="btn btn-primary btn-sm" onClick={save}>💾 Sauvegarder</button>}
        </div>
      </div>

      {preview ? (
        <div style={{background:'var(--offwhite)',borderRadius:10,padding:16,marginTop:12}}>
          <div style={{fontSize:'0.78rem',color:'var(--muted)',marginBottom:12,fontWeight:600}}>Aperçu du formulaire :</div>
          {list.map((q,i) => (
            <div key={i} style={{marginBottom:12}}>
              <label style={{fontSize:'0.75rem',fontWeight:700,color:'var(--navy)',display:'block',marginBottom:4}}>
                {q.label} {q.obligatoire && <span style={{color:'var(--pink)'}}>*</span>}
              </label>
              {q.type==='notation' ? (
                <div style={{display:'flex',gap:8}}>
                  {[1,2,3,4,5].map(n => <div key={n} style={{width:36,height:36,borderRadius:8,border:'1.5px solid var(--lavender)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.85rem',fontWeight:700,color:'var(--navy)'}}>{n}</div>)}
                </div>
              ) : <div style={{background:'var(--white)',border:'1.5px solid var(--lavender)',borderRadius:8,padding:'10px 12px',fontSize:'0.85rem',color:'var(--muted)',fontStyle:'italic'}}>Réponse libre...</div>}
            </div>
          ))}
        </div>
      ) : <>
        {list.map((q,i) => (
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',border:'1.5px solid var(--lavender)',borderRadius:10,marginBottom:6}}>
            <div style={{display:'flex',flexDirection:'column',gap:2}}>
              <button className="btn btn-ghost btn-sm" style={{padding:'1px 4px',lineHeight:1}} onClick={()=>move(i,-1)} disabled={i===0}>▲</button>
              <button className="btn btn-ghost btn-sm" style={{padding:'1px 4px',lineHeight:1}} onClick={()=>move(i,1)} disabled={i===list.length-1}>▼</button>
            </div>
            <input value={q.label} onChange={e=>edit(i,'label',e.target.value)} style={{flex:1,border:'none',fontFamily:'inherit',fontSize:'0.85rem',fontWeight:600,color:'var(--navy)',outline:'none',background:'transparent'}} />
            <select value={q.type||'texte'} onChange={e=>edit(i,'type',e.target.value)} style={{border:'1.5px solid var(--lavender)',borderRadius:6,padding:'4px 8px',fontSize:'0.75rem',fontFamily:'inherit'}}>
              <option value="texte">Texte</option>
              <option value="notation">Notation 1-5</option>
            </select>
            <label style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.72rem',color:'var(--muted)',cursor:'pointer',whiteSpace:'nowrap'}} title="Question obligatoire">
              <input type="checkbox" checked={q.obligatoire!==false} onChange={e=>edit(i,'obligatoire',e.target.checked)} style={{accentColor:'var(--pink)'}} /> Req.
            </label>
            <button className="btn btn-danger btn-sm" style={{padding:'3px 6px'}} onClick={()=>remove(i)}>✕</button>
          </div>
        ))}
        <div style={{display:'flex',gap:8,marginTop:10,alignItems:'end'}}>
          <input value={newQ.label} onChange={e=>setNewQ({...newQ,label:e.target.value})} onKeyDown={e=>{if(e.key==='Enter')add();}} placeholder="Nouvelle question..."
            style={{flex:1,border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px 12px',fontFamily:'inherit',fontSize:'0.85rem',outline:'none'}} />
          <select value={newQ.type} onChange={e=>setNewQ({...newQ,type:e.target.value})} style={{border:'1.5px solid var(--lavender)',borderRadius:8,padding:'8px',fontSize:'0.82rem',fontFamily:'inherit'}}>
            <option value="texte">Texte</option>
            <option value="notation">Note 1-5</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={add}>+</button>
        </div>
      </>}
    </div>
  );
}

function AbsenceTypesEditor({ types, onSave }) {
  const [list, setList] = useState(types.map(t => typeof t === 'string' ? { key: t, label: t, decompte: false } : t));
  const [newType, setNewType] = useState({ label: '', decompte: false });
  const hasChanges = JSON.stringify(list) !== JSON.stringify(types);

  const add = () => {
    if (!newType.label.trim()) return;
    const key = newType.label.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (list.some(t => t.key === key)) return;
    setList([...list, { key, label: newType.label.trim(), decompte: newType.decompte }]);
    setNewType({ label: '', decompte: false });
  };

  const remove = (i) => { const l = [...list]; l.splice(i, 1); setList(l); };
  const toggle = (i) => { const l = [...list]; l[i] = { ...l[i], decompte: !l[i].decompte }; setList(l); };
  const move = (i, dir) => { const l = [...list]; const ni = i + dir; if (ni < 0 || ni >= l.length) return; [l[i], l[ni]] = [l[ni], l[i]]; setList(l); };

  return (
    <>
      <div className="section-title">Types d'absence</div>
      <div className="card" style={{ marginBottom: 24 }}>
        <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: 14 }}>
          Configurez les types d'absence disponibles. Cochez "Decompte" si le type deduit du solde de conges.
        </p>
        {list.map((t, i) => (
          <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1.5px solid var(--lavender)', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => move(i, -1)}>▲</button>
              <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => move(i, 1)}>▼</button>
            </div>
            <span style={{ flex: 1, fontWeight: 600, color: 'var(--navy)' }}>{t.label}</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: t.decompte ? 'var(--green)' : 'var(--muted)', fontWeight: 700, cursor: 'pointer' }}>
              <input type="checkbox" checked={t.decompte} onChange={() => toggle(i)} style={{ accentColor: 'var(--green)' }} />
              Decompte
            </label>
            <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => remove(i)}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input value={newType.label} onChange={e => setNewType({ ...newType, label: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="Nouveau type..." style={{ flex: 1, border: '1.5px solid var(--lavender)', borderRadius: 8, padding: '8px 12px', fontFamily: 'inherit', fontSize: '0.85rem' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <input type="checkbox" checked={newType.decompte} onChange={e => setNewType({ ...newType, decompte: e.target.checked })} style={{ accentColor: 'var(--green)' }} />
            Decompte
          </label>
          <button className="btn btn-primary btn-sm" onClick={add}>+</button>
        </div>
        {hasChanges && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button className="btn btn-primary btn-sm" onClick={() => onSave(list)}>💾 Sauvegarder</button></div>}
      </div>
    </>
  );
}

function MissionRolesEditor({ roles, onSave }) {
  const [list, setList] = useState(roles);
  const [newRole, setNewRole] = useState({ label: '', tjm: '' });
  const hasChanges = JSON.stringify(list) !== JSON.stringify(roles);

  const add = () => {
    if (!newRole.label.trim() || !newRole.tjm) return;
    if (list.some(r => r.label.toLowerCase() === newRole.label.trim().toLowerCase())) return;
    setList([...list, { label: newRole.label.trim(), tjm: parseInt(newRole.tjm) }]);
    setNewRole({ label: '', tjm: '' });
  };

  const remove = (i) => { const l = [...list]; l.splice(i, 1); setList(l); };
  const move = (i, dir) => { const l = [...list]; const ni = i + dir; if (ni < 0 || ni >= l.length) return; [l[i], l[ni]] = [l[ni], l[i]]; setList(l); };
  const edit = (i, field, val) => { const l = [...list]; l[i] = { ...l[i], [field]: field === 'tjm' ? parseInt(val) || 0 : val }; setList(l); };

  return (
    <>
      <div className="section-title">Roles missions & TJM indicatifs</div>
      <div className="card" style={{ marginBottom: 24 }}>
        <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: 14 }}>
          Definissez les roles disponibles pour les affectations de missions, avec un TJM indicatif par defaut (modifiable par affectation).
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.82rem' }}>
            <thead><tr><th style={{ textAlign: 'left', padding: '8px' }}>Role</th><th style={{ textAlign: 'right', padding: '8px', width: 100 }}>TJM</th><th style={{ width: 80 }}></th></tr></thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--lavender)' }}>
                  <td style={{ padding: '6px 8px' }}>
                    <input value={r.label} onChange={e => edit(i, 'label', e.target.value)} style={{ border: '1px solid var(--lavender)', borderRadius: 6, padding: '4px 8px', fontFamily: 'inherit', fontSize: '0.82rem', width: '100%', fontWeight: 600, color: 'var(--navy)' }} />
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <input type="number" value={r.tjm} onChange={e => edit(i, 'tjm', e.target.value)} style={{ border: '1px solid var(--lavender)', borderRadius: 6, padding: '4px 8px', fontFamily: 'inherit', fontSize: '0.82rem', width: 70, textAlign: 'right', fontWeight: 700 }} />
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>€</span>
                    </div>
                  </td>
                  <td style={{ padding: '4px' }}>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 4px', fontSize: '0.65rem' }} onClick={() => move(i, -1)}>▲</button>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 4px', fontSize: '0.65rem' }} onClick={() => move(i, 1)}>▼</button>
                      <button className="btn btn-danger btn-sm" style={{ padding: '2px 4px', fontSize: '0.65rem' }} onClick={() => remove(i)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <input value={newRole.label} onChange={e => setNewRole({ ...newRole, label: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="Nouveau role..." style={{ flex: 1, border: '1.5px solid var(--lavender)', borderRadius: 8, padding: '8px 12px', fontFamily: 'inherit', fontSize: '0.85rem' }} />
          <input type="number" value={newRole.tjm} onChange={e => setNewRole({ ...newRole, tjm: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="TJM €" style={{ width: 80, border: '1.5px solid var(--lavender)', borderRadius: 8, padding: '8px 12px', fontFamily: 'inherit', fontSize: '0.85rem', textAlign: 'right' }} />
          <button className="btn btn-primary btn-sm" onClick={add}>+</button>
        </div>
        {hasChanges && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button className="btn btn-primary btn-sm" onClick={() => onSave(list)}>💾 Sauvegarder</button></div>}
      </div>
    </>
  );
}
