import { describe, it, expect } from 'vitest';
import { cardPoints, sumPoints } from './scoring.js';
import { Card, NormalCard } from './types.js';

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
