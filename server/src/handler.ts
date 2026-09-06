import { Server, Socket } from 'socket.io';
import { toClientState, Seat, Card, NormalRank, GameSettings, RoundResult, InvitablePlayer, PartnerStats, RoomElos, PlayResult, GameSummary, GameHistoryRound, UserStats, TeamStats } from '@tichu/shared';
import {
  createRoom, joinRoom, reconnectToRoom, getDisconnectedSeats, getRoom, getRoomBySocket, removePlayer,
  leaveRoom, clearSocketUid, setRoomChangedCallback,
  canStartGame, startGame, handleGrandTichu, handleSmallTichu,
  handlePassCards, handleUndoPass, handlePlayCards, handlePassTurn, handleBomb,
  handleDragonGiveaway, handleMahJongWish, handleConcede, applyPlayResult,
  startNextRound, resetRoomForNewGame, swapSeats, Room, setSocketUid, getSocketUid,
  getSocketForUid, isUidOnline, isUidAvailable,
  createInvite, removeInvite, getInvite, getInvitesForUser,
  clearInvitesForRoom, closeRoom,
  setTrickCountdownTimer, clearTrickCountdownTimer, handleAwardTrick,
  setBombWindowTimer, clearBombWindowTimer,
  markSeatForAi, unmarkSeatForAi, isApiPlayer,
  setRoomGoneCallback, registerRestoredRoom,
} from './rooms.js';
import { persistRoom, deletePersistedRoom, loadPersistedRooms } from './persistence.js';
import { verifyIdToken, firebaseAdmin } from './firebase.js';
import { recordPlayedWith, saveRoundLog, saveGameSummary, fetchRecentGames, fetchGameHistory, fetchInvitableUsers, fetchPartnerStats, fetchTeamStats, fetchUserStats, fetchRoomElos, fetchHeadToHead, updateEloForGameEnd } from './stats.js';
import {
  isValidCard, isValidCardArray, isValidSeat, isValidNormalRank,
  isValidPlayerName, isValidPassCards, sanitizeSettings,
} from './validation.js';

type Handler = (...args: any[]) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Register a socket event handler that can't take the process down.
 *
 * Socket.IO dispatches listeners with no try/catch, and nothing catches
 * unhandled rejections, so a single malformed event (`emit('play-cards')`
 * with no payload → destructuring `undefined` throws; an async handler whose
 * client omitted the ack → `callback is not a function`) would crash the
 * server for every live game. A missing/null payload is normalised to `{}`
 * so destructuring handlers reach their validators; anything that still
 * throws or rejects is logged and dropped.
 */
function guarded(socket: Socket, event: string, fn: Handler): void {
  socket.on(event, (...args: unknown[]) => {
    if (args.length === 0 || args[0] == null) args[0] = {};
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        result.catch(err => console.error(`[socket] ${event} handler rejected:`, err));
      }
    } catch (err) {
      console.error(`[socket] ${event} handler threw:`, err);
    }
  });
}

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

// Bomb-window guards.
// A bomb window auto-closes after this long so it can never defer trick
// resolution (or linger on others' screens) indefinitely.
const BOMB_WINDOW_MAX_MS = 8000;
// Anti-spam: the first few announces within a rolling window are free (so a
// player can freely change their mind), after which each announce arms an
// escalating cooldown before the next one is allowed.
const BOMB_ANNOUNCE_FREE = 3;
const BOMB_ANNOUNCE_WINDOW_MS = 10000;
const BOMB_ANNOUNCE_BASE_DELAY_MS = 1000;
const BOMB_ANNOUNCE_MAX_DELAY_MS = 15000;

// Returns 0 if the seat may announce a bomb now, otherwise the ms it must wait.
// On success, records the announce and arms an escalating cooldown once the
// seat exceeds its free quota within the rolling window.
function bombAnnounceRetryMs(room: Room, seat: Seat): number {
  const now = Date.now();
  let t = room.bombAnnounceThrottle.get(seat);
  if (!t || now - t.windowStart > BOMB_ANNOUNCE_WINDOW_MS) {
    t = { count: 0, windowStart: now, blockedUntil: 0 };
    room.bombAnnounceThrottle.set(seat, t);
  }
  if (now < t.blockedUntil) return t.blockedUntil - now;
  t.count++;
  if (t.count > BOMB_ANNOUNCE_FREE) {
    const over = t.count - BOMB_ANNOUNCE_FREE; // 1, 2, 3, ...
    const delay = Math.min(
      BOMB_ANNOUNCE_BASE_DELAY_MS * 2 ** (over - 1),
      BOMB_ANNOUNCE_MAX_DELAY_MS,
    );
    t.blockedUntil = now + delay;
  }
  return 0;
}

