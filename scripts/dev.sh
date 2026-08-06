#!/usr/bin/env bash
# Runs PocketBase locally: downloads the binary if needed, applies the
# migrations, then serves on http://127.0.0.1:8090.
#
#   ./scripts/dev.sh          start
#   ./scripts/dev.sh --seed   start from a blank database + demo content
set -euo pipefail

cd "$(dirname "$0")/.."

PB_VERSION="${PB_VERSION:-0.39.10}"
PB_BIN="bin/pocketbase"

case "$(uname -s)" in
	Darwin) OS="darwin" ;;
	Linux) OS="linux" ;;
	*) echo "Unsupported OS: $(uname -s). Use Docker (see README)." >&2; exit 1 ;;
esac

case "$(uname -m)" in
	arm64 | aarch64) ARCH="arm64" ;;
	x86_64 | amd64) ARCH="amd64" ;;
	*) echo "Unsupported architecture: $(uname -m)." >&2; exit 1 ;;
esac

if [ ! -x "$PB_BIN" ] || [ "$("$PB_BIN" --version 2>/dev/null | awk '{print $3}')" != "$PB_VERSION" ]; then
	echo "Downloading PocketBase $PB_VERSION ($OS/$ARCH)..."
	mkdir -p bin
	tmp="$(mktemp -d)"
	curl -fsSL -o "$tmp/pb.zip" \
		"https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${OS}_${ARCH}.zip"
	unzip -oq "$tmp/pb.zip" -d bin/
	rm -rf "$tmp"
	chmod +x "$PB_BIN"
fi

# PocketBase resolves its default paths relative to the BINARY, not to the
# current directory: without these flags it would look for bin/pb_data,
# bin/pb_hooks and bin/pb_migrations, and start with no schema and no hooks.
DIRS=(--dir=./pb_data --hooksDir=./pb_hooks --migrationsDir=./pb_migrations)

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
