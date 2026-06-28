import type { Card as CardType, Combo } from '@tichu/shared';
import { cardId } from '@tichu/shared';
import CardComponent from './Card.js';

type Props = {
  cards: CardType[];
  isTopOfTrick: boolean;
  combo: Combo | null;
};

export default function SeatPlay({ cards, isTopOfTrick, combo }: Props) {
  if (cards.length === 0) return null;
  const sorted = sortForDisplay(cards, combo);
  return (
    <div
      className={`inline-flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg seat-play ${
        isTopOfTrick
          ? 'bg-yellow-500/10 ring-1 ring-yellow-400/50 shadow-[0_0_18px_rgba(250,204,21,0.25)]'
          : 'bg-gray-800/30 ring-1 ring-gray-600/40 opacity-70'
      }`}
    >
      <div className="flex">
        {sorted.map((card, i) => (
          <div key={cardId(card)} style={{ marginLeft: i > 0 ? '-28px' : 0 }}>
            <CardComponent card={card} small />
          </div>
        ))}
      </div>
    </div>
  );
}

function sortForDisplay(cards: CardType[], combo: Combo | null): CardType[] {
  if (!combo) return cards;
  if (
    combo.type === 'straight' ||
    combo.type === 'consecutivePairs' ||
    combo.type === 'straightFlushBomb'
  ) {
    // Give the phoenix the rank of the card it's substituting for so it slots
    // into its proper place in the sequence (e.g. 1 2 🔥 4 5) rather than
    // floating to the front.
    const phoenixRank = phoenixSlotRank(cards, combo);
    return [...cards].sort((a, b) => cardRank(a, phoenixRank) - cardRank(b, phoenixRank));
  }
  return cards;
}

function cardRank(card: CardType, phoenixRank?: number | null): number {
  if (card.type === 'normal') return card.rank;
  if (card.type === 'special' && card.name === 'mahjong') return 1;
  if (card.type === 'special' && card.name === 'dragon') return 16;
  if (card.type === 'special' && card.name === 'phoenix' && phoenixRank != null) return phoenixRank;
  return 0;
}

/**
 * Work out which rank the phoenix is standing in for within a sequence combo,
 * so it can be sorted into that position. Returns null if there's no phoenix.
 */
function phoenixSlotRank(cards: CardType[], combo: Combo): number | null {
  if (!cards.some(c => c.type === 'special' && c.name === 'phoenix')) return null;

  // Ranks contributed by the non-phoenix cards (mahjong counts as 1).
  const present: number[] = [];
  for (const c of cards) {
    if (c.type === 'normal') present.push(c.rank);
    else if (c.type === 'special' && c.name === 'mahjong') present.push(1);
  }

  if (combo.type === 'straight') {
    // The straight spans `length` consecutive ranks ending at combo.rank; the
    // phoenix fills whichever one isn't covered by a real card.
    const presentSet = new Set(present);
    for (let r = combo.rank - combo.length + 1; r <= combo.rank; r++) {
      if (!presentSet.has(r)) return r;
    }
  } else if (combo.type === 'consecutivePairs') {
    const numPairs = combo.length / 2;
    const counts: Record<number, number> = {};
    for (const r of present) counts[r] = (counts[r] || 0) + 1;
    for (let r = combo.rank - numPairs + 1; r <= combo.rank; r++) {
      if ((counts[r] || 0) < 2) return r;
    }
  }

  return null;
}
