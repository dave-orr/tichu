import { Card, GameState, Player, RoundResult, Seat, getTeamForSeat } from './types.js';

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
