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

export default function Hand({ cards, selectedCards, onToggleCard, disabled, draggable, large, onDragStart }: Props) {
  // Larger cards are 50% wider, so scale the overlap up to keep the hand from
  // sprawling off-screen.
  const baseOverlap = cards.length > 10 ? -30 : cards.length > 7 ? -18 : cards.length > 4 ? -6 : 0;
  const overlap = large ? Math.round(baseOverlap * 1.5) : baseOverlap;
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
