import {
  GameState, Seat, getTeamForSeat, RoundResult, RoundLog, RoundLogPlayerEntry, PartnerStats,
  RoomElos, EloUpdate, ELO_INITIAL, eloExpected, eloKFactor,
  GameSummary, GameSummaryPlayer, GameHistoryRound, HeadToHead,
  GameRecord, UserStats, TeamStats, PairingPlayer, EMPTY_STAT_TOTALS,
  computePlayerStats, computePartnerSummaries, computePairingBreakdown,
} from '@tichu/shared';
import { firebaseAdmin } from './firebase.js';
import { Room } from './rooms.js';

const inc = (n: number) => firebaseAdmin!.firestore.FieldValue.increment(n);
const arrayUnion = (...elements: string[]) => firebaseAdmin!.firestore.FieldValue.arrayUnion(...elements);

export async function updateStatsForRound(
  room: Room,
  roundResult: RoundResult,
): Promise<void> {
  if (!firebaseAdmin) return;
  const db = firebaseAdmin.firestore();
  const batch = db.batch();

  const state = room.state;
  const acc = room.accumulator;
  const uidMap = buildUidMap(room);
  if (uidMap.size === 0) return;

  // Compute round point differential per team (card points + bonuses)
  const teamRoundTotal: [number, number] = [
    roundResult.teamScores[0] + roundResult.tichuBonuses[0],
    roundResult.teamScores[1] + roundResult.tichuBonuses[1],
  ];

  // Double victory check (shared across players)
  const outOrder = state.players
    .filter(p => p.outOrder > 0)
    .sort((a, b) => a.outOrder - b.outOrder);
  const isDoubleVictory = outOrder.length >= 2 &&
    getTeamForSeat(outOrder[0].seat) === getTeamForSeat(outOrder[1].seat);
  const doubleVictoryTeam = isDoubleVictory ? getTeamForSeat(outOrder[0].seat) : null;

  for (const [uid, seat] of uidMap) {
    const docRef = db.collection('users').doc(uid);
    const player = state.players[seat];
    const team = getTeamForSeat(seat);
    const otherTeam = team === 0 ? 1 : 0;

    const updates: Record<string, FirebaseFirestore.FieldValue> = {
      'stats.roundsPlayed': inc(1),
    };

    if (player.outOrder === 1) {
      updates['stats.roundsWonFirstOut'] = inc(1);
    }

    const scoreDiff = acc.scoresAtRoundStart[team] - acc.scoresAtRoundStart[otherTeam];
    const ahead200 = scoreDiff > 200;
    const behind200 = scoreDiff < -200;
    if (ahead200) updates['stats.roundsWhenAhead200'] = inc(1);
    if (behind200) updates['stats.roundsWhenBehind200'] = inc(1);

    // Tichu call tracking
    if (player.tichuCall === 'small') {
      updates['stats.tichuCalls'] = inc(1);
      if (player.outOrder === 1) {
        updates['stats.tichuSuccesses'] = inc(1);
      }
      if (ahead200) updates['stats.tichuCallsWhenAhead200'] = inc(1);
      if (behind200) updates['stats.tichuCallsWhenBehind200'] = inc(1);
    } else if (player.tichuCall === 'grand') {
      updates['stats.grandTichuCalls'] = inc(1);
      if (player.outOrder === 1) {
        updates['stats.grandTichuSuccesses'] = inc(1);
      }
      if (ahead200) updates['stats.grandCallsWhenAhead200'] = inc(1);
      if (behind200) updates['stats.grandCallsWhenBehind200'] = inc(1);
    }

    // Double victory
    if (doubleVictoryTeam === team) {
      updates['stats.doubleVictories'] = inc(1);
    }

    // Point differential
    const diff = teamRoundTotal[team] - teamRoundTotal[otherTeam];
    updates['stats.totalPointDifferential'] = inc(diff);

    // Bombs
    const playerBombs = acc.bombs.filter(b => b.seat === seat).length;
    if (playerBombs > 0) {
      updates['stats.bombsPlayed'] = inc(playerBombs);
    }
    const opponentBombs = acc.bombs.filter(b => getTeamForSeat(b.seat) !== team).length;
    if (opponentBombs > 0) {
      updates['stats.bombsFaced'] = inc(opponentBombs);
    }

    // Track who this player has played with (all other authenticated players)
    const otherUids = [...uidMap.keys()].filter(u => u !== uid);
    if (otherUids.length > 0) {
      updates['playedWith'] = arrayUnion(...otherUids);
    }

    // set+merge (not update) so the doc is created if the player never triggered
    // load-profile — otherwise update() throws NOT_FOUND and fails the whole batch,
    // silently dropping this round's stats for every player.
    batch.set(docRef, updates, { merge: true });
  }

  await batch.commit();
}

