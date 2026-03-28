import { Router, Request, Response } from 'express';
import { Server } from 'socket.io';
import { toClientState, Seat, PlayResult } from '@tichu/shared';
import {
  getRoom, addApiPlayer, removeApiPlayer, findRoomWithOpenAiSeat,
  isApiPlayer, handleGrandTichu, handleSmallTichu, handlePassCards,
  handlePlayCards, handlePassTurn, handleBomb, handleDragonGiveaway,
  handleMahJongWish, handleConcede, applyPlayResult, startNextRound,
  clearTrickCountdownTimer, Room,
} from './rooms.js';
import {
  isValidCard, isValidCardArray, isValidSeat, isValidNormalRank,
  isValidPassCards,
} from './validation.js';
import {
  broadcastState, processPlayResult,
  setSseBroadcastCallback, setSseNotifyCallback,
} from './handler.js';

// SSE connections: "roomCode:seat" → Response
const sseConnections = new Map<string, Response>();

function sseKey(roomCode: string, seat: Seat): string {
  return `${roomCode}:${seat}`;
}

function sendSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Push game-state to all SSE-connected API players in a room
function broadcastToApiPlayers(room: Room): void {
  for (const [socketId, seat] of room.playerSockets) {
    if (!isApiPlayer(socketId)) continue;
    const key = sseKey(room.code, seat);
    const res = sseConnections.get(key);
    if (!res) continue;
    const clientState = toClientState(room.state, seat);
    sendSseEvent(res, 'game-state', clientState);
  }
}

// Notify a specific seat (or all API seats if seat === -1) via SSE
function notifyApiSeat(roomCode: string, seat: Seat, event: string, data?: unknown): void {
  if ((seat as number) === -1) {
    // Broadcast to all API seats in this room
    const room = getRoom(roomCode);
    if (!room) return;
    for (const [socketId, s] of room.playerSockets) {
      if (!isApiPlayer(socketId)) continue;
      const res = sseConnections.get(sseKey(roomCode, s));
      if (res) sendSseEvent(res, event, data ?? {});
    }
  } else {
    const res = sseConnections.get(sseKey(roomCode, seat));
    if (res) sendSseEvent(res, event, data ?? {});
  }
}

