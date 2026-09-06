import { getTeamForSeat, GameSummary, RoundLog, Seat } from './types.js';

// ===== Derived statistics =====
//
// Everything on the stats page is computed from the immutable per-game history
// (`GameSummary` + its `RoundLog`s) rather than from incrementally-maintained
// counters. Counters drift whenever a write is dropped (and historically some
// were); history is the source of truth, so deriving from it keeps the numbers
// consistent with what the recent-games browser shows.
//
// All functions here are pure so they can be unit-tested without Firestore.

/** A finished game together with its round-by-round logs. */
export type GameRecord = {
  summary: GameSummary;
  rounds: RoundLog[];
};

/** Aggregate counters for one "side" (a single player, or a pairing). */
export type StatTotals = {
  gamesPlayed: number;
  gamesWon: number;
  roundsPlayed: number;
  roundsWonFirstOut: number;
  tichuCalls: number;
  tichuSuccesses: number;
  grandTichuCalls: number;
  grandTichuSuccesses: number;
  doubleVictories: number;
  totalPointDifferential: number;
  bombsPlayed: number;
  bombsFaced: number;
  closeGamesPlayed: number;
  closeGameWins: number;
  comebackOpportunities: number;
  comebackWins: number;
  roundsWhenAhead200: number;
  roundsWhenBehind200: number;
  tichuCallsWhenAhead200: number;
  tichuCallsWhenBehind200: number;
  grandCallsWhenAhead200: number;
  grandCallsWhenBehind200: number;
};

export const EMPTY_STAT_TOTALS: Readonly<StatTotals> = Object.freeze({
  gamesPlayed: 0,
  gamesWon: 0,
  roundsPlayed: 0,
  roundsWonFirstOut: 0,
  tichuCalls: 0,
  tichuSuccesses: 0,
  grandTichuCalls: 0,
  grandTichuSuccesses: 0,
  doubleVictories: 0,
  totalPointDifferential: 0,
  bombsPlayed: 0,
  bombsFaced: 0,
  closeGamesPlayed: 0,
  closeGameWins: 0,
  comebackOpportunities: 0,
  comebackWins: 0,
  roundsWhenAhead200: 0,
  roundsWhenBehind200: 0,
  tichuCallsWhenAhead200: 0,
  tichuCallsWhenBehind200: 0,
  grandCallsWhenAhead200: 0,
  grandCallsWhenBehind200: 0,
});

/** A game decided by this margin or less counts as "close". */
export const CLOSE_GAME_MARGIN = 100;
/** Being behind by at least this much at any round start is a comeback opportunity. */
export const COMEBACK_DEFICIT = 300;
/** Margin (strictly more than) for the ahead/behind call-rate breakdowns. */
export const MARGIN_BUCKET = 200;

/**
 * Which team, and which seats' players, a set of totals is about within one game.
 * `uids` are the players whose individual actions (calls, bombs, going out)
 * are credited; `team` decides wins, point differential, and margins.
 */
export type Perspective = { team: 0 | 1; uids: readonly string[] };

/** Team of `uid` in a game summary, or null if they did not play in it. */
export function teamOf(summary: GameSummary, uid: string): 0 | 1 | null {
  return summary.players.find(p => p.uid === uid)?.team ?? null;
}

/** Perspective for a single player. Null when they did not play in the game. */
export function playerPerspective(summary: GameSummary, uid: string): Perspective | null {
  const team = teamOf(summary, uid);
  return team === null ? null : { team, uids: [uid] };
}

/**
 * Perspective for a pairing. Null unless both players were in the game *and*
 * on the same team.
 */
export function pairPerspective(summary: GameSummary, uidA: string, uidB: string): Perspective | null {
  const a = teamOf(summary, uidA);
  const b = teamOf(summary, uidB);
  if (a === null || b === null || a !== b) return null;
  return { team: a, uids: [uidA, uidB] };
}

/**
 * Aggregate counters over `records` from the point of view returned by
 * `perspective`. Games for which `perspective` returns null are skipped.
 */