export async function updateStatsForGameEnd(
  room: Room,
  roundResult: RoundResult,
): Promise<void> {
  if (!firebaseAdmin) return;
  const db = firebaseAdmin.firestore();
  const batch = db.batch();

  const state = room.state;
  const acc = room.accumulator;
  const uidMap = buildUidMap(room);
  if (uidMap.size === 0) return;

  const team0Score = state.teams[0].score;
  const team1Score = state.teams[1].score;
  // null on a tie so neither team is credited a win (the game-over gate currently
  // prevents ties from reaching here, but don't bake that invariant in).
  const winningTeam: 0 | 1 | null =
    team0Score === team1Score ? null : team0Score > team1Score ? 0 : 1;
  const scoreDiff = Math.abs(team0Score - team1Score);
  const isCloseGame = scoreDiff <= 100;

  for (const [uid, seat] of uidMap) {
    const docRef = db.collection('users').doc(uid);
    const team = getTeamForSeat(seat);

    const updates: Record<string, FirebaseFirestore.FieldValue> = {
      'stats.gamesPlayed': inc(1),
    };

    if (team === winningTeam) {
      updates['stats.gamesWon'] = inc(1);
    }

    // Close game tracking
    if (isCloseGame) {
      updates['stats.closeGamesPlayed'] = inc(1);
      if (team === winningTeam) {
        updates['stats.closeGameWins'] = inc(1);
      }
    }

    // Comeback tracking
    if (acc.wasDown300[team]) {
      updates['stats.comebackOpportunities'] = inc(1);
      if (team === winningTeam) {
        updates['stats.comebackWins'] = inc(1);
      }
    }

    // set+merge (not update) so a never-loaded user doc is created instead of
    // throwing NOT_FOUND and failing the whole batch.
    batch.set(docRef, updates, { merge: true });
  }

  await batch.commit();
}

