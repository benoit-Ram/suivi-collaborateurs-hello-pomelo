// ─────────────────────────────────────────
// ⚙️  CONFIGURATION — À personnaliser
// ─────────────────────────────────────────
// Pour activer Google Sign-In :
// 1. Allez sur https://console.cloud.google.com/
// 2. Créez un projet > APIs & Services > Credentials
// 3. Créez un "OAuth 2.0 Client ID" de type "Web application"
// 4. Ajoutez http://localhost:3000 dans "Authorized JavaScript origins"
// 5. Collez le Client ID ci-dessous
const GOOGLE_CLIENT_ID = ''; // Désactivé temporairement — sera réactivé avec moncompte.hello-pomelo.com

// ─────────────────────────────────────────
// SUPABASE
// ─────────────────────────────────────────
const SUPABASE_URL = 'https://mlhdghtqfpqhypxwpwjj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_l5iAp3wWHsxcszBKoFhTeA_s8KazePI';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let COLLABS = []; // cache Supabase

function collabFromRow(row) {
  return {
    id: row.id, prenom: row.prenom, nom: row.nom, poste: row.poste || '',
    email: row.email || '', telephone: row.telephone || '',
    dateEntree: row.date_entree || '', managerId: row.manager_id || null,
    bureau: row.bureau || '', equipe: row.equipe || '', equipes: parseEquipes(row.equipe), photoUrl: row.photo_url || '',
    soldeConges: row.solde_conges ?? 0, acquisitionConges: row.acquisition_conges ?? 2.08, valideurCongesId: row.valideur_conges_id || null,
    onboarding: row.onboarding || { notes:'', materiel:'', acces:'', documents:{} },
    pointsSuivi: (row.points_suivi || []).map(p => ({
      id: p.id, date: p.date, type: p.type, mois: p.mois || '',
      managerData: p.manager_data || {},
      collabData: p.collab_data || {}
    })),
    objectifs: (row.objectifs || []).sort((a,b)=> new Date(a.created_at)-new Date(b.created_at)).map((o,i) => ({ id:o.id, numero:i+1, titre:o.titre, description:o.description||'', dateDebut:o.date_debut||'', dateFin:o.date_fin||'', statut:o.statut||'en-attente', progression:o.progression||0, recurrence:o.recurrence||'', historique:o.historique||[] }))
  };
}

async function loadCollabsFromSupabase() {
  const { data, error } = await sb.from('collaborateurs').select('*, points_suivi(*), objectifs(*)');
  if (error) { showToast('Erreur chargement : ' + error.message); return []; }
  return data.map(collabFromRow);
}

// ─────────────────────────────────────────
// DATA
// ─────────────────────────────────────────
// STATUS_COLORS, STATUS_LABELS, BAR_COLORS, ABS_* sont dans utils.js



let currentCollab = null;
let currentUser = null; // { name, email, picture }
let myTeam = []; // membres de l'équipe si l'utilisateur est manager
let myObjRequests = []; // demandes d'objectifs faites par ce manager

// ─────────────────────────────────────────
// GOOGLE AUTH
// ─────────────────────────────────────────
window.addEventListener('load', async () => {
  // Préchargement des collaborateurs et settings depuis Supabase
  const [collabsData, settingsData] = await Promise.all([
    loadCollabsFromSupabase(),
    sb.from('settings').select('*')
  ]);
  COLLABS = collabsData;
  if (settingsData.data) {
    settingsData.data.forEach(row => { COLLAB_SETTINGS[row.key] = row.value; });
  }

  // Admin impersonation via URL parameter (by ID)
  const urlParams = new URLSearchParams(window.location.search);
  const impersonateId = urlParams.get('admin_impersonate_id');
  if (impersonateId) {
    const collab = COLLABS.find(c => c.id === impersonateId);
    if (collab) {
      loginWithId(collab);
      return;
    }
  }

  // Check existing session
  const session = sessionStorage.getItem('hp_collab_session');
  if (session) {
    const u = JSON.parse(session);
    loginWithEmail(u.email, u.name, u.picture, false);
    return;
  }

  if (GOOGLE_CLIENT_ID) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse,
      auto_select: false,
    });
    google.accounts.id.renderButton(
      document.getElementById('googleSignInBtn'),
      { theme: 'outline', size: 'large', width: 340, text: 'signin_with', shape: 'rectangular', locale: 'fr' }
    );
  } else {
    document.getElementById('demoLoginBtn').classList.remove('hidden');
  }
});

function handleGoogleResponse(response) {
  // Decode JWT
  const payload = JSON.parse(atob(response.credential.split('.')[1]));
  loginWithEmail(payload.email, payload.name, payload.picture, true);
}

function demoLogin() {
  const modal = document.getElementById('demoModal');
  const list  = document.getElementById('demoCollabList');

  if (!COLLABS.length) {
    list.innerHTML = `
      <div class="modal-empty">
        <div class="modal-empty-icon">👤</div>
        <p>Aucun collaborateur dans la base.<br>Créez-en un depuis l'interface admin.</p>
      </div>`;
  } else {
    list.innerHTML = COLLABS.map(c => {
      const ini = ((c.prenom||'')[0]||'').toUpperCase() + ((c.nom||'')[0]||'').toUpperCase();
      const email = c.email || '(pas d\'email)';
      const poste = c.poste || '';
      return `
        <div class="collab-item" onclick="demoSelectCollab('${(c.email||'').replace(/'/g,"\\'")}','${(c.prenom+' '+c.nom).replace(/'/g,"\\'")}')">
          <div class="collab-item-avatar">${ini}</div>
          <div class="collab-item-info">
            <div class="collab-item-name">${c.prenom} ${c.nom}</div>
            <div class="collab-item-email">${email}</div>
            ${poste ? `<div class="collab-item-poste">${poste}</div>` : ''}
          </div>
          <span class="collab-item-arrow">→</span>
        </div>`;
    }).join('');
  }

  modal.classList.remove('hidden');
}

function demoSelectCollab(email, name) {
  document.getElementById('demoModal').classList.add('hidden');
  if (!email) { showLoginError('Ce collaborateur n\'a pas d\'adresse email configurée.'); return; }
  loginWithEmail(email.trim(), name, null, false);
}

function closeDemoModal(event) {
  if (event.target.id === 'demoModal') {
    document.getElementById('demoModal').classList.add('hidden');
  }
}

function loginWithId(collab) {
  currentCollab = collab;
  currentUser = { email: collab.email, name: collab.prenom + ' ' + collab.nom, picture: null };
  sessionStorage.setItem('hp_collab_session', JSON.stringify(currentUser));
  myTeam = COLLABS.filter(c => c.managerId === currentCollab.id);
  if (myTeam.length > 0) document.getElementById('btnTabEquipe').classList.remove('hidden');
  showApp();
}

function loginWithEmail(email, name, picture, saveSession) {
  const collab = COLLABS.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());

  if (!collab) {
    // Super admin : rediriger vers l'interface admin
    if (email.toLowerCase() === 'benoit@hello-pomelo.com') {
      window.location.href = 'index.html';
      return;
    }
    showLoginError(`Aucun compte collaborateur trouvé pour "${email}". Contactez votre administrateur.`);
    return;
  }

  currentCollab = collab;
  currentUser = { email, name: name || collab.prenom + ' ' + collab.nom, picture };

  // Sauvegarder la photo Google en base si disponible
  if (picture && picture !== collab.photoUrl) {
    sb.from('collaborateurs').update({ photo_url: picture }).eq('id', collab.id);
    collab.photoUrl = picture;
  }

  sessionStorage.setItem('hp_collab_session', JSON.stringify(currentUser));

  // Détecter si l'utilisateur est manager
  myTeam = COLLABS.filter(c => c.managerId === currentCollab.id);
  if (myTeam.length > 0) {
    document.getElementById('btnTabEquipe').classList.remove('hidden');
  }

  showApp();
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
}

function logout() {
  sessionStorage.removeItem('hp_collab_session');
  currentCollab = null;
  currentUser = null;
  document.getElementById('appPage').style.display = 'none';
  document.getElementById('loginPage').style.display = 'flex';
  if (GOOGLE_CLIENT_ID) google.accounts.id.disableAutoSelect();
}

// ─────────────────────────────────────────
// APP
// ─────────────────────────────────────────
function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('appPage').style.display = 'block';

  // Topbar
  document.getElementById('topbarName').textContent = currentUser.name;
  const avatarEl = document.getElementById('topbarAvatar');
  if (currentUser.picture) {
    avatarEl.outerHTML = `<img id="topbarAvatar" class="user-avatar" src="${currentUser.picture}" alt="" />`;
  } else {
    avatarEl.textContent = initials(currentCollab);
  }

  // Config banner
  if (!GOOGLE_CLIENT_ID) document.getElementById('configBanner').classList.remove('hidden');

  renderProfile();
  showTab('accueil');

  // Load absences + objective requests for notifications
  sb.from('absences').select('*').eq('collaborateur_id', currentCollab.id).then(({ data, error }) => {
    if (error) { console.warn('Absences load:', error.message); return; }
    myAbsences = (data||[]).map(a => ({ id: a.id, type: a.type, dateDebut: a.date_debut, dateFin: a.date_fin, statut: a.statut || 'en_attente', commentaire: a.commentaire || '', motifRefus: a.motif_refus || '' }));
    updateNotifBadge();
  }).catch(e => console.warn('Absences:', e));

  // Load objective requests made by this manager (all statuses)
  sb.from('objectif_requests').select('*').eq('manager_id', currentCollab.id).order('created_at', { ascending: false }).then(({ data }) => {
    myObjRequests = (data||[]).map(r => ({
      id: r.id, collaborateurId: r.collaborateur_id, type: r.type, data: r.data,
      statut: r.statut, motifRefus: r.motif_refus || ''
    }));
    updateNotifBadge();
  }).catch(e => console.warn('ObjRequests:', e));

  // Load pending absences for team members (for Management badge)
  if (myTeam.length) {
    const teamIds = myTeam.map(m => m.id);
    sb.from('absences').select('*').in('collaborateur_id', teamIds).eq('statut', 'en_attente').then(({ data }) => {
      const pendingCount = (data||[]).length;
      const badge = document.getElementById('mgmtBadge');
      if (badge && pendingCount) { badge.style.display = 'inline'; badge.textContent = pendingCount; }
    }).catch(e => console.warn('Team absences:', e));
  }
}

