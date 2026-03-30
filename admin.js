// ─────────────────────────────────────────
// SUPABASE
// ─────────────────────────────────────────
const SUPABASE_URL = 'https://mlhdghtqfpqhypxwpwjj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_l5iAp3wWHsxcszBKoFhTeA_s8KazePI';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────
// DOCS_LABELS, STATUS_COLORS, STATUS_LABELS, BAR_COLORS, ABS_* sont dans utils.js

// ─────────────────────────────────────────
// DATA MAPPING
// ─────────────────────────────────────────
function defaultOnboarding() {
  const docs = {};
  Object.keys(DOCS_LABELS).forEach(k => docs[k] = false);
  return { notes: '', materiel: '', acces: '', documents: docs, requiredDocs: [], uploads: {} };
}

function fromRow(row) {
  return {
    id: row.id,
    prenom: row.prenom,
    nom: row.nom,
    poste: row.poste,
    email: row.email || '',
    telephone: row.telephone || '',
    dateEntree: row.date_entree || '',
    dateFinEssai: row.date_fin_essai || '',
    notes: row.notes || '',
    soldeConges: row.solde_conges ?? 0,
    acquisitionConges: row.acquisition_conges ?? 2.08,
    valideurCongesId: row.valideur_conges_id || null,
    googleDrive: row.google_drive || '',
    photoUrl: row.photo_url || '',
    managerId: row.manager_id || null,
    bureau: row.bureau || '',
    equipe: row.equipe || '', equipes: parseEquipes(row.equipe),
    contrat: row.contrat || '',
    typePoste: row.type_poste || '',
    onboarding: row.onboarding || defaultOnboarding(),
    pointsSuivi: (row.points_suivi || []).filter(p => p.type === 'mensuel' || !p.type).map(p => ({
      id: p.id, date: p.date, type: p.type, mois: p.mois || '',
      managerData: p.manager_data || {},
      collabData: p.collab_data || {}
    })),
    entretiens: (row.points_suivi || []).filter(p => ['annuel','semestriel','fin_pe','professionnel'].includes(p.type)).map(p => ({
      id: p.id, date: p.date, type: p.type, mois: p.mois || '',
      managerData: p.manager_data || {}
    })),
    objectifs: (() => {
      const order = (row.onboarding || {}).objOrder || [];
      return (row.objectifs || []).sort((a, b) => {
        const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
        if (ia === -1 && ib === -1) return new Date(a.created_at) - new Date(b.created_at);
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
      }).map((o, i) => ({
        id: o.id, numero: i + 1, titre: o.titre, description: o.description || '',
        dateDebut: o.date_debut || '', dateFin: o.date_fin || '', statut: o.statut || 'en-attente',
        progression: o.progression || 0,
        recurrence: o.recurrence || '',
        historique: o.historique || []
      }));
    })()
  };
}

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let DB = { collaborateurs: [] };
let currentView = 'dashboard';
let currentCollabId = null;
let currentTab = 'onboarding';
let SETTINGS = { equipes: [], bureaux: [], contrats: [], typePostes: [], maxObjectifs: 10 };
let editingCollabId = null;
let editingPointId = null;
let editingObjId = null;
let editingEntretienId = null;
let currentPage = 1;
const PAGE_SIZE = 20;

// ─────────────────────────────────────────
// DB INIT (Supabase)
// ─────────────────────────────────────────
async function initDB() {
  const loader = document.createElement('div');
  loader.style.cssText = 'position:fixed;inset:0;background:rgba(5,5,109,0.7);z-index:999;display:flex;align-items:center;justify-content:center;color:white;font-family:Quicksand,sans-serif;font-size:1rem;font-weight:700;gap:12px;';
  loader.innerHTML = '<div style="width:28px;height:28px;border:3px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.7s linear infinite;"></div> Connexion à la base de données…';
  const style = document.createElement('style');
  style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
  document.body.appendChild(loader);

  try {
    const [collabRes, settingsRes, absencesRes, objReqRes] = await Promise.all([
      sb.from('collaborateurs').select('*, points_suivi(*), objectifs(*)'),
      sb.from('settings').select('*'),
      sb.from('absences').select('*').order('date_debut', { ascending: false }),
      sb.from('objectif_requests').select('*').eq('statut', 'en_attente').order('created_at', { ascending: false })
    ]);
    loader.remove();

    if (collabRes.error) { console.error('Supabase collabs:', collabRes.error); showToast('Erreur Supabase : ' + collabRes.error.message); }
    if (absencesRes.error) { console.warn('Supabase absences:', absencesRes.error); }

    DB = {
      collaborateurs: (collabRes.data || []).map(fromRow),
      absences: (absencesRes.data || []).map(a => ({
        id: a.id, collaborateurId: a.collaborateur_id, type: a.type,
        dateDebut: a.date_debut, dateFin: a.date_fin,
        statut: a.statut || 'en_attente', commentaire: a.commentaire || '',
        motifRefus: a.motif_refus || ''
      })),
      objRequests: (objReqRes.data || []).map(r => ({
        id: r.id, objectifId: r.objectif_id, collaborateurId: r.collaborateur_id,
        managerId: r.manager_id, type: r.type, data: r.data || {},
        statut: r.statut, motif: r.motif || '', createdAt: r.created_at
      }))
    };
    if (settingsRes.data) {
      settingsRes.data.forEach(row => { SETTINGS[row.key] = row.value; });
    }

    try { await initDefaultQuestions(); } catch(e) { console.warn('initDefaultQuestions:', e); }
    try { await autoCreateMonthlyPoints(); } catch(e) { console.warn('autoCreateMonthlyPoints:', e); }
    try { await autoRenewRecurringObjectifs(); } catch(e) { console.warn('autoRenewRecurringObjectifs:', e); }
  } catch(e) {
    console.error('initDB failed:', e);
    loader.remove();
  }

  navigate('dashboard');
}

async function autoCreateMonthlyPoints() {
  const cm = currentMois();
  const missing = DB.collaborateurs.filter(c => !(c.pointsSuivi||[]).some(p => p.mois === cm));
  if (!missing.length) return;
  const rows = missing.map(c => ({
    collaborateur_id: c.id, date: cm + '-01', type: 'mensuel', mois: cm,
    manager_data: {}, collab_data: {}, contenu: 'Point mensuel ' + moisLabel(cm)
  }));
  const { data, error } = await sb.from('points_suivi').insert(rows).select();
  if (error) { console.warn('Auto-création points:', error.message); return; }
  // Mettre à jour le cache local
  (data || []).forEach(row => {
    const c = DB.collaborateurs.find(x => x.id === row.collaborateur_id);
    if (c) {
      if (!c.pointsSuivi) c.pointsSuivi = [];
      c.pointsSuivi.push({ id: row.id, date: row.date, type: 'mensuel', mois: row.mois, managerData: {}, collabData: {} });
    }
  });
}

async function autoRenewRecurringObjectifs() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const rows = [];

  DB.collaborateurs.forEach(c => {
    (c.objectifs || []).forEach(o => {
      if (!o.recurrence || !o.dateFin) return;
      const fin = new Date(o.dateFin);
      if (fin >= today) return; // pas encore expiré

      // Calculer la prochaine période
      let newDebut, newFin;
      if (o.recurrence === 'hebdo') {
        newDebut = new Date(fin); newDebut.setDate(fin.getDate() + 1);
        newFin = new Date(newDebut); newFin.setDate(newDebut.getDate() + 6);
      } else if (o.recurrence === 'mensuel') {
        newDebut = new Date(fin); newDebut.setDate(fin.getDate() + 1);
        newFin = new Date(newDebut); newFin.setMonth(newDebut.getMonth() + 1); newFin.setDate(newFin.getDate() - 1);
      }
      if (!newDebut || !newFin) return;

      // Vérifier qu'un objectif avec le même titre et la même période n'existe pas déjà
      const newDebutStr = newDebut.toISOString().split('T')[0];
      const newFinStr = newFin.toISOString().split('T')[0];
      const exists = c.objectifs.some(x => x.titre === o.titre && x.dateDebut === newDebutStr);
      if (exists) return;

      rows.push({
        collaborateur_id: c.id, titre: o.titre, description: o.description || null,
        date_debut: newDebutStr, date_fin: newFinStr,
        statut: 'en-cours', progression: 0, recurrence: o.recurrence
      });
    });
  });

  if (!rows.length) return;
  const { data, error } = await sb.from('objectifs').insert(rows).select();
  if (error) { console.warn('Auto-renewal objectifs:', error.message); return; }
  // Update local cache
  (data || []).forEach(row => {
    const c = DB.collaborateurs.find(x => x.id === row.collaborateur_id);
    if (c) {
      c.objectifs.push({
        id: row.id, numero: c.objectifs.length + 1, titre: row.titre,
        description: row.description || '', dateDebut: row.date_debut,
        dateFin: row.date_fin, statut: 'en-cours', progression: 0,
        recurrence: row.recurrence || ''
      });
    }
  });
}

async function initDefaultQuestions() {
  const defaultManager = [
    { label: 'Retours sur les missions', type: 'texte' },
    { label: 'Taux de staffing / Satisfaction client', type: 'texte' },
    { label: 'Tes qualités ce mois-ci', type: 'texte' },
    { label: 'Un axe d\'amélioration', type: 'texte' },
  ];
  const defaultCollab = [
    { label: 'Comment t\'es-tu senti(e) au travail ce mois-ci ?', type: 'texte' },
    { label: 'Quelles sont tes réussites ce mois-ci ?', type: 'texte' },
    { label: 'Quels étaient tes objectifs M-1, les as-tu atteints ?', type: 'texte' },
    { label: 'Commentaires ou suggestions pour améliorer les process ?', type: 'texte' },
    { label: 'Objectifs et priorités pour le mois à venir ?', type: 'texte' },
    { label: 'Souhaites-tu t\'investir dans d\'autres sujets au sein de HP ?', type: 'texte' },
    { label: '1 axe d\'amélioration pour le mois à venir pour toi ?', type: 'texte' },
  ];
  if (!SETTINGS['questions_manager'] || !SETTINGS['questions_manager'].length) {
    await saveSettingKey('questions_manager', defaultManager);
    SETTINGS['questions_manager'] = defaultManager;
  }
  if (!SETTINGS['questions_collab'] || !SETTINGS['questions_collab'].length) {
    await saveSettingKey('questions_collab', defaultCollab);
    SETTINGS['questions_collab'] = defaultCollab;
  }
}

// ─────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────
function getCollab(id) { return DB.collaborateurs.find(c => c.id === id); }
function getManagerName(id) { const m = getCollab(id); return m ? m.prenom + ' ' + m.nom : '—'; }
function onboardingScore(c) {
  const docs = c.onboarding.documents;
  const required = c.onboarding.requiredDocs || [];
  if (!required.length) return { done: 0, total: 0, pct: 0 };
  const done = required.filter(k => docs[k]).length;
  return { done, total: required.length, pct: Math.round(done / required.length * 100) };
}

// ─────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────
function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  let html = `
    <span class="nav-section">Navigation</span>
    <button class="nav-item ${currentView === 'dashboard' ? 'active' : ''}" onclick="navigate('dashboard')">
      <span class="nav-icon">🏠</span><span>Tableau de bord</span>${(() => { const cm = currentMois(); const missingPoints = DB.collaborateurs.filter(c => !(c.pointsSuivi||[]).some(p => p.mois === cm)).length; return missingPoints ? `<span style="background:var(--orange);color:white;font-size:0.65rem;font-weight:800;padding:2px 7px;border-radius:99px;margin-left:auto;">${missingPoints}</span>` : ''; })()}
    </button>`;
  if (currentView === 'collab' && currentCollabId) {
    const c = getCollab(currentCollabId);
    if (c) html += `
      <button class="nav-item active">
        <span class="nav-icon">👤</span><span>${c.prenom} ${c.nom}</span>
      </button>`;
  }
  html += `
    <span class="nav-section">Administration</span>
    <button class="nav-item ${currentView === 'bo-people' ? 'active' : ''}" onclick="navigate('bo-people')">
      <span class="nav-icon">👥</span><span>Collaborateurs</span>
    </button>
    <button class="nav-item ${currentView === 'bo-managers' ? 'active' : ''}" onclick="navigate('bo-managers')">
      <span class="nav-icon">🗂️</span><span>Organigramme</span>
    </button>
    <button class="nav-item ${currentView === 'bo-objectifs' ? 'active' : ''}" onclick="navigate('bo-objectifs')">
      <span class="nav-icon">🎯</span><span>Objectifs</span>${(() => { const pending = (DB.objRequests||[]).length; return pending ? `<span style="background:var(--orange);color:white;font-size:0.65rem;font-weight:800;padding:2px 7px;border-radius:99px;margin-left:auto;">${pending}</span>` : ''; })()}
    </button>
    <button class="nav-item ${currentView === 'bo-absences' ? 'active' : ''}" onclick="navigate('bo-absences')">
      <span class="nav-icon">🏖️</span><span>Congés & Absences</span>${(() => { const pending = (DB.absences||[]).filter(a => a.statut === 'en_attente').length; return pending ? `<span style="background:var(--pink);color:white;font-size:0.65rem;font-weight:800;padding:2px 7px;border-radius:99px;margin-left:auto;">${pending}</span>` : ''; })()}
    </button>
    <button class="nav-item ${currentView === 'bo-settings' ? 'active' : ''}" onclick="navigate('bo-settings')">
      <span class="nav-icon">⚙️</span><span>Paramètres</span>
    </button>`;
  nav.innerHTML = html;
}

function navigate(view, collabId) {
  currentView = view;
  if (collabId) currentCollabId = collabId;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const el = document.getElementById('view-' + view);
  if (el) { el.classList.remove('hidden'); el.style.animation = 'fadeIn 0.2s ease'; }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderSidebar();
  if (view === 'dashboard') renderDashboard();
  else if (view === 'collab') { currentTab = 'onboarding'; renderCollab(); }
  else if (view === 'bo-people') renderBoPeople();
  else if (view === 'bo-managers') renderBoManagers();
  else if (view === 'bo-objectifs') renderBoObjectifs();
  else if (view === 'bo-absences') renderBoAbsences();
  else if (view === 'bo-settings') renderBoSettings();
}

