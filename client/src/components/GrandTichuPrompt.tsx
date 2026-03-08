import { useState } from 'react';
import { Card as CardType, cardId } from '@tichu/shared';
import CardComponent from './Card.js';

type Props = {
  cards: CardType[];
  decided: boolean;
  onDecide: (call: boolean) => void;
  otherCallers?: string[];
  waitingOn?: string[];
};

export default function GrandTichuPrompt({ cards, decided, onDecide, otherCallers = [], waitingOn = [] }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (decided) {
    return (
      <div className="text-center">
        <h3 className="text-xl font-bold mb-4 text-yellow-400">Grand Tichu</h3>
        <p className="text-gray-300 text-lg">
          {waitingOn.length > 0
            ? `Waiting for ${waitingOn.join(', ')}...`
            : 'Waiting for other players to decide...'}
        </p>
        <div className="flex justify-center flex-wrap gap-1 mt-4">
          {cards.map(card => (
            <CardComponent key={cardId(card)} card={card} />
          ))}
        </div>
      </div>
    );
  }

  const handleCallClick = () => {
    if (otherCallers.length > 0) {
      setShowConfirm(true);
    } else {
      onDecide(true);
    }
  };

  return (
    <div className="text-center space-y-4">
      <h3 className="text-xl font-bold text-yellow-400">Grand Tichu?</h3>
      <p className="text-gray-300 text-base">
        You've seen your first 8 cards. Call Grand Tichu for +200/-200 points.
      </p>
      <div className="flex justify-center flex-wrap gap-1">
        {cards.map(card => (
          <CardComponent key={cardId(card)} card={card} />
        ))}
      </div>
      {showConfirm ? (
        <div className="space-y-2">
          <div className="text-base text-yellow-400">
            {otherCallers.join(', ')} already called Grand Tichu. Still call?
          </div>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => { onDecide(true); setShowConfirm(false); }}
              className="py-2 px-6 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-colors"
            >
              Yes, Grand Tichu!
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="py-2 px-6 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center gap-4 mt-4">
          <button
            onClick={handleCallClick}
            className="py-2 px-6 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-colors"
          >
            Grand Tichu!
          </button>
          <button
            onClick={() => onDecide(false)}
            className="py-2 px-6 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold transition-colors"
          >
            Pass
          </button>
        </div>
      )}
    </div>
  );
}