// Per-IP connection limiter: max concurrent connections from one IP
const MAX_CONNECTIONS_PER_IP = 8;
const connectionsPerIp = new Map<string, number>();

// Only trust the X-Forwarded-For header when explicitly told we're behind a
// trusted reverse proxy (TRUST_PROXY=1 in production). Otherwise a client can
// forge XFF to dodge the per-IP connection limit, so we use the real socket
// address. When trusted, XFF may be a comma-separated chain ("client, proxy1,
// proxy2") — the leftmost entry is the originating client.
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';

function getIp(socket: Socket): string {
  if (TRUST_PROXY) {
    const xff = socket.handshake.headers['x-forwarded-for'];
    const raw = Array.isArray(xff) ? xff[0] : xff;
    const first = raw?.split(',')[0].trim();
    if (first) return first;
  }
  return socket.handshake.address || 'unknown';
}

export function setupHandlers(io: Server): void {
  // Delete a room's persisted snapshot whenever it is torn down.
  setRoomGoneCallback(deletePersistedRoom);
  // Re-broadcast when a room changes on a timer rather than a socket event
  // (a waiting-room seat freed after its grace period).
  setRoomChangedCallback(room => broadcastState(io, room));

  // Restore any games that were live when the server last stopped, so players
  // can reconnect after a restart/redeploy. Best-effort, non-blocking.
  loadPersistedRooms()
    .then(restored => {
      let count = 0;
      for (const room of restored) {
        if (!registerRestoredRoom(room)) continue;
        count++;
        // Timers don't survive a restart: a trick that was mid-countdown when
        // the snapshot was taken would otherwise never be awarded.
        if (room.state.trickCountdown) {
          const timer = setTimeout(() => {
            resolveTrickCountdown(io, room);
          }, room.state.trickCountdown.durationMs ?? 3000);
          setTrickCountdownTimer(room.code, timer);
        }
      }
      if (count > 0) {
        console.log(`Restored ${count} live room(s) from persistence`);
      }
    })
    .catch(err => console.error('Failed to restore persisted rooms:', err));

  io.on('connection', (socket: Socket) => {
    const ip = getIp(socket);
    const currentCount = connectionsPerIp.get(ip) ?? 0;
    if (currentCount >= MAX_CONNECTIONS_PER_IP) {
      socket.emit('error', { message: 'Too many connections' });
      socket.disconnect(true);
      return;
    }
    connectionsPerIp.set(ip, currentCount + 1);

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

    // Verify the handshake token if provided. This must not delay listener
    // registration below: events that arrive while verification is pending
    // (the client emits `authenticate` and `rejoin-room` immediately on
    // connect) would be dropped with no listener, and a socket that dropped
    // meanwhile would never run `disconnect`, leaking its per-IP slot.
    const token = socket.handshake.auth?.token;
    if (typeof token === 'string' && token) {
      verifyIdToken(token)
        .then(decoded => {
          if (!decoded || socket.disconnected) return;
          setSocketUid(socket.id, decoded.uid);
          console.log(`Authenticated user: ${decoded.uid}`);
          pushPendingInvites(decoded.uid);
        })
        .catch(err => console.error('Handshake token verification failed:', err));
    }

    /**
     * Detach this socket from whatever room it is in (deliberate leave), tell
     * the others, and drop the Socket.IO room membership so a later room that
     * reuses the code can't reach this socket.
     */
    function leaveCurrentRoom(): void {
      const left = leaveRoom(socket.id);
      if (!left) return;
      socket.leave(left.room.code);
      if (!left.destroyed) broadcastState(io, left.room);
    }

    // Handle late/refreshed authentication tokens without reconnecting
    guarded(socket, 'authenticate', async ({ token: newToken }: { token: unknown }, ack?: (data: { ok: boolean }) => void) => {
      const decoded = typeof newToken === 'string' && newToken ? await verifyIdToken(newToken) : null;
      if (decoded) {
        setSocketUid(socket.id, decoded.uid);
        pushPendingInvites(decoded.uid);
      }
      if (typeof ack === 'function') ack({ ok: !!decoded });
    });

    // The user signed out in this tab: stop attributing this socket (stats,
    // Elo, invites) to the account it was authenticated as.
    guarded(socket, 'sign-out', () => {
      clearSocketUid(socket.id);
      // The seat's recorded uid is what stats/Elo are keyed on at game end;
      // a signed-out player continues as a guest.
      const found = getRoomBySocket(socket.id);
      if (found) found.room.seatUids.delete(found.seat);
    });

    guarded(socket, 'leave-room', () => {
      leaveCurrentRoom();
    });

    guarded(socket, 'create-room', ({ playerName, randomPartners, settings, photoURL, sessionId }: { playerName: string; randomPartners?: boolean; settings?: Partial<GameSettings>; photoURL?: string | null; sessionId?: string }) => {
      if (!isValidPlayerName(playerName)) {
        socket.emit('error', { message: 'Invalid player name' });
        return;
      }
      leaveCurrentRoom();
      const room = createRoom(socket.id, playerName, !!randomPartners, sanitizeSettings(settings), typeof sessionId === 'string' ? sessionId : undefined);
      room.state.players[0].photoURL = typeof photoURL === 'string' ? photoURL : null;
      socket.join(room.code);
      socket.emit('room-created', { roomCode: room.code, randomPartners: room.randomPartners });
      broadcastState(io, room);
    });

    guarded(socket, 'join-room', ({ roomCode, playerName, photoURL, sessionId }: { roomCode: unknown; playerName: unknown; photoURL?: unknown; sessionId?: unknown }) => {
      if (!isValidPlayerName(playerName)) {
        socket.emit('error', { message: 'Invalid player name' });
        return;
      }
      if (typeof roomCode !== 'string') {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      leaveCurrentRoom();
      const result = joinRoom(roomCode, socket.id, playerName, typeof sessionId === 'string' ? sessionId : undefined);
      if ('error' in result) {
        socket.emit('error', { message: result.error });
        return;
      }
      const { room, seat } = result;
      room.state.players[seat].photoURL = typeof photoURL === 'string' ? photoURL : null;
      socket.join(room.code);
      io.to(room.code).emit('player-joined', { playerName, seat });
      // Confirm the seat before the state lands, so the client only remembers
      // a room it is actually in.
      socket.emit('room-joined', { roomCode: room.code, randomPartners: room.randomPartners });
      broadcastState(io, room);
      socket.emit('random-partners-updated', { randomPartners: room.randomPartners });
    });

    // Reconnect a returning player (refresh, crash, dropped connection) back to
    // their seat using their persistent client session token.
    guarded(socket, 'rejoin-room', ({ roomCode, sessionId, playerName, photoURL }: { roomCode: unknown; sessionId: unknown; playerName?: unknown; photoURL?: unknown }) => {
      const sess = typeof sessionId === 'string' && sessionId ? sessionId.slice(0, 8) : 'none';
      if (typeof roomCode !== 'string' || !roomCode || typeof sessionId !== 'string' || !sessionId) {
        console.log(`[rejoin] ${socket.id} bad-request room=${roomCode ?? 'none'} session=${sess} -> room-lost`);
        socket.emit('room-lost');
        return;
      }
      const result = reconnectToRoom(roomCode, socket.id, sessionId);
      if (!('error' in result)) {
        const { room, seat } = result;
        console.log(`[rejoin] ${socket.id} reconnected room=${roomCode} seat=${seat} session=${sess} phase=${room.state.phase}`);
        if (typeof photoURL === 'string' || photoURL === null) room.state.players[seat].photoURL = photoURL;
        socket.join(room.code);
        socket.emit('room-rejoined', {
          roomCode: room.code,
          randomPartners: room.randomPartners,
          isOrganizer: room.organizer === socket.id,
        });
        // The round-result event was emitted once when the round ended; a
        // player reloading on the results screen needs it again or they have
        // no "Next round" button and the table stalls for everyone.
        if (room.lastRoundResult && (room.state.phase === 'roundEnd' || room.state.phase === 'gameEnd')) {
          socket.emit('round-result', { result: room.lastRoundResult });
        }
        broadcastState(io, room);
        return;
      }
      // Couldn't reclaim the seat. If the room is still open for new players,
      // fall back to a fresh join; otherwise the session is truly lost.
      const room = getRoom(roomCode);
      const reason = room ? result.error : 'room-not-found';
      if (room && room.state.phase === 'waiting' && isValidPlayerName(playerName)) {
        const joined = joinRoom(roomCode, socket.id, playerName, sessionId);
        if (!('error' in joined)) {
          console.log(`[rejoin] ${socket.id} fresh-join room=${roomCode} seat=${joined.seat} session=${sess} (was: ${reason})`);
          joined.room.state.players[joined.seat].photoURL = typeof photoURL === 'string' ? photoURL : null;
          // The creator whose seat was freed while they were away gets their
          // organizer role back (unless it has since passed to someone else).
          if (joined.room.organizerSession && joined.room.organizerSession === sessionId) {
            joined.room.organizer = socket.id;
          }
          socket.join(joined.room.code);
          io.to(joined.room.code).emit('player-joined', { playerName, seat: joined.seat });
          socket.emit('room-rejoined', {
            roomCode: joined.room.code,
            randomPartners: joined.room.randomPartners,
            isOrganizer: joined.room.organizer === socket.id,
          });
          broadcastState(io, joined.room);
          return;
        }
      }
      console.log(`[rejoin] ${socket.id} failed room=${roomCode} session=${sess} reason=${reason} -> room-lost`);
      socket.emit('room-lost');
    });

    guarded(socket, 'check-room', ({ roomCode }: { roomCode: unknown }) => {
      const room = typeof roomCode === 'string' ? getRoom(roomCode) : undefined;
      if (!room) {
        socket.emit('room-lost');
      }
    });

    guarded(socket, 'start-game', () => {
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

    guarded(socket, 'call-grand-tichu', ({ call }: { call: boolean }) => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      handleGrandTichu(room, seat, call);
      broadcastState(io, room);
    });

    guarded(socket, 'call-small-tichu', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      handleSmallTichu(room, seat);
      broadcastState(io, room);
    });

    guarded(socket, 'pass-cards', (data: unknown) => {
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

    guarded(socket, 'undo-pass', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      if (!handleUndoPass(room, seat)) return;
      broadcastState(io, room);
    });

    guarded(socket, 'play-cards', ({ cards }: { cards: unknown }) => {
      if (!isValidCardArray(cards)) {
        socket.emit('error', { message: 'Invalid card data' });
        return;
      }
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      const result = handlePlayCards(room, seat, cards);
      processPlayResult(io, room, seat, result);
    });

    guarded(socket, 'pass-turn', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      const result = handlePassTurn(room, seat);
      processPlayResult(io, room, seat, result);
    });

    guarded(socket, 'bomb-announce', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      if (room.state.phase !== 'playing') return;
      if (room.state.bombWindow) return; // already open — nothing to broadcast
      // A seat that is out or holds fewer than four cards has no bomb to play;
      // don't let it stall every trick with a window it can never use. (Card
      // counts are public, so this leaks nothing.)
      const me = room.state.players[seat];
      if (me.isOut || me.hand.length < 4) return;

      const retryMs = bombAnnounceRetryMs(room, seat);
      if (retryMs > 0) {
        socket.emit('error', {
          message: `Slow down — wait ${Math.ceil(retryMs / 1000)}s before announcing another bomb`,
        });
        return;
      }

      room.state = { ...room.state, bombWindow: true };
      broadcastState(io, room);

      // Auto-close the window so a held-open bomb window can't defer trick
      // resolution forever or linger on everyone's screens.
      clearBombWindowTimer(room.code);
      const timer = setTimeout(() => {
        clearBombWindowTimer(room.code);
        if (!room.state.bombWindow || room.state.phase !== 'playing') return;
        room.state = { ...room.state, bombWindow: false };
        broadcastState(io, room);
      }, BOMB_WINDOW_MAX_MS);
      setBombWindowTimer(room.code, timer);
    });

    guarded(socket, 'bomb-cancel', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room } = found;
      if (room.state.phase !== 'playing') return;
      if (!room.state.bombWindow) return; // nothing to cancel — skip the broadcast
      clearBombWindowTimer(room.code);
      room.state = { ...room.state, bombWindow: false };
      broadcastState(io, room);
    });

    guarded(socket, 'bomb', ({ cards }: { cards: unknown }) => {
      if (!isValidCardArray(cards)) {
        socket.emit('error', { message: 'Invalid card data' });
        return;
      }
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      const result = handleBomb(room, seat, cards);
      // Only a bomb the engine accepted cancels the running trick countdown;
      // clearing it for a rejected bomb would leave the trick un-awardable.
      if (result.state !== room.state) clearTrickCountdownTimer(room.code);
      // Either way the bomb window closes (the player has acted on it).
      clearBombWindowTimer(room.code);
      const modifiedResult = { ...result, state: { ...result.state, bombWindow: false } };
      processPlayResult(io, room, seat, modifiedResult);
    });

    guarded(socket, 'give-dragon-trick', ({ to }: { to: unknown }) => {
      if (!isValidSeat(to)) {
        socket.emit('error', { message: 'Invalid seat' });
        return;
      }
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      const result = handleDragonGiveaway(room, seat, to);
      processPlayResult(io, room, seat, result);
    });

    guarded(socket, 'mah-jong-wish', ({ rank }: { rank: unknown }) => {
      if (rank !== null && !isValidNormalRank(rank)) {
        socket.emit('error', { message: 'Invalid rank' });
        return;
      }
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      handleMahJongWish(room, seat, rank as NormalRank | null);
      broadcastState(io, room);
    });

    guarded(socket, 'concede', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      const result = handleConcede(room, seat);
      if (result.state !== room.state) clearTrickCountdownTimer(room.code);
      processPlayResult(io, room, seat, result);
    });

    // Any player on the game-over screen can reopen the table for a new game.
    guarded(socket, 'play-again', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room } = found;
      if (!resetRoomForNewGame(room)) return;
      broadcastState(io, room);
    });

    guarded(socket, 'next-round', () => {
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

    guarded(socket, 'update-settings', ({ settings }: { settings: unknown }) => {
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
      room.state.settings = { ...room.state.settings, ...sanitizeSettings(settings) };
      broadcastState(io, room);
    });

    guarded(socket, 'update-random-partners', ({ randomPartners }: { randomPartners: boolean }) => {
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

    guarded(socket, 'swap-seats', ({ seatA, seatB }: { seatA: unknown; seatB: unknown }) => {
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

    guarded(socket, 'close-room', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room } = found;
      if (room.organizer !== socket.id) {
        socket.emit('error', { message: 'Only the room creator can cancel the room' });
        return;
      }
      // Tell everyone (including the organizer) to return to the start screen,
      // then tear the room down completely.
      io.to(room.code).emit('room-closed');
      io.in(room.code).socketsLeave(room.code);
      closeRoom(room.code);
    });

    // ===== AI Seat Management =====

    guarded(socket, 'mark-seat-ai', ({ seat }: { seat: unknown }) => {
      if (!isValidSeat(seat)) {
        socket.emit('error', { message: 'Invalid seat' });
        return;
      }
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room } = found;
      if (room.organizer !== socket.id) {
        socket.emit('error', { message: 'Only the room creator can manage AI seats' });
        return;
      }
      const result = markSeatForAi(room, seat);
      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }
      broadcastState(io, room);
    });

    guarded(socket, 'unmark-seat-ai', ({ seat }: { seat: unknown }) => {
      if (!isValidSeat(seat)) {
        socket.emit('error', { message: 'Invalid seat' });
        return;
      }
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room } = found;
      if (room.organizer !== socket.id) {
        socket.emit('error', { message: 'Only the room creator can manage AI seats' });
        return;
      }
      unmarkSeatForAi(room, seat);
      broadcastState(io, room);
    });

    // ===== Invite System =====

    guarded(socket, 'fetch-players', async (callback: (data: { players: InvitablePlayer[]; needsAuth?: boolean }) => void) => {
      const uid = getSocketUid(socket.id);
      if (!uid) {
        callback({ players: [], needsAuth: true });
        return;
      }

      let allUsers: Awaited<ReturnType<typeof fetchInvitableUsers>>['allUsers'];
      let playedWithUids: Awaited<ReturnType<typeof fetchInvitableUsers>>['playedWithUids'];
      try {
        ({ allUsers, playedWithUids } = await fetchInvitableUsers(uid));
      } catch (err) {
        console.error('Failed to fetch invitable users:', err);
        callback({ players: [] });
        return;
      }

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

    guarded(socket, 'fetch-partner-stats', async (callback: (data: { partners: PartnerStats[]; needsAuth?: boolean }) => void) => {
      const uid = getSocketUid(socket.id);
      if (!uid) {
        callback({ partners: [], needsAuth: true });
        return;
      }
      try {
        const partners = await fetchPartnerStats(uid);
        callback({ partners });
      } catch (err) {
        console.error('Failed to fetch partner stats:', err);
        callback({ partners: [] });
      }
    });

    guarded(socket, 'fetch-user-stats', async (callback: (data: { stats: UserStats | null; needsAuth?: boolean }) => void) => {
      const uid = getSocketUid(socket.id);
      if (!uid) {
        callback({ stats: null, needsAuth: true });
        return;
      }
      try {
        callback({ stats: await fetchUserStats(uid) });
      } catch (err) {
        console.error('Failed to fetch user stats:', err);
        callback({ stats: null });
      }
    });

    guarded(socket, 'fetch-team-stats', async ({ partnerUid }: { partnerUid: unknown }, callback: (data: { team: TeamStats | null; needsAuth?: boolean }) => void) => {
      const uid = getSocketUid(socket.id);
      if (!uid) {
        callback({ team: null, needsAuth: true });
        return;
      }
      if (typeof partnerUid !== 'string' || !partnerUid || partnerUid === uid) {
        callback({ team: null });
        return;
      }
      try {
        callback({ team: await fetchTeamStats(uid, partnerUid) });
      } catch (err) {
        console.error('Failed to fetch team stats:', err);
        callback({ team: null });
      }
    });

    guarded(socket, 'fetch-recent-games', async (callback: (data: { games: GameSummary[]; needsAuth?: boolean }) => void) => {
      const uid = getSocketUid(socket.id);
      if (!uid) {
        callback({ games: [], needsAuth: true });
        return;
      }
      try {
        callback({ games: await fetchRecentGames(uid) });
      } catch (err) {
        console.error('Failed to fetch recent games:', err);
        callback({ games: [] });
      }
    });

    guarded(socket, 'fetch-game-history', async ({ gameId }: { gameId: string }, callback: (data: { rounds: GameHistoryRound[]; needsAuth?: boolean }) => void) => {
      const uid = getSocketUid(socket.id);
      if (!uid) {
        callback({ rounds: [], needsAuth: true });
        return;
      }
      try {
        const rounds = await fetchGameHistory(uid, gameId);
        callback({ rounds: rounds ?? [] });
      } catch (err) {
        console.error('Failed to fetch game history:', err);
        callback({ rounds: [] });
      }
    });

    guarded(socket, 'fetch-room-elos', async (callback: (data: RoomElos) => void) => {
      const empty: RoomElos = { seatElos: [null, null, null, null], teamElos: [null, null] };
      const found = getRoomBySocket(socket.id);
      if (!found) {
        callback(empty);
        return;
      }
      try {
        callback(await fetchRoomElos(found.room));
      } catch (err) {
        console.error('Failed to fetch room elos:', err);
        callback(empty);
      }
    });

    guarded(socket, 'send-invite', ({ targetUid }: { targetUid: string }) => {
      const fromUid = getSocketUid(socket.id);
      if (!fromUid) return;

      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;

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
    });

    guarded(socket, 'respond-invite', ({ inviteId, accept, playerName, photoURL, sessionId }: { inviteId: string; accept: boolean; playerName?: string; photoURL?: string | null; sessionId?: string }) => {
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

      leaveCurrentRoom();
      const result = joinRoom(invite.roomCode, socket.id, playerName, typeof sessionId === 'string' ? sessionId : undefined);
      if ('error' in result) {
        socket.emit('error', { message: result.error });
        return;
      }

      const { room, seat } = result;
      room.state.players[seat].photoURL = typeof photoURL === 'string' ? photoURL : null;
      socket.join(room.code);
      io.to(room.code).emit('player-joined', { playerName, seat });
      broadcastState(io, room);

      socket.emit('room-joined-via-invite', {
        roomCode: room.code,
        randomPartners: room.randomPartners,
      });
    });

    // ===== User Profile (via Admin SDK) =====

    guarded(socket, 'load-profile', async (callback: (data: ({ profile: unknown } | { error: string }) & { needsAuth?: boolean }) => void) => {
      const uid = getSocketUid(socket.id);
      if (!uid) {
        callback({ error: 'Not authenticated', needsAuth: true });
        return;
      }
      if (!firebaseAdmin) {
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
          // Firestore rejects `undefined` values, so fall through to null.
          await docRef.set({
            displayName: authUser.displayName || data.displayName || null,
            email: authUser.email || data.email || null,
            photoURL: authUser.photoURL ?? data.photoURL ?? null,
          }, { merge: true });

          callback({
            profile: {
              uid,
              displayName: data.displayName || authUser.displayName || 'Player',
              email: data.email || authUser.email || '',
              photoURL: authUser.photoURL ?? data.photoURL ?? null,
              stats: await fetchUserStats(uid),
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
            profile: { uid, ...newProfile, stats: await fetchUserStats(uid) },
          });
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        callback({ error: 'Failed to load profile' });
      }
    });

    guarded(socket, 'save-settings', async ({ settings, randomPartners }: { settings: unknown; randomPartners?: unknown }) => {
      const uid = getSocketUid(socket.id);
      if (!uid || !firebaseAdmin) return;
      try {
        const db = firebaseAdmin.firestore();
        const docRef = db.collection('users').doc(uid);
        const prefs: Record<string, unknown> = { lastSettings: sanitizeSettings(settings) };
        if (typeof randomPartners === 'boolean') {
          prefs.lastRandomPartners = randomPartners;
        }
        await docRef.set({ preferences: prefs }, { merge: true });
      } catch (err) {
        console.error('Failed to save settings:', err);
      }
    });

    guarded(socket, 'disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      const found = getRoomBySocket(socket.id);
      removePlayer(socket.id);
      // Let remaining players see the disconnected indicator right away.
      if (found) {
        const room = getRoom(found.room.code);
        if (room) broadcastState(io, room);
      }
      rateLimiter.cleanup(socket.id);
      const count = connectionsPerIp.get(ip) ?? 1;
      if (count <= 1) {
        connectionsPerIp.delete(ip);
      } else {
        connectionsPerIp.set(ip, count - 1);
      }
    });
  });
}

