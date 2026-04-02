# CLAUDE.md — Suivi Collaborateurs Hello Pomelo

## Projet

Application RH interne de suivi des collaborateurs pour Hello Pomelo. Gestion des objectifs, entretiens mensuels, congés, organigramme.

## Stack technique

- **Frontend** : React 19 + Vite 8, React Router 7, CSS vanilla avec variables (pas de framework CSS)
- **Backend** : NestJS 11 + TypeScript, API REST préfixée `/api`
- **Base de données** : Supabase (PostgreSQL) — client JS `@supabase/supabase-js`
- **Pas d'auth** : mode démo avec sélecteur de compte + impersonation admin via `?impersonate=<id>`

## Structure du projet

```
backend/src/
  config/supabase.service.ts     # Client Supabase (singleton injectable)
  modules/
    collaborateurs/              # CRUD collaborateurs + relations
    objectifs/                   # CRUD objectifs individuels
    points-suivi/                # Entretiens RH mensuels
    absences/                    # Demandes de congés
    settings/                    # Paramètres clé-valeur (upsert)
  main.ts                        # Bootstrap NestJS, CORS, port 4000

frontend/src/
  services/
    api.js                       # Fetch wrapper, auto-détecte dev/prod URL
    DataContext.jsx               # React Context global (collabs, absences, settings, toast)
  components/
    UI.jsx                       # Composants partagés (Avatar, Badge, Modal, fmtDate, countWorkDays…)
    Sidebar.jsx                  # Navigation + recherche globale + dark mode toggle
    SynthesePDFModal.jsx         # Export PDF avec sélection de contenu
  pages/
    admin/                       # Dashboard, Collaborateurs, CollabProfile, Objectifs, Absences, Organigramme, Settings
    collab/                      # CollabAccueil (portail collaborateur)
  styles/global.css              # Design system CSS (variables, dark mode, composants)
```

## Commandes

```bash
npm run dev              # Lance frontend + backend en parallèle
npm run dev:frontend     # Vite dev server (port 3000)
npm run dev:backend      # NestJS avec ts-node (port 4000)
npm run build:frontend   # Build Vite production
npm run build:backend    # Compile TS → dist/
```

## Variables d'environnement (backend/.env)

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=<clé publique>
PORT=4000
FRONTEND_URL=http://localhost:3000   # Pour CORS
```

## Conventions de code

### Backend

- Chaque module = `controller.ts` + `service.ts` + `module.ts`
- Les services utilisent `this.supabase.db.from('table')` pour les requêtes
- `findOne` retourne **404** (NOT_FOUND), les erreurs de validation retournent **400** (BAD_REQUEST)
- Les `update` utilisent `.select().single()` pour retourner l'objet mis à jour
- Les filtres `findAll` passent par `@Query()` et sont appliqués avec `.eq(key, val)`
- Les DTOs sont typés `any` (pas de validation class-validator pour l'instant)

### Frontend

- **État global** via `useData()` (DataContext) — ne PAS dupliquer l'état local sauf dans CollabAccueil (portail collab qui a son propre chargement)
- **Styles** : inline styles avec CSS variables (`var(--pink)`, `var(--navy)`, etc.) — pas de CSS modules
- **Dark mode** : utiliser les variables sémantiques pour les couleurs contextuelles :
  - `var(--bg-danger)` / `var(--text-danger)` / `var(--border-danger)` — erreurs, refus
  - `var(--bg-warning)` / `var(--text-warning)` / `var(--border-warning)` — alertes, en attente
  - `var(--bg-success)` / `var(--text-success)` — approbations, validations
  - `var(--bg-info)` / `var(--text-info)` — informations, jours fériés
  - `var(--bg-accent)` / `var(--text-accent)` — sélections, highlights
  - `var(--white)`, `var(--offwhite)`, `var(--navy)`, `var(--muted)` — jamais de `'white'` ou `'#FFF'` hardcodé
- **Composants UI** : réutiliser ceux de `components/UI.jsx` (Avatar, Badge, Modal, ProgressBar, EmptyState, PageHeader)
- **Fonctions utilitaires** existantes (ne pas recréer) :
  - `fmtDate(dateStr)` — formatte une date en JJ/MM/AAAA
  - `countWorkDays(debut, fin)` — calcule les jours ouvrés (exclut weekends + fériés français)
  - `currentMois()` — retourne le mois courant en YYYY-MM
  - `moisLabel(mois)` — retourne "Janvier 2025" depuis "2025-01"
  - `isEntretienLocked(mois)` — verrouillé après le 5 du mois suivant
- **Boutons** : `.btn .btn-primary`, `.btn .btn-ghost`, `.btn .btn-danger`, `.btn .btn-navy`, `.btn-sm` pour petit
- **Export PDF** : `window.open()` + `document.write()` + `setTimeout(() => win.print(), 300)` — toujours ajouter un null guard pour les popups bloqués

### Gestion des erreurs

- Les appels API dans les composants doivent toujours être wrappés dans `try/catch`
- Utiliser `showToast('message')` (via DataContext) pour le feedback utilisateur dans les pages admin
- Utiliser `alert()` pour les erreurs critiques dans le portail collab (pas de toast disponible)
- Ne jamais laisser un `catch(e) {}` vide — au minimum logger avec `console.error`

### CSS & Dark mode

- Le dark mode utilise `[data-theme="dark"]` sur `<html>`, toggle via Sidebar
- Toutes les couleurs de fond contextuelles doivent passer par les CSS variables sémantiques
- Les ombres s'adaptent automatiquement via `--shadow-sm/md/lg`
- Les hover en dark mode utilisent `var(--hover-row)`, `var(--hover-surface)`, `var(--hover-ghost)`

## Base de données

Tables principales : `collaborateurs`, `objectifs`, `points_suivi`, `absences`, `settings`

- Les `settings` utilisent un modèle clé-valeur JSONB (upsert sur `key`)
- Les `points_suivi` ont une contrainte d'unicité : un seul point mensuel par collaborateur par mois
- Les questions d'entretien sont stockées dans `settings` sous les clés `questions_manager` et `questions_collab`
- Les objectifs d'équipe sont stockés dans `settings` sous les clés `team_objectifs_<nom_equipe>`
- Les migrations sont documentées dans `SUPABASE_MIGRATIONS.md`

## Points d'attention

- Le calcul des congés exclut weekends + jours fériés français (incluant Pâques et fêtes mobiles) — voir `countWorkDays` dans `UI.jsx`
- Les entretiens mensuels sont auto-créés par le DataContext au chargement si absents pour le mois courant
- Un entretien est verrouillé (non modifiable) après le 5 du mois suivant
- Lors de la suppression d'un collaborateur manager, proposer la réassignation de ses managés
- Le VPS de production (`141.94.92.9`) nécessite `--host 0.0.0.0` pour Vite et le binding NestJS
