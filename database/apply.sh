#!/usr/bin/env bash
# Apply the SENATRAN mock schema (and optionally sample data) to Postgres.
#   bash database/apply.sh              # apply DDL to $DB_NAME (default senatran)
#   bash database/apply.sh --full       # drop + recreate the database, then apply DDL
#   bash database/apply.sh --sample     # also load database/seed/*.sql
#   bash database/apply.sh --full --sample
set -euo pipefail

DB=${DB_NAME:-senatran}
HOST=${DB_HOST:-localhost}
PORT=${DB_PORT:-5432}
USER=${DB_USER:-postgres}
export PGPASSWORD=${DB_PASSWORD:-}
PSQL=(psql -v ON_ERROR_STOP=1 -q -h "$HOST" -p "$PORT" -U "$USER")

FULL=0; SAMPLE=0
for a in "$@"; do
  case "$a" in
    --full) FULL=1 ;;
    --sample) SAMPLE=1 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "$FULL" = 1 ]; then
  echo "Dropping and recreating database '$DB'…"
  "${PSQL[@]}" -d postgres -c "drop database if exists $DB with (force)"
  "${PSQL[@]}" -d postgres -c "create database $DB"
fi

DDL=(00-extensions 01-schemas 05-senatran-ref 10-senatran-entities \
     20-renach 21-renainf 22-audit 23-renaest 24-sne 25-cdt 26-detran 30-mock \
     90-contract-read 91-contract-transactional 92-comments)
for f in "${DDL[@]}"; do
  echo "  ddl/$f.sql"
  "${PSQL[@]}" -d "$DB" -f "$DIR/ddl/$f.sql" >/dev/null
done

if [ "$SAMPLE" = 1 ]; then
  shopt -s nullglob
  for f in "$DIR"/seed/*.sql; do
    echo "  seed/$(basename "$f")"
    "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null
  done
fi

echo "apply.sh: done (full=$FULL sample=$SAMPLE, db=$DB)"
