import { Card, MAGIC_SUITS, NormalCard, NormalRank, SpecialCard, Suit, Theme, ThemeSuits } from './types.js';

const SUITS: Suit[] = ['jade', 'sword', 'pagoda', 'star'];
const RANKS: NormalRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function createDeck(): Card[] {
  const cards: Card[] = [];

  // Normal cards
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ type: 'normal', suit, rank } as NormalCard);
    }
  }

  // Special cards
  const specials: SpecialCard[] = [
    { type: 'special', name: 'mahjong' },
    { type: 'special', name: 'dog' },
    { type: 'special', name: 'phoenix' },
    { type: 'special', name: 'dragon' },
  ];
  cards.push(...specials);

  return cards;
}

/** Fisher-Yates shuffle (in place, also returns the array) */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * The suits a new game's cards are drawn as: on the Magic table, four of its
 * five suits at random, assigned to the four game suits in random order;
 * null on every other table. Chosen once per game by the server so every
 * seat sees the same deck.
 */
export function pickThemeSuits(theme: Theme | undefined, random: () => number = Math.random): ThemeSuits | null {
  if (theme !== 'magic') return null;
  const pool = [...MAGIC_SUITS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Object.fromEntries(SUITS.map((suit, i) => [suit, pool[i]])) as ThemeSuits;
}

/** Get the sort value of a card (for hand ordering) */
export function cardSortValue(card: Card): number {
  if (card.type === 'special') {
    switch (card.name) {
      case 'mahjong': return 1;
      case 'dog': return 0;
      case 'phoenix': return 15;
      case 'dragon': return 16;
    }
  }
  return card.rank;
}

/** Sort cards for display in hand */
export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => cardSortValue(a) - cardSortValue(b));
}
