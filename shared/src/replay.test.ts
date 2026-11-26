import { describe, it, expect } from 'vitest';
import { aiAgrees, aiPassAgrees, aiSuggestionLabel, buildReplayFrames, comboLabel, engineRoundLog, handReplayFromLog, type HandReplay } from './replay.js';
import { cardId, type Card, type NormalCard, type RoundLog, type Seat } from './types.js';
import { toClientState, createInitialState } from './engine.js';

function c(rank: number, suit: 'jade' | 'sword' | 'pagoda' | 'star' = 'jade'): NormalCard {
  return { type: 'normal', suit, rank: rank as NormalCard['rank'] };
}
const ids = (cards: Card[]) => cards.map(cardId).sort();

// A tiny hand: each seat holds four cards and passes three. Seat 0 passes
// 2/3/4 (left → seat 3, partner → seat 2, right → seat 1), and so on.
function sample(): HandReplay {
  return {
    roundNumber: 1,
    names: ['Ann', 'Ben', 'Cat', 'Dan'],
    dealt: [
      [c(2), c(3), c(4), c(14)],
      [c(5), c(6), c(7), c(13)],
      [c(8), c(9), c(10), c(12)],
      [c(2, 'star'), c(3, 'star'), c(4, 'star'), c(11)],
    ],
    passes: [
      { left: c(2), partner: c(3), right: c(4) },
      { left: c(5), partner: c(6), right: c(7) },
      { left: c(8), partner: c(9), right: c(10) },
      { left: c(2, 'star'), partner: c(3, 'star'), right: c(4, 'star') },
    ],
    grand: [false, true, false, false],
    actions: [
      { type: 'smallTichu', at: 1, seat: 0 },
      { type: 'play', at: 2, seat: 0, cards: [c(14)], trick: 0 },
      { type: 'pass', at: 3, seat: 1 },
      { type: 'pass', at: 4, seat: 2, auto: true },
      { type: 'pass', at: 5, seat: 3 },
      { type: 'play', at: 6, seat: 0, cards: [c(4, 'star')], trick: 1 },
    ],
    outOrder: [0, 1, 2, 3] as Seat[],
  };
}

describe('buildReplayFrames', () => {
  it('has the deal, the pass, one frame per action and the end', () => {
    const frames = buildReplayFrames(sample());
    expect(frames.map(f => f.kind)).toEqual(['deal', 'passed', 'smallTichu', 'play', 'pass', 'pass', 'pass', 'play', 'end']);
    expect(frames[0].text).toBe('The deal. Grand Tichu: Ben');
    expect(frames[0].calls).toEqual(['none', 'grand', 'none', 'none']);
  });

  it('marks the passed cards and applies the pass', () => {
    const [deal, passed] = buildReplayFrames(sample());
    expect(deal.passing).toHaveLength(12);
    expect(deal.passing.find(p => cardId(p.card) === cardId(c(2)))).toMatchObject({ from: 0, to: 3 });
    expect(ids(deal.hands[0])).toEqual(ids([c(2), c(3), c(4), c(14)]));
    // Seat 0 keeps its Ace and receives seat 3's right card, seat 2's partner
    // card and seat 1's left card.
    expect(ids(passed.hands[0])).toEqual(ids([c(14), c(4, 'star'), c(9), c(5)]));
  });

  it('tracks plays, passes, calls, new tricks and going out', () => {
    const frames = buildReplayFrames(sample());
    expect(frames[2].calls[0]).toBe('small');
    const lead = frames[3];
    expect(lead.text).toBe('Ann leads Single, A');
    expect(lead.trick).toEqual([{ seat: 0, cards: [c(14)] }]);
    expect(lead.hands[0]).toHaveLength(3);
    expect(frames[4].passedSeats).toEqual([1]);
    expect(frames[5].text).toBe("Cat can't play (skipped)");
    expect(frames[6].passedSeats).toEqual([1, 2, 3]);
    // A new trick clears the table and the passes.
    const second = frames[7];
    expect(second.trick).toEqual([{ seat: 0, cards: [c(4, 'star')] }]);
    expect(second.passedSeats).toEqual([]);
    expect(second.topSeat).toBe(0);
  });

  it('clears the wish when the wished rank is played', () => {
    const r = sample();
    r.dealt[0] = [{ type: 'special', name: 'mahjong' }, c(2), c(3), c(4)];
    r.passes = [null, null, null, null];
    r.dealt[1] = [c(7), c(5), c(6), c(13)];
    r.actions = [
      { type: 'play', at: 1, seat: 0, cards: [{ type: 'special', name: 'mahjong' }], trick: 0 },
      { type: 'wish', at: 2, seat: 0, rank: 7 },
      { type: 'play', at: 3, seat: 1, cards: [c(7)], trick: 0 },
    ];
    const frames = buildReplayFrames(r);
    expect(frames.map(f => f.kind)).toEqual(['deal', 'play', 'wish', 'play', 'end']);
    expect(frames[2].wish).toBe(7);
    expect(frames[2].text).toBe('Ann wishes for 7');
    expect(frames[3].wish).toBeNull();
  });

  it('records finishing places', () => {
    const r = sample();
    r.passes = [null, null, null, null];
    r.dealt[0] = [c(14)];
    r.actions = [{ type: 'play', at: 1, seat: 0, cards: [c(14)], trick: 0 }];
    const frames = buildReplayFrames(r);
    expect(frames[1].text).toBe('Ann leads Single, A and goes out 1st');
    expect(frames[1].out).toEqual([1, 0, 0, 0]);
    expect(frames[2].text).toBe('Hand over: Ann 1st');
  });
});

