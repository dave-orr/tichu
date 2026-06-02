# Security TODO

Findings from a security review of the Tichu codebase.

## High

### Authentication is optional — all game actions work without it
- **Location:** `server/src/handler.ts:17-25`
- Firebase token verification runs on connect but is entirely optional. An unauthenticated socket can create rooms, join games, and play cards. This is by design for casual play, but means stats tracking (which depends on auth) can be trivially bypassed, and there's no way to ban or identify abusive players.

### No token revalidation after initial connect
- **Location:** `server/src/handler.ts:17-25`
- The Firebase token is checked once at connection time. If it expires mid-session, the socket remains authenticated. Long-lived connections could outlive revoked credentials.

## Medium

### CORS defaults may be too broad
- **Location:** `server/src/index.ts:16-18`
- `ALLOWED_ORIGINS` is parsed from a comma-separated env var with no format validation. Default falls back to localhost origins. If the env var is unset in production, the default is overly permissive.

### No Socket.IO max payload size
- **Location:** `server/src/index.ts` (Socket.IO server config)
- No `maxHttpBufferSize` configured. A client could send very large payloads to exhaust server memory.

### Room code space is small
- **Location:** `server/src/rooms.ts:32-41`
- 4-character codes from a 32-char alphabet = ~1M possible codes. Collision checking prevents duplicates, but the space is small enough that an attacker could enumerate active rooms.

### Console logging includes socket IDs and UIDs
- **Location:** `server/src/handler.ts:15,23`
- Connection and auth logs include identifiers. In production, these logs should be redacted or sent to a structured logger with access controls.

### Silent failures on invalid game moves
- **Location:** `server/src/rooms.ts`, `shared/src/engine.ts`
- Invalid plays (wrong cards, out-of-turn) return the unmodified game state with no error event sent to the client. This makes debugging harder and could mask exploitation attempts.

## Low

### React auto-escapes player names (safe for now)
- Player names are rendered as text content in React, which escapes HTML. No current XSS risk, but if rendering ever moves to `dangerouslySetInnerHTML` or a non-React context, names would need sanitization.

### npm audit reports 4 moderate vulnerabilities
- Run `npm audit` and address the flagged packages. (As of 2026-05-31 `npm install` reports 31 vulnerabilities — 1 critical, 7 high — re-audit.)

---

## Review 2026-05-31 (multi-agent pass)

New findings not already listed above. **None fixed** — recorded for triage.
Tagged [confirmed] (traced) or [suspected] (needs repro).

### High

#### AI HTTP API endpoints are entirely unauthenticated — hand leak + game interference [confirmed]
- **Location:** `server/src/api.ts:60-299`
- Anyone who can reach `/api/...` can join AI-open seats, open the SSE stream for any API seat (which sends that seat's hand via `toClientState`, `api.ts:160`), and submit actions for any API seat in any room (`/rooms/:code/action`). The only gate is "seat must be an API player." No auth, no rate limiting (the socket rate limiter does not cover HTTP). Combined with room-code brute force and `findRoomWithOpenAiSeat` matchmaking, an external actor can read hands and disrupt live games.

### Medium

#### `reconnectToRoom` trusts client-supplied player name as the only identity proof [suspected — verify reachability]
- **Location:** `server/src/rooms.ts:242-276`
- Reconnection matches a seat purely by `playerName` string equality, then rebinds that seat's socket to the caller — no token/uid check. Anyone who knows the room code and a display name can hijack that seat and see its hand via per-seat broadcast. No socket handler in `handler.ts` appears to call `reconnectToRoom`, so it may be dead/partially-wired — confirm before relying on it, but as written it's a hand-takeover primitive.

#### Stat farming via human + AI games [confirmed]
- **Location:** `server/src/stats.ts` (all writers) + `handler.ts:712`
- Stats are persisted for any game reaching `gameEnd`, with no minimum-real-players check or completed-game rate limit. A single authenticated human paired with unauthenticated AI players (`api.ts`) can repeatedly start and win games to inflate `gamesWon`/`tichuSuccesses`/etc. (Does NOT require forging a UID — UIDs come only from verified tokens, which is correct — the gameable surface is the outcomes themselves.)

### Low

#### `update-settings` accepts arbitrary setting shapes [confirmed]
- **Location:** `server/src/handler.ts:289-307`
- Only `targetScore` is clamped; the rest of `settings` is spread into `room.state.settings` and broadcast/consumed by the engine without structural validation. Garbage/unexpected keys and non-boolean values for booleans are accepted. Waiting-phase + organizer-only limits impact, but it's untrusted client data into shared game state.

#### `save-settings` writes unvalidated client object to Firestore [confirmed]
- **Location:** `server/src/handler.ts:545-559`
- `settings` is stored verbatim under `preferences.lastSettings` with no schema/size check beyond the 10KB socket cap. An authenticated user can persist arbitrary structured data to their own user doc.

#### `photoURL` is rendered as an `<img src>` from an attacker-controllable profile field [confirmed]
- **Location:** client avatars (`ScoreBoard.tsx:11`, `RoundResults.tsx:29/31`, `InvitePanel.tsx:60`); also broadcast to other players
- Not XSS (`<img src>` won't run `javascript:`), and `referrerPolicy="no-referrer"` is set in most places, but a user can set an arbitrary `photoURL` that other clients then fetch (tracking/SSRF-via-browser). Constrain/validate the URL scheme+host server-side; confirm `referrerPolicy` on every avatar render.

### Verified OK (recorded so they aren't re-investigated)
- Stats/UIDs are keyed only on **verified-token** UIDs (`rooms.ts:61-68`, `handler.ts:90-92`); no client-supplied-UID path, no Firestore path injection from user input.
- `broadcastState`/`toClientState` send only the recipient's own hand over sockets — no hand leakage on the normal socket path (the leak vectors are the unauthenticated SSE/reconnect paths above).
- Firebase token verification uses Admin SDK `verifyIdToken` and fails closed; credentials come from env and are never logged. `maxHttpBufferSize`, per-socket rate limiting, CORS allow-list, and card/seat/rank validators are present.
- No leftover `*.backup` / `*.disabled` source files exist in the tree (both reviewers checked) — no stale-secret hygiene issue currently.
