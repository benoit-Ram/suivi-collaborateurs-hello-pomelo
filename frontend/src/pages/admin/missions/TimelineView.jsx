import React, { useState } from 'react';
import { Avatar } from '../../../components/UI';

/** Vue timeline Gantt — configurable par groupBy, displayMode, viewUnit.
 * Accepte des missions filtrées par l'appelant ; allMissions est l'ensemble pour le calcul global par collab. */
export default function TimelineView({ missions, collabs, staffingMap, allMissions, clients, groupBy, displayMode, onUpdateAssignment }) {
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState(new Set());
  const [expandedSub, setExpandedSub] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [viewUnit, setViewUnit] = useState('week');
  const toggleSub = (id) => setExpandedSub(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const DAYS = 10; const WEEKS = 16; const MONTHS_COUNT = 6;
  const now = new Date(); const todayStr = now.toISOString().split('T')[0];
  const toggleRow = (id) => setExpanded(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

  const getWeekKey = (d) => { const wn = Math.ceil(((d - new Date(d.getFullYear(),0,1))/86400000+1)/7); return `${d.getFullYear()}-W${String(wn).padStart(2,'0')}`; };
  const getMonthKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

  const getAssignmentTaux = (a, col) => {
    const overrides = a.staffing_overrides || {};
    const colDate = new Date(col.start);
    const wk = getWeekKey(colDate);
    const mk = getMonthKey(colDate);
    if (overrides[wk] !== undefined) return overrides[wk];
    if (viewUnit === 'month' && overrides[mk] !== undefined) return overrides[mk];
    if (viewUnit === 'day') { if (overrides[wk] !== undefined) return overrides[wk]; }
    return a.taux_staffing || 0;
  };

  const columns = viewUnit === 'day'
    ? Array.from({length:DAYS},(_,i) => {
        const d = new Date(now); d.setDate(now.getDate() - ((now.getDay()+6)%7) + offset*7 + Math.floor(i/5)*7 + (i%5));
        d.setHours(0,0,0,0);
        const ds = d.toISOString().split('T')[0];
        return { label:d.toLocaleDateString('fr-FR',{weekday:'short'})+' '+d.getDate(), start:ds, end:ds, isCurrent:ds===todayStr, month:d.toLocaleDateString('fr-FR',{month:'short'}), year:d.getFullYear(), periodKey:getWeekKey(d) };
      })
    : viewUnit === 'week'
    ? Array.from({length:WEEKS},(_,i) => {
        const sm = new Date(now); sm.setDate(now.getDate()-((now.getDay()+6)%7)+offset*WEEKS+i*7); sm.setHours(0,0,0,0);
        const wn = Math.ceil(((sm - new Date(sm.getFullYear(),0,1))/86400000+1)/7);
        const end = new Date(sm.getTime()+4*86400000);
        return { label:`S${wn}`, start:sm.toISOString().split('T')[0], end:end.toISOString().split('T')[0], month:sm.toLocaleDateString('fr-FR',{month:'short'}), year:sm.getFullYear(), isCurrent:todayStr>=sm.toISOString().split('T')[0]&&todayStr<=end.toISOString().split('T')[0], periodKey:`${sm.getFullYear()}-W${String(wn).padStart(2,'0')}` };
      })
    : Array.from({length:MONTHS_COUNT},(_,i) => {
        const d = new Date(now.getFullYear(),now.getMonth()+offset*MONTHS_COUNT+i,1);
        const endD = new Date(d.getFullYear(),d.getMonth()+1,0);
        return { label:d.toLocaleDateString('fr-FR',{month:'short',year:'numeric'}), start:d.toISOString().split('T')[0], end:endD.toISOString().split('T')[0], isCurrent:d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(), periodKey:getMonthKey(d) };
      });

  const monthHeaders = [];
  if (viewUnit === 'week' || viewUnit === 'day') {
    let lastKey = '';
    columns.forEach((col,i) => {
      const key = (col.month||'') + ' ' + (col.year||'');
      if (key !== lastKey) { monthHeaders.push({label:key,start:i,span:1}); lastKey = key; }
      else monthHeaders[monthHeaders.length-1].span++;
    });
  }

  const navLabels = { day:'1 sem.', week:`${WEEKS} sem.`, month:`${MONTHS_COUNT} mois` };
  const minW = viewUnit==='day'?55:viewUnit==='week'?45:80;

  const getCollabTaux = (collabId, col) => {
    return (allMissions||missions).reduce((total, m) => {
      if (!m.date_debut || !m.date_fin || m.date_debut > col.end || m.date_fin < col.start) return total;
      const a = (m.assignments||[]).find(x => x.collaborateur_id === collabId && x.statut === 'actif');
      return total + (a ? getAssignmentTaux(a, col) : 0);
    }, 0);
  };

  const daysPerPeriod = viewUnit === 'day' ? 1 : viewUnit === 'month' ? 21.67 : 5;
  const tauxToJours = (taux) => Math.round(taux / 100 * daysPerPeriod * 10) / 10;
  const joursToTaux = (jours) => Math.round(jours / daysPerPeriod * 100);
  const fmtCell = (taux) => {
    if (taux === 0) return null;
    if (displayMode === 'jours') return `${(taux/100*daysPerPeriod).toFixed(1)}j`;
    if (displayMode === 'dispo') return `${((100-taux)/100*daysPerPeriod).toFixed(1)}j`;
    return `${taux}%`;
  };
  const cellColor = (taux) => taux > 100 ? 'var(--red)' : taux >= 80 ? 'var(--blue)' : taux > 0 ? 'var(--green)' : 'transparent';
  const cellBg = (taux) => taux > 100 ? 'rgba(255,50,50,0.15)' : taux >= 80 ? 'rgba(59,130,246,0.12)' : taux > 0 ? 'rgba(16,185,129,0.1)' : 'transparent';

  const getCollabAssignments = (cid) => (allMissions||missions).flatMap(m => (m.assignments||[]).filter(a => a.collaborateur_id === cid && a.statut === 'actif').map(a => ({...a, mission: m})));

  const rows = (() => {
    switch (groupBy) {
      case 'client': return (clients||[]).filter(c => missions.some(m => m.client_id === c.id)).map(c => ({
        id:c.id, label:c.nom, sub:c.secteur||'', subRows: missions.filter(m => m.client_id === c.id).map(m => ({
          id:m.id, label:m.nom, sub:m.categorie||'', missionRef:m,
          assignmentRows: (m.assignments||[]).filter(a=>a.statut==='actif').map(a => { const collab=collabs.find(x=>x.id===a.collaborateur_id); return {
            id:a.id, assignmentId:a.id, label:collab?collab.prenom+' '+collab.nom:'—', sub:a.role||'', avatar:collab, taux:a.taux_staffing||0, assignment:a,
            getCellTaux:(col)=>(!m.date_debut||!m.date_fin||m.date_debut>col.end||m.date_fin<col.start)?0:getAssignmentTaux(a,col)
          };}),
          getCellTaux:(col) => (m.assignments||[]).filter(a=>a.statut==='actif').reduce((s,a)=>s+((!m.date_debut||!m.date_fin||m.date_debut>col.end||m.date_fin<col.start)?0:getAssignmentTaux(a,col)),0)
        })),
        getCellTaux:(col) => missions.filter(m=>m.client_id===c.id).reduce((s,m)=>{if(!m.date_debut||!m.date_fin||m.date_debut>col.end||m.date_fin<col.start)return s;return s+(m.assignments||[]).filter(a=>a.statut==='actif').reduce((s2,a)=>s2+getAssignmentTaux(a,col),0);},0)
      }));
      case 'mission': return missions.map(m => ({
        id:m.id, label:m.nom, sub:(m.clients?.nom||m.client||'')+(m.categorie?' · '+m.categorie:''),
        subRows: (m.assignments||[]).filter(a=>a.statut==='actif').map(a => { const c=collabs.find(x=>x.id===a.collaborateur_id); return {
          id:a.id, assignmentId:a.id, label:c?c.prenom+' '+c.nom:'—', sub:a.role||'', avatar:c, taux:a.taux_staffing||0, assignment:a,
          getCellTaux:(col)=>(!m.date_debut||!m.date_fin||m.date_debut>col.end||m.date_fin<col.start)?0:getAssignmentTaux(a,col)
        };}),
        getCellTaux:(col)=>(!m.date_debut||!m.date_fin||m.date_debut>col.end||m.date_fin<col.start)?0:(m.assignments||[]).filter(a=>a.statut==='actif').reduce((s,a)=>s+getAssignmentTaux(a,col),0)
      }));
      case 'bureau': return [...new Set(collabs.map(c=>c.bureau).filter(Boolean))].sort().map(b => {
        const bCollabs = collabs.filter(c=>c.bureau===b);
        return { id:b, label:b, sub:`${bCollabs.length} collabs`,
          subRows: bCollabs.filter(c=>staffingMap[c.id]?.missions?.length>0).map(c=>({
            id:c.id, label:c.prenom+' '+c.nom[0]+'.', sub:c.poste||'', avatar:c,
            getCellTaux:(col)=>getCollabTaux(c.id,col)
          })),
          getCellTaux:(col)=>bCollabs.reduce((s,c)=>s+getCollabTaux(c.id,col),0)/Math.max(bCollabs.length,1)
        };
      });
      case 'equipe': return [...new Set(collabs.flatMap(c=>(c.equipe||'').split(',').map(s=>s.trim())).filter(Boolean))].sort().map(eq => {
        const eqCollabs = collabs.filter(c=>(c.equipe||'').includes(eq));
        return { id:eq, label:eq, sub:`${eqCollabs.length} collabs`,
          subRows: eqCollabs.filter(c=>staffingMap[c.id]?.missions?.length>0).map(c=>({
            id:c.id, label:c.prenom+' '+c.nom[0]+'.', sub:c.poste||'', avatar:c,
            getCellTaux:(col)=>getCollabTaux(c.id,col)
          })),
          getCellTaux:(col)=>eqCollabs.reduce((s,c)=>s+getCollabTaux(c.id,col),0)/Math.max(eqCollabs.length,1)
        };
      });
      default:
        return collabs.filter(c=>staffingMap[c.id]?.missions?.length>0).sort((a,b)=>(staffingMap[b.id]?.taux||0)-(staffingMap[a.id]?.taux||0)).map(c => ({
          id:c.id, label:c.prenom+' '+c.nom[0]+'.', sub:c.poste||'', avatar:c,
          subRows: getCollabAssignments(c.id).map(a=>({
            id:a.id, assignmentId:a.id, label:a.mission.nom, sub:(a.mission.clients?.nom||'—')+' · '+(a.role||'—'), taux:a.taux_staffing||0, assignment:a,
            getCellTaux:(col)=>(a.mission.date_debut&&a.mission.date_fin&&a.mission.date_debut<=col.end&&a.mission.date_fin>=col.start)?getAssignmentTaux(a,col):0
          })),
          getCellTaux:(col)=>getCollabTaux(c.id,col)
        }));
    }
  })();

  const stickyStyle = {position:'sticky',left:0,background:'var(--white)',zIndex:1};

  if (rows.length === 0) return <div style={{padding:32,textAlign:'center',color:'var(--muted)',fontSize:'0.85rem'}}>Aucune donnée à afficher pour cette période</div>;

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 18px',borderBottom:'1px solid var(--lavender)'}}>
        <button className="btn btn-ghost btn-sm" onClick={()=>setOffset(offset-1)}>← {navLabels[viewUnit]}</button>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontWeight:700,color:'var(--navy)'}}>📅 Calendrier</span>
          <div style={{display:'flex',gap:2,background:'var(--offwhite)',borderRadius:8,padding:2}}>
            {[['day','Jour'],['week','Semaine'],['month','Mois']].map(([k,l])=>(
              <button key={k} onClick={()=>{setViewUnit(k);setOffset(0);}} className="btn btn-sm" style={{padding:'3px 10px',fontSize:'0.68rem',fontWeight:700,background:viewUnit===k?'var(--pink)':'transparent',color:viewUnit===k?'var(--white)':'var(--muted)',border:'none',borderRadius:6}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          {offset!==0 && <button className="btn btn-ghost btn-sm" onClick={()=>setOffset(0)}>Aujourd'hui</button>}
          <button className="btn btn-ghost btn-sm" onClick={()=>setOffset(offset+1)}>{navLabels[viewUnit]} →</button>
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{fontSize:'0.7rem',width:'100%',borderCollapse:'collapse'}}>
          <thead>
            {(viewUnit==='week'||viewUnit==='day') && <tr>
              <th style={{minWidth:180,...stickyStyle,zIndex:2}} />
              {monthHeaders.map((m,i)=><th key={i} colSpan={m.span} style={{textAlign:'center',padding:'6px 2px',fontWeight:700,color:'var(--navy)',textTransform:'capitalize',borderBottom:'1px solid var(--lavender)'}}>{m.label}</th>)}
            </tr>}
            <tr>
              <th style={{textAlign:'left',padding:'6px 14px',fontWeight:700,color:'var(--navy)',minWidth:180,...stickyStyle,zIndex:2}}>
                {{collab:'Collaborateur',client:'Client',mission:'Mission',bureau:'Bureau',equipe:'Équipe'}[groupBy]}
              </th>
              {columns.map((col,i)=>(
                <th key={i} style={{textAlign:'center',padding:'4px 2px',minWidth:minW,fontWeight:col.isCurrent?800:600,color:col.isCurrent?'var(--pink)':'var(--muted)',background:col.isCurrent?'rgba(255,50,133,0.05)':'transparent',textTransform:'capitalize'}}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isExp = expanded.has(row.id);
              const currentCol = columns.find(c => c.isCurrent) || columns[0];
              const chargeTaux = currentCol ? Math.round(row.getCellTaux(currentCol)) : 0;
              const chargeColor = chargeTaux > 100 ? 'var(--red)' : chargeTaux >= 80 ? 'var(--orange)' : chargeTaux > 0 ? 'var(--green)' : 'var(--lavender)';
              return <React.Fragment key={row.id}>
                <tr style={{borderBottom:isExp?'none':'1px solid var(--lavender)',background:isExp?'rgba(255,50,133,0.04)':'transparent',cursor:'pointer'}} onClick={()=>toggleRow(row.id)}>
                  <td style={{padding:'8px 14px',...stickyStyle,background:isExp?'rgba(255,50,133,0.06)':'var(--white)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:3,height:28,borderRadius:2,background:chargeColor,flexShrink:0}} />
                      {row.avatar && <Avatar prenom={row.avatar.prenom} nom={row.avatar.nom} photoUrl={row.avatar.photo_url} size={24} />}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,color:isExp?'var(--pink)':'var(--navy)',fontSize:'0.75rem'}}>
                          <span style={{fontSize:'0.6rem',color:'var(--muted)',marginRight:4}}>{isExp?'▼':'▶'}</span>
                          {row.label}
                        </div>
                        {row.sub && <div style={{fontSize:'0.6rem',color:'var(--muted)'}}>{row.sub}</div>}
                      </div>
                    </div>
                  </td>
                  {columns.map((col,ci) => {
                    const taux = Math.round(row.getCellTaux(col));
                    const val = fmtCell(taux);
                    return <td key={ci} style={{padding:1,background:col.isCurrent?'rgba(255,50,133,0.03)':'transparent',textAlign:'center'}}>
                      {val ? <div style={{position:'relative',height:18,borderRadius:3,overflow:'hidden',background:'var(--offwhite)'}}><div style={{position:'absolute',top:0,left:0,bottom:0,width:`${Math.min(taux/100*100,100)}%`,background:cellColor(taux),opacity:0.25,borderRadius:3}} /><div style={{position:'relative',zIndex:1,fontSize:'0.55rem',fontWeight:700,color:cellColor(taux),lineHeight:'18px',paddingLeft:3}}>{val}</div></div> : <div style={{height:18}} />}
                    </td>;
                  })}
                </tr>
                {isExp && (row.subRows||[]).map(sr => {
                  const isSubExp = expandedSub.has(sr.id);
                  const hasDetails = sr.assignmentRows && sr.assignmentRows.length > 0;
                  return <React.Fragment key={sr.id}>
                  <tr style={{background:'rgba(255,50,133,0.02)',borderBottom:(isSubExp&&hasDetails)?'none':'1px solid var(--lavender)',cursor:hasDetails?'pointer':'default'}} onClick={()=>hasDetails&&toggleSub(sr.id)}>
                    <td style={{padding:'4px 14px 4px 40px',...stickyStyle,background:'rgba(255,50,133,0.03)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        {hasDetails && <span style={{fontSize:'0.55rem',color:'var(--muted)'}}>{isSubExp?'▼':'▶'}</span>}
                        {sr.avatar && <Avatar prenom={sr.avatar.prenom} nom={sr.avatar.nom} photoUrl={sr.avatar.photo_url} size={20} />}
                        <div style={{fontSize:'0.68rem'}}>
                          <span style={{fontWeight:700,color:'var(--navy)'}}>{sr.label}</span>
                          {sr.sub && <span style={{color:'var(--muted)'}}> · {sr.sub}</span>}
                        </div>
                      </div>
                    </td>
                    {columns.map((col,ci) => {
                      const taux = Math.round(sr.getCellTaux(col));
                      const val = fmtCell(taux);
                      const canEdit = sr.assignmentId && onUpdateAssignment;
                      const isEditing2 = editingCell && editingCell.assignmentId === sr.assignmentId && editingCell.colIdx === ci;
                      return <td key={ci} style={{padding:1,background:col.isCurrent?'rgba(255,50,133,0.03)':'transparent',textAlign:'center',cursor:canEdit?'pointer':'default'}}
                        onClick={canEdit?(e)=>{e.stopPropagation();setEditingCell({assignmentId:sr.assignmentId,colIdx:ci,periodKey:col.periodKey,assignment:sr.assignment});setEditValue(String(tauxToJours(taux)));}:undefined}>
                        {isEditing2 ? (
                          <input type="number" min="0" max={daysPerPeriod} step="0.5" value={editValue} autoFocus
                            style={{width:40,padding:'1px 2px',fontSize:'0.5rem',fontWeight:700,textAlign:'center',border:'1.5px solid var(--pink)',borderRadius:3,outline:'none',background:'var(--white)',color:'var(--navy)'}}
                            onChange={e=>setEditValue(e.target.value)}
                            onBlur={()=>{const j=parseFloat(editValue);if(!isNaN(j)&&j>=0&&j<=daysPerPeriod){const v=joursToTaux(j);const a=editingCell.assignment;const key=editingCell.periodKey;const overrides={...(a.staffing_overrides||{})};if(v===(a.taux_staffing||0)){delete overrides[key];}else{overrides[key]=v;}onUpdateAssignment(sr.assignmentId,{staffing_overrides:overrides});}setEditingCell(null);}}
                            onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditingCell(null);}}
                            onClick={e=>e.stopPropagation()}
                          />
                        ) : val ? <div style={{background:cellBg(taux),color:cellColor(taux),borderRadius:3,padding:'2px 2px',fontSize:'0.5rem',fontWeight:700,opacity:canEdit&&taux!==(sr.taux||0)?1:0.8,border:canEdit&&taux!==(sr.taux||0)?'1px dashed var(--pink)':'none'}}>{val}</div> : <div style={{height:14}} />}
                      </td>;
                    })}
                  </tr>
                  {isSubExp && hasDetails && sr.assignmentRows.map(ar => (
                    <tr key={ar.id} style={{background:'rgba(59,130,246,0.03)',borderBottom:'1px solid var(--lavender)'}}>
                      <td style={{padding:'3px 14px 3px 60px',...stickyStyle,background:'rgba(59,130,246,0.04)'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          {ar.avatar && <Avatar prenom={ar.avatar.prenom} nom={ar.avatar.nom} photoUrl={ar.avatar.photo_url} size={18} />}
                          <div style={{fontSize:'0.62rem'}}>
                            <span style={{fontWeight:600,color:'var(--navy)'}}>{ar.label}</span>
                            <span style={{color:'var(--muted)'}}> · {ar.sub} · {ar.taux}%</span>
                          </div>
                        </div>
                      </td>
                      {columns.map((col,ci) => {
                        const taux = Math.round(ar.getCellTaux(col));
                        const val = fmtCell(taux);
                        const isEditing = editingCell && editingCell.assignmentId === ar.assignmentId && editingCell.colIdx === ci;
                        return <td key={ci} style={{padding:1,background:col.isCurrent?'rgba(255,50,133,0.03)':'transparent',textAlign:'center',cursor:onUpdateAssignment?'pointer':'default'}}
                          onClick={onUpdateAssignment?(e)=>{e.stopPropagation();setEditingCell({assignmentId:ar.assignmentId,colIdx:ci,periodKey:col.periodKey,assignment:ar.assignment});setEditValue(String(tauxToJours(taux)));}:undefined}>
                          {isEditing ? (
                            <input type="number" min="0" max={daysPerPeriod} step="0.5" value={editValue} autoFocus
                              style={{width:40,padding:'1px 2px',fontSize:'0.55rem',fontWeight:700,textAlign:'center',border:'1.5px solid var(--pink)',borderRadius:3,outline:'none',background:'var(--white)',color:'var(--navy)'}}
                              onChange={e=>setEditValue(e.target.value)}
                              onBlur={()=>{
                                const j=parseFloat(editValue);
                                if(!isNaN(j)&&j>=0&&j<=daysPerPeriod) {
                                  const v = joursToTaux(j);
                                  const a = editingCell.assignment;
                                  const key = editingCell.periodKey;
                                  const overrides = {...(a.staffing_overrides||{})};
                                  if (v === (a.taux_staffing||0)) { delete overrides[key]; } else { overrides[key] = v; }
                                  onUpdateAssignment(ar.assignmentId, { staffing_overrides: overrides });
                                }
                                setEditingCell(null);
                              }}
                              onKeyDown={e=>{if(e.key==='Enter')e.target.blur();if(e.key==='Escape')setEditingCell(null);}}
                              onClick={e=>e.stopPropagation()}
                            />
                          ) : val ? <div style={{background:cellBg(taux),color:cellColor(taux),borderRadius:3,padding:'1px 2px',fontSize:'0.48rem',fontWeight:700,opacity:taux!==(ar.taux||0)?1:0.7,border:taux!==(ar.taux||0)?'1px dashed var(--pink)':'none'}}>{val}</div> : <div style={{height:12}} />}
                        </td>;
                      })}
                    </tr>
                  ))}
                  </React.Fragment>;
                })}
              </React.Fragment>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
