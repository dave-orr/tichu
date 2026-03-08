# Playtest TODO

Organized into groups that can be worked on in parallel by separate Claude instances.
Groups that share heavy edits to the same files (especially `Game.tsx`) should NOT run concurrently.

**Safe to parallelize:** C, D, E, F (mostly independent files)
**Run sequentially with each other:** A and B (both heavily edit `Game.tsx`)

---

## Group A — Card Rendering & UI Layout
*Key files: `Game.tsx`, `Card.tsx`, `Hand.tsx`, CSS/Tailwind*

- [x] 1. Make cards bigger
- [x] 7. Move passed/received cards display below your cards and play buttons (scroll issue on small screens)
- [x] 11. Move score box to top left
- [x] 16. Position phoenix correctly within straights/full houses in the play area (not just appended to the right)

## Group B — Turn/Play UX
*Key files: `Game.tsx`, `PlayArea.tsx`, new audio assets*

- [x] 2. Add glow around your cards + gentle chime when it becomes your turn
- [x] 3. Make glow around other players' cards more prominent when it's their turn
- [x] 14. Auto-skip turn with toast when player has <4 cards, no bomb possible, and can't beat current play (e.g. straight has more cards than hand)
- [x] 15. Add "pass next play" button for pre-queuing a pass on your next turn (respects wish rules)

## Group C — Shared/Engine Logic
*Key files: `types.ts`, `engine.ts`, `scoring.ts`, `combinations.ts`*

- [x] 5. Add game setting for custom target score (instead of always 1000)
- [x] 17. Show card count in straight labels, e.g. "7-card Straight, rank 12"
- [x] 18. Fix dragon rank from 16 to 15
- [x] 19. Fix card point scoring — account for points in players' hands at round end (85 points seen in a round)

## Group D — New Features
*Key files: new components, additions to `Game.tsx`*

- [x] 9. Create scrollable text event log at bottom right showing all public game events (cards played, trick winners, dragon giveaways, etc.)
- [x] 12. Show active wish as card image centered above play area; evaporate animation when fulfilled
- [x] 21. Add button under played cards area to show all cards played this trick (not just the top play)

## Group E — Dialogs/Modals/Text Fixes
*Key files: scattered small changes across components*

- [x] 4. Fix capitalizations: "Four-of-a-Kind Bomb", "Straight Flush Bomb", audit others
- [x] 6. Add confirmation dialog when calling tichu/grand if someone else already called
- [x] 8. Fix dragon giveaway dialog: left opponent on left side, not right
- [x] 10. Play soft gong sound when someone calls tichu/grand
- [x] 13. Show which players we're waiting on whenever waiting for other players
- [x] 22. Add close/new game button to game over screen
- [x] 23. Fix stats percentages showing "undefined" when denominator is zero — show 0 instead

## Group F — Pass Phase
*Key files: `PassCards.tsx`, `Game.tsx` (pass section only)*

- [ ] 20. Remove passed cards from hand visually after confirming pass (while waiting for others)
