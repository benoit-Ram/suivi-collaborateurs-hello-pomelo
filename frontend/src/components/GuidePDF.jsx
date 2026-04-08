// GuidePDF.jsx — Generates printable HTML guides for Admin and Collaborateur roles
// Opens a styled window.open() document ready for Print > Save as PDF

import { APP_VERSION, BUILD_DATE } from '../version';

const PINK = '#FF3285';
const NAVY = '#05056D';
const MUTED = '#6B6B9A';
const FONT = "'Quicksand', 'Segoe UI', sans-serif";

function timestamp() {
  return new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function baseStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ${FONT}; color: ${NAVY}; background: #fff; padding: 40px 48px; line-height: 1.6; }
    h1 { font-size: 28px; font-weight: 700; color: ${NAVY}; margin-bottom: 4px; }
    h2 { font-size: 20px; font-weight: 700; color: ${NAVY}; margin: 36px 0 10px; padding-bottom: 6px; border-bottom: 3px solid ${PINK}; }
    h3 { font-size: 15px; font-weight: 700; color: ${PINK}; margin: 18px 0 6px; }
    p, li { font-size: 13px; color: #333; line-height: 1.7; }
    ul { padding-left: 22px; margin: 6px 0 12px; }
    li { margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: ${MUTED}; font-weight: 600; margin-bottom: 24px; }
    .cover { text-align: center; padding: 80px 20px; margin-bottom: 40px; background: linear-gradient(135deg, ${NAVY} 0%, #1a1a8f 100%); border-radius: 16px; }
    .cover h1 { color: white; font-size: 34px; margin-bottom: 8px; }
    .cover .sub { color: rgba(255,255,255,0.7); font-size: 15px; font-weight: 600; }
    .cover .badge { display: inline-block; background: ${PINK}; color: white; font-size: 12px; font-weight: 700; padding: 5px 16px; border-radius: 20px; margin-top: 16px; text-transform: uppercase; letter-spacing: 0.06em; }
    .cover .version { color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 20px; font-weight: 600; }
    .mockup { border: 2px solid #e8e8f0; border-radius: 12px; padding: 18px; margin: 14px 0 18px; background: #fafaff; }
    .mockup-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e0e0ee; }
    .mockup-header .dot { width: 10px; height: 10px; border-radius: 50%; }
    .mockup-title { font-size: 12px; font-weight: 700; color: ${NAVY}; text-transform: uppercase; letter-spacing: 0.05em; }
    .mock-sidebar { width: 150px; background: ${NAVY}; border-radius: 8px; padding: 12px 10px; flex-shrink: 0; }
    .mock-sidebar-item { color: rgba(255,255,255,0.5); font-size: 10px; padding: 6px 8px; border-radius: 6px; margin-bottom: 3px; font-weight: 600; }
    .mock-sidebar-item.active { color: ${PINK}; background: rgba(255,50,133,0.15); }
    .mock-content { flex: 1; padding: 10px 14px; }
    .mock-card { background: white; border: 1px solid #e0e0ee; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
    .mock-stat { text-align: center; padding: 10px; }
    .mock-stat .val { font-size: 22px; font-weight: 700; color: ${PINK}; }
    .mock-stat .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; color: ${MUTED}; margin-top: 2px; }
    .mock-row { display: flex; gap: 8px; margin-bottom: 8px; }
    .mock-badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
    .mock-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .mock-table th { background: #f0f0f8; padding: 6px 8px; text-align: left; font-weight: 700; color: ${NAVY}; border-bottom: 2px solid #e0e0ee; }
    .mock-table td { padding: 5px 8px; border-bottom: 1px solid #eee; color: #555; }
    .mock-progress { background: #e8e8f0; border-radius: 4px; height: 6px; margin-top: 6px; }
    .mock-progress-bar { height: 100%; border-radius: 4px; }
    .mock-alert { padding: 8px 12px; border-radius: 8px; font-size: 9px; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
    .mock-tabs { display: flex; gap: 4px; background: #f0f0f8; padding: 4px; border-radius: 8px; margin-bottom: 10px; }
    .mock-tab { padding: 5px 10px; border-radius: 6px; font-size: 9px; font-weight: 700; color: ${MUTED}; }
    .mock-tab.active { background: ${PINK}; color: white; }
    .tip { background: linear-gradient(135deg, rgba(255,50,133,0.06), rgba(5,5,109,0.04)); border-left: 3px solid ${PINK}; padding: 10px 14px; border-radius: 0 8px 8px 0; margin: 10px 0 14px; font-size: 12px; }
    .footer { margin-top: 50px; padding-top: 16px; border-top: 2px solid #e0e0ee; font-size: 10px; color: ${MUTED}; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .page-break { page-break-before: always; }
    @media print {
      body { padding: 20px 28px; }
      .cover { page-break-after: always; }
      .page-break { page-break-before: always; }
    }
  `;
}

function mockWindowHeader(title) {
  return `<div class="mockup-header">
    <div class="dot" style="background:#ff5f57"></div>
    <div class="dot" style="background:#ffbd2e"></div>
    <div class="dot" style="background:#28c840"></div>
    <span class="mockup-title" style="margin-left:6px">${title}</span>
  </div>`;
}

const ADMIN_SIDEBAR_ITEMS = [
  '🏠 Tableau de bord',
  '👥 Collaborateurs',
  '🗂️ Organigramme',
  '🎯 Objectifs',
  '🏖️ Conges',
  '⚙️ Parametres',
];

function mockSidebar(items, activeIdx = 0) {
  return `<div class="mock-sidebar">
    <div style="color:white;font-weight:700;font-size:10px;padding:6px 8px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">Hello Pomelo</div>
    <div style="font-size:7px;color:#8F8FBC;padding:0 8px 8px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:6px">Suivi Collaborateurs</div>
    <div style="padding:4px 8px 2px;font-size:7px;color:#8F8FBC;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Navigation</div>
    ${items.map((it, i) => `<div class="mock-sidebar-item${i === activeIdx ? ' active' : ''}">${it}</div>`).join('')}
  </div>`;
}

function mockLayout(sidebarItems, activeIdx, contentHtml, title) {
  return `<div class="mockup">
    ${mockWindowHeader(title || 'Hello Pomelo')}
    <div style="display:flex;gap:12px">
      ${mockSidebar(sidebarItems, activeIdx)}
      <div class="mock-content">${contentHtml}</div>
    </div>
  </div>`;
}

function openGuide(title, buildContent) {
  const w = window.open('', '_blank');
  if (!w) { alert('Popup bloquee. Autorisez les popups pour ce site.'); return; }
  const ts = timestamp();
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${title}</title>
    <style>${baseStyles()}</style></head><body>${buildContent()}
    <div class="footer">
      <span>Hello Pomelo — ${title}</span>
      <span>v${APP_VERSION}</span>
      <span>Genere le ${ts}</span>
    </div></body></html>`;
  w.document.write(html);
  w.document.close();
}

// ═══════════════════════════════════════════════
//  GUIDE ADMIN
// ═══════════════════════════════════════════════

export function generateGuideAdmin() {
  const sb = ADMIN_SIDEBAR_ITEMS;

  openGuide('Guide Administrateur', () => {
    let html = '';

    // ── Cover ──
    html += `<div class="cover">
      <div style="font-size:48px;margin-bottom:12px">📘</div>
      <h1>Guide Administrateur</h1>
      <div class="sub">Hello Pomelo — Suivi Collaborateurs</div>
      <div class="badge">Version complete</div>
      <div class="version">v${APP_VERSION} · Build ${BUILD_DATE} · Genere le ${timestamp()}</div>
    </div>`;

    // ── Sommaire ──
    html += `<h2>📑 Sommaire</h2>
    <ul>
      <li><strong>1.</strong> Tableau de bord</li>
      <li><strong>2.</strong> Gestion des Collaborateurs</li>
      <li><strong>3.</strong> Profil Collaborateur</li>
      <li><strong>4.</strong> Organigramme</li>
      <li><strong>5.</strong> Objectifs (individuels et equipe)</li>
      <li><strong>6.</strong> Conges & Absences</li>
      <li><strong>7.</strong> Parametres</li>
    </ul>`;

    // ── 1. Tableau de bord ──
    html += `<div class="page-break"></div>`;
    html += `<h2>1. 🏠 Tableau de bord</h2>
    <p>Le tableau de bord offre une vue synthetique de l'activite RH. Il regroupe les indicateurs cles, les alertes et les graphiques d'analyse.</p>`;

    html += mockLayout(sb, 0, `
      <div class="mock-row">
        <div class="mock-card mock-stat" style="flex:1"><div class="val">24</div><div class="lbl">Collaborateurs</div></div>
        <div class="mock-card mock-stat" style="flex:1"><div class="val" style="color:#0000EA">2</div><div class="lbl">Arrivees ce mois</div></div>
        <div class="mock-card mock-stat" style="flex:1"><div class="val" style="color:#5BB6F4">18/24</div><div class="lbl">Points complets</div></div>
        <div class="mock-card mock-stat" style="flex:1"><div class="val" style="color:#F97316">3</div><div class="lbl">Conges en attente</div></div>
      </div>
      <div class="mock-card" style="border-left:3px solid #F97316;padding:10px 14px">
        <div style="font-size:10px;font-weight:700;color:${NAVY};margin-bottom:8px">⚠️ ACTIONS REQUISES (5)</div>
        <div style="font-size:8px;font-weight:700;color:#F97316;margin-bottom:4px">🏖️ CONGES EN ATTENTE (2)</div>
        <div class="mock-alert" style="background:#FEF3C7;color:#92400E">🏖️ Marie L. — Conges payes du 15/07 au 22/07 <span style="margin-left:auto;font-weight:700">Gerer →</span></div>
        <div style="font-size:8px;font-weight:700;color:#991B1B;margin-top:6px;margin-bottom:4px">📋 SUIVI & OBJECTIFS (3)</div>
        <div class="mock-alert" style="background:#FEE2E2;color:#991B1B">🔴 Jean D. — Point Mars non rempli <span style="margin-left:auto;font-weight:700">Voir →</span></div>
        <div class="mock-alert" style="background:#FEF3C7;color:#92400E">🎯 Paul M. — Objectif "React" expire <span style="margin-left:auto;font-weight:700">Voir →</span></div>
      </div>
      <div class="mock-row">
        <div class="mock-card" style="flex:1">
          <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:6px">OBJECTIFS PAR STATUT</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="font-size:8px;min-width:55px;text-align:right;color:${NAVY}">En cours</span><div style="flex:1;height:14px;background:#f0f0f8;border-radius:4px"><div style="width:60%;height:100%;background:#0000EA;border-radius:4px;font-size:7px;color:white;padding-left:4px;line-height:14px">8</div></div></div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="font-size:8px;min-width:55px;text-align:right;color:${NAVY}">Atteint</span><div style="flex:1;height:14px;background:#f0f0f8;border-radius:4px"><div style="width:45%;height:100%;background:#22C55E;border-radius:4px;font-size:7px;color:white;padding-left:4px;line-height:14px">6</div></div></div>
          <div style="display:flex;align-items:center;gap:6px"><span style="font-size:8px;min-width:55px;text-align:right;color:${NAVY}">En retard</span><div style="flex:1;height:14px;background:#f0f0f8;border-radius:4px"><div style="width:20%;height:100%;background:#F97316;border-radius:4px;font-size:7px;color:white;padding-left:4px;line-height:14px">2</div></div></div>
        </div>
        <div class="mock-card" style="flex:1">
          <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:6px">REPARTITION PAR EQUIPE</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="font-size:8px;min-width:55px;text-align:right;color:${NAVY}">Tech</span><div style="flex:1;height:14px;background:#f0f0f8;border-radius:4px"><div style="width:50%;height:100%;background:${PINK};border-radius:4px;font-size:7px;color:white;padding-left:4px;line-height:14px">8</div></div></div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="font-size:8px;min-width:55px;text-align:right;color:${NAVY}">Produit</span><div style="flex:1;height:14px;background:#f0f0f8;border-radius:4px"><div style="width:35%;height:100%;background:#0000EA;border-radius:4px;font-size:7px;color:white;padding-left:4px;line-height:14px">5</div></div></div>
          <div style="display:flex;align-items:center;gap:6px"><span style="font-size:8px;min-width:55px;text-align:right;color:${NAVY}">Ops</span><div style="flex:1;height:14px;background:#f0f0f8;border-radius:4px"><div style="width:25%;height:100%;background:#5BB6F4;border-radius:4px;font-size:7px;color:white;padding-left:4px;line-height:14px">4</div></div></div>
        </div>
      </div>
    `, 'Tableau de bord');

    html += `<h3>Indicateurs en haut de page</h3>
    <ul>
      <li><strong>Collaborateurs</strong> : effectif total actif</li>
      <li><strong>Arrivees ce mois</strong> : nombre de collaborateurs dont la date d'entree est dans le mois courant</li>
      <li><strong>Points complets</strong> : nombre d'entretiens mensuels remplis (manager + collab) sur le total</li>
      <li><strong>Conges en attente</strong> : demandes necessitant votre validation</li>
    </ul>
    <h3>Bloc "Actions requises"</h3>
    <ul>
      <li><strong>Conges en attente</strong> : cliquez sur "Gerer" pour acceder directement a la page Conges</li>
      <li><strong>Points non remplis</strong> : alerte rouge si ni le manager ni le collab n'ont rempli le mois precedent, orange si l'un des deux manque</li>
      <li><strong>Objectifs expires</strong> : objectifs dont la date de fin est depassee et le statut "En cours"</li>
      <li><strong>Fin de periode d'essai</strong> : alerte si la fin de PE est dans les 30 prochains jours</li>
    </ul>
    <h3>Graphiques d'analyse</h3>
    <ul>
      <li><strong>Objectifs par statut</strong> : repartition visuelle (en cours, atteint, non atteint, en attente)</li>
      <li><strong>Repartition par equipe</strong> : barres horizontales avec le nombre de collaborateurs par equipe</li>
      <li><strong>Completion points mensuels</strong> : tendance sur 6 mois du taux de completion des entretiens</li>
    </ul>
    <h3>Liste des collaborateurs</h3>
    <p>En bas de page, retrouvez tous les collaborateurs sous forme de cartes cliquables avec recherche par nom/poste et filtre par equipe.</p>
    <div class="tip">💡 <strong>Astuce :</strong> Consultez le tableau de bord chaque matin pour traiter rapidement les demandes en attente et les alertes de suivi.</div>`;

    // ── 2. Collaborateurs ──
    html += `<div class="page-break"></div>`;
    html += `<h2>2. 👥 Gestion des Collaborateurs</h2>
    <p>Cette section permet de consulter, ajouter, modifier et supprimer les collaborateurs. Le tableau est triable par colonne et filtrable par recherche.</p>`;

    html += mockLayout(sb, 1, `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="display:flex;gap:6px;align-items:center">
          <div style="font-size:11px;font-weight:700;color:${NAVY}">COLLABORATEURS</div>
          <div style="font-size:9px;color:${MUTED}">Gerer les membres de l'equipe</div>
        </div>
        <div style="font-size:9px;background:${PINK};color:white;padding:4px 12px;border-radius:8px;font-weight:700">+ Ajouter</div>
      </div>
      <div style="margin-bottom:8px"><div style="background:#f0f0f8;border-radius:8px;padding:6px 10px;font-size:9px;color:${MUTED}">🔍 Rechercher...</div></div>
      <table class="mock-table">
        <tr><th>Collaborateur ↕</th><th>Poste ↕</th><th>Equipe ↕</th><th>Manager ↕</th><th>Entree ↕</th><th>Actions</th></tr>
        <tr><td><div style="display:flex;align-items:center;gap:6px"><div style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,${PINK},${NAVY});font-size:7px;color:white;display:flex;align-items:center;justify-content:center;font-weight:700">JD</div><div><div style="font-weight:700">Jean Dupont</div><div style="font-size:8px;color:${MUTED}">jean@hp.com</div></div></div></td><td>Dev Full Stack</td><td>Tech</td><td>Sophie B.</td><td>15/03/2022</td><td><span style="color:${PINK};font-size:8px;font-weight:700">Voir ✏️ 🗑️</span></td></tr>
        <tr><td><div style="display:flex;align-items:center;gap:6px"><div style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,${PINK},${NAVY});font-size:7px;color:white;display:flex;align-items:center;justify-content:center;font-weight:700">ML</div><div><div style="font-weight:700">Marie Leroy</div><div style="font-size:8px;color:${MUTED}">marie@hp.com</div></div></div></td><td>Designer</td><td>Produit</td><td>Sophie B.</td><td>01/09/2023</td><td><span style="color:${PINK};font-size:8px;font-weight:700">Voir ✏️ 🗑️</span></td></tr>
      </table>
    `, 'Collaborateurs');

    html += `<h3>Fonctionnalites du tableau</h3>
    <ul>
      <li><strong>Tri par colonne</strong> : cliquez sur les en-tetes (Nom, Poste, Equipe, Manager, Date d'entree) pour trier</li>
      <li><strong>Recherche</strong> : filtre en temps reel par nom, poste ou email</li>
      <li><strong>Actions par ligne</strong> : "Voir" ouvre le profil, ✏️ ouvre la modale d'edition, 🗑️ supprime (avec reassignation des manages)</li>
    </ul>
    <h3>Ajouter / Modifier un collaborateur</h3>
    <p>La modale de creation/edition comporte les champs suivants :</p>
    <ul>
      <li><strong>Prenom, Nom, Poste</strong> (obligatoires)</li>
      <li><strong>Email, Telephone, Date d'entree</strong></li>
      <li><strong>Bureau, Contrat, Type de poste</strong> : listes configurables dans Parametres</li>
      <li><strong>Equipe(s)</strong> : selection multiple par cases a cocher</li>
      <li><strong>Manager</strong> : liste deroulante de tous les collaborateurs</li>
    </ul>
    <h3>Suppression</h3>
    <p>Si le collaborateur est manager d'autres personnes, une modale propose de reassigner ses manages a un autre manager avant la suppression.</p>
    <div class="tip">💡 <strong>Astuce :</strong> Utilisez le raccourci Ctrl+K dans la sidebar pour rechercher rapidement un collaborateur depuis n'importe quelle page.</div>`;

    // ── 3. Profil Collaborateur ──
    html += `<div class="page-break"></div>`;
    html += `<h2>3. 👤 Profil Collaborateur</h2>
    <p>Chaque collaborateur dispose d'une fiche detaillee avec un en-tete de profil et des onglets specialises.</p>`;

    html += `<div class="mockup">
      ${mockWindowHeader('Profil — Jean Dupont')}
      <div style="padding:10px">
        <div style="display:flex;gap:14px;align-items:center;padding:14px;background:linear-gradient(135deg,rgba(255,50,133,0.04),rgba(5,5,109,0.02));border-radius:12px;border:1px solid #e8e8f0;margin-bottom:12px">
          <div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,${PINK},${NAVY});display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;flex-shrink:0">JD</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:${NAVY}">Jean Dupont</div>
            <div style="font-size:10px;color:${MUTED}">Developpeur Full Stack · Tech</div>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <span class="mock-badge" style="background:rgba(255,50,133,0.1);color:${PINK}">CDI</span>
              <span class="mock-badge" style="background:rgba(5,5,109,0.08);color:${NAVY}">Senior</span>
              <span class="mock-badge" style="background:rgba(5,5,109,0.08);color:${NAVY}">Depuis 15/03/2022</span>
              <span class="mock-badge" style="background:rgba(5,5,109,0.08);color:${NAVY}">Manager : Sophie B.</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            <span style="font-size:8px;background:${PINK};color:white;padding:3px 8px;border-radius:6px;font-weight:700;text-align:center">✏️ Modifier</span>
            <span style="font-size:8px;background:${NAVY};color:white;padding:3px 8px;border-radius:6px;font-weight:700;text-align:center">👤 Voir comme</span>
            <span style="font-size:8px;background:#f0f0f8;color:${NAVY};padding:3px 8px;border-radius:6px;font-weight:700;text-align:center">📄 Synthese PDF</span>
          </div>
        </div>
        <div class="mock-row">
          <div class="mock-card mock-stat" style="flex:1"><div class="val">4/5</div><div class="lbl">Objectifs</div></div>
          <div class="mock-card mock-stat" style="flex:1"><div class="val" style="color:#22C55E">12j</div><div class="lbl">Conges restants</div></div>
          <div class="mock-card mock-stat" style="flex:1"><div class="val" style="color:${NAVY}">2</div><div class="lbl">Entretiens</div></div>
        </div>
        <div class="mock-tabs">
          <div class="mock-tab active">🎯 Objectifs</div>
          <div class="mock-tab">📋 Entretien RH</div>
          <div class="mock-tab">📁 Onboarding</div>
        </div>
        <div class="mock-card" style="border-left:3px solid ${PINK}">
          <div style="display:flex;justify-content:space-between"><span style="font-size:10px;font-weight:700;color:${NAVY}">Ameliorer la conversion</span><span class="mock-badge" style="background:rgba(255,50,133,0.1);color:${PINK}">En cours</span></div>
          <div class="mock-progress"><div class="mock-progress-bar" style="width:65%;background:linear-gradient(90deg,${PINK},#ff6fb0)"></div></div>
          <div style="font-size:8px;color:${MUTED};text-align:right;margin-top:2px">65%</div>
        </div>
      </div>
    </div>`;

    html += `<h3>En-tete du profil</h3>
    <ul>
      <li><strong>Avatar</strong> : photo Google ou initiales avec gradient</li>
      <li><strong>Informations</strong> : nom, poste, equipe, type de contrat, type de poste, manager, date d'entree</li>
      <li><strong>Bouton "Modifier"</strong> : ouvre la modale d'edition du collaborateur</li>
      <li><strong>Bouton "Voir comme"</strong> : ouvre l'espace collaborateur en mode impersonation (admin uniquement)</li>
      <li><strong>Bouton "Synthese PDF"</strong> : genere un PDF de synthese avec selection des sections a inclure</li>
      <li><strong>Export CSV</strong> : telechargement des donnees du collaborateur</li>
    </ul>
    <h3>Onglet "Objectifs"</h3>
    <ul>
      <li>Liste des objectifs avec barre de progression, statut, dates, recurrence</li>
      <li>Historique des modifications (journal de qui a change quoi et quand)</li>
      <li>Boutons ajouter, modifier, supprimer un objectif</li>
    </ul>
    <h3>Onglet "Entretien RH"</h3>
    <ul>
      <li><strong>Points mensuels</strong> : entretiens manager/collab automatiquement crees chaque mois</li>
      <li>Chaque point affiche les reponses du manager et du collaborateur cote a cote</li>
      <li>Verrouillage automatique apres le 5 du mois suivant</li>
      <li><strong>Entretiens formels</strong> : annuel, semestriel, fin de PE, professionnel</li>
    </ul>
    <h3>Onglet "Onboarding"</h3>
    <ul>
      <li>Checklist d'integration pour les nouveaux collaborateurs</li>
    </ul>`;

    // ── 4. Organigramme ──
    html += `<div class="page-break"></div>`;
    html += `<h2>4. 🗂️ Organigramme</h2>
    <p>Visualisez la structure hierarchique de l'entreprise. L'organigramme affiche l'arbre des relations manager → collaborateur.</p>`;

    html += mockLayout(sb, 2, `
      <div style="font-size:11px;font-weight:700;color:${NAVY};margin-bottom:10px">ORGANIGRAMME</div>
      <div style="padding:8px">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:white;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-bottom:4px">
          <div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,${PINK},${NAVY});font-size:8px;color:white;display:flex;align-items:center;justify-content:center;font-weight:700">SB</div>
          <div><div style="font-size:9px;font-weight:700;color:${NAVY}">Sophie Bernard</div><div style="font-size:7px;color:${MUTED}">Directrice</div></div>
        </div>
        <div style="margin-left:20px;border-left:2px solid #CFD0E5;padding-left:12px">
          <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:white;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-bottom:4px">
            <div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,${PINK},${NAVY});font-size:8px;color:white;display:flex;align-items:center;justify-content:center;font-weight:700">JD</div>
            <div><div style="font-size:9px;font-weight:700;color:${NAVY}">Jean Dupont</div><div style="font-size:7px;color:${MUTED}">Lead Tech</div></div>
          </div>
          <div style="margin-left:20px;border-left:2px solid #CFD0E5;padding-left:12px">
            <div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:white;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-bottom:3px"><div style="width:18px;height:18px;border-radius:50%;background:#e0e0ee;font-size:7px;color:${NAVY};display:flex;align-items:center;justify-content:center;font-weight:700">AR</div><div style="font-size:8px;font-weight:600;color:${NAVY}">Alice R. <span style="color:${MUTED}">Dev</span></div></div>
            <div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:white;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-bottom:3px"><div style="width:18px;height:18px;border-radius:50%;background:#e0e0ee;font-size:7px;color:${NAVY};display:flex;align-items:center;justify-content:center;font-weight:700">BT</div><div style="font-size:8px;font-weight:600;color:${NAVY}">Bob T. <span style="color:${MUTED}">Dev</span></div></div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:white;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-bottom:4px;margin-top:4px">
            <div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,${PINK},${NAVY});font-size:8px;color:white;display:flex;align-items:center;justify-content:center;font-weight:700">ML</div>
            <div><div style="font-size:9px;font-weight:700;color:${NAVY}">Marie Leroy</div><div style="font-size:7px;color:${MUTED}">Lead Produit</div></div>
          </div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:8px;color:${MUTED};padding:6px 10px;background:#f8f8ff;border-radius:6px">Vous pouvez reassigner un manager via les menus deroulants en bas de page.</div>
    `, 'Organigramme');

    html += `<h3>Navigation et actions</h3>
    <ul>
      <li><strong>Vue hierarchique</strong> : arbre indent avec lignes de connexion, chaque noeud est cliquable vers le profil</li>
      <li><strong>Reassignation de manager</strong> : en bas de page, selectionnez un collaborateur et un nouveau manager pour modifier la hierarchie</li>
      <li><strong>Recherche</strong> : filtrez les collaborateurs et managers dans les menus deroulants de reassignation</li>
    </ul>`;

    // ── 5. Objectifs ──
    html += `<div class="page-break"></div>`;
    html += `<h2>5. 🎯 Objectifs</h2>
    <p>Gerez les objectifs individuels et d'equipe depuis cette page. Deux onglets permettent de basculer entre les vues.</p>`;

    html += mockLayout(sb, 3, `
      <div style="font-size:11px;font-weight:700;color:${NAVY};margin-bottom:8px">OBJECTIFS</div>
      <div class="mock-tabs">
        <div class="mock-tab active">👤 Individuels</div>
        <div class="mock-tab">👥 Par equipe</div>
      </div>
      <div style="margin-bottom:8px"><select style="font-size:9px;border:1px solid #e0e0ee;border-radius:6px;padding:4px 8px;color:${NAVY};font-weight:600;width:100%"><option>— Tous les collaborateurs —</option></select></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:10px;font-weight:700;color:#0000EA;cursor:pointer">Jean Dupont — 3 objectifs</div>
        <div style="font-size:8px;background:${PINK};color:white;padding:2px 8px;border-radius:4px;font-weight:700">+ Objectif</div>
      </div>
      <div class="mock-card" style="border-left:3px solid ${PINK}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:10px;font-weight:700;color:${NAVY}">Ameliorer la conversion</span>
          <span class="mock-badge" style="background:rgba(255,50,133,0.1);color:${PINK}">En cours</span>
        </div>
        <div class="mock-progress"><div class="mock-progress-bar" style="width:65%;background:linear-gradient(90deg,${PINK},#ff6fb0)"></div></div>
        <div style="font-size:8px;color:${MUTED};display:flex;justify-content:space-between;margin-top:2px"><span>15/01 → 30/06</span><span style="color:${PINK};font-weight:700">65%</span></div>
      </div>
      <div class="mock-card" style="border-left:3px solid #22C55E">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:10px;font-weight:700;color:${NAVY}">Formation React</span>
          <span class="mock-badge" style="background:#dcfce7;color:#166534">Atteint</span>
        </div>
        <div class="mock-progress"><div class="mock-progress-bar" style="width:100%;background:#22C55E"></div></div>
      </div>
    `, 'Objectifs');

    html += `<h3>Onglet "Individuels"</h3>
    <ul>
      <li><strong>Filtre par collaborateur</strong> : selectionnez un collaborateur ou affichez tous les objectifs</li>
      <li><strong>Champs d'un objectif</strong> : titre, description, date debut/fin, statut, progression (%), recurrence</li>
      <li><strong>Statuts</strong> : En cours, Atteint, Non atteint, En attente</li>
      <li><strong>Historique</strong> : chaque modification est tracee (qui, quand, quoi)</li>
      <li><strong>Recurrence</strong> : objectifs recurrents marques avec un badge 🔄</li>
    </ul>
    <h3>Onglet "Par equipe"</h3>
    <ul>
      <li><strong>Selectionnez une equipe</strong> pour voir/ajouter des objectifs d'equipe</li>
      <li>Chaque objectif d'equipe a un titre, une date debut/fin, une barre de progression</li>
      <li>Permet de definir des objectifs collectifs partages par tous les membres de l'equipe</li>
    </ul>`;

    // ── 6. Conges ──
    html += `<div class="page-break"></div>`;
    html += `<h2>6. 🏖️ Conges & Absences</h2>
    <p>Gerez les demandes de conges avec 4 sous-onglets : En attente, Historique, Calendrier et Soldes.</p>`;

    html += mockLayout(sb, 4, `
      <div style="font-size:11px;font-weight:700;color:${NAVY};margin-bottom:8px">CONGES & ABSENCES</div>
      <div class="mock-tabs">
        <div class="mock-tab active">⏳ En attente (3)</div>
        <div class="mock-tab">📋 Historique</div>
        <div class="mock-tab">📅 Calendrier</div>
        <div class="mock-tab">💰 Soldes</div>
      </div>
      <div class="mock-card" style="border-left:3px solid #F97316;padding:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,${PINK},${NAVY});font-size:8px;color:white;display:flex;align-items:center;justify-content:center;font-weight:700">ML</div>
          <div style="flex:1">
            <div style="font-size:10px;font-weight:700;color:#0000EA">Marie Leroy</div>
            <div style="font-size:9px;color:${MUTED}">Conges payes · Du 15/07 au 22/07 · 5j ouvres</div>
            <div style="font-size:8px;color:${MUTED};font-style:italic;margin-top:2px">Vacances d'ete</div>
          </div>
          <div style="display:flex;gap:4px">
            <span style="font-size:8px;background:#22C55E;color:white;padding:3px 8px;border-radius:4px;font-weight:700">✓ Approuver</span>
            <span style="font-size:8px;background:#EF4444;color:white;padding:3px 8px;border-radius:4px;font-weight:700">✕ Refuser</span>
          </div>
        </div>
      </div>
      <div class="mock-card" style="border-left:3px solid #F97316;padding:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,${PINK},${NAVY});font-size:8px;color:white;display:flex;align-items:center;justify-content:center;font-weight:700">PM</div>
          <div style="flex:1">
            <div style="font-size:10px;font-weight:700;color:#0000EA">Paul Martin</div>
            <div style="font-size:9px;color:${MUTED}">RTT · Du 01/08 au 03/08 · 2j ouvres</div>
          </div>
          <div style="display:flex;gap:4px">
            <span style="font-size:8px;background:#22C55E;color:white;padding:3px 8px;border-radius:4px;font-weight:700">✓ Approuver</span>
            <span style="font-size:8px;background:#EF4444;color:white;padding:3px 8px;border-radius:4px;font-weight:700">✕ Refuser</span>
          </div>
        </div>
      </div>
    `, 'Conges & Absences');

    html += `<h3>Onglet "En attente"</h3>
    <ul>
      <li>Liste des demandes avec avatar, nom, type (Conges payes, RTT, Maladie, Sans solde, Autre), dates, nombre de jours ouvres, commentaire</li>
      <li><strong>Approuver</strong> : un clic valide directement la demande</li>
      <li><strong>Refuser</strong> : ouvre une modale demandant un motif de refus obligatoire</li>
      <li>Calcul automatique des jours ouvres (exclut weekends et jours feries francais incluant Paques)</li>
    </ul>
    <h3>Onglet "Historique"</h3>
    <ul>
      <li>Toutes les demandes traitees, filtrables par collaborateur</li>
      <li>Affiche le statut final (Approuve / Refuse) et le motif de refus le cas echeant</li>
    </ul>
    <h3>Onglet "Calendrier"</h3>
    <ul>
      <li>Vue mensuelle avec navigation mois precedent / suivant</li>
      <li>Affiche les absences approuvees de tous les collaborateurs sur le calendrier</li>
    </ul>
    <h3>Onglet "Soldes"</h3>
    <ul>
      <li>Solde de conges de chaque collaborateur : solde initial + jours acquis - jours pris</li>
      <li>Bouton "Modifier" pour ajuster le solde initial et le taux d'acquisition mensuel</li>
    </ul>`;

    // ── 7. Parametres ──
    html += `<div class="page-break"></div>`;
    html += `<h2>7. ⚙️ Parametres</h2>
    <p>Configurez les listes de reference, les questions d'entretien, les periodes de fermeture, les roles admin et telechargez les guides.</p>`;

    html += mockLayout(sb, 5, `
      <div style="font-size:11px;font-weight:700;color:${NAVY};margin-bottom:10px">PARAMETRES</div>
      <div class="mock-row">
        <div class="mock-card" style="flex:1">
          <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:4px">Equipes</div>
          <div style="font-size:8px;color:${MUTED};border:1px solid #e0e0ee;padding:4px 8px;border-radius:6px;margin-bottom:3px;display:flex;justify-content:space-between"><span>Tech</span><span>✏️ 🔒</span></div>
          <div style="font-size:8px;color:${MUTED};border:1px solid #e0e0ee;padding:4px 8px;border-radius:6px;margin-bottom:3px;display:flex;justify-content:space-between"><span>Produit</span><span>✏️ ✕</span></div>
        </div>
        <div class="mock-card" style="flex:1">
          <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:4px">Bureaux</div>
          <div style="font-size:8px;color:${MUTED};border:1px solid #e0e0ee;padding:4px 8px;border-radius:6px;margin-bottom:3px">Paris</div>
          <div style="font-size:8px;color:${MUTED};border:1px solid #e0e0ee;padding:4px 8px;border-radius:6px;margin-bottom:3px">Lyon</div>
        </div>
      </div>
      <div class="mock-card">
        <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:4px">Questions entretien RH mensuel</div>
        <div style="font-size:8px;color:${MUTED};background:#FEF3C7;padding:4px 8px;border-radius:4px;margin-bottom:4px;border-left:2px solid #F97316">⚠️ Modifications = mois prochain uniquement</div>
        <div style="display:flex;gap:4px">
          <div style="flex:1;font-size:8px;color:${NAVY};font-weight:600;background:#f0f0f8;padding:4px 8px;border-radius:4px">👔 Manager (4 questions)</div>
          <div style="flex:1;font-size:8px;color:${NAVY};font-weight:600;background:#f0f0f8;padding:4px 8px;border-radius:4px">👤 Collaborateur (7 questions)</div>
        </div>
      </div>
      <div class="mock-card">
        <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:4px">Guides utilisateurs</div>
        <div style="display:flex;gap:6px;margin-top:4px">
          <span style="font-size:8px;background:${PINK};color:white;padding:3px 8px;border-radius:4px;font-weight:700">📥 Guide Admin</span>
          <span style="font-size:8px;background:${NAVY};color:white;padding:3px 8px;border-radius:4px;font-weight:700">📥 Guide Collab</span>
        </div>
      </div>
    `, 'Parametres');

    html += `<h3>Listes de reference</h3>
    <ul>
      <li><strong>Equipes, Bureaux, Types de contrat, Types de poste</strong> : ajoutez, renommez (✏️) ou supprimez des valeurs</li>
      <li>Un element utilise par un collaborateur est verrouille (🔒) et ne peut pas etre supprime</li>
      <li>Le renommage propage automatiquement le changement sur tous les collaborateurs concernes</li>
    </ul>
    <h3>Questions de l'entretien RH mensuel</h3>
    <ul>
      <li>Deux editeurs independants : questions Manager et questions Collaborateur</li>
      <li>Chaque question a un libelle, un type (Texte libre ou Notation 1-5) et un indicateur obligatoire</li>
      <li>Reordonnement par fleches ▲▼, apercu du formulaire avec le bouton 👁</li>
      <li><strong>Important</strong> : les modifications ne s'appliquent qu'aux entretiens du mois suivant</li>
    </ul>
    <h3>Periodes de fermeture entreprise</h3>
    <ul>
      <li>Definissez les periodes de fermeture (ex: Noel, Aout) avec un libelle et des dates debut/fin</li>
      <li>Ces periodes sont prises en compte dans le calcul des conges</li>
    </ul>
    <h3>Administrateurs (Super Admin uniquement)</h3>
    <ul>
      <li>Le super admin (benoit@hello-pomelo.com) est permanent et ne peut pas etre retire</li>
      <li>Vous pouvez donner ou retirer le role admin a n'importe quel collaborateur</li>
      <li>Les admins accedent a l'espace de gestion complet</li>
    </ul>
    <h3>Guides utilisateurs</h3>
    <p>Telechargez les guides PDF pour les distribuer a vos equipes (le document que vous lisez actuellement !).</p>`;

    return html;
  });
}

// ═══════════════════════════════════════════════
//  GUIDE COLLABORATEUR
// ═══════════════════════════════════════════════

export function generateGuideCollab() {
  openGuide('Guide Collaborateur', () => {
    let html = '';

    // ── Cover ──
    html += `<div class="cover">
      <div style="font-size:48px;margin-bottom:12px">📗</div>
      <h1>Guide Collaborateur</h1>
      <div class="sub">Hello Pomelo — Mon espace personnel</div>
      <div class="badge">Espace collaborateur</div>
      <div class="version">v${APP_VERSION} · Build ${BUILD_DATE} · Genere le ${timestamp()}</div>
    </div>`;

    // ── Sommaire ──
    html += `<h2>📑 Sommaire</h2>
    <ul>
      <li><strong>1.</strong> Accueil — Mon espace</li>
      <li><strong>2.</strong> Mes Objectifs</li>
      <li><strong>3.</strong> Entretien RH mensuel</li>
      <li><strong>4.</strong> Mes Conges</li>
      <li><strong>5.</strong> Management (si manager)</li>
      <li><strong>6.</strong> Notifications</li>
      <li><strong>7.</strong> Connexion</li>
    </ul>`;

    // ── 1. Accueil ──
    html += `<div class="page-break"></div>`;
    html += `<h2>1. 🏠 Accueil — Mon espace</h2>
    <p>L'accueil de votre espace personnel presente votre profil, vos indicateurs cles et vos notifications.</p>`;

    html += `<div class="mockup">
      ${mockWindowHeader('Hello Pomelo — Mon espace')}
      <div style="padding:12px">
        <div style="display:flex;align-items:center;gap:12px;padding:14px;background:linear-gradient(135deg,rgba(255,50,133,0.04),rgba(5,5,109,0.02));border-radius:12px;border:1px solid #e8e8f0;margin-bottom:12px">
          <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,${PINK},${NAVY});display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px">JD</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:${NAVY}">Jean Dupont</div>
            <div style="font-size:10px;color:${MUTED}">Developpeur Full Stack · Tech</div>
          </div>
        </div>
        <div class="mock-tabs">
          <div class="mock-tab active">🏠 Accueil</div>
          <div class="mock-tab">🎯 Objectifs</div>
          <div class="mock-tab">📋 Entretien RH</div>
          <div class="mock-tab">🏖️ Conges</div>
          <div class="mock-tab">👔 Management</div>
        </div>
        <div class="mock-row">
          <div class="mock-card mock-stat" style="flex:1"><div class="val">3</div><div class="lbl">Objectifs en cours</div></div>
          <div class="mock-card mock-stat" style="flex:1"><div class="val" style="color:#22C55E">2</div><div class="lbl">Atteints</div></div>
          <div class="mock-card mock-stat" style="flex:1"><div class="val" style="color:${NAVY}">18j</div><div class="lbl">Conges restants</div></div>
        </div>
        <div class="mock-card">
          <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:4px">INFORMATIONS</div>
          <div style="font-size:9px;color:${MUTED};display:flex;gap:12px;flex-wrap:wrap">
            <span>📧 jean@hp.com</span>
            <span>📍 Paris</span>
            <span>📋 CDI</span>
            <span>👔 Manager : Sophie B.</span>
          </div>
        </div>
        <div class="mock-card">
          <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:4px">📋 POINT MENSUEL — Mars 2026</div>
          <div style="display:flex;gap:8px">
            <div style="flex:1;padding:6px;background:#f0f0f8;border-radius:6px"><div style="font-size:8px;font-weight:700;color:${NAVY}">👔 Manager</div><div style="font-size:7px;color:#22C55E;font-weight:700;margin-top:2px">✓ Rempli</div></div>
            <div style="flex:1;padding:6px;background:#FEF3C7;border-radius:6px"><div style="font-size:8px;font-weight:700;color:${NAVY}">👤 Vos reponses</div><div style="font-size:7px;color:#F97316;font-weight:700;margin-top:2px">⏳ A remplir</div></div>
          </div>
        </div>
      </div>
    </div>`;

    html += `<h3>Elements de la page d'accueil</h3>
    <ul>
      <li><strong>Carte profil</strong> : votre photo, nom, poste et equipe</li>
      <li><strong>Indicateurs</strong> : objectifs en cours, objectifs atteints, solde de conges (calcul automatique)</li>
      <li><strong>Informations</strong> : email, bureau, type de contrat, manager</li>
      <li><strong>Point mensuel</strong> : statut du point du mois en cours (rempli / a remplir) pour le manager et pour vous</li>
      <li><strong>Objectifs recents</strong> : vos objectifs en cours avec barre de progression</li>
    </ul>
    <div class="tip">💡 <strong>Astuce :</strong> Consultez votre accueil regulierement pour verifier si votre entretien mensuel est a remplir.</div>`;

    // ── 2. Objectifs ──
    html += `<div class="page-break"></div>`;
    html += `<h2>2. 🎯 Mes Objectifs</h2>
    <p>Consultez vos objectifs individuels et d'equipe, suivez votre progression.</p>`;

    html += `<div class="mockup">
      ${mockWindowHeader('Mes Objectifs')}
      <div style="padding:12px">
        <div style="font-size:11px;font-weight:700;color:${NAVY};margin-bottom:8px">MES OBJECTIFS INDIVIDUELS</div>
        <div class="mock-card" style="border-left:3px solid ${PINK}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:11px;font-weight:700;color:${NAVY}">Ameliorer le taux de conversion</div>
            <span class="mock-badge" style="background:rgba(255,50,133,0.1);color:${PINK}">En cours</span>
          </div>
          <div style="font-size:9px;color:${MUTED};margin-top:4px">Echeance : 30/06/2026 — Assigne par : Sophie B.</div>
          <div class="mock-progress" style="height:8px;margin-top:8px"><div class="mock-progress-bar" style="width:65%;background:linear-gradient(90deg,${PINK},#ff6fb0)"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px">
            <span style="font-size:8px;color:${MUTED}">Progression</span>
            <span style="font-size:8px;font-weight:700;color:${PINK}">65%</span>
          </div>
          <div style="margin-top:6px;padding:6px 8px;background:#f8f8ff;border-radius:6px">
            <div style="font-size:8px;font-weight:700;color:${NAVY};margin-bottom:3px">📜 Historique</div>
            <div style="font-size:7px;color:${MUTED}">15/03 — Admin : Progression 50% → 65%</div>
            <div style="font-size:7px;color:${MUTED}">01/02 — Admin : Creation</div>
          </div>
        </div>
        <div class="mock-card" style="border-left:3px solid #22C55E">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:11px;font-weight:700;color:${NAVY}">Formation React avancee</div>
            <span class="mock-badge" style="background:#dcfce7;color:#166534">Atteint ✓</span>
          </div>
          <div class="mock-progress" style="height:8px;margin-top:6px"><div class="mock-progress-bar" style="width:100%;background:#22C55E"></div></div>
        </div>
        <div style="margin-top:12px;font-size:11px;font-weight:700;color:${NAVY};margin-bottom:8px">OBJECTIFS D'EQUIPE — Tech</div>
        <div class="mock-card">
          <div style="font-size:10px;font-weight:700;color:${NAVY}">Migration microservices</div>
          <div class="mock-progress" style="height:6px;margin-top:4px"><div class="mock-progress-bar" style="width:40%;background:#5BB6F4"></div></div>
          <div style="font-size:8px;color:${MUTED};text-align:right;margin-top:2px">40%</div>
        </div>
      </div>
    </div>`;

    html += `<h3>Objectifs individuels</h3>
    <ul>
      <li><strong>Barre de progression</strong> : evolution visuelle en pourcentage avec code couleur</li>
      <li><strong>Statuts</strong> : En cours (rose), Atteint (vert), Non atteint (orange), En attente (gris)</li>
      <li><strong>Historique</strong> : journal des modifications (dates, auteur, changements)</li>
      <li><strong>Recurrence</strong> : certains objectifs se renouvellent automatiquement</li>
    </ul>
    <h3>Objectifs d'equipe</h3>
    <ul>
      <li>Objectifs collectifs definis par l'admin pour votre equipe</li>
      <li>Barre de progression partagee visible par tous les membres</li>
    </ul>`;

    // ── 3. Entretien RH ──
    html += `<div class="page-break"></div>`;
    html += `<h2>3. 📋 Entretien RH mensuel</h2>
    <p>Chaque mois, un point de suivi est automatiquement cree. Vous et votre manager remplissez chacun vos reponses.</p>`;

    html += `<div class="mockup">
      ${mockWindowHeader('Entretien RH — Mars 2026')}
      <div style="padding:12px">
        <div class="mock-card" style="border-left:3px solid ${PINK}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:11px;font-weight:700;color:${NAVY}">📋 Mars 2026</div>
            <span class="mock-badge" style="background:rgba(255,50,133,0.1);color:${PINK}">En cours</span>
          </div>
          <div style="display:flex;gap:8px">
            <div style="flex:1;padding:8px;background:#f0f0f8;border-radius:8px">
              <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:6px">👔 Retours manager</div>
              <div style="font-size:8px;color:${MUTED};margin-bottom:4px"><strong>Retours sur les missions :</strong></div>
              <div style="font-size:8px;color:#333;margin-bottom:6px;font-style:italic">"Excellent travail sur le projet API, livraison dans les temps."</div>
              <div style="font-size:8px;color:${MUTED};margin-bottom:4px"><strong>Taux de staffing :</strong></div>
              <div style="font-size:8px;color:#333;font-style:italic">"95% — tres bon"</div>
            </div>
            <div style="flex:1;padding:8px;background:#FFF7ED;border-radius:8px;border:1px dashed #F97316">
              <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:6px">👤 Vos reponses</div>
              <div style="font-size:8px;color:${MUTED};margin-bottom:4px"><strong>Comment vous etes-vous senti(e) ?</strong></div>
              <div style="font-size:8px;color:#F97316;font-weight:600;margin-bottom:6px">⏳ A remplir...</div>
              <div style="font-size:8px;color:${MUTED};margin-bottom:4px"><strong>Reussites du mois :</strong></div>
              <div style="font-size:8px;color:#F97316;font-weight:600">⏳ A remplir...</div>
            </div>
          </div>
        </div>
        <div class="mock-card" style="border-left:3px solid #22C55E;margin-top:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:10px;font-weight:700;color:${NAVY}">📋 Fevrier 2026</div>
            <span class="mock-badge" style="background:#dcfce7;color:#166534">Complet ✓</span>
          </div>
          <div style="font-size:8px;color:${MUTED};margin-top:4px">🔒 Verrouille le 05/03/2026</div>
        </div>
      </div>
    </div>`;

    html += `<h3>Fonctionnement</h3>
    <ul>
      <li>Un entretien mensuel est <strong>automatiquement cree</strong> chaque mois pour chaque collaborateur</li>
      <li>Le manager remplit ses retours (questions configurables par l'admin)</li>
      <li>Vous remplissez vos propres reponses de votre cote</li>
      <li>Les deux parties sont visibles cote a cote une fois remplies</li>
    </ul>
    <h3>Questions types (configurables)</h3>
    <ul>
      <li><strong>Cote manager</strong> : Retours sur les missions, Taux de staffing, Qualites, Axes d'amelioration</li>
      <li><strong>Cote collaborateur</strong> : Comment vous etes-vous senti(e), Reussites, Objectifs atteints, Suggestions, etc.</li>
      <li>Certaines questions peuvent etre de type <strong>Notation 1-5</strong> au lieu de texte libre</li>
    </ul>
    <h3>Verrouillage</h3>
    <p>Les entretiens sont <strong>verrouilles apres le 5 du mois suivant</strong>. Pensez a remplir vos reponses avant cette date !</p>
    <div class="tip">💡 <strong>Astuce :</strong> Remplissez votre entretien en debut de mois pour avoir le temps de reflechir a vos reponses.</div>`;

    // ── 4. Conges ──
    html += `<div class="page-break"></div>`;
    html += `<h2>4. 🏖️ Mes Conges</h2>
    <p>Demandez vos conges, consultez votre solde et suivez l'etat de vos demandes.</p>`;

    html += `<div class="mockup">
      ${mockWindowHeader('Mes Conges')}
      <div style="padding:12px">
        <div style="display:flex;gap:8px;margin-bottom:10px">
          <div class="mock-card mock-stat" style="flex:1;background:linear-gradient(135deg,rgba(255,50,133,0.05),rgba(5,5,109,0.03))">
            <div class="val">18j</div><div class="lbl">Conges payes</div>
          </div>
          <div class="mock-card mock-stat" style="flex:1;background:linear-gradient(135deg,rgba(255,50,133,0.05),rgba(5,5,109,0.03))">
            <div class="val" style="color:${NAVY}">5j</div><div class="lbl">RTT</div>
          </div>
        </div>
        <div style="padding:8px 10px;background:#f0f0f8;border-radius:8px;margin-bottom:10px;font-size:8px;color:${MUTED}">
          <strong style="color:${NAVY}">Calcul du solde :</strong> Solde initial (${`25j`}) + Acquis (${`10.4j`}) - Pris (${`17.4j`}) = <strong style="color:${PINK}">18j</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:10px;font-weight:700;color:${NAVY}">MES DEMANDES</div>
          <div style="font-size:9px;background:${PINK};color:white;padding:3px 10px;border-radius:6px;font-weight:700">+ Nouvelle demande</div>
        </div>
        <div class="mock-card" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:10px;font-weight:700;color:${NAVY}">15/07 → 22/07</div>
            <div style="font-size:9px;color:${MUTED}">Conges payes — 5 jours ouvres</div>
          </div>
          <span class="mock-badge" style="background:#dcfce7;color:#166534">Accepte ✓</span>
        </div>
        <div class="mock-card" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:10px;font-weight:700;color:${NAVY}">20/08 → 21/08</div>
            <div style="font-size:9px;color:${MUTED}">RTT — 2 jours ouvres</div>
          </div>
          <span class="mock-badge" style="background:#FEF3C7;color:#92400E">En attente</span>
        </div>
        <div class="mock-card" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:10px;font-weight:700;color:${NAVY}">05/03 → 05/03</div>
            <div style="font-size:9px;color:${MUTED}">Maladie — 1 jour</div>
          </div>
          <span class="mock-badge" style="background:#FEE2E2;color:#991B1B">Refuse</span>
        </div>
      </div>
    </div>`;

    html += `<h3>Solde de conges</h3>
    <ul>
      <li>Calcul automatique : <strong>Solde initial + Jours acquis - Jours pris</strong></li>
      <li>L'acquisition est de 2.08 jours/mois par defaut (modifiable par l'admin)</li>
      <li>Seuls les conges <strong>approuves</strong> de type "Conge paye" sont deduits</li>
    </ul>
    <h3>Nouvelle demande</h3>
    <ul>
      <li><strong>Types</strong> : Conge paye, RTT, Maladie, Sans solde, Autre (types configurables par l'admin)</li>
      <li><strong>Dates</strong> : selectionnez debut et fin, le nombre de jours ouvres est calcule automatiquement (weekends et jours feries exclus)</li>
      <li><strong>Demi-journee</strong> : possibilite de poser une matinee (AM) ou un apres-midi (PM) — compte 0.5 jour</li>
      <li><strong>Commentaire</strong> : ajoutez un message pour votre manager (obligatoire pour le type "Autre")</li>
      <li><strong>Verifications</strong> : solde suffisant, pas de chevauchement, pas de dates dans le passe</li>
    </ul>
    <h3>Statuts</h3>
    <ul>
      <li><span style="color:#22C55E;font-weight:700">Approuve</span> : demande validee — lien "Ajouter a l'agenda" disponible</li>
      <li><span style="color:#F97316;font-weight:700">En attente</span> : pas encore traitee — modifiable ou supprimable</li>
      <li><span style="color:#EF4444;font-weight:700">Refuse</span> : refusee avec motif visible</li>
      <li><span style="color:#8F8FBC;font-weight:700">Annule</span> : annulee suite a votre demande</li>
    </ul>
    <h3>Modifier ou annuler</h3>
    <ul>
      <li><strong>En attente</strong> : modifiez librement (✏️) ou supprimez (✕)</li>
      <li><strong>Approuvee</strong> : demandez une annulation avec motif — validee par le manager/admin</li>
    </ul>
    <h3>Calendriers et export</h3>
    <ul>
      <li><strong>Mon calendrier</strong> : vue mensuelle avec couleurs par statut, jours feries et fermetures</li>
      <li><strong>Calendrier d'equipe</strong> : absences des collegues de vos equipes</li>
      <li><strong>Export ICS</strong> : telechargez vos conges au format calendrier (.ics)</li>
    </ul>`;

    // ── 5. Management ──
    html += `<div class="page-break"></div>`;
    html += `<h2>5. 👔 Management</h2>
    <p>Si vous etes manager, un onglet supplementaire apparait pour gerer votre equipe directement depuis votre espace collaborateur.</p>`;

    html += `<div class="mockup">
      ${mockWindowHeader('Mon Equipe')}
      <div style="padding:12px">
        <div style="font-size:11px;font-weight:700;color:${NAVY};margin-bottom:10px">👔 MANAGEMENT <span class="mock-badge" style="background:${PINK};color:white;font-size:8px">2 en attente</span></div>
        <div style="font-size:10px;font-weight:700;color:${NAVY};margin-bottom:6px">CONGES EN ATTENTE DE VALIDATION</div>
        <div class="mock-card" style="border-left:3px solid #F97316;display:flex;align-items:center;gap:10px">
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,${PINK},${NAVY});font-size:9px;color:white;display:flex;align-items:center;justify-content:center;font-weight:700">AR</div>
          <div style="flex:1">
            <div style="font-size:10px;font-weight:700;color:${NAVY}">Alice R.</div>
            <div style="font-size:8px;color:${MUTED}">Conges payes · 10/07 → 15/07 · 4j</div>
          </div>
          <div style="display:flex;gap:4px">
            <span style="font-size:8px;background:#22C55E;color:white;padding:2px 6px;border-radius:4px;font-weight:700">✓</span>
            <span style="font-size:8px;background:#EF4444;color:white;padding:2px 6px;border-radius:4px;font-weight:700">✕</span>
          </div>
        </div>
        <div style="margin-top:12px;font-size:10px;font-weight:700;color:${NAVY};margin-bottom:8px">MEMBRES DE MON EQUIPE</div>
        <div class="mock-row">
          ${['Alice R.|Dev|2 obj', 'Bob T.|Dev|1 obj', 'Clara V.|QA|3 obj'].map(item => {
            const [name, role, obj] = item.split('|');
            const initials = name.split(' ').map(n => n[0]).join('');
            return `<div class="mock-card" style="flex:1;text-align:center;padding:10px">
              <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,${PINK},${NAVY});margin:0 auto 4px;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:9px">${initials}</div>
              <div style="font-size:9px;font-weight:700;color:${NAVY}">${name}</div>
              <div style="font-size:7px;color:${MUTED}">${role} · ${obj}</div>
            </div>`;
          }).join('')}
        </div>
        <div class="mock-card">
          <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:4px">REMPLIR LES ENTRETIENS MENSUELS</div>
          <div style="font-size:8px;color:${MUTED}">Selectionnez un collaborateur pour remplir vos retours manager du mois.</div>
        </div>
      </div>
    </div>`;

    html += `<h3>Validation des conges</h3>
    <ul>
      <li>Les demandes de conges de vos manages apparaissent en haut de l'onglet</li>
      <li><strong>Approuver</strong> : un clic valide la demande</li>
      <li><strong>Refuser</strong> : une modale demande un motif obligatoire</li>
      <li>Un badge sur l'onglet indique le nombre de demandes en attente</li>
    </ul>
    <h3>Vue equipe</h3>
    <ul>
      <li>Cartes des membres de votre equipe avec leur poste et nombre d'objectifs</li>
      <li>Cliquez sur un collaborateur pour voir son profil detaille</li>
    </ul>
    <h3>Entretiens mensuels (manager)</h3>
    <ul>
      <li>En tant que manager, vous remplissez les retours pour chacun de vos manages</li>
      <li>Selectionnez un collaborateur dans la liste deroulante</li>
      <li>Repondez aux questions configurees par l'admin (texte libre ou notation 1-5)</li>
      <li>Les entretiens suivent les objectifs et permettent un suivi individuel</li>
    </ul>
    <div class="tip">💡 <strong>Astuce :</strong> Traitez les demandes de conges rapidement — vos collaborateurs verront le statut mis a jour en temps reel.</div>`;

    // ── 6. Notifications ──
    html += `<div class="page-break"></div>`;
    html += `<h2>6. 🔔 Notifications</h2>
    <p>La cloche dans le header vous alerte des evenements importants.</p>
    <h3>Types de notifications</h3>
    <ul>
      <li>✅ <strong>Conge approuve</strong> : avec le nom de la personne qui a valide</li>
      <li>❌ <strong>Conge refuse</strong> : avec le motif du refus</li>
      <li>📋 <strong>Entretien RH a remplir</strong> : rappel mensuel</li>
      <li>🎯 <strong>Objectif modifie</strong> : quand votre manager modifie un objectif</li>
      <li>⚠️ <strong>Solde conges faible</strong> : alerte si moins de 3 jours</li>
      <li>🔔 <strong>Demandes equipe</strong> (managers) : conges en attente de validation</li>
    </ul>
    <p>Cliquez sur <strong>"Tout marquer comme lu"</strong> pour effacer le badge rouge. Cliquez sur une notification pour naviguer vers la section concernee.</p>`;

    // ── 7. Connexion ──
    html += `<h2>7. 🔐 Connexion</h2>
    <ul>
      <li>Connectez-vous avec votre compte Google <strong>@hello-pomelo.com</strong></li>
      <li>Votre session est conservee entre les visites (pas besoin de se reconnecter a chaque fois)</li>
      <li>L'application est installable sur votre telephone (PWA) : sur iPhone, utilisez Safari > Partager > "Sur l'ecran d'accueil"</li>
    </ul>`;

    return html;
  });
}
