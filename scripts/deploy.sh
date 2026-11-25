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
# Then, if the bot repo (dave-orr/Tichu-ai) is checked out next to this one
# (or at $TICHU_AI) and server/.env has a BOT_TOKEN, it pulls and builds the
# bot and (re)starts it under pm2 as `tichu-bot` (Tichu-ai's docs/LIVE.md).
#
# Flags:
#   --force   restart even if a game is in progress
#   --no-pull deploy the working tree as-is, without fetching
#   --no-bot  leave the bot alone

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FORCE=0
PULL=1
WITH_BOT=1
for arg in "$@"; do
  case "$arg" in
    --force)   FORCE=1 ;;
    --no-pull) PULL=0 ;;
    --no-bot)  WITH_BOT=0 ;;
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
  "$ROOT/scripts/rooms.sh" 2>/dev/null | sed 's/^/  /' || true
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
healthy=0
for i in $(seq 1 20); do
  if curl -fsS --max-time 2 "http://localhost:$PORT/health" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 1
done
if [ "$healthy" -eq 0 ]; then
  echo "deploy: FAILED — no response on port $PORT after 20s" >&2
  pm2 logs tichu --err --lines 30 --nostream >&2 || true
  exit 1
fi
echo "deploy: OK — healthy on port $PORT"
pm2 logs tichu --lines 12 --nostream 2>/dev/null | sed -n '/Tichu server starting/,/running on port/p' || true

# --- bot -------------------------------------------------------------------
# The server is up either way; a bot failure is reported and exits non-zero.

[ "$WITH_BOT" -eq 1 ] || exit 0
BOT_DIR="${TICHU_AI:-$(dirname "$ROOT")/Tichu-ai}"
if [ ! -d "$BOT_DIR/.git" ]; then
  echo "deploy: no bot checkout at $BOT_DIR — skipping the bot (set TICHU_AI, or --no-bot)"
  exit 0
fi
if [ -z "$(env_value BOT_TOKEN)" ]; then
  echo "deploy: no BOT_TOKEN in server/.env — skipping the bot (see docs/AI_API.md)"
  exit 0
fi
bot_fail() { echo "deploy: BOT FAILED — $*" >&2; exit 1; }

# rustup's installer puts cargo here but non-login shells may not have it.
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"
command -v cargo >/dev/null || bot_fail "cargo not found (install Rust: https://rustup.rs)"

cd "$BOT_DIR"
if [ "$PULL" -eq 1 ]; then
  echo "deploy: pulling the bot"
  git pull --ff-only || bot_fail "git pull in $BOT_DIR"
fi
echo "deploy: building the bot"
cargo build --release || bot_fail "cargo build"

# The default bot's model files aren't in git (copied from the desktop).
for f in runs/v4/gen3.tnet runs/calls3/m3.tcall runs/calls1/m1.tcall; do
  [ -f "$f" ] || [ -n "${BOT_SPEC:-}" ] || bot_fail "missing $BOT_DIR/$f (copy it from the desktop)"
done

echo "deploy: restarting the bot"
BOT="${BOT_SPEC:-}" pm2 startOrRestart scripts/live.config.js --update-env || bot_fail "pm2 start"
pm2 save
sleep 3
if pm2 describe tichu-bot 2>/dev/null | grep -q "status.*online"; then
  echo "deploy: OK — bot online"
  pm2 logs tichu-bot --lines 5 --nostream 2>/dev/null | tail -n 5 || true
else
  pm2 logs tichu-bot --lines 20 --nostream >&2 || true
  bot_fail "tichu-bot is not online"
fi
