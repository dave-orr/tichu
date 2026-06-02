# Code Smells & Improvement TODO

Identified during a full codebase review. Items are grouped by severity.

---

## BUGS (Likely Incorrect Behavior)

### ~~1. `scoreRound` outOrder sort is wrong — scoring/double victory broken~~ ALREADY FIXED
**File:** `shared/src/scoring.ts:30-37`

This was a real bug, but it had already been fixed in commit `0d1088e`
("Fix 1-2 finish: end round immediately, fix scoring") before this review item was
triaged — the report was just never crossed off. The sort now explicitly pushes
players with `outOrder === 0` (never went out) to the end:

```ts
const outOrder = [...players]
  .sort((a, b) => {
    if (a.outOrder === 0 && b.outOrder === 0) return 0;
    if (a.outOrder === 0) return 1;   // never-out player → last
    if (b.outOrder === 0) return -1;
    return a.outOrder - b.outOrder;   // earlier-out → first
  })
  .map(p => p.seat) as [Seat, Seat, Seat, Seat];
```

This is functionally equivalent to the suggested fix
(`(a.outOrder || 999) - (b.outOrder || 999)`), so `firstOut`/`secondOut`/`lastPlayer`
are all correct: double victory is detected properly, last player's hand cards go to
the opposing team, and their tricks go to the first-out player. (Confirmed by live
play — double victories score correctly.)

### ~~2. Mah Jong wish enforcement is incomplete~~ FIXED

---

## SIGNIFICANT CODE SMELLS

### ~~3. Dead code: `dealAll` and `dealFirstEight` in deck.ts~~ FIXED

### ~~4. `getRoomBySocket` is O(n) linear scan~~ FIXED

### ~~5. Rate limiter memory leak~~ FIXED

### ~~6. No room cleanup for in-progress games~~ FIXED

### ~~7. `fetchInvitableUsers` fetches ALL user documents~~ FIXED

### ~~8. `roundResult` typed as `any`~~ FIXED

### ~~9. `needDragonChoice` state is tracked but unused~~ FIXED

### ~~10. `as unknown as` double assertions for tuple types~~ FIXED

### ~~11. Duplicated invite-push logic in handler.ts~~ FIXED

### ~~12. `handleRoundResult` uses inline type import~~ FIXED

### ~~13. Unsafe `any` type assertion in stats.ts~~ FIXED

---

## MINOR CODE SMELLS

### ~~14. `findPlayableCombos` can return duplicate combos~~ FIXED

### ~~15. `addConsecutivePairs` doesn't handle phoenix~~ FIXED

### ~~16. `generateRoomCode` uses recursion for collision~~ FIXED

### ~~17. Game.tsx and Lobby.tsx are very large single components~~ FIXED

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

## FIXED (Bug #2 + Significant smells)

- **#2 engine.ts**: Rewrote `canPlayWishedRankFromHand` and `checkWishCompliance`
  to use `findPlayableCombos` for proper wish enforcement across all combo types
  (singles, pairs, straights, consecutive pairs, full houses, etc.).
- **#3 deck.ts**: Removed unused `dealAll` and `dealFirstEight` functions.
- **#4 rooms.ts**: Added `socketRooms` reverse map (`socketId -> roomCode`) for
  O(1) lookups in `getRoomBySocket` instead of iterating all rooms.
- **#5 handler.ts**: Added `cleanup()` method to rate limiter, called on socket
  disconnect to prevent memory leak from accumulating stale entries.
- **#6 rooms.ts**: Added 10-minute timeout cleanup for abandoned in-progress game
  rooms. Timer is cancelled if a player reconnects.
- **#7 stats.ts**: Rewrote `fetchInvitableUsers` to fetch the requesting user's
  `playedWith` list first, then batch-fetch those users, then fill remaining slots
  with a limited query (max 50 users) instead of loading all user documents.
- **#10 types.ts + engine.ts**: Added `toPlayers<T>()` helper in types.ts and
  replaced all `as unknown as [Player, Player, Player, Player]` and
  `as [Player, ...]` casts throughout engine.ts.
- **#11 handler.ts**: Extracted `pushPendingInvites()` helper to deduplicate the
  invite-push logic between the connection handler and `authenticate` handler.
- **#13 stats.ts**: Removed the `as Record<string, any>` cast — the `playedWith`
  field is assigned directly to the `updates` record (the key was the issue, not
  the value type).

## FIXED (Component splits)

- **#17 Game.tsx**: Extracted three sub-components:
  - `GrandTichuPhase.tsx` — the grand tichu window phase (score + prompt)
  - `PassingPhase.tsx` — both passing states (selecting cards to pass + waiting)
  - `OpponentInfo.tsx` — opponent card count / tichu call display (was already a
    separate function, moved to its own file)
