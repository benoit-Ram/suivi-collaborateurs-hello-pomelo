import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Avatar, Badge, ProgressBar, EmptyState, fmtDate, moisLabel, currentMois, STATUS_LABELS, STATUS_COLORS, ABS_TYPES, ABS_STATUTS } from '../../components/UI';

export default function CollabAccueil() {
  const [collabs, setCollabs] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState('accueil');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCollaborateurs().then(data => { setCollabs(data||[]); setLoading(false); });
  }, []);

  if (loading) return <div style={{textAlign:'center',padding:48,color:'var(--muted)'}}>Chargement...</div>;

  // Account selector
  if (!selectedId) {
    return (
      <div>
        <h2 style={{fontSize:'1.3rem',fontWeight:700,color:'var(--navy)',marginBottom:8}}>Choisir un compte</h2>
        <p style={{color:'var(--muted)',marginBottom:20}}>Sélectionnez un collaborateur.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
          {collabs.map(c => (
            <div key={c.id} className="card" onClick={() => { setSelectedId(c.id); loadAbsences(c.id); }} style={{cursor:'pointer',padding:16,transition:'all 0.15s',border:'2px solid transparent'}}
              onMouseOver={e=>e.currentTarget.style.borderColor='var(--pink)'} onMouseOut={e=>e.currentTarget.style.borderColor='transparent'}>
              <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={36} />
              <div style={{fontWeight:700,fontSize:'0.88rem',color:'var(--navy)',marginTop:8}}>{c.prenom} {c.nom}</div>
              <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>{c.poste}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  async function loadAbsences(cid) {
    const data = await api.getAbsences({ collaborateur_id: cid });
    setAbsences(data || []);
  }

  const c = collabs.find(x => x.id === selectedId);
  if (!c) return null;

  const objs = c.objectifs||[];
  const enCours = objs.filter(o => o.statut==='en-cours');
  const atteints = objs.filter(o => o.statut==='atteint');
  const cm = currentMois();
  const points = (c.points_suivi||[]).filter(p => p.type==='mensuel').sort((a,b)=>(b.mois||'')>(a.mois||'')?1:-1);
  const manager = c.manager_id ? collabs.find(x=>x.id===c.manager_id) : null;
  const managerName = manager ? `${manager.prenom} ${manager.nom}` : '—';
  const myTeam = collabs.filter(m => m.manager_id === c.id);
  const solde = c.solde_conges || 0;

  const tabs = [['accueil','🏠 Accueil'],['objectifs','🎯 Objectifs'],['points','📋 Suivi'],['conges','🏖️ Congés']];
  if (myTeam.length) tabs.splice(3, 0, ['management','👔 Management']);

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={()=>{setSelectedId('');setTab('accueil');}} style={{marginBottom:16}}>← Changer de compte</button>

      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:24,background:'linear-gradient(135deg,#F0F0FF,#FFF0F8)',borderRadius:16,padding:24,border:'1.5px solid #E0D8FF'}}>
        <Avatar prenom={c.prenom} nom={c.nom} photoUrl={c.photo_url} size={64} />
        <div>
          <div style={{fontSize:'1.2rem',fontWeight:700,color:'var(--navy)'}}>{c.prenom} {c.nom}</div>
          <div style={{fontSize:'0.85rem',color:'var(--muted)',marginTop:2}}>{c.poste}{c.equipe ? ` · ${c.equipe}` : ''}</div>
        </div>
      </div>

      <div style={{display:'flex',gap:6,marginBottom:24,background:'var(--offwhite)',padding:6,borderRadius:12,overflowX:'auto'}}>
        {tabs.map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'10px 14px',borderRadius:10,border:'none',fontFamily:'inherit',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',background:tab===k?'white':'transparent',color:tab===k?'var(--navy)':'var(--muted)',boxShadow:tab===k?'0 2px 8px rgba(5,5,109,0.1)':'none'}}>{l}</button>
        ))}
      </div>

      {/* ACCUEIL */}
      {tab==='accueil' && <div>
        <h3 style={{fontSize:'1.1rem',fontWeight:700,color:'var(--navy)',marginBottom:16}}>Bonjour {c.prenom} 👋</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:14,marginBottom:24}}>
          <div className="card" style={{textAlign:'center',padding:18}}><div style={{fontSize:'2rem',fontWeight:700,color:'var(--pink)'}}>{enCours.length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>En cours</div></div>
          <div className="card" style={{textAlign:'center',padding:18}}><div style={{fontSize:'2rem',fontWeight:700,color:'var(--green)'}}>{atteints.length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Atteints</div></div>
          <div className="card" style={{textAlign:'center',padding:18}}><div style={{fontSize:'2rem',fontWeight:700,color:'var(--navy)'}}>{solde}j</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Congés</div></div>
        </div>
        {enCours.length > 0 && <div className="card"><div className="section-title" style={{marginTop:0}}>🎯 Objectifs en cours</div>
          {enCours.slice(0,3).map(o => <div key={o.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--lavender)'}}><div style={{flex:1,fontWeight:600,color:'var(--navy)',fontSize:'0.88rem'}}>{o.titre}</div><span style={{fontWeight:700,fontSize:'0.82rem',color:'var(--pink)'}}>{o.progression||0}%</span></div>)}
        </div>}
      </div>}

      {/* OBJECTIFS */}
      {tab==='objectifs' && <div>
        {enCours.length > 0 && <><div className="section-title">En cours ({enCours.length})</div>{enCours.map((o,i)=><ObjCard key={o.id} o={o} i={i} />)}</>}
        {atteints.length > 0 && <><div className="section-title" style={{marginTop:24}}>✅ Atteints ({atteints.length})</div>{atteints.map((o,i)=><ObjCard key={o.id} o={o} i={i} />)}</>}
        {objs.length===0 && <EmptyState icon="🎯" text="Aucun objectif" />}
      </div>}

      {/* POINTS */}
      {tab==='points' && <div>
        {points.length===0 ? <EmptyState icon="📋" text="Aucun point mensuel" /> : points.map(p => <PointCard key={p.id} p={p} />)}
      </div>}

      {/* CONGÉS */}
      {tab==='conges' && <div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
          <div className="card" style={{textAlign:'center',padding:16}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--green)'}}>{solde}j</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Solde</div></div>
          <div className="card" style={{textAlign:'center',padding:16}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--pink)'}}>{absences.filter(a=>a.statut==='approuve').length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>Approuvés</div></div>
          <div className="card" style={{textAlign:'center',padding:16}}><div style={{fontSize:'1.5rem',fontWeight:700,color:'var(--orange)'}}>{absences.filter(a=>a.statut==='en_attente').length}</div><div style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase',color:'var(--muted)',marginTop:4}}>En attente</div></div>
        </div>
        <div className="section-title">Historique</div>
        {absences.length===0 ? <EmptyState icon="🏖️" text="Aucune demande" /> : absences.map(a => (
          <div key={a.id} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',borderRadius:12,border:'1.5px solid var(--lavender)',marginBottom:8,background:'var(--white)'}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:'0.9rem',color:'var(--navy)'}}>{ABS_TYPES[a.type]||a.type}</div>
              <div style={{fontSize:'0.78rem',color:'var(--muted)',marginTop:2}}>Du {fmtDate(a.date_debut)} au {fmtDate(a.date_fin)}</div>
              {a.motif_refus && <div style={{fontSize:'0.78rem',color:'#881337',marginTop:4,background:'#FFF1F2',padding:'4px 8px',borderRadius:6}}>Motif: {a.motif_refus}</div>}
            </div>
            <Badge type={a.statut==='approuve'?'green':a.statut==='refuse'?'pink':'orange'}>{ABS_STATUTS[a.statut]}</Badge>
          </div>
        ))}
      </div>}

      {/* MANAGEMENT */}
      {tab==='management' && <div>
        <div className="section-title">Mes collaborateurs ({myTeam.length})</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:14}}>
          {myTeam.map(m => (
            <div key={m.id} className="card" style={{padding:16}}>
              <Avatar prenom={m.prenom} nom={m.nom} photoUrl={m.photo_url} size={40} />
              <div style={{fontWeight:700,fontSize:'0.9rem',color:'var(--navy)',marginTop:8}}>{m.prenom} {m.nom}</div>
              <div style={{fontSize:'0.78rem',color:'var(--muted)'}}>{m.poste}</div>
              <div style={{fontSize:'0.72rem',color:'var(--muted)',marginTop:4}}>{(m.objectifs||[]).filter(o=>o.statut==='en-cours').length} objectifs en cours</div>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}

function ObjCard({ o, i }) {
  const pct = o.statut==='atteint'?100:(o.progression||0);
  const colors = { 'en-cours':'linear-gradient(90deg,var(--pink),var(--blue))', 'atteint':'var(--green)', 'non-atteint':'var(--orange)', 'en-attente':'var(--lavender)' };
  return (
    <div className="card" style={{marginBottom:10,padding:16,borderLeft:`4px solid ${o.statut==='atteint'?'var(--green)':'var(--pink)'}`,opacity:o.statut==='atteint'?0.85:1}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <span style={{background:o.statut==='atteint'?'var(--green)':'var(--pink)',color:'white',borderRadius:'50%',width:24,height:24,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'0.75rem',fontWeight:800}}>{o.statut==='atteint'?'✓':i+1}</span>
        <span style={{flex:1,fontWeight:700,color:'var(--navy)'}}>{o.titre}</span>
        <Badge type={STATUS_COLORS[o.statut]}>{STATUS_LABELS[o.statut]}</Badge>
        {o.recurrence && <Badge type="blue">🔄</Badge>}
      </div>
      {o.description && <div style={{fontSize:'0.82rem',color:'var(--muted)',marginBottom:8}}>{o.description}</div>}
      <div style={{marginBottom:6}}><div style={{display:'flex',justifyContent:'space-between',fontSize:'0.7rem',fontWeight:700,color:'var(--muted)',marginBottom:4}}><span>Progression</span><span>{pct}%</span></div><ProgressBar value={pct} color={colors[o.statut]} /></div>
      <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>📅 {fmtDate(o.date_debut)} → {fmtDate(o.date_fin)}</div>
    </div>
  );
}

function PointCard({ p }) {
  const [open, setOpen] = useState(false);
  const md = p.manager_data||{}; const cd = p.collab_data||{};
  const hasM = Object.keys(md).filter(k=>k!=='objectifs').some(k=>md[k]);
  const hasC = Object.keys(cd).filter(k=>k!=='objectifs').some(k=>cd[k]);
  const status = hasM&&hasC?'green':hasM||hasC?'orange':'pink';
  return (
    <div className="card" style={{marginBottom:10,padding:0,overflow:'hidden'}}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',cursor:'pointer'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontWeight:700,color:'var(--navy)'}}>📅 {moisLabel(p.mois)}</span>
          <Badge type={status}>{status==='green'?'✅ Complet':status==='orange'?'🟡 Partiel':'🔴 Vide'}</Badge>
        </div>
        <span style={{color:'var(--muted)'}}>{open?'▲':'▼'}</span>
      </div>
      {open && <div style={{padding:'0 18px 18px',borderTop:'1px solid var(--lavender)'}}>
        <div style={{marginTop:14,fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--skyblue)',marginBottom:8}}>👔 Manager</div>
        {Object.entries(md).filter(([k])=>k!=='objectifs').map(([k,v])=>(<div key={k} style={{marginBottom:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>{k}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:v?'var(--navy)':'var(--muted)',fontStyle:v?'normal':'italic'}}>{v||'Non renseigné'}</div></div>))}
        {Object.keys(cd).filter(k=>k!=='objectifs').length>0 && <><div style={{marginTop:14,fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',color:'var(--pink)',marginBottom:8}}>👤 Collaborateur</div>
          {Object.entries(cd).filter(([k])=>k!=='objectifs').map(([k,v])=>(<div key={k} style={{marginBottom:8}}><div style={{fontSize:'0.72rem',fontWeight:700,color:'var(--muted)',marginBottom:2}}>{k}</div><div style={{background:'var(--offwhite)',borderRadius:8,padding:'8px 12px',fontSize:'0.85rem',color:v?'var(--navy)':'var(--muted)',fontStyle:v?'normal':'italic'}}>{v||'Non renseigné'}</div></div>))}
        </>}
      </div>}
    </div>
  );
}
