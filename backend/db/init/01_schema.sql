-- Schema initial — reproduit la Supabase actuelle sur un Postgres natif.
-- Généré depuis l'inventaire des tables avant la refonte Kysely.

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

-- ═══════════════════════════════════════════════════════════════
-- 12. SETTINGS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb DEFAULT '[]'::jsonb
);