function renderProfile() {
  const c = currentCollab;
  const manager = c.managerId ? COLLABS.find(x => x.id === c.managerId) : null;

  document.getElementById('profileCard').innerHTML = `
    ${c.photoUrl ? `<img src="${c.photoUrl}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;flex-shrink:0;" />` : `<div class="profile-avatar">${initials(c)}</div>`}
    <div>
      <div class="profile-name">${c.prenom} ${c.nom}</div>
      <div class="profile-poste">${c.poste}</div>
      <div class="profile-meta">
        ${c.email ? `<div class="profile-meta-item">✉️ <span>${c.email}</span></div>` : ''}
        ${c.dateEntree ? `<div class="profile-meta-item">📅 Entrée le <span>${fmtDate(c.dateEntree)}</span></div>` : ''}
        ${c.bureau ? `<div class="profile-meta-item">🏢 Bureau : <span>${c.bureau}</span></div>` : ''}
        ${c.equipes.length ? `<div class="profile-meta-item">👥 Équipe${c.equipes.length>1?'s':''} : <span>${c.equipes.join(', ')}</span></div>` : ''}
        ${manager ? `<div class="profile-meta-item">👔 Manager : <span>${manager.prenom} ${manager.nom}</span></div>` : ''}
      </div>
    </div>`;
}

function showTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');

  if (tab === 'accueil') renderDashboard();
  else if (tab === 'objectifs') renderObjectifs();
  else if (tab === 'points') renderPoints();
  else if (tab === 'conges') renderConges();
  else if (tab === 'equipe') renderTeam();
}

// ─────────────────────────────────────────
// POINTS MENSUELS
// ─────────────────────────────────────────
let COLLAB_SETTINGS = {};

const DEFAULT_MANAGER_Q = [
  { key: 'retoursMissions', label: 'Retours sur les missions', type: 'texte' },
  { key: 'tauxStaffing', label: 'Taux de staffing / Satisfaction client', type: 'texte' },
  { key: 'qualites', label: 'Tes qualités ce mois-ci', type: 'texte' },
  { key: 'axeAmelioration', label: 'Un axe d\'amélioration', type: 'texte' },
];
const DEFAULT_COLLAB_Q = [
  { key: 'ressenti', label: 'Comment t\'es-tu senti(e) au travail ce mois-ci ?', type: 'texte' },
  { key: 'reussites', label: 'Quelles sont tes réussites ce mois-ci ?', type: 'texte' },
  { key: 'objectifsAtteints', label: 'Quels étaient tes objectifs M-1, les as-tu atteints ?', type: 'texte' },
  { key: 'suggestions', label: 'Commentaires ou suggestions pour améliorer les process ?', type: 'texte' },
  { key: 'objectifsMoisSuivant', label: 'Objectifs et priorités pour le mois à venir ?', type: 'texte' },
  { key: 'autresSujets', label: 'Souhaites-tu t\'investir dans d\'autres sujets au sein de HP ?', type: 'texte' },
  { key: 'axeAmeliorationSoi', label: '1 axe d\'amélioration pour le mois à venir pour toi ?', type: 'texte' },
];

function getActiveManagerQuestions() {
  const custom = COLLAB_SETTINGS['questions_manager'] || [];
  return custom.length ? custom.map((q, i) => ({ key: 'q' + i, label: q.label, type: q.type, options: q.options })) : DEFAULT_MANAGER_Q;
}

function getActiveCollabQuestions() {
  const custom = COLLAB_SETTINGS['questions_collab'] || [];
  return custom.length ? custom.map((q, i) => ({ key: 'cq' + i, label: q.label, type: q.type, options: q.options })) : DEFAULT_COLLAB_Q;
}

function renderCollabField(q, pointId, value) {
  const id = `cf_${pointId}_${q.key}`;
  if (q.type === 'notation') {
    return `<div style="margin-bottom:12px;">
      <label style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--pink);margin-bottom:4px;display:block;">${escHTML(q.label)}</label>
      <div style="display:flex;align-items:center;gap:10px;">
        <input id="${id}" type="range" min="1" max="5" value="${value||3}" oninput="document.getElementById('${id}_val').textContent=this.value+'/5'" style="flex:1;" />
        <span id="${id}_val" style="font-weight:700;color:var(--navy);">${value||3}/5</span>
      </div>
    </div>`;
  }
  if (q.type === 'qcm' && q.options) {
    return `<div style="margin-bottom:12px;">
      <label style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--pink);margin-bottom:4px;display:block;">${escHTML(q.label)}</label>
      <select id="${id}" style="width:100%;border:1.5px solid var(--lavender);border-radius:8px;padding:10px 12px;font-size:0.85rem;font-family:inherit;color:var(--navy);">
        <option value="">— Choisir —</option>
        ${q.options.map(o => `<option value="${escHTML(o)}" ${value === o ? 'selected' : ''}>${escHTML(o)}</option>`).join('')}
      </select>
    </div>`;
  }
  return `<div style="margin-bottom:12px;">
    <label style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--pink);margin-bottom:4px;display:block;">${escHTML(q.label)}</label>
    <textarea id="${id}" style="width:100%;border:1.5px solid var(--lavender);border-radius:8px;padding:10px 12px;font-size:0.85rem;font-family:inherit;color:var(--navy);min-height:64px;resize:vertical;outline:none;" placeholder="Votre réponse...">${escHTML(value||'')}</textarea>
  </div>`;
}

function renderPoints() {
  const c = currentCollab;
  const sorted = [...(c.pointsSuivi || [])].sort((a, b) => (b.mois || b.date) > (a.mois || a.date) ? 1 : -1);
  const cm = currentMois();

  if (!sorted.length) {
    document.getElementById('myPoints').innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Aucun point mensuel pour le moment.<br>Le point du mois sera créé automatiquement.</p></div>`;
    return;
  }

  document.getElementById('myPoints').innerHTML = sorted.map((p, i) => {
    const locked = isPointLocked(p.mois || cm);
    const md = p.managerData || {};
    const cd = p.collabData || {};
    const label = moisLabel(p.mois || p.date);
    const isFirst = i === 0;

    // Dynamic questions from settings (or defaults)
    const mgrQuestions = getActiveManagerQuestions();
    const collabQuestions = getActiveCollabQuestions();

    const managerHtml = mgrQuestions.map(q => {
      const val = md[q.key];
      const display = q.type === 'notation' && val ? val + '/5' : (val || 'Non renseigné par votre manager');
      return `<div style="margin-bottom:12px;">
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:4px;">${escHTML(q.label)}</div>
        <div style="background:var(--offwhite);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:${val ? 'var(--navy)' : 'var(--muted)'};line-height:1.6;min-height:36px;font-style:${val ? 'normal' : 'italic'};">${escHTML(display)}</div>
      </div>`;
    }).join('');

    const collabHtml = locked
      ? collabQuestions.map(q => {
          const val = cd[q.key];
          const display = q.type === 'notation' && val ? val + '/5' : (val || 'Non renseigné');
          return `<div style="margin-bottom:12px;">
            <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:4px;">${escHTML(q.label)}</div>
            <div style="background:var(--offwhite);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:${val ? 'var(--navy)' : 'var(--muted)'};line-height:1.6;min-height:36px;font-style:${val ? 'normal' : 'italic'};">${escHTML(display)}</div>
          </div>`;
        }).join('')
      : collabQuestions.map(q => renderCollabField(q, p.id, cd[q.key] || '')).join('');

    return `
    <div style="margin-bottom:12px;border-radius:14px;border:1.5px solid var(--lavender);overflow:hidden;background:white;">
      <div onclick="toggleAcc('acc-${p.id}')" style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;cursor:pointer;background:${isFirst && !locked ? 'linear-gradient(135deg,#F0F0FF,#FFF0F8)' : 'white'};">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:0.95rem;font-weight:700;color:var(--navy);">📅 ${label}</span>
          ${(() => { if (locked) return `<span style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);background:var(--lavender);padding:2px 8px;border-radius:99px;">🔒 Verrouillé</span>`; const st = getPointStatus(p); return `<span class="badge ${POINT_STATUS_BADGE[st].cls}" style="font-size:0.65rem;">${POINT_STATUS_BADGE[st].label}</span>`; })()}
        </div>
        <span style="color:var(--muted);font-size:1rem;" id="acc-icon-${p.id}">${isFirst ? '▲' : '▼'}</span>
      </div>
      <div id="acc-${p.id}" style="display:${isFirst ? 'block' : 'none'};padding:0 18px 18px;border-top:1.5px solid var(--lavender);">

        <!-- Manager section (read-only) -->
        <div style="margin-top:16px;">
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--skyblue);margin-bottom:12px;">👔 Retours de votre manager</div>
          ${managerHtml}
        </div>

        <!-- Collab section -->
        <div style="margin-top:20px;padding-top:16px;border-top:1px dashed var(--lavender);">
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--pink);margin-bottom:${locked ? 12 : 4}px;">✏️ Mes réponses</div>
          ${locked ? '' : `<div style="font-size:0.78rem;color:var(--muted);margin-bottom:14px;line-height:1.5;">Vos réponses sont sauvegardées automatiquement en brouillon.</div>`}
          ${collabHtml}
          ${!locked ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
            <span id="draftStatus_${p.id}" style="font-size:0.72rem;color:var(--muted);"></span>
            <button class="btn btn-primary" onclick="saveCollabPoint('${p.id}',this)">💾 Sauvegarder</button>
          </div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  // Auto-save drafts: restore from localStorage + setup listeners
  setTimeout(() => {
    const cm = currentMois();
    sorted.filter(p => !isPointLocked(p.mois || cm)).forEach(p => {
      const questions = getActiveCollabQuestions();
      const draftKey = 'draft_point_' + p.id;
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (draft) {
        questions.forEach(q => {
          const el = document.getElementById(`cf_${p.id}_${q.key}`);
          if (el && !el.value && draft[q.key]) { el.value = draft[q.key]; }
        });
        const statusEl = document.getElementById('draftStatus_' + p.id);
        if (statusEl) statusEl.textContent = '💾 Brouillon restauré';
      }
      // Listen for changes
      questions.forEach(q => {
        const el = document.getElementById(`cf_${p.id}_${q.key}`);
        if (el) el.addEventListener('input', debounce(() => {
          const d = {};
          questions.forEach(qq => { const e = document.getElementById(`cf_${p.id}_${qq.key}`); if (e) d[qq.key] = e.value; });
          localStorage.setItem(draftKey, JSON.stringify(d));
          const statusEl = document.getElementById('draftStatus_' + p.id);
          if (statusEl) statusEl.textContent = '💾 Brouillon sauvegardé';
        }, 500));
      });
    });
  }, 100);
}

