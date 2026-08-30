#!/usr/bin/env bash
#
# Deploy the production server. Run it on the host, from anywhere:
#
#     ~/tichu/scripts/deploy.sh
#
# Enforces the whole sequence rather than relying on remembering it: the build
# is mandatory and order-sensitive (dist/ is git-ignored in every workspace and
# the server imports @tichu/shared through a workspace symlink), and the deploy
# is only reported successful once /health actually answers on the port the app
# bound. See docs/DEPLOY.md.
#
# Flags:
#   --force   restart even if a game is in progress
#   --no-pull deploy the working tree as-is, without fetching

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FORCE=0
PULL=1
for arg in "$@"; do
  case "$arg" in
    --force)   FORCE=1 ;;
    --no-pull) PULL=0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

fail() { echo "deploy: $*" >&2; exit 1; }

# Read a key from server/.env without sourcing it (values may contain spaces,
# quotes, and a multi-line private key we must not evaluate).
env_value() {
  [ -f "$ROOT/server/.env" ] || return 0
  sed -n "s/^$1=//p" "$ROOT/server/.env" | tail -n1 | tr -d '\r' | sed 's/^"//; s/"$//'
}

# --- preflight -------------------------------------------------------------

MIN_NODE=22
node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
[ "$node_major" -ge "$MIN_NODE" ] \
  || fail "Node >= $MIN_NODE required, found $(node -v 2>/dev/null || echo 'none'). Check nvm, then 'pm2 kill' so the daemon picks it up."

[ -f "$ROOT/server/.env" ] \
  || echo "deploy: WARNING — server/.env missing; the server will start without auth or persistence" >&2

PORT="$(env_value PORT)"; PORT="${PORT:-3000}"

# Don't interrupt a live game without saying so.
if [ "$FORCE" -eq 0 ] && in_game="$(curl -fsS --max-time 3 "http://localhost:$PORT/health" 2>/dev/null \
    | sed -n 's/.*"roomsInGame":\([0-9]*\).*/\1/p')" && [ -n "${in_game:-}" ] && [ "$in_game" -gt 0 ]; then
  echo "deploy: $in_game game(s) in progress — a restart disconnects those players."
  if [ -t 0 ]; then
    read -r -p "deploy: continue anyway? [y/N] " reply
    case "$reply" in [yY]*) ;; *) fail "aborted" ;; esac
  else
    fail "refusing to restart with games in progress (pass --force to override)"
  fi
fi

# --- build -----------------------------------------------------------------

if [ "$PULL" -eq 1 ]; then
  echo "deploy: pulling"
  git pull --ff-only
fi

echo "deploy: installing"
npm ci

echo "deploy: building (shared -> server -> client)"
npm run build

# --- restart ---------------------------------------------------------------

echo "deploy: restarting pm2"
pm2 startOrRestart ecosystem.config.js --update-env
pm2 save

# --- verify ----------------------------------------------------------------

echo "deploy: waiting for /health on port $PORT"
for i in $(seq 1 20); do
  if curl -fsS --max-time 2 "http://localhost:$PORT/health" >/dev/null 2>&1; then
    echo "deploy: OK — healthy on port $PORT"
    pm2 logs tichu --lines 12 --nostream 2>/dev/null | sed -n '/Tichu server starting/,/running on port/p' || true
    exit 0
  fi
  sleep 1
done

echo "deploy: FAILED — no response on port $PORT after 20s" >&2
pm2 logs tichu --err --lines 30 --nostream >&2 || true
exit 1
