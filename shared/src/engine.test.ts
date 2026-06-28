import { describe, it, expect } from 'vitest';
import { passTurn, playBomb, playCards, setMahJongWish } from './engine.js';
import {
  Card, Combo, DEFAULT_SETTINGS, GameState, NormalCard, Player, Seat,
} from './types.js';

function c(rank: number, suit: 'jade' | 'sword' | 'pagoda' | 'star' = 'jade'): NormalCard {
  return { type: 'normal', suit, rank: rank as any };
}

function makePlayer(seat: Seat, overrides: Partial<Player> = {}): Player {
  return {
    id: `p${seat}`,
    name: `Player ${seat}`,
    photoURL: null,
    seat,
    hand: [],
    tricksWon: [],
    tichuCall: 'none',
    hasPlayedFirstCard: true,
    isOut: false,
    outOrder: 0,
    grandTichuDecided: true,
    passedCards: true,
    isAi: false,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing',
    players: [makePlayer(0), makePlayer(1), makePlayer(2), makePlayer(3)],
    teams: [
      { players: [0, 2], score: 0 },
      { players: [1, 3], score: 0 },
    ],
    currentTrick: null,
    currentTrickPlays: [],
    passCount: 0,
    passedSeats: [],
    turnIndex: 0,
    lastPlayedBy: null,
    mahJongWish: null,
    mahJongWishPending: false,
    outCount: 0,
    roundNumber: 1,
    deck: [],
    bombWindow: false,
    trickCountdown: null,
    dragonGiveaway: false,
    dragonGiveawayBy: null,
    settings: DEFAULT_SETTINGS,
    playedCards: [],
    roundEndReady: [],
    roundHistory: [],
    receivedCards: [[], [], [], []],
    ...overrides,
  };
}

const trickSeven: Combo = { type: 'single', cards: [c(7)], rank: 7, length: 1 };

