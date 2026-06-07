# Tichu Project Notes

## Site

Production site: https://tichu.squidbox.com
## Architecture

Monorepo with three workspaces: `shared/` (game logic, types) → `server/` (Node+Socket.IO) → `client/` (React+Vite+Tailwind).

## Live-Game Persistence & Reconnection

Rooms live in-memory in `server/src/rooms.ts`. Players reconnect via a
persistent client session token (`client/src/utils/session.ts` →
`rejoin-room` handler → `reconnectToRoom`). To survive a server
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
- `server/src/handler.ts` — All socket event handlers, broadcastState
- `server/src/rooms.ts` — Room CRUD, game state management, seat swapping/shuffling
- `server/src/stats.ts` — Firebase stats persistence
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

### Build & Test

- `npm run build` — Builds shared → server → client in order
- `npm test` — Runs vitest in shared/ (the only package with tests)

## Environment Files

### server/.env
Contains Firebase Admin SDK credentials (`FIREBASE_PRIVATE_KEY`, etc.). **This file is git-ignored and must never be committed.** It is not present in the repository. See `server/.env.example` for the required keys, and obtain the actual values from the Firebase console (Project Settings > Service Accounts).