- **#17 Lobby.tsx**: Extracted two sub-components:
  - `WaitingRoom.tsx` — the in-room view (seat grid, setup options, invite panel,
    start game button). Owns its own `swapFrom` and `showInvitePanel` state.
  - `CreateRoomForm.tsx` — room creation form with all game setting checkboxes.
    Owns its own checkbox state, initialized from profile preferences.

---

# Review 2026-05-31 (multi-agent pass; first review in a while)

Findings from a careful read of shared/engine, server, stats, client core, and all
components. Security-specific items live in `SECURITY_TODO.md`; this file holds
correctness bugs and design smells. Each item is tagged **[confirmed]** (traced the
logic) or **[suspected]** (needs a repro/test).

### Triage re-verified 2026-06-02

Re-audited every item below against the current code (the original "Nothing below has
been fixed" note had drifted — E1 and E2 were in fact fixed and never crossed off).
Current status:

| Item | Status | Notes |
|------|--------|-------|
| E1 | ✅ FIXED | Wish enforced on lead (2026-05-31) |
| E2 | ✅ FIXED | `passersNeeded` logic + test (commit `2a779be`) |
| E3 | ⚪ NOT A BUG | Phoenix `canBeat` special case + `playCards` rank mutation are complementary, both correct (re-triaged 2026-06-02) |
| E4 | 🔴 OPEN | `phoenixAs` adjacency unchecked; consec-pairs low guard still `>= 1` |
| E5 | 🔴 OPEN | Full-house phoenix still defaults higher pair to triple |
| E6 | 🟡 OPEN (latent) | Dragon-trick-at-endRound path still unguarded; currently unreachable via control flow |
| E7 | 🟡 OPEN (latent) | `getNextActiveSeat` still loops `attempts < 4` with no out-seat assertion |
| E8 | 🔴 OPEN | All 3 sub-items present: dead `getNormalRank`, Dog-rank 0-vs-(-1), shallow-copy in `passCards`/`applyPasses` |
| S1 | 🔴 OPEN | `batch.update()` still used in round/game-end stats (inconsistent with `updateTeamStats`'s merge-set) |
| S2 | 🔴 OPEN | Ties still awarded to team 1 in `stats.ts` and `scoring.ts` `getWinner` |
| S3 | 🔴 OPEN | `playedWith` still `arrayUnion`'d with no cap |
| S4 | 🟡 PARTIAL | Fire-and-forget writes unfixed; `fetchInvitableUsers` got a comment but still no `orderBy` |
| C1–C6 | 🔴 OPEN | All present (incl. all C3/C6 sub-bullets) — see each item |
| Cross-cutting | 🔴 OPEN | All four (dup event-detection, dup constants, fragile layout math, prop drilling) |

So aside from E1/E2, the rest of this section is genuinely still open and safe to pick
up from. The per-item descriptions below remain accurate.

## Engine / shared correctness

### ~~E1. Mah Jong wish not enforced on a fresh lead — HIGH [confirmed]~~ FIXED 2026-05-31
**`shared/src/engine.ts`** Dropped the `&& state.currentTrick` guard so wish
compliance is checked on a lead too (`checkWishCompliance` already handles the
lead case correctly via `canPlayWishedRankFromHand(..., null)`). Added an engine
test that a leader holding the wished rank must play it.

### ~~E2. Pass-count can mis-resolve when the last player went out on their final play~~ ALREADY FIXED
**`shared/src/engine.ts:431-440` (passTurn)** Already fixed in commit `2a779be`
("Fix trick-award after leader goes out"). The original buggy form was
`newPassCount >= activePlayers - 1`, which awarded the trick one pass too early when
the leader had gone out (they were no longer in `activePlayers`, so subtracting 1
double-counted). The current code computes the pass threshold directly:

```ts
const passersNeeded = state.players.filter(
  p => !p.isOut && p.seat !== state.lastPlayedBy
).length;
if (newPassCount >= passersNeeded) { ... }
```

This is robust regardless of whether `lastPlayedBy` is still in:
- **Leader still in** → excluded by `seat !== lastPlayedBy` → `passersNeeded = active - 1`.
- **Leader out on final play** → already excluded by `!p.isOut` (the extra clause is
  redundant) → `passersNeeded = active` (all remaining players must pass).

Covered by the targeted test `engine.test.ts:64` ("still requires remaining active
players to act after the leader goes out on their last play" — the exact
"2 players left" case), plus `engine.test.ts:201` for the leader-still-in path. All
engine tests pass.

### ~~E3. Phoenix single comparison in `canBeat` bypasses rank~~ NOT A BUG (re-triaged 2026-06-02)
**`shared/src/combinations.ts:375-377`** Re-examined: this is **not** a correctness
issue. The two mechanisms are complementary, not redundant:
- The `canBeat` special case ("Phoenix single beats any non-Dragon single") is the
  source of truth for *legality*, and it must live in `canBeat` because `canBeat` is
  called in ~15 places (`findPlayableCombos`, client play-validation) where the lone
  Phoenix combo still carries the default lead rank `1.5` from `singleCardRank`
  (the `lastPlayedRank` arg isn't passed in `identifyCombo`). Without it, a Phoenix
  would be wrongly *rejected* against any single above a 1.
- The `playCards` mutation `combo.rank = currentTrick.rank + 0.5` serves a *different*
  purpose: recording the Phoenix's effective rank so the **next** player's comparison
  is correct (must beat e.g. 13.5 after a Phoenix lands on a King). Removing it would
  be the actual bug.

The posited "illegal beat" (Phoenix over a previously-played Phoenix-as-Ace) is
impossible — there is only one Phoenix, so when you play it `currentTrick` is never a
Phoenix, `currentTrick.rank` is always an integer, and the special case can only ever
authorize genuinely legal plays. No change made.

### E4. Combo identification trusts `phoenixAs` hint without adjacency/range checks — MED [confirmed]
**`shared/src/combinations.ts:287-289` (straight), `:238,249` (consec pairs)** The
phoenix-extend branch sets `topRank = phoenixAs > top ? phoenixAs : top` with no check
that `phoenixAs` is contiguous (top+1), so a bad hint mints a non-contiguous straight
with an inflated rank. The low-extend branches also allow rank 1 (`>= 1`) for pairs,
which is impossible (no normal rank-1 card) — guard should be `>= 2`.

### E5. Full-house phoenix default silently picks the higher rank as the triple — MED [suspected]
**`shared/src/combinations.ts:163-172`** With two natural pairs + Phoenix and no
`phoenixAs` hint (the validation path in `playCards` never passes one), the engine
always interprets the higher pair as the triple, so a player who wants the lower
triple to legally duck/match can't express it.

### E6. `endRound` may mis-award a pending Dragon trick — LOW [suspected]
**`shared/src/engine.ts:736-746`** If a round ends while an un-awarded Dragon trick
sits on the table, `endRound` pushes those cards (incl. the 25-pt Dragon) to
`lastPlayedBy`'s team instead of forcing the opponent giveaway. The direct concede
path is guarded (`!dragonGiveaway`), but verify the `playDog`/`playBomb`/`giveDragonTrick`
paths can't reach `endRound` with a Dragon trick pending. Needs a test.

### E7. `getNextActiveSeat` can return an out player — LOW [confirmed]
**`shared/src/engine.ts:800-811`** Loops only `attempts < 4`; if 3 players are out it
can land back on an out seat with no guard. Should be unreachable (round ends at
3-out) but there's no assertion, so bad state stalls the game silently.

### E8. Minor smells — LOW
- `getNormalRank` (`combinations.ts:7-14`) is dead code (only `singleCardRank` is used).
- Dog rank convention is inconsistent: `cardSortValue` uses 0, `singleCardRank`/`identifyCombo` use -1 (`deck.ts` vs `combinations.ts:23-27`). Harmless (Dog never compared) but confusing.
- `passCards`/`callGrandTichu` (`engine.ts:130-184`) shallow-copy the players array then replace one index; correct today but fragile vs the deep-copy pattern in `playCards`. `applyPasses` (`:200-216`) assumes all 4 seats present in `passes` with no defensive check.

## Stats / persistence correctness

### S1. `batch.update()` on a possibly-nonexistent user doc fails the whole batch, silently — HIGH [confirmed]
**`server/src/stats.ts:98,151`** `updateStatsForRound`/`updateStatsForGameEnd` use
`batch.update()`, which Firestore rejects with NOT_FOUND if `users/{uid}` doesn't
exist (it's only created in the `load-profile` handler). A player who plays without
ever triggering `load-profile` makes the *entire atomic batch* fail, dropping that
round's stats for **all** players — and the error is swallowed by fire-and-forget
`.catch(console.error)` in `handler.ts:717-737`. `updateTeamStats` already uses
`set(..., {merge:true})`; make the others consistent.

### S2. Tie games are credited as a win for team 1 — MED [confirmed]
**`server/src/stats.ts:119,244`** (and **`shared/src/scoring.ts:111-118` getWinner**)
`team0Score > team1Score ? 0 : 1` awards ties to team 1. Tichu can legitimately tie
(both cross target same round). Affects `gamesWon`, `closeGameWins`, `comebackWins`.

### S3. `playedWith` array grows unbounded — MED [confirmed]
**`server/src/stats.ts:95`** Every round `arrayUnion`s all co-player uids with no
cap. Over time this inflates write size, read cost (`fetchInvitableUsers` reads the
whole list), and risks the 1 MiB Firestore document limit.

### S4. Non-transactional, error-swallowing stat writes — LOW/MED [confirmed]
**`server/src/stats.ts` + `handler.ts:717-737`** Four independent fire-and-forget
writes (round log, per-user, per-team, game-end). Per-field `increment` is atomic,
but cross-function consistency isn't — a partial failure permanently diverges
per-user vs per-team aggregates, with no metric/retry/alert. Also `fetchInvitableUsers`
(`stats.ts:354`) comments "by last activity" but has no `orderBy` — results are
arbitrary, not recent.

## Client correctness / React

### C1. Hooks declared after an early return — Rules-of-Hooks violation (latent) — MED [confirmed, currently masked]
**`client/src/pages/Game.tsx:193`** `if (!gameState) return null;` precedes hooks at
~212, 223 (useEffect) and ~252, 260, 269 (useMemo). This *would* crash on a
null→non-null transition, BUT I verified it's currently masked: `App.tsx:61` only
mounts `<Game>` when `gameState` is truthy, and when it goes null the parent swaps to
`<Lobby>` so `Game` never renders with null. Still fragile — move all hooks above the
early return so a future refactor can't reintroduce the crash.

### C2. `resetRoom` leaves stale cross-room state — MED [confirmed]
**`client/src/hooks/useSocket.ts:244-253`** Clears `gameState`/`roomCode`/`roundResult`
but not `aiOpenSeats`, `pendingInvites`, `expiredInviteUids`, `randomPartners`,
`autoSkippedSeat`, `needMahJongWish` — these can leak into the next room's UI after a
session is lost.

### C3. Uncleared timers fire setState after unmount — MED/LOW [confirmed]
- `WishDisplay.tsx:21-24` — 800ms evaporate `setTimeout` never cleared; also leaks if `wish` toggles again mid-animation.
- `GameAnnouncement.tsx:101-105` — per-event removal `setTimeout`s not tracked/cleared on unmount.
- `Game.tsx:218` (toast) and `useSocket.ts:106` (autoSkip) — 2s `setTimeout`s not cleared.

### C4. RoundResults mislabels double-victory team when `doubleVictoryTeam` is undefined — MED [confirmed]
**`client/src/components/RoundResults.tsx:67-68`** Indexes `result.doubleVictoryTeam === 0 ? ... : ...`,
so `undefined` silently falls into the team-1 branch. EventLog uses `?? 0` for the
same field — RoundResults should match.

### C5. Effects re-run on every broadcast via unstable refs — LOW/MED [confirmed]
- `Game.tsx:145-191` — title + tab-flash effects depend on `gameState?.players`, a fresh array each broadcast; they tear down/rebuild listeners and fight over `document.title` every update.
- `Game.tsx:212-220` — auto-pass effect depends on `socket` (a new object each render from `useSocket`), so it re-runs every render (guarded, but fragile). Consider memoizing the `useSocket` return.

### C6. Misc client smells — LOW
- `Game.tsx:421,435,461,474` — `PlayerPanel` `key` includes the seat's played card ids, so the panel fully remounts every play (intended for the seat-play animation, but it defeats `transition-shadow` on the turn ring). [by design — verify]
- `InvitePanel.tsx:63` — `p.displayName[0]` throws/renders undefined on an empty name.
- `RoundResults.tsx:41` — `readyCount` computed but unused (dead code).
- `useSocket.ts:33-39` — stale-token race: if the socket connects before `idToken` is set and the token then arrives a tick before `connect` fires, the `authenticate` emit can be missed. Consider emitting `authenticate` inside the `connect` handler.

## Cross-cutting design smells — MED/LOW
- **Duplicated event-detection logic:** `useGameEvents` (`GameAnnouncement.tsx`) and `useEventLog` (`EventLog.tsx`) independently re-derive the same transitions (tichu calls, dog, going-out, dragon-receiver) from prev-vs-current state with near-identical loops — two sources of truth that can drift.
- **Duplicated constants:** `RANKS [2..14]` / `SPECIALS` redefined in `CardsSeen.tsx:10-11`, `MahJongWish.tsx:7`, and the rank list in `Game.tsx` `comboLabel` — should come from `@tichu/shared`.
- **Fragile layout math:** `Card.tsx:92-99` hand-computes rotated card-strip geometry (`40 + (n-1)*20`, `stripWidth = 56`) that must stay in sync with `.card-back` CSS and the `-20/-28/-6px` overlaps scattered across `Card/Hand/SeatPlay`; a CSS size change silently breaks it. `PlayerPanel.tsx:26` also hardcodes `min-h/min-w`.
- **Prop drilling** (still open from item #20): the whole `useSocket` return is threaded through `Game`/`Lobby`; a context provider would be cleaner.
