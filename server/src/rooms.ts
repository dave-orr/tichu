import {
  GameState, GameSettings, DEFAULT_SETTINGS, Seat, createInitialState, startNewRound,
  callGrandTichu, callSmallTichu, passCards as passCardsEngine,
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
  passes: Map<Seat, PassInfo>;      // pending card passes
  randomPartners: boolean;
  organizer: string;                // socket.id of room creator
  organizerSession: string;         // session token of room creator (survives reconnect)
  gameId: string;
  accumulator: RoundAccumulator;
  aiOpenSeats: Set<Seat>;           // seats marked as open for AI players
  bombAnnounceThrottle: Map<Seat, BombThrottle>; // per-seat bomb-announce rate state
};

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
  socketUids.set(socketId, uid);
  uidSockets.set(uid, socketId);
}

export function getSocketUid(socketId: string): string | null {
  return socketUids.get(socketId) ?? null;
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
    passes: new Map(),
    randomPartners,
    organizer: socketId,
    organizerSession: sessionId ?? '',
    gameId,
    accumulator: createAccumulator(gameId, [0, 0]),
    aiOpenSeats: new Set(),
    bombAnnounceThrottle: new Map(),
  };

  rooms.set(code, room);
  socketRooms.set(socketId, code);
  return room;
}

export function joinRoom(
  code: string, socketId: string, playerName: string, sessionId?: string
): { room: Room; seat: Seat } | { error: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found' };

  let seat: Seat | null = null;
  if (room.state.phase === 'waiting') {
    // Find first empty seat
    for (let i = 0; i < 4; i++) {
      if (!room.seatPlayers.has(i as Seat)) {
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
 * Re-insert a room loaded from a persisted snapshot after a server restart.
 * No live sockets exist yet, so the socket map is cleared (seats stay reserved
 * via seatSessions for reconnection) and an abandoned-cleanup timer is armed so
 * a game nobody returns to is eventually dropped.
 */
export function registerRestoredRoom(room: Room): void {
  room.playerSockets = new Map();
  rooms.set(room.code, room);
  const timer = setTimeout(() => {
    roomCleanupTimers.delete(room.code);
    const r = rooms.get(room.code);
    if (r && r.playerSockets.size === 0) {
      clearTrickCountdownTimer(room.code);
      clearBombWindowTimer(room.code);
      destroyRoom(room.code);
      console.log(`Cleaned up abandoned room: ${room.code}`);
    }
  }, ABANDONED_ROOM_TIMEOUT_MS);
  roomCleanupTimers.set(room.code, timer);
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

/** Vacate a seat entirely (used when a waiting-room grace period expires). */
function freeSeat(room: Room, seat: Seat): void {
  const socketId = room.seatPlayers.get(seat);
  if (socketId) {
    room.playerSockets.delete(socketId);
    socketRooms.delete(socketId);
  }
  room.seatPlayers.delete(seat);
  room.seatSessions.delete(seat);
  room.state.players[seat].id = '';
  room.state.players[seat].name = '';
  room.state.players[seat].photoURL = null;
}

export function removePlayer(socketId: string): void {
  const uid = socketUids.get(socketId);
  if (uid) uidSockets.delete(uid);
  socketUids.delete(socketId);

  const code = socketRooms.get(socketId);
  if (!code) return;
  socketRooms.delete(socketId);

  const room = rooms.get(code);
  if (!room) return;

  const seat = room.playerSockets.get(socketId);
  if (seat === undefined) return;

  room.playerSockets.delete(socketId);

  // Keep seatPlayers/seatSessions so the seat stays reserved for reconnect.
  // In the waiting room, hold the seat for a short grace period, then free it
  // (and delete the room if it becomes empty) so it doesn't block others.
  if (room.state.phase === 'waiting') {
    clearSeatGraceTimer(code, seat);
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
      if (r.playerSockets.size === 0) {
        clearInvitesForRoom(code);
        destroyRoom(code);
      }
    }, WAITING_GRACE_MS);
    seatGraceTimers.set(seatGraceKey(code, seat), timer);
    return;
  }

  // For in-progress games, schedule cleanup if all players disconnected
  if (room.playerSockets.size === 0) {
    const timer = setTimeout(() => {
      roomCleanupTimers.delete(code);
      const r = rooms.get(code);
      if (r && r.playerSockets.size === 0) {
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

  room.passes.set(seat, pass);
  room.state = passCardsEngine(room.state, seat, pass);

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

export function startNextRound(room: Room): void {
  const scores: [number, number] = [room.state.teams[0].score, room.state.teams[1].score];
  const prevWasDown300 = room.accumulator.wasDown300;
  room.state = startNewRound(room.state);
  room.accumulator = createAccumulator(room.gameId, scores, prevWasDown300);
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

  // Find an AI-open seat
  let seat: Seat | null = null;
  if (preferredSeat !== undefined && room.aiOpenSeats.has(preferredSeat)) {
    seat = preferredSeat;
  } else {
    for (const s of room.aiOpenSeats) {
      seat = s;
      break;
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

export function findRoomWithOpenAiSeat(): { room: Room; seat: Seat } | null {
  for (const room of rooms.values()) {
    if (room.state.phase !== 'waiting') continue;
    if (room.aiOpenSeats.size === 0) continue;
    // Pick the first AI-open seat
    const seat = room.aiOpenSeats.values().next().value;
    if (seat !== undefined) return { room, seat };
  }
  return null;
}
