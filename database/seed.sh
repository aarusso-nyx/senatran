#!/usr/bin/env bash
# (Re)generate deterministic sample data and load it into Postgres.
# Equivalent to: pnpm seed:generate && load database/seed/*.sql
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"

echo "Generating seed SQL…"
(cd "$ROOT" && pnpm -s seed:generate)

DB=${DB_NAME:-senatran}
HOST=${DB_HOST:-localhost}
PORT=${DB_PORT:-5432}
USER=${DB_USER:-postgres}
export PGPASSWORD=${DB_PASSWORD:-}
PSQL=(psql -v ON_ERROR_STOP=1 -q -h "$HOST" -p "$PORT" -U "$USER")

shopt -s nullglob
for f in "$DIR"/seed/*.sql; do
  echo "  seed/$(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null
done

echo "seed.sh: done (db=$DB)"
