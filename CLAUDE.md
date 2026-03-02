# Tichu Project Notes

## Architecture

Monorepo with three workspaces: `shared/` (game logic, types) → `server/` (Node+Socket.IO) → `client/` (React+Vite+Tailwind).

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
