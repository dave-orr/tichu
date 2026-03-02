import { Server, Socket } from 'socket.io';
import { toClientState, Seat, Card, NormalRank, GameSettings } from '@tichu/shared';
import {
  createRoom, joinRoom, getRoomBySocket, removePlayer,
  canStartGame, startGame, handleGrandTichu, handleSmallTichu,
  handlePassCards, handlePlayCards, handlePassTurn, handleBomb,
  handleDragonGiveaway, handleMahJongWish, applyPlayResult,
  startNextRound, swapSeats, Room, setSocketUid,
} from './rooms.js';
import { verifyIdToken } from './firebase.js';
import { updateStatsForRound, updateStatsForGameEnd, updateTeamStats, saveRoundLog } from './stats.js';

// Simple per-socket rate limiter: max `limit` events per `windowMs`.
function createRateLimiter(windowMs: number, limit: number) {
  const counts = new Map<string, { count: number; resetAt: number }>();
  return (socketId: string): boolean => {
    const now = Date.now();
    const entry = counts.get(socketId);
    if (!entry || now >= entry.resetAt) {
      counts.set(socketId, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  };
}

const rateLimiter = createRateLimiter(1000, 20); // 20 events per second per socket

export function setupHandlers(io: Server): void {
  io.on('connection', async (socket: Socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Rate limit all incoming events
    socket.use((event, next) => {
      if (rateLimiter(socket.id)) {
        next();
      } else {
        next(new Error('Rate limit exceeded'));
      }
    });

    // Verify Firebase token if provided
    const token = socket.handshake.auth?.token;
    if (token) {
      const decoded = await verifyIdToken(token);
      if (decoded) {
        setSocketUid(socket.id, decoded.uid);
        console.log(`Authenticated user: ${decoded.uid}`);
      }
    }

    socket.on('create-room', ({ playerName, randomPartners, settings }: { playerName: string; randomPartners?: boolean; settings?: Partial<GameSettings> }) => {
      const room = createRoom(socket.id, playerName, randomPartners ?? false, settings);
      socket.join(room.code);
      socket.emit('room-created', { roomCode: room.code, randomPartners: room.randomPartners });
      broadcastState(io, room);
    });

    socket.on('join-room', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
      const result = joinRoom(roomCode, socket.id, playerName);
      if ('error' in result) {
        socket.emit('error', { message: result.error });
        return;
      }
      const { room, seat } = result;
      socket.join(room.code);
      io.to(room.code).emit('player-joined', { playerName, seat });
      broadcastState(io, room);
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

    socket.on('pass-cards', ({ left, partner, right }: { left: Card; partner: Card; right: Card }) => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      handlePassCards(room, seat, { left, partner, right });
      broadcastState(io, room);
    });

    socket.on('play-cards', ({ cards }: { cards: Card[] }) => {
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

      broadcastState(io, room);
    });

    socket.on('pass-turn', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      const result = handlePassTurn(room, seat);
      applyPlayResult(room, result);

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

    socket.on('bomb', ({ cards }: { cards: Card[] }) => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      const result = handleBomb(room, seat, cards);
      applyPlayResult(room, result);
      // Clear bomb window
      room.state = { ...room.state, bombWindow: false };

      if (result.roundResult) {
        io.to(room.code).emit('round-result', { result: result.roundResult });
        handleRoundResult(room, result.roundResult);
      }

      broadcastState(io, room);
    });

    socket.on('give-dragon-trick', ({ to }: { to: Seat }) => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      const result = handleDragonGiveaway(room, seat, to);
      applyPlayResult(room, result);

      if (result.roundResult) {
        io.to(room.code).emit('round-result', { result: result.roundResult });
        handleRoundResult(room, result.roundResult);
      }

      broadcastState(io, room);
    });

    socket.on('mah-jong-wish', ({ rank }: { rank: NormalRank }) => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      handleMahJongWish(room, seat, rank);
      broadcastState(io, room);
    });

    socket.on('next-round', () => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room } = found;
      if (room.state.phase === 'roundEnd') {
        startNextRound(room);
        broadcastState(io, room);
      }
    });

    socket.on('swap-seats', ({ seatA, seatB }: { seatA: Seat; seatB: Seat }) => {
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

    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      removePlayer(socket.id);
    });
  });
}

function broadcastState(io: Server, room: Room): void {
  for (const [socketId, seat] of room.playerSockets) {
    const clientState = toClientState(room.state, seat);
    io.to(socketId).emit('game-state', { state: clientState });
  }
}

function handleRoundResult(room: Room, roundResult: import('@tichu/shared').RoundResult): void {
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
