// Types Kysely pour la base — reflète 1:1 le schéma Postgres.
// À regénérer via `kysely-codegen` quand des migrations changent le schéma.
//
// Conventions :
// - `Generated<T>` : colonne avec DEFAULT (optionnelle à l'insert, retournée T au select).
// - `date` Postgres : récupérée en Date par pg, insertable en string 'YYYY-MM-DD' ou Date.
// - `numeric` : récupéré en string par pg (préserve la précision), insertable en string | number.
// - `jsonb` : parsé en objet JS par pg, insertable en objet ou string JSON.
// - `timestamptz` : Date par pg (ok).

import type { Generated } from 'kysely';

type Numeric = string;                   // pg renvoie numeric en string par défaut
type NumericIn = string | number;        // mais on accepte un nombre à l'insert
type PgDate = Date | string;             // date : accepté string 'YYYY-MM-DD' ou Date

export interface Database {
  collaborateurs: CollaborateursTable;
  clients: ClientsTable;
  missions: MissionsTable;
  objectifs: ObjectifsTable;
  points_suivi: PointsSuiviTable;
  absences: AbsencesTable;
  objectif_requests: ObjectifRequestsTable;
  activity_log: ActivityLogTable;
  assignments: AssignmentsTable;
  time_entries: TimeEntriesTable;
  staffing_requests: StaffingRequestsTable;
  settings: SettingsTable;
}

export interface CollaborateursTable {
  id: Generated<string>;
  prenom: string;
  nom: string;
  poste: string;
  email: string | null;
  telephone: string | null;
  date_entree: PgDate | null;
  manager_id: string | null;
  onboarding: Generated<any>;
  created_at: Generated<Date>;
  bureau: string | null;
  equipe: string | null;
  contrat: string | null;
  type_poste: string | null;
  notes: string | null;
  date_fin_essai: PgDate | null;
  solde_conges: Generated<Numeric>;
  acquisition_conges: Generated<Numeric>;
  valideur_conges_id: string | null;
  google_drive: string | null;
  photo_url: string | null;
  is_admin: Generated<boolean>;
  solde_rtt: Generated<Numeric>;
  cycle_conges_debut: PgDate | null;
  competences: Generated<string[] | any>;
  missions_access: Generated<boolean>;
  solde_reference_date: PgDate | null;
  groupe_entretien: string | null;
  objectifs_access: Generated<boolean>;
  entretiens_access: Generated<boolean>;
}

export interface ClientsTable {
  id: Generated<string>;
  nom: string;
  description: string | null;
  secteur: string | null;
  contact_nom: string | null;
  contact_email: string | null;
  actif: Generated<boolean>;
  created_at: Generated<Date>;
  siren: string | null;
  tva_intra: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  referent_id: string | null;
  contact_signature_nom: string | null;
  contact_signature_email: string | null;
  contact_signature_tel: string | null;
  contact_facturation_nom: string | null;
  contact_facturation_email: string | null;
  contact_facturation_tel: string | null;
  siret: string | null;
  categorie_entreprise: string | null;
}

export interface MissionsTable {
  id: Generated<string>;
  nom: string;
  client: string;
  description: string | null;
  categorie: string | null;
  statut: Generated<string>;
  date_debut: PgDate | null;
  date_fin: PgDate | null;
  tjm: Numeric | null;
  budget_vendu: Numeric | null;
  methode_facturation: string | null;
  responsable_id: string | null;
  created_at: Generated<Date>;
  client_id: string | null;
  lien_propale: string | null;
}

export interface ObjectifsTable {
  id: Generated<string>;
  collaborateur_id: string | null;
  titre: string | null;
  description: string | null;
  echeance: PgDate | null;
  statut: Generated<string>;
  progression: Generated<number>;
  created_at: Generated<Date>;
  date_debut: PgDate | null;
  date_fin: PgDate | null;
  recurrence: string | null;
  historique: Generated<any[] | any>;
  parent_id: string | null;
  periode: string | null;
}

export interface PointsSuiviTable {
  id: Generated<string>;
  collaborateur_id: string | null;
  type: Generated<string>;
  date: PgDate | null;
  contenu: Generated<string>;
  actions: string | null;
  created_at: Generated<Date>;
  mois: string | null;
  manager_data: Generated<Record<string, any>>;
  collab_data: Generated<Record<string, any>>;
}

export interface AbsencesTable {
  id: Generated<string>;
  collaborateur_id: string | null;
  type: string;
  date_debut: PgDate;
  date_fin: PgDate;
  statut: Generated<string>;
  commentaire: string | null;
  created_at: Generated<Date>;
  motif_refus: string | null;
  demi_journee: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  commentaire_annulation: string | null;
}

export interface ObjectifRequestsTable {
  id: Generated<string>;
  objectif_id: string | null;
  collaborateur_id: string | null;
  manager_id: string | null;
  type: string;
  data: any | null;
  statut: Generated<string>;
  motif: string | null;
  motif_refus: string | null;
  created_at: Generated<Date>;
}

export interface ActivityLogTable {
  id: Generated<string>;
  action: string;
  auteur: string | null;
  cible: string | null;
  details: string | null;
  created_at: Generated<Date>;
}

export interface AssignmentsTable {
  id: Generated<string>;
  mission_id: string | null;
  collaborateur_id: string | null;
  role: string | null;
  taux_staffing: Generated<Numeric>;
  tjm: Numeric | null;
  date_debut: PgDate | null;
  date_fin: PgDate | null;
  statut: Generated<string>;
  created_at: Generated<Date>;
  jours_par_semaine: Generated<Numeric>;
  staffing_overrides: Generated<Record<string, number> | any>;
  notes: string | null;
}

export interface TimeEntriesTable {
  id: Generated<string>;
  assignment_id: string | null;
  collaborateur_id: string | null;
  date: PgDate;
  temps_prevu: Generated<Numeric>;
  temps_reel: Numeric | null;
  commentaire: string | null;
  statut: Generated<string>;
  created_at: Generated<Date>;
}

export interface StaffingRequestsTable {
  id: Generated<string>;
  mission_id: string | null;
  collaborateur_id: string | null;
  demandeur_id: string | null;
  role: string | null;
  jours_par_semaine: Generated<Numeric>;
  date_debut: PgDate | null;
  date_fin: PgDate | null;
  motif: string | null;
  statut: Generated<string>;
  motif_refus: string | null;
  created_at: Generated<Date>;
}

export interface SettingsTable {
  key: string;
  value: Generated<any>;
}

// Helpers Numeric/PgDate pour les imports côté services si besoin
export type { Numeric, NumericIn, PgDate };
