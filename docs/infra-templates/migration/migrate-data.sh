#!/usr/bin/env bash
# Migration data Supabase cloud → Managed PostgreSQL Digital Ocean.
#
# À lancer UNE SEULE FOIS quand on cutover. Idempotent via --clean côté
# pg_restore mais : tu perds toute la data déjà présente dans la cible !
#
# Prérequis : pg_dump + pg_restore version >= 15 (Supabase utilise PG 17,
# DO Managed aussi). Installé par défaut dans l'image postgres:17-alpine.

set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# Config — à surcharger via env vars avant de lancer
# ═══════════════════════════════════════════════════════════════
SOURCE_URL="${SUPABASE_DB_URL:?SUPABASE_DB_URL requis (postgres://postgres:...@db.xxx.supabase.co:5432/postgres)}"
TARGET_URL="${DO_DB_URL:?DO_DB_URL requis (postgres://doadmin:...@xxx.db.ondigitalocean.com:25060/suivi_collaborateurs?sslmode=require)}"
DUMP_FILE="${DUMP_FILE:-/tmp/suivi-collaborateurs-$(date +%Y%m%d-%H%M%S).dump}"
TABLES="${TABLES:-public.collaborateurs public.clients public.missions public.objectifs public.points_suivi public.absences public.objectif_requests public.activity_log public.assignments public.time_entries public.staffing_requests public.settings}"

echo "─────────────────────────────────────────────────"
echo " Migration Supabase → DO Managed PostgreSQL"
echo "─────────────────────────────────────────────────"
echo " Source : ${SOURCE_URL//:*@/:***@}"
echo " Cible  : ${TARGET_URL//:*@/:***@}"
echo " Dump   : $DUMP_FILE"
echo " Tables : $TABLES"
echo "─────────────────────────────────────────────────"

read -rp "Confirmer la migration (y/N) : " confirm
[[ "$confirm" == "y" || "$confirm" == "Y" ]] || { echo "Annulé."; exit 0; }

# ═══════════════════════════════════════════════════════════════
# 1. Dump de la source (format custom pour le parallel restore)
# ═══════════════════════════════════════════════════════════════
echo "→ 1/3 pg_dump depuis Supabase..."
TABLE_ARGS=""
for t in $TABLES; do TABLE_ARGS="$TABLE_ARGS -t $t"; done
pg_dump "$SOURCE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --no-publications \
  --no-subscriptions \
  --no-security-labels \
  --no-tablespaces \
  $TABLE_ARGS \
  --file="$DUMP_FILE"

SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "   dump OK ($SIZE)"

# ═══════════════════════════════════════════════════════════════
# 2. S'assurer que le schéma cible est là (DatabaseModule le crée au boot,
#    mais on lance le DDL explicite pour ne pas dépendre d'un ordre magique)
# ═══════════════════════════════════════════════════════════════
echo "→ 2/3 Appliquer le schema DDL sur la cible (si pas déjà fait)..."
psql "$TARGET_URL" -f ../../backend/db/init/01_schema.sql -v ON_ERROR_STOP=1 2>&1 | tail -3 || true

# ═══════════════════════════════════════════════════════════════
# 3. Restore des data uniquement (--data-only : on garde le schema DDL
#    ci-dessus qui a les bons DEFAULT et contraintes)
# ═══════════════════════════════════════════════════════════════
echo "→ 3/3 pg_restore vers Digital Ocean..."
pg_restore "$DUMP_FILE" \
  --dbname="$TARGET_URL" \
  --data-only \
  --disable-triggers \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  --jobs=1

# Vérification
echo "→ Vérification counts..."
psql "$TARGET_URL" -tA -c "
SELECT 'collaborateurs: ' || COUNT(*) FROM collaborateurs
UNION ALL SELECT 'missions: ' || COUNT(*) FROM missions
UNION ALL SELECT 'clients: ' || COUNT(*) FROM clients
UNION ALL SELECT 'settings: ' || COUNT(*) FROM settings
UNION ALL SELECT 'absences: ' || COUNT(*) FROM absences
UNION ALL SELECT 'objectifs: ' || COUNT(*) FROM objectifs;
"

echo "✅ Migration terminée. Dump conservé : $DUMP_FILE"
echo "   → Backup ce dump quelque part de sûr avant de supprimer la Supabase."
