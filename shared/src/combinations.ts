import { Card, Combo, ComboType, NormalCard, NormalRank, Suit, cardId } from './types.js';

/**
 * Get the effective rank of a card for comparison purposes.
 * Phoenix rank depends on context and is handled separately.
 */
function getNormalRank(card: Card): NormalRank | null {
  if (card.type === 'normal') return card.rank;
  if (card.type === 'special') {
    if (card.name === 'mahjong') return 1 as NormalRank; // special: rank 1
    // dog, phoenix, dragon don't have a "normal" rank in combos
  }
  return null;
}

/**
 * Get the single-card rank for comparison when playing singles.
 * The Mah Jong = 1, Phoenix = contextual (0.5 above last played), Dragon = 15.
 */
export function singleCardRank(card: Card, lastPlayedRank?: number): number {
  if (card.type === 'normal') return card.rank;
  switch (card.name) {
    case 'mahjong': return 1;
    case 'phoenix': return lastPlayedRank != null ? lastPlayedRank + 0.5 : 1.5;
    case 'dragon': return 15;
    case 'dog': return -1; // dog can't be played as a normal single in a trick
  }
}

/**
 * Check if a set of cards forms a valid combination.
 * Returns the Combo if valid, null otherwise.
 *
 * phoenixAs: if provided, treat Phoenix as this rank (for combo building)
 */
export function identifyCombo(cards: Card[], phoenixAs?: NormalRank): Combo | null {
  if (cards.length === 0) return null;

  const hasPhoenix = cards.some(c => c.type === 'special' && c.name === 'phoenix');
  const hasDog = cards.some(c => c.type === 'special' && c.name === 'dog');
  const hasDragon = cards.some(c => c.type === 'special' && c.name === 'dragon');

  // Dog can only be played alone as a lead
  if (hasDog) {
    if (cards.length === 1) {
      return { type: 'single', cards, rank: -1, length: 1 };
    }
    return null; // dog can't be part of any combo
  }

  // Single card
  if (cards.length === 1) {
    const card = cards[0];
    return {
      type: 'single',
      cards,
      rank: singleCardRank(card),
      length: 1,
    };
  }

  // Dragon can only be played as a single
  if (hasDragon) return null;

  // Extract normal cards and figure out where phoenix fits
  const normalCards = cards.filter(c => c.type === 'normal') as NormalCard[];
  const mahjong = cards.find(c => c.type === 'special' && c.name === 'mahjong');

  // Build rank list
  const ranks: number[] = normalCards.map(c => c.rank);
  if (mahjong) ranks.push(1);
  ranks.sort((a, b) => a - b);

  // Try detecting each combo type (bombs first so they take priority over straights)
  const result =
    tryFourOfAKindBomb(cards, normalCards, hasPhoenix, ranks) ??
    tryStraightFlushBomb(cards, normalCards, hasPhoenix, mahjong) ??
    tryPair(cards, normalCards, hasPhoenix, ranks, phoenixAs) ??
    tryTriple(cards, normalCards, hasPhoenix, ranks, phoenixAs) ??
    tryFullHouse(cards, normalCards, hasPhoenix, ranks, phoenixAs) ??
    tryConsecutivePairs(cards, normalCards, hasPhoenix, mahjong, ranks, phoenixAs) ??
    tryStraight(cards, normalCards, hasPhoenix, mahjong, ranks, phoenixAs);

  return result;
}

function tryPair(
  cards: Card[], normalCards: NormalCard[], hasPhoenix: boolean,
  ranks: number[], phoenixAs?: NormalRank
): Combo | null {
  if (cards.length !== 2) return null;

  if (!hasPhoenix) {
    // Two normal cards (or mahjong) of the same rank
    if (ranks.length === 2 && ranks[0] === ranks[1]) {
      return { type: 'pair', cards, rank: ranks[0], length: 2 };
    }
    return null;
  }

  // Phoenix + one normal card = pair of that rank
  if (ranks.length === 1) {
    const rank = phoenixAs ?? ranks[0];
    return { type: 'pair', cards, rank, length: 2 };
  }
  return null;
}

