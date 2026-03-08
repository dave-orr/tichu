import { useMemo } from 'react';
import type { Card, NormalRank } from '@tichu/shared';
import { RANK_NAMES, SPECIAL_NAMES } from '@tichu/shared';

type Props = {
  myHand: Card[];
  playedCards: Card[];
};

const RANKS: NormalRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const SPECIALS = ['mahjong', 'dog', 'phoenix', 'dragon'] as const;

export default function CardsSeen({ myHand, playedCards }: Props) {
  const remaining = useMemo(() => {
    // Count cards that are known (in your hand or played)
    const knownNormal: Record<number, number> = {};
    const knownSpecial: Record<string, number> = {};

    for (const rank of RANKS) knownNormal[rank] = 0;
    for (const s of SPECIALS) knownSpecial[s] = 0;

    const countCard = (card: Card) => {
      if (card.type === 'normal') {
        knownNormal[card.rank] = (knownNormal[card.rank] || 0) + 1;
      } else {
        knownSpecial[card.name] = (knownSpecial[card.name] || 0) + 1;
      }
    };

    for (const c of myHand) countCard(c);
    for (const c of playedCards) countCard(c);

    // Remaining = total - known
    const normalRemaining: { rank: NormalRank; remaining: number }[] = RANKS.map(rank => ({
      rank,
      remaining: 4 - (knownNormal[rank] || 0),
    }));

    const specialRemaining = SPECIALS.map(name => ({
      name,
      remaining: 1 - (knownSpecial[name] || 0),
    }));

    return { normalRemaining, specialRemaining };
  }, [myHand, playedCards]);

  return (
    <div className="bg-gray-800/80 rounded-lg p-2 text-sm">
      <div className="text-gray-400 text-center mb-1 font-semibold">Cards Remaining</div>
      <div className="flex flex-wrap justify-center gap-x-1 gap-y-0.5">
        {remaining.normalRemaining.map(({ rank, remaining: count }) => (
          <span
            key={rank}
            className={`w-7 text-center rounded px-0.5 ${
              count === 0 ? 'text-gray-600' : count <= 2 ? 'text-yellow-400' : 'text-white'
            }`}
          >
            {RANK_NAMES[rank]}:{count}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-x-1 mt-0.5">
        {remaining.specialRemaining.map(({ name, remaining: count }) => (
          <span
            key={name}
            className={`text-center rounded px-1 ${
              count === 0 ? 'text-gray-600' : 'text-white'
            }`}
          >
            {SPECIAL_NAMES[name]}:{count}
          </span>
        ))}
      </div>
    </div>
  );
}
