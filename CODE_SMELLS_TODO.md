# Code Smells & Improvement TODO

Open correctness bugs and design smells. Security-specific items live in
`SECURITY_TODO.md`. Each item is tagged **[confirmed]** (traced the logic) or
**[suspected]** (needs a repro/test).

---

## Engine / shared correctness

### E4. Combo identification trusts `phoenixAs` hint without adjacency/range checks — MED [confirmed]
**`shared/src/combinations.ts`** (straight + consec-pairs phoenix-extend branches) The
phoenix-extend branch sets `topRank = phoenixAs > top ? phoenixAs : top` with no check
that `phoenixAs` is contiguous (top+1), so a bad hint mints a non-contiguous straight
with an inflated rank. The low-extend branches also allow rank 1 (`>= 1`) for pairs,
which is impossible (no normal rank-1 card) — guard should be `>= 2`.

### E5. Full-house phoenix default silently picks the higher rank as the triple — MED [suspected]
**`shared/src/combinations.ts` `tryFullHouse`** With two natural pairs + Phoenix and no
`phoenixAs` hint (the validation path in `playCards` never passes one), the engine
always interprets the higher pair as the triple, so a player who wants the lower
triple to legally duck/match can't express it.

### E6. `endRound` may mis-award a pending Dragon trick — LOW [suspected]
**`shared/src/engine.ts` `endRound`** If a round ends while an un-awarded Dragon trick
sits on the table, `endRound` pushes those cards (incl. the 25-pt Dragon) to
`lastPlayedBy`'s team instead of forcing the opponent giveaway. The direct concede
path is guarded (`!dragonGiveaway`), but verify the `playDog`/`playBomb`/`giveDragonTrick`
paths can't reach `endRound` with a Dragon trick pending. Needs a test.

### E7. `getNextActiveSeat` can return an out player — LOW [confirmed]
**`shared/src/engine.ts` `getNextActiveSeat`** Loops only `attempts < 4`; if 3 players
are out it can land back on an out seat with no guard. Should be unreachable (round
ends at 3-out) but there's no assertion, so bad state stalls the game silently.

### E8. Minor smells — LOW
- `getNormalRank` (`combinations.ts`) is dead code (only `singleCardRank` is used).
- Dog rank convention is inconsistent: `cardSortValue` uses 0, `singleCardRank`/`identifyCombo`
  use -1 (`deck.ts` vs `combinations.ts`). Harmless (Dog never compared) but confusing.
- `passCards`/`callGrandTichu` (`engine.ts`) shallow-copy the players array then replace
  one index; correct today but fragile vs the deep-copy pattern in `playCards`.
  `applyPasses` assumes all 4 seats present in `passes` with no defensive check.

## Stats / persistence correctness

### S3. `playedWith` array grows unbounded — MED [confirmed]
**`server/src/stats.ts`** Every round `arrayUnion`s all co-player uids with no cap.
Over time this inflates write size, read cost (`fetchInvitableUsers` reads the whole
list), and risks the 1 MiB Firestore document limit.

### S4. Non-transactional, error-swallowing stat writes — LOW/MED [confirmed]
**`server/src/stats.ts` + `handler.ts`** Four independent fire-and-forget writes (round
log, per-user, per-team, game-end). Per-field `increment` is atomic, but cross-function
consistency isn't — a partial failure permanently diverges per-user vs per-team
aggregates, with no metric/retry/alert. Also `fetchInvitableUsers` comments
"by last activity" but has no `orderBy` — results are arbitrary, not recent.

## Client correctness / React

### C1. Hooks declared after an early return — Rules-of-Hooks violation (latent) — MED [confirmed, currently masked]
**`client/src/pages/Game.tsx`** `if (!gameState) return null;` precedes several
`useEffect`/`useMemo` hooks. This *would* crash on a null→non-null transition, BUT it's
currently masked: `App.tsx` only mounts `<Game>` when `gameState` is truthy, and when it
goes null the parent swaps to `<Lobby>` so `Game` never renders with null. Still fragile
— move all hooks above the early return so a future refactor can't reintroduce the crash.

### C2. `resetRoom` leaves stale cross-room state — MED [confirmed]
**`client/src/hooks/useSocket.ts` `resetRoom`** Clears `gameState`/`roomCode`/`roundResult`
but not `aiOpenSeats`, `pendingInvites`, `expiredInviteUids`, `randomPartners`,
`autoSkippedSeat`, `needMahJongWish` — these can leak into the next room's UI after a
session is lost.

### C3. Uncleared timers fire setState after unmount — MED/LOW [confirmed]
- `WishDisplay.tsx` — 800ms `setTimeout` never cleared; also leaks if `wish` toggles again mid-animation.
- `GameAnnouncement.tsx` — per-event removal `setTimeout`s not tracked/cleared on unmount.
- `Game.tsx` (toast) and `useSocket.ts` (autoSkip) — 2s `setTimeout`s not cleared.

### C5. Effects re-run on every broadcast via unstable refs — LOW/MED [confirmed]
- `Game.tsx` — title + tab-flash effects depend on `gameState?.players`, a fresh array each
  broadcast; they tear down/rebuild listeners and fight over `document.title` every update.
- `Game.tsx` — auto-pass effect depends on `socket` (a new object each render from
  `useSocket`), so it re-runs every render (guarded, but fragile). Consider memoizing the
  `useSocket` return.

### C6. Misc client smells — LOW
- `Game.tsx` — `PlayerPanel` `key` includes the seat's played card ids, so the panel fully
  remounts every play (intended for the seat-play animation, but it defeats
  `transition-shadow` on the turn ring). [by design — verify]
- `InvitePanel.tsx` — `p.displayName[0]` throws/renders undefined on an empty name.
- `RoundResults.tsx` — `readyCount` computed but unused (dead code).
- `useSocket.ts` — stale-token race: if the socket connects before `idToken` is set and the
  token then arrives a tick before `connect` fires, the `authenticate` emit can be missed.
  Consider emitting `authenticate` inside the `connect` handler.

## Cross-cutting design smells — MED/LOW
- **Duplicated event-detection logic:** `useGameEvents` (`GameAnnouncement.tsx`) and
  `useEventLog` (`EventLog.tsx`) independently re-derive the same transitions (tichu calls,
  dog, going-out, dragon-receiver) from prev-vs-current state with near-identical loops —
  two sources of truth that can drift.
- **Duplicated constants:** `RANKS [2..14]` / `SPECIALS` redefined in `CardsSeen.tsx`,
  `MahJongWish.tsx`, and the rank list in `Game.tsx` `comboLabel` — should come from
  `@tichu/shared`.
- **Fragile layout math:** `Card.tsx` hand-computes rotated card-strip geometry
  (`40 + (n-1)*20`, `stripWidth = 56`) that must stay in sync with `.card-back` CSS and the
  `-20/-28/-6px` overlaps scattered across `Card/Hand/SeatPlay`; a CSS size change silently
  breaks it. `PlayerPanel.tsx` also hardcodes `min-h/min-w`.
- **Prop drilling:** the whole `useSocket` return is threaded through `Game`/`Lobby` as
  props (`client/src/pages/Game.tsx`, `Lobby.tsx`); a React context provider would be
  cleaner and avoid passing the large object through component trees.
