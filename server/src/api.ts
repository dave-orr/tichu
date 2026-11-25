import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Server } from 'socket.io';
import { toClientState, Seat, PlayResult, NormalRank } from '@tichu/shared';
import {
  getRoom, addApiPlayer, removeApiPlayer, findRoomWithOpenAiSeat,
  isApiPlayer, handleGrandTichu, handleSmallTichu, handlePassCards,
  handlePlayCards, handlePassTurn, handleBomb, handleDragonGiveaway,
  handleMahJongWish, handleConcede, handleRespondConcede, applyPlayResult, startNextRound,
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
import { noteBotPoll } from './botPresence.js';

// SSE connections, by the API player's synthetic socket id → Response. Keyed
// by player, not seat: seats can move in the waiting room (swaps, and the
// random-partners shuffle at the start), and the stream must follow its bot.
const sseConnections = new Map<string, Response>();

/** The API player sitting in `seat`, if any. */
function apiPlayerAt(room: Room, seat: Seat): string | undefined {
  const socketId = room.seatPlayers.get(seat);
  return socketId && isApiPlayer(socketId) ? socketId : undefined;
}

/**
 * Which API player a request is for: by `player` (the id /join returned,
 * which follows the bot when it is moved to another seat), or by `seat`
 * (older bots; wrong once seats have moved).
 */
function resolveApiPlayer(room: Room, player: unknown, seat: unknown): { socketId: string; seat: Seat } | { status: number; error: string } {
  if (typeof player === 'string' && player) {
    const at = room.playerSockets.get(player);
    if (at === undefined || !isApiPlayer(player)) return { status: 403, error: 'Not an API player in this room' };
    return { socketId: player, seat: at };
  }
  if (!isValidSeat(seat)) return { status: 400, error: 'Invalid seat' };
  const socketId = apiPlayerAt(room, seat);
  if (!socketId) return { status: 403, error: 'Seat is not an API player' };
  return { socketId, seat };
}

function sendSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** A comment line every 20 s keeps the stream open through proxy read timeouts. */
const SSE_KEEPALIVE_MS = 20_000;

/**
 * What an API seat receives: its `ClientGameState`, plus this round's
 * play-phase action log (`RoundAction[]`, the same one round logs carry), so
 * a bot can rebuild the round's history exactly instead of diffing states.
 */
function apiState(room: Room, seat: Seat) {
  return { ...toClientState(room.state, seat), roundActions: room.accumulator.actions };
}

export const MIN_BOT_TOKEN_LENGTH = 16;

function digest(s: string): Buffer {
  return crypto.createHash('sha256').update(s).digest();
}

/**
 * Every /api route needs `Authorization: Bearer $BOT_TOKEN`. Seats are
 * identified by room code + seat number alone, so without this anyone could
 * read an AI seat's hand or play for it. Unset (or too short), the API is off.
 */
function requireBotToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.BOT_TOKEN ?? '';
  if (expected.length < MIN_BOT_TOKEN_LENGTH) {
    res.status(404).json({ error: `AI API disabled: set BOT_TOKEN (>= ${MIN_BOT_TOKEN_LENGTH} chars) in server/.env` });
    return;
  }
  const header = req.headers.authorization ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  // Compare digests so the check is constant-time regardless of length.
  if (!given || !crypto.timingSafeEqual(digest(given), digest(expected))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// Push game-state to all SSE-connected API players in a room
function broadcastToApiPlayers(room: Room): void {
  for (const [socketId, seat] of room.playerSockets) {
    if (!isApiPlayer(socketId)) continue;
    const res = sseConnections.get(socketId);
    if (!res) continue;
    sendSseEvent(res, 'game-state', apiState(room, seat));
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
      const res = sseConnections.get(socketId);
      if (res) sendSseEvent(res, event, data ?? {});
    }
  } else {
    const room = getRoom(roomCode);
    const socketId = room && apiPlayerAt(room, seat);
    const res = socketId && sseConnections.get(socketId);
    if (res) sendSseEvent(res, event, data ?? {});
  }
}

export function createApiRouter(io: Server): Router {
  // Register SSE callbacks with handler.ts
  setSseBroadcastCallback(broadcastToApiPlayers);
  setSseNotifyCallback(notifyApiSeat);

  const router = Router();
  router.use(requireBotToken);
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
    res.json({ seat: result.seat, player: result.player, roomCode: room.code });
  });

  // POST /api/join — Matchmaking: find any room with an open AI seat
  router.post('/join', (req: Request, res: Response) => {
    // The bot's matchmaking poll: it is up and has room for another seat.
    noteBotPoll();
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
    res.json({ seat: result.seat, player: result.player, roomCode: found.room.code });
  });

  // POST /api/rooms/:code/leave — AI leaves the room
  router.post('/rooms/:code/leave', (req: Request, res: Response) => {
    const room = getRoom(req.params.code);
    if (!room) { res.status(404).json({ error: 'Room not found' }); return; }

    const who = resolveApiPlayer(room, req.body?.player, req.body?.seat);
    if ('error' in who) { res.status(who.status).json({ error: who.error }); return; }
    const { socketId, seat } = who;
    const result = removeApiPlayer(room, seat);
    if (result.error) { res.status(400).json(result); return; }

    // Close SSE connection if open
    const sseRes = sseConnections.get(socketId);
    if (sseRes) {
      sseRes.end();
      sseConnections.delete(socketId);
    }

    broadcastState(io, room);
    res.json({ ok: true });
  });

  // GET /api/rooms/:code/stream?player=ID (or ?seat=N) — SSE stream of game events
  router.get('/rooms/:code/stream', (req: Request, res: Response) => {
    const room = getRoom(req.params.code);
    if (!room) { res.status(404).json({ error: 'Room not found' }); return; }

    const seatParam = req.query.seat === undefined ? undefined : Number(req.query.seat);
    const who = resolveApiPlayer(room, req.query.player, seatParam);
    if ('error' in who) { res.status(who.status).json({ error: who.error }); return; }
    const { socketId } = who;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // nginx buffers proxied responses by default, which would hold events back.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const key = socketId;

    // Close any existing SSE connection for this player
    const existing = sseConnections.get(key);
    if (existing) existing.end();

    sseConnections.set(key, res);

    // Send initial state immediately
    sendSseEvent(res, 'game-state', apiState(room, who.seat));

    const keepalive = setInterval(() => res.write(': keepalive\n\n'), SSE_KEEPALIVE_MS);

    // Clean up on disconnect — but only if this is still the registered
    // stream; a replacement may already have taken the key.
    req.on('close', () => {
      clearInterval(keepalive);
      if (sseConnections.get(key) === res) sseConnections.delete(key);
    });
  });

  // POST /api/rooms/:code/action — Submit a game action
  router.post('/rooms/:code/action', (req: Request, res: Response) => {
    const room = getRoom(req.params.code);
    if (!room) { res.status(404).json({ error: 'Room not found' }); return; }

    const { action } = req.body ?? {};
    const who = resolveApiPlayer(room, req.body?.player, req.body?.seat);
    if ('error' in who) { res.status(who.status).json({ error: who.error }); return; }
    if (!action || typeof action !== 'object' || !action.type) {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    const s = who.seat;
    // The engine returns the same state object for a move it refuses.
    const before = room.state;

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
          // Optional, as on the socket: the Phoenix's rank in a straight it
          // could extend at either end. Anything else: the default reading.
          const pa = action.phoenixAs;
          const phoenixAs = Number.isInteger(pa) && pa >= 2 && pa <= 14 ? pa as NormalRank : undefined;
          const result = handlePlayCards(room, s, action.cards, phoenixAs);
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
          const result = handleBomb(room, s, action.cards);
          // Only a bomb the engine accepted cancels the running countdown; a
          // rejected one must leave the timer to award the trick.
          if (result.state !== room.state) clearTrickCountdownTimer(room.code);
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
          const result = handleConcede(room, s);
          if (result.state !== room.state) clearTrickCountdownTimer(room.code);
          processPlayResult(io, room, s, result);
          break;
        }

        case 'respond-concede': {
          if (typeof action.accept !== 'boolean') {
            res.status(400).json({ error: 'accept must be a boolean' });
            return;
          }
          const offer = room.state.concedeOffer;
          const result = handleRespondConcede(room, s, action.accept);
          if (result.state !== room.state && !action.accept && offer) {
            io.to(room.code).emit('concede-declined', { seat: s, by: offer.by });
          }
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

      // `next-round` only marks the seat ready, in place.
      if (action.type !== 'next-round' && room.state === before) {
        res.status(409).json({ error: 'Move not accepted in the current state' });
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