async function saveCollabPoint(pointId, btn) {
  const c = currentCollab;
  const p = (c.pointsSuivi || []).find(x => x.id === pointId);
  if (!p || isPointLocked(p.mois)) { showToast('Ce point est verrouillé.'); return; }

  const questions = getActiveCollabQuestions();
  const collabData = {};
  questions.forEach(q => {
    const el = document.getElementById(`cf_${pointId}_${q.key}`);
    collabData[q.key] = el ? (q.type === 'notation' ? el.value : el.value.trim()) : '';
  });

  // Validation champs obligatoires
  const emptyFields = questions.filter(q => !collabData[q.key]);
  if (emptyFields.length) { showToast(`Veuillez remplir tous les champs (${emptyFields.length} manquant${emptyFields.length > 1 ? 's' : ''}).`); return; }

  if (btn) btnLoading(btn);
  const { error } = await sb.from('points_suivi').update({ collab_data: collabData }).eq('id', pointId);
  if (btn) btnDone(btn);
  if (error) { showToast('Erreur: ' + error.message); return; }
  p.collabData = collabData;
  // Clear draft
  localStorage.removeItem('draft_point_' + pointId);
  showToast('Réponses enregistrées !');
}

// ─────────────────────────────────────────
// OBJECTIFS
// ─────────────────────────────────────────
function renderObjectifs() {
  const c = currentCollab;
  const objs = c.objectifs || [];
  // Collect team objectives from all equipes
  const allTeamObjs = [];
  (c.equipes || []).forEach(eq => {
    const objs = COLLAB_SETTINGS['team_objectifs_' + eq] || [];
    objs.forEach(o => allTeamObjs.push({ ...( typeof o === 'string' ? { titre: o } : o ), equipe: eq }));
  });

  const total = objs.length;
  const atteints = objs.filter(o => o.statut === 'atteint').length;
  const enCours = objs.filter(o => o.statut === 'en-cours').length;

  let html = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px;">
      <div class="card" style="text-align:center;padding:16px;">
        <div style="font-size:1.8rem;font-weight:700;color:var(--navy);">${total}</div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:4px;">Objectifs individuels</div>
      </div>
      <div class="card" style="text-align:center;padding:16px;">
        <div style="font-size:1.8rem;font-weight:700;color:var(--green);">${atteints}</div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:4px;">Atteints</div>
      </div>
      <div class="card" style="text-align:center;padding:16px;">
        <div style="font-size:1.8rem;font-weight:700;color:var(--pink);">${enCours}</div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:4px;">En cours</div>
      </div>
    </div>`;

  // Team objectives from all equipes
  const teamObjsNorm = allTeamObjs.map(o => ({ titre: o.titre||'', dateDebut: o.dateDebut||'', dateFin: o.dateFin||'', progression: o.progression||0, equipe: o.equipe||'' }));
  if (teamObjsNorm.length) {
    html += `<div class="section-title">Objectifs d'équipe</div>`;
    html += teamObjsNorm.map((o, i) => {
      const pct = o.progression || 0;
      return `
      <div class="obj-card" style="border-left:4px solid var(--blue);">
        <div class="obj-header">
          <span style="background:var(--blue);color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;margin-right:8px;flex-shrink:0;">${i+1}</span>
          <div class="obj-title" style="flex:1;">${escHTML(o.titre)}</div>
          <span class="badge badge-blue">${escHTML(o.equipe)}</span>
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

  // Individual objectives — split en cours / atteints
  const objsEnCours = objs.filter(o => o.statut !== 'atteint');
  const objsAtteints = objs.filter(o => o.statut === 'atteint');

  if (objsEnCours.length) {
    html += `<div class="section-title">Objectifs individuels en cours (${objsEnCours.length})</div>`;
    html += objsEnCours.map((o,i) => renderObjCard(o, i, false)).join('');
  }

  if (objsAtteints.length) {
    html += `<div class="section-title" style="margin-top:24px;">✅ Objectifs atteints (${objsAtteints.length})</div>`;
    html += objsAtteints.map((o,i) => renderObjCard(o, i, false)).join('');
  }

  if (!objs.length && !teamObjsNorm.length) {
    html = `<div class="empty-state"><div class="empty-icon">🎯</div><p>Aucun objectif défini pour le moment.</p></div>`;
  }

  document.getElementById('myObjectifs').innerHTML = html;
}

// ─────────────────────────────────────────
// MANAGEMENT (vue manager)
// ─────────────────────────────────────────
let managementView = 'list';
let managementMemberId = null;
let managementTab = 'objectifs';
let memberAbsences = [];

function renderTeam() {
  if (managementView === 'detail' && managementMemberId) {
    const member = myTeam.find(m => m.id === managementMemberId);
    if (member) { renderMemberDetail(member); return; }
  }
  renderMemberList();
}

function renderMemberList() {
  managementView = 'list';
  managementMemberId = null;
  const container = document.getElementById('teamList');
  if (!myTeam.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">👔</div><p>Vous n'avez pas de collaborateurs directs.</p></div>`;
    return;
  }
  container.innerHTML = `
    <div class="section-title">Mes collaborateurs (${myTeam.length})</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;">
      ${myTeam.map(m => `
        <div class="collab-card" onclick="openMemberDetail('${m.id}')" style="cursor:pointer;background:white;border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow-md);border:2px solid transparent;transition:all 0.2s;">
          ${avatarHTML(m, 48)}
          <div style="font-weight:700;font-size:0.95rem;color:var(--navy);margin-top:10px;">${m.prenom} ${m.nom}</div>
          <div style="font-size:0.78rem;color:var(--muted);margin-top:2px;">${m.poste || '—'}</div>
          <div style="font-size:0.72rem;color:var(--lilac);margin-top:6px;">${m.equipes ? m.equipes.join(', ') : ''}</div>
        </div>`).join('')}
    </div>`;
}

function openMemberDetail(memberId) {
  managementView = 'detail';
  managementMemberId = memberId;
  managementTab = 'objectifs';
  renderTeam();
}

async function renderMemberDetail(member) {
  // Load absences for this member
  await loadMemberAbsences(member.id);

  const container = document.getElementById('teamList');
  container.innerHTML = `
    <button onclick="renderMemberList()" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:none;background:var(--offwhite);color:var(--navy);font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer;transition:all 0.15s;margin-bottom:16px;" onmouseover="this.style.background='var(--lavender)'" onmouseout="this.style.background='var(--offwhite)'">← Retour</button>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
      ${avatarHTML(member, 56)}
      <div>
        <div style="font-size:1.15rem;font-weight:700;color:var(--navy);">${member.prenom} ${member.nom}</div>
        <div style="font-size:0.85rem;color:var(--muted);">${member.poste || '—'}</div>
      </div>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:24px;background:var(--offwhite);padding:6px;border-radius:12px;">
      ${['objectifs','points','conges'].map(t => {
        const labels = { objectifs: '🎯 Objectifs', points: '📋 Points mensuels', conges: '🏖️ Congés' };
        const active = managementTab === t;
        return `<button onclick="switchMgmtTab('${t}')" style="flex:1;padding:10px 16px;border-radius:10px;border:none;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer;transition:all 0.15s;${active ? 'background:white;color:var(--navy);box-shadow:0 2px 8px rgba(5,5,109,0.1);' : 'background:transparent;color:var(--muted);'}" onmouseover="if(!this.classList.contains('active'))this.style.color='var(--navy)'" onmouseout="if(!this.classList.contains('active'))this.style.color='var(--muted)'">${labels[t]}</button>`;
      }).join('')}
    </div>
    <div id="mgmtContent"></div>`;

  if (managementTab === 'objectifs') renderMemberObjectifs(member);
  else if (managementTab === 'points') renderMemberPoints(member);
  else if (managementTab === 'conges') renderMemberConges(member);
}

function switchMgmtTab(tab) {
  managementTab = tab;
  const member = myTeam.find(m => m.id === managementMemberId);
  if (member) renderMemberDetail(member);
}

// ── OBJECTIFS DU MANAGÉ ──
let objFormVisible = false;
let objFormType = 'creer'; // 'creer' | 'modifier'
let objFormObjId = null;

function renderObjCard(o, i, showActions) {
  const pct = o.statut === 'atteint' ? 100 : (o.progression || 0);
  const barColor = BAR_COLORS[o.statut] || 'var(--lavender)';
  return `
  <div class="obj-card" style="${o.statut === 'atteint' ? 'opacity:0.85;' : ''}">
    <div class="obj-header">
      <span style="background:${o.statut === 'atteint' ? 'var(--green)' : 'var(--pink)'};color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;margin-right:8px;flex-shrink:0;">${o.statut === 'atteint' ? '✓' : (i+1)}</span>
      <div class="obj-title" style="flex:1;">${escHTML(o.titre)}</div>
      <span class="badge ${STATUS_COLORS[o.statut]||'badge-gray'}">${STATUS_LABELS[o.statut]||o.statut}</span>
      ${o.recurrence ? `<span class="badge badge-blue" style="font-size:0.6rem;">🔄 ${o.recurrence === 'hebdo' ? 'Hebdo' : 'Mensuel'}</span>` : ''}
      ${showActions ? `<button class="btn btn-ghost btn-sm" onclick="openObjForm('modifier','${o.id}')">✏️</button><button class="btn btn-danger btn-sm" onclick="deleteTeamObj('${o.id}')">🗑️</button>` : ''}
    </div>
    ${o.description ? `<div class="obj-desc">${escHTML(o.description)}</div>` : ''}
    <div style="margin:8px 0;">
      <div style="display:flex;justify-content:space-between;font-size:0.7rem;font-weight:700;color:var(--muted);margin-bottom:4px;">
        <span>Progression</span><span>${pct}%</span>
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%;background:${barColor};"></div></div>
    </div>
    <div class="obj-footer"><span>📅 Du ${fmtDate(o.dateDebut)} au ${fmtDate(o.dateFin)}</span>
      ${(o.historique && o.historique.length) ? `<button onclick="toggleObjHist('objhist_${o.id}')" style="background:none;border:none;color:var(--muted);font-size:0.72rem;font-weight:700;cursor:pointer;text-decoration:underline;">📜 Historique (${o.historique.length})</button>` : ''}
    </div>
    ${(o.historique && o.historique.length) ? `<div id="objhist_${o.id}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px dashed var(--lavender);">
      <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">Historique des modifications</div>
      ${[...o.historique].reverse().map(h => `
        <div style="display:flex;gap:10px;padding:8px 10px;background:var(--offwhite);border-radius:8px;margin-bottom:6px;font-size:0.78rem;">
          <div style="color:var(--muted);font-weight:600;min-width:70px;">${fmtDate(h.date)}</div>
          <div style="flex:1;">
            <span style="font-weight:700;color:var(--navy);">${escHTML(h.auteur)}</span>
            ${h.changes.map(c => `<div style="margin-top:2px;color:var(--muted);">${escHTML(c.champ)} : ${c.avant ? `<span style="text-decoration:line-through;color:var(--red);">${escHTML(c.avant)}</span> → ` : ''}<span style="color:var(--green);font-weight:600;">${escHTML(c.apres)}</span></div>`).join('')}
          </div>
        </div>`).join('')}
    </div>` : ''}
  </div>`;
}

function toggleObjHist(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function renderMemberObjectifs(member) {
  const allObjs = member.objectifs || [];
  const enCours = allObjs.filter(o => o.statut !== 'atteint');
  const atteints = allObjs.filter(o => o.statut === 'atteint');
  const el = document.getElementById('mgmtContent');

  let html = '';
  if (!allObjs.length && !objFormVisible) {
    html = '<div class="empty-state"><div class="empty-icon">🎯</div><p>Aucun objectif défini pour ce collaborateur.</p></div>';
  } else {
    // Objectifs en cours
    if (enCours.length) {
      html += `<div class="section-title">Objectifs en cours (${enCours.length})</div>`;
      html += enCours.map((o, i) => renderObjCard(o, i, true)).join('');
    }

    // Objectifs atteints
    if (atteints.length) {
      html += `<div class="section-title" style="margin-top:24px;">✅ Objectifs atteints (${atteints.length})</div>`;
      html += atteints.map((o, i) => renderObjCard(o, i, true)).join('');
    }
  }

  // Formulaire inline
  if (objFormVisible) {
    const obj = objFormType === 'modifier' ? (objs.find(o => o.id === objFormObjId) || {}) : {};
    html += `
    <div style="margin-top:16px;background:white;border-radius:var(--radius-lg);padding:24px;box-shadow:var(--shadow-md);border-top:4px solid var(--pink);animation:fadeIn 0.2s ease;">
      <div style="font-size:1rem;font-weight:700;color:var(--navy);margin-bottom:18px;">${objFormType === 'creer' ? '✨ Nouvel objectif' : '✏️ Modifier l\'objectif'}</div>
      <div class="form-grid">
        <div class="form-field full">
          <label>Titre <span class="req">*</span></label>
          <input id="mgrObjTitre" type="text" value="${escHTML(obj.titre||'')}" placeholder="Titre de l'objectif..." />
        </div>
        <div class="form-field full">
          <label>Description</label>
          <textarea id="mgrObjDesc" placeholder="Contexte, critères de succès...">${escHTML(obj.description||'')}</textarea>
        </div>
        <div class="form-field">
          <label>Date de début</label>
          <input id="mgrObjDebut" type="date" value="${obj.dateDebut||''}" />
        </div>
        <div class="form-field">
          <label>Date de fin</label>
          <input id="mgrObjFin" type="date" value="${obj.dateFin||''}" />
        </div>
        <div class="form-field">
          <label>Statut</label>
          <select id="mgrObjStatut">
            ${['en-cours','atteint','non-atteint','en-attente'].map(s => `<option value="${s}" ${(obj.statut||'en-cours')===s?'selected':''}>${STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Progression</label>
          <div style="display:flex;align-items:center;gap:10px;">
            <input id="mgrObjProg" type="range" min="0" max="100" value="${obj.progression||0}" oninput="document.getElementById('mgrObjProgVal').textContent=this.value+'%'" style="flex:1;accent-color:var(--pink);" />
            <span id="mgrObjProgVal" style="font-weight:700;color:var(--navy);min-width:36px;">${obj.progression||0}%</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
        <button onclick="closeObjForm()" style="padding:10px 20px;border-radius:10px;border:1.5px solid var(--lavender);background:white;color:var(--navy);font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer;transition:all 0.15s;">Annuler</button>
        <button onclick="submitObjRequest()" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--pink),#C0006E);color:white;font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(255,50,133,0.3);transition:all 0.15s;">✓ ${objFormType === 'creer' ? 'Créer l\'objectif' : 'Enregistrer'}</button>
      </div>
    </div>`;
  } else {
    html += `<div style="margin-top:16px;">
      <button onclick="openObjForm('creer')" style="display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--pink),#C0006E);color:white;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(255,50,133,0.3);transition:all 0.15s;">+ Nouvel objectif</button>
    </div>`;

  }
  el.innerHTML = html;
}

function openObjForm(type, objId) {
  objFormVisible = true;
  objFormType = type;
  objFormObjId = objId || null;
  const member = myTeam.find(m => m.id === managementMemberId);
  if (member) renderMemberObjectifs(member);
}

function closeObjForm() {
  objFormVisible = false;
  const member = myTeam.find(m => m.id === managementMemberId);
  if (member) renderMemberObjectifs(member);
}

async function submitObjRequest() {
  const titre = document.getElementById('mgrObjTitre').value.trim();
  if (!titre) { showToast('Le titre est obligatoire.'); return; }
  const row = {
    collaborateur_id: managementMemberId,
    titre,
    description: document.getElementById('mgrObjDesc').value.trim() || null,
    date_debut: document.getElementById('mgrObjDebut').value || null,
    date_fin: document.getElementById('mgrObjFin').value || null,
    statut: document.getElementById('mgrObjStatut').value,
    progression: document.getElementById('mgrObjStatut').value === 'atteint' ? 100 : (parseInt(document.getElementById('mgrObjProg').value) || 0),
  };

  const member = myTeam.find(m => m.id === managementMemberId);
  if (!member) return;

  const managerName = currentCollab.prenom + ' ' + currentCollab.nom;

  if (objFormType === 'modifier' && objFormObjId) {
    const existing = (member.objectifs||[]).find(o => o.id === objFormObjId);
    const changes = [];
    if (existing) {
      if (existing.titre !== titre) changes.push({ champ: 'Titre', avant: existing.titre, apres: titre });
      if (existing.statut !== row.statut) changes.push({ champ: 'Statut', avant: STATUS_LABELS[existing.statut]||existing.statut, apres: STATUS_LABELS[row.statut]||row.statut });
      if (existing.progression !== row.progression) changes.push({ champ: 'Progression', avant: existing.progression+'%', apres: row.progression+'%' });
      if (existing.dateDebut !== (row.date_debut||'')) changes.push({ champ: 'Date début', avant: fmtDate(existing.dateDebut), apres: fmtDate(row.date_debut) });
      if (existing.dateFin !== (row.date_fin||'')) changes.push({ champ: 'Date fin', avant: fmtDate(existing.dateFin), apres: fmtDate(row.date_fin) });
    }
    if (changes.length) {
      const hist = (existing && existing.historique) || [];
      hist.push({ date: new Date().toISOString().split('T')[0], auteur: managerName, changes });
      row.historique = hist;
    }
    const { error } = await sb.from('objectifs').update(row).eq('id', objFormObjId);
    if (error) { showToast('Erreur: ' + error.message); return; }
    const idx = (member.objectifs||[]).findIndex(o => o.id === objFormObjId);
    if (idx >= 0) {
      member.objectifs[idx] = { ...member.objectifs[idx], titre, description: row.description||'', dateDebut: row.date_debut||'', dateFin: row.date_fin||'', statut: row.statut, progression: row.progression, historique: row.historique || member.objectifs[idx].historique || [] };
    }
    showToast('Objectif modifié ✓');
  } else {
    row.historique = [{ date: new Date().toISOString().split('T')[0], auteur: managerName, changes: [{ champ: 'Création', avant: '', apres: titre }] }];
    const { data, error } = await sb.from('objectifs').insert(row).select().single();
    if (error) { showToast('Erreur: ' + error.message); return; }
    if (!member.objectifs) member.objectifs = [];
    member.objectifs.push({ id: data.id, numero: member.objectifs.length+1, titre, description: row.description||'', dateDebut: row.date_debut||'', dateFin: row.date_fin||'', statut: row.statut, progression: row.progression, recurrence: '', historique: row.historique });
    showToast('Objectif créé ✓');
  }
  objFormVisible = false;
  renderMemberObjectifs(member);
}

async function deleteTeamObj(objId) {
  if (!await confirmModal('Supprimer cet objectif ?')) return;
  const { error } = await sb.from('objectifs').delete().eq('id', objId);
  if (error) { showToast('Erreur: ' + error.message); return; }
  const member = myTeam.find(m => m.id === managementMemberId);
  if (member) {
    member.objectifs = (member.objectifs||[]).filter(o => o.id !== objId);
    renderMemberObjectifs(member);
  }
  showToast('Objectif supprimé.');
}

// ── POINTS MENSUELS DU MANAGÉ ──
function renderMemberPoints(member) {
  document.getElementById('mgmtContent').innerHTML = renderTeamMemberPoints(member);
}

function renderTeamMemberPoints(member) {
  const cm = currentMois();
  const sorted = [...(member.pointsSuivi || [])].sort((a, b) => (b.mois || b.date) > (a.mois || a.date) ? 1 : -1);

  const hasCurrent = sorted.some(p => p.mois === cm);

  const managerFields = [
    ['retoursMissions', 'Retours sur les missions'],
    ['tauxStaffing', 'Taux de staffing / Satisfaction client'],
    ['qualites', 'Qualités ce mois-ci'],
    ['axeAmelioration', "Axe d'amélioration"],
  ];
  const collabFields = [
    ['ressenti', 'Ressenti au travail'],
    ['reussites', 'Réussites'],
    ['objectifsAtteints', 'Objectifs M-1 atteints ?'],
    ['suggestions', 'Suggestions / commentaires'],
    ['objectifsMoisSuivant', 'Objectifs mois suivant'],
    ['autresSujets', 'Autres sujets'],
    ['axeAmeliorationSoi', "Axe d'amélioration personnel"],
  ];

  let html = '';

  if (!hasCurrent) {
    html += `
      <div style="margin-bottom:12px;">
        <button class="btn btn-primary" onclick="createTeamPoint('${member.id}')">+ Créer le point de ${moisLabel(cm)}</button>
      </div>`;
  }

  if (!sorted.length) {
    html += `<div class="empty-state" style="padding:20px 0;"><div class="empty-icon" style="font-size:1.5rem;">📋</div><p>Aucun point mensuel pour ce collaborateur.</p></div>`;
    return html;
  }

  html += sorted.map((p, i) => {
    const locked = isPointLocked(p.mois || cm);
    const md = p.managerData || {};
    const cd = p.collabData || {};
    const label = moisLabel(p.mois || p.date);
    const isFirst = i === 0;
    const accId = `team-acc-${member.id}-${p.id}`;
    const iconId = `team-acc-icon-${member.id}-${p.id}`;

    const collabReadHtml = collabFields.map(([k, lbl]) => `
      <div style="margin-bottom:10px;">
        <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:4px;">${lbl}</div>
        <div style="background:var(--offwhite);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:${cd[k] ? 'var(--navy)' : 'var(--muted)'};line-height:1.6;min-height:34px;font-style:${cd[k] ? 'normal' : 'italic'};">${cd[k] || 'Non renseigné'}</div>
      </div>`).join('');

    const managerEditHtml = locked
      ? managerFields.map(([k, lbl]) => `
        <div style="margin-bottom:10px;">
          <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:4px;">${lbl}</div>
          <div style="background:var(--offwhite);border-radius:8px;padding:10px 12px;font-size:0.85rem;color:${md[k] ? 'var(--navy)' : 'var(--muted)'};line-height:1.6;min-height:34px;font-style:${md[k] ? 'normal' : 'italic'};">${md[k] || 'Non renseigné'}</div>
        </div>`).join('')
      : managerFields.map(([k, lbl]) => `
        <div style="margin-bottom:10px;">
          <label style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--pink);margin-bottom:4px;display:block;">${lbl}</label>
          <textarea id="tmf_${member.id}_${p.id}_${k}" style="width:100%;border:1.5px solid var(--lavender);border-radius:8px;padding:10px 12px;font-size:0.85rem;font-family:inherit;color:var(--navy);min-height:60px;resize:vertical;outline:none;" placeholder="Votre retour...">${md[k] || ''}</textarea>
        </div>`).join('');

    return `
    <div style="margin-bottom:10px;border-radius:12px;border:1.5px solid var(--lavender);overflow:hidden;background:white;">
      <div onclick="toggleTeamAcc('${accId}','${iconId}')" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;cursor:pointer;background:${isFirst && !locked ? 'linear-gradient(135deg,#F0F0FF,#FFF0F8)' : 'white'};">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:0.92rem;font-weight:700;color:var(--navy);">📅 ${label}</span>
          ${locked ? `<span style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);background:var(--lavender);padding:2px 7px;border-radius:99px;">🔒 Verrouillé</span>` : `<span style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--pink);background:#FFF0F8;padding:2px 7px;border-radius:99px;">✏️ En cours</span>`}
        </div>
        <span style="color:var(--muted);font-size:0.95rem;" id="${iconId}">${isFirst ? '▲' : '▼'}</span>
      </div>
      <div id="${accId}" style="display:${isFirst ? 'block' : 'none'};padding:0 16px 16px;border-top:1.5px solid var(--lavender);">

        <!-- Réponses du collaborateur (lecture seule) -->
        <div style="margin-top:14px;">
          <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--pink);margin-bottom:10px;">✏️ Réponses de ${member.prenom}</div>
          ${collabReadHtml}
        </div>

        <!-- Section manager (éditable si non verrouillé) -->
        <div style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--lavender);">
          <div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--skyblue);margin-bottom:${locked ? 10 : 4}px;">👔 Vos retours manager</div>
          ${locked ? '' : `<div style="font-size:0.78rem;color:var(--muted);margin-bottom:12px;line-height:1.5;">Ce point est encore modifiable jusqu'à la fin du mois.</div>`}
          ${managerEditHtml}
          ${!locked ? `<div style="display:flex;justify-content:flex-end;margin-top:8px;"><button class="btn btn-primary" onclick="saveTeamManagerPoint('${member.id}','${p.id}')">💾 Enregistrer mes retours</button></div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  return html;
}

function toggleTeamAcc(accId, iconId) {
  const el = document.getElementById(accId);
  const icon = document.getElementById(iconId);
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (icon) icon.textContent = open ? '▼' : '▲';
}

async function createTeamPoint(memberId) {
  const cm = currentMois();
  // Vérifier qu'il n'existe pas déjà un point pour ce mois
  const member = myTeam.find(c => c.id === memberId);
  if (member && (member.pointsSuivi || []).some(p => p.mois === cm)) {
    showToast('Un point existe déjà pour ce mois.');
    return;
  }
  const { data, error } = await sb.from('points_suivi').insert({
    collaborateur_id: memberId,
    type: 'mensuel',
    mois: cm,
    date: new Date().toISOString().split('T')[0],
    manager_data: {},
    collab_data: {},
  }).select().single();

  if (error) { showToast('Erreur : ' + error.message); return; }

  // Mettre à jour le cache local
  if (member) {
    member.pointsSuivi = member.pointsSuivi || [];
    member.pointsSuivi.push({
      id: data.id, date: data.date, type: data.type, mois: data.mois,
      managerData: {}, collabData: {}
    });
  }

  showToast(`Point de ${moisLabel(cm)} créé pour ${member ? member.prenom : ''} !`);
  // Rafraîchir l'affichage du membre
  const pointsDiv = document.getElementById(`team-points-${memberId}`);
  if (pointsDiv && member) pointsDiv.innerHTML = renderTeamMemberPoints(member);
}

async function saveTeamManagerPoint(memberId, pointId) {
  const member = myTeam.find(c => c.id === memberId);
  if (!member) return;
  const p = (member.pointsSuivi || []).find(x => x.id === pointId);
  if (!p) return;
  if (isPointLocked(p.mois)) { showToast('Ce point est verrouillé.'); return; }

  const fields = ['retoursMissions', 'tauxStaffing', 'qualites', 'axeAmelioration'];
  const managerData = {};
  fields.forEach(k => {
    const el = document.getElementById(`tmf_${memberId}_${pointId}_${k}`);
    if (el) managerData[k] = el.value.trim();
  });

  const { error } = await sb.from('points_suivi').update({ manager_data: managerData }).eq('id', pointId);
  if (error) { showToast('Erreur : ' + error.message); return; }

  p.managerData = managerData;
  showToast('Retours manager enregistrés !');
}

// ── CONGÉS DU MANAGÉ (vue manager) ──
async function loadMemberAbsences(memberId) {
  const { data, error } = await sb.from('absences').select('*')
    .eq('collaborateur_id', memberId).order('date_debut', { ascending: false });
  if (error) { console.warn('Load member absences:', error.message); memberAbsences = []; return; }
  memberAbsences = (data||[]).map(a => ({ id: a.id, type: a.type, dateDebut: a.date_debut, dateFin: a.date_fin, statut: a.statut || 'en_attente', commentaire: a.commentaire || '', motifRefus: a.motif_refus || '' }));
}

function renderMemberConges(member) {
  const el = document.getElementById('mgmtContent');
  const isValideur = (member.valideurCongesId === currentCollab.id) || (!member.valideurCongesId && member.managerId === currentCollab.id);

  // Calculate solde for member
  const soldeInitial = member.soldeConges || 0;
  const acquisition = member.acquisitionConges || 2.08;
  let moisAcquis = 0;
  if (member.dateEntree) {
    const entree = new Date(member.dateEntree);
    const now = new Date();
    moisAcquis = Math.max(0, (now.getFullYear() - entree.getFullYear()) * 12 + (now.getMonth() - entree.getMonth()));
  }
  const acquis = Math.round(moisAcquis * acquisition * 100) / 100;
  const pris = memberAbsences.filter(a => a.statut === 'approuve' && a.type === 'conge').reduce((s, a) => s + countWorkDays(a.dateDebut, a.dateFin), 0);
  const solde = Math.round((soldeInitial + acquis - pris) * 100) / 100;
  const soldeColor = solde <= 0 ? 'var(--red)' : solde <= 5 ? 'var(--orange)' : 'var(--green)';
  const pendingCount = memberAbsences.filter(a => a.statut === 'en_attente').length;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;">
      <div class="card" style="text-align:center;padding:16px;">
        <div style="font-size:1.5rem;font-weight:700;color:${soldeColor};">${solde}j</div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-top:4px;">Solde</div>
      </div>
      <div class="card" style="text-align:center;padding:16px;">
        <div style="font-size:1.5rem;font-weight:700;color:var(--pink);">${pris}j</div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-top:4px;">Pris</div>
      </div>
      <div class="card" style="text-align:center;padding:16px;">
        <div style="font-size:1.5rem;font-weight:700;color:var(--orange);">${pendingCount}</div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-top:4px;">En attente</div>
      </div>
    </div>
    <div class="section-title">Demandes de congés</div>
    ${memberAbsences.length ? memberAbsences.map(a => {
      const jours = countWorkDays(a.dateDebut, a.dateFin);
      return `
      <div style="display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:12px;border:1.5px solid var(--lavender);margin-bottom:8px;background:white;">
        <div style="flex:1;">
          <div style="font-weight:700;font-size:0.9rem;color:var(--navy);">${ABS_TYPES[a.type]||a.type} — ${jours}j</div>
          <div style="font-size:0.78rem;color:var(--muted);margin-top:2px;">Du ${fmtDate(a.dateDebut)} au ${fmtDate(a.dateFin)}</div>
          ${a.commentaire ? `<div style="font-size:0.78rem;color:var(--muted);margin-top:4px;font-style:italic;">${escHTML(a.commentaire)}</div>` : ''}
          ${a.statut === 'refuse' && a.motifRefus ? `<div style="font-size:0.78rem;color:#881337;margin-top:4px;background:#FFF1F2;padding:6px 10px;border-radius:6px;border-left:3px solid #F43F5E;">Motif : ${escHTML(a.motifRefus)}</div>` : ''}
        </div>
        <span class="badge ${ABS_STATUT_BADGE[a.statut]||'badge-gray'}">${ABS_STATUTS[a.statut]||a.statut}</span>
        ${isValideur && a.statut === 'en_attente' ? `
          <button class="btn btn-sm" style="background:var(--green);color:white;padding:4px 10px;" onclick="approveTeamAbsence('${a.id}')">✓</button>
          <button class="btn btn-danger btn-sm" style="padding:4px 10px;" onclick="refuseTeamAbsence('${a.id}')">✕</button>
        ` : ''}
      </div>`;
    }).join('') : '<div class="empty-state"><div class="empty-icon">🏖️</div><p>Aucune demande de congé.</p></div>'}
  `;
}

