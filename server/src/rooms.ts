import {
  GameState, GameSettings, DEFAULT_SETTINGS, Seat, createInitialState, startNewRound,
  callGrandTichu, callSmallTichu, passCards as passCardsEngine, undoPassCards,
  applyPasses, playCards, passTurn, playBomb, awardTrick,
  giveDragonTrick, setMahJongWish, toClientState, concede as concedeEngine,
  Card, NormalRank, PlayResult, RoundResult, PassInfo, cardId,
} from '@tichu/shared';

export type RoundAccumulator = {
  gameId: string;
  initialHands: Map<Seat, Card[]>;
  passes: Map<Seat, PassInfo>;
  bombs: Array<{ seat: Seat; cards: Card[] }>;
  dragonGiveaways: Array<{ fromSeat: Seat; toSeat: Seat }>;
  mahJongWishes: Array<{ seat: Seat; rank: NormalRank }>;
  scoresAtRoundStart: [number, number];
  wasDown300: [boolean, boolean]; // per team, tracked across the whole game
};

// Per-seat bomb-announce throttle state (anti-spam). Lives on the Room so it is
// garbage-collected with the room.
export type BombThrottle = { count: number; windowStart: number; blockedUntil: number };

export type Room = {
  code: string;
  state: GameState;
  playerSockets: Map<string, Seat>; // socket.id -> seat
  seatPlayers: Map<Seat, string>;   // seat -> socket.id
  seatSessions: Map<Seat, string>;  // seat -> client session token (reconnect key)
  seatUids: Map<Seat, string>;      // seat -> Firebase uid (persists across disconnects; humans only)
  passes: Map<Seat, PassInfo>;      // pending card passes
  randomPartners: boolean;
  organizer: string;                // socket.id of room creator
  organizerSession: string;         // session token of room creator (survives reconnect)
  gameId: string;
  accumulator: RoundAccumulator;
  aiOpenSeats: Set<Seat>;           // seats marked as open for AI players
  bombAnnounceThrottle: Map<Seat, BombThrottle>; // per-seat bomb-announce rate state
  // Result of the round that just ended, re-sent to anyone who (re)joins while
  // the table is on the roundEnd/gameEnd screen (the round-result event itself
  // is only emitted once, at the moment the round ends).
  lastRoundResult: RoundResult | null;
};

/** Live human sockets in a room (API/AI players are excluded). */
export function humanSocketCount(room: Room): number {
  let n = 0;
  for (const socketId of room.playerSockets.keys()) {
    if (!isApiPlayer(socketId)) n++;
  }
  return n;
}

/**
 * Seats occupied by a human who currently has no live socket connection.
 * Used to show a "disconnected" indicator and to know the table is waiting.
 */
export function getDisconnectedSeats(room: Room): Seat[] {
  const connectedSeats = new Set(room.playerSockets.values());
  const result: Seat[] = [];
  for (const p of room.state.players) {
    if (p.isAi) continue;
    if (!p.name) continue; // empty seat
    if (!connectedSeats.has(p.seat)) result.push(p.seat);
  }
  return result;
}

const rooms = new Map<string, Room>();
// Reverse map: socket.id -> room code for O(1) room lookups
const socketRooms = new Map<string, string>();
// Trick countdown timers per room
const trickCountdownTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Bomb-window auto-close timers per room (bounds how long a bomb window may
// defer trick resolution / linger after being opened).
const bombWindowTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function setTrickCountdownTimer(roomCode: string, timer: ReturnType<typeof setTimeout>): void {
  // Never let a previous timer leak: an orphaned one could fire after the room
  // is gone (and resurrect its snapshot via broadcastState → persistRoom).
  clearTrickCountdownTimer(roomCode);
  trickCountdownTimers.set(roomCode, timer);
}

export function clearTrickCountdownTimer(roomCode: string): void {
  const timer = trickCountdownTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    trickCountdownTimers.delete(roomCode);
  }
}

export function setBombWindowTimer(roomCode: string, timer: ReturnType<typeof setTimeout>): void {
  bombWindowTimers.set(roomCode, timer);
}

export function clearBombWindowTimer(roomCode: string): void {
  const timer = bombWindowTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    bombWindowTimers.delete(roomCode);
  }
}

export function handleAwardTrick(room: Room): PlayResult {
  trickCountdownTimers.delete(room.code);
  return awardTrick(room.state);
}

// Map socket.id -> Firebase uid for authenticated players
const socketUids = new Map<string, string>();
// Reverse map: uid -> socket.id (for sending invites to specific users)
const uidSockets = new Map<string, string>();

