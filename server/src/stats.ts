import { GameState, Seat, getTeamForSeat } from '@tichu/shared';
import { firebaseAdmin } from './firebase.js';

export async function updateStatsForRound(
  uidMap: Map<string, Seat>,
  state: GameState,
): Promise<void> {
  if (!firebaseAdmin) return;
  const db = firebaseAdmin.firestore();
  const batch = db.batch();

  for (const [uid, seat] of uidMap) {
    const docRef = db.collection('users').doc(uid);
    const player = state.players[seat];
    const team = getTeamForSeat(seat);

    const updates: Record<string, FirebaseFirestore.FieldValue> = {
      'stats.roundsPlayed': firebaseAdmin.firestore.FieldValue.increment(1),
    };

    // Check if this player went out first
    if (player.outOrder === 1) {
      updates['stats.roundsWonFirstOut'] = firebaseAdmin.firestore.FieldValue.increment(1);
    }

    // Tichu call tracking
    if (player.tichuCall === 'small') {
      updates['stats.tichuCalls'] = firebaseAdmin.firestore.FieldValue.increment(1);
      // Success = player went out first
      if (player.outOrder === 1) {
        updates['stats.tichuSuccesses'] = firebaseAdmin.firestore.FieldValue.increment(1);
      }
    } else if (player.tichuCall === 'grand') {
      updates['stats.grandTichuCalls'] = firebaseAdmin.firestore.FieldValue.increment(1);
      if (player.outOrder === 1) {
        updates['stats.grandTichuSuccesses'] = firebaseAdmin.firestore.FieldValue.increment(1);
      }
    }

    // Double victory check
    const outOrder = state.players
      .filter(p => p.outOrder > 0)
      .sort((a, b) => a.outOrder - b.outOrder);
    if (outOrder.length >= 2) {
      const first = outOrder[0];
      const second = outOrder[1];
      if (getTeamForSeat(first.seat) === team && getTeamForSeat(second.seat) === team) {
        updates['stats.doubleVictories'] = firebaseAdmin.firestore.FieldValue.increment(1);
      }
    }

    batch.update(docRef, updates);
  }

  await batch.commit();
}

export async function updateStatsForGameEnd(
  uidMap: Map<string, Seat>,
  state: GameState,
): Promise<void> {
  if (!firebaseAdmin) return;
  const db = firebaseAdmin.firestore();
  const batch = db.batch();

  // Determine winning team
  const team0Score = state.teams[0].score;
  const team1Score = state.teams[1].score;
  const winningTeam = team0Score > team1Score ? 0 : 1;

  for (const [uid, seat] of uidMap) {
    const docRef = db.collection('users').doc(uid);
    const team = getTeamForSeat(seat);

    const updates: Record<string, FirebaseFirestore.FieldValue> = {
      'stats.gamesPlayed': firebaseAdmin.firestore.FieldValue.increment(1),
    };

    if (team === winningTeam) {
      updates['stats.gamesWon'] = firebaseAdmin.firestore.FieldValue.increment(1);
    }

    batch.update(docRef, updates);
  }

  await batch.commit();
}
