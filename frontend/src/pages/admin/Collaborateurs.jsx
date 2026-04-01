import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
import { api } from '../../services/api';
import { Avatar, PageHeader, Modal, ConfirmModal, FadeIn, Skeleton, fmtDate } from '../../components/UI';

export default function Collaborateurs() {
  const { collabs, showToast, getManagerName, reload } = useData();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('nom');
  const [sortAsc, setSortAsc] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const navigate = useNavigate();

  const sort = (key) => { if (sortKey === key) setSortAsc(!sortAsc); else { setSortKey(key); setSortAsc(true); } };
  const sortIcon = (key) => sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : ' ↕';

  let list = collabs.filter(c => !search || (c.prenom+' '+c.nom+' '+c.poste+' '+(c.email||'')).toLowerCase().includes(search.toLowerCase()));
  list = [...list].sort((a, b) => {
    let va, vb;
    if (sortKey === 'nom') { va = (a.nom||'').toLowerCase(); vb = (b.nom||'').toLowerCase(); }
    else if (sortKey === 'poste') { va = (a.poste||''); vb = (b.poste||''); }
    else if (sortKey === 'equipe') { va = (a.equipe||'zzz'); vb = (b.equipe||'zzz'); }
    else if (sortKey === 'manager') { va = a.manager_id ? getManagerName(a.manager_id) : 'zzz'; vb = b.manager_id ? getManagerName(b.manager_id) : 'zzz'; }
    else if (sortKey === 'dateEntree') { va = a.date_entree||'9999'; vb = b.date_entree||'9999'; }
    return (va < vb ? -1 : va > vb ? 1 : 0) * (sortAsc ? 1 : -1);
  });

  const openAdd = () => { setEditing(null); setForm({ prenom:'',nom:'',poste:'',email:'',telephone:'',date_entree:'',bureau:'',equipe:'',contrat:'',type_poste:'',manager_id:'' }); setModalOpen(true); };
  const openEdit = (c) => { setEditing(c.id); setForm({ ...c, manager_id: c.manager_id||'' }); setModalOpen(true); };

  const save = async () => {
    if (!form.prenom || !form.nom || !form.poste) { showToast('Prénom, nom et poste obligatoires'); return; }
    const row = { prenom:form.prenom, nom:form.nom, poste:form.poste, email:form.email||null, telephone:form.telephone||null, date_entree:form.date_entree||null, bureau:form.bureau||null, equipe:form.equipe||null, contrat:form.contrat||null, type_poste:form.type_poste||null, manager_id:form.manager_id||null };
    try {
      if (editing) await api.updateCollaborateur(editing, row);
      else await api.createCollaborateur(row);
      await reload(); setModalOpen(false); showToast('Enregistré !');
    } catch(e) { showToast('Erreur: '+e.message); }
  };

  const [confirmDel, setConfirmDel] = useState(null);
  const del = async () => {
    if (!confirmDel) return;
    try { await api.deleteCollaborateur(confirmDel); await reload(); showToast('Supprimé'); } catch(e) { showToast('Erreur: '+e.message); }
    setConfirmDel(null);
  };

  return (
    <div>
      <PageHeader title="Collaborateurs" subtitle="Gérer les membres de l'équipe" />
      <div style={{ display:'flex', justifyContent:'space-between', gap:12, marginBottom:16 }}>
        <input type="text" placeholder="🔍 Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex:1, maxWidth:400, border:'1.5px solid var(--lavender)', borderRadius:10, padding:'10px 16px', fontFamily:'inherit', fontSize:'0.9rem', outline:'none' }} />
        <button className="btn btn-primary" onClick={openAdd}>+ Ajouter</button>
      </div>
      <div className="card" style={{ overflowX:'auto' }}>
        <table>
          <thead><tr>
            <th style={{cursor:'pointer'}} onClick={()=>sort('nom')}>Collaborateur{sortIcon('nom')}</th>
            <th style={{cursor:'pointer'}} onClick={()=>sort('poste')}>Poste{sortIcon('poste')}</th>
            <th style={{cursor:'pointer'}} onClick={()=>sort('equipe')}>Équipe{sortIcon('equipe')}</th>
            <th style={{cursor:'pointer'}} onClick={()=>sort('manager')}>Manager{sortIcon('manager')}</th>
            <th style={{cursor:'pointer'}} onClick={()=>sort('dateEntree')}>Entrée{sortIcon('dateEntree')}</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>{list.map(c => (
            <tr key={c.id}>
              <td><div style={{display:'flex',alignItems:'center',gap:10}}>
                <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={32} />
                <div><div style={{fontWeight:700}}>{c.prenom} {c.nom}</div><div style={{fontSize:'0.72rem',color:'var(--muted)'}}>{c.email}</div></div>
              </div></td>
              <td>{c.poste}</td>
              <td>{c.equipe || '—'}</td>
              <td>{c.manager_id ? getManagerName(c.manager_id) : '—'}</td>
              <td>{fmtDate(c.date_entree)}</td>
              <td><div style={{display:'flex',gap:6}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>navigate(`/admin/collaborateurs/${c.id}`)}>Voir</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(c)}>✏️</button>
                <button className="btn btn-danger btn-sm" onClick={()=>setConfirmDel(c.id)}>🗑️</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editing ? 'Modifier' : 'Ajouter'}>
        <div className="form-grid">
          {[['prenom','Prénom *'],['nom','Nom *'],['poste','Poste *'],['email','Email'],['telephone','Tél'],['date_entree','Date entrée','date']].map(([k,l,t])=>(
            <div className="form-field" key={k}><label>{l}</label><input type={t||'text'} value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} /></div>
          ))}
          <div className="form-field"><label>Bureau</label>
            <select value={form.bureau||''} onChange={e=>setForm({...form,bureau:e.target.value})}>
              <option value="">— Choisir —</option>
              {(settings.bureaux||[]).map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="form-field"><label>Contrat</label>
            <select value={form.contrat||''} onChange={e=>setForm({...form,contrat:e.target.value})}>
              <option value="">— Choisir —</option>
              {(settings.contrats||[]).map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="form-field"><label>Type de poste</label>
            <select value={form.type_poste||''} onChange={e=>setForm({...form,type_poste:e.target.value})}>
              <option value="">— Choisir —</option>
              {(settings.typePostes||[]).map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="form-field full"><label>Équipe(s)</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {(settings.equipes||[]).map(eq=>{
                const selected = (form.equipe||'').split(',').map(s=>s.trim()).filter(Boolean);
                const checked = selected.includes(eq);
                return <label key={eq} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px',borderRadius:8,border:'1.5px solid var(--lavender)',cursor:'pointer',fontSize:'0.82rem',background:checked?'#FFF0F6':'white'}}>
                  <input type="checkbox" checked={checked} onChange={()=>{
                    const next = checked ? selected.filter(s=>s!==eq) : [...selected,eq];
                    setForm({...form, equipe: next.join(',')});
                  }} style={{accentColor:'var(--pink)',width:16,height:16}} />
                  {eq}
                </label>;
              })}
            </div>
          </div>
          <div className="form-field full"><label>Manager</label>
            <select value={form.manager_id||''} onChange={e=>setForm({...form,manager_id:e.target.value})}>
              <option value="">— Aucun —</option>
              {collabs.filter(c=>c.id!==editing).map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
          <button className="btn btn-ghost" onClick={()=>setModalOpen(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={save}>Enregistrer</button>
        </div>
      </Modal>
      <ConfirmModal open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={del} message="Supprimer ce collaborateur ? Cette action est irréversible." />
    </div>
  );
}
