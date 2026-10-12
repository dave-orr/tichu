# Tichu Project Notes

## Site

Production site: https://tichu.squidbox.com

Deployed manually on the host with `scripts/deploy.sh`: pm2 runs the built
server as the process `tichu` (`ecosystem.config.js`), behind a reverse proxy.
`dist/` is git-ignored in every workspace, so a deploy **must** run
`npm run build` (shared → server → client) or the server crash-loops on a
missing `@tichu/shared`. pm2 must run with its cwd inside `server/`, since
dotenv resolves `server/.env` against `process.cwd()`. Every boot logs a
banner naming the Node version, cwd, whether `.env` loaded, the port and its
source — read it first when triaging. Deploy steps and outage triage:
`docs/DEPLOY.md`.

Before restarting, check live games: `scripts/rooms.sh` on the host, or the
web dashboard at `/admin` (`server/src/admin.ts`). Both need `ADMIN_TOKEN` in
`server/.env`; without it the data routes are disabled.

## Architecture

Monorepo with three workspaces: `shared/` (game logic, types) → `server/` (Node+Socket.IO) → `client/` (React+Vite+Tailwind).

## Live-Game Persistence & Reconnection

Rooms live in-memory in `server/src/rooms.ts`. Players reconnect via a
persistent client session token (`client/src/utils/session.ts` →
`rejoin-room` handler → `reconnectToRoom`). If a player drops for good, a
substitute can fill in mid-game: `joinRoom` takes over any currently
*disconnected* seat (keeping its hand/tricks) when the game is past `waiting`,
reachable by sharing the room code (shown in-game, top-right) or via invite.
The same gear menu has **Leave game** (deliberate `leave-room`: frees the seat
for a substitute; the room is deleted at once if no seat still holds a
reconnect session) and **End game for everyone** (`end-game`: organizer any
time, anyone once a seat is disconnected; deletes the room, no game summary or
Elo, already-logged rounds stay). To survive a server
restart/redeploy, each room is snapshotted to Firestore (`liveRooms/{code}`,
JSON blob, debounced) by `server/src/persistence.ts`; snapshots are reloaded
on startup and deleted on room teardown, with an `expireAt` TTL backstop.

**One-time setup:** the TTL backstop needs a Firestore TTL policy on the
`expireAt` field (Admin SDK can't create it):
`gcloud firestore fields ttl update expireAt --collection-group=liveRooms --project=<FIREBASE_PROJECT_ID>`

Finished-game history (`games`, `games/*/rounds`) is kept indefinitely by
design — do not add TTL there.

## Game Rules

`RULES.md` (repo root) is the authoritative, complete rules reference.
**Always read it before editing gameplay-affecting code** — especially
`shared/src/engine.ts`, `combinations.ts`, `scoring.ts`, `deck.ts`, and
`types.ts` card helpers. Verify changes against it rather than from memory.

## TODO Trackers

`CODE_SMELLS_TODO.md` (bugs / code smells grouped by severity) and
`SECURITY_TODO.md` (security findings) track known outstanding issues. These
files list **only live, unresolved issues** — when fixing a bug, check whether
either file references it and, if so, delete that entry in the same change
rather than marking it done. Completed work lives in the commit history, not in
these files.

### Key Files

- `shared/src/types.ts` — All types, GameSettings, card helpers, RANK_NAMES, seat helpers
- `shared/src/engine.ts` — Core game logic: playCards, applyPasses, setMahJongWish, passTurn, toClientState
- `shared/src/combinations.ts` — Combo identification (identifyCombo) and comparison (canBeat, isBomb)
- `shared/src/scoring.ts` — Round scoring, card point values
- `shared/src/deck.ts` — Deck creation, shuffle, sortHand
- `shared/src/stats.ts` — Player / partner / pairing stats derived from game history (pure, tested)
- `shared/src/achievements.ts` — Counting achievements derived from game history (pure, tested); some read the per-round `plays` log / `firstEight`, which only newer round logs carry. The same detector runs live at each round end (`roundAchievements` in `handler.ts`); results ride on `RoundResult.achievements`. Badge art: `scripts/gen-achievement-art.py` → `client/public/achievements/`
- Card art (special cards + suit symbols, papercraft SVG): `scripts/gen-card-art.py` → `client/public/cards/`, used by `client/src/components/Card.tsx`
- Themes (`GameSettings.theme`, chosen by the room creator; `ThemePicker`): `client/src/theme.ts` (context + `cardArt()`); colours are CSS variables defined per theme in `client/tailwind.config.js` (Kawaii is a light theme, so it inverts the ramps), theme-specific surfaces under `[data-theme=...]` in `index.css`; Kawaii art: `scripts/gen-kawaii-art.py` → `client/public/cards/kawaii/` (same file names as the papercraft set); Halloween art: `scripts/gen-halloween-art.py` → `client/public/cards/halloween/`. Halloween is seasonal: built but hidden from the picker (and rejected by the server) via `selectable: false` in `THEMES` (`shared/src/types.ts`); flip it to `true` to offer it
- `server/src/handler.ts` — All socket event handlers, broadcastState
- `server/src/rooms.ts` — Room CRUD, game state management, seat swapping/shuffling
- `server/src/stats.ts` — Round logs, game summaries, Elo, and history-derived stats queries (Firestore)
- `client/src/pages/Game.tsx` — Main game UI (all phases: grandTichu, passing, playing)
- `client/src/pages/Lobby.tsx` — Room creation, joining, waiting room with setup options
- `client/src/hooks/useSocket.ts` — Socket connection, all emit wrappers, client state
- `client/src/hooks/useAuth.ts` — Firebase auth, Google sign-in
- `client/src/components/` — Card, Hand, PlayArea, ScoreBoard, PassCards, CardsSeen, MahJongWish, DragonGiveaway, RoundResults, GrandTichuPrompt

### Key Patterns

- **State flow**: Server holds full GameState → `broadcastState()` calls `toClientState(state, seat)` per player (hides other hands) → client receives via `game-state` socket event
- **New socket event**: Add handler in `handler.ts` → add emit wrapper in `useSocket.ts`
- **New game setting**: Add to `GameSettings` + `DEFAULT_SETTINGS` in `types.ts` → check `gameState.settings.X` in components → add checkbox in Lobby waiting room setup options
- **Teams**: Seats 0&2 (Team 0) vs 1&3 (Team 1). Relative seating from mySeat: +1=right, +2=partner, +3=left

### Toolchain

Node 22.22.2+ (`.nvmrc` pins the major; CI reads the same file) and npm 12+.
The Node floor is npm 12's requirement — it also keeps us off Node 20, which
reached EOL in April 2026.

npm 12 blocks dependency install scripts unless allowlisted in `allowScripts`.
No allowlist is needed today: the five packages that declare install scripts
(`esbuild` ×2, `fsevents`, `protobufjs`, `@firebase/util`) are not load-bearing
here — esbuild resolves its binary through `optionalDependencies`. If a future
dependency genuinely needs its postinstall, `npm approve-scripts <pkg>` writes
the entry and it gets committed like any other config.

### Build & Test

- `npm run build` — Builds shared → server → client in order
- `npm test` — Runs vitest in shared/ (the only package with tests)

## Environment Files

### server/.env
Contains Firebase Admin SDK credentials (`FIREBASE_PRIVATE_KEY`, etc.). **This file is git-ignored and must never be committed.** It is not present in the repository. See `server/.env.example` for the required keys, and obtain the actual values from the Firebase console (Project Settings > Service Accounts).
