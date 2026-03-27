# Migrations Supabase

## À exécuter dans le SQL Editor de Supabase

Ouvrez votre projet Supabase → **SQL Editor** → **New query**, collez et exécutez :

```sql
-- Ajouter les colonnes date_debut et date_fin à la table objectifs
ALTER TABLE objectifs ADD COLUMN IF NOT EXISTS date_debut date;
ALTER TABLE objectifs ADD COLUMN IF NOT EXISTS date_fin date;
```
