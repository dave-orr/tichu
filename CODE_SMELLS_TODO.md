# Code Smells & Improvement TODO

Identified during a full codebase review. Items are grouped by severity.

---

## BUGS (Likely Incorrect Behavior)

### 1. `scoreRound` outOrder sort is wrong — scoring/double victory broken
**File:** `shared/src/scoring.ts:30-36`

The player who never went out has `outOrder === 0`. Sorting ascending puts them
first in the array, but the code treats index 0 as "first out":

```ts
const outOrder = [...players]
  .sort((a, b) => a.outOrder - b.outOrder)  // outOrder=0 sorts first!
  .map(p => p.seat);

const firstOut = outOrder[0];    // BUG: this is the player who NEVER went out
const secondOut = outOrder[1];   // BUG: this is actually the first-out player
const lastPlayer = outOrder[3];  // BUG: this is the third-out player
```

**Consequences:**
- Double victory is **never detected** (checks wrong pair of players)
- Last player's hand cards are **not** given to the opposing team
- Last player's tricks are **not** given to the first-out player
- The `RoundResult.outOrder` array shown in the UI is in the wrong order

**Fix:** Sort players with `outOrder > 0` ascending first, then `outOrder === 0`
last. Something like:
```ts
.sort((a, b) => (a.outOrder || 999) - (b.outOrder || 999))
```

### 2. Mah Jong wish enforcement is incomplete
**File:** `shared/src/engine.ts:556-558`, `561-599`

`canPlayWishedRankFromHand` returns `false` for straights and consecutive pairs,
meaning players can always pass when the wish involves these combo types.
`checkWishCompliance` only enforces the wish for singles. Per Tichu rules, if you
can make ANY legal play containing the wished rank, you must. This is flagged with
comments in the code but is a rule violation.

