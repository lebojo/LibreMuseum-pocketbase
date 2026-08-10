#!/usr/bin/env bash
# Runs PocketBase locally: downloads the binary if needed, applies the
# migrations, then serves on http://127.0.0.1:8090.
#
#   ./scripts/dev.sh          start
#   ./scripts/dev.sh --seed   ERASES pb_data/ then reseeds - destructive
#
# To try something without risking your dev database: ./scripts/test.sh
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib.sh
source scripts/lib.sh

ensure_pocketbase

read -r -a DIRS <<<"$(pb_dirs ./pb_data)"

if [ "${1:-}" = "--seed" ]; then
	echo "Resetting pb_data/..."
	rm -rf pb_data
fi

"$PB_BIN" migrate up "${DIRS[@]}"

if [ "${1:-}" = "--seed" ]; then
	"$PB_BIN" seed "${DIRS[@]}"
	echo
	echo "Create an administration account:"
	echo "  $PB_BIN superuser upsert you@example.org yourpassword --dir=./pb_data"
	echo
fi

# --dev prints hook JS errors to the console (at the cost of SQL logs).
# Without it, an error in a hook only shows up as an opaque 400.
exec "$PB_BIN" serve --http=127.0.0.1:8090 --dev "${DIRS[@]}"