describe('passTurn — pass-count threshold when leader is out', () => {
  it('still requires remaining active players to act after the leader goes out on their last play', () => {
    // Seat 3 was already out earlier in the round. Seat 0 just played their
    // last cards (lastPlayedBy = 0, isOut = true). Two players (1 and 2)
    // remain. After seat 1 passes, seat 2 still needs a turn — the trick
    // must NOT be auto-awarded yet.
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { isOut: true, outOrder: 2, hasPlayedFirstCard: true }),
      makePlayer(1, { hand: [c(8)], hasPlayedFirstCard: true }),
      makePlayer(2, { hand: [c(9)], hasPlayedFirstCard: true }),
      makePlayer(3, { isOut: true, outOrder: 1 }),
    ];
    const state = makeState({
      players,
      turnIndex: 1,
      lastPlayedBy: 0,
      currentTrick: trickSeven,
      currentTrickPlays: [{ seat: 0, cards: [c(7)] }],
      outCount: 2,
    });

    const after1 = passTurn(state, 1);
    expect(after1.trickCountdownStarted).toBeFalsy();
    expect(after1.state.trickCountdown).toBeNull();
    expect(after1.state.passCount).toBe(1);
    expect(after1.state.turnIndex).toBe(2);

    const after2 = passTurn(after1.state, 2);
    expect(after2.trickCountdownStarted).toBe(true);
    // No remaining player can bomb (everyone holds < 4 cards), so the countdown
    // collapses to the fast duration.
    expect(after2.state.trickCountdown).toEqual({ winner: 0, durationMs: 500 });
  });

  it('a bomb fulfills an outstanding Mah Jong wish for the bomb rank', () => {
    // Wish is set for 5s. Seat 1 is on turn but seat 2 (out-of-turn) bombs
    // with four 5s. The wish should clear.
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [c(8)], hasPlayedFirstCard: true }),
      makePlayer(1, { hand: [c(9)], hasPlayedFirstCard: true }),
      makePlayer(2, {
        hand: [c(5, 'jade'), c(5, 'sword'), c(5, 'pagoda'), c(5, 'star'), c(11)],
        hasPlayedFirstCard: true,
      }),
      makePlayer(3, { hand: [c(12)], hasPlayedFirstCard: true }),
    ];
    const state = makeState({
      players,
      turnIndex: 1,
      lastPlayedBy: 0,
      currentTrick: trickSeven,
      currentTrickPlays: [{ seat: 0, cards: [c(7)] }],
      mahJongWish: 5,
    });

    const bomb: Card[] = [c(5, 'jade'), c(5, 'sword'), c(5, 'pagoda'), c(5, 'star')];
    const after = playBomb(state, 2, bomb);
    expect(after.state.lastPlayedBy).toBe(2);
    expect(after.state.mahJongWish).toBeNull();
  });

  it('enforces the Mah Jong wish when leading a new trick', () => {
    // No current trick (seat 0 leads) and a wish for 5s is active. Seat 0 holds
    // a 5, so a lead that omits it must be rejected, and a lead that includes it
    // must be accepted (and fulfill the wish).
    const state = makeState({
      players: [
        makePlayer(0, { hand: [c(5, 'jade'), c(9, 'sword')], hasPlayedFirstCard: true }),
        makePlayer(1), makePlayer(2), makePlayer(3),
      ],
      turnIndex: 0,
      currentTrick: null,
      mahJongWish: 5,
    });

    // Leading the 9 (omitting the wished 5) is illegal — state unchanged.
    const rejected = playCards(state, 0, [c(9, 'sword')]);
    expect(rejected.state).toBe(state);

    // Leading the 5 is legal and fulfills the wish.
    const accepted = playCards(state, 0, [c(5, 'jade')]);
    expect(accepted.state.mahJongWish).toBeNull();
    expect(accepted.state.lastPlayedBy).toBe(0);
  });

  it('holds the turn on the Mah Jong player until they pick a wish', () => {
    // Seat 0 has the Mah Jong and leads with it. The turn must stay on seat 0
    // (so seat 1 doesn't see "Your turn!" while the wish dialog is open) and
    // any play/pass attempt by seat 1 must be rejected.
    const mahjong: Card = { type: 'special', name: 'mahjong' };
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [mahjong, c(8), c(9)], hasPlayedFirstCard: false }),
      makePlayer(1, { hand: [c(10), c(11)], hasPlayedFirstCard: false }),
      makePlayer(2, { hand: [c(12), c(13)], hasPlayedFirstCard: false }),
      makePlayer(3, { hand: [c(14), c(2)], hasPlayedFirstCard: false }),
    ];
    const state = makeState({ players, turnIndex: 0 });

    const afterMahjong = playCards(state, 0, [mahjong]);
    expect(afterMahjong.needMahJongWish).toBe(true);
    expect(afterMahjong.state.mahJongWishPending).toBe(true);
    // Turn stays on seat 0 — does NOT advance to seat 1.
    expect(afterMahjong.state.turnIndex).toBe(0);
    expect(afterMahjong.state.lastPlayedBy).toBe(0);

    // Seat 1 cannot play while the wish is pending.
    const seat1Tries = playCards(afterMahjong.state, 1, [c(10)]);
    expect(seat1Tries.state).toBe(afterMahjong.state);

    // Seat 1 cannot pass either.
    const seat1Passes = passTurn(afterMahjong.state, 1);
    expect(seat1Passes.state).toBe(afterMahjong.state);

    // Once seat 0 sets the wish, the turn advances (clockwise default → seat 1)
    // and the pending flag clears.
    const afterWish = setMahJongWish(afterMahjong.state, 0, 5);
    expect(afterWish.mahJongWishPending).toBe(false);
    expect(afterWish.mahJongWish).toBe(5);
    expect(afterWish.turnIndex).toBe(1);

    // A different seat cannot set or override a pending wish.
    const intruder = setMahJongWish(afterMahjong.state, 1, 9);
    expect(intruder).toBe(afterMahjong.state);
  });

  it('declining the wish (null) also releases the turn', () => {
    const mahjong: Card = { type: 'special', name: 'mahjong' };
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [mahjong, c(8)], hasPlayedFirstCard: false }),
      makePlayer(1, { hand: [c(10), c(11)] }),
      makePlayer(2, { hand: [c(12), c(13)] }),
      makePlayer(3, { hand: [c(14), c(2)] }),
    ];
    const state = makeState({ players, turnIndex: 0 });

    const afterMahjong = playCards(state, 0, [mahjong]);
    expect(afterMahjong.state.turnIndex).toBe(0);

    const afterWish = setMahJongWish(afterMahjong.state, 0, null);
    expect(afterWish.mahJongWish).toBeNull();
    expect(afterWish.mahJongWishPending).toBe(false);
    expect(afterWish.turnIndex).toBe(1);
  });

  it('awards on the single remaining pass when the leader is still in', () => {
    // All four players still in. Seat 0 led, seats 1 and 2 already passed;
    // seat 3 passing should win the trick.
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [c(8)] }),
      makePlayer(1, { hand: [c(9)] }),
      makePlayer(2, { hand: [c(10)] }),
      makePlayer(3, { hand: [c(11)] }),
    ];
    const state = makeState({
      players,
      turnIndex: 3,
      lastPlayedBy: 0,
      currentTrick: trickSeven,
      currentTrickPlays: [{ seat: 0, cards: [c(7)] }],
      passCount: 2,
    });

    const after = passTurn(state, 3);
    expect(after.trickCountdownStarted).toBe(true);
    expect(after.state.trickCountdown).toEqual({ winner: 0, durationMs: 500 });
  });

  it('uses the full countdown when a non-winner could still bomb', () => {
    // Seat 1 holds 4 cards, so a bomb remains possible after seat 0 wins —
    // the countdown must stay at the full duration.
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [c(8)] }),
      makePlayer(1, { hand: [c(9), c(9), c(9), c(9)] }),
      makePlayer(2, { hand: [c(10)] }),
      makePlayer(3, { hand: [c(11)] }),
    ];
    const state = makeState({
      players,
      turnIndex: 3,
      lastPlayedBy: 0,
      currentTrick: trickSeven,
      currentTrickPlays: [{ seat: 0, cards: [c(7)] }],
      passCount: 2,
    });

    const after = passTurn(state, 3);
    expect(after.trickCountdownStarted).toBe(true);
    expect(after.state.trickCountdown).toEqual({ winner: 0, durationMs: 3000 });
  });

  it('uses the full countdown when the winner holds a bomb (e.g. to bomb their own Dragon)', () => {
    // Only the winner (seat 0) has >= 4 cards. They may still want to bomb their
    // own trick — the classic Dragon case — so the countdown stays full.
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [c(9), c(9), c(9), c(9)] }),
      makePlayer(1, { hand: [c(8)] }),
      makePlayer(2, { hand: [c(10)] }),
      makePlayer(3, { hand: [c(11)] }),
    ];
    const state = makeState({
      players,
      turnIndex: 3,
      lastPlayedBy: 0,
      currentTrick: trickSeven,
      currentTrickPlays: [{ seat: 0, cards: [c(7)] }],
      passCount: 2,
    });

    const after = passTurn(state, 3);
    expect(after.trickCountdownStarted).toBe(true);
    expect(after.state.trickCountdown).toEqual({ winner: 0, durationMs: 3000 });
  });
});
