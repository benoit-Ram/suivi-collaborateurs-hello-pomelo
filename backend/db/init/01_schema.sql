-- Schema de référence — Managed Postgres (DigitalOcean fra1, PG 18).
-- Source de vérité pour un `psql -f` sur une base vide.
-- Toute évolution passe par un ALTER à ajouter en fin de fichier + MAJ miroir
-- dans backend/src/config/database.types.ts (types Kysely).
--
-- Appliqué via : psql "$DATABASE_URL" -f 01_schema.sql
-- Idempotent (CREATE ... IF NOT EXISTS partout).

-- gen_random_uuid() : natif en PG 13+, mais on force l'extension pour
-- supporter les restores sur une image PG antérieure si besoin.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══════════════════════════════════════════════════════════════
-- 1. COLLABORATEURS (table racine, self-référence)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.collaborateurs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prenom text NOT NULL,
  nom text NOT NULL,
  poste text NOT NULL,
  email text,
  telephone text,
  date_entree date,
  manager_id uuid REFERENCES public.collaborateurs(id),
  onboarding jsonb DEFAULT '{"acces": "", "notes": "", "materiel": "", "documents": {"cni": false, "rib": false, "dpae": false, "contrat": false, "mutuelle": false, "fichePoste": false, "attestationSecu": false, "casierJudiciaire": false}}'::jsonb,
  created_at timestamptz DEFAULT now(),
  bureau text,
  equipe text,
  contrat text,
  type_poste text,
  notes text,
  date_fin_essai date,
  solde_conges numeric DEFAULT 0,
  acquisition_conges numeric DEFAULT 2.08,
  valideur_conges_id uuid REFERENCES public.collaborateurs(id),
  google_drive text,
  photo_url text,
  is_admin boolean DEFAULT false,
  solde_rtt numeric DEFAULT 0,
  cycle_conges_debut date,
  competences jsonb DEFAULT '[]'::jsonb,
  missions_access boolean DEFAULT false,
  solde_reference_date date,
  groupe_entretien text,
  objectifs_access boolean DEFAULT false,
  entretiens_access boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_collaborateurs_manager_id ON public.collaborateurs(manager_id);
CREATE INDEX IF NOT EXISTS idx_collaborateurs_valideur_conges_id ON public.collaborateurs(valideur_conges_id);
-- Recherche par email (lookup à l'auth Google)
CREATE INDEX IF NOT EXISTS idx_collaborateurs_email_lower ON public.collaborateurs(lower(email));

-- ═══════════════════════════════════════════════════════════════
-- 2. CLIENTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  description text,
  secteur text,
  contact_nom text,
  contact_email text,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  siren text,
  tva_intra text,
  adresse text,
  code_postal text,
  ville text,
  referent_id uuid REFERENCES public.collaborateurs(id),
  contact_signature_nom text,
  contact_signature_email text,
  contact_signature_tel text,
  contact_facturation_nom text,
  contact_facturation_email text,
  contact_facturation_tel text,
  siret text,
  categorie_entreprise text
);

CREATE INDEX IF NOT EXISTS idx_clients_referent_id ON public.clients(referent_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. MISSIONS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.missions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  client text NOT NULL,
  description text,
  categorie text,
  statut text DEFAULT 'en_cours',
  date_debut date,
  date_fin date,
  tjm numeric,
  budget_vendu numeric,
  methode_facturation text,
  responsable_id uuid REFERENCES public.collaborateurs(id),
  created_at timestamptz DEFAULT now(),
  client_id uuid REFERENCES public.clients(id),
  lien_propale text
);

CREATE INDEX IF NOT EXISTS idx_missions_client_id ON public.missions(client_id);
CREATE INDEX IF NOT EXISTS idx_missions_responsable_id ON public.missions(responsable_id);
CREATE INDEX IF NOT EXISTS idx_missions_statut ON public.missions(statut);

-- ═══════════════════════════════════════════════════════════════
-- 4. OBJECTIFS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.objectifs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborateur_id uuid REFERENCES public.collaborateurs(id),
  titre text,
  description text,
  echeance date,
  statut text DEFAULT 'en-attente',
  progression integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  date_debut date,
  date_fin date,
  recurrence text,
  historique jsonb DEFAULT '[]'::jsonb,
  parent_id uuid REFERENCES public.objectifs(id) ON DELETE SET NULL,
  periode text
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_objectif_parent_periode
  ON public.objectifs (parent_id, periode)
  WHERE parent_id IS NOT NULL AND periode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_objectifs_collaborateur_id ON public.objectifs(collaborateur_id);
