import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, sortHand, cardSortValue, pickThemeSuits } from './deck.js';
import { MAGIC_SUITS } from './types.js';

describe('createDeck', () => {
  it('creates 56 cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(56);
  });

  it('has 52 normal cards and 4 special cards', () => {
    const deck = createDeck();
    const normal = deck.filter(c => c.type === 'normal');
    const special = deck.filter(c => c.type === 'special');
    expect(normal).toHaveLength(52);
    expect(special).toHaveLength(4);
  });

  it('has all 4 suits with 13 ranks each', () => {
    const deck = createDeck();
    const normal = deck.filter(c => c.type === 'normal');
    const suits = new Set(normal.map(c => (c as any).suit));
    expect(suits.size).toBe(4);
    for (const suit of suits) {
      const suitCards = normal.filter(c => (c as any).suit === suit);
      expect(suitCards).toHaveLength(13);
    }
  });

  it('has mahjong, dog, phoenix, dragon', () => {
    const deck = createDeck();
    const special = deck.filter(c => c.type === 'special');
    const names = special.map(c => (c as any).name).sort();
    expect(names).toEqual(['dog', 'dragon', 'mahjong', 'phoenix']);
  });
});

describe('shuffle', () => {
  it('preserves all cards', () => {
    const deck = createDeck();
    const original = [...deck];
    shuffle(deck);
    expect(deck).toHaveLength(56);
    // Every card from original should still be present
    for (const card of original) {
      const found = deck.some(c => JSON.stringify(c) === JSON.stringify(card));
      expect(found).toBe(true);
    }
  });
});

describe('sortHand', () => {
  it('sorts by rank with specials in order', () => {
    const hand = [
      { type: 'normal' as const, suit: 'jade' as const, rank: 14 as const },
      { type: 'special' as const, name: 'phoenix' as const },
      { type: 'normal' as const, suit: 'sword' as const, rank: 3 as const },
      { type: 'special' as const, name: 'mahjong' as const },
    ];
    const sorted = sortHand(hand);
    const values = sorted.map(cardSortValue);
    // Should be ascending
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});

describe('pickThemeSuits', () => {
  it('is null for themes without extra suits', () => {
    expect(pickThemeSuits('papercraft')).toBeNull();
    expect(pickThemeSuits('baroque')).toBeNull();
    expect(pickThemeSuits(undefined)).toBeNull();
  });

  it('gives each game suit a different Magic suit', () => {
    for (let n = 0; n < 50; n++) {
      const picked = pickThemeSuits('magic')!;
      expect(Object.keys(picked).sort()).toEqual(['jade', 'pagoda', 'star', 'sword']);
      const used = Object.values(picked);
      expect(new Set(used).size).toBe(4);
      for (const s of used) expect(MAGIC_SUITS).toContain(s);
    }
  });

  it('can leave out any of the five', () => {
    const left = new Set<string>();
    for (let n = 0; n < 500; n++) {
      const used = Object.values(pickThemeSuits('magic')!);
      left.add(MAGIC_SUITS.find(s => !used.includes(s))!);
    }
    expect(left.size).toBe(5);
  });
});