export async function updateTeamStats(
  room: Room,
  roundResult: RoundResult,
  isGameEnd: boolean,
): Promise<void> {
  if (!firebaseAdmin) return;
  const db = firebaseAdmin.firestore();
  const batch = db.batch();

  const state = room.state;
  const acc = room.accumulator;
  const uidMap = buildUidMap(room);

  // Build team UID pairs (only for teams where both players are authenticated)
  for (const teamIdx of [0, 1] as const) {
    const seats = state.teams[teamIdx].players;
    const uids: string[] = [];
    for (const s of seats) {
      const uid = room.seatUids.get(s);
      if (uid) uids.push(uid);
    }
    if (uids.length !== 2) continue;

    const teamKey = uids.sort().join('_');
    const docRef = db.collection('teams').doc(teamKey);
    const otherTeam = teamIdx === 0 ? 1 : 0;

    const teamRoundTotal: [number, number] = [
      roundResult.teamScores[0] + roundResult.tichuBonuses[0],
      roundResult.teamScores[1] + roundResult.tichuBonuses[1],
    ];
    const diff = teamRoundTotal[teamIdx] - teamRoundTotal[otherTeam];

    const updates: Record<string, FirebaseFirestore.FieldValue | string[]> = {
      playerUids: uids,
      'stats.roundsPlayed': inc(1),
      'stats.totalPointDifferential': inc(diff),
    };

    // Double victory
    const outOrder = state.players
      .filter(p => p.outOrder > 0)
      .sort((a, b) => a.outOrder - b.outOrder);
    if (outOrder.length >= 2 &&
      getTeamForSeat(outOrder[0].seat) === teamIdx &&
      getTeamForSeat(outOrder[1].seat) === teamIdx) {
      updates['stats.doubleVictories'] = inc(1);
    }

    // Team-level bomb stats
    const teamBombs = acc.bombs.filter(b => getTeamForSeat(b.seat) === teamIdx).length;
    if (teamBombs > 0) updates['stats.bombsPlayed'] = inc(teamBombs);
    const oppBombs = acc.bombs.filter(b => getTeamForSeat(b.seat) !== teamIdx).length;
    if (oppBombs > 0) updates['stats.bombsFaced'] = inc(oppBombs);

    // Per-player breakdown within team
    for (const s of seats) {
      const uid = room.seatUids.get(s);
      if (!uid) continue;
      const player = state.players[s];

      if (player.tichuCall === 'small') {
        updates[`breakdown.${uid}.tichuCalls`] = inc(1);
        if (player.outOrder === 1) {
          updates[`breakdown.${uid}.tichuSuccesses`] = inc(1);
        }
      } else if (player.tichuCall === 'grand') {
        updates[`breakdown.${uid}.grandTichuCalls`] = inc(1);
        if (player.outOrder === 1) {
          updates[`breakdown.${uid}.grandTichuSuccesses`] = inc(1);
        }
      }
      if (player.outOrder === 1) {
        updates[`breakdown.${uid}.roundsWonFirstOut`] = inc(1);
      }
      const playerBombs = acc.bombs.filter(b => b.seat === s).length;
      if (playerBombs > 0) {
        updates[`breakdown.${uid}.bombsPlayed`] = inc(playerBombs);
      }
    }

    // Game-end stats
    if (isGameEnd) {
      // null on a tie so neither team is credited a win.
      const winningTeam: 0 | 1 | null =
        state.teams[0].score === state.teams[1].score
          ? null
          : state.teams[0].score > state.teams[1].score ? 0 : 1;
      updates['stats.gamesPlayed'] = inc(1);
      if (teamIdx === winningTeam) {
        updates['stats.gamesWon'] = inc(1);
      }
    }

    // Use set with merge to create doc if it doesn't exist
    batch.set(docRef, updates, { merge: true });
  }

  await batch.commit();
}

export async function saveRoundLog(
  room: Room,
  roundResult: RoundResult,
): Promise<void> {
  if (!firebaseAdmin) return;
  const db = firebaseAdmin.firestore();

  const state = room.state;
  const acc = room.accumulator;

  const players: RoundLogPlayerEntry[] = state.players.map(p => {
    const uid = room.seatUids.get(p.seat) ?? null;
    const pass = acc.passes.get(p.seat);
    return {
      seat: p.seat,
      uid,
      name: p.name,
      team: getTeamForSeat(p.seat),
      tichuCall: p.tichuCall,
      outOrder: p.outOrder,
      initialHand: acc.initialHands.get(p.seat) ?? [],
      passedLeft: pass?.left ?? null,
      passedPartner: pass?.partner ?? null,
      passedRight: pass?.right ?? null,
    };
  });

  const log: RoundLog = {
    gameId: acc.gameId,
    roundNumber: state.roundNumber,
    timestamp: Date.now(),
    scoresBeforeRound: acc.scoresAtRoundStart,
    scoresAfterRound: roundResult.totalScores,
    roundCardPoints: roundResult.teamScores,
    tichuBonuses: roundResult.tichuBonuses,
    isDoubleVictory: roundResult.isDoubleVictory,
    outOrder: [...roundResult.outOrder],
    players,
    bombs: acc.bombs,
    dragonGiveaways: acc.dragonGiveaways,
    mahJongWishes: acc.mahJongWishes,
  };

  await db
    .collection('games')
    .doc(acc.gameId)
    .collection('rounds')
    .doc(String(state.roundNumber))
    .set(log);
}

/**
 * Write the top-level summary doc for a finished game (players, final scores,
 * winner). `playerUids` lets us list a user's recent games via array-contains.
 * Call once, when the game ends.
 */
