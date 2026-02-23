import { describe, it, expect } from 'vitest';
import { identifyCombo, canBeat, isBomb, singleCardRank } from './combinations.js';
import { Card, NormalCard, Suit } from './types.js';

// Helper to make normal cards quickly
function c(rank: number, suit: Suit = 'jade'): NormalCard {
  return { type: 'normal', suit, rank: rank as any };
}

const mahjong: Card = { type: 'special', name: 'mahjong' };
const dog: Card = { type: 'special', name: 'dog' };
const phoenix: Card = { type: 'special', name: 'phoenix' };
const dragon: Card = { type: 'special', name: 'dragon' };

describe('identifyCombo', () => {
  describe('singles', () => {
    it('identifies a normal single', () => {
      const combo = identifyCombo([c(5)]);
      expect(combo).not.toBeNull();
      expect(combo!.type).toBe('single');
      expect(combo!.rank).toBe(5);
    });

    it('identifies mahjong as single with rank 1', () => {
      const combo = identifyCombo([mahjong]);
      expect(combo!.type).toBe('single');
      expect(combo!.rank).toBe(1);
    });

    it('identifies dragon as single with rank 16', () => {
      const combo = identifyCombo([dragon]);
      expect(combo!.type).toBe('single');
      expect(combo!.rank).toBe(16);
    });

    it('identifies phoenix as single', () => {
      const combo = identifyCombo([phoenix]);
      expect(combo!.type).toBe('single');
    });

    it('identifies dog as single with rank -1', () => {
      const combo = identifyCombo([dog]);
      expect(combo!.type).toBe('single');
      expect(combo!.rank).toBe(-1);
    });
  });

  describe('pairs', () => {
    it('identifies a pair', () => {
      const combo = identifyCombo([c(7, 'jade'), c(7, 'sword')]);
      expect(combo!.type).toBe('pair');
      expect(combo!.rank).toBe(7);
    });

    it('identifies phoenix pair', () => {
      const combo = identifyCombo([c(10, 'jade'), phoenix]);
      expect(combo!.type).toBe('pair');
      expect(combo!.rank).toBe(10);
    });

    it('rejects mismatched pair', () => {
      const combo = identifyCombo([c(7), c(8)]);
      expect(combo).toBeNull();
    });
  });

  describe('triples', () => {
    it('identifies a triple', () => {
      const combo = identifyCombo([c(9, 'jade'), c(9, 'sword'), c(9, 'pagoda')]);
      expect(combo!.type).toBe('triple');
      expect(combo!.rank).toBe(9);
    });

    it('identifies phoenix triple', () => {
      const combo = identifyCombo([c(9, 'jade'), c(9, 'sword'), phoenix]);
      expect(combo!.type).toBe('triple');
      expect(combo!.rank).toBe(9);
    });
  });

  describe('full houses', () => {
    it('identifies a full house', () => {
      const combo = identifyCombo([c(8, 'jade'), c(8, 'sword'), c(8, 'pagoda'), c(3, 'jade'), c(3, 'sword')]);
      expect(combo!.type).toBe('fullHouse');
      expect(combo!.rank).toBe(8);
    });

    it('identifies full house with phoenix as pair filler', () => {
      const combo = identifyCombo([c(8, 'jade'), c(8, 'sword'), c(8, 'pagoda'), c(3, 'jade'), phoenix]);
      expect(combo!.type).toBe('fullHouse');
      expect(combo!.rank).toBe(8);
    });
  });

  describe('consecutive pairs (stairs)', () => {
    it('identifies 2 consecutive pairs', () => {
      const combo = identifyCombo([c(5, 'jade'), c(5, 'sword'), c(6, 'jade'), c(6, 'sword')]);
      expect(combo!.type).toBe('consecutivePairs');
      expect(combo!.rank).toBe(6);
      expect(combo!.length).toBe(4);
    });

    it('identifies 3 consecutive pairs', () => {
      const combo = identifyCombo([
        c(5, 'jade'), c(5, 'sword'),
        c(6, 'jade'), c(6, 'sword'),
        c(7, 'jade'), c(7, 'sword'),
      ]);
      expect(combo!.type).toBe('consecutivePairs');
      expect(combo!.rank).toBe(7);
      expect(combo!.length).toBe(6);
    });

    it('rejects non-consecutive pairs', () => {
      const combo = identifyCombo([c(5, 'jade'), c(5, 'sword'), c(7, 'jade'), c(7, 'sword')]);
      expect(combo).toBeNull();
    });
  });

  describe('straights', () => {
    it('identifies a 5-card straight', () => {
      const combo = identifyCombo([c(3), c(4, 'sword'), c(5, 'pagoda'), c(6, 'star'), c(7)]);
      expect(combo!.type).toBe('straight');
      expect(combo!.rank).toBe(7);
      expect(combo!.length).toBe(5);
    });

    it('identifies a straight with mahjong', () => {
      const combo = identifyCombo([mahjong, c(2), c(3), c(4, 'sword'), c(5, 'pagoda')]);
      expect(combo!.type).toBe('straight');
      expect(combo!.rank).toBe(5);
    });

    it('identifies a straight with phoenix filling gap', () => {
      const combo = identifyCombo([c(3), c(4, 'sword'), phoenix, c(6, 'star'), c(7)]);
      expect(combo!.type).toBe('straight');
      expect(combo!.rank).toBe(7);
    });

    it('rejects too-short straight', () => {
      const combo = identifyCombo([c(3), c(4), c(5), c(6)]);
      expect(combo).toBeNull();
    });
  });

  describe('four-of-a-kind bombs', () => {
    it('identifies a four-of-a-kind bomb', () => {
      const combo = identifyCombo([c(8, 'jade'), c(8, 'sword'), c(8, 'pagoda'), c(8, 'star')]);
      expect(combo!.type).toBe('fourOfAKindBomb');
      expect(combo!.rank).toBe(8);
    });

    it('rejects phoenix in bomb', () => {
      const combo = identifyCombo([c(8, 'jade'), c(8, 'sword'), c(8, 'pagoda'), phoenix]);
      // Should not be a bomb — should be identified as triple or invalid
      expect(combo?.type).not.toBe('fourOfAKindBomb');
    });
  });

  describe('straight flush bombs', () => {
    it('identifies a straight flush bomb', () => {
      const combo = identifyCombo([c(3, 'jade'), c(4, 'jade'), c(5, 'jade'), c(6, 'jade'), c(7, 'jade')]);
      expect(combo!.type).toBe('straightFlushBomb');
      expect(combo!.rank).toBe(7);
    });

    it('rejects mixed-suit straight as bomb', () => {
      const combo = identifyCombo([c(3, 'jade'), c(4, 'sword'), c(5, 'jade'), c(6, 'jade'), c(7, 'jade')]);
      expect(combo!.type).not.toBe('straightFlushBomb');
    });
  });

  describe('dragon cannot be in combinations', () => {
    it('rejects dragon in a pair', () => {
      const combo = identifyCombo([dragon, c(14)]);
      expect(combo).toBeNull();
    });
  });
});

