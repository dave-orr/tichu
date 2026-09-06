import { GameSummary, GameSummaryPlayer, RoundLog, RoundLogPlayerEntry, Seat } from './types.js';
import { isGameOver } from './scoring.js';

// ===== History repair =====
//
// Pure helpers behind `server/src/scripts/repairHistory.ts`. They never touch
// Firestore; the script decides what to read and write. Kept in shared/ so
// they can be unit-tested.

/**
 * Rebuild the top-level summary of a game from its round logs, for games that
 * finished before summaries were being written. Returns null when the logs
 * don't show a finished game (never reached `targetScore`, or tied there).
 */
export function reconstructSummary(
  gameId: string,
  rounds: readonly RoundLog[],
  targetScore = 1000,
): GameSummary | null {
  if (rounds.length === 0) return null;
  const ordered = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  const last = ordered[ordered.length - 1];
  const finalScores = last.scoresAfterRound;
  if (!isGameOver(finalScores, targetScore)) return null;

  const players: GameSummaryPlayer[] = [...last.players]
    .sort((a, b) => a.seat - b.seat)
    .map(p => ({ seat: p.seat, uid: p.uid, name: p.name, team: p.team }));

  return {
    gameId,
    finishedAt: last.timestamp,
    players,
    finalScores,
    winningTeam: finalScores[0] > finalScores[1] ? 0 : 1,
    rounds: ordered.length,
  };
}

/** An explicit "this guest seat was really this account" instruction. */
export type SeatAttribution = { gameId: string; seat: Seat; uid: string };

/** One uid filled in by `repairUids`. `roundNumber` is 0 for the summary. */
export type UidFill = {
  roundNumber: number;
  seat: Seat;
  name: string;
  uid: string;
  reason: 'continuity' | 'attribution';
};

export type UidRepair = {
  rounds: RoundLog[];
  summary: GameSummary | null;
  fills: UidFill[];
};

/**
 * Fill missing uids in a game's round logs and summary.
 *
 * Two sources, in priority order:
 *  1. `attributions` for this game: a seat named explicitly gets that uid
 *     wherever it currently has none.
 *  2. Continuity: a seat that carries the same display name with a uid in some
 *     rounds and no uid in others (the player dropped and rejoined as a guest,
 *     or was disconnected when the round was logged) gets the same uid. A name
 *     seen with two different uids in the same seat is ambiguous and left alone.
 *
 * Entries that already have a uid are never changed.
 */
export function repairUids(
  gameId: string,
  rounds: readonly RoundLog[],
  summary: GameSummary | null,
  attributions: readonly SeatAttribution[] = [],
): UidRepair {
  const explicit = new Map<Seat, string>();
  for (const a of attributions) if (a.gameId === gameId) explicit.set(a.seat, a.uid);

  // seat|name -> uid, or null once two different uids have been seen.
  const known = new Map<string, string | null>();
  const learn = (seat: Seat, name: string, uid: string | null) => {
    if (!uid) return;
    const key = `${seat}|${name}`;
    const prev = known.get(key);
    if (prev === undefined) known.set(key, uid);
    else if (prev !== null && prev !== uid) known.set(key, null);
  };
  for (const r of rounds) for (const p of r.players) learn(p.seat, p.name, p.uid);
  if (summary) for (const p of summary.players) learn(p.seat, p.name, p.uid);

  const fills: UidFill[] = [];
  const resolve = <T extends { seat: Seat; name: string; uid: string | null }>(entry: T, roundNumber: number): T => {
    if (entry.uid) return entry;
    const fromExplicit = explicit.get(entry.seat);
    if (fromExplicit) {
      fills.push({ roundNumber, seat: entry.seat, name: entry.name, uid: fromExplicit, reason: 'attribution' });
      return { ...entry, uid: fromExplicit };
    }
    const fromContinuity = known.get(`${entry.seat}|${entry.name}`);
    if (fromContinuity) {
      fills.push({ roundNumber, seat: entry.seat, name: entry.name, uid: fromContinuity, reason: 'continuity' });
      return { ...entry, uid: fromContinuity };
    }
    return entry;
  };

  const repairedRounds = rounds.map(r => ({
    ...r,
    players: r.players.map((p: RoundLogPlayerEntry) => resolve(p, r.roundNumber)),
  }));
  const repairedSummary = summary
    ? { ...summary, players: summary.players.map(p => resolve(p, 0)) }
    : null;

  return { rounds: repairedRounds, summary: repairedSummary, fills };
}