export async function saveGameSummary(room: Room): Promise<void> {
  if (!firebaseAdmin) return;
  const db = firebaseAdmin.firestore();
  const state = room.state;
  const acc = room.accumulator;

  const players: GameSummaryPlayer[] = state.players.map(p => {
    const uid = room.seatUids.get(p.seat) ?? null;
    return { seat: p.seat, uid, name: p.name, team: getTeamForSeat(p.seat) };
  });
  const playerUids = players.map(p => p.uid).filter((u): u is string => !!u);
  if (playerUids.length === 0) return; // nothing to surface to any user

  const finalScores: [number, number] = [state.teams[0].score, state.teams[1].score];
  const winningTeam: 0 | 1 | null =
    finalScores[0] === finalScores[1] ? null : finalScores[0] > finalScores[1] ? 0 : 1;

  const summary: GameSummary = {
    gameId: acc.gameId,
    finishedAt: Date.now(),
    players,
    finalScores,
    winningTeam,
    rounds: state.roundNumber,
  };

  // playerUids is stored alongside the summary purely for querying.
  await db.collection('games').doc(acc.gameId).set({ ...summary, playerUids }, { merge: true });
}

/**
 * Historical record between the two pairings currently seated in the room,
 * from finished-game summaries. Wins are indexed by the room's current team
 * numbering (0 = seats 0&2) regardless of which side each pairing sat on in
 * past games. Null when any seat is unauthenticated (pairings can't be
 * identified) or Firebase is unavailable.
 */
export async function fetchHeadToHead(room: Room): Promise<HeadToHead | null> {
  if (!firebaseAdmin) return null;
  const pairKey = (uids: (string | undefined | null)[]) =>
    uids.every((u): u is string => !!u) ? [...uids].sort().join('|') : null;
  const ourTeam0 = pairKey([room.seatUids.get(0), room.seatUids.get(2)]);
  const ourTeam1 = pairKey([room.seatUids.get(1), room.seatUids.get(3)]);
  if (!ourTeam0 || !ourTeam1) return null;

  const db = firebaseAdmin.firestore();
  const anyUid = room.seatUids.get(0)!;
  const snap = await db.collection('games').where('playerUids', 'array-contains', anyUid).get();

  const wins: [number, number] = [0, 0];
  let games = 0;
  for (const doc of snap.docs) {
    const g = doc.data() as GameSummary;
    const gameTeam0 = pairKey(g.players.filter(p => p.team === 0).map(p => p.uid));
    const gameTeam1 = pairKey(g.players.filter(p => p.team === 1).map(p => p.uid));
    // Match the game's pairings to ours in either orientation.
    let winnerAsOurs: 0 | 1 | null;
    if (gameTeam0 === ourTeam0 && gameTeam1 === ourTeam1) {
      winnerAsOurs = g.winningTeam ?? null;
    } else if (gameTeam0 === ourTeam1 && gameTeam1 === ourTeam0) {
      winnerAsOurs = g.winningTeam == null ? null : g.winningTeam === 0 ? 1 : 0;
    } else {
      continue;
    }
    games++;
    if (winnerAsOurs !== null) wins[winnerAsOurs]++;
  }
  return { games, wins };
}

/** The most recent finished games this user took part in (newest first, max 10). */
export async function fetchRecentGames(uid: string): Promise<GameSummary[]> {
  if (!firebaseAdmin) return [];
  const db = firebaseAdmin.firestore();
  // array-contains alone needs no composite index; sort/slice in memory.
  const snap = await db.collection('games').where('playerUids', 'array-contains', uid).get();
  return snap.docs
    .map(d => toSummary(d.data()))
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, 10);
}

/**
 * Round-by-round history for a single game, but only if the requesting user
 * actually played in it (privacy gate). Returns null when not permitted/found.
 */
export async function fetchGameHistory(uid: string, gameId: string): Promise<GameHistoryRound[] | null> {
  if (!firebaseAdmin) return null;
  const db = firebaseAdmin.firestore();

  const gameDoc = await db.collection('games').doc(gameId).get();
  const data = gameDoc.data();
  const playerUids: string[] = data?.playerUids ?? [];
  if (!data || !playerUids.includes(uid)) return null;

  const rounds = await loadRounds(db, gameId);

  return rounds.map(r => ({
    roundNumber: r.roundNumber,
    scoresAfterRound: r.scoresAfterRound,
    roundCardPoints: r.roundCardPoints,
    tichuBonuses: r.tichuBonuses,
    isDoubleVictory: r.isDoubleVictory,
    calls: r.players
      .filter(p => p.tichuCall !== 'none')
      .map(p => ({ seat: p.seat, name: p.name, team: p.team, tichuCall: p.tichuCall, made: p.outOrder === 1 })),
  }));
}

