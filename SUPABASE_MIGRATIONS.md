# Migrations Supabase

## À exécuter dans le SQL Editor de Supabase

Ouvrez votre projet Supabase → **SQL Editor** → **New query**, collez et exécutez :

```sql
-- Ajouter les colonnes date_debut et date_fin à la table objectifs
ALTER TABLE objectifs ADD COLUMN IF NOT EXISTS date_debut date;
ALTER TABLE objectifs ADD COLUMN IF NOT EXISTS date_fin date;

-- Ajouter bureau et equipe à la table collaborateurs
ALTER TABLE collaborateurs ADD COLUMN IF NOT EXISTS bureau text;
ALTER TABLE collaborateurs ADD COLUMN IF NOT EXISTS equipe text;
```

## Migration v1.5 — Colonnes manquantes

```sql
-- Type de contrat et type de poste (si pas encore créés)
ALTER TABLE collaborateurs ADD COLUMN IF NOT EXISTS contrat text;
ALTER TABLE collaborateurs ADD COLUMN IF NOT EXISTS type_poste text;
```

## Migration v2 — Nouvelles fonctionnalités

```sql
-- Progression des objectifs (0-100%)
ALTER TABLE objectifs ADD COLUMN IF NOT EXISTS progression integer DEFAULT 0;

-- Notes RH libres et fin de période d'essai sur les collaborateurs
ALTER TABLE collaborateurs ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE collaborateurs ADD COLUMN IF NOT EXISTS date_fin_essai date;
```

> **Note :** Les entretiens annuels utilisent la table `points_suivi` existante avec le champ `type`
> valorisé à `'annuel'`, `'semestriel'`, `'fin_pe'` ou `'professionnel'` (au lieu de `'mensuel'`).

## Migration v3 — Un seul point mensuel par collaborateur

```sql
-- Empêcher les doublons : un seul point mensuel par collaborateur par mois
CREATE UNIQUE INDEX IF NOT EXISTS unique_point_mensuel_par_mois
  ON points_suivi (collaborateur_id, mois)
  WHERE type = 'mensuel';
```

## Migration v4 — Congés & Absences

```sql
-- Table des absences
CREATE TABLE IF NOT EXISTS absences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborateur_id uuid REFERENCES collaborateurs(id) ON DELETE CASCADE,
  type text NOT NULL,
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  statut text DEFAULT 'en_attente',
  commentaire text,
  created_at timestamptz DEFAULT now()
);

-- Solde et acquisition de congés sur les collaborateurs
ALTER TABLE collaborateurs ADD COLUMN IF NOT EXISTS solde_conges numeric DEFAULT 0;
ALTER TABLE collaborateurs ADD COLUMN IF NOT EXISTS acquisition_conges numeric DEFAULT 2.08;

-- Valideur de congés (par défaut le manager si non renseigné)
ALTER TABLE collaborateurs ADD COLUMN IF NOT EXISTS valideur_conges_id uuid REFERENCES collaborateurs(id);

-- Motif de refus des absences
ALTER TABLE absences ADD COLUMN IF NOT EXISTS motif_refus text;

-- Photo de profil (récupérée automatiquement depuis Google)
ALTER TABLE collaborateurs ADD COLUMN IF NOT EXISTS photo_url text;

-- Index unique sur settings.key pour upsert
CREATE UNIQUE INDEX IF NOT EXISTS settings_key_unique ON settings(key);
```

## Migration v5 — Demandes de modification d'objectifs

```sql
CREATE TABLE IF NOT EXISTS objectif_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  objectif_id uuid REFERENCES objectifs(id) ON DELETE CASCADE,
  collaborateur_id uuid REFERENCES collaborateurs(id) ON DELETE CASCADE,
  manager_id uuid REFERENCES collaborateurs(id),
  type text NOT NULL,
  data jsonb,
  statut text DEFAULT 'en_attente',
  motif text,
  motif_refus text,
  created_at timestamptz DEFAULT now()
);

-- Récurrence des objectifs (hebdo, mensuel)
ALTER TABLE objectifs ADD COLUMN IF NOT EXISTS recurrence text;

-- Historique des modifications d'objectifs
ALTER TABLE objectifs ADD COLUMN IF NOT EXISTS historique jsonb DEFAULT '[]';

-- Demi-journées de congé
ALTER TABLE absences ADD COLUMN IF NOT EXISTS demi_journee text;

-- Journal d'activité
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  auteur text,
  cible text,
  details text,
  created_at timestamptz DEFAULT now()
);
```

## Migration v6 — Rôles Admin

```sql
-- Colonne admin sur les collaborateurs
ALTER TABLE collaborateurs ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Super admin
UPDATE collaborateurs SET is_admin = true WHERE email = 'benoit@hello-pomelo.com';
```
