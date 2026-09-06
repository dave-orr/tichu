import { describe, it, expect } from 'vitest';
import {
  computePlayerStats, computePartnerSummaries, computePairingBreakdown, computeStatTotals,
  pairPerspective, GameRecord,
} from './stats.js';
import { GameSummary, RoundLog, RoundLogPlayerEntry, Seat, TichuCall } from './types.js';

// Seats 0&2 = team 0 (A + C), seats 1&3 = team 1 (B + D).
const UIDS = ['A', 'B', 'C', 'D'];

function summary(over: Partial<GameSummary> & { id: string }): GameSummary {
  const { id, ...rest } = over;
  return {
    gameId: id,
    finishedAt: 1000,
    players: [0, 1, 2, 3].map(seat => ({
      seat: seat as Seat, uid: UIDS[seat], name: UIDS[seat], team: (seat % 2) as 0 | 1,
    })),
    finalScores: [1000, 500],
    winningTeam: 0,
    rounds: 1,
    ...rest,
  };
}

type RoundSpec = {
  before?: [number, number];
  after?: [number, number];
  points?: [number, number];
  bonuses?: [number, number];
  calls?: Partial<Record<Seat, TichuCall>>;
  outOrder?: Seat[];
  doubleVictory?: boolean;
  bombs?: Seat[];
  uids?: (string | null)[];
};

function round(gameId: string, n: number, spec: RoundSpec = {}): RoundLog {
  const outOrder = spec.outOrder ?? [0, 1, 2];
  const uids = spec.uids ?? UIDS;
  const players: RoundLogPlayerEntry[] = [0, 1, 2, 3].map(seat => ({
    seat: seat as Seat,
    uid: uids[seat],
    name: UIDS[seat],
    team: (seat % 2) as 0 | 1,
    tichuCall: spec.calls?.[seat as Seat] ?? 'none',
    outOrder: outOrder.indexOf(seat as Seat) + 1,
    initialHand: [],
    passedLeft: null, passedPartner: null, passedRight: null,
  }));
  return {
    gameId, roundNumber: n, timestamp: 0,
    scoresBeforeRound: spec.before ?? [0, 0],
    scoresAfterRound: spec.after ?? [0, 0],
    roundCardPoints: spec.points ?? [50, 50],
    tichuBonuses: spec.bonuses ?? [0, 0],
    isDoubleVictory: spec.doubleVictory ?? false,
    outOrder,
    players,
    bombs: (spec.bombs ?? []).map(seat => ({ seat, cards: [] })),
    dragonGiveaways: [], mahJongWishes: [],
  };
}