// ===== Elo ratings =====

/**
 * Map of seat -> authenticated uid (humans only; AI / anonymous seats excluded).
 * Reads the room's persistent seat->uid map rather than live sockets, so a
 * player who is momentarily disconnected at game end (or a game ending right
 * after a server restart) is still attributed instead of being silently
 * dropped from rating / stats.
 */
function buildSeatUidMap(room: Room): Map<Seat, string> {
  return new Map(room.seatUids ?? []);
}

/** Sorted "_"-joined doc key for a team's pairing, or null unless both seats are authenticated. */
function teamKeyForSeats(seatUids: Map<Seat, string>, seats: readonly [Seat, Seat]): string | null {
  const uids = seats.map(s => seatUids.get(s)).filter((u): u is string => !!u);
  if (uids.length !== 2) return null;
  return [...uids].sort().join('_');
}

/** Read current individual + pairing Elo for everyone seated in a room (for team selection). */
export async function fetchRoomElos(room: Room): Promise<RoomElos> {
  const seatElos: (number | null)[] = [null, null, null, null];
  const teamElos: [number | null, number | null] = [null, null];
  if (!firebaseAdmin) return { seatElos, teamElos };
  const db = firebaseAdmin.firestore();

  const seatUids = buildSeatUidMap(room);

  await Promise.all([...seatUids].map(async ([seat, uid]) => {
    const snap = await db.collection('users').doc(uid).get();
    const elo = snap.data()?.stats?.elo;
    seatElos[seat] = typeof elo === 'number' ? elo : ELO_INITIAL;
  }));

  await Promise.all(([0, 1] as const).map(async teamIdx => {
    const key = teamKeyForSeats(seatUids, room.state.teams[teamIdx].players);
    if (!key) return;
    const snap = await db.collection('teams').doc(key).get();
    const elo = snap.data()?.stats?.elo;
    teamElos[teamIdx] = typeof elo === 'number' ? elo : ELO_INITIAL;
  }));

  return { seatElos, teamElos };
}

/**
 * Apply Elo updates for both individuals and pairings when a game ends.
 * Individuals are rated 2v2 (team-average expected score); pairings are rated head-to-head.
 * Runs in a transaction so concurrent games can't clobber each other's ratings.
 *
 * Elo is only awarded in games between four human players: if any seat is an AI,
 * nobody gains or loses rating (AI strength is fixed/unrated, so it would distort
 * the ladder).
 */