// ─────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────
function renderDashboard() {
  const total = DB.collaborateurs.length;
  const now = new Date();
  const cm = currentMois();
  const thisMonth = DB.collaborateurs.filter(c => {
    if (!c.dateEntree) return false;
    const d = new Date(c.dateEntree);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const managers = new Set(DB.collaborateurs.map(c => c.managerId).filter(Boolean)).size;
  const docsOk = DB.collaborateurs.filter(c => onboardingScore(c).pct === 100).length;

  // Points mensuels : compter les statuts
  const pointsComplets = DB.collaborateurs.filter(c => {
    const p = (c.pointsSuivi||[]).find(x => x.mois === cm);
    return p && getPointStatus(p) === 'complet';
  }).length;

  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card pink"><div class="stat-num">${total}</div><div class="stat-label">Collaborateurs</div></div>
    <div class="stat-card blue"><div class="stat-num">${thisMonth}</div><div class="stat-label">Arrivées ce mois</div></div>
    <div class="stat-card ${pointsComplets === total ? 'green' : 'sky'}"><div class="stat-num">${pointsComplets}/${total}</div><div class="stat-label">Points complets</div></div>
    <div class="stat-card green"><div class="stat-num">${docsOk}</div><div class="stat-label">Dossiers complets</div></div>`;

  document.getElementById('btnAddCollabDash').classList.remove('hidden');

  // Populate filters
  populateFilterSelects();

  // Render alerts
  renderAlerts();

  // Render analytics
  // Render analytics + trend chart
  renderAnalytics();
  document.getElementById('analyticsSection').innerHTML += renderTrendChart();

  currentPage = 1;
  filterCollabs();
}

// ── ALERTS ──
function renderAlerts() {
  const cm = currentMois();
  const today = new Date().toISOString().split('T')[0];
  const alerts = [];

  DB.collaborateurs.forEach(c => {
    // Points mensuels — rappel uniquement si le mois PRÉCÉDENT n'est pas complet (à partir du 1er du mois suivant)
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMois = prevYear + '-' + String(prevMonth).padStart(2, '0');
    const prevPoint = (c.pointsSuivi||[]).find(p => p.mois === prevMois);
    if (prevPoint) {
      const status = getPointStatus(prevPoint);
      if (status !== 'complet') {
        const md = prevPoint.managerData || {};
        const cd = prevPoint.collabData || {};
        const mdKeys = Object.keys(md).filter(k => k !== 'objectifs');
        const cdKeys = Object.keys(cd).filter(k => k !== 'objectifs');
        const managerDone = mdKeys.length > 0 && mdKeys.every(k => md[k] && String(md[k]).trim());
        const collabDone = cdKeys.length > 0 && cdKeys.every(k => cd[k] && String(cd[k]).trim());
        if (status === 'vide') {
          alerts.push({ type: 'danger', icon: '🔴', text: `<strong>${escHTML(c.prenom)} ${escHTML(c.nom)}</strong> — Point de ${moisLabel(prevMois)} non rempli`, collabId: c.id, email: c.email, prenom: c.prenom });
        } else if (!managerDone) {
          alerts.push({ type: 'warning', icon: '🟡', text: `<strong>${escHTML(c.prenom)} ${escHTML(c.nom)}</strong> — Retours manager manquants pour ${moisLabel(prevMois)}`, collabId: c.id });
        } else if (!collabDone) {
          alerts.push({ type: 'warning', icon: '🟡', text: `<strong>${escHTML(c.prenom)} ${escHTML(c.nom)}</strong> — Réponses collaborateur manquantes pour ${moisLabel(prevMois)}`, collabId: c.id, email: c.email, prenom: c.prenom });
        }
      }
    } else {
      // Pas de point du tout pour le mois précédent
      alerts.push({ type: 'danger', icon: '🔴', text: `<strong>${escHTML(c.prenom)} ${escHTML(c.nom)}</strong> — Point de ${moisLabel(prevMois)} inexistant`, collabId: c.id, email: c.email, prenom: c.prenom });
    }

    // Documents en attente de validation
    const uploads = c.onboarding.uploads || {};
    const docs = c.onboarding.documents || {};
    Object.keys(uploads).forEach(k => {
      if (!docs[k]) alerts.push({ type: 'info', icon: '📎', text: `<strong>${c.prenom} ${c.nom}</strong> — Document "${DOCS_LABELS[k]||k}" en attente de validation`, collabId: c.id });
    });

    // Objectifs expirés
    (c.objectifs||[]).forEach(o => {
      if (o.statut === 'en-cours' && o.dateFin && o.dateFin < today) {
        alerts.push({ type: 'danger', icon: '🎯', text: `<strong>${c.prenom} ${c.nom}</strong> — Objectif "${o.titre}" expiré depuis le ${fmtDate(o.dateFin)}`, collabId: c.id });
      }
    });

    // Période d'essai < 30 jours
    if (c.dateFinEssai) {
      const daysLeft = daysFromNow(c.dateFinEssai);
      if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 30) {
        alerts.push({ type: 'danger', icon: '⏰', text: `<strong>${c.prenom} ${c.nom}</strong> — Fin de période d'essai dans ${daysLeft} jours (${fmtDate(c.dateFinEssai)})`, collabId: c.id });
      }
    }
  });

  // Demandes de modification d'objectifs
  (DB.objRequests || []).forEach(r => {
    const collab = getCollab(r.collaborateurId);
    const manager = getCollab(r.managerId);
    const typeLabel = { modifier: 'modifier', creer: 'créer', supprimer: 'supprimer' }[r.type] || r.type;
    const titre = r.data?.titre || '(objectif)';
    alerts.push({
      type: 'info', icon: '🎯',
      text: `<strong>${manager ? manager.prenom + ' ' + manager.nom : 'Manager'}</strong> propose de ${typeLabel} l'objectif "${escHTML(titre)}" pour <strong>${collab ? collab.prenom + ' ' + collab.nom : '—'}</strong>${r.motif ? ' — ' + escHTML(r.motif) : ''}`,
      collabId: r.collaborateurId,
      objRequest: r
    });
  });

  const panel = document.getElementById('alertsPanel');
  const list = document.getElementById('alertsList');
  if (!alerts.length) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  list.innerHTML = alerts.slice(0, 20).map(a => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;margin-bottom:6px;font-size:0.82rem;font-weight:600;background:${a.type==='danger'?'#FFF1F2':a.type==='warning'?'#FFF7ED':'#EFF6FF'};color:${a.type==='danger'?'#881337':a.type==='warning'?'#9A3412':'#1E40AF'};">
      <span style="font-size:1rem;flex-shrink:0;">${a.icon}</span>
      <span style="flex:1;cursor:pointer;" onclick="navigate('collab','${a.collabId}')">${a.text}</span>
      ${a.objRequest ? `
        <button class="btn btn-sm" style="background:var(--green);color:white;padding:3px 8px;font-size:0.68rem;flex-shrink:0;" onclick="event.stopPropagation();approveObjRequest('${a.objRequest.id}')">✓ Approuver</button>
        <button class="btn btn-danger btn-sm" style="padding:3px 8px;font-size:0.68rem;flex-shrink:0;" onclick="event.stopPropagation();refuseObjRequest('${a.objRequest.id}')">✕ Refuser</button>
      ` : ''}
      ${a.email ? `<a href="mailto:${escHTML(a.email)}?subject=${encodeURIComponent('Rappel — Point de suivi mensuel ' + moisLabel(currentMois()))}&body=${encodeURIComponent('Bonjour ' + (a.prenom||'') + ',\n\nN\'oublie pas de compléter ton point de suivi de ' + moisLabel(currentMois()) + ' sur l\'outil Hello Pomelo avant le 5 du mois prochain.\n\nMerci !')}" onclick="event.stopPropagation()" class="btn btn-sm" style="background:var(--navy);color:white;padding:3px 8px;font-size:0.68rem;flex-shrink:0;">📧 Rappel</a>` : ''}
    </div>`).join('') + (alerts.length > 20 ? `<div style="font-size:0.78rem;color:var(--muted);text-align:center;margin-top:8px;">… et ${alerts.length - 20} autres alertes</div>` : '');
}

// ── ANALYTICS ──
function renderAnalytics() {
  // Objectifs by status
  const allObjs = DB.collaborateurs.flatMap(c => c.objectifs||[]);
  const objByStatus = { 'en-cours': 0, 'atteint': 0, 'non-atteint': 0, 'en-attente': 0 };
  allObjs.forEach(o => { objByStatus[o.statut] = (objByStatus[o.statut]||0) + 1; });
  const maxObj = Math.max(...Object.values(objByStatus), 1);
  const objColors = { 'en-cours': 'var(--blue)', 'atteint': 'var(--green)', 'non-atteint': 'var(--orange)', 'en-attente': 'var(--lavender)' };
  document.getElementById('chartObjectifs').innerHTML = allObjs.length ? Object.entries(objByStatus).map(([k,v]) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <span style="font-size:0.75rem;font-weight:600;color:var(--navy);min-width:90px;text-align:right;">${STATUS_LABELS[k]}</span>
      <div style="flex:1;height:22px;background:var(--offwhite);border-radius:6px;overflow:hidden;">
        <div style="height:100%;width:${Math.round(v/maxObj*100)}%;background:${objColors[k]};border-radius:6px;display:flex;align-items:center;padding-left:8px;font-size:0.7rem;font-weight:700;color:white;min-width:${v?'24px':'0'};">${v||''}</div>
      </div>
    </div>`).join('') : '<p style="color:var(--muted);font-size:0.85rem;">Aucun objectif.</p>';

  // Team distribution
  const teamCounts = {};
  DB.collaborateurs.forEach(c => { const eqs = c.equipes.length ? c.equipes : ['Non assigné']; eqs.forEach(eq => { teamCounts[eq] = (teamCounts[eq]||0) + 1; }); });
  const maxTeam = Math.max(...Object.values(teamCounts), 1);
  const teamColors = ['var(--pink)','var(--blue)','var(--skyblue)','var(--green)','var(--orange)','var(--lilac)'];
  document.getElementById('chartEquipes').innerHTML = Object.keys(teamCounts).length ? Object.entries(teamCounts).sort((a,b)=>b[1]-a[1]).map(([k,v],i) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <span style="font-size:0.75rem;font-weight:600;color:var(--navy);min-width:90px;text-align:right;">${k}</span>
      <div style="flex:1;height:22px;background:var(--offwhite);border-radius:6px;overflow:hidden;">
        <div style="height:100%;width:${Math.round(v/maxTeam*100)}%;background:${teamColors[i%teamColors.length]};border-radius:6px;display:flex;align-items:center;padding-left:8px;font-size:0.7rem;font-weight:700;color:white;min-width:24px;">${v}</div>
      </div>
    </div>`).join('') : '<p style="color:var(--muted);font-size:0.85rem;">Aucune équipe.</p>';
}

// ── FILTERS ──
function populateFilterSelects() {
  const equipes = [...new Set(DB.collaborateurs.map(c=>c.equipe).filter(Boolean))];
  const bureaux = [...new Set(DB.collaborateurs.map(c=>c.bureau).filter(Boolean))];
  const contrats = [...new Set(DB.collaborateurs.map(c=>c.contrat).filter(Boolean))];
  const managerIds = [...new Set(DB.collaborateurs.map(c=>c.managerId).filter(Boolean))];

  const fillSelect = (id, items, labelFn) => {
    const sel = document.getElementById(id);
    const val = sel.value;
    const firstOpt = sel.options[0].textContent;
    sel.innerHTML = `<option value="">${firstOpt}</option>` + items.map(v => `<option value="${v}" ${v===val?'selected':''}>${labelFn?labelFn(v):v}</option>`).join('');
  };
  fillSelect('filterEquipe', equipes);
  fillSelect('filterBureau', bureaux);
  fillSelect('filterContrat', contrats);
  fillSelect('filterManager', managerIds, id => getManagerName(id));
}

function filterCollabs() {
  const q = (document.getElementById('searchInput').value||'').toLowerCase();
  const fEquipe = document.getElementById('filterEquipe').value;
  const fBureau = document.getElementById('filterBureau').value;
  const fManager = document.getElementById('filterManager').value;
  const fContrat = document.getElementById('filterContrat').value;

  // Show/hide clear button
  const clearBtn = document.getElementById('searchClear');
  if (clearBtn) clearBtn.style.display = q ? 'inline' : 'none';

  const filtered = DB.collaborateurs.filter(c => {
    if (q && !(c.prenom + ' ' + c.nom + ' ' + c.poste).toLowerCase().includes(q)) return false;
    if (fEquipe && !c.equipes.includes(fEquipe)) return false;
    if (fBureau && c.bureau !== fBureau) return false;
    if (fManager && c.managerId !== fManager) return false;
    if (fContrat && c.contrat !== fContrat) return false;
    return true;
  });

  // Show result count when filtering
  const countEl = document.getElementById('resultCount');
  const isFiltering = q || fEquipe || fBureau || fManager || fContrat;
  if (countEl) countEl.textContent = isFiltering ? `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}` : '';

  renderCollabGrid(filtered);
}

const debouncedFilter = debounce(filterCollabs, 200);

function renderCollabGrid(list) {
  const grid = document.getElementById('collabGrid');
  const pagRow = document.getElementById('paginationRow');
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">👤</div><p>Aucun collaborateur trouvé</p></div>`;
    pagRow.innerHTML = '';
    return;
  }

  // Pagination
  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageList = list.slice(start, start + PAGE_SIZE);

  grid.innerHTML = pageList.map(c => {
    const score = onboardingScore(c);
    const manager = c.managerId ? getManagerName(c.managerId) : null;
    const badge = score.total === 0 ? '' : score.pct === 100
      ? '<span class="badge badge-green">Dossier complet</span>'
      : `<span class="badge badge-orange">${score.done}/${score.total} docs</span>`;
    return `
      <div class="collab-card" onclick="navigate('collab','${c.id}')">
        ${avatarHTML(c, 52)}
        <div class="collab-name">${c.prenom} ${c.nom}</div>
        <div class="collab-poste">${c.poste}</div>
        ${manager ? `<div class="collab-manager">👔 ${manager}</div>` : ''}
        <div class="collab-badges">${badge}</div>
      </div>`;
  }).join('');

  // Pagination controls
  if (totalPages <= 1) { pagRow.innerHTML = ''; return; }
  let pagHTML = `<button class="btn btn-ghost btn-sm" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>← Préc</button>`;
  pagHTML += `<span style="font-size:0.78rem;color:var(--muted);font-weight:600;">Page ${currentPage} / ${totalPages} (${list.length} résultats)</span>`;
  pagHTML += `<button class="btn btn-ghost btn-sm" onclick="goPage(${currentPage+1})" ${currentPage===totalPages?'disabled':''}>Suiv →</button>`;
  pagRow.innerHTML = pagHTML;
}