async function approveTeamAbsence(id) {
  const { error } = await sb.from('absences').update({ statut: 'approuve' }).eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  const a = memberAbsences.find(x => x.id === id);
  if (a) a.statut = 'approuve';
  const member = myTeam.find(m => m.id === managementMemberId);
  if (member) renderMemberConges(member);
  showToast('Congé approuvé ✓');
}

async function refuseTeamAbsence(id) {
  const motif = prompt('Motif du refus (obligatoire) :');
  if (!motif || !motif.trim()) { showToast('Le motif est obligatoire.'); return; }
  const { error } = await sb.from('absences').update({ statut: 'refuse', motif_refus: motif.trim() }).eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  const a = memberAbsences.find(x => x.id === id);
  if (a) { a.statut = 'refuse'; a.motifRefus = motif.trim(); }
  const member = myTeam.find(m => m.id === managementMemberId);
  if (member) renderMemberConges(member);
  showToast('Congé refusé.');
}

// ─────────────────────────────────────────
// MES CONGÉS
// ─────────────────────────────────────────
// ABS_TYPES, ABS_STATUTS, ABS_STATUT_BADGE sont dans utils.js

let myAbsences = [];

// countWorkDays est dans utils.js (exclut weekends + jours fériés FR)

function getMySolde() {
  const c = currentCollab;
  const soldeInitial = c.soldeConges || 0;
  const acquisition = c.acquisitionConges || 2.08;
  let moisAcquis = 0;
  if (c.dateEntree) {
    const entree = new Date(c.dateEntree);
    const now = new Date();
    moisAcquis = Math.max(0, (now.getFullYear() - entree.getFullYear()) * 12 + (now.getMonth() - entree.getMonth()));
  }
  const acquis = Math.round(moisAcquis * acquisition * 100) / 100;
  const pris = myAbsences
    .filter(a => a.statut === 'approuve' && a.type === 'conge')
    .reduce((sum, a) => sum + countWorkDays(a.dateDebut, a.dateFin), 0);
  const enAttente = myAbsences
    .filter(a => a.statut === 'en_attente' && a.type === 'conge')
    .reduce((sum, a) => sum + countWorkDays(a.dateDebut, a.dateFin), 0);
  const solde = Math.round((soldeInitial + acquis - pris) * 100) / 100;
  return { soldeInitial, acquis, pris, enAttente, solde };
}