describe('computePlayerStats', () => {
  it('counts games and wins from summaries, not counters', () => {
    const records: GameRecord[] = [
      { summary: summary({ id: 'g1', winningTeam: 0 }), rounds: [round('g1', 1)] },
      { summary: summary({ id: 'g2', winningTeam: 1, finalScores: [400, 1000] }), rounds: [round('g2', 1)] },
      { summary: summary({ id: 'g3', winningTeam: 0 }), rounds: [round('g3', 1), round('g3', 2)] },
    ];
    const a = computePlayerStats(records, 'A');
    expect(a.gamesPlayed).toBe(3);
    expect(a.gamesWon).toBe(2);
    expect(a.roundsPlayed).toBe(4);
    const b = computePlayerStats(records, 'B');
    expect(b.gamesWon).toBe(1);
  });

  it('ignores games the player was not in', () => {
    const records: GameRecord[] = [
      { summary: summary({ id: 'g1' }), rounds: [round('g1', 1)] },
    ];
    const z = computePlayerStats(records, 'Z');
    expect(z.gamesPlayed).toBe(0);
    expect(z.roundsPlayed).toBe(0);
  });

  it('tracks tichu and grand calls with success and margin buckets', () => {
    const rounds = [
      // A calls tichu and goes out first, while ahead by 250.
      round('g', 1, { before: [300, 50], calls: { 0: 'small' }, outOrder: [0, 1, 2] }),
      // A calls grand and fails, while behind by 202.
      round('g', 2, { before: [100, 302], calls: { 0: 'grand' }, outOrder: [1, 0, 2] }),
      // A calls grand and makes it at an even score (no bucket).
      round('g', 3, { before: [500, 500], calls: { 0: 'grand' }, outOrder: [0, 3, 1] }),
    ];
    const a = computePlayerStats([{ summary: summary({ id: 'g' }), rounds }], 'A');
    expect(a.tichuCalls).toBe(1);
    expect(a.tichuSuccesses).toBe(1);
    expect(a.grandTichuCalls).toBe(2);
    expect(a.grandTichuSuccesses).toBe(1);
    expect(a.roundsWonFirstOut).toBe(2);
    expect(a.roundsWhenAhead200).toBe(1);
    expect(a.tichuCallsWhenAhead200).toBe(1);
    expect(a.roundsWhenBehind200).toBe(1);
    expect(a.grandCallsWhenBehind200).toBe(1);
    expect(a.grandCallsWhenAhead200).toBe(0);
  });

  it('does not bucket a margin of exactly 200', () => {
    const rounds = [round('g', 1, { before: [200, 0] }), round('g', 2, { before: [0, 200] })];
    const a = computePlayerStats([{ summary: summary({ id: 'g' }), rounds }], 'A');
    expect(a.roundsWhenAhead200).toBe(0);
    expect(a.roundsWhenBehind200).toBe(0);
  });

  it('computes point differential, double victories, and bombs by team', () => {
    const rounds = [
      round('g', 1, { points: [80, 20], bonuses: [100, -100], bombs: [0, 1, 3], doubleVictory: true, outOrder: [2, 0] }),
      round('g', 2, { points: [30, 70], doubleVictory: true, outOrder: [1, 3, 0] }),
    ];
    const a = computePlayerStats([{ summary: summary({ id: 'g' }), rounds }], 'A');
    // Round 1: (80+100) - (20-100) = 260; round 2: 30 - 70 = -40.
    expect(a.totalPointDifferential).toBe(220);
    expect(a.doubleVictories).toBe(1);   // only round 1's double was by team 0
    expect(a.bombsPlayed).toBe(1);       // seat 0
    expect(a.bombsFaced).toBe(2);        // seats 1 and 3
    const c = computePlayerStats([{ summary: summary({ id: 'g' }), rounds }], 'C');
    expect(c.bombsPlayed).toBe(0);
    expect(c.bombsFaced).toBe(2);
  });

  it('flags close games and comeback opportunities', () => {
    const records: GameRecord[] = [
      // Close win for team 0; team 0 was down 300+ at the start of round 2.
      {
        summary: summary({ id: 'g1', finalScores: [1000, 950], winningTeam: 0 }),
        rounds: [round('g1', 1, { before: [0, 0] }), round('g1', 2, { before: [100, 450] })],
      },
      // Blowout loss for team 0, never down 300 at a round start.
      {
        summary: summary({ id: 'g2', finalScores: [200, 1000], winningTeam: 1 }),
        rounds: [round('g2', 1, { before: [0, 0] }), round('g2', 2, { before: [100, 350] })],
      },
    ];
    const a = computePlayerStats(records, 'A');
    expect(a.closeGamesPlayed).toBe(1);
    expect(a.closeGameWins).toBe(1);
    expect(a.comebackOpportunities).toBe(1);
    expect(a.comebackWins).toBe(1);
    const b = computePlayerStats(records, 'B');
    expect(b.closeGamesPlayed).toBe(1);
    expect(b.closeGameWins).toBe(0);
    expect(b.comebackOpportunities).toBe(0);
  });

  it('credits a round to whoever actually sat in the seat (substitutes)', () => {
    const rounds = [
      round('g', 1, { calls: { 0: 'small' } }),
      // A left; Z took over seat 0 and called tichu.
      round('g', 2, { calls: { 0: 'small' }, uids: ['Z', 'B', 'C', 'D'] }),
    ];
    // Final seating (summary) lists Z in seat 0.
    const s = summary({ id: 'g' });
    s.players[0] = { ...s.players[0], uid: 'Z', name: 'Z' };
    const records = [{ summary: s, rounds }];
    // A is not in the summary at all, so the game is not theirs...
    expect(computePlayerStats(records, 'A').gamesPlayed).toBe(0);
    // ...but Z gets the game and only the round they played.
    const z = computePlayerStats(records, 'Z');
    expect(z.gamesPlayed).toBe(1);
    expect(z.roundsPlayed).toBe(1);
    expect(z.tichuCalls).toBe(1);
  });
});

describe('pairPerspective', () => {
  it('is null unless both players are on the same team', () => {
    const s = summary({ id: 'g' });
    expect(pairPerspective(s, 'A', 'C')).toEqual({ team: 0, uids: ['A', 'C'] });
    expect(pairPerspective(s, 'A', 'B')).toBeNull();
    expect(pairPerspective(s, 'A', 'Z')).toBeNull();
  });
});