export function createApiRouter(io: Server): Router {
  // Register SSE callbacks with handler.ts
  setSseBroadcastCallback(broadcastToApiPlayers);
  setSseNotifyCallback(notifyApiSeat);

  const router = Router();
  router.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  // POST /api/rooms/:code/join — AI claims an AI-open seat
  router.post('/rooms/:code/join', (req: Request, res: Response) => {
    const room = getRoom(req.params.code);
    if (!room) { res.status(404).json({ error: 'Room not found' }); return; }

    const { name, seat } = req.body ?? {};
    if (!name || typeof name !== 'string' || name.length > 20) {
      res.status(400).json({ error: 'Invalid name' });
      return;
    }

    const result = addApiPlayer(room, name, isValidSeat(seat) ? seat : undefined);
    if ('error' in result) { res.status(400).json(result); return; }

    broadcastState(io, room);
    res.json({ seat: result.seat, roomCode: room.code });
  });

  // POST /api/join — Matchmaking: find any room with an open AI seat
  router.post('/join', (req: Request, res: Response) => {
    const { name } = req.body ?? {};
    if (!name || typeof name !== 'string' || name.length > 20) {
      res.status(400).json({ error: 'Invalid name' });
      return;
    }

    const found = findRoomWithOpenAiSeat();
    if (!found) { res.status(404).json({ error: 'No rooms with open AI seats' }); return; }

    const result = addApiPlayer(found.room, name, found.seat);
    if ('error' in result) { res.status(400).json(result); return; }

    broadcastState(io, found.room);
    res.json({ seat: result.seat, roomCode: found.room.code });
  });

  // POST /api/rooms/:code/leave — AI leaves the room
  router.post('/rooms/:code/leave', (req: Request, res: Response) => {
    const room = getRoom(req.params.code);
    if (!room) { res.status(404).json({ error: 'Room not found' }); return; }

    const { seat } = req.body ?? {};
    if (!isValidSeat(seat)) { res.status(400).json({ error: 'Invalid seat' }); return; }

    const result = removeApiPlayer(room, seat);
    if (result.error) { res.status(400).json(result); return; }

    // Close SSE connection if open
    const key = sseKey(room.code, seat);
    const sseRes = sseConnections.get(key);
    if (sseRes) {
      sseRes.end();
      sseConnections.delete(key);
    }

    broadcastState(io, room);
    res.json({ ok: true });
  });

  // GET /api/rooms/:code/stream?seat=N — SSE stream of game events
  router.get('/rooms/:code/stream', (req: Request, res: Response) => {
    const room = getRoom(req.params.code);
    if (!room) { res.status(404).json({ error: 'Room not found' }); return; }

    const seat = Number(req.query.seat);
    if (!isValidSeat(seat)) { res.status(400).json({ error: 'Invalid seat' }); return; }

    // Verify this seat is an API player
    const socketId = room.seatPlayers.get(seat as Seat);
    if (!socketId || !isApiPlayer(socketId)) {
      res.status(403).json({ error: 'Seat is not an API player' });
      return;
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const key = sseKey(room.code, seat as Seat);

    // Close any existing SSE connection for this seat
    const existing = sseConnections.get(key);
    if (existing) existing.end();

    sseConnections.set(key, res);

    // Send initial state immediately
    const clientState = toClientState(room.state, seat as Seat);
    sendSseEvent(res, 'game-state', clientState);

    // Clean up on disconnect
    req.on('close', () => {
      sseConnections.delete(key);
    });
  });

  // POST /api/rooms/:code/action — Submit a game action
  router.post('/rooms/:code/action', (req: Request, res: Response) => {
    const room = getRoom(req.params.code);
    if (!room) { res.status(404).json({ error: 'Room not found' }); return; }

    const { seat, action } = req.body ?? {};
    if (!isValidSeat(seat)) { res.status(400).json({ error: 'Invalid seat' }); return; }
    if (!action || typeof action !== 'object' || !action.type) {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    // Verify this seat is an API player
    const socketId = room.seatPlayers.get(seat as Seat);
    if (!socketId || !isApiPlayer(socketId)) {
      res.status(403).json({ error: 'Seat is not an API player' });
      return;
    }

    const s = seat as Seat;

    try {
      switch (action.type) {
        case 'call-grand-tichu': {
          if (typeof action.call !== 'boolean') {
            res.status(400).json({ error: 'call must be a boolean' });
            return;
          }
          handleGrandTichu(room, s, action.call);
          broadcastState(io, room);
          break;
        }

        case 'call-small-tichu': {
          handleSmallTichu(room, s);
          broadcastState(io, room);
          break;
        }

        case 'pass-cards': {
          if (!isValidPassCards(action)) {
            res.status(400).json({ error: 'Invalid pass cards' });
            return;
          }
          handlePassCards(room, s, action);
          broadcastState(io, room);
          break;
        }

        case 'play-cards': {
          if (!isValidCardArray(action.cards)) {
            res.status(400).json({ error: 'Invalid cards' });
            return;
          }
          const result = handlePlayCards(room, s, action.cards);
          processPlayResult(io, room, s, result);
          break;
        }

        case 'pass-turn': {
          const result = handlePassTurn(room, s);
          processPlayResult(io, room, s, result);
          break;
        }

        case 'bomb': {
          if (!isValidCardArray(action.cards)) {
            res.status(400).json({ error: 'Invalid cards' });
            return;
          }
          clearTrickCountdownTimer(room.code);
          const result = handleBomb(room, s, action.cards);
          const modifiedResult = { ...result, state: { ...result.state, bombWindow: false } };
          processPlayResult(io, room, s, modifiedResult);
          break;
        }

        case 'give-dragon-trick': {
          if (!isValidSeat(action.to)) {
            res.status(400).json({ error: 'Invalid seat' });
            return;
          }
          const result = handleDragonGiveaway(room, s, action.to);
          processPlayResult(io, room, s, result);
          break;
        }

        case 'mah-jong-wish': {
          if (action.rank !== null && !isValidNormalRank(action.rank)) {
            res.status(400).json({ error: 'Invalid rank' });
            return;
          }
          handleMahJongWish(room, s, action.rank);
          broadcastState(io, room);
          break;
        }

        case 'concede': {
          clearTrickCountdownTimer(room.code);
          const result = handleConcede(room, s);
          processPlayResult(io, room, s, result);
          break;
        }

        case 'next-round': {
          if (room.state.phase === 'roundEnd') {
            if (!room.state.roundEndReady.includes(s)) {
              room.state.roundEndReady.push(s);
            }
            if (room.state.roundEndReady.length === 4) {
              startNextRound(room);
            }
            broadcastState(io, room);
          }
          break;
        }

        default:
          res.status(400).json({ error: `Unknown action type: ${action.type}` });
          return;
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('API action error:', err);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  return router;
}