async function renderConges() {
  // Charger les absences du collaborateur
  const { data, error } = await sb.from('absences').select('*')
    .eq('collaborateur_id', currentCollab.id)
    .order('date_debut', { ascending: false });
  if (error) { showToast('Erreur: ' + error.message); return; }
  myAbsences = (data||[]).map(a => ({
    id: a.id, type: a.type, dateDebut: a.date_debut, dateFin: a.date_fin,
    statut: a.statut || 'en_attente', commentaire: a.commentaire || '',
    motifRefus: a.motif_refus || ''
  }));

  const s = getMySolde();
  const soldeColor = s.solde <= 0 ? 'var(--red)' : s.solde <= 5 ? 'var(--orange)' : 'var(--green)';
  const valideurId = currentCollab.valideurCongesId || currentCollab.managerId;
  const valideur = valideurId ? COLLABS.find(c => c.id === valideurId) : null;
  const valideurNom = valideur ? valideur.prenom + ' ' + valideur.nom : 'Admin';

  const container = document.getElementById('myCongesContent');
  container.innerHTML = `
    <!-- Valideur -->
    <div style="background:linear-gradient(135deg,#F0F0FF,#FFF0F8);border-radius:12px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px;border:1.5px solid #E0D8FF;">
      <span style="font-size:1.1rem;">👔</span>
      <span style="font-size:0.85rem;font-weight:600;color:var(--navy);">Valideur de congés : <strong>${valideurNom}</strong></span>
    </div>
    <!-- Solde -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px;">
      <div class="card" style="text-align:center;padding:16px;">
        <div style="font-size:1.8rem;font-weight:700;color:${soldeColor};">${s.solde}</div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:4px;">Jours restants</div>
      </div>
      <div class="card" style="text-align:center;padding:16px;">
        <div style="font-size:1.8rem;font-weight:700;color:var(--navy);">${s.acquis}</div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:4px;">Acquis</div>
      </div>
      <div class="card" style="text-align:center;padding:16px;">
        <div style="font-size:1.8rem;font-weight:700;color:var(--pink);">${s.pris}</div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:4px;">Pris</div>
      </div>
      <div class="card" style="text-align:center;padding:16px;">
        <div style="font-size:1.8rem;font-weight:700;color:var(--orange);">${s.enAttente}</div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:4px;">En attente</div>
      </div>
    </div>

    <!-- Formulaire de demande -->
    <div class="card" style="margin-bottom:24px;">
      <div class="section-title" style="margin-top:0;">Nouvelle demande</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:12px;align-items:end;">
        <div>
          <label style="font-size:0.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:5px;">Type</label>
          <select id="absType" style="width:100%;border:1.5px solid var(--lavender);border-radius:10px;padding:10px 14px;font-family:inherit;font-size:0.9rem;color:var(--navy);background:var(--offwhite);outline:none;">
            ${Object.entries(ABS_TYPES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:0.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:5px;">Du</label>
          <input id="absDateDebut" type="date" style="width:100%;border:1.5px solid var(--lavender);border-radius:10px;padding:10px 14px;font-family:inherit;font-size:0.9rem;color:var(--navy);background:var(--offwhite);outline:none;" />
        </div>
        <div>
          <label style="font-size:0.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:5px;">Au</label>
          <input id="absDateFin" type="date" style="width:100%;border:1.5px solid var(--lavender);border-radius:10px;padding:10px 14px;font-family:inherit;font-size:0.9rem;color:var(--navy);background:var(--offwhite);outline:none;" />
        </div>
        <button class="btn btn-primary" onclick="submitAbsence()">Demander</button>
      </div>
      <div style="margin-top:10px;">
        <label style="font-size:0.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:5px;">Commentaire (optionnel)</label>
        <input id="absCommentaire" type="text" placeholder="Motif, précisions..." style="width:100%;border:1.5px solid var(--lavender);border-radius:10px;padding:10px 14px;font-family:inherit;font-size:0.9rem;color:var(--navy);background:var(--offwhite);outline:none;" />
      </div>
    </div>

    <!-- Calendrier -->
    <div class="card" style="margin-bottom:24px;">
      <div class="section-title" style="margin-top:0;">Mon calendrier</div>
      <div id="calendarContainer"></div>
    </div>

    <!-- Historique -->
    <div class="section-title">Historique</div>
    ${myAbsences.length ? myAbsences.map(a => {
      const jours = countWorkDays(a.dateDebut, a.dateFin);
      return `
      <div style="display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:12px;border:1.5px solid var(--lavender);margin-bottom:8px;background:white;">
        <div style="flex:1;">
          <div style="font-weight:700;font-size:0.9rem;color:var(--navy);">${ABS_TYPES[a.type]||a.type}</div>
          <div style="font-size:0.78rem;color:var(--muted);margin-top:2px;">Du ${fmtDate(a.dateDebut)} au ${fmtDate(a.dateFin)} · ${jours} jour${jours>1?'s':''}</div>
          ${a.commentaire ? `<div style="font-size:0.78rem;color:var(--muted);margin-top:4px;font-style:italic;">${a.commentaire}</div>` : ''}
          ${a.statut === 'refuse' && a.motifRefus ? `<div style="font-size:0.78rem;color:#881337;margin-top:4px;background:#FFF1F2;padding:6px 10px;border-radius:6px;border-left:3px solid #F43F5E;">Motif du refus : ${escHTML(a.motifRefus)}</div>` : ''}
        </div>
        <span class="badge ${ABS_STATUT_BADGE[a.statut]||'badge-gray'}">${ABS_STATUTS[a.statut]||a.statut}</span>
        ${a.statut === 'en_attente' ? `<button class="btn btn-danger btn-sm" onclick="cancelAbsence('${a.id}')">Annuler</button>` : ''}
      </div>`;
    }).join('') : '<div class="empty-state"><div class="empty-icon">🏖️</div><p>Aucune demande de congé.</p></div>'}
  `;

  // Render calendar
  calYear = new Date().getFullYear();
  calMonth = new Date().getMonth();
  document.getElementById('calendarContainer').innerHTML = renderCalendar(calYear, calMonth);

  // Update notifications
  updateNotifBadge();
}