describe('computePartnerSummaries', () => {
  it('lists each partner with the pairing record and the partner\'s own calls', () => {
    const records: GameRecord[] = [
      // A + C beat B + D; C calls tichu twice, makes one.
      {
        summary: summary({ id: 'g1', winningTeam: 0 }),
        rounds: [
          round('g1', 1, { calls: { 2: 'small' }, outOrder: [2, 0] }),
          round('g1', 2, { calls: { 2: 'small', 0: 'grand' }, outOrder: [0, 2] }),
        ],
      },
      // A + B (seats 0 & 2 this time) lose to C + D.
      {
        summary: summary({
          id: 'g2', winningTeam: 1, finalScores: [300, 1000],
          players: [
            { seat: 0, uid: 'A', name: 'A', team: 0 },
            { seat: 1, uid: 'C', name: 'C', team: 1 },
            { seat: 2, uid: 'B', name: 'B', team: 0 },
            { seat: 3, uid: 'D', name: 'D', team: 1 },
          ],
        }),
        rounds: [round('g2', 1, { uids: ['A', 'C', 'B', 'D'], calls: { 2: 'grand' }, outOrder: [2] })],
      },
    ];
    const rows = computePartnerSummaries(records, 'A');
    expect(rows.map(r => r.partnerUid)).toEqual(['C', 'B']);
    const c = rows[0];
    expect(c.gamesPlayed).toBe(1);
    expect(c.gamesWon).toBe(1);
    expect(c.roundsPlayed).toBe(2);
    expect(c.partnerTichuCalls).toBe(2);
    expect(c.partnerTichuSuccesses).toBe(1);
    expect(c.partnerRounds).toBe(2);
    const b = rows[1];
    expect(b.gamesPlayed).toBe(1);
    expect(b.gamesWon).toBe(0);
    expect(b.partnerGrandCalls).toBe(1);
    expect(b.partnerGrandSuccesses).toBe(1);
  });

  it('never lists an opponent as a partner', () => {
    const records = [{ summary: summary({ id: 'g' }), rounds: [round('g', 1)] }];
    expect(computePartnerSummaries(records, 'A').map(r => r.partnerUid)).toEqual(['C']);
  });
});

describe('computePairingBreakdown', () => {
  it('splits per-player totals and records against each opposing pair', () => {
    const records: GameRecord[] = [
      {
        summary: summary({ id: 'g1', finishedAt: 1, winningTeam: 0 }),
        rounds: [round('g1', 1, { calls: { 0: 'small', 2: 'grand' }, outOrder: [0, 2], bombs: [2, 1] })],
      },
      {
        summary: summary({ id: 'g2', finishedAt: 2, winningTeam: 1, finalScores: [0, 1000] }),
        rounds: [round('g2', 1, { calls: { 2: 'small' }, outOrder: [1, 2] })],
      },
      // Different opponents (E + F), win.
      {
        summary: summary({
          id: 'g3', finishedAt: 3, winningTeam: 0,
          players: [
            { seat: 0, uid: 'A', name: 'A', team: 0 },
            { seat: 1, uid: 'E', name: 'E', team: 1 },
            { seat: 2, uid: 'C', name: 'C', team: 0 },
            { seat: 3, uid: 'F', name: 'F', team: 1 },
          ],
        }),
        rounds: [round('g3', 1, { uids: ['A', 'E', 'C', 'F'] })],
      },
    ];
    const bd = computePairingBreakdown(records, 'A', 'C');
    expect(bd.totals.gamesPlayed).toBe(3);
    expect(bd.totals.gamesWon).toBe(2);
    expect(bd.totals.tichuCalls).toBe(2);       // A once, C once
    expect(bd.totals.grandTichuCalls).toBe(1);  // C
    expect(bd.totals.bombsPlayed).toBe(1);
    expect(bd.totals.bombsFaced).toBe(1);

    const [a, c] = bd.perPlayer;
    expect(a.tichuCalls).toBe(1);
    expect(a.tichuSuccesses).toBe(1);
    expect(c.tichuCalls).toBe(1);
    expect(c.tichuSuccesses).toBe(0);
    expect(c.grandTichuCalls).toBe(1);
    expect(c.bombsPlayed).toBe(1);

    expect(bd.games.map(g => g.gameId)).toEqual(['g3', 'g2', 'g1']);
    expect(bd.opponents).toEqual([
      { uids: ['B', 'D'], names: 'B + D', gamesPlayed: 2, gamesWon: 1 },
      { uids: ['E', 'F'], names: 'E + F', gamesPlayed: 1, gamesWon: 1 },
    ]);
  });

  it('excludes games where the two were opponents', () => {
    const s = summary({
      id: 'g',
      players: [
        { seat: 0, uid: 'A', name: 'A', team: 0 },
        { seat: 1, uid: 'C', name: 'C', team: 1 },
        { seat: 2, uid: 'B', name: 'B', team: 0 },
        { seat: 3, uid: 'D', name: 'D', team: 1 },
      ],
    });
    const bd = computePairingBreakdown([{ summary: s, rounds: [round('g', 1)] }], 'A', 'C');
    expect(bd.totals.gamesPlayed).toBe(0);
    expect(bd.games).toEqual([]);
  });
});

describe('computeStatTotals', () => {
  it('skips rounds where none of the perspective players appear', () => {
    const rounds = [round('g', 1, { uids: [null, 'B', 'C', 'D'] }), round('g', 2)];
    const a = computeStatTotals([{ summary: summary({ id: 'g' }), rounds }], s => ({ team: 0, uids: ['A'] }));
    expect(a.roundsPlayed).toBe(1);
  });
});
