import { Card, GameState, PointCardGroup, RoundResult, Seat, getTeamForSeat } from './types.js';

/** Get the point value of a single card */
export function cardPoints(card: Card): number {
  if (card.type === 'special') {
    switch (card.name) {
      case 'dragon': return 25;
      case 'phoenix': return -25;
      default: return 0;
    }
  }
  switch (card.rank) {
    case 5: return 5;
    case 10: return 10;
    case 13: return 10; // Kings
    default: return 0;
  }
}

/** Sum points from a collection of cards */
export function sumPoints(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + cardPoints(c), 0);
}

/** True for a card that scores (5, 10, King, Dragon, Phoenix). */
export function isPointCard(card: Card): boolean {
  return cardPoints(card) !== 0;
}

// Display order inside a group: Kings, 10s, 5s, then Dragon and Phoenix.
function pointCardOrder(card: Card): number {
  if (card.type === 'special') return card.name === 'dragon' ? 3 : 4;
  return card.rank === 13 ? 0 : card.rank === 10 ? 1 : 2;
}

/** A trick that ended with the Dragon on top was won by the Dragon and handed
 *  to an opponent (a bombed Dragon trick ends with the bomb). */
function isDragonGift(trick: Card[]): boolean {
  const top = trick[trick.length - 1];
  return top?.type === 'special' && top.name === 'dragon';
}

/**
 * Where every point card ended up, grouped by why it counts for that team:
 * tricks a seat won, Dragon tricks gifted to it, the last player's tricks
 * (to first out) and cards left in hand (to the opponents). Groups with no
 * point cards are left out; each team's group points sum to its card points.
 * Empty on a double victory, where card points aren't counted.
 */
export function pointCardBreakdown(
  players: GameState['players'],
  firstOut: Seat,
  lastPlayer: Seat,
): PointCardGroup[] {
  const groups: PointCardGroup[] = [];
  const add = (group: Omit<PointCardGroup, 'cards' | 'points'>, cards: Card[]) => {
    const scoring = cards.filter(isPointCard).sort((a, b) => pointCardOrder(a) - pointCardOrder(b));
    if (scoring.length > 0) groups.push({ ...group, cards: scoring, points: sumPoints(scoring) });
  };

  for (const player of players) {
    if (player.seat === lastPlayer) continue;
    const team = getTeamForSeat(player.seat);
    add({ team, seat: player.seat, source: 'won' },
      player.tricksWon.filter(t => !isDragonGift(t)).flat());
    add({ team, seat: player.seat, source: 'dragon' },
      player.tricksWon.filter(isDragonGift).flat());
  }
  add({ team: getTeamForSeat(firstOut), seat: firstOut, source: 'lastTricks', from: lastPlayer },
    players[lastPlayer].tricksWon.flat());
  const handTeam = (1 - getTeamForSeat(lastPlayer)) as 0 | 1;
  for (const player of players) {
    add({ team: handTeam, seat: null, source: 'lastHand', from: player.seat }, player.hand);
  }
  return groups;
}

/** Calculate the result of a completed round */
export function scoreRound(state: GameState): RoundResult {
  const players = state.players;

  // Determine out order (outOrder=0 means never went out, sort those last)
  const outOrder = [...players]
    .sort((a, b) => {
      if (a.outOrder === 0 && b.outOrder === 0) return 0;
      if (a.outOrder === 0) return 1;
      if (b.outOrder === 0) return -1;
      return a.outOrder - b.outOrder;
    })
    .map(p => p.seat) as [Seat, Seat, Seat, Seat];

  const firstOut = outOrder[0];
  const secondOut = outOrder[1];
  const lastPlayer = outOrder[3]; // player who still had cards (outOrder = 0 means not out yet, but at round end they're forced)

  // Check for 1-2 finish (double victory)
  const firstTeam = getTeamForSeat(firstOut);
  const secondTeam = getTeamForSeat(secondOut);
  const isDoubleVictory = firstTeam === secondTeam;

  let teamScores: [number, number] = [0, 0];

  if (isDoubleVictory) {
    teamScores[firstTeam] = 200;
    teamScores[1 - firstTeam as 0 | 1] = 0;
  } else {
    // Normal scoring:
    // - Last player's hand cards go to opposing team
    // - Last player's tricks go to first-out player

    // Count tricks for each team
    for (const player of players) {
      const team = getTeamForSeat(player.seat);

      if (player.seat === lastPlayer) {
        // Last player's tricks go to the first-out player
        const firstOutTeam = getTeamForSeat(firstOut);
        for (const trick of player.tricksWon) {
          teamScores[firstOutTeam] += sumPoints(trick);
        }
      } else {
        for (const trick of player.tricksWon) {
          teamScores[team] += sumPoints(trick);
        }
      }

      // Any remaining hand cards go to the last player's opposing team
      // (normally only the last player has cards, but on concede others may too)
      if (player.hand.length > 0) {
        const lastPlayerTeam = getTeamForSeat(lastPlayer);
        const receivingTeam = (1 - lastPlayerTeam) as 0 | 1;
        teamScores[receivingTeam] += sumPoints(player.hand);
      }
    }
  }

  // Calculate Tichu bonuses
  const tichuBonuses: [number, number] = [0, 0];
  for (const player of players) {
    const team = getTeamForSeat(player.seat);
    if (player.tichuCall === 'grand') {
      tichuBonuses[team] += player.outOrder === 1 ? 200 : -200;
    } else if (player.tichuCall === 'small') {
      tichuBonuses[team] += player.outOrder === 1 ? 100 : -100;
    }
  }

  const totalScores: [number, number] = [
    state.teams[0].score + teamScores[0] + tichuBonuses[0],
    state.teams[1].score + teamScores[1] + tichuBonuses[1],
  ];

  return {
    teamScores,
    tichuBonuses,
    isDoubleVictory,
    doubleVictoryTeam: isDoubleVictory ? firstTeam : undefined,
    totalScores,
    outOrder,
    pointCards: isDoubleVictory ? [] : pointCardBreakdown(players, firstOut, lastPlayer),
  };
}

/** Check if the game is over (a team has >= target score) */
export function isGameOver(scores: [number, number], targetScore: number = 1000): boolean {
  return (scores[0] >= targetScore || scores[1] >= targetScore) && scores[0] !== scores[1];
}

/** Get the winning team index, or null if game not over */
export function getWinner(scores: [number, number], targetScore: number = 1000): 0 | 1 | null {
  if (!isGameOver(scores, targetScore)) return null;
  return scores[0] > scores[1] ? 0 : 1;
}
