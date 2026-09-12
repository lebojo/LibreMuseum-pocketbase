#!/usr/bin/env bash
# Functions shared by dev.sh and test.sh. Meant to be sourced, not executed.

PB_VERSION="${PB_VERSION:-0.39.10}"
PB_BIN="bin/pocketbase"

# Downloads the PocketBase binary if it is missing or if its version does
# not match PB_VERSION.
ensure_pocketbase() {
	local os arch tmp
	case "$(uname -s)" in
		Darwin) os="darwin" ;;
		Linux) os="linux" ;;
		*) echo "Unsupported OS: $(uname -s). Use Docker (see README)." >&2; return 1 ;;
	esac

	case "$(uname -m)" in
		arm64 | aarch64) arch="arm64" ;;
		x86_64 | amd64) arch="amd64" ;;
		*) echo "Unsupported architecture: $(uname -m)." >&2; return 1 ;;
	esac

	if [ -x "$PB_BIN" ] && [ "$("$PB_BIN" --version 2>/dev/null | awk '{print $3}')" = "$PB_VERSION" ]; then
		return 0
	fi

	echo "Downloading PocketBase $PB_VERSION ($os/$arch)..."
	mkdir -p bin
	tmp="$(mktemp -d)"
	curl -fsSL -o "$tmp/pb.zip" \
		"https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${os}_${arch}.zip"
	unzip -oq "$tmp/pb.zip" -d bin/
	rm -rf "$tmp"
	chmod +x "$PB_BIN"
}

# PocketBase resolves its paths by default relative to the BINARY, not to the
# current directory: without these flags it would look for bin/pb_data,
# bin/pb_hooks and bin/pb_migrations, and would start with no schema or hooks.
pb_dirs() {
	echo "--dir=$1 --hooksDir=./pb_hooks --migrationsDir=./pb_migrations"
}

# --- Migrations edited in place -------------------------------------------
# PocketBase records an applied migration BY FILENAME, and never replays it.
# While the project has no release, migrations are edited in place rather than
# stacked (see AGENTS.md), so a dev database silently stays on the old schema
# while the hooks already expect the new one. The symptom is an opaque 400, far
# from its cause - hence this check.
#
# We keep a checksum per migration inside the data directory it describes, so
# the record follows the database it belongs to and disappears when it is wiped.

migration_stamp() {
	echo "$1/.migration-checksums"
}

# Records the checksum of every migration currently on disk. Called after a
# successful `migrate up`.
record_migrations() {
	shasum pb_migrations/*.js >"$(migration_stamp "$1")"
}

# Prints the migrations that were applied once and have CHANGED or DISAPPEARED
# since. Both leave the database describing a schema no source file produces any
# more - folding a migration back into the one that creates the collection, which
# this project does while there is no release, does exactly that.
#
# A newly ADDED migration is not listed: `migrate up` applies it normally, and
# demanding a reset for it would make the check unbearable.
changed_migrations() {
	local stamp sha file
	stamp="$(migration_stamp "$1")"
	[ -f "$stamp" ] || return 0

	while read -r sha file; do
		if [ ! -f "$file" ]; then
			echo "  $file (removed)"
		elif [ "$(shasum "$file" | awk '{print $1}')" != "$sha" ]; then
			echo "  $file (changed)"
		fi
	done <"$stamp"
}