// SSE push callback, set by api.ts
let sseBroadcastCallback: ((room: Room) => void) | null = null;
export function setSseBroadcastCallback(cb: (room: Room) => void): void {
  sseBroadcastCallback = cb;
}

// Notify callback for per-seat events (need-mah-jong-wish, need-dragon-choice), set by api.ts
let sseNotifyCallback: ((roomCode: string, seat: Seat, event: string, data?: unknown) => void) | null = null;
export function setSseNotifyCallback(cb: (roomCode: string, seat: Seat, event: string, data?: unknown) => void): void {
  sseNotifyCallback = cb;
}

export function broadcastState(io: Server, room: Room): void {
  const aiOpenSeats = Array.from(room.aiOpenSeats);
  const disconnectedSeats = getDisconnectedSeats(room);
  // The organizer can change without a socket event (the creator's waiting-
  // room seat expired and the role passed on), so every broadcast says who
  // holds it instead of relying on the one-time room-created/rejoined reply.
  const organizerSeat = room.playerSockets.get(room.organizer) ?? null;
  for (const [socketId, seat] of room.playerSockets) {
    if (isApiPlayer(socketId)) continue;
    // Self-heal the persistent seat->uid map from live, authenticated sockets so
    // a player who later disconnects is still attributed at game end. Set-only:
    // a not-yet-authenticated socket must not wipe a previously-known uid.
    const uid = getSocketUid(socketId);
    if (uid) room.seatUids.set(seat, uid);
    const clientState = toClientState(room.state, seat);
    io.to(socketId).emit('game-state', { state: clientState, aiOpenSeats, disconnectedSeats, organizerSeat });
  }
  sseBroadcastCallback?.(room);
  // Snapshot the room (debounced) so it survives a server restart.
  persistRoom(room);
}