CREATE INDEX IF NOT EXISTS idx_objectifs_parent_id ON public.objectifs(parent_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. POINTS_SUIVI (entretiens RH)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.points_suivi (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborateur_id uuid REFERENCES public.collaborateurs(id),
  type text DEFAULT 'mensuel',
  date date,
  contenu text DEFAULT '',
  actions text,
  created_at timestamptz DEFAULT now(),
  mois text,
  manager_data jsonb DEFAULT '{}'::jsonb,
  collab_data jsonb DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_point_mensuel_par_mois
  ON public.points_suivi (collaborateur_id, mois)
  WHERE type = 'mensuel';

CREATE INDEX IF NOT EXISTS idx_points_suivi_collaborateur_id ON public.points_suivi(collaborateur_id);
CREATE INDEX IF NOT EXISTS idx_points_suivi_mois ON public.points_suivi(mois);

-- ═══════════════════════════════════════════════════════════════
-- 6. ABSENCES
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.absences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborateur_id uuid REFERENCES public.collaborateurs(id) ON DELETE CASCADE,
  type text NOT NULL,
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  statut text DEFAULT 'en_attente',
  commentaire text,
  created_at timestamptz DEFAULT now(),
  motif_refus text,
  demi_journee text,
  approved_by text,
  approved_at timestamptz,
  commentaire_annulation text
);

CREATE INDEX IF NOT EXISTS idx_absences_collaborateur_id ON public.absences(collaborateur_id);
CREATE INDEX IF NOT EXISTS idx_absences_statut ON public.absences(statut);
-- Range queries (planning, détection de chevauchements) : index composite sur les dates
CREATE INDEX IF NOT EXISTS idx_absences_dates ON public.absences(date_debut, date_fin);

-- ═══════════════════════════════════════════════════════════════
-- 7. OBJECTIF_REQUESTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.objectif_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  objectif_id uuid REFERENCES public.objectifs(id) ON DELETE CASCADE,
  collaborateur_id uuid REFERENCES public.collaborateurs(id) ON DELETE CASCADE,
  manager_id uuid REFERENCES public.collaborateurs(id),
  type text NOT NULL,
  data jsonb,
  statut text DEFAULT 'en_attente',
  motif text,
  motif_refus text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_objectif_requests_objectif_id ON public.objectif_requests(objectif_id);
CREATE INDEX IF NOT EXISTS idx_objectif_requests_collaborateur_id ON public.objectif_requests(collaborateur_id);
CREATE INDEX IF NOT EXISTS idx_objectif_requests_statut ON public.objectif_requests(statut);

-- ═══════════════════════════════════════════════════════════════
-- 8. ACTIVITY_LOG
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  auteur text,
  cible text,
  details text,
  created_at timestamptz DEFAULT now()
);

-- Pagination du log par date desc
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 9. ASSIGNMENTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE,
  collaborateur_id uuid REFERENCES public.collaborateurs(id) ON DELETE CASCADE,
  role text,
  taux_staffing numeric DEFAULT 100,
  tjm numeric,
  date_debut date,
  date_fin date,
  statut text DEFAULT 'actif',
  created_at timestamptz DEFAULT now(),
  jours_par_semaine numeric DEFAULT 5,
  staffing_overrides jsonb DEFAULT '{}'::jsonb,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_assignments_mission_id ON public.assignments(mission_id);
CREATE INDEX IF NOT EXISTS idx_assignments_collaborateur_id ON public.assignments(collaborateur_id);
CREATE INDEX IF NOT EXISTS idx_assignments_statut ON public.assignments(statut);

-- ═══════════════════════════════════════════════════════════════
-- 10. TIME_ENTRIES
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE,
  collaborateur_id uuid REFERENCES public.collaborateurs(id),
  date date NOT NULL,
  temps_prevu numeric DEFAULT 1,
  temps_reel numeric,
  commentaire text,
  statut text DEFAULT 'planifie',
  created_at timestamptz DEFAULT now(),
  UNIQUE(assignment_id, date)
);

-- Les écrans staffing filtrent par collab + plage de dates
CREATE INDEX IF NOT EXISTS idx_time_entries_collaborateur_date ON public.time_entries(collaborateur_id, date);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(date);

-- ═══════════════════════════════════════════════════════════════
-- 11. STAFFING_REQUESTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.staffing_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE,
  collaborateur_id uuid REFERENCES public.collaborateurs(id) ON DELETE CASCADE,
  demandeur_id uuid REFERENCES public.collaborateurs(id),
  role text,
  jours_par_semaine numeric DEFAULT 5,
  date_debut date,
  date_fin date,
  motif text,
  statut text DEFAULT 'en_attente',
  motif_refus text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staffing_requests_mission_id ON public.staffing_requests(mission_id);
CREATE INDEX IF NOT EXISTS idx_staffing_requests_collaborateur_id ON public.staffing_requests(collaborateur_id);
CREATE INDEX IF NOT EXISTS idx_staffing_requests_statut ON public.staffing_requests(statut);

-- ═══════════════════════════════════════════════════════════════
-- 12. SETTINGS (clé-valeur JSONB)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb DEFAULT '[]'::jsonb
);
