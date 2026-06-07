import { Card as CardType, cardId } from '@tichu/shared';
import CardComponent from './Card.js';

type Props = {
  cards: CardType[];
  selectedCards: Set<string>;
  onToggleCard: (card: CardType) => void;
  disabled?: boolean;
  draggable?: boolean;
  onDragStart?: (card: CardType) => void;
  // cardId -> arrow glyph pointing at the player who passed this card to you.
  receivedMarkers?: Map<string, string>;
};

export default function Hand({ cards, selectedCards, onToggleCard, disabled, draggable, onDragStart, receivedMarkers }: Props) {
  const overlap = cards.length > 10 ? -30 : cards.length > 7 ? -18 : cards.length > 4 ? -6 : 0;
  return (
    <div className="flex justify-center">
      {cards.map((card, i) => {
        const id = cardId(card);
        const marker = receivedMarkers?.get(id);
        return (
          <div key={id} className="relative" style={{ marginLeft: i > 0 ? `${overlap}px` : '0' }}>
            <CardComponent
              card={card}
              selected={selectedCards.has(id)}
              onClick={disabled ? undefined : () => onToggleCard(card)}
              draggable={draggable && !disabled}
              onDragStart={draggable && !disabled && onDragStart ? (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify(card));
                e.dataTransfer.effectAllowed = 'move';
                onDragStart(card);
              } : undefined}
            />
            {marker && (
              <div
                className="absolute bottom-0.5 left-0.5 z-10 flex items-center gap-0.5 rounded bg-blue-600/90 px-1 text-[10px] font-bold leading-none text-white shadow pointer-events-none"
                title="Passed to you"
              >
                <span>p</span>
                <span>{marker}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