export function setSocketUid(socketId: string, uid: string): void {
  // Re-authenticating as someone else must not leave the old uid pointing at
  // this socket (invites for that uid would reach the wrong person).
  const previous = socketUids.get(socketId);
  if (previous && previous !== uid && uidSockets.get(previous) === socketId) {
    uidSockets.delete(previous);
  }
  socketUids.set(socketId, uid);
  uidSockets.set(uid, socketId);
}

/**
 * Forget a socket's authentication (sign-out, or the socket went away). The
 * uid → socket entry is only removed when it still points at this socket, so
 * closing one of two tabs doesn't mark the account offline.
 */
export function clearSocketUid(socketId: string): void {
  const uid = socketUids.get(socketId);
  socketUids.delete(socketId);
  if (uid && uidSockets.get(uid) === socketId) uidSockets.delete(uid);
}

export function getSocketUid(socketId: string): string | null {
  return socketUids.get(socketId) ?? null;
}

/**
 * Persist the authenticated uid for a seat so it survives the player's
 * disconnects. `socketUids` is keyed by live socket and is wiped when a socket
 * drops, so without this the uid of a momentarily-disconnected player is
 * unrecoverable — which previously caused that seat (and any pairing it was
 * part of) to be silently skipped when Elo / stats were computed at game end.
 * Records the uid when known; clears the seat when the new occupant is
 * anonymous, so a guest substitute never inherits the prior player's uid.
 */
export function recordSeatUid(room: Room, seat: Seat, socketId: string): void {
  const uid = getSocketUid(socketId);
  if (uid) room.seatUids.set(seat, uid);
  else room.seatUids.delete(seat);
}

export function getSocketForUid(uid: string): string | null {
  return uidSockets.get(uid) ?? null;
}

export function isUidOnline(uid: string): boolean {
  return uidSockets.has(uid);
}

export function isUidAvailable(uid: string): boolean {
  const socketId = uidSockets.get(uid);
  if (!socketId) return false;
  return getRoomBySocket(socketId) === null;
}

// ===== Pending Invites (in-memory, transient) =====

export type PendingInvite = {
  id: string;
  roomCode: string;
  fromUid: string;
  fromName: string;
  targetUid: string;
  createdAt: number;
};

const pendingInvites = new Map<string, PendingInvite>();
const invitesByTarget = new Map<string, Set<string>>();

export function createInvite(roomCode: string, fromUid: string, fromName: string, targetUid: string): PendingInvite | null {
  const room = getRoom(roomCode);
  if (!room) return null;
  if (room.state.phase !== 'waiting') return null;
  if (room.seatPlayers.size >= 4) return null;

  // Don't duplicate invites to same user for same room
  const existingIds = invitesByTarget.get(targetUid);
  if (existingIds) {
    for (const id of existingIds) {
      const inv = pendingInvites.get(id);
      if (inv && inv.roomCode === roomCode) return null;
    }
  }

  const invite: PendingInvite = {
    id: `${roomCode}_${targetUid}_${Date.now()}`,
    roomCode,
    fromUid,
    fromName,
    targetUid,
    createdAt: Date.now(),
  };
  pendingInvites.set(invite.id, invite);
  if (!invitesByTarget.has(targetUid)) invitesByTarget.set(targetUid, new Set());
  invitesByTarget.get(targetUid)!.add(invite.id);
  return invite;
}

export function removeInvite(inviteId: string): void {
  const invite = pendingInvites.get(inviteId);
  if (!invite) return;
  pendingInvites.delete(inviteId);
  invitesByTarget.get(invite.targetUid)?.delete(inviteId);
}

export function getInvite(inviteId: string): PendingInvite | undefined {
  return pendingInvites.get(inviteId);
}

export function getInvitesForUser(uid: string): PendingInvite[] {
  const ids = invitesByTarget.get(uid);
  if (!ids) return [];
  const result: PendingInvite[] = [];
  for (const id of ids) {
    const inv = pendingInvites.get(id);
    if (!inv) continue;
    const room = getRoom(inv.roomCode);
    if (!room || room.state.phase !== 'waiting' || room.seatPlayers.size >= 4) {
      removeInvite(id);
      continue;
    }
    result.push(inv);
  }
  return result;
}

export function clearInvitesForRoom(roomCode: string): void {
  for (const [id, inv] of pendingInvites) {
    if (inv.roomCode === roomCode) removeInvite(id);
  }
}

