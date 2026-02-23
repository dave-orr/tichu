import { Server, Socket } from 'socket.io';
import { toClientState, Seat, Card, NormalRank } from '@tichu/shared';
import {
  createRoom, joinRoom, getRoomBySocket, removePlayer,
  canStartGame, startGame, handleGrandTichu, handleSmallTichu,
  handlePassCards, handlePlayCards, handlePassTurn, handleBomb,
  handleDragonGiveaway, handleMahJongWish, applyPlayResult,
  startNextRound, swapSeats, Room,
} from './rooms.js';

export function setupHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('create-room', ({ playerName, randomPartners }: { playerName: string; randomPartners?: boolean }) => {
      const room = createRoom(socket.id, playerName, randomPartners ?? false);
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
      }

      broadcastState(io, room);
    });

    socket.on('bomb', ({ cards }: { cards: Card[] }) => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room, seat } = found;
      const result = handleBomb(room, seat, cards);
      applyPlayResult(room, result);

      if (result.roundResult) {
        io.to(room.code).emit('round-result', { result: result.roundResult });
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
      }

      broadcastState(io, room);
    });

    socket.on('mah-jong-wish', ({ rank }: { rank: NormalRank }) => {
      const found = getRoomBySocket(socket.id);
      if (!found) return;
      const { room } = found;
      handleMahJongWish(room, rank);
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