/** Notify a specific seat about an event (handles both socket and API players) */
function notifySeat(io: Server, room: Room, seat: Seat, event: string, data?: unknown): void {
  const socketId = room.seatPlayers.get(seat);
  if (!socketId) return;
  if (isApiPlayer(socketId)) {
    sseNotifyCallback?.(room.code, seat, event, data);
  } else {
    io.to(socketId).emit(event, data);
  }
}

/**
 * Shared post-action logic for play-cards, pass-turn, bomb, give-dragon-trick, concede.
 * Handles: applyPlayResult, notifications, trick countdown, round result, auto-skip, broadcast.
 */
export function processPlayResult(io: Server, room: Room, seat: Seat, result: PlayResult): void {
  applyPlayResult(room, result);

  if (result.needMahJongWish) {
    notifySeat(io, room, seat, 'need-mah-jong-wish');
  }
  if (result.needDragonChoice && result.state.dragonGiveawayBy != null) {
    notifySeat(io, room, result.state.dragonGiveawayBy, 'need-dragon-choice');
  }
  if (result.trickCountdownStarted) {
    const timer = setTimeout(() => {
      resolveTrickCountdown(io, room);
    }, result.state.trickCountdown?.durationMs ?? 3000);
    setTrickCountdownTimer(room.code, timer);
    broadcastState(io, room);
    return;
  }
  if (result.roundResult) {
    room.lastRoundResult = result.roundResult;
    io.to(room.code).emit('round-result', { result: result.roundResult });
    sseNotifyCallback?.(room.code, -1 as Seat, 'round-result', { result: result.roundResult });
    handleRoundResult(io, room, result.roundResult);
  }
  if (!result.roundResult) autoSkipHelpless(io, room);
  broadcastState(io, room);
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
      }, result.state.trickCountdown?.durationMs ?? 3000);
      setTrickCountdownTimer(room.code, timer);
      break;
    }

    if (result.roundResult) {
      room.lastRoundResult = result.roundResult;
      io.to(room.code).emit('round-result', { result: result.roundResult });
      sseNotifyCallback?.(room.code, -1 as Seat, 'round-result', { result: result.roundResult });
      handleRoundResult(io, room, result.roundResult);
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
    notifySeat(io, room, result.state.dragonGiveawayBy, 'need-dragon-choice');
  }

  autoSkipHelpless(io, room);
  broadcastState(io, room);
}