describe('handReplayFromLog', () => {
  it('reads hands, passes and calls by seat', () => {
    const log = {
      roundNumber: 3,
      outOrder: [2, 0, 1, 3],
      actions: [],
      players: ([3, 2, 1, 0] as Seat[]).map(seat => ({
        seat, uid: null, name: `P${seat}`, team: (seat % 2) as 0 | 1,
        tichuCall: seat === 2 ? 'grand' : 'none', outOrder: 0,
        initialHand: [c(seat + 2)],
        passedLeft: c(10), passedPartner: c(11), passedRight: c(12),
      })),
    } as unknown as RoundLog;
    const r = handReplayFromLog(log);
    expect(r.names).toEqual(['P0', 'P1', 'P2', 'P3']);
    expect(r.dealt[1]).toEqual([c(3)]);
    expect(r.grand).toEqual([false, false, true, false]);
    expect(r.passes[0]).toEqual({ left: c(10), partner: c(11), right: c(12) });
  });
});

describe('toClientState openHands', () => {
  it('shows every hand only in learning mode', () => {
    const state = createInitialState({ ...createInitialState().settings, learningMode: true });
    state.phase = 'playing';
    state.players[1].hand = [c(9)];
    expect(toClientState(state, 0).openHands?.[1]).toEqual([c(9)]);
    state.settings = { ...state.settings, learningMode: false };
    expect(toClientState(state, 0).openHands).toBeNull();
  });
});

describe('comboLabel', () => {
  it('names a lone Phoenix instead of its half rank', () => {
    expect(comboLabel({ type: 'single', cards: [{ type: 'special', name: 'phoenix' }], rank: 14.5, length: 1 })).toBe('Single, Phoenix');
    expect(comboLabel({ type: 'pair', cards: [c(7), c(7, 'star')], rank: 7, length: 2 })).toBe('Pair, 7s');
  });
});

describe('AI suggestions', () => {
  it('numbers each action frame by its action', () => {
    const frames = buildReplayFrames(sample());
    expect(frames.map(f => f.action)).toEqual([undefined, undefined, 0, 1, 2, 3, 4, 5, undefined]);
  });

  it('writes the hand as a round log the engine can replay', () => {
    const r = { ...sample(), scoresBefore: [120, 380] as [number, number], clockwise: true };
    r.dealt = r.dealt.map(h => [...h, ...Array.from({ length: 10 }, (_, i) => c(i + 2, 'pagoda'))]);
    const log = engineRoundLog(r) as any;
    expect(log.scoresBeforeRound).toEqual([120, 380]);
    expect(log.clockwise).toBe(true);
    expect(log.players.map((p: any) => p.tichuCall)).toEqual(['small', 'grand', 'none', 'none']);
    expect(log.players.map((p: any) => p.outOrder)).toEqual([1, 2, 3, 4]);
    expect(log.players[3].passedRight).toEqual(c(4, 'star'));
    expect(log.actions).toBe(r.actions);
    // A hand missing a pass (or short of 14 cards) can't be replayed.
    expect(engineRoundLog(sample())).toBeNull();
    expect(engineRoundLog({ ...r, passes: [null, ...r.passes.slice(1)] })).toBeNull();
  });

  it('compares what was done with the suggestion', () => {
    const play = { type: 'play' as const, at: 1, seat: 0 as Seat, cards: [c(9), c(9, 'star')], trick: 0 };
    expect(aiAgrees(play, { type: 'play', cards: [c(9, 'star'), c(9)] })).toBe(true);
    expect(aiAgrees(play, { type: 'play', cards: [c(9, 'star')] })).toBe(false);
    expect(aiAgrees(play, { type: 'pass' })).toBe(false);
    expect(aiAgrees({ type: 'pass', at: 1, seat: 1 }, { type: 'pass' })).toBe(true);
    expect(aiAgrees({ type: 'wish', at: 1, seat: 1, rank: 8 }, { type: 'wish', rank: 8 })).toBe(true);
    expect(aiAgrees({ type: 'wish', at: 1, seat: 1, rank: null }, { type: 'wish', rank: 8 })).toBe(false);
    expect(aiAgrees({ type: 'dragon', at: 1, seat: 1, to: 2 }, { type: 'dragon', to: 0 })).toBe(false);
    const pass = { left: c(2), partner: c(3), right: c(4) };
    expect(aiPassAgrees(pass, { seat: 0, ...pass })).toBe(true);
    expect(aiPassAgrees(pass, { seat: 0, ...pass, left: c(4), right: c(2) })).toBe(false);
    expect(aiPassAgrees(null, { seat: 0, ...pass })).toBe(false);
  });

  it('labels suggestions for players', () => {
    const names = ['Ann', 'Ben', 'Cat', 'Dan'];
    expect(aiSuggestionLabel({ type: 'play', cards: [c(9), c(9, 'star')] }, names)).toBe('Pair, 9s');
    expect(aiSuggestionLabel({ type: 'pass' }, names)).toBe('Pass');
    expect(aiSuggestionLabel({ type: 'wish', rank: 11 }, names)).toBe('Wish for J');
    expect(aiSuggestionLabel({ type: 'wish', rank: null }, names)).toBe('No wish');
    expect(aiSuggestionLabel({ type: 'dragon', to: 1 }, names)).toBe('Dragon to Ben');
  });
});
