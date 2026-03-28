# Security TODO

Findings from a security review of the Tichu codebase.

## Critical

### ~~No rate limiting on Socket.IO events~~ ✅ DONE
- **Location:** `server/src/handler.ts`, `server/src/index.ts`
- **Fixed:** Added per-socket rate limiting (20 events/sec) via `socket.use` middleware, with automatic cleanup on disconnect. Added per-IP connection limiting (max 8 concurrent connections per IP) that rejects new connections with disconnect when exceeded.

### ~~No server-side input validation on game payloads~~ ✅ DONE
- **Location:** `server/src/handler.ts`, `server/src/validation.ts`, `server/src/rooms.ts`
- **Fixed:** Added `server/src/validation.ts` with schema validators for Card, Card[], Seat, NormalRank, and player names. All socket event handlers now validate untrusted payloads before processing. `handlePassCards` verifies passed cards are distinct and present in the player's hand.

### ~~Card pass validation gap~~ ✅ DONE
- **Location:** `server/src/rooms.ts` handlePassCards
- **Fixed:** `handlePassCards` now verifies that all three passed cards are distinct and present in the player's hand before accepting the pass.

## High

### Authentication is optional — all game actions work without it
- **Location:** `server/src/handler.ts:17-25`
- Firebase token verification runs on connect but is entirely optional. An unauthenticated socket can create rooms, join games, and play cards. This is by design for casual play, but means stats tracking (which depends on auth) can be trivially bypassed, and there's no way to ban or identify abusive players.

### No token revalidation after initial connect
- **Location:** `server/src/handler.ts:17-25`
- The Firebase token is checked once at connection time. If it expires mid-session, the socket remains authenticated. Long-lived connections could outlive revoked credentials.

### Bomb window can be toggled without limit
- **Location:** `server/src/handler.ts:128-143`
- Any player can spam `bomb-announce` / `bomb-cancel` events, toggling `bombWindow` on the game state and broadcasting to all clients each time. This is a low-cost way to degrade the experience.

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
- Run `npm audit` and address the flagged packages.
