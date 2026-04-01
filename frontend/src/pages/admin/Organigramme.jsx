import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
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
  const { collabs } = useData();
  const navigate = useNavigate();

  const childrenMap = {};
  collabs.forEach(c => { if (c.manager_id) { (childrenMap[c.manager_id] = childrenMap[c.manager_id]||[]).push(c); } });
  const roots = collabs.filter(c => !c.manager_id);

  return (
    <div>
      <PageHeader title="Organigramme" subtitle="Hiérarchie de l'équipe" />
      <div className="card">
        {roots.length ? roots.map(r => <TreeNode key={r.id} c={r} childrenMap={childrenMap} depth={0} navigate={navigate} />) : <p style={{color:'var(--muted)'}}>Aucun collaborateur</p>}
      </div>
    </div>
  );
}
