import { Card as CardType, cardId } from '@tichu/shared';
import CardComponent from './Card.js';

type Props = {
  cards: CardType[];
  selectedCards: Set<string>;
  onToggleCard: (card: CardType) => void;
  disabled?: boolean;
  draggable?: boolean;
  large?: boolean;
  onDragStart?: (card: CardType) => void;
};

// Card widths in px (Card.tsx: w-24 / large w-36), and the widest a hand may
// spread within the 1300px design width (FitToViewport).
const CARD_WIDTH = 96;
const LARGE_CARD_WIDTH = 144;
const MAX_HAND_WIDTH = 1240;

export default function Hand({ cards, selectedCards, onToggleCard, disabled, draggable, large, onDragStart }: Props) {
  // Larger cards are 50% wider, so scale the overlap up, and tighten it
  // further whenever the hand would still be wider than the layout allows.
  const baseOverlap = cards.length > 10 ? -30 : cards.length > 7 ? -18 : cards.length > 4 ? -6 : 0;
  const cardWidth = large ? LARGE_CARD_WIDTH : CARD_WIDTH;
  const fitOverlap = cards.length > 1
    ? Math.min(0, Math.floor((MAX_HAND_WIDTH - cards.length * cardWidth) / (cards.length - 1)))
    : 0;
  const overlap = Math.min(large ? Math.round(baseOverlap * 1.5) : baseOverlap, fitOverlap);
  return (
    <div className="flex justify-center">
      {cards.map((card, i) => {
        const id = cardId(card);
        return (
          <div key={id} style={{ marginLeft: i > 0 ? `${overlap}px` : '0' }}>
            <CardComponent
              card={card}
              selected={selectedCards.has(id)}
              large={large}
              onClick={disabled ? undefined : () => onToggleCard(card)}
              draggable={draggable && !disabled}
              onDragStart={draggable && !disabled && onDragStart ? (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify(card));
                e.dataTransfer.effectAllowed = 'move';
                onDragStart(card);
              } : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