function tryTriple(
  cards: Card[], normalCards: NormalCard[], hasPhoenix: boolean,
  ranks: number[], phoenixAs?: NormalRank
): Combo | null {
  if (cards.length !== 3) return null;

  if (!hasPhoenix) {
    if (ranks.length === 3 && ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
      return { type: 'triple', cards, rank: ranks[0], length: 3 };
    }
    return null;
  }

  // Phoenix + 2 of same rank
  if (ranks.length === 2 && ranks[0] === ranks[1]) {
    const rank = phoenixAs ?? ranks[0];
    return { type: 'triple', cards, rank, length: 3 };
  }
  return null;
}

function tryFullHouse(
  cards: Card[], normalCards: NormalCard[], hasPhoenix: boolean,
  ranks: number[], phoenixAs?: NormalRank
): Combo | null {
  if (cards.length !== 5) return null;

  const freq = getFrequencies(ranks);
  const freqEntries = Object.entries(freq).map(([r, c]) => [Number(r), c] as [number, number]);

  if (!hasPhoenix) {
    // Need exactly one rank with 3 and one with 2
    if (freqEntries.length === 2) {
      const triple = freqEntries.find(([, c]) => c === 3);
      const pair = freqEntries.find(([, c]) => c === 2);
      if (triple && pair) {
        return { type: 'fullHouse', cards, rank: triple[0], length: 5 };
      }
    }
    return null;
  }

  // With phoenix: need one rank with 3 and phoenix makes the pair, or one rank with 2 and another with 2, phoenix joins one
  if (freqEntries.length === 2) {
    const [r1, c1] = freqEntries[0];
    const [r2, c2] = freqEntries[1];

    if (c1 === 3 && c2 === 1) {
      // Phoenix becomes pair with r2
      return { type: 'fullHouse', cards, rank: r1, length: 5 };
    }
    if (c1 === 1 && c2 === 3) {
      return { type: 'fullHouse', cards, rank: r2, length: 5 };
    }
    if (c1 === 2 && c2 === 2) {
      // Phoenix can join either pair to make triple
      // Use phoenixAs hint, otherwise pick the higher rank as triple
      if (phoenixAs != null) {
        const tripleRank = phoenixAs === r1 ? r1 : r2;
        return { type: 'fullHouse', cards, rank: tripleRank, length: 5 };
      }
      // Default: higher rank is the triple
      const tripleRank = Math.max(r1, r2);
      return { type: 'fullHouse', cards, rank: tripleRank, length: 5 };
    }
  }
  if (freqEntries.length === 1 && freqEntries[0][1] === 4) {
    // 4 of same rank + phoenix: phoenix acts as any rank to form pair
    // This is a full house only if phoenix represents a different rank
    if (phoenixAs != null && phoenixAs !== freqEntries[0][0]) {
      // Actually this would be triple + pair from same rank set... not valid normal full house
    }
    // Can't really make a valid full house from 4-of-a-kind + phoenix
    return null;
  }
  return null;
}