describe('canBeat', () => {
  it('higher single beats lower single', () => {
    const current = identifyCombo([c(5)])!;
    const play = identifyCombo([c(8)])!;
    expect(canBeat(current, play)).toBe(true);
  });

  it('lower single cannot beat higher single', () => {
    const current = identifyCombo([c(8)])!;
    const play = identifyCombo([c(5)])!;
    expect(canBeat(current, play)).toBe(false);
  });

  it('bomb beats non-bomb', () => {
    const current = identifyCombo([c(14)])!;
    const bomb = identifyCombo([c(2, 'jade'), c(2, 'sword'), c(2, 'pagoda'), c(2, 'star')])!;
    expect(canBeat(current, bomb)).toBe(true);
  });

  it('bomb beats pair', () => {
    const current = identifyCombo([c(14, 'jade'), c(14, 'sword')])!;
    const bomb = identifyCombo([c(2, 'jade'), c(2, 'sword'), c(2, 'pagoda'), c(2, 'star')])!;
    expect(canBeat(current, bomb)).toBe(true);
  });

  it('straight flush beats four-of-a-kind', () => {
    const foak = identifyCombo([c(14, 'jade'), c(14, 'sword'), c(14, 'pagoda'), c(14, 'star')])!;
    const sf = identifyCombo([c(2, 'jade'), c(3, 'jade'), c(4, 'jade'), c(5, 'jade'), c(6, 'jade')])!;
    expect(canBeat(foak, sf)).toBe(true);
  });

  it('higher four-of-a-kind beats lower', () => {
    const low = identifyCombo([c(5, 'jade'), c(5, 'sword'), c(5, 'pagoda'), c(5, 'star')])!;
    const high = identifyCombo([c(9, 'jade'), c(9, 'sword'), c(9, 'pagoda'), c(9, 'star')])!;
    expect(canBeat(low, high)).toBe(true);
  });

  it('pair cannot beat single', () => {
    const single = identifyCombo([c(5)])!;
    const pair = identifyCombo([c(8, 'jade'), c(8, 'sword')])!;
    expect(canBeat(single, pair)).toBe(false);
  });

  it('different length straights cannot beat each other', () => {
    const five = identifyCombo([c(3), c(4, 'sword'), c(5, 'pagoda'), c(6, 'star'), c(7)])!;
    const six = identifyCombo([c(3), c(4, 'sword'), c(5, 'pagoda'), c(6, 'star'), c(7), c(8, 'jade')])!;
    expect(canBeat(five, six)).toBe(false);
  });
});

describe('singleCardRank', () => {
  it('normal card returns its rank', () => {
    expect(singleCardRank(c(10))).toBe(10);
  });

  it('mahjong returns 1', () => {
    expect(singleCardRank(mahjong)).toBe(1);
  });

  it('dragon returns 16', () => {
    expect(singleCardRank(dragon)).toBe(16);
  });

  it('phoenix returns 0.5 above last played', () => {
    expect(singleCardRank(phoenix, 10)).toBe(10.5);
  });

  it('phoenix on lead returns 1.5', () => {
    expect(singleCardRank(phoenix)).toBe(1.5);
  });
});
