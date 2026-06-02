import {
  GameState, Seat, getTeamForSeat, RoundResult, RoundLog, RoundLogPlayerEntry, PartnerStats,
  RoomElos, EloUpdate, ELO_INITIAL, eloExpected, eloKFactor,
} from '@tichu/shared';
import { firebaseAdmin } from './firebase.js';
import { Room, getSocketUid } from './rooms.js';

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
      const socketId = room.seatPlayers.get(s);
      if (!socketId) continue;
      const uid = getSocketUid(socketId);
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
      const socketId = room.seatPlayers.get(s);
      if (!socketId) continue;
      const uid = getSocketUid(socketId);
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
    const socketId = room.seatPlayers.get(p.seat);
    const uid = socketId ? getSocketUid(socketId) : null;
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

// ===== Elo ratings =====

/** Map of seat -> authenticated uid (humans only; AI / anonymous seats excluded). */
function buildSeatUidMap(room: Room): Map<Seat, string> {
  const map = new Map<Seat, string>();
  for (const [socketId, seat] of room.playerSockets) {
    const uid = getSocketUid(socketId);
    if (uid) map.set(seat, uid);
  }
  return map;
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
 */
export async function updateEloForGameEnd(room: Room): Promise<EloUpdate | null> {
  if (!firebaseAdmin) return null;
  const db = firebaseAdmin.firestore();
  const state = room.state;

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

export async function fetchPartnerStats(uid: string): Promise<PartnerStats[]> {
  if (!firebaseAdmin) return [];
  const db = firebaseAdmin.firestore();

  const teamsSnap = await db.collection('teams')
    .where('playerUids', 'array-contains', uid)
    .get();

  const rows: Array<{ partnerUid: string; gamesPlayed: number; gamesWon: number; roundsPlayed: number; teamElo: number | null }> = [];
  for (const doc of teamsSnap.docs) {
    const data = doc.data();
    const playerUids: string[] = data.playerUids || [];
    const partnerUid = playerUids.find(u => u !== uid);
    if (!partnerUid) continue;
    rows.push({
      partnerUid,
      gamesPlayed: data.stats?.gamesPlayed || 0,
      gamesWon: data.stats?.gamesWon || 0,
      roundsPlayed: data.stats?.roundsPlayed || 0,
      teamElo: typeof data.stats?.elo === 'number' ? data.stats.elo : null,
    });
  }

  if (rows.length === 0) return [];

  // Look up partner display info (batched, 30 per getAll)
  const partnerInfo = new Map<string, { name: string; photo: string | null }>();
  const partnerUids = rows.map(r => r.partnerUid);
  for (let i = 0; i < partnerUids.length; i += 30) {
    const batch = partnerUids.slice(i, i + 30);
    const refs = batch.map(u => db.collection('users').doc(u));
    const docs = await db.getAll(...refs);
    for (const doc of docs) {
      if (!doc.exists) continue;
      const data = doc.data()!;
      partnerInfo.set(doc.id, {
        name: data.displayName || 'Player',
        photo: data.photoURL || null,
      });
    }
  }

  return rows
    .map(r => ({
      partnerUid: r.partnerUid,
      partnerName: partnerInfo.get(r.partnerUid)?.name || 'Player',
      partnerPhoto: partnerInfo.get(r.partnerUid)?.photo || null,
      gamesPlayed: r.gamesPlayed,
      gamesWon: r.gamesWon,
      roundsPlayed: r.roundsPlayed,
      teamElo: r.teamElo,
    }))
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed || b.roundsPlayed - a.roundsPlayed);
}

// Helper: build uid -> seat map from room
function buildUidMap(room: Room): Map<string, Seat> {
  const uidMap = new Map<string, Seat>();
  for (const [socketId, seat] of room.playerSockets) {
    const uid = getSocketUid(socketId);
    if (uid) uidMap.set(uid, seat);
  }
  return uidMap;
}
