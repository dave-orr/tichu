import {
  GameState, GameSettings, DEFAULT_SETTINGS, Seat, createInitialState, startNewRound,
  callGrandTichu, callSmallTichu, passCards as passCardsEngine,
  applyPasses, playCards, passTurn, playBomb,
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

export type Room = {
  code: string;
  state: GameState;
  playerSockets: Map<string, Seat>; // socket.id -> seat
  seatPlayers: Map<Seat, string>;   // seat -> socket.id
  passes: Map<Seat, PassInfo>;      // pending card passes
  randomPartners: boolean;
  organizer: string;                // socket.id of room creator
  gameId: string;
  accumulator: RoundAccumulator;
};

const rooms = new Map<string, Room>();
// Reverse map: socket.id -> room code for O(1) room lookups
const socketRooms = new Map<string, string>();

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

const INVITE_EXPIRY_MS = 5 * 60 * 1000;

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
  const now = Date.now();
  const result: PendingInvite[] = [];
  for (const id of ids) {
    const inv = pendingInvites.get(id);
    if (!inv) continue;
    if (now - inv.createdAt > INVITE_EXPIRY_MS) {
      removeInvite(id);
      continue;
    }
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

export function createRoom(socketId: string, playerName: string, randomPartners: boolean, settings?: Partial<GameSettings>): Room {
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
    passes: new Map(),
    randomPartners,
    organizer: socketId,
    gameId,
    accumulator: createAccumulator(gameId, [0, 0]),
  };

  rooms.set(code, room);
  socketRooms.set(socketId, code);
  return room;
}

export function joinRoom(
  code: string, socketId: string, playerName: string
): { room: Room; seat: Seat } | { error: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found' };
  if (room.state.phase !== 'waiting') return { error: 'Game already in progress' };

  // Find first empty seat
  let seat: Seat | null = null;
  for (let i = 0; i < 4; i++) {
    if (!room.seatPlayers.has(i as Seat)) {
      seat = i as Seat;
      break;
    }
  }
  if (seat === null) return { error: 'Room is full' };

  room.state.players[seat].id = socketId;
  room.state.players[seat].name = playerName;
  room.playerSockets.set(socketId, seat);
  room.seatPlayers.set(seat, socketId);
  socketRooms.set(socketId, room.code);

  return { room, seat };
}

export function reconnectToRoom(
  code: string, socketId: string, playerName: string
): { room: Room; seat: Seat } | { error: string } {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found' };

  // Find seat by player name
  let seat: Seat | null = null;
  for (const p of room.state.players) {
    if (p.name === playerName) {
      seat = p.seat;
      break;
    }
  }
  if (seat === null) return { error: 'Player not found in room' };

  // Update socket mapping
  const oldSocketId = room.seatPlayers.get(seat);
  if (oldSocketId) {
    room.playerSockets.delete(oldSocketId);
    socketRooms.delete(oldSocketId);
  }
  room.state.players[seat].id = socketId;
  room.playerSockets.set(socketId, seat);
  room.seatPlayers.set(seat, socketId);
  socketRooms.set(socketId, room.code);

  // Cancel any pending cleanup timer since a player reconnected
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
const roomCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

  // Don't remove from seatPlayers during a game (allow reconnect)
  if (room.state.phase === 'waiting') {
    room.seatPlayers.delete(seat);
    room.state.players[seat].id = '';
    room.state.players[seat].name = '';
  }

  // Clean up empty rooms immediately in waiting phase
  if (room.playerSockets.size === 0 && room.state.phase === 'waiting') {
    clearInvitesForRoom(code);
    rooms.delete(code);
    return;
  }

  // For in-progress games, schedule cleanup if all players disconnected
  if (room.playerSockets.size === 0 && room.state.phase !== 'waiting') {
    const timer = setTimeout(() => {
      roomCleanupTimers.delete(code);
      const r = rooms.get(code);
      if (r && r.playerSockets.size === 0) {
        rooms.delete(code);
        console.log(`Cleaned up abandoned room: ${code}`);
      }
    }, ABANDONED_ROOM_TIMEOUT_MS);
    roomCleanupTimers.set(code, timer);
  } else if (roomCleanupTimers.has(code)) {
    // Someone reconnected, cancel the cleanup timer
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
  // Collect all players
  const playerInfos = room.state.players.map(p => ({ id: p.id, name: p.name }));
  // Fisher-Yates shuffle
  for (let i = playerInfos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [playerInfos[i], playerInfos[j]] = [playerInfos[j], playerInfos[i]];
  }
  // Reassign
  room.playerSockets.clear();
  room.seatPlayers.clear();
  for (let i = 0; i < 4; i++) {
    const seat = i as Seat;
    const { id: socketId, name } = playerInfos[i];
    room.state.players[seat].id = socketId;
    room.state.players[seat].name = name;
    room.playerSockets.set(socketId, seat);
    room.seatPlayers.set(seat, socketId);
  }
}

/** Swap two players' seats (organizer only) */
export function swapSeats(room: Room, seatA: Seat, seatB: Seat): boolean {
  if (room.state.phase !== 'waiting') return false;
  if (seatA === seatB) return false;

  const socketA = room.seatPlayers.get(seatA);
  const socketB = room.seatPlayers.get(seatB);
  if (!socketA || !socketB) return false;

  // Swap in state
  const nameA = room.state.players[seatA].name;
  const nameB = room.state.players[seatB].name;
  const idA = room.state.players[seatA].id;
  const idB = room.state.players[seatB].id;

  room.state.players[seatA].name = nameB;
  room.state.players[seatA].id = idB;
  room.state.players[seatB].name = nameA;
  room.state.players[seatB].id = idA;

  // Swap socket mappings
  room.playerSockets.set(socketA, seatB);
  room.playerSockets.set(socketB, seatA);
  room.seatPlayers.set(seatA, socketB);
  room.seatPlayers.set(seatB, socketA);

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

export function handleMahJongWish(room: Room, seat: Seat, rank: NormalRank): void {
  room.accumulator.mahJongWishes.push({ seat, rank });
  room.state = setMahJongWish(room.state, rank);
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
