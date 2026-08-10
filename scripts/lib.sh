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