function tryConsecutivePairs(
  cards: Card[], normalCards: NormalCard[], hasPhoenix: boolean,
  mahjong: Card | undefined, ranks: number[], phoenixAs?: NormalRank
): Combo | null {
  if (cards.length < 4 || cards.length % 2 !== 0) return null;

  const numPairs = cards.length / 2;
  const freq = getFrequencies(ranks);
  const freqEntries = Object.entries(freq)
    .map(([r, c]) => [Number(r), c] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  if (!hasPhoenix) {
    // All entries must have count 2, and ranks must be consecutive
    if (freqEntries.length !== numPairs) return null;
    if (!freqEntries.every(([, c]) => c === 2)) return null;
    if (!isConsecutive(freqEntries.map(([r]) => r))) return null;
    return {
      type: 'consecutivePairs',
      cards,
      rank: freqEntries[freqEntries.length - 1][0],
      length: cards.length,
    };
  }

  // With phoenix: one rank has count 1 (phoenix fills it), rest have count 2
  // Or we need to figure out where phoenix goes to make consecutive pairs
  const onesCount = freqEntries.filter(([, c]) => c === 1).length;
  const twosCount = freqEntries.filter(([, c]) => c === 2).length;

  if (onesCount === 1 && twosCount === numPairs - 1 && freqEntries.length === numPairs) {
    // Phoenix fills the one with count 1
    const allRanks = freqEntries.map(([r]) => r);
    if (isConsecutive(allRanks)) {
      return {
        type: 'consecutivePairs',
        cards,
        rank: allRanks[allRanks.length - 1],
        length: cards.length,
      };
    }
  }

  // Phoenix could also create a new pair at the beginning or end
  if (onesCount === 0 && twosCount === numPairs - 1 && freqEntries.length === numPairs - 1) {
    const allRanks = freqEntries.map(([r]) => r);
    if (isConsecutive(allRanks)) {
      // Phoenix could extend at either end
      const low = allRanks[0] - 1;
      const high = allRanks[allRanks.length - 1] + 1;
      if (phoenixAs != null) {
        if (phoenixAs === low && low >= 1) {
          return { type: 'consecutivePairs', cards, rank: allRanks[allRanks.length - 1], length: cards.length };
        }
        if (phoenixAs === high && high <= 14) {
          return { type: 'consecutivePairs', cards, rank: high, length: cards.length };
        }
      }
      // Default: extend high
      if (high <= 14) {
        return { type: 'consecutivePairs', cards, rank: high, length: cards.length };
      }
      if (low >= 1) {
        return { type: 'consecutivePairs', cards, rank: allRanks[allRanks.length - 1], length: cards.length };
      }
    }
  }

  return null;
}

function tryStraight(
  cards: Card[], normalCards: NormalCard[], hasPhoenix: boolean,
  mahjong: Card | undefined, ranks: number[], phoenixAs?: NormalRank
): Combo | null {
  if (cards.length < 5) return null;

  const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);

  if (!hasPhoenix) {
    // All ranks must be unique and consecutive, and count must match cards
    if (uniqueRanks.length !== cards.length) return null;
    if (!isConsecutive(uniqueRanks)) return null;
    return {
      type: 'straight',
      cards,
      rank: uniqueRanks[uniqueRanks.length - 1],
      length: cards.length,
    };
  }

  // With phoenix: one gap allowed (phoenix fills it), or extend at end
  const nonPhoenixCount = cards.length - 1; // number of non-phoenix cards
  if (uniqueRanks.length !== nonPhoenixCount) return null; // duplicates without phoenix meaning

  // Check if unique ranks have exactly one gap of 1, or are consecutive (phoenix extends)
  if (isConsecutive(uniqueRanks)) {
    // Phoenix extends the straight
    const high = uniqueRanks[uniqueRanks.length - 1] + 1;
    const low = uniqueRanks[0] - 1;
    if (phoenixAs != null) {
      const topRank = phoenixAs > uniqueRanks[uniqueRanks.length - 1] ? phoenixAs : uniqueRanks[uniqueRanks.length - 1];
      return { type: 'straight', cards, rank: topRank, length: cards.length };
    }
    // Default: extend high if possible
    const topRank = high <= 14 ? high : uniqueRanks[uniqueRanks.length - 1];
    return { type: 'straight', cards, rank: topRank, length: cards.length };
  }

  // Check for exactly one gap
  const gaps = findGaps(uniqueRanks);
  if (gaps.length === 1 && gaps[0].size === 1) {
    // Phoenix fills the gap
    const topRank = uniqueRanks[uniqueRanks.length - 1];
    return { type: 'straight', cards, rank: topRank, length: cards.length };
  }

  return null;
}