export function computeStatTotals(
  records: readonly GameRecord[],
  perspective: (summary: GameSummary) => Perspective | null,
): StatTotals {
  const t: StatTotals = { ...EMPTY_STAT_TOTALS };

  for (const { summary, rounds } of records) {
    const p = perspective(summary);
    if (!p) continue;
    const { team, uids } = p;
    const other: 0 | 1 = team === 0 ? 1 : 0;

    // ---- Game-level ----
    t.gamesPlayed++;
    const won = summary.winningTeam === team;
    if (won) t.gamesWon++;

    if (Math.abs(summary.finalScores[0] - summary.finalScores[1]) <= CLOSE_GAME_MARGIN) {
      t.closeGamesPlayed++;
      if (won) t.closeGameWins++;
    }

    const wasDown = rounds.some(r =>
      r.scoresBeforeRound[team] - r.scoresBeforeRound[other] <= -COMEBACK_DEFICIT);
    if (wasDown) {
      t.comebackOpportunities++;
      if (won) t.comebackWins++;
    }

    // ---- Round-level ----
    for (const r of rounds) {
      // The seats our players actually occupied this round (a substitute may
      // have taken over a seat mid-game, so trust the round log, not the summary).
      const mine = r.players.filter(pl => pl.uid !== null && uids.includes(pl.uid) && pl.team === team);
      if (mine.length === 0) continue;

      t.roundsPlayed++;

      const margin = r.scoresBeforeRound[team] - r.scoresBeforeRound[other];
      const ahead = margin > MARGIN_BUCKET;
      const behind = margin < -MARGIN_BUCKET;
      if (ahead) t.roundsWhenAhead200++;
      if (behind) t.roundsWhenBehind200++;

      for (const pl of mine) {
        const made = pl.outOrder === 1;
        if (made) t.roundsWonFirstOut++;
        if (pl.tichuCall === 'small') {
          t.tichuCalls++;
          if (made) t.tichuSuccesses++;
          if (ahead) t.tichuCallsWhenAhead200++;
          if (behind) t.tichuCallsWhenBehind200++;
        } else if (pl.tichuCall === 'grand') {
          t.grandTichuCalls++;
          if (made) t.grandTichuSuccesses++;
          if (ahead) t.grandCallsWhenAhead200++;
          if (behind) t.grandCallsWhenBehind200++;
        }
      }

      if (r.isDoubleVictory && r.outOrder.length > 0 && getTeamForSeat(r.outOrder[0]) === team) {
        t.doubleVictories++;
      }

      const ours = r.roundCardPoints[team] + r.tichuBonuses[team];
      const theirs = r.roundCardPoints[other] + r.tichuBonuses[other];
      t.totalPointDifferential += ours - theirs;

      const mySeats = new Set<Seat>(mine.map(pl => pl.seat));
      for (const b of r.bombs) {
        if (mySeats.has(b.seat)) t.bombsPlayed++;
        else if (getTeamForSeat(b.seat) !== team) t.bombsFaced++;
      }
    }
  }

  return t;
}

/** Stats for a single player across every game they finished. */
export function computePlayerStats(records: readonly GameRecord[], uid: string): StatTotals {
  return computeStatTotals(records, s => playerPerspective(s, uid));
}

// ===== Partners =====

/** One row of the "By Partner" list. */
export type PartnerSummary = {
  partnerUid: string;
  /** Pairing record (games where the two were on the same team). */
  gamesPlayed: number;
  gamesWon: number;
  roundsPlayed: number;
  /** The partner's own calls while partnered with this player. */
  partnerTichuCalls: number;
  partnerTichuSuccesses: number;
  partnerGrandCalls: number;
  partnerGrandSuccesses: number;
  /** Rounds the partner played in those games (denominator for their call rate). */
  partnerRounds: number;
};

/**
 * Per-partner summaries for `uid`, sorted by games played (desc), then rounds.
 * Only pairings with at least one finished game appear.
 */
