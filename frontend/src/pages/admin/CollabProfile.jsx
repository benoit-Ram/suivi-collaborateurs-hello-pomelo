import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../../services/DataContext';
import { Avatar, Badge, ProgressBar, EmptyState, fmtDate, moisLabel, STATUS_LABELS, STATUS_COLORS } from '../../components/UI';

export default function CollabProfile() {
  const { id } = useParams();
  const { collabs, getManagerName } = useData();
  const [tab, setTab] = useState('objectifs');
  const navigate = useNavigate();
  const c = collabs.find(x => x.id === id);
  if (!c) return <EmptyState icon="👤" text="Collaborateur non trouvé" />;

  const objs = c.objectifs || [];
  const objsEnCours = objs.filter(o => o.statut !== 'atteint');
  const objsAtteints = objs.filter(o => o.statut === 'atteint');
  const points = (c.points_suivi || []).filter(p => p.type === 'mensuel').sort((a,b) => (b.mois||'') > (a.mois||'') ? 1 : -1);
  const manager = c.manager_id ? getManagerName(c.manager_id) : null;

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/collaborateurs')} style={{ marginBottom: 16 }}>← Retour</button>
      <div className="card" style={{ display:'flex', alignItems:'flex-start', gap:20, marginBottom:24 }}>
        <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={72} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'1.3rem', fontWeight:700, color:'var(--navy)' }}>{c.prenom} {c.nom}</div>
          <div style={{ fontSize:'0.88rem', color:'var(--muted)', marginTop:2 }}>{c.poste}</div>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginTop:10, fontSize:'0.78rem', color:'var(--muted)', fontWeight:600 }}>
            {c.email && <span>✉️ {c.email}</span>}
            {c.date_entree && <span>📅 {fmtDate(c.date_entree)}</span>}
            {c.bureau && <span>🏢 {c.bureau}</span>}
            {c.equipe && <span>👥 {c.equipe}</span>}
            {c.contrat && <span>📄 {c.contrat}</span>}
            {manager && <span>👔 {manager}</span>}
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:24, background:'var(--offwhite)', padding:6, borderRadius:12 }}>
        {[['objectifs','🎯 Objectifs'],['points','📋 Points mensuels']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex:1, padding:'10px 16px', borderRadius:10, border:'none', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:700, cursor:'pointer', transition:'all 0.15s', background: tab===k?'white':'transparent', color: tab===k?'var(--navy)':'var(--muted)', boxShadow: tab===k?'0 2px 8px rgba(5,5,109,0.1)':'none' }}>{l}</button>
        ))}
      </div>

      {tab === 'objectifs' && <div>
        {objsEnCours.length > 0 && <>
          <div className="section-title">En cours ({objsEnCours.length})</div>
          {objsEnCours.map((o,i) => <ObjCard key={o.id} o={o} i={i} />)}
        </>}
        {objsAtteints.length > 0 && <>
          <div className="section-title" style={{marginTop:24}}>✅ Atteints ({objsAtteints.length})</div>
          {objsAtteints.map((o,i) => <ObjCard key={o.id} o={o} i={i} />)}
        </>}
        {objs.length === 0 && <EmptyState icon="🎯" text="Aucun objectif" />}
      </div>}

      {tab === 'points' && <div>
        {points.length === 0 ? <EmptyState icon="📋" text="Aucun point mensuel" /> : points.map(p => <PointCard key={p.id} p={p} />)}
      </div>}
    </div>
  );
}

function ObjCard({ o, i }) {
  const pct = o.statut === 'atteint' ? 100 : (o.progression || 0);
  const colors = { 'en-cours': 'linear-gradient(90deg,var(--pink),var(--blue))', 'atteint': 'var(--green)', 'non-atteint': 'var(--orange)', 'en-attente': 'var(--lavender)' };
  return (
    <div className="card" style={{ marginBottom:10, padding:16, borderLeft:`4px solid ${o.statut==='atteint'?'var(--green)':'var(--pink)'}`, opacity: o.statut==='atteint'?0.85:1 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <span style={{ background: o.statut==='atteint'?'var(--green)':'var(--pink)', color:'white', borderRadius:'50%', width:24, height:24, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:800 }}>{o.statut==='atteint'?'✓':i+1}</span>
        <span style={{ flex:1, fontWeight:700, color:'var(--navy)' }}>{o.titre}</span>
        <Badge type={STATUS_COLORS[o.statut]}>{STATUS_LABELS[o.statut]}</Badge>
        {o.recurrence && <Badge type="blue">🔄 {o.recurrence==='hebdo'?'Hebdo':'Mensuel'}</Badge>}
      </div>
      {o.description && <div style={{ fontSize:'0.82rem', color:'var(--muted)', marginBottom:8 }}>{o.description}</div>}
      <div style={{ marginBottom:6 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.7rem', fontWeight:700, color:'var(--muted)', marginBottom:4 }}><span>Progression</span><span>{pct}%</span></div>
        <ProgressBar value={pct} color={colors[o.statut]} />
      </div>
      <div style={{ fontSize:'0.72rem', color:'var(--muted)' }}>📅 Du {fmtDate(o.date_debut)} au {fmtDate(o.date_fin)}</div>
    </div>
  );
}

function PointCard({ p }) {
  const [open, setOpen] = useState(false);
  const md = p.manager_data || {};
  const cd = p.collab_data || {};
  const hasManager = Object.keys(md).some(k => k !== 'objectifs' && md[k]);
  const hasCollab = Object.keys(cd).some(k => k !== 'objectifs' && cd[k]);
  const status = hasManager && hasCollab ? 'green' : hasManager || hasCollab ? 'orange' : 'pink';

  return (
    <div className="card" style={{ marginBottom:10, padding:0, overflow:'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', cursor:'pointer' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontWeight:700, color:'var(--navy)' }}>📅 {moisLabel(p.mois)}</span>
          <Badge type={status}>{status==='green'?'✅ Complet':status==='orange'?'🟡 Partiel':'🔴 Vide'}</Badge>
        </div>
        <span style={{ color:'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ padding:'0 18px 18px', borderTop:'1px solid var(--lavender)' }}>
        <div style={{ marginTop:14, fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', color:'var(--skyblue)', marginBottom:8 }}>👔 Manager</div>
        {Object.entries(md).filter(([k])=>k!=='objectifs').map(([k,v]) => (
          <div key={k} style={{ marginBottom:8 }}>
            <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--muted)', marginBottom:2 }}>{k}</div>
            <div style={{ background:'var(--offwhite)', borderRadius:8, padding:'8px 12px', fontSize:'0.85rem', color: v?'var(--navy)':'var(--muted)', fontStyle: v?'normal':'italic' }}>{v||'Non renseigné'}</div>
          </div>
        ))}
        {Object.keys(cd).filter(k=>k!=='objectifs').length > 0 && <>
          <div style={{ marginTop:14, fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', color:'var(--pink)', marginBottom:8 }}>👤 Collaborateur</div>
          {Object.entries(cd).filter(([k])=>k!=='objectifs').map(([k,v]) => (
            <div key={k} style={{ marginBottom:8 }}>
              <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--muted)', marginBottom:2 }}>{k}</div>
              <div style={{ background:'var(--offwhite)', borderRadius:8, padding:'8px 12px', fontSize:'0.85rem', color: v?'var(--navy)':'var(--muted)', fontStyle: v?'normal':'italic' }}>{v||'Non renseigné'}</div>
            </div>
          ))}
        </>}
      </div>}
    </div>
  );
}