function tryFourOfAKindBomb(
  cards: Card[], normalCards: NormalCard[], hasPhoenix: boolean,
  ranks: number[]
): Combo | null {
  if (cards.length !== 4) return null;
  if (hasPhoenix) return null; // Phoenix can't be in bombs

  // All 4 must be same rank, all normal cards (no specials in bombs)
  if (normalCards.length !== 4) return null;
  if (ranks.length !== 4) return null;
  if (!ranks.every(r => r === ranks[0])) return null;

  return {
    type: 'fourOfAKindBomb',
    cards,
    rank: ranks[0],
    length: 4,
  };
}

function tryStraightFlushBomb(
  cards: Card[], normalCards: NormalCard[], hasPhoenix: boolean,
  mahjong: Card | undefined
): Combo | null {
  if (cards.length < 5) return null;
  if (hasPhoenix) return null; // Phoenix can't be in bombs

  // All cards must be normal (mahjong has no suit, so can't be in a straight flush)
  if (mahjong) return null;
  if (normalCards.length !== cards.length) return null;

  // All must be same suit
  const suit = normalCards[0].suit;
  if (!normalCards.every(c => c.suit === suit)) return null;

  // Must be consecutive
  const ranks = normalCards.map(c => c.rank).sort((a, b) => a - b);
  if (!isConsecutive(ranks)) return null;

  return {
    type: 'straightFlushBomb',
    cards,
    rank: ranks[ranks.length - 1],
    length: cards.length,
  };
}

// ===== Comparison =====

/**
 * Can `play` beat `current`?
 * Returns true if `play` is a legal play on top of `current`.
 */
export function canBeat(current: Combo, play: Combo): boolean {
  // Bombs beat everything (except bigger bombs)
  if (isBomb(play)) {
    if (!isBomb(current)) return true;
    return compareBombs(current, play) > 0;
  }

  // Non-bomb can't beat a bomb
  if (isBomb(current)) return false;

  // Same type and length required
  if (current.type !== play.type) return false;
  if (current.length !== play.length) return false;

  // Phoenix as a single beats everything except Dragon
  if (play.type === 'single' && play.cards[0].type === 'special' && play.cards[0].name === 'phoenix') {
    return !current.cards.some(c => c.type === 'special' && c.name === 'dragon');
  }

  // Higher rank wins
  return play.rank > current.rank;
}

export function isBomb(combo: Combo): boolean {
  return combo.type === 'fourOfAKindBomb' || combo.type === 'straightFlushBomb';
}

/**
 * Compare two bombs. Returns > 0 if `play` beats `current`.
 */
function compareBombs(current: Combo, play: Combo): number {
  // Straight flush always beats four-of-a-kind
  if (play.type === 'straightFlushBomb' && current.type === 'fourOfAKindBomb') return 1;
  if (play.type === 'fourOfAKindBomb' && current.type === 'straightFlushBomb') return -1;

  // Same bomb type
  if (play.type === 'straightFlushBomb' && current.type === 'straightFlushBomb') {
    // Longer beats shorter
    if (play.length !== current.length) return play.length - current.length;
    // Same length: higher rank wins
    return play.rank - current.rank;
  }

  // Both four-of-a-kind
  return play.rank - current.rank;
}

// ===== Helpers =====

function getFrequencies(ranks: number[]): Record<number, number> {
  const freq: Record<number, number> = {};
  for (const r of ranks) {
    freq[r] = (freq[r] || 0) + 1;
  }
  return freq;
}

function isConsecutive(sorted: number[]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

function findGaps(sorted: number[]): { index: number; size: number }[] {
  const gaps: { index: number; size: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i] - sorted[i - 1];
    if (diff > 1) {
      gaps.push({ index: i, size: diff - 1 });
    }
  }
  return gaps;
}