function goPage(p) { currentPage = p; filterCollabs(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

// ── EXPORT CSV ──
function exportCollabsCSV() {
  const headers = ['Prénom','Nom','Poste','Email','Téléphone','Date entrée','Bureau','Équipe','Contrat','Type poste','Manager','Dossier complet'];
  const rows = DB.collaborateurs.map(c => [
    c.prenom, c.nom, c.poste, c.email, c.telephone, c.dateEntree,
    c.bureau, c.equipes.join(', '), c.contrat, c.typePoste,
    c.managerId ? getManagerName(c.managerId) : '',
    onboardingScore(c).pct === 100 ? 'Oui' : 'Non'
  ]);
  exportCSV('collaborateurs_' + new Date().toISOString().split('T')[0] + '.csv', headers, rows);
  showToast('Export CSV téléchargé !');
}

// ─────────────────────────────────────────
// COLLAB PROFILE
// ─────────────────────────────────────────
function renderCollab() {
  const c = getCollab(currentCollabId);
  if (!c) return;
  const manager = c.managerId ? getManagerName(c.managerId) : null;

  document.getElementById('profileHeader').innerHTML = `
    <div class="profile-header">
      ${avatarHTML(c, 72)}
      <div class="profile-info">
        <div class="profile-name">${c.prenom} ${c.nom}</div>
        <div class="profile-poste">${c.poste}</div>
        <div class="profile-meta">
          ${c.email ? `<div class="profile-meta-item">✉️ <span>${c.email}</span></div>` : ''}
          ${c.telephone ? `<div class="profile-meta-item">📞 <span>${c.telephone}</span></div>` : ''}
          ${c.dateEntree ? `<div class="profile-meta-item">📅 Entrée le <span>${fmtDate(c.dateEntree)}</span></div>` : ''}
          ${c.bureau    ? `<div class="profile-meta-item">🏢 Bureau : <span>${c.bureau}</span></div>`          : ''}
          ${c.equipes.length ? `<div class="profile-meta-item">👥 Équipe${c.equipes.length>1?'s':''} : <span>${c.equipes.map(e=>escHTML(e)).join(', ')}</span></div>` : ''}
          ${c.contrat   ? `<div class="profile-meta-item">📄 Contrat : <span>${c.contrat}</span></div>`       : ''}
          ${c.typePoste ? `<div class="profile-meta-item">🏷️ Type de poste : <span>${c.typePoste}</span></div>` : ''}
          ${manager ? `<div class="profile-meta-item">👔 Manager : <span>${manager}</span></div>` : ''}
          ${c.dateFinEssai ? `<div class="profile-meta-item">⏰ Fin période d'essai : <span>${fmtDate(c.dateFinEssai)}</span></div>` : ''}
          ${c.googleDrive ? `<div class="profile-meta-item">📁 <a href="${escHTML(c.googleDrive)}" target="_blank" style="color:var(--blue);text-decoration:underline;font-weight:700;">Google Drive</a></div>` : ''}
        </div>
        ${c.notes ? `<div style="margin-top:10px;padding:10px 14px;background:#FFF7ED;border-radius:10px;border-left:3px solid var(--orange);font-size:0.82rem;color:#9A3412;"><strong>Notes RH :</strong> ${escHTML(c.notes)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button class="btn btn-ghost btn-sm" onclick="openEditCollab('${c.id}')">✏️ Modifier</button>
        <button class="btn btn-navy btn-sm" onclick="exportCollabPDF()">📄 Fiche PDF</button>
        <button class="btn btn-navy btn-sm" onclick="exportPointsPDF()">📋 Points PDF</button>
        <button class="btn btn-sm" style="background:linear-gradient(135deg,var(--skyblue),var(--blue));color:white;" onclick="voirCommeCollab('${c.id}')">👁 ${escHTML(c.prenom)}</button>
      </div>
    </div>`;

  // Reset tabs
  document.querySelectorAll('.profile-nav-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  document.querySelectorAll('.tab-pane').forEach((p, i) => p.classList.toggle('active', i === 0));
  currentTab = 'onboarding';

  document.getElementById('btnAddPoint').classList.add('hidden');
  document.getElementById('btnAddObj').classList.remove('hidden');
  document.getElementById('btnSaveOnboarding').classList.remove('hidden');

  showTab('onboarding');
}

function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.profile-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'onboarding') renderOnboarding();
  else if (tab === 'points') renderPoints();
  else if (tab === 'objectifs') renderObjectifs();
  else if (tab === 'entretiens') renderEntretiens();
}

// ─────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────
function renderOnboarding() {
  const c = getCollab(currentCollabId);
  if (!c) return;
  const docs = c.onboarding.documents;

  const required = c.onboarding.requiredDocs || [];
  const uploads = c.onboarding.uploads || {};
  const SUPABASE_URL = 'https://mlhdghtqfpqhypxwpwjj.supabase.co';

  if (!required.length) {
    document.getElementById('checklistDocs').innerHTML = `<div style="font-size:0.83rem;color:var(--muted);font-style:italic;">Aucun document requis défini pour ce collaborateur.</div>`;
  } else {
    document.getElementById('checklistDocs').innerHTML = required.map(k => {
      const label = DOCS_LABELS[k] || k;
      const validated = docs[k];
      const upload = uploads[k];
      const uploadBlock = upload && !validated ? `
        <div onclick="event.stopPropagation()" style="margin-top:8px;padding:8px 10px;background:#FFF5F9;border-radius:8px;border:1px solid var(--pink);display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="font-size:0.75rem;color:var(--navy);font-weight:600;">📎 ${upload.filename}</span>
          <span style="font-size:0.7rem;color:var(--muted);">${upload.uploadedAt} · ${upload.size}</span>
          <div style="display:flex;gap:6px;margin-left:auto;">
            <a href="${SUPABASE_URL}/storage/v1/object/public/onboarding-docs/${upload.path}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:0.72rem;padding:3px 10px;">👁 Voir</a>
            <button onclick="validateUpload('${k}')" class="btn btn-primary btn-sm" style="font-size:0.72rem;padding:3px 10px;background:var(--green);border-color:var(--green);">✓ Valider</button>
            <button onclick="rejectUpload('${k}')" class="btn btn-danger btn-sm" style="font-size:0.72rem;padding:3px 10px;">✕ Rejeter</button>
          </div>
        </div>` : '';
      const pendingBadge = upload && !validated ? `<span style="font-size:0.68rem;font-weight:700;color:var(--pink);background:#FFF0F8;border-radius:99px;padding:2px 8px;margin-left:6px;">⏳ En attente</span>` : '';
      return `
        <div style="margin-bottom:8px;">
          <div class="check-item ${validated ? 'done' : ''}">
            <div class="check-box">${validated ? '✓' : ''}</div>
            <div style="flex:1;font-size:0.85rem;font-weight:600;">${label}${pendingBadge}</div>
          </div>
          ${uploadBlock}
        </div>`;
    }).join('');
  }

  document.getElementById('onboardingNotes').value = c.onboarding.notes || '';
  document.getElementById('onboardingMateriel').value = c.onboarding.materiel || '';
  document.getElementById('onboardingAcces').value = c.onboarding.acces || '';
  ['onboardingNotes', 'onboardingMateriel', 'onboardingAcces'].forEach(id => {
    document.getElementById(id).readOnly = false;
  });
}

async function toggleDoc(docKey) {
  const c = getCollab(currentCollabId);
  c.onboarding.documents[docKey] = !c.onboarding.documents[docKey];
  const { error } = await sb.from('collaborateurs').update({ onboarding: c.onboarding }).eq('id', c.id);
  if (error) { c.onboarding.documents[docKey] = !c.onboarding.documents[docKey]; showToast('Erreur: ' + error.message); return; }
  renderOnboarding();
}

async function validateUpload(docKey) {
  const c = getCollab(currentCollabId);
  c.onboarding.documents[docKey] = true;
  const { error } = await sb.from('collaborateurs').update({ onboarding: c.onboarding }).eq('id', c.id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  showToast('Document validé ✓');
  renderOnboarding();
}

async function rejectUpload(docKey) {
  if (!await confirmModal('Rejeter ce document ? Le collaborateur devra en déposer un nouveau.')) return;
  const c = getCollab(currentCollabId);
  const upload = c.onboarding.uploads?.[docKey];
  if (upload) {
    const { error: storageErr } = await sb.storage.from('onboarding-docs').remove([upload.path]);
    if (storageErr) { showToast('Erreur suppression fichier: ' + storageErr.message); return; }
  }
  delete c.onboarding.uploads[docKey];
  c.onboarding.documents[docKey] = false;
  const { error } = await sb.from('collaborateurs').update({ onboarding: c.onboarding }).eq('id', c.id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  showToast('Document rejeté — le collaborateur peut en déposer un nouveau.');
  renderOnboarding();
}


async function saveOnboarding() {
  const c = getCollab(currentCollabId);
  c.onboarding.notes = document.getElementById('onboardingNotes').value;
  c.onboarding.materiel = document.getElementById('onboardingMateriel').value;
  c.onboarding.acces = document.getElementById('onboardingAcces').value;
  const { error } = await sb.from('collaborateurs').update({ onboarding: c.onboarding }).eq('id', c.id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  showToast('Informations enregistrées !');
}

// ─────────────────────────────────────────
// POINTS DE SUIVI MENSUEL
// ─────────────────────────────────────────

function renderPoints() {
  const c = getCollab(currentCollabId);
  if (!c) return;
  const sorted = [...(c.pointsSuivi || [])].sort((a, b) => (b.mois || b.date) > (a.mois || a.date) ? 1 : -1);
  const cm = currentMois();
  const hasCurrent = sorted.some(p => p.mois === cm);

  // Bouton "Modifier le point du mois" (le point est auto-créé)
  const btn = document.getElementById('btnAddPoint');
  if (hasCurrent) {
    btn.classList.remove('hidden');
    document.getElementById('btnAddPointLabel').textContent = 'Modifier ' + moisLabel(cm);
  } else {
    btn.classList.add('hidden');
  }

  if (!sorted.length) {
    document.getElementById('pointsList').innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Aucun point mensuel pour ce collaborateur.</p></div>`;
    return;
  }

  document.getElementById('pointsList').innerHTML = sorted.map((p, i) => {
    const locked = isPointLocked(p.mois || cm);
    const md = p.managerData || {};
    const cd = p.collabData || {};
    const label = moisLabel(p.mois || p.date);
    const isFirst = i === 0;
    const status = locked ? null : getPointStatus(p);
    const statusBadge = locked
      ? `<span style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);background:var(--lavender);padding:2px 8px;border-radius:99px;">🔒 Verrouillé</span>`
      : `<span class="badge ${POINT_STATUS_BADGE[status].cls}" style="font-size:0.65rem;">${POINT_STATUS_BADGE[status].label}</span>`;

    return `
    <div class="point-accordion" style="margin-bottom:10px;border-radius:14px;border:1.5px solid var(--lavender);overflow:hidden;background:white;">
      <div onclick="toggleAcc('acc-${p.id}')" style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;cursor:pointer;background:${isFirst && !locked ? 'linear-gradient(135deg,#F0F0FF,#FFF0F8)' : 'white'};">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:0.95rem;font-weight:700;color:var(--navy);">📅 ${label}</span>
          ${statusBadge}
        </div>
        <span style="color:var(--muted);font-size:1rem;" id="acc-icon-${p.id}">${isFirst ? '▲' : '▼'}</span>
      </div>
      <div id="acc-${p.id}" style="display:${isFirst ? 'block' : 'none'};padding:0 18px 18px;border-top:1.5px solid var(--lavender);">

        <!-- Section Manager -->
        <div style="margin-top:16px;">
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--skyblue);margin-bottom:12px;display:flex;align-items:center;gap:6px;">👔 Retours Manager</div>
          ${renderManagerSection(md, locked, p.id)}
        </div>

        <!-- Section Collaborateur -->
        <div style="margin-top:20px;padding-top:16px;border-top:1px dashed var(--lavender);">
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--pink);margin-bottom:12px;">👤 Réponses du collaborateur</div>
          ${renderCollabSectionAdmin(cd)}
        </div>

        ${!locked ? `<div style="display:flex;justify-content:flex-end;margin-top:14px;"><button class="btn btn-primary btn-sm" onclick="openEditPoint('${p.id}')">✏️ Modifier mes retours</button></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderManagerSection(md, readOnly, pid) {
  const questions = getActiveManagerQuestions();
  let html = questions.map(q => {
    const val = md[q.key];
    const display = q.type === 'notation' && val ? val + '/5' : (val || 'Non renseigné');
    return `<div style="margin-bottom:12px;">
      <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:4px;">${escHTML(q.label)}</div>
      <div style="background:var(--offwhite);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:${val ? 'var(--navy)' : 'var(--muted)'};line-height:1.6;min-height:36px;font-style:${val ? 'normal' : 'italic'};">${escHTML(display)}</div>
    </div>`;
  }).join('');

  const objData = md.objectifs||{};
  const c = getCollab(currentCollabId);
  const activeObjs = (c&&c.objectifs||[]).filter(o=>o.statut==='en-cours');
  if (activeObjs.length && Object.keys(objData).length) {
    html += `<div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--lavender);">
      <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--pink);margin-bottom:10px;">📊 Suivi objectifs</div>
      ${activeObjs.map((o,i)=>{
        const d=objData[o.id]||{};
        return `<div style="margin-bottom:10px;background:var(--offwhite);border-radius:8px;padding:10px 12px;">
          <div style="font-size:0.75rem;font-weight:700;color:var(--navy);margin-bottom:6px;">Objectif ${i+1} — ${o.titre}</div>
          <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">
            <div style="font-size:0.84rem;color:${d.commentaire?'var(--navy)':'var(--muted)'};flex:1;font-style:${d.commentaire?'normal':'italic'}">${d.commentaire||'Non renseigné'}</div>
            ${d.note?`<div style="background:var(--pink);color:white;border-radius:8px;padding:2px 10px;font-size:0.8rem;font-weight:700;white-space:nowrap;">${d.note}/5</div>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }
  return html;
}

function renderCollabSectionAdmin(cd) {
  const fields = [
    ['ressenti', 'Comment s\'est-il/elle senti(e) au travail ce mois-ci ?'],
    ['reussites', 'Réussites du mois'],
    ['objectifsAtteints', 'Objectifs M-1 atteints ?'],
    ['suggestions', 'Commentaires / suggestions process'],
    ['objectifsMoisSuivant', 'Objectifs et priorités mois suivant'],
    ['autresSujets', 'Souhaite s\'investir dans d\'autres sujets'],
    ['axeAmeliorationSoi', 'Axe d\'amélioration personnel'],
  ];
  const hasData = Object.keys(cd).length > 0 && Object.values(cd).some(v => v);
  if (!hasData) return `<div style="font-size:0.83rem;color:var(--muted);font-style:italic;padding:10px 0;">Le collaborateur n'a pas encore renseigné ses réponses.</div>`;
  let html = fields.map(([k, label]) => `
    <div style="margin-bottom:12px;">
      <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:4px;">${label}</div>
      <div style="background:var(--offwhite);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:${cd[k] ? 'var(--navy)' : 'var(--muted)'};line-height:1.6;min-height:36px;font-style:${cd[k] ? 'normal' : 'italic'};">${cd[k] || 'Non renseigné'}</div>
    </div>`).join('');

  const objData = cd.objectifs||{};
  const c = getCollab(currentCollabId);
  const activeObjs = (c&&c.objectifs||[]).filter(o=>o.statut==='en-cours');
  if (activeObjs.length && Object.keys(objData).length) {
    html += `<div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--lavender);">
      <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--pink);margin-bottom:10px;">📊 Suivi objectifs (collaborateur)</div>
      ${activeObjs.map((o,i)=>{
        const d=objData[o.id]||{};
        return `<div style="margin-bottom:10px;background:var(--offwhite);border-radius:8px;padding:10px 12px;">
          <div style="font-size:0.75rem;font-weight:700;color:var(--navy);margin-bottom:6px;">Objectif ${i+1} — ${o.titre}</div>
          <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">
            <div style="font-size:0.84rem;color:${d.commentaire?'var(--navy)':'var(--muted)'};flex:1;font-style:${d.commentaire?'normal':'italic'}">${d.commentaire||'Non renseigné'}</div>
            ${d.note?`<div style="background:var(--pink);color:white;border-radius:8px;padding:2px 10px;font-size:0.8rem;font-weight:700;white-space:nowrap;">${d.note}/5</div>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }
  return html;
}

// ── DEFAULT QUESTIONS (fallback si pas configurées) ──
const DEFAULT_MANAGER_Q = [
  { key: 'retoursMissions', label: 'Retours sur les missions', type: 'texte' },
  { key: 'tauxStaffing', label: 'Taux de staffing / Satisfaction client', type: 'texte' },
  { key: 'qualites', label: 'Tes qualités ce mois-ci', type: 'texte' },
  { key: 'axeAmelioration', label: 'Un axe d\'amélioration', type: 'texte' },
];

function getActiveManagerQuestions() {
  const custom = getQuestions('manager');
  return custom.length ? custom.map((q, i) => ({ key: 'q' + i, label: q.label, type: q.type, options: q.options })) : DEFAULT_MANAGER_Q;
}

function renderQuestionField(q, prefix, value) {
  const id = prefix + '_' + q.key;
  if (q.type === 'notation') {
    return `<div class="form-field full">
      <label>${escHTML(q.label)}</label>
      <div style="display:flex;align-items:center;gap:10px;">
        <input id="${id}" type="range" min="1" max="5" value="${value||3}" oninput="document.getElementById('${id}_val').textContent=this.value+'/5'" style="flex:1;" />
        <span id="${id}_val" style="font-weight:700;color:var(--navy);min-width:30px;">${value||3}/5</span>
      </div>
    </div>`;
  }
  if (q.type === 'qcm' && q.options) {
    return `<div class="form-field full">
      <label>${escHTML(q.label)}</label>
      <select id="${id}" style="border:1.5px solid var(--lavender);border-radius:10px;padding:10px 14px;font-family:inherit;font-size:0.9rem;color:var(--navy);background:var(--offwhite);width:100%;">
        <option value="">— Choisir —</option>
        ${q.options.map(o => `<option value="${escHTML(o)}" ${value === o ? 'selected' : ''}>${escHTML(o)}</option>`).join('')}
      </select>
    </div>`;
  }
  return `<div class="form-field full">
    <label>${escHTML(q.label)}</label>
    <textarea id="${id}" placeholder="Votre réponse..." style="min-height:70px;">${escHTML(value||'')}</textarea>
  </div>`;
}

function openCurrentMonthPoint() {
  const c = getCollab(currentCollabId);
  const cm = currentMois();
  const existing = (c.pointsSuivi || []).find(p => p.mois === cm);
  if (existing) { openEditPoint(existing.id); return; }
  editingPointId = null;
  renderManagerModalFields({});
  document.getElementById('modalPointTitle').textContent = '📅 Point mensuel — ' + moisLabel(cm);
  openModal('modalPoint');
  injectObjFieldsInModal(null);
}

function openEditPoint(id) {
  const c = getCollab(currentCollabId);
  const p = (c.pointsSuivi || []).find(x => x.id === id);
  if (!p) return;
  editingPointId = id;
  const md = p.managerData || {};
  renderManagerModalFields(md);
  document.getElementById('modalPointTitle').textContent = '📅 Point mensuel — ' + moisLabel(p.mois);
  openModal('modalPoint');
  injectObjFieldsInModal(md);
}

function renderManagerModalFields(existingData) {
  const questions = getActiveManagerQuestions();
  document.getElementById('pmDynamicFields').innerHTML = '<div class="form-grid">' +
    questions.map(q => renderQuestionField(q, 'pm', existingData[q.key] || '')).join('') +
    '</div>';
}

function injectObjFieldsInModal(existingData) {
  const c = getCollab(currentCollabId);
  const activeObjs = (c.objectifs||[]).filter(o => o.statut === 'en-cours');
  const section = document.getElementById('pmObjSection');
  const fields = document.getElementById('pmObjFields');
  if (!activeObjs.length) { section.style.display='none'; return; }
  section.style.display='block';
  const objData = (existingData||{}).objectifs||{};
  fields.innerHTML = activeObjs.map((o,i) => `
    <div style="margin-bottom:14px;background:var(--offwhite);border-radius:10px;padding:12px;">
      <div style="font-size:0.8rem;font-weight:700;color:var(--navy);margin-bottom:8px;">Objectif ${i+1} — ${o.titre}</div>
      <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start;">
        <textarea id="pmObj_comment_${o.id}" placeholder="Commentaire sur cet objectif..." style="min-height:50px;border:1.5px solid var(--lavender);border-radius:8px;padding:8px;font-family:inherit;font-size:0.84rem;resize:vertical;">${(objData[o.id]||{}).commentaire||''}</textarea>
        <div style="text-align:center;">
          <div style="font-size:0.65rem;color:var(--muted);margin-bottom:4px;">Note</div>
          <select id="pmObj_note_${o.id}" style="border:1.5px solid var(--lavender);border-radius:8px;padding:6px 4px;font-size:1rem;text-align:center;">
            <option value="">-</option>
            ${[1,2,3,4,5].map(n=>`<option value="${n}" ${(objData[o.id]||{}).note==n?'selected':''}>${n}/5</option>`).join('')}
          </select>
        </div>
      </div>
    </div>`).join('');
}

async function saveManagerPoint() {
  const c = getCollab(currentCollabId);
  const cm = currentMois();
  const questions = getActiveManagerQuestions();
  const managerData = {};
  questions.forEach(q => {
    const el = document.getElementById('pm_' + q.key);
    managerData[q.key] = el ? (q.type === 'notation' ? el.value : el.value.trim()) : '';
  });
  // Validation champs obligatoires
  const emptyFields = questions.filter(q => !managerData[q.key]);
  if (emptyFields.length) { showToast('Veuillez remplir tous les champs avant d\'enregistrer.'); return; }
  const activeObjs = (c.objectifs||[]).filter(o=>o.statut==='en-cours');
  if (activeObjs.length) {
    managerData.objectifs = {};
    activeObjs.forEach(o => {
      const commentaire = document.getElementById('pmObj_comment_'+o.id)?.value.trim()||'';
      const note = document.getElementById('pmObj_note_'+o.id)?.value||'';
      if (commentaire||note) managerData.objectifs[o.id] = { commentaire, note: note ? parseInt(note) : null };
    });
  }
  if (!c.pointsSuivi) c.pointsSuivi = [];

  if (editingPointId) {
    const row = { manager_data: managerData };
    const { error } = await sb.from('points_suivi').update(row).eq('id', editingPointId);
    if (error) { showToast('Erreur: ' + error.message); return; }
    const idx = c.pointsSuivi.findIndex(p => p.id === editingPointId);
    c.pointsSuivi[idx].managerData = managerData;
  } else {
    const mois = cm;
    // Vérifier qu'il n'existe pas déjà un point pour ce mois
    const existing = (c.pointsSuivi || []).find(p => p.mois === mois);
    if (existing) { openEditPoint(existing.id); return; }
    const row = {
      collaborateur_id: currentCollabId,
      date: mois + '-01',
      type: 'mensuel',
      mois,
      manager_data: managerData,
      collab_data: {},
      contenu: 'Point mensuel ' + moisLabel(mois),
    };
    const { data, error } = await sb.from('points_suivi').insert(row).select().single();
    if (error) { showToast('Erreur: ' + error.message); return; }
    c.pointsSuivi.push({ id: data.id, date: row.date, type: 'mensuel', mois, managerData, collabData: {} });
  }
  closeModal('modalPoint');
  renderPoints();
  showToast('Point mensuel enregistré !');
}

async function deletePoint(id) {
  if (!await confirmModal('Supprimer ce point mensuel ?')) return;
  const { error } = await sb.from('points_suivi').delete().eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  const c = getCollab(currentCollabId);
  c.pointsSuivi = (c.pointsSuivi || []).filter(p => p.id !== id);
  renderPoints();
}

// ─────────────────────────────────────────
// OBJECTIFS
// ─────────────────────────────────────────
function renderObjectifs() {
  const c = getCollab(currentCollabId);
  if (!c) return;
  const objs = c.objectifs || [];

  if (!objs.length) {
    document.getElementById('objList').innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><p>Aucun objectif défini</p><button class="btn btn-primary" onclick="openAddObj()">+ Définir le premier</button></div>`;
    return;
  }

  document.getElementById('objList').innerHTML = objs.map((o,i) => {
    const pct = o.progression || 0;
    const barColor = BAR_COLORS[o.statut] || 'var(--lavender)';
    return `
    <div class="obj-card">
      <div class="obj-header">
        <div style="display:flex;flex-direction:column;gap:2px;margin-right:6px;">
          <button class="btn btn-ghost btn-sm" style="padding:1px 6px;line-height:1;" onclick="moveObj('${o.id}',-1)" ${i===0?'disabled':''}>▲</button>
          <button class="btn btn-ghost btn-sm" style="padding:1px 6px;line-height:1;" onclick="moveObj('${o.id}',1)" ${i===objs.length-1?'disabled':''}>▼</button>
        </div>
        <span class="obj-num" style="background:var(--pink);color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;margin-right:8px;">${i+1}</span>
        <span class="obj-titre" style="flex:1;">${o.titre}</span>
        <span class="badge ${STATUS_COLORS[o.statut]||'badge-gray'}">${STATUS_LABELS[o.statut]||o.statut}</span>
        ${o.recurrence ? `<span class="badge badge-blue" style="font-size:0.6rem;">🔄 ${o.recurrence === 'hebdo' ? 'Hebdo' : 'Mensuel'}</span>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="openEditObj('${o.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteObj('${o.id}')">🗑️</button>
      </div>
      ${o.description ? `<div class="obj-desc">${o.description}</div>` : ''}
      <div style="margin:8px 0;">
        <div style="display:flex;justify-content:space-between;font-size:0.7rem;font-weight:700;color:var(--muted);margin-bottom:4px;">
          <span>Progression</span><span>${pct}%</span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%;background:${barColor};"></div></div>
      </div>
      <div class="obj-footer">
        <span>📅 Du ${fmtDate(o.dateDebut)} au ${fmtDate(o.dateFin)}</span>
      </div>
    </div>`;
  }).join('');
}

async function moveObj(id, direction) {
  const c = getCollab(currentCollabId);
  const objs = c.objectifs;
  const idx = objs.findIndex(o => o.id === id);
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= objs.length) return;
  [objs[idx], objs[newIdx]] = [objs[newIdx], objs[idx]];
  c.onboarding.objOrder = objs.map(o => o.id);
  const { error } = await sb.from('collaborateurs').update({ onboarding: c.onboarding }).eq('id', c.id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  renderObjectifs();
}

function openAddObj() {
  const c = getCollab(currentCollabId);
  const max = SETTINGS.maxObjectifs || 10;
  if ((c.objectifs||[]).length >= max) { showToast(`Maximum ${max} objectifs par collaborateur.`); return; }
  editingObjId = null;
  document.getElementById('modalObjTitle').textContent = 'Nouvel objectif';
  document.getElementById('oTitre').value = '';
  document.getElementById('oDesc').value = '';
  document.getElementById('oDateDebut').value = '';
  document.getElementById('oDateFin').value = '';
  document.getElementById('oStatut').value = 'en-cours';
  document.getElementById('oProgression').value = 0;
  document.getElementById('oProgressionVal').textContent = '0%';
  document.getElementById('oRecurrence').value = '';
  const count = (c.objectifs||[]).length;
  document.getElementById('objCountInfo').textContent = `Objectif ${count+1}/${max}`;
  openModal('modalObj');
}

function openEditObj(id) {
  const c = getCollab(currentCollabId);
  const o = (c.objectifs || []).find(x => x.id === id);
  if (!o) return;
  editingObjId = id;
  document.getElementById('modalObjTitle').textContent = 'Modifier l\'objectif';
  document.getElementById('oTitre').value = o.titre;
  document.getElementById('oDesc').value = o.description || '';
  document.getElementById('oDateDebut').value = o.dateDebut || '';
  document.getElementById('oDateFin').value = o.dateFin || '';
  document.getElementById('oStatut').value = o.statut || 'en-cours';
  document.getElementById('oProgression').value = o.progression || 0;
  document.getElementById('oProgressionVal').textContent = (o.progression||0)+'%';
  document.getElementById('oRecurrence').value = o.recurrence || '';
  const max = SETTINGS.maxObjectifs || 10;
  document.getElementById('objCountInfo').textContent = `Objectif ${o.numero}/${max}`;
  openModal('modalObj');
}

async function saveObj() {
  const titre = document.getElementById('oTitre').value.trim();
  if (!titre) { showToast('Veuillez renseigner le titre de l\'objectif.'); return; }
  const c = getCollab(currentCollabId);
  if (!c.objectifs) c.objectifs = [];
  const progression = parseInt(document.getElementById('oProgression').value) || 0;
  const recurrence = document.getElementById('oRecurrence').value || null;
  const row = {
    collaborateur_id: currentCollabId, titre,
    description: document.getElementById('oDesc').value || null,
    date_debut: document.getElementById('oDateDebut').value || null,
    date_fin: document.getElementById('oDateFin').value || null,
    statut: document.getElementById('oStatut').value,
    progression, recurrence,
  };
  if (!row.date_debut || !row.date_fin) { showToast('Veuillez définir une date de début et de fin.'); return; }
  if (editingObjId) {
    // Build historique entry
    const existing = c.objectifs.find(o => o.id === editingObjId);
    const changes = [];
    if (existing) {
      if (existing.titre !== titre) changes.push({ champ: 'Titre', avant: existing.titre, apres: titre });
      if (existing.statut !== row.statut) changes.push({ champ: 'Statut', avant: STATUS_LABELS[existing.statut]||existing.statut, apres: STATUS_LABELS[row.statut]||row.statut });
      if (existing.progression !== progression) changes.push({ champ: 'Progression', avant: existing.progression+'%', apres: progression+'%' });
      if (existing.dateDebut !== (row.date_debut||'')) changes.push({ champ: 'Date début', avant: fmtDate(existing.dateDebut), apres: fmtDate(row.date_debut) });
      if (existing.dateFin !== (row.date_fin||'')) changes.push({ champ: 'Date fin', avant: fmtDate(existing.dateFin), apres: fmtDate(row.date_fin) });
      if ((existing.description||'') !== (row.description||'')) changes.push({ champ: 'Description', avant: '(modifié)', apres: '(modifié)' });
    }
    if (changes.length) {
      const hist = existing.historique || [];
      hist.push({ date: new Date().toISOString().split('T')[0], auteur: 'Admin', changes });
      row.historique = hist;
    }
    const { error } = await sb.from('objectifs').update(row).eq('id', editingObjId);
    if (error) { showToast('Erreur: ' + error.message); return; }
    const idx = c.objectifs.findIndex(o => o.id === editingObjId);
    c.objectifs[idx] = { id: editingObjId, numero: existing.numero, titre, description: row.description || '', dateDebut: row.date_debut||'', dateFin: row.date_fin||'', statut: row.statut, progression, recurrence: recurrence||'', historique: row.historique || existing.historique || [] };
  } else {
    row.historique = [{ date: new Date().toISOString().split('T')[0], auteur: 'Admin', changes: [{ champ: 'Création', avant: '', apres: titre }] }];
    const { data, error } = await sb.from('objectifs').insert(row).select().single();
    if (error) { showToast('Erreur: ' + error.message); return; }
    c.objectifs.push({ id: data.id, numero: c.objectifs.length+1, titre, description: row.description || '', dateDebut: row.date_debut||'', dateFin: row.date_fin||'', statut: row.statut, progression, recurrence: recurrence||'', historique: row.historique });
  }
  closeModal('modalObj');
  renderObjectifs();
  showToast('Objectif enregistré !');
}

async function deleteObj(id) {
  if (!await confirmModal('Supprimer cet objectif ?')) return;
  const { error } = await sb.from('objectifs').delete().eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  const c = getCollab(currentCollabId);
  c.objectifs = (c.objectifs || []).filter(o => o.id !== id);
  renderObjectifs();
}

// ─────────────────────────────────────────
// COLLABORATEUR CRUD
// ─────────────────────────────────────────
// ─────────────────────────────────────────
// PARAMÈTRES (équipes & bureaux)
// ─────────────────────────────────────────
function renderEquipeCheckboxes(selected) {
  const equipes = SETTINGS.equipes || [];
  document.getElementById('fEquipeCheckboxes').innerHTML = equipes.map(eq => `
    <label style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;border:1.5px solid var(--lavender);cursor:pointer;font-size:0.82rem;background:white;">
      <input type="checkbox" value="${escHTML(eq)}" ${selected.includes(eq)?'checked':''} style="accent-color:var(--pink);width:16px;height:16px;" />
      ${escHTML(eq)}
    </label>`).join('');
}

function populateSettingSelect(selectId, key, selected) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const items = SETTINGS[key] || [];
  sel.innerHTML = `<option value="">— Choisir —</option>` +
    items.map(v => `<option value="${v}" ${v === selected ? 'selected' : ''}>${v}</option>`).join('');
}

const SETTINGS_CONFIG = [
  { key: 'equipes',    label: 'Équipes' },
  { key: 'bureaux',    label: 'Bureaux' },
  { key: 'contrats',   label: 'Types de contrat' },
  { key: 'typePostes', label: 'Types de poste' },
];

function renderBoSettings() {
  SETTINGS_CONFIG.forEach(({ key }) => {
    const el = document.getElementById('settingsList_' + key);
    if (!el) return;
    const items = SETTINGS[key] || [];
    el.innerHTML = items.length
      ? items.map(v => {
          const used = isSettingValueUsed(key, v);
          return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border:1.5px solid var(--lavender);border-radius:10px;margin-bottom:8px;background:white;">
            <span style="font-weight:600;color:var(--navy);">${escHTML(v)}</span>
            <div style="display:flex;gap:4px;">
              <button class="btn btn-ghost btn-sm" style="padding:4px 8px;" onclick="renameSettingItem('${key}','${encodeURIComponent(v)}')">✏️</button>
              ${used ? `<span title="Utilisé par au moins un collaborateur" style="color:var(--muted);font-size:0.72rem;padding:4px 8px;cursor:help;">🔒</span>` : `<button class="btn btn-danger btn-sm" style="padding:4px 8px;" onclick="removeSettingItem('${key}','${encodeURIComponent(v)}')">✕</button>`}
            </div>
          </div>`;
        }).join('')
      : `<p style="color:var(--muted);font-size:0.85rem;font-style:italic;">Aucun élément.</p>`;
  });
  renderQuestionsList();

  // Populate team objectives equipe select
  const teamObjSel = document.getElementById('teamObjEquipe');
  const curTeam = teamObjSel.value;
  const equipes = SETTINGS.equipes || [];
  teamObjSel.innerHTML = '<option value="">— Choisir une équipe —</option>' +
    equipes.map(e => `<option value="${escHTML(e)}" ${e === curTeam ? 'selected' : ''}>${escHTML(e)}</option>`).join('');
  renderTeamObjectifs();

  // Toggle QCM options fields
  document.getElementById('newQManagerType').onchange = function() {
    document.getElementById('newQManagerOptions').style.display = this.value === 'qcm' ? 'block' : 'none';
  };
  document.getElementById('newQCollabType').onchange = function() {
    document.getElementById('newQCollabOptions').style.display = this.value === 'qcm' ? 'block' : 'none';
  };
}

// ── QUESTIONS CONFIGURABLES ──
const TYPE_LABELS = { texte: 'Texte', notation: 'Notation /5', qcm: 'QCM' };
const TYPE_BADGES = { texte: 'badge-blue', notation: 'badge-orange', qcm: 'badge-green' };

function getQuestions(side) {
  return SETTINGS['questions_' + side] || [];
}

function renderQuestionsList() {
  ['manager', 'collab'].forEach(side => {
    const el = document.getElementById('questions' + (side === 'manager' ? 'Manager' : 'Collab') + 'List');
    const questions = getQuestions(side);
    if (!questions.length) {
      el.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;font-style:italic;">Questions par défaut utilisées.</p>';
      return;
    }
    el.innerHTML = questions.map((q, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid var(--lavender);border-radius:10px;margin-bottom:8px;background:white;">
        <div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0;">
          <button class="btn btn-ghost btn-sm" style="padding:1px 6px;line-height:1;" onclick="moveQuestion('${side}',${i},-1)" ${i===0?'disabled':''}>▲</button>
          <button class="btn btn-ghost btn-sm" style="padding:1px 6px;line-height:1;" onclick="moveQuestion('${side}',${i},1)" ${i===questions.length-1?'disabled':''}>▼</button>
        </div>
        <div style="flex:1;">
          <div style="font-weight:600;color:var(--navy);font-size:0.88rem;">${escHTML(q.label)}</div>
          ${q.type === 'qcm' && q.options ? `<div style="font-size:0.72rem;color:var(--muted);margin-top:2px;">Options : ${q.options.map(o => escHTML(o)).join(', ')}</div>` : ''}
        </div>
        <span class="badge ${TYPE_BADGES[q.type]||'badge-gray'}">${TYPE_LABELS[q.type]||q.type}</span>
        <button class="btn btn-danger btn-sm" onclick="removeQuestion('${side}',${i})">✕</button>
      </div>`).join('');
  });
}

async function addQuestion(side) {
  const inputId = side === 'manager' ? 'newQManager' : 'newQCollab';
  const typeId = side === 'manager' ? 'newQManagerType' : 'newQCollabType';
  const optsId = side === 'manager' ? 'newQManagerOpts' : 'newQCollabOpts';
  const label = document.getElementById(inputId).value.trim();
  const type = document.getElementById(typeId).value;
  if (!label) { showToast('Veuillez saisir une question.'); return; }
  const question = { label, type };
  if (type === 'qcm') {
    const optsRaw = document.getElementById(optsId).value.trim();
    if (!optsRaw) { showToast('Veuillez saisir les options du QCM.'); return; }
    question.options = optsRaw.split(',').map(o => o.trim()).filter(Boolean);
  }
  const key = 'questions_' + side;
  const list = [...(SETTINGS[key] || []), question];
  await saveSettingKey(key, list);
  SETTINGS[key] = list;
  document.getElementById(inputId).value = '';
  document.getElementById(optsId).value = '';
  renderQuestionsList();
  showToast('Question ajoutée !');
}

async function removeQuestion(side, index) {
  if (!await confirmModal('Supprimer cette question ?')) return;
  const key = 'questions_' + side;
  const list = [...(SETTINGS[key] || [])];
  list.splice(index, 1);
  await saveSettingKey(key, list);
  SETTINGS[key] = list;
  renderQuestionsList();
}

async function moveQuestion(side, index, direction) {
  const key = 'questions_' + side;
  const list = [...(SETTINGS[key] || [])];
  const newIdx = index + direction;
  if (newIdx < 0 || newIdx >= list.length) return;
  [list[index], list[newIdx]] = [list[newIdx], list[index]];
  await saveSettingKey(key, list);
  SETTINGS[key] = list;
  renderQuestionsList();
}

async function saveSettingKey(key, value) {
  const { error } = await sb.from('settings').upsert({ key, value }, { onConflict: 'key' });
  if (error) showToast('Erreur settings: ' + error.message);
}

// ── BO: OBJECTIFS (vue admin) ──
let boObjTab = 'individuel';
let boObjCollabId = null;

function switchBoObjTab(tab) {
  boObjTab = tab;
  document.getElementById('boObjTabIndiv').style.cssText = tab === 'individuel' ? 'flex:1;padding:10px 16px;border-radius:10px;border:none;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer;background:white;color:var(--navy);box-shadow:0 2px 8px rgba(5,5,109,0.1);' : 'flex:1;padding:10px 16px;border-radius:10px;border:none;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer;background:transparent;color:var(--muted);';
  document.getElementById('boObjTabEquipe').style.cssText = tab === 'equipe' ? 'flex:1;padding:10px 16px;border-radius:10px;border:none;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer;background:white;color:var(--navy);box-shadow:0 2px 8px rgba(5,5,109,0.1);' : 'flex:1;padding:10px 16px;border-radius:10px;border:none;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer;background:transparent;color:var(--muted);';
  renderBoObjectifs();
}

function renderBoObjectifs() {
  const el = document.getElementById('boObjContent');
  let html = '';

  // Demandes en attente
  const requests = DB.objRequests || [];
  if (requests.length) {
    html += `<div style="background:white;border-radius:var(--radius-lg);padding:20px 24px;box-shadow:var(--shadow-md);margin-bottom:24px;border-left:4px solid var(--orange);">
      <h3 style="font-size:0.85rem;font-weight:700;color:var(--navy);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.05em;">📋 Demandes en attente (${requests.length})</h3>
      ${requests.map(r => {
        const collab = getCollab(r.collaborateurId);
        const manager = getCollab(r.managerId);
        const typeLabel = { modifier: 'Modifier', creer: 'Créer', supprimer: 'Supprimer' }[r.type] || r.type;
        const d = r.data || {};
        return `
        <div style="border:1.5px solid var(--lavender);border-radius:var(--radius-md);padding:16px;margin-bottom:10px;background:var(--offwhite);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
            <div>
              <div style="font-weight:700;color:var(--navy);font-size:0.9rem;">${typeLabel} : ${escHTML(d.titre || '—')}</div>
              <div style="font-size:0.78rem;color:var(--muted);margin-top:4px;">
                Pour <strong>${collab ? collab.prenom + ' ' + collab.nom : '—'}</strong> ·
                Demandé par <strong>${manager ? manager.prenom + ' ' + manager.nom : '—'}</strong>
              </div>
              ${r.motif ? `<div style="font-size:0.78rem;color:var(--muted);margin-top:4px;font-style:italic;">💬 ${escHTML(r.motif)}</div>` : ''}
            </div>
            <span class="badge badge-orange">${typeLabel}</span>
          </div>
          ${d.description ? `<div style="font-size:0.82rem;color:var(--navy);margin-bottom:8px;">${escHTML(d.description)}</div>` : ''}
          <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:0.78rem;color:var(--muted);margin-bottom:12px;">
            ${d.statut ? `<span>Statut : <strong>${STATUS_LABELS[d.statut]||d.statut}</strong></span>` : ''}
            ${d.progression !== undefined ? `<span>Progression : <strong>${d.progression}%</strong></span>` : ''}
            ${d.dateDebut ? `<span>Du ${fmtDate(d.dateDebut)} au ${fmtDate(d.dateFin)}</span>` : ''}
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="approveObjRequest('${r.id}')" style="padding:8px 16px;border-radius:10px;border:none;background:var(--green);color:white;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer;">✓ Approuver</button>
            <button onclick="refuseObjRequest('${r.id}')" style="padding:8px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,#EF4444,#B91C1C);color:white;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer;">✕ Refuser</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  if (boObjTab === 'equipe') {
    html += renderBoObjEquipeHTML();
  } else {
    html += renderBoObjIndividuelHTML();
  }
  el.innerHTML = html;
}

function renderBoObjIndividuelHTML() {
  // Selector for collaborateur
  const collabs = DB.collaborateurs;
  let html = `<div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;">
    <select id="boObjCollabSelect" class="settings-input" style="flex:1;max-width:300px;padding:10px 14px;" onchange="boObjCollabId=this.value;renderBoObjectifs();">
      <option value="">— Choisir un collaborateur —</option>
      ${collabs.map(c => `<option value="${c.id}" ${c.id===boObjCollabId?'selected':''}>${c.prenom} ${c.nom} — ${c.poste}</option>`).join('')}
    </select>
    ${boObjCollabId ? `<button class="btn btn-primary btn-sm" onclick="openAddObjForCollab('${boObjCollabId}')">+ Nouvel objectif</button>` : ''}
  </div>`;

  if (!boObjCollabId) {
    // Show all collaborateurs with their objectives count
    html += `<div class="card"><table><thead><tr>
      <th>Collaborateur</th><th>Objectifs</th><th>En cours</th><th>Atteints</th><th>Actions</th>
    </tr></thead><tbody>
    ${collabs.map(c => {
      const objs = c.objectifs || [];
      const enCours = objs.filter(o => o.statut === 'en-cours').length;
      const atteints = objs.filter(o => o.statut === 'atteint').length;
      return `<tr>
        <td><strong>${c.prenom} ${c.nom}</strong></td>
        <td>${objs.length}</td>
        <td>${enCours}</td>
        <td>${atteints}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="boObjCollabId='${c.id}';renderBoObjectifs();">Voir</button></td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;
  } else {
    const c = getCollab(boObjCollabId);
    if (!c) return html;
    const objs = c.objectifs || [];
    html += `<div style="margin-bottom:12px;font-size:0.95rem;font-weight:700;color:var(--navy);">${c.prenom} ${c.nom} — ${objs.length} objectif${objs.length>1?'s':''}</div>`;
    if (!objs.length) {
      html += '<p style="color:var(--muted);font-style:italic;">Aucun objectif.</p>';
    } else {
      html += objs.map((o, i) => {
        const pct = o.progression || 0;
        const barColor = BAR_COLORS[o.statut] || 'var(--lavender)';
        return `<div class="obj-card">
          <div class="obj-header">
            <span style="background:var(--pink);color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;margin-right:8px;flex-shrink:0;">${i+1}</span>
            <span style="flex:1;font-weight:700;color:var(--navy);">${escHTML(o.titre)}</span>
            <span class="badge ${STATUS_COLORS[o.statut]||'badge-gray'}">${STATUS_LABELS[o.statut]||o.statut}</span>
            <button class="btn btn-ghost btn-sm" onclick="currentCollabId='${c.id}';openEditObj('${o.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="currentCollabId='${c.id}';deleteObj('${o.id}')">🗑️</button>
          </div>
          ${o.description ? `<div class="obj-desc">${escHTML(o.description)}</div>` : ''}
          <div style="margin:8px 0;">
            <div style="display:flex;justify-content:space-between;font-size:0.7rem;font-weight:700;color:var(--muted);margin-bottom:4px;"><span>Progression</span><span>${pct}%</span></div>
            <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%;background:${barColor};"></div></div>
          </div>
          <div class="obj-footer"><span>📅 Du ${fmtDate(o.dateDebut)} au ${fmtDate(o.dateFin)}</span></div>
        </div>`;
      }).join('');
    }
  }
  return html;
}

function openAddObjForCollab(collabId) {
  currentCollabId = collabId;
  openAddObj();
}

function renderBoObjEquipeHTML() {
  const equipes = SETTINGS.equipes || [];
  let html = `<div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;">
    <select id="boObjEquipeSelect" class="settings-input" style="flex:1;max-width:300px;padding:10px 14px;" onchange="renderBoObjectifs();">
      <option value="">— Choisir une équipe —</option>
      ${equipes.map(e => `<option value="${escHTML(e)}">${escHTML(e)}</option>`).join('')}
    </select>
  </div>`;

  const selEquipe = document.getElementById('boObjEquipeSelect')?.value || '';
  if (!selEquipe) {
    // Summary table of all teams
    html += `<div class="card"><table><thead><tr><th>Équipe</th><th>Objectifs</th><th>Actions</th></tr></thead><tbody>
    ${equipes.map(eq => {
      const objs = (SETTINGS['team_objectifs_' + eq] || []).map(normalizeTeamObj);
      return `<tr>
        <td><strong>${escHTML(eq)}</strong></td>
        <td>${objs.length}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="document.getElementById('boObjEquipeSelect').value='${escHTML(eq)}';renderBoObjectifs();">Voir</button></td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;
  } else {
    const objs = (SETTINGS['team_objectifs_' + selEquipe] || []).map(normalizeTeamObj);
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:0.95rem;font-weight:700;color:var(--navy);">Équipe ${escHTML(selEquipe)} — ${objs.length} objectif${objs.length>1?'s':''}</div>
      <button class="btn btn-primary btn-sm" onclick="document.getElementById('teamObjEquipe').value='${escHTML(selEquipe)}';navigate('bo-settings');">Gérer dans Paramètres</button>
    </div>`;
    if (!objs.length) {
      html += '<p style="color:var(--muted);font-style:italic;">Aucun objectif d\'équipe.</p>';
    } else {
      html += objs.map((o, i) => {
        const pct = o.progression || 0;
        return `<div class="obj-card" style="border-left:4px solid var(--blue);">
          <div class="obj-header">
            <span style="background:var(--blue);color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;margin-right:8px;flex-shrink:0;">${i+1}</span>
            <span style="flex:1;font-weight:700;color:var(--navy);">${escHTML(o.titre)}</span>
            <span class="badge badge-blue">Équipe</span>
          </div>
          <div style="margin:8px 0;">
            <div style="display:flex;justify-content:space-between;font-size:0.7rem;font-weight:700;color:var(--muted);margin-bottom:4px;"><span>Progression</span><span>${pct}%</span></div>
            <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%;background:linear-gradient(90deg,var(--skyblue),var(--blue));"></div></div>
          </div>
          ${o.dateDebut || o.dateFin ? `<div class="obj-footer"><span>📅 Du ${fmtDate(o.dateDebut)} au ${fmtDate(o.dateFin)}</span></div>` : ''}
        </div>`;
      }).join('');
    }
  }
  return html;
}

// ── OBJECTIFS D'ÉQUIPE (paramètres) ──
function normalizeTeamObj(o) {
  if (typeof o === 'string') return { titre: o, dateDebut: '', dateFin: '', progression: 0 };
  return { titre: o.titre||'', dateDebut: o.dateDebut||'', dateFin: o.dateFin||'', progression: o.progression||0 };
}

function renderTeamObjectifs() {
  const equipe = document.getElementById('teamObjEquipe').value;
  const form = document.getElementById('teamObjForm');
  const listEl = document.getElementById('teamObjList');
  if (!equipe) { form.style.display = 'none'; listEl.innerHTML = ''; return; }
  form.style.display = 'block';
  const objs = (SETTINGS['team_objectifs_' + equipe] || []).map(normalizeTeamObj);
  if (!objs.length) {
    listEl.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;font-style:italic;">Aucun objectif d\'équipe pour cette BU.</p>';
    return;
  }
  listEl.innerHTML = objs.map((o, i) => {
    const pct = o.progression || 0;
    const editing = teamObjEditingIdx === i;
    if (editing) {
      return `<div class="card" style="margin-bottom:8px;border:2px solid var(--pink);padding:16px;">
        <div class="form-grid">
          <div class="form-field full"><label>Titre</label><input id="teEditTitre" type="text" value="${escHTML(o.titre)}" /></div>
          <div class="form-field"><label>Date de début</label><input id="teEditDebut" type="date" value="${o.dateDebut}" /></div>
          <div class="form-field"><label>Date de fin</label><input id="teEditFin" type="date" value="${o.dateFin}" /></div>
          <div class="form-field full">
            <label>Progression (${pct}%)</label>
            <input id="teEditProg" type="range" min="0" max="100" value="${pct}" oninput="document.getElementById('teEditProgVal').textContent=this.value+'%'" />
            <span id="teEditProgVal" style="font-weight:700;color:var(--navy);">${pct}%</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:8px;">
          <button class="btn btn-ghost btn-sm" onclick="teamObjEditingIdx=null;renderTeamObjectifs();">Annuler</button>
          <button class="btn btn-primary btn-sm" onclick="saveTeamObjEdit('${escHTML(equipe)}',${i})">Enregistrer</button>
        </div>
      </div>`;
    }
    return `<div class="obj-card" style="border-left:4px solid var(--blue);">
      <div class="obj-header">
        <span style="background:var(--blue);color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;flex-shrink:0;">${i+1}</span>
        <span style="flex:1;font-weight:700;color:var(--navy);font-size:0.88rem;">${escHTML(o.titre)}</span>
        <button class="btn btn-ghost btn-sm" onclick="teamObjEditingIdx=${i};renderTeamObjectifs();">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="removeTeamObjectif('${escHTML(equipe)}',${i})">✕</button>
      </div>
      <div style="margin:8px 0;">
        <div style="display:flex;justify-content:space-between;font-size:0.7rem;font-weight:700;color:var(--muted);margin-bottom:4px;">
          <span>Progression</span><span>${pct}%</span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%;background:linear-gradient(90deg,var(--skyblue),var(--blue));"></div></div>
      </div>
      ${o.dateDebut || o.dateFin ? `<div class="obj-footer"><span>📅 Du ${fmtDate(o.dateDebut)} au ${fmtDate(o.dateFin)}</span></div>` : ''}
    </div>`;
  }).join('');
}

let teamObjEditingIdx = null;

async function addTeamObjectif() {
  const equipe = document.getElementById('teamObjEquipe').value;
  const titre = document.getElementById('newTeamObjTitre').value.trim();
  const dateDebut = document.getElementById('newTeamObjDebut').value;
  const dateFin = document.getElementById('newTeamObjFin').value;
  if (!titre) { showToast('Veuillez saisir un titre.'); return; }
  const key = 'team_objectifs_' + equipe;
  const list = [...(SETTINGS[key] || []).map(normalizeTeamObj), { titre, dateDebut, dateFin, progression: 0 }];
  await saveSettingKey(key, list);
  SETTINGS[key] = list;
  document.getElementById('newTeamObjTitre').value = '';
  document.getElementById('newTeamObjDebut').value = '';
  document.getElementById('newTeamObjFin').value = '';
  renderTeamObjectifs();
  showToast('Objectif d\'équipe ajouté !');
}

async function removeTeamObjectif(equipe, index) {
  if (!await confirmModal('Supprimer cet objectif d\'équipe ?')) return;
  const key = 'team_objectifs_' + equipe;
  const list = [...(SETTINGS[key] || []).map(normalizeTeamObj)];
  list.splice(index, 1);
  await saveSettingKey(key, list);
  SETTINGS[key] = list;
  renderTeamObjectifs();
}

async function saveTeamObjEdit(equipe, index) {
  const key = 'team_objectifs_' + equipe;
  const list = [...(SETTINGS[key] || []).map(normalizeTeamObj)];
  list[index] = {
    titre: document.getElementById('teEditTitre').value.trim(),
    dateDebut: document.getElementById('teEditDebut').value,
    dateFin: document.getElementById('teEditFin').value,
    progression: parseInt(document.getElementById('teEditProg').value) || 0,
  };
  if (!list[index].titre) { showToast('Le titre est obligatoire.'); return; }
  await saveSettingKey(key, list);
  SETTINGS[key] = list;
  teamObjEditingIdx = null;
  renderTeamObjectifs();
  showToast('Objectif modifié !');
}

async function addSettingItem(key) {
  const input = document.getElementById('newVal_' + key);
  const val = input.value.trim();
  if (!val) return;
  if ((SETTINGS[key] || []).includes(val)) { showToast('Déjà dans la liste.'); return; }
  const newList = [...(SETTINGS[key] || []), val];
  const { error } = await sb.from('settings').update({ value: newList }).eq('key', key);
  if (error) { showToast('Erreur : ' + error.message); return; }
  SETTINGS[key] = newList;
  input.value = '';
  renderBoSettings();
  showToast(`"${val}" ajouté !`);
}

function isSettingValueUsed(key, val) {
  if (key === 'equipes') return DB.collaborateurs.some(c => c.equipes.includes(val));
  const fieldMap = { bureaux: 'bureau', contrats: 'contrat', typePostes: 'typePoste' };
  const field = fieldMap[key];
  if (!field) return false;
  return DB.collaborateurs.some(c => c[field] === val);
}

async function renameSettingItem(key, encodedVal) {
  const oldVal = decodeURIComponent(encodedVal);
  const newVal = prompt(`Renommer "${oldVal}" en :`, oldVal);
  if (!newVal || !newVal.trim() || newVal.trim() === oldVal) return;
  const trimmed = newVal.trim();
  // Update setting list
  const newList = (SETTINGS[key] || []).map(v => v === oldVal ? trimmed : v);
  const { error } = await sb.from('settings').update({ value: newList }).eq('key', key);
  if (error) { showToast('Erreur : ' + error.message); return; }
  SETTINGS[key] = newList;
  // Update all collaborateurs using the old value
  if (key === 'equipes') {
    // Equipes is comma-separated — update each collab that contains the old value
    const toUpdate = DB.collaborateurs.filter(c => c.equipes.includes(oldVal));
    for (const c of toUpdate) {
      const newEquipes = c.equipes.map(e => e === oldVal ? trimmed : e);
      const newEquipeStr = newEquipes.join(',');
      await sb.from('collaborateurs').update({ equipe: newEquipeStr }).eq('id', c.id);
      c.equipe = newEquipeStr;
      c.equipes = newEquipes;
    }
  } else {
    const fieldMap = { bureaux: 'bureau', contrats: 'contrat', typePostes: 'type_poste' };
    const dbField = fieldMap[key];
    if (dbField) {
      await sb.from('collaborateurs').update({ [dbField]: trimmed }).eq(dbField, oldVal);
      const jsField = { bureaux: 'bureau', contrats: 'contrat', typePostes: 'typePoste' }[key];
      DB.collaborateurs.forEach(c => { if (c[jsField] === oldVal) c[jsField] = trimmed; });
    }
  }
  renderBoSettings();
  showToast(`"${oldVal}" renommé en "${trimmed}"`);
}

async function removeSettingItem(key, encodedVal) {
  const val = decodeURIComponent(encodedVal);
  if (!await confirmModal(`Supprimer "${escHTML(val)}" de la liste ?`)) return;
  const newList = (SETTINGS[key] || []).filter(v => v !== val);
  const { error } = await sb.from('settings').update({ value: newList }).eq('key', key);
  if (error) { showToast('Erreur : ' + error.message); return; }
  SETTINGS[key] = newList;
  renderBoSettings();
  showToast(`"${val}" supprimé.`);
}

function populateManagerSelect(selectId, selected, excludeId) {
  const sel = document.getElementById(selectId);
  const defaultLabel = sel.options.length ? sel.options[0].textContent : '— Aucun manager —';
  sel.innerHTML = `<option value="">${defaultLabel}</option>`;
  DB.collaborateurs.filter(c => c.id !== excludeId).forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.prenom + ' ' + c.nom + ' — ' + c.poste;
    if (c.id === selected) o.selected = true;
    sel.appendChild(o);
  });
}

function openAddCollab() {
  editingCollabId = null;
  document.getElementById('modalCollabTitle').textContent = 'Ajouter un collaborateur';
  ['fPrenom','fNom','fPoste','fEmail','fTel','fNotes','fGoogleDrive'].forEach(id => document.getElementById(id).value = '');
  populateSettingSelect('fBureau',    'bureaux',    '');
  renderEquipeCheckboxes([]);
  populateSettingSelect('fContrat',   'contrats',   '');
  populateSettingSelect('fTypePoste', 'typePostes', '');
  document.getElementById('fDateEntree').value = '';
  document.getElementById('fDateFinEssai').value = '';
  document.getElementById('fSoldeConges').value = '0';
  document.getElementById('fAcquisitionConges').value = '2.08';
  populateManagerSelect('fManager', null);
  populateManagerSelect('fValideurConges', null);
  openModal('modalCollab');
}

function openEditCollab(id) {
  const c = getCollab(id);
  if (!c) return;
  editingCollabId = id;
  document.getElementById('modalCollabTitle').textContent = 'Modifier le collaborateur';
  document.getElementById('fPrenom').value = c.prenom;
  document.getElementById('fNom').value = c.nom;
  document.getElementById('fPoste').value = c.poste;
  document.getElementById('fEmail').value = c.email || '';
  document.getElementById('fTel').value = c.telephone || '';
  document.getElementById('fDateEntree').value = c.dateEntree || '';
  document.getElementById('fDateFinEssai').value = c.dateFinEssai || '';
  document.getElementById('fSoldeConges').value = c.soldeConges ?? 0;
  document.getElementById('fAcquisitionConges').value = c.acquisitionConges ?? 2.08;
  document.getElementById('fNotes').value = c.notes || '';
  document.getElementById('fGoogleDrive').value = c.googleDrive || '';
  populateManagerSelect('fValideurConges', c.valideurCongesId, id);
  populateSettingSelect('fBureau',    'bureaux',    c.bureau    || '');
  renderEquipeCheckboxes(c.equipes || []);
  populateSettingSelect('fContrat',   'contrats',   c.contrat   || '');
  populateSettingSelect('fTypePoste', 'typePostes', c.typePoste || '');
  populateManagerSelect('fManager', c.managerId, id);
  openModal('modalCollab');
}

async function saveCollab() {
  const prenom = document.getElementById('fPrenom').value.trim();
  const nom = document.getElementById('fNom').value.trim();
  const poste = document.getElementById('fPoste').value.trim();
  if (!prenom || !nom || !poste) { showToast('Prénom, nom et poste sont obligatoires.'); return; }

  const row = {
    prenom, nom, poste,
    email: document.getElementById('fEmail').value || null,
    telephone: document.getElementById('fTel').value || null,
    date_entree: document.getElementById('fDateEntree').value || null,
    date_fin_essai: document.getElementById('fDateFinEssai').value || null,
    solde_conges: parseFloat(document.getElementById('fSoldeConges').value) || 0,
    acquisition_conges: parseFloat(document.getElementById('fAcquisitionConges').value) || 2.08,
    valideur_conges_id: document.getElementById('fValideurConges').value || null,
    google_drive: document.getElementById('fGoogleDrive').value || null,
    notes: document.getElementById('fNotes').value || null,
    manager_id: document.getElementById('fManager').value || null,
    bureau:     document.getElementById('fBureau').value    || null,
    equipe:     Array.from(document.querySelectorAll('#fEquipeCheckboxes input:checked')).map(cb => cb.value).join(',') || null,
    contrat:    document.getElementById('fContrat').value   || null,
    type_poste: document.getElementById('fTypePoste').value || null,
  };

  if (editingCollabId) {
    const { error } = await sb.from('collaborateurs').update(row).eq('id', editingCollabId);
    if (error) { showToast('Erreur: ' + error.message); return; }
    const c = getCollab(editingCollabId);
    Object.assign(c, { prenom, nom, poste, email: row.email || '', telephone: row.telephone || '', dateEntree: row.date_entree || '', dateFinEssai: row.date_fin_essai || '', soldeConges: row.solde_conges || 0, acquisitionConges: row.acquisition_conges || 2.08, valideurCongesId: row.valideur_conges_id || null, googleDrive: row.google_drive || '', notes: row.notes || '', managerId: row.manager_id || null, bureau: row.bureau || '', equipe: row.equipe || '', equipes: parseEquipes(row.equipe), contrat: row.contrat || '', typePoste: row.type_poste || '' });
  } else {
    row.onboarding = defaultOnboarding();
    const { data, error } = await sb.from('collaborateurs').insert(row).select().single();
    if (error) { showToast('Erreur: ' + error.message); return; }
    DB.collaborateurs.push(fromRow(data));
  }
  closeModal('modalCollab');
  if (currentView === 'dashboard') renderDashboard();
  else if (currentView === 'bo-people') renderBoPeople();
  else if (currentView === 'collab') renderCollab();
  showToast('Collaborateur enregistré !');
}

// ─────────────────────────────────────────
// BO: PEOPLE TABLE
// ─────────────────────────────────────────
let peopleSortKey = null;
let peopleSortAsc = true;

function sortPeople(key) {
  if (peopleSortKey === key) { peopleSortAsc = !peopleSortAsc; }
  else { peopleSortKey = key; peopleSortAsc = true; }
  renderBoPeople();
}

function renderBoPeople() {
  const tbody = document.getElementById('peopleTable');
  if (!DB.collaborateurs.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px;">Aucun collaborateur — cliquez sur "+ Ajouter"</td></tr>';
    return;
  }

  const searchEl = document.getElementById('peopleSearch');
  const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
  let list = DB.collaborateurs.filter(c =>
    !q || (c.prenom + ' ' + c.nom + ' ' + c.poste + ' ' + c.email).toLowerCase().includes(q)
  );
  if (peopleSortKey) {
    list.sort((a, b) => {
      let va, vb;
      if (peopleSortKey === 'nom') { va = (a.nom + ' ' + a.prenom).toLowerCase(); vb = (b.nom + ' ' + b.prenom).toLowerCase(); }
      else if (peopleSortKey === 'poste') { va = (a.poste||'').toLowerCase(); vb = (b.poste||'').toLowerCase(); }
      else if (peopleSortKey === 'equipe') { va = (a.equipes[0]||'zzz').toLowerCase(); vb = (b.equipes[0]||'zzz').toLowerCase(); }
      else if (peopleSortKey === 'manager') { va = a.managerId ? getManagerName(a.managerId).toLowerCase() : 'zzz'; vb = b.managerId ? getManagerName(b.managerId).toLowerCase() : 'zzz'; }
      else if (peopleSortKey === 'dateEntree') { va = a.dateEntree || '9999'; vb = b.dateEntree || '9999'; }
      if (va < vb) return peopleSortAsc ? -1 : 1;
      if (va > vb) return peopleSortAsc ? 1 : -1;
      return 0;
    });
    ['nom','poste','equipe','manager','dateEntree'].forEach(k => {
      const icon = document.getElementById('sortIcon_' + k);
      if (icon) icon.textContent = k === peopleSortKey ? (peopleSortAsc ? '▲' : '▼') : '↕';
    });
  }
  tbody.innerHTML = list.map(c => {
    const score = onboardingScore(c);
    const badge = score.pct === 100 ? '<span class="badge badge-green">Complet</span>' : `<span class="badge badge-orange">${score.done}/${score.total}</span>`;
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            ${avatarHTML(c, 32)}
            <div>
              <div style="font-weight:700;">${c.prenom} ${c.nom}</div>
              <div style="font-size:0.72rem;color:var(--muted);">${c.email || ''}</div>
            </div>
          </div>
        </td>
        <td>${c.poste}</td>
        <td>${c.equipes.length ? c.equipes.map(e=>escHTML(e)).join(', ') : '<span style="color:var(--muted)">—</span>'}</td>
        <td>${c.managerId ? getManagerName(c.managerId) : '<span style="color:var(--muted)">—</span>'}</td>
        <td>${fmtDate(c.dateEntree)}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="navigate('collab','${c.id}')">Voir</button>
            <button class="btn btn-ghost btn-sm" onclick="openEditCollab('${c.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteCollab('${c.id}')">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function deleteCollab(id) {
  const c = getCollab(id);
  if (!c) return;
  if (!await confirmModal(`Supprimer ${escHTML(c.prenom)} ${escHTML(c.nom)} ? Cette action est irréversible.`)) return;
  const { error } = await sb.from('collaborateurs').delete().eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  DB.collaborateurs = DB.collaborateurs.filter(x => x.id !== id);
  DB.collaborateurs.forEach(x => { if (x.managerId === id) x.managerId = null; });
  renderBoPeople();
}

// ─────────────────────────────────────────
// BO: ORGANIGRAMME
// ─────────────────────────────────────────
function renderBoManagers() {
  renderOrgChart();
  document.getElementById('relCollabSearch').value = '';
  document.getElementById('relCollab').value = '';
  document.getElementById('relManagerSearch').value = '';
  document.getElementById('relManager').value = '';
}

function filterRelSearch(searchId, listId, hiddenId) {
  const q = document.getElementById(searchId).value.trim().toLowerCase();
  const list = document.getElementById(listId);
  const hidden = document.getElementById(hiddenId);
  hidden.value = '';
  if (q.length < 3) { list.innerHTML = ''; return; }
  const matches = DB.collaborateurs.filter(c =>
    (c.prenom.toLowerCase().startsWith(q) || c.nom.toLowerCase().startsWith(q) || (c.prenom + ' ' + c.nom).toLowerCase().includes(q))
  );
  list.innerHTML = matches.map(c => `<option value="${c.prenom} ${c.nom}" data-id="${c.id}">${c.prenom} ${c.nom} — ${c.poste}</option>`).join('');
  const inputVal = document.getElementById(searchId).value;
  const match = matches.find(c => (c.prenom + ' ' + c.nom).toLowerCase() === inputVal.toLowerCase() || (c.prenom + ' ' + c.nom) === inputVal);
  if (match) hidden.value = match.id;
}

function filterRelCollab() { filterRelSearch('relCollabSearch', 'relCollabList', 'relCollab'); }
function filterRelManager() { filterRelSearch('relManagerSearch', 'relManagerList', 'relManager'); }

function renderOrgChart() {
  // Build children lookup map once → O(n) instead of O(n²) filtering per node
  const childrenMap = {};
  DB.collaborateurs.forEach(c => {
    if (c.managerId) {
      (childrenMap[c.managerId] = childrenMap[c.managerId] || []).push(c);
    }
  });
  function renderNode(c, depth) {
    const children = childrenMap[c.id] || [];
    return `
      <div style="margin-left:${depth * 22}px;${depth ? 'border-left:2px solid var(--lavender);padding-left:14px;' : ''}margin-top:8px;">
        <div class="tree-item" style="cursor:pointer;" onclick="navigate('collab','${c.id}')">
          ${avatarHTML(c, 32)}
          <div>
            <div class="tree-name">${c.prenom} ${c.nom}</div>
            <div class="tree-poste">${c.poste}</div>
          </div>
        </div>
        ${children.map(ch => renderNode(ch, depth + 1)).join('')}
      </div>`;
  }
  const roots = DB.collaborateurs.filter(c => !c.managerId);
  document.getElementById('orgChart').innerHTML = roots.length
    ? roots.map(r => renderNode(r, 0)).join('')
    : '<p style="color:var(--muted);font-size:0.85rem;">Aucun collaborateur sans manager</p>';
}

function resolveCollabId(searchId, hiddenId) {
  let id = document.getElementById(hiddenId).value;
  if (id) return id;
  const name = document.getElementById(searchId).value.trim().toLowerCase();
  const match = DB.collaborateurs.find(c => (c.prenom + ' ' + c.nom).toLowerCase() === name);
  if (match) { document.getElementById(hiddenId).value = match.id; return match.id; }
  return '';
}

async function saveRelation() {
  const collabId = resolveCollabId('relCollabSearch', 'relCollab');
  const managerId = resolveCollabId('relManagerSearch', 'relManager');
  if (!collabId) { showToast('Choisissez un collaborateur (tapez au moins 3 lettres).'); return; }
  if (collabId === managerId) { showToast('Un collaborateur ne peut pas être son propre manager.'); return; }
  const { error } = await sb.from('collaborateurs').update({ manager_id: managerId || null }).eq('id', collabId);
  if (error) { showToast('Erreur: ' + error.message); return; }
  getCollab(collabId).managerId = managerId || null;
  renderOrgChart();
  const alertEl = document.getElementById('relAlert');
  alertEl.classList.remove('hidden');
  setTimeout(() => alertEl.classList.add('hidden'), 3000);
}

// ─────────────────────────────────────────
// CONGÉS & ABSENCES
// ─────────────────────────────────────────
// ABS_TYPES, ABS_STATUTS, ABS_STATUT_BADGE sont dans utils.js

// countWorkDays est dans utils.js (exclut weekends + jours fériés FR)

function getSoldeConges(c) {
  const soldeInitial = c.soldeConges || 0;
  const acquisition = c.acquisitionConges || 2.08;
  // Mois écoulés depuis date d'entrée
  let moisAcquis = 0;
  if (c.dateEntree) {
    const entree = new Date(c.dateEntree);
    const now = new Date();
    moisAcquis = Math.max(0, (now.getFullYear() - entree.getFullYear()) * 12 + (now.getMonth() - entree.getMonth()));
  }
  const acquis = Math.round(moisAcquis * acquisition * 100) / 100;
  // Jours pris (absences approuvées de type congé payé ou RTT)
  const pris = (DB.absences || [])
    .filter(a => a.collaborateurId === c.id && a.statut === 'approuve' && a.type === 'conge')
    .reduce((sum, a) => sum + countWorkDays(a.dateDebut, a.dateFin), 0);
  const solde = Math.round((soldeInitial + acquis - pris) * 100) / 100;
  return { soldeInitial, acquisition, moisAcquis, acquis, pris, solde };
}

function getValideurName(c) {
  const valideurId = c.valideurCongesId || c.managerId;
  if (!valideurId) return 'Admin';
  const v = getCollab(valideurId);
  return v ? v.prenom + ' ' + v.nom : 'Admin';
}

function renderBoAbsences() {
  // Populate collab filter
  const collabSel = document.getElementById('absFilterCollab');
  const curVal = collabSel.value;
  collabSel.innerHTML = '<option value="">Tous les collaborateurs</option>' +
    DB.collaborateurs.map(c => `<option value="${c.id}" ${c.id===curVal?'selected':''}>${c.prenom} ${c.nom}</option>`).join('');

  const fStatut = document.getElementById('absFilterStatut').value;
  const fType = document.getElementById('absFilterType').value;
  const fCollab = document.getElementById('absFilterCollab').value;

  let absences = DB.absences || [];
  if (fStatut) absences = absences.filter(a => a.statut === fStatut);
  if (fType) absences = absences.filter(a => a.type === fType);
  if (fCollab) absences = absences.filter(a => a.collaborateurId === fCollab);

  const tbody = document.getElementById('absencesTable');
  if (!absences.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:32px;">Aucune absence enregistrée</td></tr>';
  } else {
    tbody.innerHTML = absences.map(a => {
      const c = getCollab(a.collaborateurId);
      const nom = c ? `${c.prenom} ${c.nom}` : '—';
      const valideur = c ? getValideurName(c) : '—';
      const jours = countWorkDays(a.dateDebut, a.dateFin);
      return `<tr>
        <td><strong>${nom}</strong></td>
        <td>${ABS_TYPES[a.type]||a.type}</td>
        <td>${fmtDate(a.dateDebut)}</td>
        <td>${fmtDate(a.dateFin)}</td>
        <td style="font-weight:700;">${jours}j</td>
        <td style="font-size:0.82rem;">${valideur}</td>
        <td>
          <span class="badge ${ABS_STATUT_BADGE[a.statut]||'badge-gray'}">${ABS_STATUTS[a.statut]||a.statut}</span>
          ${a.statut === 'refuse' && a.motifRefus ? `<div style="font-size:0.72rem;color:#881337;margin-top:4px;font-style:italic;">Motif : ${escHTML(a.motifRefus)}</div>` : ''}
        </td>
        <td>
          <div style="display:flex;gap:6px;">
            ${a.statut === 'en_attente' ? `
              <button class="btn btn-sm" style="background:var(--green);color:white;" onclick="updateAbsStatut('${a.id}','approuve')">✓ Approuver</button>
              <button class="btn btn-danger btn-sm" onclick="refuserAbsence('${a.id}')">✕ Refuser</button>
            ` : ''}
            <button class="btn btn-danger btn-sm" onclick="deleteAbsence('${a.id}')">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // Soldes table
  const soldesTbody = document.getElementById('soldesTable');
  soldesTbody.innerHTML = DB.collaborateurs.map(c => {
    const s = getSoldeConges(c);
    const soldeColor = s.solde <= 0 ? 'var(--red)' : s.solde <= 5 ? 'var(--orange)' : 'var(--green)';
    const valideur = getValideurName(c);
    const editing = soldeEditingId === c.id;
    if (editing) {
      return `<tr style="background:#FFF0F6;">
        <td><strong>${c.prenom} ${c.nom}</strong></td>
        <td>
          <select id="seValideur_${c.id}" style="width:100%;border:1.5px solid var(--pink);border-radius:6px;padding:4px 6px;font-family:inherit;font-size:0.78rem;">
            <option value="">Manager par défaut</option>
            ${DB.collaborateurs.filter(x=>x.id!==c.id).map(x=>`<option value="${x.id}" ${(c.valideurCongesId||'')=== x.id?'selected':''}>${x.prenom} ${x.nom}</option>`).join('')}
          </select>
        </td>
        <td><input id="seSolde_${c.id}" type="number" step="0.5" value="${s.soldeInitial}" style="width:60px;border:1.5px solid var(--pink);border-radius:6px;padding:4px 6px;font-family:inherit;font-size:0.82rem;text-align:center;" /></td>
        <td><input id="seAcq_${c.id}" type="number" step="0.1" value="${s.acquisition}" style="width:60px;border:1.5px solid var(--pink);border-radius:6px;padding:4px 6px;font-family:inherit;font-size:0.82rem;text-align:center;" /></td>
        <td>${s.acquis}j</td>
        <td>${s.pris}j</td>
        <td style="font-weight:700;color:${soldeColor};">${s.solde}j</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-sm" style="background:var(--green);color:white;padding:4px 10px;" onclick="saveSoldeEdit('${c.id}')">✓</button>
            <button class="btn btn-ghost btn-sm" style="padding:4px 10px;" onclick="cancelSoldeEdit()">✕</button>
          </div>
        </td>
      </tr>`;
    }
    return `<tr>
      <td><strong>${c.prenom} ${c.nom}</strong></td>
      <td style="font-size:0.82rem;">${valideur}</td>
      <td>${s.soldeInitial}j</td>
      <td>${s.acquisition}j/mois</td>
      <td>${s.acquis}j (${s.moisAcquis} mois)</td>
      <td>${s.pris}j</td>
      <td style="font-weight:700;color:${soldeColor};">${s.solde}j</td>
      <td><button class="btn btn-ghost btn-sm" style="padding:4px 10px;" onclick="startSoldeEdit('${c.id}')">✏️</button></td>
    </tr>`;
  }).join('');
}

let soldeEditingId = null;

function startSoldeEdit(id) {
  soldeEditingId = id;
  renderBoAbsences();
}

function cancelSoldeEdit() {
  soldeEditingId = null;
  renderBoAbsences();
}

async function saveSoldeEdit(id) {
  const solde = parseFloat(document.getElementById('seSolde_'+id).value) || 0;
  const acq = parseFloat(document.getElementById('seAcq_'+id).value) || 2.08;
  const valideur = document.getElementById('seValideur_'+id).value || null;

  const { error } = await sb.from('collaborateurs').update({
    solde_conges: solde,
    acquisition_conges: acq,
    valideur_conges_id: valideur
  }).eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }

  const c = getCollab(id);
  c.soldeConges = solde;
  c.acquisitionConges = acq;
  c.valideurCongesId = valideur;
  soldeEditingId = null;
  renderBoAbsences();
  showToast('Congés mis à jour ✓');
}

async function updateAbsStatut(id, statut) {
  const { error } = await sb.from('absences').update({ statut }).eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  const abs = (DB.absences||[]).find(a => a.id === id);
  if (abs) abs.statut = statut;
  renderBoAbsences();
  renderSidebar();
  showToast('Absence approuvée ✓');
}

function refuserAbsence(id) {
  const motif = prompt('Motif du refus (obligatoire) :');
  if (!motif || !motif.trim()) { showToast('Le motif de refus est obligatoire.'); return; }
  refuserAbsenceConfirm(id, motif.trim());
}

async function refuserAbsenceConfirm(id, motif) {
  const { error } = await sb.from('absences').update({ statut: 'refuse', motif_refus: motif }).eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  const abs = (DB.absences||[]).find(a => a.id === id);
  if (abs) { abs.statut = 'refuse'; abs.motifRefus = motif; }
  renderBoAbsences();
  renderSidebar();
  showToast('Absence refusée — motif enregistré.');
}

async function deleteAbsence(id) {
  if (!await confirmModal('Supprimer cette absence ?')) return;
  const { error } = await sb.from('absences').delete().eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  DB.absences = (DB.absences||[]).filter(a => a.id !== id);
  renderBoAbsences();
}

// ─────────────────────────────────────────
// ENTRETIENS ANNUELS
// ─────────────────────────────────────────
const ENTRETIEN_TYPES = { annuel: 'Entretien annuel', semestriel: 'Entretien semestriel', fin_pe: 'Fin de période d\'essai', professionnel: 'Entretien professionnel' };
const ENTRETIEN_FIELDS = ['bilan','pointsForts','axesAmelioration','souhaitsEvolution','formation','objectifsSuivants'];

function renderEntretiens() {
  const c = getCollab(currentCollabId);
  if (!c) return;
  const entretiens = (c.entretiens || []).sort((a,b) => (b.date||'') > (a.date||'') ? 1 : -1);

  if (!entretiens.length) {
    document.getElementById('entretiensList').innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><p>Aucun entretien formel enregistré.</p><button class="btn btn-primary" onclick="openAddEntretien()">+ Créer un entretien</button></div>`;
    return;
  }

  document.getElementById('entretiensList').innerHTML = entretiens.map((e, i) => {
    const md = e.managerData || {};
    const typeLabel = ENTRETIEN_TYPES[e.type] || e.type;
    const isFirst = i === 0;
    const labels = { bilan: 'Bilan global', pointsForts: 'Points forts', axesAmelioration: 'Axes d\'amélioration', souhaitsEvolution: 'Souhaits d\'évolution', formation: 'Plan de formation', objectifsSuivants: 'Objectifs prochaine période' };

    return `
    <div style="margin-bottom:10px;border-radius:14px;border:1.5px solid var(--lavender);overflow:hidden;background:white;">
      <div onclick="toggleAcc('acc-${e.id}')" style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;cursor:pointer;background:${isFirst?'linear-gradient(135deg,#F0F0FF,#FFF0F8)':'white'};">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:0.95rem;font-weight:700;color:var(--navy);">📝 ${typeLabel}</span>
          <span style="font-size:0.75rem;color:var(--muted);font-weight:600;">${fmtDate(e.date)}</span>
        </div>
        <span style="color:var(--muted);font-size:1rem;" id="acc-icon-${e.id}">${isFirst?'▲':'▼'}</span>
      </div>
      <div id="acc-${e.id}" style="display:${isFirst?'block':'none'};padding:0 18px 18px;border-top:1.5px solid var(--lavender);">
        ${ENTRETIEN_FIELDS.map(k => `
          <div style="margin-top:12px;">
            <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:4px;">${labels[k]||k}</div>
            <div style="background:var(--offwhite);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:${md[k]?'var(--navy)':'var(--muted)'};line-height:1.6;min-height:36px;font-style:${md[k]?'normal':'italic'};">${md[k]||'Non renseigné'}</div>
          </div>`).join('')}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
          <button class="btn btn-ghost btn-sm" onclick="openEditEntretien('${e.id}')">✏️ Modifier</button>
          <button class="btn btn-danger btn-sm" onclick="deleteEntretien('${e.id}')">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openAddEntretien() {
  editingEntretienId = null;
  document.getElementById('modalEntretienTitle').textContent = 'Nouvel entretien';
  document.getElementById('ea_type').value = 'annuel';
  ENTRETIEN_FIELDS.forEach(k => { document.getElementById('ea_'+k).value = ''; });
  openModal('modalEntretien');
}

function openEditEntretien(id) {
  const c = getCollab(currentCollabId);
  const e = (c.entretiens||[]).find(x => x.id === id);
  if (!e) return;
  editingEntretienId = id;
  document.getElementById('modalEntretienTitle').textContent = 'Modifier l\'entretien';
  document.getElementById('ea_type').value = e.type || 'annuel';
  const md = e.managerData || {};
  ENTRETIEN_FIELDS.forEach(k => { document.getElementById('ea_'+k).value = md[k] || ''; });
  openModal('modalEntretien');
}

async function saveEntretien() {
  const c = getCollab(currentCollabId);
  const type = document.getElementById('ea_type').value;
  const managerData = {};
  ENTRETIEN_FIELDS.forEach(k => { managerData[k] = document.getElementById('ea_'+k).value.trim(); });

  if (editingEntretienId) {
    const { error } = await sb.from('points_suivi').update({ type, manager_data: managerData }).eq('id', editingEntretienId);
    if (error) { showToast('Erreur: ' + error.message); return; }
    const idx = (c.entretiens||[]).findIndex(e => e.id === editingEntretienId);
    if (idx >= 0) { c.entretiens[idx].type = type; c.entretiens[idx].managerData = managerData; }
  } else {
    const row = {
      collaborateur_id: currentCollabId,
      date: new Date().toISOString().split('T')[0],
      type, mois: currentMois(),
      manager_data: managerData, collab_data: {},
      contenu: (ENTRETIEN_TYPES[type]||type) + ' — ' + new Date().toLocaleDateString('fr-FR'),
    };
    const { data, error } = await sb.from('points_suivi').insert(row).select().single();
    if (error) { showToast('Erreur: ' + error.message); return; }
    if (!c.entretiens) c.entretiens = [];
    c.entretiens.push({ id: data.id, date: row.date, type, mois: row.mois, managerData });
  }
  closeModal('modalEntretien');
  renderEntretiens();
  showToast('Entretien enregistré !');
}

async function deleteEntretien(id) {
  if (!await confirmModal('Supprimer cet entretien ?')) return;
  const { error } = await sb.from('points_suivi').delete().eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  const c = getCollab(currentCollabId);
  c.entretiens = (c.entretiens||[]).filter(e => e.id !== id);
  renderEntretiens();
}

// ─────────────────────────────────────────
// EXPORT PDF (Fiche collaborateur)
// ─────────────────────────────────────────
// ─────────────────────────────────────────
// DEMANDES DE MODIFICATION D'OBJECTIFS
// ─────────────────────────────────────────
async function approveObjRequest(id) {
  const req = (DB.objRequests||[]).find(r => r.id === id);
  if (!req) return;
  try {
    if (req.type === 'creer' && req.data) {
      await sb.from('objectifs').insert({
        collaborateur_id: req.collaborateurId,
        titre: req.data.titre, description: req.data.description || null,
        date_debut: req.data.dateDebut || null, date_fin: req.data.dateFin || null,
        statut: req.data.statut || 'en-cours', progression: req.data.progression || 0
      });
    } else if (req.type === 'modifier' && req.objectifId && req.data) {
      await sb.from('objectifs').update({
        titre: req.data.titre, description: req.data.description || null,
        statut: req.data.statut || 'en-cours', progression: req.data.progression || 0
      }).eq('id', req.objectifId);
    } else if (req.type === 'supprimer' && req.objectifId) {
      await sb.from('objectifs').delete().eq('id', req.objectifId);
    }
    await sb.from('objectif_requests').update({ statut: 'approuve' }).eq('id', id);
    DB.objRequests = (DB.objRequests||[]).filter(r => r.id !== id);
    // Reload collabs to get updated objectives
    const { data } = await sb.from('collaborateurs').select('*, points_suivi(*), objectifs(*)');
    if (data) DB.collaborateurs = data.map(fromRow);
    if (currentView === 'bo-objectifs') renderBoObjectifs();
    else renderDashboard();
    renderSidebar();
    showToast('Demande approuvée — objectif mis à jour ✓');
  } catch(e) { showToast('Erreur: ' + e.message); }
}

async function refuseObjRequest(id) {
  const motif = prompt('Motif du refus :');
  if (!motif || !motif.trim()) { showToast('Le motif est obligatoire.'); return; }
  const { error } = await sb.from('objectif_requests').update({ statut: 'refuse', motif_refus: motif.trim() }).eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  DB.objRequests = (DB.objRequests||[]).filter(r => r.id !== id);
  if (currentView === 'bo-objectifs') renderBoObjectifs();
  else renderDashboard();
  renderSidebar();
  showToast('Demande refusée.');
}

// ─────────────────────────────────────────
// EXPORT PDF (Fiche collaborateur)
// ─────────────────────────────────────────
function exportCollabPDF() {
  const c = getCollab(currentCollabId);
  if (!c) return;
  const manager = c.managerId ? getManagerName(c.managerId) : '—';
  const objs = (c.objectifs||[]).map((o,i) => `
    <div class="field">
      <div class="field-label">Objectif ${i+1} — ${STATUS_LABELS[o.statut]||o.statut} (${o.progression||0}%)</div>
      <div class="field-value"><strong>${o.titre}</strong>${o.description ? '<br>'+o.description : ''}<br>Du ${fmtDate(o.dateDebut)} au ${fmtDate(o.dateFin)}</div>
    </div>`).join('');

  const lastPoints = [...(c.pointsSuivi||[])].sort((a,b) => (b.mois||'') > (a.mois||'') ? 1 : -1).slice(0,3);
  const pointsHTML = lastPoints.map(p => {
    const md = p.managerData||{};
    return `<div class="field"><div class="field-label">${moisLabel(p.mois)}</div><div class="field-value">${md.retoursMissions||'—'}</div></div>`;
  }).join('');

  const html = `
    <h1>${c.prenom} ${c.nom}</h1>
    <div class="meta">${c.poste} · Manager : ${manager} · Entrée le ${fmtDate(c.dateEntree)}${c.bureau?' · Bureau : '+c.bureau:''}${c.equipes.length?' · Équipe : '+c.equipes.join(', '):''}</div>
    ${c.notes ? `<div class="field"><div class="field-label">Notes RH</div><div class="field-value">${escHTML(c.notes)}</div></div>` : ''}
    <h2>Objectifs</h2>
    ${objs || '<p>Aucun objectif</p>'}
    <h2>Derniers points mensuels</h2>
    ${pointsHTML || '<p>Aucun point</p>'}
    <div style="margin-top:40px;font-size:0.75rem;color:#6B6B9A;">Exporté le ${new Date().toLocaleDateString('fr-FR')} — Hello Pomelo</div>`;

  exportPrintHTML(`Fiche ${c.prenom} ${c.nom}`, html);
}

// ─────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

// ─────────────────────────────────────────
// VOIR COMME COLLABORATEUR
// ─────────────────────────────────────────
function voirCommeCollab(collabId) {
  const url = 'collaborateur.html?admin_impersonate_id=' + encodeURIComponent(collabId);
  window.open(url, '_blank');
}

// ─────────────────────────────────────────
// GLOBAL SEARCH
// ─────────────────────────────────────────
const globalSearchHandler = debounce(function() {
  const q = document.getElementById('globalSearch').value.trim().toLowerCase();
  const results = document.getElementById('globalSearchResults');
  if (q.length < 2) { results.style.display = 'none'; return; }
  const matches = DB.collaborateurs.filter(c =>
    (c.prenom + ' ' + c.nom + ' ' + c.poste + ' ' + c.email).toLowerCase().includes(q)
  ).slice(0, 8);
  if (!matches.length) {
    results.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:0.82rem;">Aucun résultat</div>';
  } else {
    results.innerHTML = matches.map(c => `
      <div onmousedown="navigate('collab','${c.id}');document.getElementById('globalSearch').value='';" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background 0.1s;" onmouseover="this.style.background='#F0F0FF'" onmouseout="this.style.background='white'">
        ${avatarHTML(c, 28)}
        <div>
          <div style="font-weight:700;font-size:0.85rem;color:var(--navy);">${c.prenom} ${c.nom}</div>
          <div style="font-size:0.72rem;color:var(--muted);">${c.poste} ${c.equipes.length ? '· '+c.equipes.join(', ') : ''}</div>
        </div>
      </div>`).join('');
  }
  results.style.display = 'block';
}, 150);

// ─────────────────────────────────────────
// DARK MODE
// ─────────────────────────────────────────
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
  localStorage.setItem('hp_theme', isDark ? 'light' : 'dark');
  const btn = document.getElementById('adminDarkBtn');
  if (btn) btn.textContent = isDark ? '🌙' : '☀️';
}
if (localStorage.getItem('hp_theme') === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
  const btn = document.getElementById('adminDarkBtn');
  if (btn) btn.textContent = '☀️';
}

// ─────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────
async function logActivity(action, cible, details) {
  try {
    await sb.from('activity_log').insert({ action, auteur: 'Admin', cible, details });
  } catch(e) { console.warn('Activity log:', e); }
}

// ─────────────────────────────────────────
// EXPORT PDF POINTS MENSUELS
// ─────────────────────────────────────────
function exportPointsPDF() {
  const c = getCollab(currentCollabId);
  if (!c) return;
  const manager = c.managerId ? getManagerName(c.managerId) : '—';
  const points = [...(c.pointsSuivi||[])].sort((a,b) => (a.mois||'') > (b.mois||'') ? 1 : -1);
  const questions = getActiveManagerQuestions();

  const pointsHTML = points.map(p => {
    const md = p.managerData || {};
    const cd = p.collabData || {};
    return `
      <h2>📅 ${moisLabel(p.mois)} ${isPointLocked(p.mois) ? '🔒' : ''}</h2>
      <h3 style="color:#5BB6F4;">Retours Manager</h3>
      ${questions.map(q => `<div class="field"><div class="field-label">${escHTML(q.label)}</div><div class="field-value">${escHTML(md[q.key]||'Non renseigné')}</div></div>`).join('')}
      <h3 style="color:#FF3285;">Réponses Collaborateur</h3>
      ${Object.entries(cd).filter(([k])=>k!=='objectifs').map(([k,v]) => `<div class="field"><div class="field-label">${escHTML(k)}</div><div class="field-value">${escHTML(v||'Non renseigné')}</div></div>`).join('')}
      <hr style="border:none;border-top:1px solid #CFD0E5;margin:20px 0;">
    `;
  }).join('');

  exportPrintHTML(`Points mensuels — ${c.prenom} ${c.nom}`, `
    <h1>Points de suivi mensuels</h1>
    <div class="meta">${c.prenom} ${c.nom} · ${c.poste} · Manager : ${manager}</div>
    ${pointsHTML || '<p>Aucun point mensuel.</p>'}
    <div style="margin-top:40px;font-size:0.75rem;color:#6B6B9A;">Exporté le ${new Date().toLocaleDateString('fr-FR')} — Hello Pomelo</div>
  `);
}

// ─────────────────────────────────────────
// TREND CHARTS (Dashboard)
// ─────────────────────────────────────────
function renderTrendChart() {
  // Monthly review completion rate over last 6 months
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'));
  }
  const total = DB.collaborateurs.length || 1;
  const data = months.map(m => {
    const complete = DB.collaborateurs.filter(c => {
      const p = (c.pointsSuivi||[]).find(x => x.mois === m);
      return p && getPointStatus(p) === 'complet';
    }).length;
    return { month: moisLabel(m), pct: Math.round(complete / total * 100) };
  });
  const max = 100;
  return `
    <div style="background:white;border-radius:var(--radius-lg);padding:20px 24px;box-shadow:var(--shadow-md);">
      <div class="section-title" style="margin-top:0;">📊 Complétion des points mensuels (6 mois)</div>
      ${data.map(d => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="font-size:0.75rem;font-weight:600;color:var(--navy);min-width:100px;text-align:right;text-transform:capitalize;">${d.month}</span>
          <div style="flex:1;height:22px;background:var(--offwhite);border-radius:6px;overflow:hidden;">
            <div style="height:100%;width:${d.pct}%;background:${d.pct >= 80 ? 'var(--green)' : d.pct >= 50 ? 'var(--orange)' : 'var(--pink)'};border-radius:6px;display:flex;align-items:center;padding-left:8px;font-size:0.7rem;font-weight:700;color:white;min-width:${d.pct ? '30px' : '0'};">${d.pct}%</div>
          </div>
        </div>`).join('')}
    </div>`;
}

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
initDB();