export async function updateEloForGameEnd(room: Room): Promise<EloUpdate | null> {
  if (!firebaseAdmin) return null;
  const db = firebaseAdmin.firestore();
  const state = room.state;

  // Don't rate games that include any AI player: AI strength is fixed/unrated,
  // so it would distort the ladder.
  if (state.players.some(p => p.isAi)) return null;

  // Rate any table with at least one signed-in human. A human guest doesn't
  // block the others: guests carry no rating, so they're treated as a baseline
  // 1500 partner/opponent when computing expected scores, only signed-in seats
  // receive an individual update, and a pairing is rated only when both of its
  // seats are signed in. With a guest in the mix the per-game deltas no longer
  // sum to zero across the table — that's expected, not a bug.
  const seatUids = buildSeatUidMap(room);
  if (seatUids.size === 0) return null;
  const winningTeam = state.teams[0].score > state.teams[1].score ? 0 : 1;

  const teamKeys: [string | null, string | null] = [
    teamKeyForSeats(seatUids, state.teams[0].players),
    teamKeyForSeats(seatUids, state.teams[1].players),
  ];

  const seatElos: (number | null)[] = [null, null, null, null];
  const seatDeltas: (number | null)[] = [null, null, null, null];
  const teamElos: [number | null, number | null] = [null, null];
  const teamDeltas: [number | null, number | null] = [null, null];

  await db.runTransaction(async tx => {
    // ---- Reads (must precede all writes in a transaction) ----
    const userRefs = new Map<Seat, FirebaseFirestore.DocumentReference>();
    const userSnaps = new Map<Seat, FirebaseFirestore.DocumentSnapshot>();
    for (const [seat, uid] of seatUids) {
      const ref = db.collection('users').doc(uid);
      userRefs.set(seat, ref);
      userSnaps.set(seat, await tx.get(ref));
    }
    const teamRefs: (FirebaseFirestore.DocumentReference | null)[] = [null, null];
    const teamSnaps: (FirebaseFirestore.DocumentSnapshot | null)[] = [null, null];
    for (const t of [0, 1] as const) {
      if (!teamKeys[t]) continue;
      const ref = db.collection('teams').doc(teamKeys[t]!);
      teamRefs[t] = ref;
      teamSnaps[t] = await tx.get(ref);
    }

    // ---- Individual ratings ----
    const curSeatElo = (seat: Seat): number => {
      const elo = userSnaps.get(seat)?.data()?.stats?.elo;
      return typeof elo === 'number' ? elo : ELO_INITIAL;
    };
    const teamAvg: [number, number] = ([0, 1] as const).map(t => {
      const [a, b] = state.teams[t].players;
      return (curSeatElo(a) + curSeatElo(b)) / 2;
    }) as [number, number];

    for (const [seat] of seatUids) {
      const team = getTeamForSeat(seat);
      const data = userSnaps.get(seat)?.data() ?? {};
      const cur = typeof data.stats?.elo === 'number' ? data.stats.elo : ELO_INITIAL;
      const games = data.stats?.eloGames ?? 0;
      const peak = typeof data.stats?.eloPeak === 'number' ? data.stats.eloPeak : ELO_INITIAL;
      const exp = eloExpected(teamAvg[team], teamAvg[(1 - team) as 0 | 1]);
      const actual = team === winningTeam ? 1 : 0;
      const next = Math.round(cur + eloKFactor(games) * (actual - exp));
      tx.set(userRefs.get(seat)!, {
        stats: { elo: next, eloGames: games + 1, eloPeak: Math.max(peak, next) },
      }, { merge: true });
      seatElos[seat] = next;
      seatDeltas[seat] = next - cur;
    }

    // ---- Pairing ratings (only teams where both players are authenticated) ----
    const curTeamElo = (t: 0 | 1): number => {
      const elo = teamSnaps[t]?.data()?.stats?.elo;
      return typeof elo === 'number' ? elo : ELO_INITIAL;
    };
    for (const t of [0, 1] as const) {
      if (!teamKeys[t]) continue;
      const data = teamSnaps[t]?.data() ?? {};
      const cur = typeof data.stats?.elo === 'number' ? data.stats.elo : ELO_INITIAL;
      const games = data.stats?.eloGames ?? 0;
      const peak = typeof data.stats?.eloPeak === 'number' ? data.stats.eloPeak : ELO_INITIAL;
      const exp = eloExpected(cur, curTeamElo((1 - t) as 0 | 1));
      const actual = t === winningTeam ? 1 : 0;
      const next = Math.round(cur + eloKFactor(games) * (actual - exp));
      tx.set(teamRefs[t]!, {
        playerUids: teamKeys[t]!.split('_'),
        stats: { elo: next, eloGames: games + 1, eloPeak: Math.max(peak, next) },
      }, { merge: true });
      teamElos[t] = next;
      teamDeltas[t] = next - cur;
    }
  });

  return { seatElos, seatDeltas, teamElos, teamDeltas };
}

const MAX_INVITABLE_USERS = 50;

