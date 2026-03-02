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

### 8. `roundResult` typed as `any`
**File:** `client/src/hooks/useSocket.ts:23, 73`

```ts
const [roundResult, setRoundResult] = useState<any>(null);
```

Should be `useState<RoundResult | null>(null)` using the type from `@tichu/shared`.

### 9. `needDragonChoice` state is tracked but unused
**File:** `client/src/hooks/useSocket.ts:22, 203`

The `needDragonChoice` state is set in response to the `'need-dragon-choice'`
event and returned from the hook, but no component ever reads it. The Game
component uses `gameState.dragonGiveaway && gameState.dragonGiveawayBy === mySeat`
instead. Either remove the state or use it in the component.

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

### 12. `handleRoundResult` uses inline type import
**File:** `server/src/handler.ts:437`

```ts
function handleRoundResult(room: Room, roundResult: import('@tichu/shared').RoundResult)
```

Uses an inline `import()` type instead of the `RoundResult` already imported at
the top of the file via `@tichu/shared`. Just use `RoundResult` directly.

### 13. Unsafe `any` type assertion in stats.ts
**File:** `server/src/stats.ts:95`

```ts
(updates as Record<string, any>).playedWith = arrayUnion(...otherUids);
```

Casts to `any` to add `playedWith` to the updates object. The updates type should
be widened to accommodate both `FieldValue` and `FieldValue[]` types.

---

## MINOR CODE SMELLS

### 14. `findPlayableCombos` can return duplicate combos
**File:** `shared/src/combinations.ts:439-481`

The `findPlayableCombos` function accumulates results without deduplication. The
same combo could be added via multiple code paths (e.g., a four-of-a-kind bomb
could be found by both `addBombs` and theoretically other paths). Consider
deduplicating by card IDs.

### 15. `addConsecutivePairs` doesn't handle phoenix
**File:** `shared/src/combinations.ts:562-593`

The phoenix is not tried in consecutive pair generation, meaning some legal
phoenix-based consecutive pair plays won't appear in the playable combos list.

### 16. `generateRoomCode` uses recursion for collision
**File:** `server/src/rooms.ts:163-172`

Could theoretically stack overflow if the code space is exhausted (unlikely with
the current character set, but an iterative approach would be more robust).

### 17. Game.tsx and Lobby.tsx are very large single components
**Files:** `client/src/pages/Game.tsx` (457 lines), `client/src/pages/Lobby.tsx`
(410 lines)

Game.tsx handles grand tichu, passing, playing, bomb mode, and results display all
in one component. Consider breaking into phase-specific sub-components.

### 18. `selectedCards` state not reset on phase transitions
**File:** `client/src/pages/Game.tsx:30`

The `selectedCards` Set persists across phase transitions. If the phase changes
(e.g., from playing to roundEnd and back to grandTichuWindow), stale card IDs
could remain. Should reset on phase change.

### 19. `useEffect` dependency array incomplete
**File:** `client/src/pages/Lobby.tsx:33`

```ts
useEffect(() => {
  if (profile && !playerName) {
    setPlayerName(profile.preferences.preferredName);
  }
}, [profile]);
```

References `playerName` inside the effect but doesn't include it in the
dependency array. This is intentional (only set name on first profile load) but
should use a ref or a separate flag to make the intent clear.

### 20. Prop drilling through `ReturnType<typeof useSocket>`
**Files:** `client/src/pages/Game.tsx:17-20`, `client/src/pages/Lobby.tsx:8-11`

The entire socket hook return value is passed as props. A React context provider
would be cleaner and avoid threading the large object through component trees.

### 21. `cardKey` duplicates `cardId` from shared
**File:** `server/src/rooms.ts:367-369`

```ts
function cardKey(c: Card): string {
  return c.type === 'normal' ? `${c.suit}-${c.rank}` : c.name;
}
```

This is identical to `cardId` from `@tichu/shared` (types.ts:207-209). Should
use the shared function instead.

### 22. `Object.fromEntries` with Map coerces numeric keys to strings
**File:** `server/src/rooms.ts:391`

```ts
const passes = Object.fromEntries(room.passes) as Record<Seat, PassInfo>;
```

Seat keys (0-3) become string keys ("0"-"3") in the resulting object. This works
because JS property access coerces to string, but it's fragile and masks a type
mismatch.

### 23. Pre-existing build issues: vitest not in tsconfig exclude
**File:** `shared/tsconfig.json`

Test files (*.test.ts) are included in the TypeScript build, causing "Cannot find
module 'vitest'" errors on `npm run build`. The tsconfig should exclude test files
from compilation (they're run separately by vitest).

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
