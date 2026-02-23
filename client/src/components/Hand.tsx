import { Card as CardType, cardId } from '@tichu/shared';
import CardComponent from './Card.js';

type Props = {
  cards: CardType[];
  selectedCards: Set<string>;
  onToggleCard: (card: CardType) => void;
  disabled?: boolean;
};

export default function Hand({ cards, selectedCards, onToggleCard, disabled }: Props) {
  return (
    <div className="flex justify-center flex-wrap gap-1">
      {cards.map((card) => {
        const id = cardId(card);
        return (
          <CardComponent
            key={id}
            card={card}
            selected={selectedCards.has(id)}
            onClick={disabled ? undefined : () => onToggleCard(card)}
          />
        );
      })}
    </div>
  );
}
