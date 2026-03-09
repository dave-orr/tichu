import { Server, Socket } from 'socket.io';
import { toClientState, Seat, Card, NormalRank, GameSettings, RoundResult, InvitablePlayer } from '@tichu/shared';
import {
  createRoom, joinRoom, getRoomBySocket, removePlayer,
  canStartGame, startGame, handleGrandTichu, handleSmallTichu,
  handlePassCards, handlePlayCards, handlePassTurn, handleBomb,
  handleDragonGiveaway, handleMahJongWish, handleConcede, applyPlayResult,
  startNextRound, swapSeats, Room, setSocketUid, getSocketUid,
  getSocketForUid, isUidOnline, isUidAvailable,
  createInvite, removeInvite, getInvite, getInvitesForUser,
  clearInvitesForRoom,
  setTrickCountdownTimer, clearTrickCountdownTimer, handleAwardTrick,
} from './rooms.js';
import { verifyIdToken, firebaseAdmin } from './firebase.js';
import { updateStatsForRound, updateStatsForGameEnd, updateTeamStats, saveRoundLog, fetchInvitableUsers } from './stats.js';
import {
  isValidCard, isValidCardArray, isValidSeat, isValidNormalRank,
  isValidPlayerName, isValidPassCards,
} from './validation.js';

// Simple per-socket rate limiter: max `limit` events per `windowMs`.
function createRateLimiter(windowMs: number, limit: number) {
  const counts = new Map<string, { count: number; resetAt: number }>();
  return {
    check(socketId: string): boolean {
      const now = Date.now();
      const entry = counts.get(socketId);
      if (!entry || now >= entry.resetAt) {
        counts.set(socketId, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count++;
      return entry.count <= limit;
    },
    cleanup(socketId: string): void {
      counts.delete(socketId);
    },
  };
}

const rateLimiter = createRateLimiter(1000, 20); // 20 events per second per socket

export function setupHandlers(io: Server): void {
  io.on('connection', async (socket: Socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Rate limit all incoming events
    socket.use((event, next) => {
      if (rateLimiter.check(socket.id)) {
        next();
      } else {
        next(new Error('Rate limit exceeded'));
      }
    });

    // Authenticate and push pending invites
    function pushPendingInvites(uid: string) {
      for (const inv of getInvitesForUser(uid)) {
        socket.emit('invite-received', {
          inviteId: inv.id,
          roomCode: inv.roomCode,
          fromName: inv.fromName,
        });
      }
    }

    // Verify Firebase token if provided
    const token = socket.handshake.auth?.token;
    if (token) {
      const decoded = await verifyIdToken(token);
      if (decoded) {
        setSocketUid(socket.id, decoded.uid);
        console.log(`Authenticated user: ${decoded.uid}`);
        pushPendingInvites(decoded.uid);
      }
    }

    // Handle late/refreshed authentication tokens without reconnecting
    socket.on('authenticate', async ({ token: newToken }: { token: string }) => {
      const decoded = await verifyIdToken(newToken);
      if (decoded) {
        setSocketUid(socket.id, decoded.uid);
        pushPendingInvites(decoded.uid);
      }
    });

    socket.on('create-room', ({ playerName, randomPartners, settings, photoURL }: { playerName: string; randomPartners?: boolean; settings?: Partial<GameSettings>; photoURL?: string | null }) => {
      if (!isValidPlayerName(playerName)) {
        socket.emit('error', { message: 'Invalid player name' });
        return;
      }
      const room = createRoom(socket.id, playerName, randomPartners ?? false, settings);
      room.state.players[0].photoURL = photoURL ?? null;
      socket.join(room.code);
      socket.emit('room-created', { roomCode: room.code, randomPartners: room.randomPartners });
      broadcastState(io, room);
    });

    socket.on('join-room', ({ roomCode, playerName, photoURL }: { roomCode: string; playerName: string; photoURL?: string | null }) => {
      if (!isValidPlayerName(playerName)) {
        socket.emit('error', { message: 'Invalid player name' });
        return;
      }
      const result = joinRoom(roomCode, socket.id, playerName);
      if ('error' in result) {
        socket.emit('error', { message: result.error });
        return;
      }
      const { room, seat } = result;
      room.state.players[seat].photoURL = photoURL ?? null;
      socket.join(room.code);
      io.to(room.code).emit('player-joined', { playerName, seat });
      broadcastState(io, room);
      socket.emit('random-partners-updated', { randomPartners: room.randomPartners });
    });

    socket.on('start-game', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room } = found;
      if (room.organizer !== socket.id) {
        socket.emit('error', { message: 'Only the room creator can start the game' });
        return;
      }
      if (!canStartGame(room)) {
        socket.emit('error', { message: 'Cannot start game yet' });
        return;
      }
      startGame(room);
      clearInvitesForRoom(room.code);
      broadcastState(io, room);
    });

    socket.on('call-grand-tichu', ({ call }: { call: boolean }) => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      handleGrandTichu(room, seat, call);
      broadcastState(io, room);
    });

    socket.on('call-small-tichu', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      handleSmallTichu(room, seat);
      broadcastState(io, room);
    });

    socket.on('pass-cards', (data: unknown) => {
      if (!isValidPassCards(data)) {
        socket.emit('error', { message: 'Invalid card data' });
        return;
      }
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      handlePassCards(room, seat, data);
      broadcastState(io, room);
    });

    socket.on('play-cards', ({ cards }: { cards: unknown }) => {
      if (!isValidCardArray(cards)) {
        socket.emit('error', { message: 'Invalid card data' });
        return;
      }
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      const result = handlePlayCards(room, seat, cards);
      applyPlayResult(room, result);

      if (result.needMahJongWish) {
        socket.emit('need-mah-jong-wish');
      }
      if (result.needDragonChoice) {
        socket.emit('need-dragon-choice');
      }
      if (result.roundResult) {
        io.to(room.code).emit('round-result', { result: result.roundResult });
        handleRoundResult(room, result.roundResult);
      }

      if (!result.roundResult) autoSkipHelpless(io, room);
      broadcastState(io, room);
    });

    socket.on('pass-turn', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      const result = handlePassTurn(room, seat);
      applyPlayResult(room, result);

      if (result.trickCountdownStarted) {
        // Start 2-second countdown before awarding trick (gives time to bomb)
        const timer = setTimeout(() => {
          resolveTrickCountdown(io, room);
        }, 3000);
        setTrickCountdownTimer(room.code, timer);
        broadcastState(io, room);
        return;
      }

      if (result.needDragonChoice && result.state.dragonGiveawayBy != null) {
        const dragonWinnerSocketId = room.seatPlayers.get(result.state.dragonGiveawayBy);
        if (dragonWinnerSocketId) {
          io.to(dragonWinnerSocketId).emit('need-dragon-choice');
        }
      }
      if (result.roundResult) {
        io.to(room.code).emit('round-result', { result: result.roundResult });
        handleRoundResult(room, result.roundResult);
      }

      if (!result.roundResult) autoSkipHelpless(io, room);
      broadcastState(io, room);
    });

    socket.on('bomb-announce', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      if (room.state.phase !== 'playing') return;
      room.state = { ...room.state, bombWindow: true };
      broadcastState(io, room);
    });

    socket.on('bomb-cancel', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room } = found;
      room.state = { ...room.state, bombWindow: false };
      broadcastState(io, room);
    });

    socket.on('bomb', ({ cards }: { cards: unknown }) => {
      if (!isValidCardArray(cards)) {
        socket.emit('error', { message: 'Invalid card data' });
        return;
      }
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      // Cancel any pending trick countdown — bomb overrides it
      clearTrickCountdownTimer(room.code);
      const result = handleBomb(room, seat, cards);
      applyPlayResult(room, result);
      // Clear bomb window
      room.state = { ...room.state, bombWindow: false };

      if (result.roundResult) {
        io.to(room.code).emit('round-result', { result: result.roundResult });
        handleRoundResult(room, result.roundResult);
      }

      if (!result.roundResult) autoSkipHelpless(io, room);
      broadcastState(io, room);
    });

    socket.on('give-dragon-trick', ({ to }: { to: unknown }) => {
      if (!isValidSeat(to)) {
        socket.emit('error', { message: 'Invalid seat' });
        return;
      }
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      const result = handleDragonGiveaway(room, seat, to);
      applyPlayResult(room, result);

      if (result.roundResult) {
        io.to(room.code).emit('round-result', { result: result.roundResult });
        handleRoundResult(room, result.roundResult);
      }

      if (!result.roundResult) autoSkipHelpless(io, room);
      broadcastState(io, room);
    });

    socket.on('mah-jong-wish', ({ rank }: { rank: unknown }) => {
      if (!isValidNormalRank(rank)) {
        socket.emit('error', { message: 'Invalid rank' });
        return;
      }
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      handleMahJongWish(room, seat, rank);
      broadcastState(io, room);
    });

    socket.on('concede', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      clearTrickCountdownTimer(room.code);
      const result = handleConcede(room, seat);
      applyPlayResult(room, result);

      if (result.roundResult) {
        io.to(room.code).emit('round-result', { result: result.roundResult });
        handleRoundResult(room, result.roundResult);
      }

      broadcastState(io, room);
    });

    socket.on('next-round', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      if (room.state.phase === 'roundEnd') {
        if (!room.state.roundEndReady.includes(seat)) {
          room.state.roundEndReady.push(seat);
        }
        if (room.state.roundEndReady.length === 4) {
          startNextRound(room);
        }
        broadcastState(io, room);
      }
    });

    socket.on('update-settings', ({ settings }: { settings: Partial<GameSettings> }) => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room } = found;
      if (room.organizer !== socket.id) {
        socket.emit('error', { message: 'Only the room creator can change settings' });
        return;
      }
      if (room.state.phase !== 'waiting') {
        socket.emit('error', { message: 'Cannot change settings after game has started' });
        return;
      }
      const sanitized = { ...settings };
      if (sanitized.targetScore != null) {
        sanitized.targetScore = Math.max(100, Math.min(9999, Math.round(sanitized.targetScore)));
      }
      room.state.settings = { ...room.state.settings, ...sanitized };
      broadcastState(io, room);
    });

    socket.on('update-random-partners', ({ randomPartners }: { randomPartners: boolean }) => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room } = found;
      if (room.organizer !== socket.id) {
        socket.emit('error', { message: 'Only the room creator can change settings' });
        return;
      }
      if (room.state.phase !== 'waiting') {
        socket.emit('error', { message: 'Cannot change settings after game has started' });
        return;
      }
      room.randomPartners = !!randomPartners;
      io.to(room.code).emit('random-partners-updated', { randomPartners: room.randomPartners });
    });

    socket.on('swap-seats', ({ seatA, seatB }: { seatA: unknown; seatB: unknown }) => {
      if (!isValidSeat(seatA) || !isValidSeat(seatB)) {
        socket.emit('error', { message: 'Invalid seat' });
        return;
      }
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room } = found;
      if (room.organizer !== socket.id) {
        socket.emit('error', { message: 'Only the room creator can rearrange seats' });
        return;
      }
      if (swapSeats(room, seatA, seatB)) {
        broadcastState(io, room);
      }
    });

    // ===== Invite System =====

    socket.on('fetch-players', async (callback: (data: { players: InvitablePlayer[] }) => void) => {
      const uid = getSocketUid(socket.id);
      if (!uid) {
        callback({ players: [] });
        return;
      }

      const { allUsers, playedWithUids } = await fetchInvitableUsers(uid);

      const players: InvitablePlayer[] = allUsers.map(u => ({
        uid: u.uid,
        displayName: u.displayName,
        photoURL: u.photoURL,
        playedWith: playedWithUids.has(u.uid),
        isOnline: isUidOnline(u.uid),
        isAvailable: isUidAvailable(u.uid),
      }));

      // Sort: available+played-with first, then available, then online, then offline
      players.sort((a, b) => {
        const scoreA = (a.isAvailable ? 4 : a.isOnline ? 2 : 0) + (a.playedWith ? 1 : 0);
        const scoreB = (b.isAvailable ? 4 : b.isOnline ? 2 : 0) + (b.playedWith ? 1 : 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.displayName.localeCompare(b.displayName);
      });

      callback({ players });
    });

    socket.on('send-invite', ({ targetUid }: { targetUid: string }) => {
      const fromUid = getSocketUid(socket.id);
      if (!fromUid) return;

      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      if (room.organizer !== socket.id) {
        socket.emit('error', { message: 'Only the room creator can send invites' });
        return;
      }

      const fromName = room.state.players[seat].name;
      const invite = createInvite(room.code, fromUid, fromName, targetUid);
      if (!invite) return;

      const targetSocketId = getSocketForUid(targetUid);
      if (targetSocketId) {
        io.to(targetSocketId).emit('invite-received', {
          inviteId: invite.id,
          roomCode: invite.roomCode,
          fromName: invite.fromName,
        });
      }

      // Proactively expire the invite after 5 minutes
      setTimeout(() => {
        const inv = getInvite(invite.id);
        if (!inv) return; // already accepted/dismissed
        removeInvite(invite.id);
        const targetSock = getSocketForUid(inv.targetUid);
        if (targetSock) {
          io.to(targetSock).emit('invite-expired', { inviteId: inv.id });
        }
        const orgSock = getSocketForUid(inv.fromUid);
        if (orgSock) {
          io.to(orgSock).emit('invite-expired', { inviteId: inv.id, targetUid: inv.targetUid });
        }
      }, 5 * 60 * 1000);
    });

    socket.on('respond-invite', ({ inviteId, accept, playerName, photoURL }: { inviteId: string; accept: boolean; playerName?: string; photoURL?: string | null }) => {
      const invite = getInvite(inviteId);
      if (!invite) {
        socket.emit('error', { message: 'Invite expired or not found' });
        return;
      }

      const uid = getSocketUid(socket.id);
      if (uid !== invite.targetUid) return;

      removeInvite(inviteId);

      if (!accept || !playerName) return;

      if (!isValidPlayerName(playerName)) {
        socket.emit('error', { message: 'Invalid player name' });
        return;
      }

      const result = joinRoom(invite.roomCode, socket.id, playerName);
      if ('error' in result) {
        socket.emit('error', { message: result.error });
        return;
      }

      const { room, seat } = result;
      room.state.players[seat].photoURL = photoURL ?? null;
      socket.join(room.code);
      io.to(room.code).emit('player-joined', { playerName, seat });
      broadcastState(io, room);

      socket.emit('room-joined-via-invite', {
        roomCode: room.code,
        randomPartners: room.randomPartners,
      });
    });

    // ===== User Profile (via Admin SDK) =====

    socket.on('load-profile', async (callback: (data: { profile: unknown } | { error: string }) => void) => {
      const uid = getSocketUid(socket.id);
      if (!uid || !firebaseAdmin) {
        callback({ error: 'Not authenticated' });
        return;
      }
      try {
        const db = firebaseAdmin.firestore();
        const docRef = db.collection('users').doc(uid);
        const docSnap = await docRef.get();

        // Get display info from Firebase Auth
        let authUser: { displayName?: string; email?: string; photoURL?: string } = {};
        try {
          const userRecord = await firebaseAdmin.auth().getUser(uid);
          authUser = {
            displayName: userRecord.displayName,
            email: userRecord.email,
            photoURL: userRecord.photoURL,
          };
        } catch { /* ignore */ }

        if (docSnap.exists) {
          const data = docSnap.data()!;
          // Update display info on each login
          await docRef.set({
            displayName: authUser.displayName || data.displayName,
            email: authUser.email || data.email,
            photoURL: authUser.photoURL ?? data.photoURL,
          }, { merge: true });

          callback({
            profile: {
              uid,
              displayName: data.displayName || authUser.displayName || 'Player',
              email: data.email || authUser.email || '',
              photoURL: authUser.photoURL ?? data.photoURL ?? null,
              stats: data.stats || {},
              preferences: {
                preferredName: data.preferences?.preferredName || (authUser.displayName?.split(' ')[0]) || 'Player',
                lastSettings: data.preferences?.lastSettings,
                lastRandomPartners: data.preferences?.lastRandomPartners,
              },
            },
          });
        } else {
          // New user — create profile
          const displayName = authUser.displayName || 'Player';
          const newProfile = {
            displayName,
            email: authUser.email || '',
            photoURL: authUser.photoURL ?? null,
            stats: {},
            preferences: {
              preferredName: displayName.split(' ')[0] || 'Player',
            },
            createdAt: new Date().toISOString(),
          };
          await docRef.set(newProfile);
          callback({
            profile: { uid, ...newProfile },
          });
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        callback({ error: 'Failed to load profile' });
      }
    });

    socket.on('save-settings', async ({ settings, randomPartners }: { settings: Partial<GameSettings>; randomPartners?: boolean }) => {
      const uid = getSocketUid(socket.id);
      if (!uid || !firebaseAdmin) return;
      try {
        const db = firebaseAdmin.firestore();
        const docRef = db.collection('users').doc(uid);
        const prefs: Record<string, unknown> = { lastSettings: settings };
        if (randomPartners !== undefined) {
          prefs.lastRandomPartners = randomPartners;
        }
        await docRef.set({ preferences: prefs }, { merge: true });
      } catch (err) {
        console.error('Failed to save settings:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      removePlayer(socket.id);
      rateLimiter.cleanup(socket.id);
    });
  });
}

function broadcastState(io: Server, room: Room): void {
  for (const [socketId, seat] of room.playerSockets) {
    const clientState = toClientState(room.state, seat);
    io.to(socketId).emit('game-state', { state: clientState });
  }
}

/**
 * Auto-skip players who can't possibly beat the current play based on card count alone.
 * Only skips when: hand size < combo length (can't match) AND hand size < 4 (no bomb possible).
 * Uses only public information (card count) to avoid leaking private hand info.
 */
function autoSkipHelpless(io: Server, room: Room): void {
  let iterations = 0;
  while (iterations < 4) {
    const state = room.state;
    if (state.phase !== 'playing') break;
    if (state.currentTrick === null) break; // leading — can't auto-skip
    if (state.dragonGiveaway || state.bombWindow || state.trickCountdown) break;

    const seat = state.turnIndex;
    const player = state.players[seat];
    if (player.isOut) break;

    const handSize = player.hand.length;
    if (handSize >= 4) break; // could have a bomb
    // For consecutive pairs, the combo length is total cards (e.g. 6 for 3 consecutive pairs)
    if (handSize >= state.currentTrick.length) break; // enough cards to potentially play

    // Auto-pass this player
    const result = handlePassTurn(room, seat);
    applyPlayResult(room, result);

    // Notify all players about the auto-skip
    io.to(room.code).emit('turn-auto-skipped', { seat });

    if (result.trickCountdownStarted) {
      // Start countdown — stop auto-skipping
      const timer = setTimeout(() => {
        resolveTrickCountdown(io, room);
      }, 2000);
      setTrickCountdownTimer(room.code, timer);
      break;
    }

    if (result.roundResult) {
      io.to(room.code).emit('round-result', { result: result.roundResult });
      handleRoundResult(room, result.roundResult);
    }

    iterations++;
  }
}

/**
 * Resolve a trick countdown: award the trick to the winner after the 2-second delay.
 */
function resolveTrickCountdown(io: Server, room: Room): void {
  if (!room.state.trickCountdown) return;

  // If someone is considering a bomb, wait for them
  if (room.state.bombWindow) {
    const timer = setTimeout(() => {
      resolveTrickCountdown(io, room);
    }, 500);
    setTrickCountdownTimer(room.code, timer);
    return;
  }

  const result = handleAwardTrick(room);
  applyPlayResult(room, result);

  if (result.needDragonChoice && result.state.dragonGiveawayBy != null) {
    const dragonWinnerSocketId = room.seatPlayers.get(result.state.dragonGiveawayBy);
    if (dragonWinnerSocketId) {
      io.to(dragonWinnerSocketId).emit('need-dragon-choice');
    }
  }

  autoSkipHelpless(io, room);
  broadcastState(io, room);
}

function handleRoundResult(room: Room, roundResult: RoundResult): void {
  const state = room.state;
  if (state.phase !== 'roundEnd' && state.phase !== 'gameEnd') return;

  // Save round log (fire-and-forget)
  saveRoundLog(room, roundResult).catch(err =>
    console.error('Failed to save round log:', err)
  );

  // Update round stats for each authenticated player
  updateStatsForRound(room, roundResult).catch(err =>
    console.error('Failed to update round stats:', err)
  );

  // Update team stats
  const isGameEnd = state.phase === 'gameEnd';
  updateTeamStats(room, roundResult, isGameEnd).catch(err =>
    console.error('Failed to update team stats:', err)
  );

  // If game is over, also update game-level stats
  if (isGameEnd) {
    updateStatsForGameEnd(room, roundResult).catch(err =>
      console.error('Failed to update game stats:', err)
    );
  }
}