async function submitAbsence() {
  const type = document.getElementById('absType').value;
  const dateDebut = document.getElementById('absDateDebut').value;
  const dateFin = document.getElementById('absDateFin').value;
  const commentaire = document.getElementById('absCommentaire').value.trim();

  if (!dateDebut || !dateFin) { showToast('Veuillez renseigner les dates.'); return; }
  if (dateFin < dateDebut) { showToast('La date de fin doit être après la date de début.'); return; }

  const { data, error } = await sb.from('absences').insert({
    collaborateur_id: currentCollab.id,
    type, date_debut: dateDebut, date_fin: dateFin,
    statut: 'en_attente', commentaire: commentaire || null
  }).select().single();

  if (error) { showToast('Erreur: ' + error.message); return; }
  showToast('Demande envoyée !');
  document.getElementById('absDateDebut').value = '';
  document.getElementById('absDateFin').value = '';
  document.getElementById('absCommentaire').value = '';
  renderConges();
}

async function cancelAbsence(id) {
  if (!await confirmModal('Annuler cette demande de congé ?')) return;
  const { error } = await sb.from('absences').delete().eq('id', id);
  if (error) { showToast('Erreur: ' + error.message); return; }
  showToast('Demande annulée.');
  renderConges();
}

// ─────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────
let notifOpen = false;

