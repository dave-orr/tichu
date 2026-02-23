import { Card, NormalCard, NormalRank, SpecialCard, Suit } from './types.js';

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

/** Deal the full deck into 4 hands of 14 cards */
export function dealAll(deck: Card[]): [Card[], Card[], Card[], Card[]] {
  const d = [...deck];
  shuffle(d);
  return [
    d.slice(0, 14),
    d.slice(14, 28),
    d.slice(28, 42),
    d.slice(42, 56),
  ];
}

/** Deal first 8 cards to each player (for Grand Tichu window) */
export function dealFirstEight(deck: Card[]): {
  hands: [Card[], Card[], Card[], Card[]];
  remaining: [Card[], Card[], Card[], Card[]];
} {
  const d = [...deck];
  shuffle(d);
  return {
    hands: [
      d.slice(0, 8),
      d.slice(14, 22),
      d.slice(28, 36),
      d.slice(42, 50),
    ],
    remaining: [
      d.slice(8, 14),
      d.slice(22, 28),
      d.slice(36, 42),
      d.slice(50, 56),
    ],
  };
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
