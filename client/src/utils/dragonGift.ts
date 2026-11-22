import { getTeamForSeat, type ClientGameState, type Seat } from '@tichu/shared';

/**
 * Detect a Dragon trick being handed to an opponent between two states.
 *
 * Usually the giveaway is a separate step: the trick waits on the table with
 * `dragonGiveaway` set until the Dragon player picks a recipient. When an
 * opponent went out first the server gives it automatically, so the trick goes
 * straight from the table (Dragon on top) to the receiver with no pending
 * step. The receiver is the opponent whose trick count went up.
 */
export function detectDragonGift(
  prev: ClientGameState,
  next: ClientGameState,
): { giver: Seat; receiver: Seat } | null {
  let giver: Seat | null = null;
  if (prev.dragonGiveaway && !next.dragonGiveaway) {
    giver = prev.dragonGiveawayBy;
  } else if (
    !prev.dragonGiveaway && !next.dragonGiveaway
    && prev.currentTrickPlays.length > 0 && next.currentTrickPlays.length === 0
    && prev.currentTrick?.cards.some(c => c.type === 'special' && c.name === 'dragon')
  ) {
    giver = prev.lastPlayedBy;
  }
  if (giver == null) return null;
  const giverTeam = getTeamForSeat(giver);
  const receiverIdx = next.players.findIndex((p, i) =>
    p.trickCount > prev.players[i].trickCount && getTeamForSeat(i as Seat) !== giverTeam);
  if (receiverIdx < 0) return null;
  return { giver, receiver: receiverIdx as Seat };
}