function toggleNotifPanel() {
  notifOpen = !notifOpen;
  document.getElementById('notifPanel').style.display = notifOpen ? 'block' : 'none';
  if (notifOpen) {
    renderNotifications();
    // Dismiss badge on view
    document.getElementById('notifBadge').style.display = 'none';
    sessionStorage.setItem('hp_notif_seen', Date.now());
  }
}

// Close panel when clicking outside
document.addEventListener('click', (e) => {
  if (notifOpen && !e.target.closest('#notifBell') && !e.target.closest('#notifPanel')) {
    notifOpen = false;
    document.getElementById('notifPanel').style.display = 'none';
  }
});

function renderNotifications() {
  const notifs = [];
  const cm = currentMois();

  // Absences approuvées ou refusées récemment
  myAbsences.forEach(a => {
    if (a.statut === 'approuve') {
      notifs.push({ icon: '✅', text: `Congé ${ABS_TYPES[a.type]||a.type} du ${fmtDate(a.dateDebut)} au ${fmtDate(a.dateFin)} approuvé`, type: 'success' });
    }
    if (a.statut === 'refuse') {
      notifs.push({ icon: '❌', text: `Congé ${ABS_TYPES[a.type]||a.type} du ${fmtDate(a.dateDebut)} au ${fmtDate(a.dateFin)} refusé${a.motifRefus ? ' — ' + a.motifRefus : ''}`, type: 'danger' });
    }
  });

  // Point mensuel rempli par le manager ce mois
  const currentPoint = (currentCollab.pointsSuivi||[]).find(p => p.mois === cm);
  if (currentPoint) {
    const md = currentPoint.managerData || {};
    const hasMd = Object.values(md).some(v => v && typeof v === 'string' && v.trim());
    if (hasMd) notifs.push({ icon: '📋', text: `Votre manager a rempli le point de ${moisLabel(cm)}. Pensez à compléter vos réponses !`, type: 'info' });
  }

  // Point mensuel non rempli
  if (currentPoint && !((currentPoint.collabData||{}).ressenti)) {
    notifs.push({ icon: '⏰', text: `N'oubliez pas de remplir vos réponses pour ${moisLabel(cm)}.`, type: 'warning' });
  }

  // Demandes d'objectifs (si manager) — réponses de l'admin
  (myObjRequests || []).forEach(r => {
    const collab = COLLABS.find(c => c.id === r.collaborateurId);
    const nom = collab ? collab.prenom + ' ' + collab.nom : '';
    if (r.statut === 'approuve') {
      notifs.push({ icon: '✅', text: `Objectif "${escHTML(r.data?.titre||'')}" pour ${nom} — approuvé par l'admin`, type: 'success' });
    } else if (r.statut === 'refuse') {
      notifs.push({ icon: '❌', text: `Objectif "${escHTML(r.data?.titre||'')}" pour ${nom} — refusé${r.motifRefus ? ' : ' + escHTML(r.motifRefus) : ''}`, type: 'danger' });
    }
  });

  // Demandes en attente soumises par ce manager
  (myObjRequests||[]).forEach(r => {
    if (r.statut === 'en_attente') {
      const collab = COLLABS.find(c => c.id === r.collaborateurId);
      notifs.push({ icon: '⏳', text: `Demande en attente : "${escHTML(r.data?.titre||'')}" pour ${collab ? collab.prenom : ''}`, type: 'warning' });
    }
  });

  const badge = document.getElementById('notifBadge');
  if (notifs.length) { badge.style.display = 'block'; badge.textContent = notifs.length; }
  else { badge.style.display = 'none'; }

  document.getElementById('notifList').innerHTML = notifs.length
    ? notifs.map(n => `
      <div style="display:flex;gap:10px;padding:10px 12px;border-radius:10px;margin-bottom:6px;background:${n.type==='success'?'#F0FDF4':n.type==='danger'?'#FFF1F2':n.type==='warning'?'#FFF7ED':'#EFF6FF'};font-size:0.82rem;font-weight:600;color:${n.type==='success'?'#166534':n.type==='danger'?'#881337':n.type==='warning'?'#9A3412':'#1E40AF'};">
        <span>${n.icon}</span><span style="flex:1;">${n.text}</span>
      </div>`).join('')
    : '<div style="text-align:center;color:var(--muted);font-size:0.82rem;padding:16px;">Aucune notification</div>';
}

function updateNotifBadge() {
  let count = 0;
  myAbsences.forEach(a => { if (a.statut === 'approuve' || a.statut === 'refuse') count++; });
  const cm = currentMois();
  const currentPoint = (currentCollab.pointsSuivi||[]).find(p => p.mois === cm);
  if (currentPoint) {
    const md = currentPoint.managerData || {};
    if (Object.values(md).some(v => v && typeof v === 'string' && v.trim())) count++;
  }
  (myObjRequests || []).forEach(r => { if (r.statut === 'approuve' || r.statut === 'refuse') count++; });
  const badge = document.getElementById('notifBadge');
  if (count) { badge.style.display = 'block'; badge.textContent = count; }
  else { badge.style.display = 'none'; }
}

// ─────────────────────────────────────────
// CALENDRIER CONGÉS
// ─────────────────────────────────────────
const JOURS_FERIES_FR = [
  { m: 1, d: 1, label: "Jour de l'an" },
  { m: 5, d: 1, label: 'Fête du travail' },
  { m: 5, d: 8, label: 'Victoire 1945' },
  { m: 7, d: 14, label: 'Fête nationale' },
  { m: 8, d: 15, label: 'Assomption' },
  { m: 11, d: 1, label: 'Toussaint' },
  { m: 11, d: 11, label: 'Armistice' },
  { m: 12, d: 25, label: 'Noël' },
];

function getJoursFeries(year) {
  const feries = JOURS_FERIES_FR.map(f => ({ date: `${year}-${String(f.m).padStart(2,'0')}-${String(f.d).padStart(2,'0')}`, label: f.label }));
  // Lundi de Pâques (calcul simplifié)
  const a = year % 19, b = Math.floor(year/100), c = year % 100;
  const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25);
  const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30;
  const i = Math.floor(c/4), k = c % 4;
  const l = (32+2*e+2*i-h-k) % 7;
  const m = Math.floor((a+11*h+22*l)/451);
  const month = Math.floor((h+l-7*m+114)/31);
  const day = ((h+l-7*m+114) % 31) + 1;
  const easter = new Date(year, month-1, day);
  const lundiPaques = new Date(easter); lundiPaques.setDate(easter.getDate()+1);
  const ascension = new Date(easter); ascension.setDate(easter.getDate()+39);
  const lundiPentecote = new Date(easter); lundiPentecote.setDate(easter.getDate()+50);
  [{ d: lundiPaques, l: 'Lundi de Pâques' }, { d: ascension, l: 'Ascension' }, { d: lundiPentecote, l: 'Lundi de Pentecôte' }].forEach(x => {
    feries.push({ date: x.d.toISOString().split('T')[0], label: x.l });
  });
  return feries;
}

function isDateInRange(date, debut, fin) {
  return date >= debut && date <= fin;
}

