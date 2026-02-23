import {
  GameState, Seat, createInitialState, startNewRound,
  callGrandTichu, callSmallTichu, passCards as passCardsEngine,
  applyPasses, playCards, passTurn, playBomb,
  giveDragonTrick, setMahJongWish, toClientState,
  Card, NormalRank, PlayResult, RoundResult, PassInfo,
} from '@tichu/shared';

export type Room = {
  code: string;
  state: GameState;
  playerSockets: Map<string, Seat>; // socket.id -> seat
  seatPlayers: Map<Seat, string>;   // seat -> socket.id
  passes: Map<Seat, PassInfo>;      // pending card passes
};

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // Ensure unique
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

export function createRoom(socketId: string, playerName: string): Room {
  const code = generateRoomCode();
  const state = createInitialState();
  state.players[0].id = socketId;
  state.players[0].name = playerName;

  const room: Room = {
    code,
    state,
    playerSockets: new Map([[socketId, 0]]),
    seatPlayers: new Map([[0, socketId]]),
    passes: new Map(),
  };

  rooms.set(code, room);
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
  }
  room.state.players[seat].id = socketId;
  room.playerSockets.set(socketId, seat);
  room.seatPlayers.set(seat, socketId);

  return { room, seat };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function getRoomBySocket(socketId: string): { room: Room; seat: Seat } | null {
  for (const room of rooms.values()) {
    const seat = room.playerSockets.get(socketId);
    if (seat !== undefined) {
      return { room, seat };
    }
  }
  return null;
}

export function removePlayer(socketId: string): void {
  for (const [code, room] of rooms.entries()) {
    const seat = room.playerSockets.get(socketId);
    if (seat !== undefined) {
      room.playerSockets.delete(socketId);
      // Don't remove from seatPlayers during a game (allow reconnect)
      if (room.state.phase === 'waiting') {
        room.seatPlayers.delete(seat);
        room.state.players[seat].id = '';
        room.state.players[seat].name = '';
      }
      // Clean up empty rooms
      if (room.playerSockets.size === 0 && room.state.phase === 'waiting') {
        rooms.delete(code);
      }
      return;
    }
  }
}

export function canStartGame(room: Room): boolean {
  return room.seatPlayers.size === 4 && room.state.phase === 'waiting';
}

export function startGame(room: Room): void {
  room.state = startNewRound(room.state);
}

export function handleGrandTichu(room: Room, seat: Seat, call: boolean): void {
  room.state = callGrandTichu(room.state, seat, call);
}

export function handleSmallTichu(room: Room, seat: Seat): void {
  room.state = callSmallTichu(room.state, seat);
}

export function handlePassCards(room: Room, seat: Seat, pass: PassInfo): boolean {
  room.passes.set(seat, pass);
  room.state = passCardsEngine(room.state, seat, pass);

  // Check if all 4 players have passed
  if (room.passes.size === 4) {
    const passes = Object.fromEntries(room.passes) as Record<Seat, PassInfo>;
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
  return playBomb(room.state, seat, cards);
}

export function handleDragonGiveaway(room: Room, seat: Seat, to: Seat): PlayResult {
  return giveDragonTrick(room.state, seat, to);
}

export function handleMahJongWish(room: Room, rank: NormalRank): void {
  room.state = setMahJongWish(room.state, rank);
}

export function applyPlayResult(room: Room, result: PlayResult): void {
  room.state = result.state;
}

export function startNextRound(room: Room): void {
  room.state = startNewRound(room.state);
}
