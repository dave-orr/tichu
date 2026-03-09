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
  it('scores concede correctly when forced-out player has cards in hand', () => {
    // Seat 0 (team 0) went out first, seat 2 (team 0) went out second
    // Seat 1 (team 1) has a 5 in hand (forced out via concede)
    // Seat 3 (team 1) conceded and is last, has a King (10 pts) in hand
    // Team 0 tricks: 55 pts. Team 1 tricks: 30 pts.
    // Last player (seat 3) tricks (30) go to first-out team (team 0).
    // Seat 1 hand (5 pts) -> team 0. Seat 3 hand (10 pts) -> team 0.
    // Team 0: 55 + 30 + 5 + 10 = 100. Team 1: 0.
    const state = makeState([
      makePlayer(0, { outOrder: 1, tricksWon: [[c(10), c(5), c(13)]] }), // 25 pts tricks
      makePlayer(1, { outOrder: 3, hand: [c(5)], tricksWon: [] }),       // forced out, 5 in hand
      makePlayer(2, { outOrder: 2, tricksWon: [[c(10), c(5)]] }),        // 15 pts tricks
      makePlayer(3, { outOrder: 4, hand: [c(13)], tricksWon: [[c(13), c(5), c(10)]] }), // conceded, 10 in hand, 25 pts tricks
    ]);

    // Trick points: team 0 has 25+15=40 from own tricks
    // Last player is seat 3 (outOrder 4), their 25 pts tricks go to first-out (seat 0, team 0)
    // So team 0 gets 40 + 25 = 65 from tricks
    // Hand cards: seat 1 hand (5) -> team 0, seat 3 hand (10) -> team 0
    // Team 0 total: 65 + 5 + 10 = 80
    // Team 1 total: 0
    // Wait, that doesn't add to 100. Let me recalculate...
    // Total card points in tricks: 25 + 0 + 15 + 25 = 65. In hands: 5 + 10 = 15. Total = 80.
    // That's because I didn't distribute 100 pts worth of cards. Let me fix.

    const state2 = makeState([
      makePlayer(0, { outOrder: 1, tricksWon: [[c(10), c(5), c(13), { type: 'special', name: 'dragon' }]] }), // 50 pts
      makePlayer(1, { outOrder: 3, hand: [c(5)], tricksWon: [] }),        // forced out, 5 in hand
      makePlayer(2, { outOrder: 2, tricksWon: [[c(10), c(5), c(13)]] }),  // 25 pts
      makePlayer(3, { outOrder: 4, hand: [c(13)], tricksWon: [[c(10), { type: 'special', name: 'phoenix' }]] }), // conceded, 10 in hand, -15 pts tricks
    ]);
    // Tricks: 50 + 0 + 25 + (-15) = 60. Hands: 5 + 10 = 15. Not 100 either.
    // Doesn't matter — the test just needs to verify hand cards are scored.

    // Seat 0 (team 0) out 1st, seat 1 (team 1) out 2nd (no double victory)
    // Seat 3 (team 1) concedes, making seat 2 (team 0) forced out 3rd with cards
    // Seat 3 is last (4th)
    const simpleState = makeState([
      makePlayer(0, { outOrder: 1, tricksWon: [[c(5)]] }),       // team 0, 5 pts tricks
      makePlayer(1, { outOrder: 2, tricksWon: [] }),              // team 1, out 2nd
      makePlayer(2, { outOrder: 3, hand: [c(5)], tricksWon: [] }), // team 0, forced out, 5 in hand
      makePlayer(3, { outOrder: 4, hand: [], tricksWon: [] }),    // team 1, conceded last, no cards
    ]);

    const result = scoreRound(simpleState);
    // Team 0 gets: 5 (seat 0 tricks). Seat 2 hand (5) goes to opposing team 1.
    // Last player seat 3 has no tricks/hand.
    // Team 0: 5. Team 1: 5.
    expect(result.teamScores[0]).toBe(5);
    expect(result.teamScores[1]).toBe(5);
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
