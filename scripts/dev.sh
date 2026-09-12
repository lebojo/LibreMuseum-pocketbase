#!/usr/bin/env bash
# Runs PocketBase locally: downloads the binary if needed, applies the
# migrations, then serves on http://127.0.0.1:8090.
#
#   ./scripts/dev.sh          start
#   ./scripts/dev.sh --seed   ERASES pb_data/ then reseeds - destructive
#
# While the project has no release the migrations are edited in place, so the
# schema can move under an existing pb_data/. This script refuses to start on a
# database left behind that way rather than serving an old schema to new hooks;
# --seed is the way out.
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

# An already applied migration is never replayed, so an in-place edit does not
# reach this database: it would keep the old schema while pb_hooks/ expects the
# new one, and fail later as an opaque 400.
STALE="$(changed_migrations ./pb_data)"
if [ -n "$STALE" ]; then
	cat >&2 <<-EOF

		These migrations changed since they were applied to pb_data/:

		$STALE

		PocketBase will not replay them, so this database is on the old schema.
		Rebuild it from scratch - this ERASES pb_data/, dev content included:

		  ./scripts/dev.sh --seed

		To keep what is in there, export it from the dashboard first.

	EOF
	exit 1
fi

# No record at all, on a database that already exists: it predates this check,
# so there is no way to tell whether it matches the migrations on disk. We stop
# rather than guess - serving an old schema to hooks written for the new one
# fails as a 500 on the bundle, which is a long way from this cause.
if [ -d pb_data ] && [ ! -f "$(migration_stamp ./pb_data)" ]; then
	cat >&2 <<-EOF

		pb_data/ was created before this check existed, so there is no way to tell
		whether its schema still matches pb_migrations/.

		Rebuild it from scratch - this ERASES pb_data/, dev content included:

		  ./scripts/dev.sh --seed

		If you know it is already up to date, record it once and this stops asking:

		  shasum pb_migrations/*.js > pb_data/.migration-checksums

	EOF
	exit 1
fi

"$PB_BIN" migrate up "${DIRS[@]}"
record_migrations ./pb_data

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