export function computePartnerSummaries(records: readonly GameRecord[], uid: string): PartnerSummary[] {
  const partnerUids = new Set<string>();
  for (const { summary } of records) {
    const team = teamOf(summary, uid);
    if (team === null) continue;
    for (const p of summary.players) {
      if (p.uid && p.uid !== uid && p.team === team) partnerUids.add(p.uid);
    }
  }

  const rows: PartnerSummary[] = [];
  for (const partnerUid of partnerUids) {
    const together = records.filter(r => pairPerspective(r.summary, uid, partnerUid) !== null);
    const pair = computeStatTotals(together, s => pairPerspective(s, uid, partnerUid));
    const partner = computeStatTotals(together, s => playerPerspective(s, partnerUid));
    rows.push({
      partnerUid,
      gamesPlayed: pair.gamesPlayed,
      gamesWon: pair.gamesWon,
      roundsPlayed: pair.roundsPlayed,
      partnerTichuCalls: partner.tichuCalls,
      partnerTichuSuccesses: partner.tichuSuccesses,
      partnerGrandCalls: partner.grandTichuCalls,
      partnerGrandSuccesses: partner.grandTichuSuccesses,
      partnerRounds: partner.roundsPlayed,
    });
  }

  return rows.sort((a, b) => b.gamesPlayed - a.gamesPlayed || b.roundsPlayed - a.roundsPlayed);
}

// ===== Pairing detail =====

/** Record against one opposing pairing. */
export type OpponentRecord = {
  uids: string[];      // sorted; may include fewer than 2 when an opponent was a guest
  names: string;       // "A + B" as seated in the most recent game
  gamesPlayed: number;
  gamesWon: number;    // wins by *our* pairing
};

/** Everything the pairing detail view needs, minus display names and Elo. */
export type PairingBreakdown = {
  uids: [string, string];
  totals: StatTotals;
  perPlayer: [StatTotals, StatTotals]; // same order as `uids`
  opponents: OpponentRecord[];
  games: GameSummary[];               // newest first
};

/**
 * Full breakdown of a pairing: combined totals, each partner's individual
 * totals within those games, records against each opposing pairing, and the
 * games themselves.
 */
export function computePairingBreakdown(
  records: readonly GameRecord[],
  uidA: string,
  uidB: string,
): PairingBreakdown {
  const together = records.filter(r => pairPerspective(r.summary, uidA, uidB) !== null);
  const totals = computeStatTotals(together, s => pairPerspective(s, uidA, uidB));
  const perPlayer: [StatTotals, StatTotals] = [
    computeStatTotals(together, s => playerPerspective(s, uidA)),
    computeStatTotals(together, s => playerPerspective(s, uidB)),
  ];

  const games = together
    .map(r => r.summary)
    .sort((a, b) => b.finishedAt - a.finishedAt);

  const opponents = new Map<string, OpponentRecord>();
  for (const summary of games) {
    const team = teamOf(summary, uidA)!;
    const opp = summary.players
      .filter(p => p.team !== team)
      .sort((a, b) => a.seat - b.seat);
    const uids = opp.map(p => p.uid).filter((u): u is string => !!u).sort();
    // A guest opponent has no uid; fall back to names so the pairing is still
    // distinguishable (but such keys won't merge across the guest's sessions).
    const key = uids.length === 2 ? uids.join('|') : opp.map(p => p.uid ?? `name:${p.name}`).join('|');
    let rec = opponents.get(key);
    if (!rec) {
      // `games` is newest-first, so the first sighting carries the latest names.
      rec = { uids, names: opp.map(p => p.name).join(' + '), gamesPlayed: 0, gamesWon: 0 };
      opponents.set(key, rec);
    }
    rec.gamesPlayed++;
    if (summary.winningTeam === team) rec.gamesWon++;
  }

  return {
    uids: [uidA, uidB],
    totals,
    perPlayer,
    opponents: [...opponents.values()].sort((a, b) => b.gamesPlayed - a.gamesPlayed),
    games,
  };
}

// ===== Wire types (server -> client) =====

/** One row of the "By Partner" list, with display info and pairing Elo attached. */
export type PartnerStats = PartnerSummary & {
  partnerName: string;
  partnerPhoto: string | null;
  teamElo: number | null;      // pairing Elo (null if the pair has no rated games yet)
  teamEloGames: number;        // rated games behind that Elo
  teamEloPeak: number | null;
};

export type PairingPlayer = { uid: string; name: string; photoURL: string | null };

/** The pairing detail view. `players` is in the same order as `uids`/`perPlayer`. */
export type TeamStats = PairingBreakdown & {
  players: [PairingPlayer, PairingPlayer];
  teamElo: number | null;
  teamEloGames: number;
  teamEloPeak: number | null;
};

/** Per-player stats as shown on the stats page: derived totals plus Elo. */
export type UserStats = StatTotals & {
  elo: number;
  eloGames: number;
  eloPeak: number;
};