function createAccumulator(gameId: string, scores: [number, number], prevWasDown300?: [boolean, boolean]): RoundAccumulator {
  const diff = scores[0] - scores[1];
  const wasDown300: [boolean, boolean] = prevWasDown300
    ? [prevWasDown300[0] || diff <= -300, prevWasDown300[1] || diff >= 300]
    : [false, false];
  return {
    gameId,
    initialHands: new Map(),
    passes: new Map(),
    bombs: [],
    dragonGiveaways: [],
    mahJongWishes: [],
    scoresAtRoundStart: scores,
    wasDown300,
  };
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code: string;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

export function createRoom(socketId: string, playerName: string, randomPartners: boolean, settings?: Partial<GameSettings>, sessionId?: string): Room {
  const code = generateRoomCode();
  // `settings` must already be sanitized (see validation.ts sanitizeSettings).
  const gameSettings: GameSettings = { ...DEFAULT_SETTINGS, ...settings };
  const state = createInitialState(gameSettings);
  state.players[0].id = socketId;
  state.players[0].name = playerName;

  const gameId = `${code}_${Date.now()}`;
  const room: Room = {
    code,
    state,
    playerSockets: new Map([[socketId, 0]]),
    seatPlayers: new Map([[0, socketId]]),
    seatSessions: new Map(sessionId ? [[0 as Seat, sessionId]] : []),
    seatUids: new Map(),
    passes: new Map(),
    randomPartners,
    organizer: socketId,
    organizerSession: sessionId ?? '',
    gameId,
    accumulator: createAccumulator(gameId, [0, 0]),
    aiOpenSeats: new Set(),
    bombAnnounceThrottle: new Map(),
    lastRoundResult: null,
  };

  rooms.set(code, room);
  socketRooms.set(socketId, code);
  recordSeatUid(room, 0, socketId);
  return room;
}

export function joinRoom(
  code: string, socketId: string, playerName: string, sessionId?: string
): { room: Room; seat: Seat } | { error: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found' };

  let seat: Seat | null = null;
  if (room.state.phase === 'waiting') {
    // Find the first empty seat that isn't reserved for an AI player.
    for (let i = 0; i < 4; i++) {
      if (!room.seatPlayers.has(i as Seat) && !room.aiOpenSeats.has(i as Seat)) {
        seat = i as Seat;
        break;
      }
    }
    if (seat === null) return { error: 'Room is full' };
  } else {
    // Mid-game: a newcomer with the code can fill in for a dropped player by
    // taking over a currently-disconnected seat (keeping its hand/tricks).
    const disconnected = getDisconnectedSeats(room);
    seat = disconnected.length > 0 ? disconnected[0] : null;
    if (seat === null) return { error: 'Game in progress — no open seats' };
    // Drop the stale socket mapping the dropped player left behind.
    const oldSocketId = room.seatPlayers.get(seat);
    if (oldSocketId) {
      room.playerSockets.delete(oldSocketId);
      socketRooms.delete(oldSocketId);
    }
  }

  room.state.players[seat].id = socketId;
  room.state.players[seat].name = playerName;
  room.playerSockets.set(socketId, seat);
  room.seatPlayers.set(seat, socketId);
  if (sessionId) room.seatSessions.set(seat, sessionId);
  // Bind the seat to the new occupant's uid (clears it for a guest substitute).
  recordSeatUid(room, seat, socketId);
  socketRooms.set(socketId, room.code);

  // A substitute taking over cancels any pending teardown for this seat/room.
  clearSeatGraceTimer(room.code, seat);
  if (roomCleanupTimers.has(room.code)) {
    clearTimeout(roomCleanupTimers.get(room.code)!);
    roomCleanupTimers.delete(room.code);
  }

  return { room, seat };
}

export function reconnectToRoom(
  code: string, socketId: string, sessionId: string
): { room: Room; seat: Seat } | { error: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found' };

  // Find the seat that holds this session token (the stable reconnect key)
  let seat: Seat | null = null;
  for (const [s, sess] of room.seatSessions) {
    if (sess === sessionId) {
      seat = s;
      break;
    }
  }
  if (seat === null) return { error: 'Session not found in room' };

  // Update socket mapping (old socket, if any, is replaced by the new one)
  const oldSocketId = room.seatPlayers.get(seat);
  if (oldSocketId) {
    room.playerSockets.delete(oldSocketId);
    socketRooms.delete(oldSocketId);
  }
  room.state.players[seat].id = socketId;
  room.playerSockets.set(socketId, seat);
  room.seatPlayers.set(seat, socketId);
  // Same person reconnecting: refresh the uid if this socket is already
  // authenticated, but keep the previously-recorded one if auth lags the
  // reconnect (it arrives on the handshake) rather than dropping it.
  const reUid = getSocketUid(socketId);
  if (reUid) room.seatUids.set(seat, reUid);
  socketRooms.set(socketId, room.code);

  // Restore organizer status if the room creator reconnected
  if (room.organizerSession && room.organizerSession === sessionId) {
    room.organizer = socketId;
  }

  // Cancel any pending cleanup timers since a player reconnected
  clearSeatGraceTimer(room.code, seat);
  if (roomCleanupTimers.has(room.code)) {
    clearTimeout(roomCleanupTimers.get(room.code)!);
    roomCleanupTimers.delete(room.code);
  }

  return { room, seat };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function getRoomBySocket(socketId: string): { room: Room; seat: Seat } | null {
  const code = socketRooms.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;
  const seat = room.playerSockets.get(socketId);
  if (seat === undefined) return null;
  return { room, seat };
}

const ABANDONED_ROOM_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
// Grace window for a disconnected seat in the waiting room before it is freed,
// so a quick refresh/crash during setup can reclaim the same seat.
const WAITING_GRACE_MS = 45 * 1000;
const roomCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
const seatGraceTimers = new Map<string, ReturnType<typeof setTimeout>>(); // `${code}:${seat}`

// Optional hook invoked whenever a room is permanently torn down, so the
// persistence layer can delete its snapshot. Wired up in handler setup.
let onRoomGone: ((code: string) => void) | null = null;
export function setRoomGoneCallback(cb: (code: string) => void): void {
  onRoomGone = cb;
}

/** Remove a room from memory and notify any teardown listener (persistence). */
function destroyRoom(code: string): void {
  rooms.delete(code);
  onRoomGone?.(code);
}

/**
 * Forcibly close a room: clear every timer/invite tied to it and remove it from
 * memory (and its persisted snapshot). Used when the organizer cancels the room
 * from the waiting room.
 */
export function closeRoom(code: string): void {
  clearTrickCountdownTimer(code);
  clearBombWindowTimer(code);
  const cleanup = roomCleanupTimers.get(code);
  if (cleanup) {
    clearTimeout(cleanup);
    roomCleanupTimers.delete(code);
  }
  for (const seat of [0, 1, 2, 3] as Seat[]) clearSeatGraceTimer(code, seat);
  clearInvitesForRoom(code);
  destroyRoom(code);
}

/**
 * Re-insert a room loaded from a persisted snapshot after a server restart.
 * No live sockets exist yet, so the socket map is cleared (seats stay reserved
 * via seatSessions for reconnection) and an abandoned-cleanup timer is armed so
 * a game nobody returns to is eventually dropped.
 */
export function registerRestoredRoom(room: Room): boolean {
  // Waiting rooms are never snapshotted (see persistence.ts), and an old one
  // would come back with dead socket ids reserving every seat. Drop it.
  if (room.state.phase === 'waiting') return false;
  // Human sockets are gone; API players keep their synthetic ids so their SSE
  // streams pick the game back up once they reconnect.
  room.playerSockets = new Map(
    Array.from(room.playerSockets).filter(([socketId]) => isApiPlayer(socketId))
  );
  // Backfill fields that older snapshots may predate. The seat->uid map is the
  // whole point of persisting: it lets a game that ends right after a restart
  // still rate everyone before they've re-established live sockets.
  if (!room.seatUids) room.seatUids = new Map();
  if (!room.aiOpenSeats) room.aiOpenSeats = new Set();
  if (!room.bombAnnounceThrottle) room.bombAnnounceThrottle = new Map();
  if (!room.passes) room.passes = new Map();
  if (room.lastRoundResult === undefined) room.lastRoundResult = null;
  // No bomb-window timer survives a restart, so don't restore an open window
  // that nothing would ever close. (The trick countdown, if any, is re-armed
  // by the handler layer, which owns the timers.)
  if (room.state.bombWindow) room.state = { ...room.state, bombWindow: false };
  rooms.set(room.code, room);
  const timer = setTimeout(() => {
    roomCleanupTimers.delete(room.code);
    const r = rooms.get(room.code);
    if (r && humanSocketCount(r) === 0) {
      clearTrickCountdownTimer(room.code);
      clearBombWindowTimer(room.code);
      destroyRoom(room.code);
      console.log(`Cleaned up abandoned room: ${room.code}`);
    }
  }, ABANDONED_ROOM_TIMEOUT_MS);
  roomCleanupTimers.set(room.code, timer);
  return true;
}

// Optional hook invoked when a room changes outside of a socket event (a
// waiting-room seat freed by a grace timer) so the handler can re-broadcast.
let onRoomChanged: ((room: Room) => void) | null = null;
export function setRoomChangedCallback(cb: (room: Room) => void): void {
  onRoomChanged = cb;
}


function seatGraceKey(code: string, seat: Seat): string {
  return `${code}:${seat}`;
}

export function clearSeatGraceTimer(code: string, seat: Seat): void {
  const key = seatGraceKey(code, seat);
  const timer = seatGraceTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    seatGraceTimers.delete(key);
  }
}

/**
 * Vacate a waiting-room seat entirely (grace period expired, or the player
 * left on purpose). If the seat belonged to the organizer, the role passes to
 * another seated human so the room can still be started/configured.
 */
function freeSeat(room: Room, seat: Seat): void {
  const socketId = room.seatPlayers.get(seat);
  if (socketId) {
    room.playerSockets.delete(socketId);
    socketRooms.delete(socketId);
  }
  room.seatPlayers.delete(seat);
  room.seatSessions.delete(seat);
  room.seatUids.delete(seat);
  room.state.players[seat].id = '';
  room.state.players[seat].name = '';
  room.state.players[seat].photoURL = null;

  if (socketId && room.organizer === socketId) {
    for (const [otherSeat, otherSocket] of room.seatPlayers) {
      if (isApiPlayer(otherSocket)) continue;
      room.organizer = otherSocket;
      room.organizerSession = room.seatSessions.get(otherSeat) ?? '';
      break;
    }
  }
}

/**
 * A socket dropped (disconnect): forget its auth and detach it from its room,
 * keeping the seat reserved for a reconnect.
 */
export function removePlayer(socketId: string): void {
  clearSocketUid(socketId);
  detachSocket(socketId, false);
}

/**
 * A player deliberately left their room ("Back to Lobby", joining another
 * room, leaving the waiting room). Unlike a disconnect, the seat is not held
 * for them: in the waiting room it is freed at once, and mid-game the session
 * key is dropped so the seat reads as open for a substitute and the leaver's
 * next page load doesn't auto-rejoin. Returns the room left, if any, so the
 * caller can re-broadcast to whoever remains (null if the room was destroyed).
 */
export function leaveRoom(socketId: string): { room: Room; seat: Seat; destroyed: boolean } | null {
  const found = getRoomBySocket(socketId);
  if (!found) return null;
  const { room, seat } = found;
  detachSocket(socketId, true);
  return { room, seat, destroyed: !rooms.has(room.code) };
}

function detachSocket(socketId: string, deliberate: boolean): void {
  const code = socketRooms.get(socketId);
  if (!code) return;
  socketRooms.delete(socketId);

  const room = rooms.get(code);
  if (!room) return;

  const seat = room.playerSockets.get(socketId);
  if (seat === undefined) return;

  room.playerSockets.delete(socketId);

  if (room.state.phase === 'waiting') {
    clearSeatGraceTimer(code, seat);
    if (deliberate) {
      freeSeat(room, seat);
      if (humanSocketCount(room) === 0) {
        clearInvitesForRoom(code);
        destroyRoom(code);
      }
      return;
    }
    // Keep seatPlayers/seatSessions so the seat stays reserved for reconnect,
    // but only for a short grace period so it doesn't block others for good.
    const timer = setTimeout(() => {
      seatGraceTimers.delete(seatGraceKey(code, seat));
      const r = rooms.get(code);
      if (!r) return;
      // The game started while we were waiting — in-game reconnect rules apply,
      // so leave the seat reserved rather than freeing it.
      if (r.state.phase !== 'waiting') return;
      // Bail if the player already reconnected to this seat.
      if (new Set(r.playerSockets.values()).has(seat)) return;
      freeSeat(r, seat);
      if (humanSocketCount(r) === 0) {
        clearInvitesForRoom(code);
        destroyRoom(code);
      } else {
        onRoomChanged?.(r);
      }
    }, WAITING_GRACE_MS);
    seatGraceTimers.set(seatGraceKey(code, seat), timer);
    return;
  }

  if (deliberate) {
    // The seat is no longer theirs to reclaim; a substitute may take it.
    room.seatSessions.delete(seat);
    if (room.organizer === socketId) room.organizerSession = '';
    // A finished game with nobody left in it has nothing to wait for.
    if (room.state.phase === 'gameEnd' && humanSocketCount(room) === 0) {
      clearTrickCountdownTimer(code);
      clearBombWindowTimer(code);
      clearInvitesForRoom(code);
      destroyRoom(code);
      return;
    }
  }

  // For in-progress games, schedule cleanup if all players disconnected
  if (humanSocketCount(room) === 0) {
    const timer = setTimeout(() => {
      roomCleanupTimers.delete(code);
      const r = rooms.get(code);
      if (r && humanSocketCount(r) === 0) {
        clearTrickCountdownTimer(code);
        clearBombWindowTimer(code);
        destroyRoom(code);
        console.log(`Cleaned up abandoned room: ${code}`);
      }
    }, ABANDONED_ROOM_TIMEOUT_MS);
    roomCleanupTimers.set(code, timer);
  } else if (roomCleanupTimers.has(code)) {
    // Someone is still connected, cancel any pending cleanup timer
    clearTimeout(roomCleanupTimers.get(code)!);
    roomCleanupTimers.delete(code);
  }
}

export function canStartGame(room: Room): boolean {
  return room.seatPlayers.size === 4 && room.state.phase === 'waiting';
}

export function startGame(room: Room): void {
  if (room.randomPartners) {
    shuffleSeats(room);
  }
  room.gameId = `${room.code}_${Date.now()}`;
  room.state = startNewRound(room.state);
  room.accumulator = createAccumulator(room.gameId, [0, 0]);
  room.passes.clear();
  room.lastRoundResult = null;
}

/** Randomly assign players to seats */
function shuffleSeats(room: Room): void {
  // Collect all players (everything that identifies the person, not the seat)
  const playerInfos = room.state.players.map(p => ({
    id: p.id, name: p.name, photoURL: p.photoURL, isAi: p.isAi,
    session: room.seatSessions.get(p.seat),
  }));
  // Fisher-Yates shuffle
  for (let i = playerInfos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [playerInfos[i], playerInfos[j]] = [playerInfos[j], playerInfos[i]];
  }
  // Reassign
  room.playerSockets.clear();
  room.seatPlayers.clear();
  room.seatSessions.clear();
  room.seatUids.clear();
  for (let i = 0; i < 4; i++) {
    const seat = i as Seat;
    const { id: socketId, name, photoURL, isAi, session } = playerInfos[i];
    room.state.players[seat].id = socketId;
    room.state.players[seat].name = name;
    room.state.players[seat].photoURL = photoURL;
    room.state.players[seat].isAi = isAi;
    room.playerSockets.set(socketId, seat);
    room.seatPlayers.set(seat, socketId);
    if (session) room.seatSessions.set(seat, session);
    recordSeatUid(room, seat, socketId);
  }
}

/** Swap two players' seats (organizer only) */
export function swapSeats(room: Room, seatA: Seat, seatB: Seat): boolean {
  if (room.state.phase !== 'waiting') return false;
  if (seatA === seatB) return false;

  const socketA = room.seatPlayers.get(seatA);
  const socketB = room.seatPlayers.get(seatB);
  if (!socketA || !socketB) return false;

  // Swap in state (everything that identifies the person, not the seat)
  const a = room.state.players[seatA];
  const b = room.state.players[seatB];
  const tmp = { id: a.id, name: a.name, photoURL: a.photoURL, isAi: a.isAi };
  a.id = b.id; a.name = b.name; a.photoURL = b.photoURL; a.isAi = b.isAi;
  b.id = tmp.id; b.name = tmp.name; b.photoURL = tmp.photoURL; b.isAi = tmp.isAi;

  // Swap socket mappings
  room.playerSockets.set(socketA, seatB);
  room.playerSockets.set(socketB, seatA);
  room.seatPlayers.set(seatA, socketB);
  room.seatPlayers.set(seatB, socketA);

  // Swap session tokens so reconnection still maps to the right person
  const sessA = room.seatSessions.get(seatA);
  const sessB = room.seatSessions.get(seatB);
  if (sessB !== undefined) room.seatSessions.set(seatA, sessB); else room.seatSessions.delete(seatA);
  if (sessA !== undefined) room.seatSessions.set(seatB, sessA); else room.seatSessions.delete(seatB);

  // Swap recorded uids so Elo / stats follow the person, not the seat
  const uidA = room.seatUids.get(seatA);
  const uidB = room.seatUids.get(seatB);
  if (uidB !== undefined) room.seatUids.set(seatA, uidB); else room.seatUids.delete(seatA);
  if (uidA !== undefined) room.seatUids.set(seatB, uidA); else room.seatUids.delete(seatB);

  return true;
}

export function handleGrandTichu(room: Room, seat: Seat, call: boolean): void {
  room.state = callGrandTichu(room.state, seat, call);
  // Snapshot initial hands once all players have decided and full hands are dealt
  if (room.state.phase === 'passing' && room.accumulator.initialHands.size === 0) {
    for (const p of room.state.players) {
      room.accumulator.initialHands.set(p.seat, [...p.hand]);
    }
  }
}

export function handleSmallTichu(room: Room, seat: Seat): void {
  room.state = callSmallTichu(room.state, seat);
}

export function handlePassCards(room: Room, seat: Seat, pass: PassInfo): boolean {
  // Verify all three passed cards are actually in the player's hand
  const hand = room.state.players[seat].hand;
  const handKeys = new Set(hand.map(cardId));
  const passCards = [pass.left, pass.partner, pass.right];
  // Also verify the three cards are distinct
  const passKeys = new Set(passCards.map(cardId));
  if (passKeys.size !== 3 || !passCards.every(c => handKeys.has(cardId(c)))) {
    return false;
  }

  // Only record a pass the engine accepted: a pass sent outside the passing
  // phase (or a repeat) must not linger in `room.passes` and be applied to a
  // later round's hands.
  const next = passCardsEngine(room.state, seat, pass);
  if (next === room.state) return false;
  room.state = next;
  room.passes.set(seat, pass);

  // Check if all 4 players have passed
  if (room.passes.size === 4) {
    // Snapshot pass data before clearing
    for (const [s, p] of room.passes) {
      room.accumulator.passes.set(s, p);
    }
    const passes = {} as Record<Seat, PassInfo>;
    for (const [seat, info] of room.passes) {
      passes[seat] = info;
    }
    room.state = applyPasses(room.state, passes);
    room.passes.clear();
    return true; // all passes applied
  }
  return false;
}

/**
 * Retract a pending pass so the player can choose again. Returns false when
 * there is nothing to undo (not in the passing phase, or the seat hasn't
 * passed). Once all four passes are in they are applied immediately, so a
 * pass can only be undone while at least one other seat is still deciding.
 */
export function handleUndoPass(room: Room, seat: Seat): boolean {
  if (room.state.phase !== 'passing') return false;
  if (!room.passes.has(seat)) return false;
  room.passes.delete(seat);
  room.state = undoPassCards(room.state, seat);
  return true;
}

export function handlePlayCards(room: Room, seat: Seat, cards: Card[]): PlayResult {
  return playCards(room.state, seat, cards);
}

export function handlePassTurn(room: Room, seat: Seat): PlayResult {
  return passTurn(room.state, seat);
}

export function handleBomb(room: Room, seat: Seat, cards: Card[]): PlayResult {
  const result = playBomb(room.state, seat, cards);
  // Record bomb if it was actually played (state changed)
  if (result.state !== room.state) {
    room.accumulator.bombs.push({ seat, cards: [...cards] });
  }
  return result;
}

export function handleDragonGiveaway(room: Room, seat: Seat, to: Seat): PlayResult {
  const result = giveDragonTrick(room.state, seat, to);
  if (result.state !== room.state) {
    room.accumulator.dragonGiveaways.push({ fromSeat: seat, toSeat: to });
  }
  return result;
}

export function handleMahJongWish(room: Room, seat: Seat, rank: NormalRank | null): void {
  // setMahJongWish enforces that only the pending wisher (held on turnIndex)
  // may act; mirror that check here so the accumulator only records authorized
  // wishes against the correct seat.
  const authorized = room.state.mahJongWishPending && room.state.turnIndex === seat;
  if (authorized && rank != null) {
    room.accumulator.mahJongWishes.push({ seat, rank });
  }
  room.state = setMahJongWish(room.state, seat, rank);
}

export function handleConcede(room: Room, seat: Seat): PlayResult {
  return concedeEngine(room.state, seat);
}

export function applyPlayResult(room: Room, result: PlayResult): void {
  room.state = result.state;
}

/**
 * "Play again" from the game-over screen: put the room back in the waiting
 * phase with the same people (and settings) so a new game can be started
 * without everyone re-creating and re-joining a room. Seats whose player has
 * already left (no live socket) are freed so they don't block the new game.
 */
export function resetRoomForNewGame(room: Room): boolean {
  if (room.state.phase !== 'gameEnd') return false;
  clearTrickCountdownTimer(room.code);
  clearBombWindowTimer(room.code);
  const connectedSeats = new Set(room.playerSockets.values());
  const fresh = createInitialState(room.state.settings);
  for (const p of room.state.players) {
    const live = connectedSeats.has(p.seat);
    if (!live) {
      room.seatPlayers.delete(p.seat);
      room.seatSessions.delete(p.seat);
      room.seatUids.delete(p.seat);
      continue;
    }
    fresh.players[p.seat].id = p.id;
    fresh.players[p.seat].name = p.name;
    fresh.players[p.seat].photoURL = p.photoURL;
    fresh.players[p.seat].isAi = p.isAi;
  }
  room.state = fresh;
  room.passes.clear();
  room.lastRoundResult = null;
  room.gameId = `${room.code}_${Date.now()}`;
  room.accumulator = createAccumulator(room.gameId, [0, 0]);
  // If the organizer has gone, hand the role to someone still here.
  if (!room.playerSockets.has(room.organizer)) {
    for (const [seat, socketId] of room.seatPlayers) {
      if (isApiPlayer(socketId)) continue;
      room.organizer = socketId;
      room.organizerSession = room.seatSessions.get(seat) ?? '';
      break;
    }
  }
  return true;
}

export function startNextRound(room: Room): void {
  const scores: [number, number] = [room.state.teams[0].score, room.state.teams[1].score];
  const prevWasDown300 = room.accumulator.wasDown300;
  room.state = startNewRound(room.state);
  room.accumulator = createAccumulator(room.gameId, scores, prevWasDown300);
  room.passes.clear();
  room.lastRoundResult = null;
}

// ===== AI Player API =====

export function isApiPlayer(socketId: string): boolean {
  return socketId.startsWith('api:');
}

export function markSeatForAi(room: Room, seat: Seat): { error?: string } {
  if (room.state.phase !== 'waiting') return { error: 'Game already in progress' };
  if (room.seatPlayers.has(seat)) return { error: 'Seat is occupied' };
  room.aiOpenSeats.add(seat);
  return {};
}

export function unmarkSeatForAi(room: Room, seat: Seat): void {
  room.aiOpenSeats.delete(seat);
}

export function addApiPlayer(
  room: Room, name: string, preferredSeat?: Seat
): { seat: Seat } | { error: string } {
  if (room.state.phase !== 'waiting') return { error: 'Game already in progress' };

  // Find an AI-open seat that nobody is sitting in.
  const isFree = (s: Seat) => room.aiOpenSeats.has(s) && !room.seatPlayers.has(s);
  let seat: Seat | null = null;
  if (preferredSeat !== undefined && isFree(preferredSeat)) {
    seat = preferredSeat;
  } else {
    for (const s of room.aiOpenSeats) {
      if (isFree(s)) { seat = s; break; }
    }
  }
  if (seat === null) return { error: 'No open AI seats' };

  const syntheticId = `api:${room.code}:${seat}`;
  room.state.players[seat].id = syntheticId;
  room.state.players[seat].name = name;
  room.state.players[seat].isAi = true;
  room.playerSockets.set(syntheticId, seat);
  room.seatPlayers.set(seat, syntheticId);
  room.aiOpenSeats.delete(seat);

  return { seat };
}

export function removeApiPlayer(room: Room, seat: Seat): { error?: string } {
  const socketId = room.seatPlayers.get(seat);
  if (!socketId || !isApiPlayer(socketId)) return { error: 'Seat is not an AI player' };
  if (room.state.phase !== 'waiting') return { error: 'Cannot remove AI during game' };

  room.playerSockets.delete(socketId);
  room.seatPlayers.delete(seat);
  room.state.players[seat].id = '';
  room.state.players[seat].name = '';
  room.state.players[seat].isAi = false;
  room.aiOpenSeats.add(seat); // return to AI-open pool

  return {};
}

/**
 * Aggregate activity counts for the /health endpoint (e.g. to judge whether
 * a restart would interrupt anyone). Counts only — never room codes or
 * player names, since /health is public and codes are join credentials.
 */
export function getActivitySummary(): {
  rooms: number;
  roomsInGame: number;
  playersSeated: number;
  playersConnected: number;
  phases: Record<string, number>;
} {
  let roomsInGame = 0;
  let playersSeated = 0;
  let playersConnected = 0;
  const phases: Record<string, number> = {};
  for (const room of rooms.values()) {
    const phase = room.state.phase;
    phases[phase] = (phases[phase] ?? 0) + 1;
    if (phase !== 'waiting' && phase !== 'gameEnd') roomsInGame++;
    const connectedSeats = new Set(room.playerSockets.values());
    for (const p of room.state.players) {
      if (!p.name || p.isAi) continue;
      playersSeated++;
      if (connectedSeats.has(p.seat)) playersConnected++;
    }
  }
  return { rooms: rooms.size, roomsInGame, playersSeated, playersConnected, phases };
}

export function findRoomWithOpenAiSeat(): { room: Room; seat: Seat } | null {
  for (const room of rooms.values()) {
    if (room.state.phase !== 'waiting') continue;
    for (const seat of room.aiOpenSeats) {
      if (!room.seatPlayers.has(seat)) return { room, seat };
    }
  }
  return null;
}