function handleRoundResult(io: Server, room: Room, roundResult: RoundResult): void {
  const state = room.state;
  if (state.phase !== 'roundEnd' && state.phase !== 'gameEnd') return;

  // Save round log (fire-and-forget)
  saveRoundLog(room, roundResult).catch(err =>
    console.error('Failed to save round log:', err)
  );

  // Stats are derived from the round logs + game summaries at read time; the
  // only per-user bookkeeping here is the invite list's "played with".
  recordPlayedWith(room).catch(err =>
    console.error('Failed to record played-with:', err)
  );

  // If game is over, write the summary and update Elo ratings
  const isGameEnd = state.phase === 'gameEnd';
  if (isGameEnd) {
    // Top-level game summary so players can browse their recent games; once
    // it's written, compute and broadcast the pairings' head-to-head record
    // (sequenced so the just-finished game is included in the count).
    saveGameSummary(room)
      .catch(err => console.error('Failed to save game summary:', err))
      .then(() => fetchHeadToHead(room))
      .then(h2h => {
        if (h2h && h2h.games > 0) {
          io.to(room.code).emit('head-to-head', h2h);
        }
      })
      .catch(err => console.error('Failed to fetch head-to-head record:', err));

    // Elo: recompute ratings, then broadcast the changes to the room so the
    // game-over screen can show new ratings and deltas.
    updateEloForGameEnd(room)
      .then(update => {
        if (update) {
          io.to(room.code).emit('elo-update', update);
          sseNotifyCallback?.(room.code, -1 as Seat, 'elo-update', update);
        }
      })
      .catch(err => console.error('Failed to update Elo ratings:', err));
  }
}
