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
    return [...cards].sort((a, b) => cardRank(a) - cardRank(b));
  }
  return cards;
}

function cardRank(card: CardType): number {
  if (card.type === 'normal') return card.rank;
  if (card.type === 'special' && card.name === 'mahjong') return 1;
  if (card.type === 'special' && card.name === 'dragon') return 16;
  return 0;
}
