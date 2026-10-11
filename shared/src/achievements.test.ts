import { describe, it, expect } from 'vitest';
import { computeAchievements, achievementEvents, AchievementId } from './achievements.js';
import { GameRecord } from './stats.js';
import {
  Card, GameSummary, NormalRank, RoundLog, RoundPlay, Seat, Suit, TichuCall,
} from './types.js';

// Seats 0&2 = team 0 (A + C), seats 1&3 = team 1 (B + D).
const UIDS = ['A', 'B', 'C', 'D'];

const n = (rank: number, suit: Suit = 'jade'): Card => ({ type: 'normal', suit, rank: rank as NormalRank });
const sp = (name: 'mahjong' | 'dog' | 'phoenix' | 'dragon'): Card => ({ type: 'special', name });
const fourOf = (rank: number): Card[] => (['jade', 'sword', 'pagoda', 'star'] as Suit[]).map(s => n(rank, s));

function summary(id: string, over: Partial<GameSummary> = {}): GameSummary {
  return {
    gameId: id,
    finishedAt: 1000,
    players: [0, 1, 2, 3].map(seat => ({
      seat: seat as Seat, uid: UIDS[seat], name: UIDS[seat], team: (seat % 2) as 0 | 1,
    })),
    finalScores: [1000, 500],
    winningTeam: 0,
    rounds: 1,
    ...over,
  };
}

type RoundSpec = {
  before?: [number, number];
  after?: [number, number];
  calls?: Partial<Record<Seat, TichuCall>>;
  outOrder?: Seat[];
  firstEight?: Partial<Record<Seat, Card[]>>;
  bombs?: Seat[];
  plays?: RoundPlay[];
};

function round(gameId: string, num: number, spec: RoundSpec = {}): RoundLog {
  const outOrder = spec.outOrder ?? [0, 1, 2];
  return {
    gameId, roundNumber: num, timestamp: 0,
    scoresBeforeRound: spec.before ?? [0, 0],
    scoresAfterRound: spec.after ?? [100, 0],
    roundCardPoints: [50, 50],
    tichuBonuses: [0, 0],
    isDoubleVictory: false,
    outOrder,
    players: [0, 1, 2, 3].map(seat => ({
      seat: seat as Seat,
      uid: UIDS[seat],
      name: UIDS[seat],
      team: (seat % 2) as 0 | 1,
      tichuCall: spec.calls?.[seat as Seat] ?? 'none',
      outOrder: outOrder.indexOf(seat as Seat) + 1,
      initialHand: [],
      firstEight: spec.firstEight?.[seat as Seat],
      passedLeft: null, passedPartner: null, passedRight: null,
    })),
    bombs: (spec.bombs ?? []).map(seat => ({ seat, cards: fourOf(5) })),
    dragonGiveaways: [],
    mahJongWishes: [],
    plays: spec.plays,
  };
}

function counts(records: GameRecord[], uid: string): Record<AchievementId, number> {
  return Object.fromEntries(computeAchievements(records, uid).map(a => [a.id, a.count])) as Record<AchievementId, number>;
}

