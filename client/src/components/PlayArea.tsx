import { Card as CardType, Combo, cardId } from '@tichu/shared';
import CardComponent from './Card.js';

type Props = {
  currentTrick: Combo | null;
  currentTrickCards: CardType[][];
  lastPlayedBy: number | null;
  playerNames: string[];
};

export default function PlayArea({ currentTrick, currentTrickCards, lastPlayedBy, playerNames }: Props) {
  if (!currentTrick || currentTrickCards.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 italic">
        No cards played yet
      </div>
    );
  }

  // Show the most recent play
  const lastPlay = currentTrickCards[currentTrickCards.length - 1];

  return (
    <div className="flex flex-col items-center gap-2 animate-slide-up">
      {lastPlayedBy !== null && (
        <div className="text-sm text-gray-300">
          Played by <span className="font-bold text-yellow-400">{playerNames[lastPlayedBy]}</span>
        </div>
      )}
      <div className="flex gap-1 justify-center">
        {lastPlay.map((card) => (
          <CardComponent key={cardId(card)} card={card} />
        ))}
      </div>
      <div className="text-xs text-gray-400">
        {currentTrick.type.replace(/([A-Z])/g, ' $1').trim()} — Rank {currentTrick.rank}
      </div>
    </div>
  );
}
