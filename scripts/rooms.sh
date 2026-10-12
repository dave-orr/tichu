#!/usr/bin/env bash
#
# List live rooms on this host: phase, age, idle time, who's connected, and
# whether each game's restart snapshot is current. Run before a restart:
#
#     ~/tichu/scripts/rooms.sh
#
# Reads PORT and ADMIN_TOKEN from server/.env. The same data is on the web
# dashboard at /admin. See docs/DEPLOY.md.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

env_value() {
  [ -f "$ROOT/server/.env" ] || return 0
  sed -n "s/^$1=//p" "$ROOT/server/.env" | tail -n1 | tr -d '\r' | sed 's/^"//; s/"$//'
}

PORT="$(env_value PORT)"; PORT="${PORT:-3000}"
TOKEN="$(env_value ADMIN_TOKEN)"
[ -n "$TOKEN" ] || { echo "rooms: ADMIN_TOKEN is not set in server/.env" >&2; exit 1; }

curl -fsS --max-time 3 -H "Authorization: Bearer $TOKEN" \
  "http://localhost:$PORT/admin/rooms?format=text"
