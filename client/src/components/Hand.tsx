import { Card as CardType, cardId } from '@tichu/shared';
import CardComponent from './Card.js';

type Props = {
  cards: CardType[];
  selectedCards: Set<string>;
  onToggleCard: (card: CardType) => void;
  disabled?: boolean;
};

export default function Hand({ cards, selectedCards, onToggleCard, disabled }: Props) {
  // Overlap cards so all 14 fit on one line
  const overlap = cards.length > 10 ? -12 : cards.length > 7 ? -6 : 0;
  return (
    <div className="flex justify-center">
      {cards.map((card, i) => {
        const id = cardId(card);
        return (
          <div key={id} style={{ marginLeft: i > 0 ? `${overlap}px` : '0' }}>
            <CardComponent
              card={card}
              selected={selectedCards.has(id)}
              onClick={disabled ? undefined : () => onToggleCard(card)}
            />
          </div>
        );
      })}
    </div>
  );
}
