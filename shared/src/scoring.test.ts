import { describe, it, expect } from 'vitest';
import { cardPoints, sumPoints, scoreRound } from './scoring.js';
import { Card, NormalCard, GameState, Player, Seat, DEFAULT_SETTINGS } from './types.js';

function c(rank: number, suit: 'jade' | 'sword' | 'pagoda' | 'star' = 'jade'): NormalCard {
  return { type: 'normal', suit, rank: rank as any };
}

describe('cardPoints', () => {
  it('5s are worth 5', () => {
    expect(cardPoints(c(5))).toBe(5);
  });

  it('10s are worth 10', () => {
    expect(cardPoints(c(10))).toBe(10);
  });

  it('Kings are worth 10', () => {
    expect(cardPoints(c(13))).toBe(10);
  });

  it('Dragon is worth 25', () => {
    expect(cardPoints({ type: 'special', name: 'dragon' })).toBe(25);
  });

  it('Phoenix is worth -25', () => {
    expect(cardPoints({ type: 'special', name: 'phoenix' })).toBe(-25);
  });

  it('other cards are worth 0', () => {
    expect(cardPoints(c(2))).toBe(0);
    expect(cardPoints(c(3))).toBe(0);
    expect(cardPoints(c(14))).toBe(0); // Ace
    expect(cardPoints({ type: 'special', name: 'mahjong' })).toBe(0);
    expect(cardPoints({ type: 'special', name: 'dog' })).toBe(0);
  });
});

describe('sumPoints', () => {
  it('sums points of multiple cards', () => {
    const cards: Card[] = [c(5), c(10), c(13), c(2)];
    expect(sumPoints(cards)).toBe(25); // 5 + 10 + 10 + 0
  });

  it('entire deck sums to 100', () => {
    const cards: Card[] = [];
    const suits = ['jade', 'sword', 'pagoda', 'star'] as const;
    for (const suit of suits) {
      for (let rank = 2; rank <= 14; rank++) {
        cards.push(c(rank, suit));
      }
    }
    cards.push({ type: 'special', name: 'mahjong' });
    cards.push({ type: 'special', name: 'dog' });
    cards.push({ type: 'special', name: 'phoenix' });
    cards.push({ type: 'special', name: 'dragon' });
    expect(sumPoints(cards)).toBe(100);
  });
});

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
    isOut: true,
    outOrder: 0,
    grandTichuDecided: true,
    passedCards: true,
    ...overrides,
  };
}

function makeState(players: [Player, Player, Player, Player]): GameState {
  return {
    phase: 'roundEnd',
    players,
    teams: [
      { players: [0, 2], score: 0 },
      { players: [1, 3], score: 0 },
    ],
    currentTrick: null,
    currentTrickCards: [],
    passCount: 0,
    turnIndex: 0,
    lastPlayedBy: null,
    mahJongWish: null,
    outCount: 4,
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
  };
}

describe('scoreRound', () => {
  it('scores concede correctly — all remaining hands go to opponents of conceding player', () => {
    // Seat 1 (team 1) out 1st. Seats 0, 2 (team 0), 3 (team 1) remain.
    // Seat 3 (team 1) concedes → last player. Seats 0 and 2 forced out with cards.
    // All remaining hand cards go to last player's opposing team (team 0).
    const state = makeState([
      makePlayer(0, { outOrder: 2, hand: [c(5)], tricksWon: [[c(10)]] }),  // team 0, forced out, 5 in hand, 10 in tricks
      makePlayer(1, { outOrder: 1, tricksWon: [[c(13)]] }),                // team 1, out 1st, 10 in tricks
      makePlayer(2, { outOrder: 3, hand: [c(10)], tricksWon: [] }),        // team 0, forced out, 10 in hand
      makePlayer(3, { outOrder: 4, hand: [c(5)], tricksWon: [[c(13)]] }), // team 1, conceded last, 5 in hand, 10 in tricks
    ]);

    const result = scoreRound(state);
    // Last player is seat 3 (team 1). All hands go to team 0.
    // Seat 0 tricks (10) → team 0. Seat 1 tricks (10) → team 1.
    // Seat 2 tricks (0) → team 0. Seat 3 tricks (10) → first-out team (team 1).
    // Hands: seat 0 (5) + seat 2 (10) + seat 3 (5) = 20 → all to team 0.
    // Team 0: 10 + 0 + 20 = 30. Team 1: 10 + 10 = 20. Total = 50 (not full deck, that's fine).
    expect(result.teamScores[0]).toBe(30);
    expect(result.teamScores[1]).toBe(20);
  });

  it('concede: forced-out teammate hand cards go to own team, not opponents', () => {
    // Key scenario: seat 2 (team 0) forced out has cards.
    // Seat 3 (team 1) conceded (last). All hands → team 0 (opponents of last player).
    // Seat 2's hand should go to team 0 (their own team), NOT team 1.
    const state = makeState([
      makePlayer(0, { outOrder: 1, tricksWon: [] }),               // team 0, out 1st
      makePlayer(1, { outOrder: 2, tricksWon: [] }),               // team 1, out 2nd
      makePlayer(2, { outOrder: 3, hand: [c(5)], tricksWon: [] }), // team 0, forced out, 5 in hand
      makePlayer(3, { outOrder: 4, hand: [c(10)], tricksWon: [] }), // team 1, conceded, 10 in hand
    ]);

    const result = scoreRound(state);
    // All hands → team 0 (opponents of seat 3/team 1).
    // Team 0: 5 + 10 = 15. Team 1: 0.
    expect(result.teamScores[0]).toBe(15);
    expect(result.teamScores[1]).toBe(0);
  });

  it('normal round end scores to 100', () => {
    // Normal game: seats go out 0, 1, 2, seat 3 is last with cards
    // All 100 pts distributed across tricks and last player hand
    const state = makeState([
      makePlayer(0, { outOrder: 1, tricksWon: [[c(10), c(10, 'sword'), c(5), c(5, 'sword')]] }), // 30 pts
      makePlayer(1, { outOrder: 2, tricksWon: [[c(13), c(13, 'sword')]] }),                       // 20 pts
      makePlayer(2, { outOrder: 3, tricksWon: [[c(5, 'pagoda'), c(5, 'star')]] }),                 // 10 pts
      makePlayer(3, { outOrder: 4, hand: [c(13, 'pagoda'), c(13, 'star'), { type: 'special', name: 'dragon' }, { type: 'special', name: 'phoenix' }], tricksWon: [[c(10, 'pagoda'), c(10, 'star')]] }), // 20 in hand, 20 in tricks
    ]);

    const result = scoreRound(state);
    // Last player is seat 3 (team 1). Tricks (20) go to first-out (seat 0, team 0).
    // Hand (20) goes to opposing team (team 0).
    // Team 0: 30 (seat 0 tricks) + 10 (seat 2 tricks) + 20 (seat 3 tricks) + 20 (seat 3 hand) = 80
    // Team 1: 20 (seat 1 tricks) = 20
    expect(result.teamScores[0] + result.teamScores[1]).toBe(100);
    expect(result.teamScores[0]).toBe(80);
    expect(result.teamScores[1]).toBe(20);
  });
});
