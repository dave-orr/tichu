import { describe, it, expect } from 'vitest';
import { passTurn, playBomb } from './engine.js';
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
    expect(after2.state.trickCountdown).toEqual({ winner: 0 });
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
    expect(after.state.trickCountdown).toEqual({ winner: 0 });
  });
});