**Fix:** Implement proper wish enforcement for all combo types, or at minimum for
pairs/triples/full houses (the `canPlayWishedRankFromHand` function already
handles pairs/triples but `checkWishCompliance` doesn't use it for non-singles).

---

## SIGNIFICANT CODE SMELLS

### 3. Dead code: `dealAll` and `dealFirstEight` in deck.ts
**File:** `shared/src/deck.ts:38-70`

These exported functions are never called anywhere in the codebase. The engine
handles dealing directly via `deck.slice()` in `startNewRound` and
`dealRemainingCards`. They should be removed or the engine should use them.

### 4. `getRoomBySocket` is O(n) linear scan
**File:** `server/src/rooms.ts:255-263`

Every socket event calls `getRoomBySocket` which iterates all rooms. Should use a
reverse map (`Map<string, string>` from socketId -> roomCode) for O(1) lookup.

### 5. Rate limiter memory leak
**File:** `server/src/handler.ts:23-34`

The `counts` Map in `createRateLimiter` never cleans up entries for disconnected
sockets. Over time with many connections, this leaks memory. Should clean up
entries on socket disconnect or use a TTL-based eviction.

### 6. No room cleanup for in-progress games
**File:** `server/src/rooms.ts:280`

Rooms are only cleaned up if all players disconnect during the `waiting` phase. If
all players disconnect from a game in progress, the room persists in memory
forever. Need a timeout-based cleanup or cleanup when all sockets disconnect
regardless of phase.

### 7. `fetchInvitableUsers` fetches ALL user documents
**File:** `server/src/stats.ts:320`

`db.collection('users').get()` loads every user document from Firestore. This
doesn't scale — with thousands of users this becomes expensive and slow. Should
query with limits, use pagination, or maintain a separate lightweight index.

### ~~8. `roundResult` typed as `any`~~ FIXED

### ~~9. `needDragonChoice` state is tracked but unused~~ FIXED

### 10. `as unknown as` double assertions for tuple types
**Files:** `shared/src/engine.ts` (multiple places)

The pattern `as unknown as [Player, Player, Player, Player]` is used throughout
because `.map()` returns `Player[]` not a fixed-length tuple. Consider a helper
function like:
```ts
function asTuple4<T>(arr: T[]): [T, T, T, T] {
  return arr as unknown as [T, T, T, T];
}
```

### 11. Duplicated invite-push logic in handler.ts
**File:** `server/src/handler.ts:59-66` and `73-82`

The code to push pending invites is duplicated between the initial connection
handler and the `'authenticate'` event handler. Extract to a helper function.

### ~~12. `handleRoundResult` uses inline type import~~ FIXED

### 13. Unsafe `any` type assertion in stats.ts
**File:** `server/src/stats.ts:95`

```ts
(updates as Record<string, any>).playedWith = arrayUnion(...otherUids);
```

Casts to `any` to add `playedWith` to the updates object. The updates type should
be widened to accommodate both `FieldValue` and `FieldValue[]` types.

---

## MINOR CODE SMELLS

### ~~14. `findPlayableCombos` can return duplicate combos~~ FIXED

### ~~15. `addConsecutivePairs` doesn't handle phoenix~~ FIXED

### ~~16. `generateRoomCode` uses recursion for collision~~ FIXED

### 17. Game.tsx and Lobby.tsx are very large single components
**Files:** `client/src/pages/Game.tsx` (457 lines), `client/src/pages/Lobby.tsx`
(410 lines)

Game.tsx handles grand tichu, passing, playing, bomb mode, and results display all
in one component. Consider breaking into phase-specific sub-components.

### ~~18. `selectedCards` state not reset on phase transitions~~ FIXED

### ~~19. `useEffect` dependency array incomplete~~ FIXED

### 20. Prop drilling through `ReturnType<typeof useSocket>`
**Files:** `client/src/pages/Game.tsx:17-20`, `client/src/pages/Lobby.tsx:8-11`

The entire socket hook return value is passed as props. A React context provider
would be cleaner and avoid threading the large object through component trees.

### ~~21. `cardKey` duplicates `cardId` from shared~~ FIXED

### ~~22. `Object.fromEntries` with Map coerces numeric keys to strings~~ FIXED

### ~~23. Pre-existing build issues: vitest not in tsconfig exclude~~ FIXED

---

## FIXED (Trivial — done during review)

- **ScoreBoard.tsx**: Replaced inline ternary chain for wish rank display with
  `RANK_NAMES[gameState.mahJongWish]` (was duplicating shared constant logic).
- **engine.ts**: Moved `ClientGameState`, `ClientPlayer`, and `sumPoints` imports
  from bottom of file to top with other imports.
- **engine.ts**: Removed dead code in `startNewRound` — tichu call was set to a
  conditional value then immediately overridden to `'none'` in a loop. Simplified
  to just `'none'` and removed the redundant loop.
- **useSocket.ts**: Removed no-op `player-joined` event handler (state updates
  come via the `game-state` event).

## FIXED (Minor smells)

- **#8 useSocket.ts**: Typed `roundResult` as `RoundResult | null` instead of `any`.
- **#9 useSocket.ts**: Removed unused `needDragonChoice` state and its
  `need-dragon-choice` event handler. Game.tsx uses gameState directly.
- **#12 handler.ts**: Replaced inline `import('@tichu/shared').RoundResult` with
  the `RoundResult` type already in the imports.
- **#14 combinations.ts**: Added deduplication to `findPlayableCombos` by sorted
  card IDs, preventing duplicate combos in the results.
- **#15 combinations.ts**: Added phoenix support to `addConsecutivePairs` — the
  phoenix can now fill one pair slot in a consecutive pairs sequence.
- **#16 rooms.ts**: Converted `generateRoomCode` from recursive to iterative
  (do/while loop) to avoid theoretical stack overflow.
- **#18 Game.tsx**: Added `useEffect` to reset `selectedCards` and `bombMode`
  when the game phase changes.
- **#19 Lobby.tsx**: Used a `useRef` flag to make the "pre-fill name once"
  intent explicit, rather than relying on stale closure over `playerName`.
- **#21 rooms.ts**: Replaced local `cardKey` function with `cardId` from
  `@tichu/shared` (they were identical).
- **#22 rooms.ts**: Built the passes `Record<Seat, PassInfo>` via a for-of loop
  instead of `Object.fromEntries(map)` which coerced numeric keys to strings.
- **#23 shared/tsconfig.json**: Added `"exclude": ["src/**/*.test.ts"]` so test
  files are excluded from the TypeScript build (fixes pre-existing vitest errors).
