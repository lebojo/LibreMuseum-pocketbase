#!/usr/bin/env bash
# Disposable test instance: fresh database, demo content, known admin account,
# on a different port from the dev one.
#
#   ./scripts/test.sh
#
# The database lives in .test-data/ and is RECREATED FROM SCRATCH on every run.
# pb_data/ is never touched: dev and test can run at the same time.
#
# Use it for anything that is hard to undo: trying a migration, breaking content
# on purpose, checking the behaviour of a blank database, pointing the mobile app
# at clean data.
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

TEST_DIR="./.test-data"
PORT="${PORT:-8091}"
ADMIN_EMAIL="test@example.org"
ADMIN_PASSWORD="testtest1234"

ensure_pocketbase

read -r -a DIRS <<<"$(pb_dirs "$TEST_DIR")"

echo "Fresh test database in $TEST_DIR/..."
rm -rf "$TEST_DIR"

"$PB_BIN" migrate up "${DIRS[@]}"
"$PB_BIN" seed "${DIRS[@]}"
# Password in clear text and versioned: this is a disposable database, never
# exposed outside the machine. Never reuse these credentials anywhere else.
"$PB_BIN" superuser upsert "$ADMIN_EMAIL" "$ADMIN_PASSWORD" --dir="$TEST_DIR" >/dev/null

cat <<EOF

  API        http://127.0.0.1:$PORT/api/app/bundle
  Dashboard  http://127.0.0.1:$PORT/_/
  Account    $ADMIN_EMAIL / $ADMIN_PASSWORD

  Ctrl-C to stop. The database stays in $TEST_DIR/ for inspection,
  and will be overwritten on the next run.

EOF

exec "$PB_BIN" serve --http="127.0.0.1:$PORT" --dev "${DIRS[@]}"