export async function fetchInvitableUsers(
  requestingUid: string
): Promise<{
  allUsers: Array<{ uid: string; displayName: string; photoURL: string | null }>;
  playedWithUids: Set<string>;
}> {
  if (!firebaseAdmin) return { allUsers: [], playedWithUids: new Set() };
  const db = firebaseAdmin.firestore();

  // 1. Fetch the requesting user's doc to get their playedWith list
  const userDoc = await db.collection('users').doc(requestingUid).get();
  const playedWithUids = new Set<string>();
  if (userDoc.exists) {
    const played: string[] = userDoc.data()?.playedWith ?? [];
    for (const uid of played) playedWithUids.add(uid);
  }

  // 2. Fetch played-with users by ID (if any), plus recent users up to the limit
  const allUsers: Array<{ uid: string; displayName: string; photoURL: string | null }> = [];
  const seenUids = new Set<string>();

  // Fetch played-with users first (batch reads, max 30 per getAll call)
  const playedWithList = [...playedWithUids];
  for (let i = 0; i < playedWithList.length; i += 30) {
    const batch = playedWithList.slice(i, i + 30);
    const refs = batch.map(uid => db.collection('users').doc(uid));
    const docs = await db.getAll(...refs);
    for (const doc of docs) {
      if (!doc.exists || doc.id === requestingUid) continue;
      const data = doc.data()!;
      allUsers.push({
        uid: doc.id,
        displayName: data.displayName || 'Player',
        photoURL: data.photoURL || null,
      });
      seenUids.add(doc.id);
    }
  }

  // Fill remaining slots with recent users (by last activity / doc order)
  const remaining = MAX_INVITABLE_USERS - allUsers.length;
  if (remaining > 0) {
    const recentSnap = await db.collection('users')
      .limit(remaining + 1) // +1 to account for self
      .get();
    for (const doc of recentSnap.docs) {
      if (doc.id === requestingUid || seenUids.has(doc.id)) continue;
      const data = doc.data();
      allUsers.push({
        uid: doc.id,
        displayName: data.displayName || 'Player',
        photoURL: data.photoURL || null,
      });
    }
  }

  return { allUsers, playedWithUids };
}

// ===== Derived stats (from game history) =====

/**
 * Round logs for a finished game never change, so cache them per process.
 * The cache holds the *pending promise*, not just the result: opening the
 * stats page fires several fetches at once, and storing results only would
 * let every one of them miss on a cold cache and read the same docs in
 * parallel. Bounded so a long-lived server can't grow without limit;
 * entries are evicted oldest-first.
 */
const roundLogCache = new Map<string, Promise<RoundLog[]>>();
const ROUND_LOG_CACHE_MAX = 2000;

function loadRounds(db: FirebaseFirestore.Firestore, gameId: string): Promise<RoundLog[]> {
  const cached = roundLogCache.get(gameId);
  if (cached) return cached;
  const pending = db.collection('games').doc(gameId).collection('rounds').get()
    .then(snap => snap.docs
      .map(d => d.data() as RoundLog)
      .sort((a, b) => a.roundNumber - b.roundNumber));
  // Don't cache a failure (transient Firestore error), or it would stick.
  pending.catch(() => roundLogCache.delete(gameId));
  if (roundLogCache.size >= ROUND_LOG_CACHE_MAX) {
    const oldest = roundLogCache.keys().next().value;
    if (oldest !== undefined) roundLogCache.delete(oldest);
  }
  roundLogCache.set(gameId, pending);
  return pending;
}

function toSummary(data: FirebaseFirestore.DocumentData): GameSummary {
  return {
    gameId: data.gameId,
    finishedAt: data.finishedAt ?? 0,
    players: data.players ?? [],
    finalScores: data.finalScores ?? [0, 0],
    winningTeam: data.winningTeam ?? null,
    rounds: data.rounds ?? 0,
  };
}

/** Every finished game `uid` took part in, with round logs. */
async function loadGameRecords(uid: string): Promise<GameRecord[]> {
  if (!firebaseAdmin) return [];
  const db = firebaseAdmin.firestore();
  const snap = await db.collection('games').where('playerUids', 'array-contains', uid).get();
  return Promise.all(snap.docs.map(async d => {
    const summary = toSummary(d.data());
    return { summary, rounds: await loadRounds(db, summary.gameId) };
  }));
}

type EloFields = { elo: number; eloGames: number; eloPeak: number };

function readElo(data: FirebaseFirestore.DocumentData | undefined): EloFields {
  const stats = data?.stats ?? {};
  const elo = typeof stats.elo === 'number' ? stats.elo : ELO_INITIAL;
  return {
    elo,
    eloGames: typeof stats.eloGames === 'number' ? stats.eloGames : 0,
    eloPeak: typeof stats.eloPeak === 'number' ? stats.eloPeak : elo,
  };
}

