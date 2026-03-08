import { Card as CardType, Combo, RANK_NAMES, NormalRank, cardId } from '@tichu/shared';
import CardComponent from './Card.js';

function rankLabel(rank: number): string {
  if (rank in RANK_NAMES) return RANK_NAMES[rank as NormalRank];
  if (rank === 1) return '1';
  if (rank === 15) return 'Dragon';
  return String(rank);
}

function comboLabel(combo: Combo): string {
  const r = rankLabel(combo.rank);
  switch (combo.type) {
    case 'single': return `Single, ${r}`;
    case 'pair': return `Pair, ${r}s`;
    case 'triple': return `Triple, ${r}s`;
    case 'fullHouse': return `Full House, ${r}s`;
    case 'straight': return `${combo.length}-card Straight, high ${r}`;
    case 'consecutivePairs': return `${combo.length / 2} Consecutive Pairs, high ${r}`;
    case 'fourOfAKindBomb': return `Four-of-a-Kind Bomb, ${r}s`;
    case 'straightFlushBomb': return `${combo.length}-card Straight Flush Bomb, high ${r}`;
    default: return combo.type;
  }
}

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
        {comboLabel(currentTrick)}
      </div>
    </div>
  );
}
