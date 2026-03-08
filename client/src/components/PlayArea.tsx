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

/**
 * Sort cards for display so phoenix appears in its logical position within combos.
 */
function sortCardsForDisplay(cards: CardType[], combo: Combo): CardType[] {
  const hasPhoenix = cards.some(c => c.type === 'special' && c.name === 'phoenix');
  if (!hasPhoenix) {
    // No phoenix — just sort normal cards by rank for straights/consecutive pairs
    if (combo.type === 'straight' || combo.type === 'consecutivePairs' || combo.type === 'straightFlushBomb') {
      return [...cards].sort((a, b) => cardRank(a) - cardRank(b));
    }
    if (combo.type === 'fullHouse') {
      return sortFullHouse(cards);
    }
    return cards;
  }

  const phoenix = cards.find(c => c.type === 'special' && c.name === 'phoenix')!;
  const others = cards.filter(c => !(c.type === 'special' && c.name === 'phoenix'));

  if (combo.type === 'straight') {
    // Find where phoenix fills in — look for a gap in ranks
    const normalRanks = others.map(c => cardRank(c)).sort((a, b) => a - b);
    let phoenixDisplayRank: number;

    // Check for a gap
    let gapRank: number | null = null;
    for (let i = 1; i < normalRanks.length; i++) {
      if (normalRanks[i] - normalRanks[i - 1] === 2) {
        gapRank = normalRanks[i - 1] + 1;
        break;
      }
    }
    if (gapRank !== null) {
      phoenixDisplayRank = gapRank;
    } else {
      // No gap — phoenix extends at the high end
      phoenixDisplayRank = normalRanks[normalRanks.length - 1] + 1;
    }

    const sorted = [...others].sort((a, b) => cardRank(a) - cardRank(b));
    // Insert phoenix at the right position
    const idx = sorted.findIndex(c => cardRank(c) > phoenixDisplayRank);
    if (idx === -1) {
      sorted.push(phoenix);
    } else {
      sorted.splice(idx, 0, phoenix);
    }
    return sorted;
  }

  if (combo.type === 'consecutivePairs') {
    // Phoenix fills a pair — find the rank with only 1 card
    const rankCounts: Record<number, number> = {};
    for (const c of others) {
      const r = cardRank(c);
      rankCounts[r] = (rankCounts[r] || 0) + 1;
    }
    const singleRank = Object.entries(rankCounts).find(([, count]) => count === 1);
    const phoenixDisplayRank = singleRank ? Number(singleRank[0]) : cardRank(others[others.length - 1]);

    const sorted = [...others].sort((a, b) => cardRank(a) - cardRank(b));
    // Insert phoenix next to its matching rank
    const idx = sorted.findIndex(c => cardRank(c) === phoenixDisplayRank);
    if (idx !== -1) {
      sorted.splice(idx + 1, 0, phoenix);
    } else {
      sorted.push(phoenix);
    }
    return sorted;
  }

  if (combo.type === 'fullHouse') {
    // Determine triple vs pair rank
    const rankCounts: Record<number, number> = {};
    for (const c of others) {
      const r = cardRank(c);
      rankCounts[r] = (rankCounts[r] || 0) + 1;
    }
    const entries = Object.entries(rankCounts);
    let tripleRank: number;
    let pairRank: number;

    if (entries.length === 1) {
      // 4 of same rank + phoenix — combo.rank is the triple rank
      tripleRank = Number(entries[0][0]);
      pairRank = tripleRank; // phoenix acts as pair of different rank but visually group with triple
    } else {
      const [r1, c1] = [Number(entries[0][0]), entries[0][1]];
      const [r2, c2] = [Number(entries[1][0]), entries[1][1]];
      if (c1 === 3) { tripleRank = r1; pairRank = r2; }
      else if (c2 === 3) { tripleRank = r2; pairRank = r1; }
      else if (c1 === 2 && c2 === 2) {
        // Phoenix completes one group to triple — combo.rank is the triple rank
        tripleRank = combo.rank;
        pairRank = tripleRank === r1 ? r2 : r1;
      } else {
        tripleRank = c1 > c2 ? r1 : r2;
        pairRank = tripleRank === r1 ? r2 : r1;
      }
    }

    // Build sorted: triple cards first (with phoenix if needed), then pair
    const tripleCards = others.filter(c => cardRank(c) === tripleRank);
    const pairCards = others.filter(c => cardRank(c) === pairRank);

    if (tripleCards.length === 2) {
      // Phoenix is part of triple
      return [...tripleCards, phoenix, ...pairCards];
    } else {
      // Phoenix is part of pair
      return [...tripleCards, ...pairCards, phoenix];
    }
  }

  // For pair/triple with phoenix, just put phoenix adjacent
  if (combo.type === 'pair' || combo.type === 'triple') {
    return [...others, phoenix];
  }

  return cards;
}

function sortFullHouse(cards: CardType[]): CardType[] {
  const rankCounts: Record<number, number> = {};
  for (const c of cards) {
    const r = cardRank(c);
    rankCounts[r] = (rankCounts[r] || 0) + 1;
  }
  const tripleRank = Object.entries(rankCounts).find(([, count]) => count === 3)?.[0];
  if (!tripleRank) return cards;
  const tr = Number(tripleRank);
  return [...cards.filter(c => cardRank(c) === tr), ...cards.filter(c => cardRank(c) !== tr)];
}

function cardRank(card: CardType): number {
  if (card.type === 'normal') return card.rank;
  if (card.type === 'special' && card.name === 'mahjong') return 1;
  if (card.type === 'special' && card.name === 'dragon') return 16;
  return 0;
}

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
  const displayCards = sortCardsForDisplay(lastPlay, currentTrick);

  return (
    <div className="flex flex-col items-center gap-2 animate-slide-up">
      {lastPlayedBy !== null && (
        <div className="text-sm text-gray-300">
          Played by <span className="font-bold text-yellow-400">{playerNames[lastPlayedBy]}</span>
        </div>
      )}
      <div className="flex gap-1 justify-center">
        {displayCards.map((card) => (
          <CardComponent key={cardId(card)} card={card} />
        ))}
      </div>
      <div className="text-xs text-gray-400">
        {comboLabel(currentTrick)}
      </div>
    </div>
  );
}