async function loadDisplayInfo(uids: string[]): Promise<Map<string, PairingPlayer>> {
  const info = new Map<string, PairingPlayer>();
  if (!firebaseAdmin || uids.length === 0) return info;
  const db = firebaseAdmin.firestore();
  for (let i = 0; i < uids.length; i += 30) {
    const batch = uids.slice(i, i + 30);
    const docs = await db.getAll(...batch.map(u => db.collection('users').doc(u)));
    for (const doc of docs) {
      if (!doc.exists) continue;
      const data = doc.data()!;
      info.set(doc.id, { uid: doc.id, name: data.displayName || 'Player', photoURL: data.photoURL || null });
    }
  }
  return info;
}

/**
 * A user's stats as shown on the stats page: totals derived from their game
 * history, plus the Elo fields (which are stateful and live on the user doc).
 */
export async function fetchUserStats(uid: string): Promise<UserStats> {
  if (!firebaseAdmin) return { ...EMPTY_STAT_TOTALS, elo: ELO_INITIAL, eloGames: 0, eloPeak: ELO_INITIAL };
  const db = firebaseAdmin.firestore();
  const [records, userSnap] = await Promise.all([
    loadGameRecords(uid),
    db.collection('users').doc(uid).get(),
  ]);
  return { ...computePlayerStats(records, uid), ...readElo(userSnap.data()) };
}

const pairKey = (a: string, b: string) => [a, b].sort().join('_');

export async function fetchPartnerStats(uid: string): Promise<PartnerStats[]> {
  if (!firebaseAdmin) return [];
  const db = firebaseAdmin.firestore();

  const records = await loadGameRecords(uid);
  const rows = computePartnerSummaries(records, uid);
  if (rows.length === 0) return [];

  const partnerUids = rows.map(r => r.partnerUid);
  const [info, teamDocs] = await Promise.all([
    loadDisplayInfo(partnerUids),
    db.getAll(...partnerUids.map(p => db.collection('teams').doc(pairKey(uid, p)))),
  ]);
  const teamElo = new Map<string, EloFields | null>();
  teamDocs.forEach((doc, i) => {
    const rated = doc.exists && typeof doc.data()?.stats?.elo === 'number';
    teamElo.set(partnerUids[i], rated ? readElo(doc.data()) : null);
  });

  return rows.map(r => {
    const elo = teamElo.get(r.partnerUid) ?? null;
    return {
      ...r,
      partnerName: info.get(r.partnerUid)?.name || 'Player',
      partnerPhoto: info.get(r.partnerUid)?.photoURL || null,
      teamElo: elo?.elo ?? null,
      teamEloGames: elo?.eloGames ?? 0,
      teamEloPeak: elo?.eloPeak ?? null,
    };
  });
}

/** Detailed stats for the pairing (uid, partnerUid). */
export async function fetchTeamStats(uid: string, partnerUid: string): Promise<TeamStats> {
  const breakdown = computePairingBreakdown(await loadGameRecords(uid), uid, partnerUid);
  let elo: EloFields | null = null;
  const info = await loadDisplayInfo([uid, partnerUid]);
  if (firebaseAdmin) {
    const doc = await firebaseAdmin.firestore().collection('teams').doc(pairKey(uid, partnerUid)).get();
    if (doc.exists && typeof doc.data()?.stats?.elo === 'number') elo = readElo(doc.data());
  }
  const player = (u: string): PairingPlayer =>
    info.get(u) ?? { uid: u, name: 'Player', photoURL: null };
  return {
    ...breakdown,
    players: [player(uid), player(partnerUid)],
    teamElo: elo?.elo ?? null,
    teamEloGames: elo?.eloGames ?? 0,
    teamEloPeak: elo?.eloPeak ?? null,
  };
}

// Helper: build uid -> seat map from the room's persistent seat->uid map, so a
// momentarily-disconnected player still has their stats credited (live sockets
// are gone the instant they drop; the recorded uid survives).
function buildUidMap(room: Room): Map<string, Seat> {
  const uidMap = new Map<string, Seat>();
  for (const [seat, uid] of room.seatUids ?? []) {
    uidMap.set(uid, seat);
  }
  return uidMap;
}