function renderCalendar(year, month) {
  const feries = getJoursFeries(year);
  const feriesDates = new Set(feries.map(f => f.date));
  const feriesMap = {};
  feries.forEach(f => { feriesMap[f.date] = f.label; });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month+1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Monday=0

  const today = new Date().toISOString().split('T')[0];
  const monthLabel = firstDay.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <button class="btn btn-ghost btn-sm" onclick="changeCalMonth(-1)">← Préc</button>
      <span style="font-weight:700;color:var(--navy);font-size:0.95rem;text-transform:capitalize;">${monthLabel}</span>
      <button class="btn btn-ghost btn-sm" onclick="changeCalMonth(1)">Suiv →</button>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:0.78rem;">
      <thead><tr>${['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => `<th style="padding:6px 4px;text-align:center;color:var(--muted);font-size:0.68rem;font-weight:700;">${d}</th>`).join('')}</tr></thead>
      <tbody>`;

  let dayNum = 1;
  for (let row = 0; row < 6; row++) {
    if (dayNum > lastDay.getDate()) break;
    html += '<tr>';
    for (let col = 0; col < 7; col++) {
      if ((row === 0 && col < startDow) || dayNum > lastDay.getDate()) {
        html += '<td style="padding:4px;"></td>';
      } else {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
        const isFerie = feriesDates.has(dateStr);
        const isWeekend = col >= 5;
        const isToday = dateStr === today;
        const absence = myAbsences.find(a => isDateInRange(dateStr, a.dateDebut, a.dateFin));
        let bg = 'transparent', color = 'var(--navy)', title = '';
        if (isFerie) { bg = '#EFF6FF'; color = '#1E40AF'; title = feriesMap[dateStr]; }
        if (isWeekend) { bg = 'var(--offwhite)'; color = 'var(--muted)'; }
        if (absence) {
          if (absence.statut === 'approuve') { bg = '#DCFCE7'; color = '#166534'; title = ABS_TYPES[absence.type]||absence.type; }
          else if (absence.statut === 'en_attente') { bg = '#FFF7ED'; color = '#9A3412'; title = (ABS_TYPES[absence.type]||absence.type)+' (en attente)'; }
          else if (absence.statut === 'refuse') { bg = '#FFF1F2'; color = '#881337'; title = (ABS_TYPES[absence.type]||absence.type)+' (refusé)'; }
        }
        if (isToday) { bg = 'var(--pink)'; color = 'white'; }
        html += `<td style="padding:2px;text-align:center;">
          <div title="${title}" style="width:28px;height:28px;line-height:28px;margin:0 auto;border-radius:8px;background:${bg};color:${color};font-weight:${isToday||absence?'700':'500'};cursor:${title?'help':'default'};">${dayNum}</div>
        </td>`;
        dayNum++;
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table>';

  // Legend
  html += `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;font-size:0.7rem;font-weight:600;color:var(--muted);">
      <div style="display:flex;align-items:center;gap:4px;"><div style="width:12px;height:12px;border-radius:3px;background:#DCFCE7;"></div> Approuvé</div>
      <div style="display:flex;align-items:center;gap:4px;"><div style="width:12px;height:12px;border-radius:3px;background:#FFF7ED;"></div> En attente</div>
      <div style="display:flex;align-items:center;gap:4px;"><div style="width:12px;height:12px;border-radius:3px;background:#FFF1F2;"></div> Refusé</div>
      <div style="display:flex;align-items:center;gap:4px;"><div style="width:12px;height:12px;border-radius:3px;background:#EFF6FF;"></div> Jour férié</div>
      <div style="display:flex;align-items:center;gap:4px;"><div style="width:12px;height:12px;border-radius:3px;background:var(--pink);"></div> Aujourd'hui</div>
    </div>`;

  return html;
}

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

function changeCalMonth(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  document.getElementById('calendarContainer').innerHTML = renderCalendar(calYear, calMonth);
}

// ─────────────────────────────────────────
// DASHBOARD COLLABORATEUR
// ─────────────────────────────────────────
function renderDashboard() {
  const c = currentCollab;
  const objs = c.objectifs || [];
  const enCours = objs.filter(o => o.statut === 'en-cours').length;
  const atteints = objs.filter(o => o.statut === 'atteint').length;
  const cm = currentMois();
  const point = (c.pointsSuivi||[]).find(p => p.mois === cm);
  const pointStatus = point ? getPointStatus(point) : 'vide';
  const pointBadge = POINT_STATUS_BADGE[pointStatus] || POINT_STATUS_BADGE.vide;

  // Solde congés
  const soldeInitial = c.soldeConges || 0;
  const acquisition = c.acquisitionConges || 2.08;
  let moisAcquis = 0;
  if (c.dateEntree) {
    const entree = new Date(c.dateEntree);
    const now = new Date();
    moisAcquis = Math.max(0, (now.getFullYear() - entree.getFullYear()) * 12 + (now.getMonth() - entree.getMonth()));
  }
  const acquis = Math.round(moisAcquis * acquisition * 100) / 100;
  const prisCong = myAbsences.filter(a => a.statut === 'approuve' && a.type === 'conge').reduce((s, a) => s + countWorkDays(a.dateDebut, a.dateFin), 0);
  const solde = Math.round((soldeInitial + acquis - prisCong) * 100) / 100;
  const soldeColor = solde <= 0 ? 'var(--red)' : solde <= 5 ? 'var(--orange)' : 'var(--green)';

  // Prochain congé
  const prochainConge = myAbsences.filter(a => a.statut === 'approuve' && a.dateDebut >= new Date().toISOString().split('T')[0]).sort((a,b) => a.dateDebut > b.dateDebut ? 1 : -1)[0];

  document.getElementById('myDashboard').innerHTML = `
    <!-- Bienvenue -->
    <div style="margin-bottom:24px;">
      <h2 style="font-size:1.3rem;font-weight:700;color:var(--navy);margin-bottom:4px;">Bonjour ${escHTML(c.prenom)} 👋</h2>
      <p style="font-size:0.88rem;color:var(--muted);">Voici le résumé de votre espace collaborateur.</p>
    </div>

    <!-- Stats cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:24px;">
      <div class="card" style="text-align:center;padding:18px;">
        <div style="font-size:2rem;font-weight:700;color:var(--pink);">${enCours}</div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:4px;">Objectifs en cours</div>
      </div>
      <div class="card" style="text-align:center;padding:18px;">
        <div style="font-size:2rem;font-weight:700;color:var(--green);">${atteints}</div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:4px;">Objectifs atteints</div>
      </div>
      <div class="card" style="text-align:center;padding:18px;">
        <div style="font-size:2rem;font-weight:700;color:${soldeColor};">${solde}j</div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:4px;">Congés restants</div>
      </div>
      <div class="card" style="text-align:center;padding:18px;cursor:pointer;" onclick="showTab('points')">
        <span class="badge ${pointBadge.cls}" style="font-size:0.8rem;">${pointBadge.label}</span>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:8px;">Point ${moisLabel(cm)}</div>
      </div>
    </div>

    <!-- Actions rapides -->
    <div class="card" style="margin-bottom:24px;">
      <div style="font-size:0.85rem;font-weight:700;color:var(--navy);margin-bottom:14px;">⚡ Actions rapides</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${pointStatus !== 'complet' ? `<button onclick="showTab('points')" style="padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--pink),#C0006E);color:white;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(255,50,133,0.3);">📋 Remplir mon point mensuel</button>` : ''}
        <button onclick="showTab('conges')" style="padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--skyblue),var(--blue));color:white;font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer;">🏖️ Demander un congé</button>
        <button onclick="showTab('objectifs')" style="padding:10px 20px;border-radius:10px;border:1.5px solid var(--lavender);background:white;color:var(--navy);font-family:inherit;font-size:0.82rem;font-weight:700;cursor:pointer;">🎯 Voir mes objectifs</button>
      </div>
    </div>

    <!-- Prochains événements -->
    ${prochainConge ? `<div class="card" style="margin-bottom:24px;">
      <div style="font-size:0.85rem;font-weight:700;color:var(--navy);margin-bottom:10px;">📅 Prochain congé</div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:1.5rem;">🏖️</span>
        <div>
          <div style="font-weight:600;color:var(--navy);">${ABS_TYPES[prochainConge.type]||prochainConge.type}</div>
          <div style="font-size:0.78rem;color:var(--muted);">Du ${fmtDate(prochainConge.dateDebut)} au ${fmtDate(prochainConge.dateFin)} · ${countWorkDays(prochainConge.dateDebut, prochainConge.dateFin)} jours</div>
        </div>
      </div>
    </div>` : ''}

    <!-- Objectifs en cours (aperçu) -->
    ${enCours ? `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="font-size:0.85rem;font-weight:700;color:var(--navy);">🎯 Objectifs en cours</div>
        <button onclick="showTab('objectifs')" style="background:none;border:none;color:var(--pink);font-size:0.78rem;font-weight:700;cursor:pointer;">Voir tout →</button>
      </div>
      ${objs.filter(o=>o.statut==='en-cours').slice(0,3).map(o => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--lavender);">
          <div style="flex:1;font-weight:600;font-size:0.88rem;color:var(--navy);">${escHTML(o.titre)}</div>
          <div style="min-width:50px;text-align:right;font-weight:700;font-size:0.82rem;color:var(--pink);">${o.progression||0}%</div>
        </div>`).join('')}
    </div>` : ''}
  `;
}

// ─────────────────────────────────────────
// DARK MODE
// ─────────────────────────────────────────
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
  localStorage.setItem('hp_theme', isDark ? 'light' : 'dark');
  document.getElementById('darkModeBtn').textContent = isDark ? '🌙' : '☀️';
}

// Restore theme on load
if (localStorage.getItem('hp_theme') === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
  const btn = document.getElementById('darkModeBtn');
  if (btn) btn.textContent = '☀️';
}

