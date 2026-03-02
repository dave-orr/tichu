# Security TODO

Findings from a security review of the Tichu codebase.

## Critical

### No rate limiting on Socket.IO events
- **Location:** `server/src/handler.ts`, `server/src/index.ts`
- A client can flood the server with unlimited events (play-cards, bomb-announce/cancel, etc.) causing degraded performance or crashes for all players.
- No per-IP connection limits either — a single origin can open unbounded connections.

### No server-side input validation on game payloads
- **Location:** `server/src/handler.ts` (all socket event handlers)
- Card objects from `play-cards`, `pass-cards`, and `bomb` events are not schema-validated. A client can send arbitrary objects (e.g. `{type: "fake", rank: 999}`) and the server will attempt to process them.
- Seat index in `give-dragon-trick` is not bounds-checked to 0–3.
- Rank in `mah-jong-wish` is not validated to 2–14.
- Player names have a client-side maxLength but no server-side length or character validation (`server/src/rooms.ts:82`).

### Card pass validation gap
- **Location:** `server/src/rooms.ts` handlePassCards (~line 222)
- `handlePassCards` does not verify that the three passed cards are actually in the player's hand before storing them. The later `applyPasses` step silently skips removal if the card isn't found, meaning a player could claim to pass cards they don't hold.

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