/**
 * Find all valid combinations that can be made from a hand.
 * Useful for UI hints and AI. This is an expensive operation — use sparingly.
 */
export function findPlayableCombos(
  hand: Card[],
  current: Combo | null
): Combo[] {
  const results: Combo[] = [];

  // Try all subsets (practical for hands <= 14 cards)
  // For performance, we use targeted generation instead of brute force
  const normalCards = hand.filter(c => c.type === 'normal') as NormalCard[];
  const hasPhoenix = hand.some(c => c.type === 'special' && c.name === 'phoenix');
  const hasMahjong = hand.some(c => c.type === 'special' && c.name === 'mahjong');
  const hasDragon = hand.some(c => c.type === 'special' && c.name === 'dragon');
  const hasDog = hand.some(c => c.type === 'special' && c.name === 'dog');

  // Singles
  for (const card of hand) {
    const combo = identifyCombo([card]);
    if (combo && (!current || canBeat(current, combo))) {
      results.push(combo);
    }
  }

  // For multi-card combos, try combinations
  if (!current || current.type === 'pair' || isBomb(current)) {
    addPairs(normalCards, hasPhoenix, hasMahjong, current, results);
  }
  if (!current || current.type === 'triple' || isBomb(current)) {
    addTriples(normalCards, hasPhoenix, current, results);
  }
  if (!current || current.type === 'fullHouse' || isBomb(current)) {
    addFullHouses(normalCards, hasPhoenix, current, results);
  }
  if (!current || current.type === 'consecutivePairs' || isBomb(current)) {
    addConsecutivePairs(normalCards, hasPhoenix, hasMahjong, current, results);
  }
  if (!current || current.type === 'straight' || isBomb(current)) {
    addStraights(hand, normalCards, hasPhoenix, hasMahjong, current, results);
  }
  // Bombs (always playable)
  addBombs(normalCards, current, results);

  // Deduplicate by sorted card IDs
  const seen = new Set<string>();
  return results.filter(combo => {
    const key = combo.cards.map(c => cardId(c)).sort().join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function addPairs(
  normalCards: NormalCard[], hasPhoenix: boolean, hasMahjong: boolean,
  current: Combo | null, results: Combo[]
) {
  const byRank = groupByRank(normalCards);
  for (const [rank, cards] of Object.entries(byRank)) {
    if (cards.length >= 2) {
      const combo = identifyCombo([cards[0], cards[1]]);
      if (combo && (!current || canBeat(current, combo))) {
        results.push(combo);
      }
    }
    if (hasPhoenix && cards.length >= 1) {
      const phoenix: Card = { type: 'special', name: 'phoenix' };
      const combo = identifyCombo([cards[0], phoenix], Number(rank) as NormalRank);
      if (combo && (!current || canBeat(current, combo))) {
        results.push(combo);
      }
    }
  }
}

function addTriples(
  normalCards: NormalCard[], hasPhoenix: boolean,
  current: Combo | null, results: Combo[]
) {
  const byRank = groupByRank(normalCards);
  for (const [rank, cards] of Object.entries(byRank)) {
    if (cards.length >= 3) {
      const combo = identifyCombo([cards[0], cards[1], cards[2]]);
      if (combo && (!current || canBeat(current, combo))) {
        results.push(combo);
      }
    }
    if (hasPhoenix && cards.length >= 2) {
      const phoenix: Card = { type: 'special', name: 'phoenix' };
      const combo = identifyCombo([cards[0], cards[1], phoenix], Number(rank) as NormalRank);
      if (combo && (!current || canBeat(current, combo))) {
        results.push(combo);
      }
    }
  }
}

function addFullHouses(
  normalCards: NormalCard[], hasPhoenix: boolean,
  current: Combo | null, results: Combo[]
) {
  const byRank = groupByRank(normalCards);
  const ranks = Object.entries(byRank);

  for (const [tripleRank, tripleCards] of ranks) {
    if (tripleCards.length < 3 && !(hasPhoenix && tripleCards.length >= 2)) continue;

    for (const [pairRank, pairCards] of ranks) {
      if (pairRank === tripleRank) continue;
      if (pairCards.length < 2 && !(hasPhoenix && pairCards.length >= 1)) continue;

      let comboCards: Card[];
      if (tripleCards.length >= 3 && pairCards.length >= 2) {
        comboCards = [...tripleCards.slice(0, 3), ...pairCards.slice(0, 2)];
      } else if (hasPhoenix && tripleCards.length >= 2 && pairCards.length >= 2) {
        const phoenix: Card = { type: 'special', name: 'phoenix' };
        comboCards = [...tripleCards.slice(0, 2), phoenix, ...pairCards.slice(0, 2)];
      } else if (hasPhoenix && tripleCards.length >= 3 && pairCards.length >= 1) {
        const phoenix: Card = { type: 'special', name: 'phoenix' };
        comboCards = [...tripleCards.slice(0, 3), pairCards[0], phoenix];
      } else {
        continue;
      }

      const combo = identifyCombo(comboCards, Number(tripleRank) as NormalRank);
      if (combo && (!current || canBeat(current, combo))) {
        results.push(combo);
      }
    }
  }
}

function addConsecutivePairs(
  normalCards: NormalCard[], hasPhoenix: boolean, hasMahjong: boolean,
  current: Combo | null, results: Combo[]
) {
  const byRank = groupByRank(normalCards);
  // Ranks with natural pairs (no phoenix needed)
  const pairableRanks: number[] = [];
  // Ranks with at least one card (phoenix can complete the pair)
  const singleRanks: number[] = [];
  for (const [rank, cards] of Object.entries(byRank)) {
    if (cards.length >= 2) pairableRanks.push(Number(rank));
    else if (cards.length === 1) singleRanks.push(Number(rank));
  }
  pairableRanks.sort((a, b) => a - b);

  // Find all consecutive sequences of natural pairs
  const minPairs = current?.type === 'consecutivePairs' ? current.length / 2 : 2;
  for (let start = 0; start < pairableRanks.length; start++) {
    for (let end = start + 1; end < pairableRanks.length; end++) {
      const seq = pairableRanks.slice(start, end + 1);
      if (!isConsecutive(seq)) break;
      if (seq.length < minPairs) continue;

      const comboCards: Card[] = [];
      for (const r of seq) {
        const cards = byRank[r];
        comboCards.push(cards[0], cards[1]);
      }
      const combo = identifyCombo(comboCards);
      if (combo && (!current || canBeat(current, combo))) {
        results.push(combo);
      }
    }
  }

  // With phoenix: try sequences where one rank uses phoenix to form its pair
  if (hasPhoenix) {
    const phoenix: Card = { type: 'special', name: 'phoenix' };
    // All ranks that have at least one card (natural pairs + singles)
    const allRanks = [...new Set([...pairableRanks, ...singleRanks])].sort((a, b) => a - b);

    for (let start = 0; start < allRanks.length; start++) {
      for (let end = start + minPairs - 1; end < allRanks.length; end++) {
        const seq = allRanks.slice(start, end + 1);
        if (!isConsecutive(seq)) break;
        if (seq.length < minPairs) continue;

        // Count how many ranks need the phoenix (have only 1 card)
        const needsPhoenix = seq.filter(r => (byRank[r]?.length ?? 0) < 2);
        if (needsPhoenix.length !== 1) continue; // phoenix can only fill one slot

        const comboCards: Card[] = [];
        for (const r of seq) {
          const cards = byRank[r];
          comboCards.push(cards[0]);
          if (cards.length >= 2) {
            comboCards.push(cards[1]);
          } else {
            comboCards.push(phoenix);
          }
        }
        const combo = identifyCombo(comboCards, needsPhoenix[0] as NormalRank);
        if (combo && (!current || canBeat(current, combo))) {
          results.push(combo);
        }
      }
    }
  }
}

function addStraights(
  hand: Card[], normalCards: NormalCard[], hasPhoenix: boolean, hasMahjong: boolean,
  current: Combo | null, results: Combo[]
) {
  // Build available ranks
  const availableRanks = new Set<number>();
  for (const c of normalCards) availableRanks.add(c.rank);
  if (hasMahjong) availableRanks.add(1);

  const sortedRanks = [...availableRanks].sort((a, b) => a - b);
  const minLen = current?.type === 'straight' ? current.length : 5;

  // Find all consecutive sequences
  for (let start = 0; start < sortedRanks.length; start++) {
    for (let end = start + minLen - 1; end < sortedRanks.length; end++) {
      const seq = sortedRanks.slice(start, end + 1);
      if (!isConsecutive(seq)) break;
      if (seq.length < minLen) continue;

      // Build the cards for this straight
      const comboCards: Card[] = [];
      for (const r of seq) {
        if (r === 1 && hasMahjong) {
          comboCards.push({ type: 'special', name: 'mahjong' });
        } else {
          const card = normalCards.find(c => c.rank === r);
          if (card) comboCards.push(card);
        }
      }
      if (comboCards.length === seq.length) {
        const combo = identifyCombo(comboCards);
        if (combo && (!current || canBeat(current, combo))) {
          results.push(combo);
        }
      }
    }
  }

  // With phoenix: try filling one gap
  if (hasPhoenix) {
    for (let start = 0; start < sortedRanks.length; start++) {
      for (let end = start + minLen - 2; end < sortedRanks.length; end++) {
        const seq = sortedRanks.slice(start, end + 1);
        if (seq.length < minLen - 1) continue;

        // Check if consecutive (phoenix extends)
        if (isConsecutive(seq)) {
          const phoenix: Card = { type: 'special', name: 'phoenix' };
          const comboCards: Card[] = [phoenix];
          for (const r of seq) {
            if (r === 1 && hasMahjong) {
              comboCards.push({ type: 'special', name: 'mahjong' });
            } else {
              const card = normalCards.find(c => c.rank === r);
              if (card) comboCards.push(card);
            }
          }
          if (comboCards.length >= minLen) {
            const combo = identifyCombo(comboCards);
            if (combo && (!current || canBeat(current, combo))) {
              results.push(combo);
            }
          }
        }
      }
    }
  }
}

function addBombs(
  normalCards: NormalCard[], current: Combo | null, results: Combo[]
) {
  const byRank = groupByRank(normalCards);

  // Four of a kind bombs
  for (const [, cards] of Object.entries(byRank)) {
    if (cards.length === 4) {
      const combo = identifyCombo(cards);
      if (combo && (!current || canBeat(current, combo))) {
        results.push(combo);
      }
    }
  }

  // Straight flush bombs
  const bySuit: Record<string, NormalCard[]> = {};
  for (const c of normalCards) {
    if (!bySuit[c.suit]) bySuit[c.suit] = [];
    bySuit[c.suit].push(c);
  }

  for (const [, cards] of Object.entries(bySuit)) {
    const sorted = cards.sort((a, b) => a.rank - b.rank);
    for (let start = 0; start < sorted.length; start++) {
      for (let end = start + 4; end < sorted.length; end++) {
        const seq = sorted.slice(start, end + 1);
        const ranks = seq.map(c => c.rank);
        if (isConsecutive(ranks)) {
          const combo = identifyCombo(seq);
          if (combo && (!current || canBeat(current, combo))) {
            results.push(combo);
          }
        }
      }
    }
  }
}

function groupByRank(cards: NormalCard[]): Record<number, NormalCard[]> {
  const groups: Record<number, NormalCard[]> = {};
  for (const c of cards) {
    if (!groups[c.rank]) groups[c.rank] = [];
    groups[c.rank].push(c);
  }
  return groups;
}
