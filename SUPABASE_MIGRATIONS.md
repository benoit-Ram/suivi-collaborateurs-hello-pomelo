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
