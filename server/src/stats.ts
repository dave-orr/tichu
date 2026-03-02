import { GameState, Seat, getTeamForSeat, RoundResult, RoundLog, RoundLogPlayerEntry } from '@tichu/shared';
import { firebaseAdmin } from './firebase.js';
import { Room, RoundAccumulator, getSocketUid } from './rooms.js';

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

    // Tichu call tracking
    if (player.tichuCall === 'small') {
      updates['stats.tichuCalls'] = inc(1);
      if (player.outOrder === 1) {
        updates['stats.tichuSuccesses'] = inc(1);
      }
      // Score-context tracking
      if (acc.scoresAtRoundStart[team] < acc.scoresAtRoundStart[otherTeam]) {
        updates['stats.tichuCallsWhenBehind'] = inc(1);
      } else {
        updates['stats.tichuCallsWhenAhead'] = inc(1);
      }
    } else if (player.tichuCall === 'grand') {
      updates['stats.grandTichuCalls'] = inc(1);
      if (player.outOrder === 1) {
        updates['stats.grandTichuSuccesses'] = inc(1);
      }
      if (acc.scoresAtRoundStart[team] < acc.scoresAtRoundStart[otherTeam]) {
        updates['stats.grandCallsWhenBehind'] = inc(1);
      } else {
        updates['stats.grandCallsWhenAhead'] = inc(1);
      }
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

    batch.update(docRef, updates);
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
  const winningTeam = team0Score > team1Score ? 0 : 1;
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

    batch.update(docRef, updates);
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
      const winningTeam = state.teams[0].score > state.teams[1].score ? 0 : 1;
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

// Helper: build uid -> seat map from room
function buildUidMap(room: Room): Map<string, Seat> {
  const uidMap = new Map<string, Seat>();
  for (const [socketId, seat] of room.playerSockets) {
    const uid = getSocketUid(socketId);
    if (uid) uidMap.set(uid, seat);
  }
  return uidMap;
}
