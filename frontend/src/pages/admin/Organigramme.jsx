import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
import { api } from '../../services/api';
import { Avatar, PageHeader } from '../../components/UI';

function TreeNode({ c, childrenMap, depth, navigate }) {
  const children = childrenMap[c.id] || [];
  return (
    <div style={{ marginLeft: depth*22, borderLeft: depth?'2px solid var(--lavender)':'none', paddingLeft: depth?14:0, marginTop:8 }}>
      <div onClick={() => navigate(`/admin/collaborateurs/${c.id}`)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--white)', borderRadius:10, marginBottom:6, boxShadow:'var(--shadow-sm)', cursor:'pointer', transition:'all 0.15s' }}
        onMouseOver={e=>e.currentTarget.style.transform='translateX(3px)'} onMouseOut={e=>e.currentTarget.style.transform=''}>
        <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={32} />
        <div>
          <div style={{ fontWeight:700, fontSize:'0.82rem', color:'var(--navy)' }}>{c.prenom} {c.nom}</div>
          <div style={{ fontSize:'0.7rem', color:'var(--muted)' }}>{c.poste}</div>
        </div>
      </div>
      {children.map(ch => <TreeNode key={ch.id} c={ch} childrenMap={childrenMap} depth={depth+1} navigate={navigate} />)}
    </div>
  );
}

export default function Organigramme() {
  const { collabs, showToast, reload } = useData();
  const navigate = useNavigate();
  const [selCollab, setSelCollab] = useState('');
  const [selManager, setSelManager] = useState('');
  const [searchCollab, setSearchCollab] = useState('');
  const [searchManager, setSearchManager] = useState('');

  const childrenMap = {};
  collabs.forEach(c => { if (c.manager_id) { (childrenMap[c.manager_id] = childrenMap[c.manager_id]||[]).push(c); } });
  const roots = collabs.filter(c => !c.manager_id);

  const filteredCollab = searchCollab.length >= 2 ? collabs.filter(c => (c.prenom+' '+c.nom).toLowerCase().includes(searchCollab.toLowerCase())) : [];
  const filteredManager = searchManager.length >= 2 ? collabs.filter(c => c.id !== selCollab && (c.prenom+' '+c.nom).toLowerCase().includes(searchManager.toLowerCase())) : [];

  const saveRelation = async () => {
    if (!selCollab) { showToast('Choisissez un collaborateur.'); return; }
    if (selCollab === selManager) { showToast('Un collaborateur ne peut pas être son propre manager.'); return; }
    try {
      await api.updateCollaborateur(selCollab, { manager_id: selManager || null });
      await reload();
      setSelCollab(''); setSelManager(''); setSearchCollab(''); setSearchManager('');
      showToast('Relation enregistrée !');
    } catch(e) { showToast('Erreur: '+e.message); }
  };

  const collabName = (id) => { const c = collabs.find(x=>x.id===id); return c ? `${c.prenom} ${c.nom}` : ''; };

  return (
    <div>
      <PageHeader title="Organigramme" subtitle="Hiérarchie de l'équipe" />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
        <div className="card">
          <div className="section-title" style={{marginTop:0}}>Organigramme</div>
          {roots.length ? roots.map(r => <TreeNode key={r.id} c={r} childrenMap={childrenMap} depth={0} navigate={navigate} />) : <p style={{color:'var(--muted)'}}>Aucun collaborateur</p>}
        </div>
        <div className="card">
          <div className="section-title" style={{marginTop:0}}>Modifier une relation</div>
          <div className="form-field" style={{marginBottom:14}}>
            <label>Collaborateur</label>
            <div style={{position:'relative'}}>
              <input value={searchCollab} onChange={e=>{setSearchCollab(e.target.value);setSelCollab('');}} placeholder="Taper 2 lettres..." style={{width:'100%',border:'1.5px solid var(--lavender)',borderRadius:10,padding:'10px 14px',fontFamily:'inherit',fontSize:'0.9rem',outline:'none'}} />
              {selCollab && <div style={{fontSize:'0.78rem',color:'var(--green)',fontWeight:700,marginTop:4}}>✓ {collabName(selCollab)}</div>}
              {filteredCollab.length > 0 && !selCollab && <div style={{position:'absolute',top:'100%',left:0,right:0,background:'white',borderRadius:10,boxShadow:'0 8px 32px rgba(5,5,109,0.2)',zIndex:10,maxHeight:200,overflowY:'auto',marginTop:4}}>
                {filteredCollab.map(c=><div key={c.id} onMouseDown={()=>{setSelCollab(c.id);setSearchCollab(c.prenom+' '+c.nom);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:'0.85rem'}} onMouseOver={e=>e.currentTarget.style.background='var(--offwhite)'} onMouseOut={e=>e.currentTarget.style.background='white'}>{c.prenom} {c.nom} — {c.poste}</div>)}
              </div>}
            </div>
          </div>
          <div className="form-field" style={{marginBottom:20}}>
            <label>Manager</label>
            <div style={{position:'relative'}}>
              <input value={searchManager} onChange={e=>{setSearchManager(e.target.value);setSelManager('');}} placeholder="Taper 2 lettres (vide = aucun)..." style={{width:'100%',border:'1.5px solid var(--lavender)',borderRadius:10,padding:'10px 14px',fontFamily:'inherit',fontSize:'0.9rem',outline:'none'}} />
              {selManager && <div style={{fontSize:'0.78rem',color:'var(--green)',fontWeight:700,marginTop:4}}>✓ {collabName(selManager)}</div>}
              {filteredManager.length > 0 && !selManager && <div style={{position:'absolute',top:'100%',left:0,right:0,background:'white',borderRadius:10,boxShadow:'0 8px 32px rgba(5,5,109,0.2)',zIndex:10,maxHeight:200,overflowY:'auto',marginTop:4}}>
                {filteredManager.map(c=><div key={c.id} onMouseDown={()=>{setSelManager(c.id);setSearchManager(c.prenom+' '+c.nom);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:'0.85rem'}} onMouseOver={e=>e.currentTarget.style.background='var(--offwhite)'} onMouseOut={e=>e.currentTarget.style.background='white'}>{c.prenom} {c.nom} — {c.poste}</div>)}
              </div>}
            </div>
          </div>
          <button className="btn btn-primary" onClick={saveRelation} style={{width:'100%'}}>Enregistrer la relation</button>
        </div>
      </div>
    </div>
  );
}
