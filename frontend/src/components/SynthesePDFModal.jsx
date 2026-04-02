import React, { useState } from 'react';
import { Modal, fmtDate, moisLabel, countWorkDays, STATUS_LABELS, ABS_TYPES, ABS_STATUTS } from './UI';

export default function SynthesePDFModal({ open, onClose, collab, absences, getManagerName }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [inclObjectifs, setInclObjectifs] = useState(true);
  const [inclObjHist, setInclObjHist] = useState(false);
  const [inclEntretiens, setInclEntretiens] = useState(true);
  const [inclEntHist, setInclEntHist] = useState(false);
  const [inclConges, setInclConges] = useState(true);
  const [inclCongesHist, setInclCongesHist] = useState(false);

  if (!open || !collab) return null;

  const c = collab;
  const manager = c.manager_id ? getManagerName(c.manager_id) : '—';

  const generate = () => {
    const win = window.open('','_blank');
    win.document.write(`<html><head><title>Synthèse — ${c.prenom} ${c.nom}</title>
    <style>
      body{font-family:Quicksand,Arial,sans-serif;padding:32px;max-width:850px;margin:0 auto;color:#05056D;font-size:14px;line-height:1.6}
      h1{font-size:1.4rem;margin-bottom:4px}
      h2{font-size:1.1rem;color:#FF3285;margin:24px 0 10px;border-bottom:2px solid #CFD0E5;padding-bottom:6px}
      h3{font-size:0.9rem;color:#05056D;margin:14px 0 6px}
      .meta{font-size:0.85rem;color:#6B6B9A;margin-bottom:20px}
      .field{margin-bottom:10px}.field-label{font-size:0.72rem;font-weight:700;text-transform:uppercase;color:#6B6B9A;margin-bottom:2px}
      .field-value{padding:6px 0;border-bottom:1px solid #CFD0E5}
      .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:700}
      .badge-green{background:#DCFCE7;color:#166534}.badge-orange{background:#FFF7ED;color:#9A3412}.badge-pink{background:#FFF0F6;color:#FF3285}
      .progress{height:8px;background:#CFD0E5;border-radius:99px;margin:4px 0 8px}.progress-fill{height:100%;border-radius:99px}
      .hist{background:#F8F7FC;padding:8px 12px;border-radius:6px;margin:4px 0;font-size:0.82rem}
      table{width:100%;border-collapse:collapse;font-size:0.85rem;margin:8px 0}th,td{padding:6px 10px;border-bottom:1px solid #CFD0E5;text-align:left}th{font-size:0.72rem;text-transform:uppercase;color:#6B6B9A}
      @media print{body{padding:16px}}
    </style></head><body>`);

    // Header
    win.document.write(`<h1>${c.prenom} ${c.nom}</h1>`);
    win.document.write(`<div class="meta">${c.poste} · Manager : ${manager} · ${c.equipe||''} · ${c.bureau||''}</div>`);
    if (dateFrom || dateTo) win.document.write(`<div class="meta">Période : ${dateFrom?fmtDate(dateFrom):'début'} → ${dateTo?fmtDate(dateTo):'aujourd\'hui'}</div>`);

    // Objectifs
    if (inclObjectifs) {
      const objs = (c.objectifs||[]).filter(o => {
        if (!dateFrom && !dateTo) return true;
        if (dateFrom && o.date_fin && o.date_fin < dateFrom) return false;
        if (dateTo && o.date_debut && o.date_debut > dateTo) return false;
        return true;
      });
      win.document.write(`<h2>🎯 Objectifs (${objs.length})</h2>`);
      objs.forEach(o => {
        const pct = o.statut==='atteint'?100:(o.progression||0);
        win.document.write(`<h3>${o.titre} — <span class="badge badge-${o.statut==='atteint'?'green':o.statut==='en-cours'?'orange':'pink'}">${STATUS_LABELS[o.statut]||o.statut}</span></h3>`);
        if (o.description) win.document.write(`<div style="color:#6B6B9A;margin-bottom:6px">${o.description}</div>`);
        win.document.write(`<div class="progress"><div class="progress-fill" style="width:${pct}%;background:${o.statut==='atteint'?'#22C55E':'linear-gradient(90deg,#FF3285,#0000EA)'}"></div></div>`);
        win.document.write(`<div style="font-size:0.82rem;color:#6B6B9A">Progression : ${pct}% · Du ${fmtDate(o.date_debut)} au ${fmtDate(o.date_fin)}</div>`);
        if (inclObjHist && o.historique?.length) {
          win.document.write(`<div style="margin-top:6px;font-size:0.78rem;font-weight:700;color:#6B6B9A">Historique :</div>`);
          o.historique.forEach(h => {
            win.document.write(`<div class="hist"><strong>${fmtDate(h.date)} — ${h.auteur}</strong>`);
            (h.changes||[]).forEach(ch => win.document.write(`<br>${ch.champ} : <s>${ch.avant}</s> → <strong>${ch.apres}</strong>`));
            win.document.write(`</div>`);
          });
        }
      });
    }

    // Entretiens
    if (inclEntretiens) {
      const points = (c.points_suivi||[]).filter(p => p.type==='mensuel').filter(p => {
        if (!dateFrom && !dateTo) return true;
        if (dateFrom && p.mois && p.mois+'-31' < dateFrom) return false;
        if (dateTo && p.mois && p.mois+'-01' > dateTo) return false;
        return true;
      }).sort((a,b)=>(a.mois||'')>(b.mois||'')?1:-1);

      win.document.write(`<h2>📋 Entretiens RH (${points.length})</h2>`);
      points.forEach(p => {
        const md = p.manager_data||{};
        const cd = p.collab_data||{};
        win.document.write(`<h3>📅 ${moisLabel(p.mois)}</h3>`);
        win.document.write(`<div style="font-size:0.78rem;font-weight:700;color:#5BB6F4;margin:8px 0 4px">Manager</div>`);
        Object.entries(md).filter(([k])=>k!=='objectifs').forEach(([k,v]) => {
          win.document.write(`<div class="field"><div class="field-label">${k}</div><div class="field-value">${v||'—'}</div></div>`);
        });
        win.document.write(`<div style="font-size:0.78rem;font-weight:700;color:#FF3285;margin:8px 0 4px">Collaborateur</div>`);
        Object.entries(cd).filter(([k])=>k!=='objectifs'&&k !== '_commentaire').forEach(([k,v]) => {
          win.document.write(`<div class="field"><div class="field-label">${k}</div><div class="field-value">${v||'—'}</div></div>`);
        });
        if (cd._commentaire) win.document.write(`<div class="field"><div class="field-label">Commentaire libre</div><div class="field-value">${cd._commentaire}</div></div>`);
      });
    }

    // Congés
    if (inclConges) {
      const abs = (absences||[]).filter(a => a.collaborateur_id===c.id).filter(a => {
        if (!dateFrom && !dateTo) return true;
        if (dateFrom && a.date_fin < dateFrom) return false;
        if (dateTo && a.date_debut > dateTo) return false;
        return true;
      });
      win.document.write(`<h2>🏖️ Congés (${abs.length})</h2>`);
      if (abs.length) {
        win.document.write(`<table><thead><tr><th>Type</th><th>Du</th><th>Au</th><th>Jours</th><th>Statut</th></tr></thead><tbody>`);
        abs.forEach(a => {
          win.document.write(`<tr><td>${ABS_TYPES[a.type]||a.type}</td><td>${fmtDate(a.date_debut)}</td><td>${fmtDate(a.date_fin)}</td><td>${countWorkDays(a.date_debut,a.date_fin)}j</td><td>${ABS_STATUTS[a.statut]||a.statut}</td></tr>`);
        });
        win.document.write(`</tbody></table>`);
      } else {
        win.document.write(`<p style="color:#6B6B9A">Aucun congé sur cette période.</p>`);
      }
    }

    win.document.write(`<div style="margin-top:40px;font-size:0.75rem;color:#6B6B9A;border-top:1px solid #CFD0E5;padding-top:12px">Synthèse générée le ${new Date().toLocaleDateString('fr-FR')} — Hello Pomelo</div></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const CheckOption = ({ label, checked, onChange, detail, detailChecked, onDetailChange }) => (
    <div style={{padding:'10px 14px',border:'1.5px solid var(--lavender)',borderRadius:10,marginBottom:8}}>
      <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontWeight:600,color:'var(--navy)',fontSize:'0.88rem'}}>
        <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} style={{accentColor:'var(--pink)',width:18,height:18}} />
        {label}
      </label>
      {checked && detail && <label style={{display:'flex',alignItems:'center',gap:6,marginTop:6,marginLeft:26,fontSize:'0.78rem',color:'var(--muted)',cursor:'pointer'}}>
        <input type="checkbox" checked={detailChecked} onChange={e=>onDetailChange(e.target.checked)} style={{accentColor:'var(--pink)'}} />
        Inclure l'historique détaillé
      </label>}
    </div>
  );

  return (
    <Modal open={true} onClose={onClose} title="📄 Générer une synthèse PDF" wide>
      <div style={{marginBottom:16}}>
        <div style={{fontWeight:700,color:'var(--navy)',marginBottom:4}}>Collaborateur : {c.prenom} {c.nom}</div>
        <div style={{fontSize:'0.82rem',color:'var(--muted)'}}>{c.poste} · {c.equipe}</div>
      </div>

      <div className="section-title">Période</div>
      <div className="form-grid" style={{marginBottom:16}}>
        <div className="form-field"><label>Du</label><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} /></div>
        <div className="form-field"><label>Au</label><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} /></div>
      </div>

      <div className="section-title">Contenu à inclure</div>
      <CheckOption label="🎯 Objectifs" checked={inclObjectifs} onChange={setInclObjectifs} detail detailChecked={inclObjHist} onDetailChange={setInclObjHist} />
      <CheckOption label="📋 Entretiens RH" checked={inclEntretiens} onChange={setInclEntretiens} detail detailChecked={inclEntHist} onDetailChange={setInclEntHist} />
      <CheckOption label="🏖️ Congés" checked={inclConges} onChange={setInclConges} detail detailChecked={inclCongesHist} onDetailChange={setInclCongesHist} />

      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={generate}>📄 Générer le PDF</button>
      </div>
    </Modal>
  );
}
