import { describe, it, expect } from 'vitest';
import { reconstructSummary, repairUids } from './historyRepair.js';
import { GameSummary, RoundLog, Seat } from './types.js';

const NAMES = ['Ann', 'Bob', 'Cat', 'Dan'];
const UIDS = ['uA', 'uB', 'uC', 'uD'];

function round(n: number, over: Partial<RoundLog> & { uids?: (string | null)[]; names?: string[] } = {}): RoundLog {
  const { uids = UIDS, names = NAMES, ...rest } = over;
  return {
    gameId: 'g', roundNumber: n, timestamp: 1000 + n,
    scoresBeforeRound: [0, 0], scoresAfterRound: [0, 0],
    roundCardPoints: [0, 0], tichuBonuses: [0, 0],
    isDoubleVictory: false, outOrder: [0, 1, 2],
    players: [0, 1, 2, 3].map(seat => ({
      seat: seat as Seat, uid: uids[seat], name: names[seat], team: (seat % 2) as 0 | 1,
      tichuCall: 'none' as const, outOrder: seat + 1, initialHand: [],
      passedLeft: null, passedPartner: null, passedRight: null,
    })),
    bombs: [], dragonGiveaways: [], mahJongWishes: [],
    ...rest,
  };
}

describe('reconstructSummary', () => {
  it('builds a summary from the final round of a finished game', () => {
    const rounds = [
      round(2, { scoresAfterRound: [1050, 400] }),
      round(1, { scoresAfterRound: [600, 300] }),
    ];
    const s = reconstructSummary('g', rounds);
    expect(s).not.toBeNull();
    expect(s!.finalScores).toEqual([1050, 400]);
    expect(s!.winningTeam).toBe(0);
    expect(s!.rounds).toBe(2);
    expect(s!.finishedAt).toBe(1002);
    expect(s!.players.map(p => p.uid)).toEqual(UIDS);
    expect(s!.players.map(p => p.team)).toEqual([0, 1, 0, 1]);
  });

  it('is null when the game never reached the target score', () => {
    expect(reconstructSummary('g', [round(1, { scoresAfterRound: [900, 300] })])).toBeNull();
  });

  it('is null on a tie at the target score', () => {
    expect(reconstructSummary('g', [round(1, { scoresAfterRound: [1000, 1000] })])).toBeNull();
  });

  it('honours a custom target score', () => {
    expect(reconstructSummary('g', [round(1, { scoresAfterRound: [520, 100] })], 500)).not.toBeNull();
  });

  it('is null with no rounds', () => {
    expect(reconstructSummary('g', [])).toBeNull();
  });
});

describe('repairUids', () => {
  const summary = (uids: (string | null)[]): GameSummary => ({
    gameId: 'g', finishedAt: 0, finalScores: [1000, 0], winningTeam: 0, rounds: 3,
    players: [0, 1, 2, 3].map(seat => ({ seat: seat as Seat, uid: uids[seat], name: NAMES[seat], team: (seat % 2) as 0 | 1 })),
  });

  it('fills a seat that lost its uid mid-game, in rounds and in the summary', () => {
    const rounds = [
      round(1),
      round(2, { uids: [null, null, 'uC', 'uD'] }),
      round(3, { uids: ['uA', 'uB', 'uC', null] }),
    ];
    const { rounds: fixed, summary: fixedSummary, fills } = repairUids('g', rounds, summary(['uA', 'uB', 'uC', null]));
    expect(fixed[1].players.map(p => p.uid)).toEqual(UIDS);
    expect(fixed[2].players.map(p => p.uid)).toEqual(UIDS);
    expect(fixedSummary!.players[3].uid).toBe('uD');
    expect(fills).toHaveLength(4);
    expect(fills.every(f => f.reason === 'continuity')).toBe(true);
    expect(fills.find(f => f.roundNumber === 0)).toMatchObject({ seat: 3, uid: 'uD' });
  });

  it('does not fill a seat whose name changed (a real guest substitute)', () => {
    const rounds = [
      round(1),
      round(2, { uids: ['uA', 'uB', 'uC', null], names: ['Ann', 'Bob', 'Cat', 'Zed'] }),
    ];
    const { rounds: fixed, fills } = repairUids('g', rounds, null);
    expect(fixed[1].players[3].uid).toBeNull();
    expect(fills).toHaveLength(0);
  });

  it('leaves an ambiguous seat alone (same name, two uids)', () => {
    const rounds = [
      round(1, { uids: ['uA', 'uB', 'uC', 'uD'] }),
      round(2, { uids: ['uA', 'uB', 'uC', 'uD2'] }),
      round(3, { uids: ['uA', 'uB', 'uC', null] }),
    ];
    const { rounds: fixed, fills } = repairUids('g', rounds, null);
    expect(fixed[2].players[3].uid).toBeNull();
    expect(fills).toHaveLength(0);
  });

  it('never overwrites an existing uid', () => {
    const rounds = [round(1), round(2)];
    const { rounds: fixed, fills } = repairUids('g', rounds, null, [{ gameId: 'g', seat: 0, uid: 'other' }]);
    expect(fixed[0].players[0].uid).toBe('uA');
    expect(fills).toHaveLength(0);
  });

  it('applies an explicit attribution to a guest seat, and only for that game', () => {
    const rounds = [
      round(1, { uids: ['uA', 'uB', null, 'uD'], names: ['Ann', 'Bob', 'Rina', 'Dan'] }),
      round(2, { uids: ['uA', 'uB', null, 'uD'], names: ['Ann', 'Bob', 'Rina', 'Dan'] }),
    ];
    const s: GameSummary = { ...summary(['uA', 'uB', null, 'uD']) };
    s.players[2] = { ...s.players[2], name: 'Rina' };
    const attributions = [
      { gameId: 'g', seat: 2 as Seat, uid: 'uRina' },
      { gameId: 'other', seat: 3 as Seat, uid: 'nope' },
    ];
    const { rounds: fixed, summary: fixedSummary, fills } = repairUids('g', rounds, s, attributions);
    expect(fixed.map(r => r.players[2].uid)).toEqual(['uRina', 'uRina']);
    expect(fixedSummary!.players[2].uid).toBe('uRina');
    expect(fills).toHaveLength(3);
    expect(fills.every(f => f.reason === 'attribution')).toBe(true);
  });

  it('prefers an explicit attribution over continuity', () => {
    const rounds = [round(1), round(2, { uids: ['uA', 'uB', 'uC', null] })];
    const { rounds: fixed, fills } = repairUids('g', rounds, null, [{ gameId: 'g', seat: 3, uid: 'uX' }]);
    expect(fixed[1].players[3].uid).toBe('uX');
    expect(fills[0].reason).toBe('attribution');
  });
});
