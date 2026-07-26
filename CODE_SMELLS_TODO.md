# Code Smells & Improvement TODO

Open correctness bugs and design smells. Security-specific items live in
`SECURITY_TODO.md`. Each item is tagged **[confirmed]** (traced the logic) or
**[suspected]** (needs a repro/test).

---

## Engine / shared correctness

### E6. `endRound` may mis-award a pending Dragon trick — LOW [suspected]
**`shared/src/engine.ts` `endRound`** If a round ends while an un-awarded Dragon trick
sits on the table, `endRound` pushes those cards (incl. the 25-pt Dragon) to
`lastPlayedBy`'s team instead of forcing the opponent giveaway. The direct concede
path is guarded (`!dragonGiveaway`), but verify the `playDog`/`playBomb`/`giveDragonTrick`
paths can't reach `endRound` with a Dragon trick pending. Needs a test.

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

### C6. Misc client smells — LOW
- `Card.tsx` — the `large`/`small` size classes (`w-36 h-[216px]`, `w-16 h-24`) never
  apply: the `.card { @apply w-24 h-36 ... }` rule in `index.css` comes after the
  `@tailwind utilities` layer, so it wins the cascade and every card renders at the
  base 96×144 size. The inner glyph/text scaling for `large`/`small` still applies,
  and sibling layout (`PassCards` slot placeholders, `Hand` overlap `×1.5`,
  `renderMiniCard` wrappers) is sized assuming the modifiers work — fixing the cascade
  would change every card's size, so re-tune those alongside. [confirmed]

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