describe('computeAchievements', () => {
  it('Grand Theft: made Grand while an opponent also called Grand', () => {
    const records: GameRecord[] = [{
      summary: summary('g'),
      rounds: [
        round('g', 1, { calls: { 0: 'grand', 1: 'grand' }, outOrder: [0, 1, 2] }),
        // Partner's Grand doesn't count; only an opponent's.
        round('g', 2, { calls: { 0: 'grand', 2: 'grand' }, outOrder: [0, 1, 2] }),
      ],
    }];
    expect(counts(records, 'A')['grand-theft']).toBe(1);
    expect(counts(records, 'B')['grand-theft']).toBe(0);
  });

  it('Phoenix Rising / Lazarus: wins from 500+ and 1000+ down', () => {
    const records: GameRecord[] = [
      { summary: summary('g1'), rounds: [round('g1', 1), round('g1', 2, { before: [100, 650] })] },
      { summary: summary('g2'), rounds: [round('g2', 1, { before: [0, 1000] })] },
      // Lost from 600 down: nothing.
      { summary: summary('g3', { winningTeam: 1 }), rounds: [round('g3', 1, { before: [0, 600] })] },
    ];
    const a = counts(records, 'A');
    expect(a['phoenix-rising']).toBe(2);
    expect(a.lazarus).toBe(1);
  });

  it('Photo Finish and Wire to Wire are game-level wins', () => {
    const records: GameRecord[] = [
      {
        summary: summary('g1', { finalScores: [1005, 995] }),
        rounds: [round('g1', 1, { after: [100, 0] }), round('g1', 2, { after: [1005, 995] })],
      },
      // Tied after round 1: not wire to wire.
      {
        summary: summary('g2', { finalScores: [1100, 500] }),
        rounds: [round('g2', 1, { after: [50, 50] }), round('g2', 2, { after: [1100, 500] })],
      },
    ];
    const a = counts(records, 'A');
    expect(a['photo-finish']).toBe(1);
    expect(a['wire-to-wire']).toBe(1);
    const b = counts(records, 'B');
    expect(b['photo-finish']).toBe(0);
    expect(b['wire-to-wire']).toBe(0);
  });

  it('Hat Trick: each run of three made calls counts once', () => {
    const made = (gid: string, i: number) => round(gid, i, { calls: { 0: 'small' }, outOrder: [0, 1, 2] });
    const missed = (gid: string, i: number) => round(gid, i, { calls: { 0: 'small' }, outOrder: [1, 0, 2] });
    const records: GameRecord[] = [{
      summary: summary('g'),
      rounds: [made('g', 1), made('g', 2), missed('g', 3), made('g', 4), made('g', 5), made('g', 6),
        made('g', 7), made('g', 8), made('g', 9)],
    }];
    expect(counts(records, 'A')['hat-trick']).toBe(2);
  });

  it('Double Tap: two of your bombs in one round', () => {
    const records: GameRecord[] = [{
      summary: summary('g'),
      rounds: [round('g', 1, { bombs: [0, 0, 1] }), round('g', 2, { bombs: [0, 2] })],
    }];
    expect(counts(records, 'A')['double-tap']).toBe(1);
    expect(counts(records, 'B')['double-tap']).toBe(0);
  });

  it("Out-Bombed and Dragon's Hoard read the play log", () => {
    const plays: RoundPlay[] = [
      { seat: 0, cards: [sp('dragon')], trick: 0 },
      { seat: 0, cards: fourOf(5), trick: 0 },   // A bombs own Dragon
      { seat: 1, cards: fourOf(9), trick: 0 },   // B bombs A's bomb
      { seat: 2, cards: [n(3)], trick: 1 },
      { seat: 3, cards: fourOf(10), trick: 1 },  // not on a bomb
      { seat: 1, cards: fourOf(11), trick: 2 },  // a lead bomb, new trick
    ];
    const records: GameRecord[] = [{ summary: summary('g'), rounds: [round('g', 1, { plays })] }];
    const a = counts(records, 'A');
    expect(a['dragons-hoard']).toBe(1);
    expect(a['out-bombed']).toBe(1);
    const d = counts(records, 'D');
    expect(d['out-bombed']).toBe(0);
    expect(counts(records, 'B')['dragons-hoard']).toBe(0);
  });

  it('Ganis!: a 14-card straight, Phoenix allowed', () => {
    const straight = [sp('mahjong'), ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((r, i) => n(r, i % 2 ? 'star' : 'jade')), sp('phoenix')];
    const pairs = [7, 8, 9, 10, 11, 12, 13].flatMap(r => [n(r, 'jade'), n(r, 'star')]);
    const records: GameRecord[] = [{
      summary: summary('g'),
      rounds: [round('g', 1, { plays: [{ seat: 0, cards: straight, trick: 0 }, { seat: 2, cards: pairs, trick: 1 }] })],
    }];
    expect(counts(records, 'A').ganis).toBe(1);
    expect(counts(records, 'C').ganis).toBe(0);
  });

  it('Score-Based Grand: no Dragon, Phoenix or Ace in the first 8', () => {
    const weak = [2, 3, 4, 5, 6, 7, 8, 9].map(r => n(r));
    const withAce = [2, 3, 4, 5, 6, 7, 8, 14].map(r => n(r));
    const withPhoenix = [...[2, 3, 4, 5, 6, 7, 8].map(r => n(r)), sp('phoenix')];
    const records: GameRecord[] = [{
      summary: summary('g'),
      rounds: [
        round('g', 1, { calls: { 0: 'grand', 1: 'grand', 2: 'grand' }, firstEight: { 0: weak, 1: withAce, 2: withPhoenix } }),
        // Weak hand but no Grand call.
        round('g', 2, { firstEight: { 0: weak } }),
      ],
    }];
    expect(counts(records, 'A')['score-based-grand']).toBe(1);
    expect(counts(records, 'B')['score-based-grand']).toBe(0);
    expect(counts(records, 'C')['score-based-grand']).toBe(0);
  });

  it('reports the latest game each achievement was earned in', () => {
    const records: GameRecord[] = [
      { summary: summary('old', { finishedAt: 1, finalScores: [1000, 995] }), rounds: [round('old', 1)] },
      { summary: summary('new', { finishedAt: 2, finalScores: [1000, 990] }), rounds: [round('new', 1)] },
    ];
    const photo = computeAchievements(records, 'A').find(a => a.id === 'photo-finish')!;
    expect(photo.count).toBe(2);
    expect(photo.lastGame?.gameId).toBe('new');
  });
});

describe('achievementEvents (live, per round)', () => {
  it('tags round events with their round and adds game events only once the game is over', () => {
    const made = (i: number) => round('g', i, { calls: { 1: 'small' }, outOrder: [1, 0, 2] });
    const rounds = [made(1), made(2), made(3)];
    rounds[2].bombs = [{ seat: 0, cards: fourOf(5) }, { seat: 0, cards: fourOf(6) }];

    const live = achievementEvents(rounds).filter(e => e.roundNumber === 3);
    expect(live).toEqual(expect.arrayContaining([
      { id: 'double-tap', seats: [0], roundNumber: 3 },
      { id: 'hat-trick', seats: [1], roundNumber: 3 },
    ]));
    expect(live).toHaveLength(2);
    expect(achievementEvents(rounds).some(e => e.roundNumber === null)).toBe(false);

    const ended = achievementEvents(rounds, { winningTeam: 0, finalScores: [1005, 1000] });
    expect(ended).toContainEqual({ id: 'photo-finish', seats: [0, 2], roundNumber: null });
    expect(ended).toContainEqual({ id: 'wire-to-wire', seats: [0, 2], roundNumber: null });
  });
});
