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

  const exportPDF = () => {
    const win = window.open('','_blank');
    if (!win) { showToast('Le popup a été bloqué. Autorisez les popups pour exporter.'); return; }
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
    const timeStr = now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

    const renderNode = (c, depth) => {
      const children = childrenMap[c.id] || [];
      const indent = depth * 28;
      const borderLeft = depth ? 'border-left:2px solid #CFD0E5;' : '';
      const paddingLeft = depth ? 'padding-left:16px;' : '';
      let html = `<div style="margin-left:${indent}px;${borderLeft}${paddingLeft}margin-top:${depth?6:12}px;">`;
      html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;background:#F8F7FC;border-radius:10px;margin-bottom:4px;">`;
      const initials = (c.prenom||'')[0] + (c.nom||'')[0];
      html += `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#FF3285,#0000EA);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.75rem;">${initials}</div>`;
      html += `<div><div style="font-weight:700;font-size:0.85rem;color:#05056D;">${c.prenom} ${c.nom}</div>`;
      html += `<div style="font-size:0.72rem;color:#6B6B9A;">${c.poste||''}${c.equipe ? ' · '+c.equipe : ''}</div></div></div>`;
      children.forEach(ch => { html += renderNode(ch, depth + 1); });
      html += '</div>';
      return html;
    };

    win.document.write(`<html><head><title>Organigramme — Hello Pomelo</title>
    <style>
      body{font-family:Quicksand,Arial,sans-serif;padding:32px 40px;max-width:900px;margin:0 auto;color:#05056D;font-size:14px;line-height:1.5}
      h1{font-size:1.4rem;margin-bottom:2px}
      .meta{font-size:0.82rem;color:#6B6B9A;margin-bottom:24px}
      .stats{display:flex;gap:24px;margin-bottom:24px;padding:14px 20px;background:#F8F7FC;border-radius:12px;border-left:4px solid #FF3285}
      .stat-item{text-align:center}.stat-val{font-size:1.3rem;font-weight:700;color:#FF3285}.stat-label{font-size:0.7rem;color:#6B6B9A;text-transform:uppercase;font-weight:600}
      @media print{body{padding:16px 20px} .stats{break-inside:avoid}}
    </style></head><body>`);

    // Header
    win.document.write(`<h1>Organigramme</h1>`);
    win.document.write(`<div class="meta">Hello Pomelo · Export du ${dateStr} à ${timeStr}</div>`);

    // Stats
    const nbManagers = new Set(collabs.filter(c=>c.manager_id).map(c=>c.manager_id)).size;
    const nbEquipes = new Set(collabs.map(c=>c.equipe).filter(Boolean)).size;
    win.document.write(`<div class="stats">`);
    win.document.write(`<div class="stat-item"><div class="stat-val">${collabs.length}</div><div class="stat-label">Collaborateurs</div></div>`);
    win.document.write(`<div class="stat-item"><div class="stat-val">${nbManagers}</div><div class="stat-label">Managers</div></div>`);
    win.document.write(`<div class="stat-item"><div class="stat-val">${nbEquipes}</div><div class="stat-label">Équipes</div></div>`);
    win.document.write(`<div class="stat-item"><div class="stat-val">${roots.length}</div><div class="stat-label">Sans manager</div></div>`);
    win.document.write(`</div>`);

    // Tree
    if (roots.length) {
      roots.forEach(r => { win.document.write(renderNode(r, 0)); });
    } else {
      win.document.write(`<p style="color:#6B6B9A;font-style:italic;">Aucun collaborateur.</p>`);
    }

    // Footer
    win.document.write(`<div style="margin-top:40px;font-size:0.75rem;color:#6B6B9A;border-top:1px solid #CFD0E5;padding-top:12px;">Organigramme généré le ${dateStr} à ${timeStr} — Hello Pomelo</div>`);
    win.document.write(`</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div>
      <PageHeader title="Organigramme" subtitle="Hiérarchie de l'équipe" />
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="btn btn-ghost" onClick={exportPDF}>📄 Exporter en PDF</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:20, marginBottom:24 }}>
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
              {filteredCollab.length > 0 && !selCollab && <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--white)',borderRadius:10,boxShadow:'var(--shadow-lg)',zIndex:10,maxHeight:200,overflowY:'auto',marginTop:4}}>
                {filteredCollab.map(c=><div key={c.id} onMouseDown={()=>{setSelCollab(c.id);setSearchCollab(c.prenom+' '+c.nom);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:'0.85rem',transition:'background 0.15s'}} onMouseOver={e=>e.currentTarget.style.background='var(--hover-surface, var(--offwhite))'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>{c.prenom} {c.nom} — {c.poste}</div>)}
              </div>}
            </div>
          </div>
          <div className="form-field" style={{marginBottom:20}}>
            <label>Manager</label>
            <div style={{position:'relative'}}>
              <input value={searchManager} onChange={e=>{setSearchManager(e.target.value);setSelManager('');}} placeholder="Taper 2 lettres (vide = aucun)..." style={{width:'100%',border:'1.5px solid var(--lavender)',borderRadius:10,padding:'10px 14px',fontFamily:'inherit',fontSize:'0.9rem',outline:'none'}} />
              {selManager && <div style={{fontSize:'0.78rem',color:'var(--green)',fontWeight:700,marginTop:4}}>✓ {collabName(selManager)}</div>}
              {filteredManager.length > 0 && !selManager && <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--white)',borderRadius:10,boxShadow:'var(--shadow-lg)',zIndex:10,maxHeight:200,overflowY:'auto',marginTop:4}}>
                {filteredManager.map(c=><div key={c.id} onMouseDown={()=>{setSelManager(c.id);setSearchManager(c.prenom+' '+c.nom);}} style={{padding:'8px 14px',cursor:'pointer',fontSize:'0.85rem',transition:'background 0.15s'}} onMouseOver={e=>e.currentTarget.style.background='var(--hover-surface, var(--offwhite))'} onMouseOut={e=>e.currentTarget.style.background='transparent'}>{c.prenom} {c.nom} — {c.poste}</div>)}
              </div>}
            </div>
          </div>
          <button className="btn btn-primary" onClick={saveRelation} style={{width:'100%'}}>Enregistrer la relation</button>
        </div>
      </div>
    </div>
  );
}
