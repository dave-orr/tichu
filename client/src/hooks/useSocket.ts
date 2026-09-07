import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientGameState, Card, NormalRank, Seat, GameSettings, InvitablePlayer, PartnerStats, RoundResult, RoomElos, EloUpdate, HeadToHead, GameSummary, GameHistoryRound, UserStats, TeamStats } from '@tichu/shared';
import { getSessionId, saveRoom, loadRoom, clearRoom } from '../utils/session.js';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export type IncomingInvite = {
  inviteId: string;
  roomCode: string;
  fromName: string;
};

export function useSocket(idToken: string | null, refreshToken?: () => Promise<string | null>) {
  const socketRef = useRef<Socket | null>(null);
  const tokenRef = useRef(idToken);
  tokenRef.current = idToken;
  const refreshTokenRef = useRef(refreshToken);
  refreshTokenRef.current = refreshToken;
  const sessionIdRef = useRef<string>(getSessionId());
  // Seed the room code from localStorage so a fresh page load (refresh/crash)
  // can attempt to rejoin the seat we were in.
  const roomCodeRef = useRef<string | null>(loadRoom());
  const gameStateRef = useRef<ClientGameState | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needMahJongWish, setNeedMahJongWish] = useState(false);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [randomPartners, setRandomPartners] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<IncomingInvite[]>([]);
  const [expiredInviteUids, setExpiredInviteUids] = useState<Set<string>>(new Set());
  const [autoSkippedSeat, setAutoSkippedSeat] = useState<number | null>(null);
  const autoSkipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [roomLost, setRoomLost] = useState(false);
  const [aiOpenSeats, setAiOpenSeats] = useState<number[]>([]);
  const [eloUpdate, setEloUpdate] = useState<EloUpdate | null>(null);
  const [headToHead, setHeadToHead] = useState<HeadToHead | null>(null);
  const [disconnectedSeats, setDisconnectedSeats] = useState<number[]>([]);

  useEffect(() => {
    const socket = io(window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : window.location.origin, {
      transports: ['polling'],
      auth: tokenRef.current ? { token: tokenRef.current } : undefined,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState('connected');
      // Authenticate on every (re)connect. This closes a race: if the token
      // arrived while the socket was still connecting, the token-change effect
      // below saw a disconnected socket and skipped its emit. The cached token
      // may have expired while the tab was frozen or offline (the periodic
      // refresh can't fire then), so prefer a freshly minted one when we can.
      if (tokenRef.current) {
        socket.emit('authenticate', { token: tokenRef.current });
        refreshTokenRef.current?.().then(fresh => {
          if (fresh && fresh !== tokenRef.current && socket.connected) {
            socket.emit('authenticate', { token: fresh });
          }
        }).catch(() => { /* keep the cached token */ });
      }
      // On (re)connect — whether a dropped socket or a full page reload — try to
      // reclaim our seat using the persistent session token.
      if (roomCodeRef.current) {
        console.info(`[rejoin] attempting room=${roomCodeRef.current} session=${sessionIdRef.current.slice(0, 8)}`);
        socket.emit('rejoin-room', { roomCode: roomCodeRef.current, sessionId: sessionIdRef.current });
      }
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
    });

    socket.on('room-lost', () => {
      console.warn(`[rejoin] room-lost (had gameState=${!!gameStateRef.current})`);
      clearRoom();
      roomCodeRef.current = null;
      // Only alarm the user if they were actively in a game; a stale stored
      // room on a fresh page load should just drop them back to the lobby.
      if (gameStateRef.current) {
        setRoomLost(true);
      }
    });

    // The organizer cancelled the room — drop everyone back to the start screen.
    socket.on('room-closed', () => {
      clearRoom();
      setGameState(null);
      gameStateRef.current = null;
      setRoomCode(null);
      roomCodeRef.current = null;
      setRoomLost(false);
      setRoundResult(null);
      setEloUpdate(null);
      setHeadToHead(null);
      setIsOrganizer(false);
      setDisconnectedSeats([]);
      setError('The room was cancelled.');
      setNeedMahJongWish(false);
      setRandomPartners(false);
      setPendingInvites([]);
      setExpiredInviteUids(new Set());
      setAutoSkippedSeat(null);
      setAiOpenSeats([]);
    });

    socket.on('room-created', ({ roomCode, randomPartners }: { roomCode: string; randomPartners: boolean }) => {
      setRoomCode(roomCode);
      roomCodeRef.current = roomCode;
      saveRoom(roomCode);
      setIsOrganizer(true);
      setRandomPartners(randomPartners);
    });

    socket.on('room-rejoined', ({ roomCode, randomPartners, isOrganizer }: { roomCode: string; randomPartners: boolean; isOrganizer: boolean }) => {
      console.info(`[rejoin] success room=${roomCode} organizer=${isOrganizer}`);
      setRoomCode(roomCode);
      roomCodeRef.current = roomCode;
      saveRoom(roomCode);
      setIsOrganizer(isOrganizer);
      setRandomPartners(randomPartners);
      setRoomLost(false);
    });

    socket.on('game-state', ({ state, aiOpenSeats, disconnectedSeats, organizerSeat }: { state: ClientGameState; aiOpenSeats?: number[]; disconnectedSeats?: number[]; organizerSeat?: number | null }) => {
      setGameState(state);
      gameStateRef.current = state;
      setError(null);
      if (aiOpenSeats) setAiOpenSeats(aiOpenSeats);
      setDisconnectedSeats(disconnectedSeats ?? []);
      // The organizer can change server-side (the creator left the waiting
      // room), so take it from every broadcast rather than the join reply.
      if (organizerSeat !== undefined) setIsOrganizer(organizerSeat === state.mySeat);
      // The wish prompt is only meaningful while the server is waiting on it;
      // if the round ended (concede) or the wish resolved elsewhere, drop it.
      if (!state.mahJongWishPending) setNeedMahJongWish(false);
      // Clear round result / elo / head-to-head when the phase moves past roundEnd
      if (state.phase !== 'roundEnd' && state.phase !== 'gameEnd') {
        setRoundResult(null);
        setEloUpdate(null);
        setHeadToHead(null);
      }
    });

    socket.on('elo-update', (update: EloUpdate) => {
      setEloUpdate(update);
    });

    socket.on('head-to-head', (h2h: HeadToHead) => {
      setHeadToHead(h2h);
    });

    socket.on('error', ({ message }: { message: string }) => {
      setError(message);
    });

    socket.on('need-mah-jong-wish', () => {
      setNeedMahJongWish(true);
    });

    socket.on('round-result', ({ result }: { result: RoundResult }) => {
      setRoundResult(result);
    });

    socket.on('invite-received', (invite: IncomingInvite) => {
      setPendingInvites(prev => {
        if (prev.some(i => i.inviteId === invite.inviteId)) return prev;
        return [...prev, invite];
      });
    });

    socket.on('invite-expired', ({ inviteId, targetUid }: { inviteId: string; targetUid?: string }) => {
      // Target side: remove from pending invites
      setPendingInvites(prev => prev.filter(i => i.inviteId !== inviteId));
      // Organizer side: track expired target uid so InvitePanel can revert "Invited" → "Invite"
      if (targetUid) {
        setExpiredInviteUids(prev => new Set(prev).add(targetUid));
      }
    });

    socket.on('turn-auto-skipped', ({ seat }: { seat: number }) => {
      setAutoSkippedSeat(seat);
      if (autoSkipTimerRef.current) clearTimeout(autoSkipTimerRef.current);
      autoSkipTimerRef.current = setTimeout(() => setAutoSkippedSeat(null), 2000);
    });

    socket.on('random-partners-updated', ({ randomPartners }: { randomPartners: boolean }) => {
      setRandomPartners(randomPartners);
    });

    socket.on('room-joined-via-invite', ({ roomCode, randomPartners }: { roomCode: string; randomPartners: boolean }) => {
      setRoomCode(roomCode);
      roomCodeRef.current = roomCode;
      saveRoom(roomCode);
      setIsOrganizer(false);
      setRandomPartners(randomPartners);
      setPendingInvites([]);
    });

    // Only remember a room once the server has actually seated us, so a failed
    // join can't leave a bogus code behind that triggers a spurious rejoin
    // (and a "session lost" modal) on every reconnect.
    socket.on('room-joined', ({ roomCode, randomPartners }: { roomCode: string; randomPartners: boolean }) => {
      setRoomCode(roomCode);
      roomCodeRef.current = roomCode;
      saveRoom(roomCode);
      setIsOrganizer(false);
      setRandomPartners(randomPartners);
    });

    setConnectionState('connecting');

    return () => {
      if (autoSkipTimerRef.current) clearTimeout(autoSkipTimerRef.current);
      socket.disconnect();
    };
  }, []);

  // Send token to server when it changes (without reconnecting the socket).
  // When it goes away (sign-out), tell the server so this socket stops being
  // attributed to the old account for stats, Elo and invites.
  const hadTokenRef = useRef(false);
  useEffect(() => {
    const sock = socketRef.current;
    if (idToken) {
      hadTokenRef.current = true;
      if (sock?.connected) sock.emit('authenticate', { token: idToken });
    } else if (hadTokenRef.current) {
      hadTokenRef.current = false;
      sock?.emit('sign-out');
    }
  }, [idToken]);

  const createRoom = useCallback((playerName: string, randomPartners: boolean, settings?: Partial<GameSettings>, photoURL?: string | null) => {
    socketRef.current?.emit('create-room', { playerName, randomPartners, settings, photoURL: photoURL ?? null, sessionId: sessionIdRef.current });
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string, photoURL?: string | null) => {
    // roomCode is committed when the server answers with room-joined.
    socketRef.current?.emit('join-room', { roomCode, playerName, photoURL: photoURL ?? null, sessionId: sessionIdRef.current });
  }, []);

  const startGame = useCallback(() => {
    socketRef.current?.emit('start-game');
  }, []);

  const callGrandTichu = useCallback((call: boolean) => {
    socketRef.current?.emit('call-grand-tichu', { call });
  }, []);

  const callSmallTichu = useCallback(() => {
    socketRef.current?.emit('call-small-tichu');
  }, []);

  const passCards = useCallback((left: Card, partner: Card, right: Card) => {
    socketRef.current?.emit('pass-cards', { left, partner, right });
  }, []);

  const undoPass = useCallback(() => {
    socketRef.current?.emit('undo-pass');
  }, []);

  const playCards = useCallback((cards: Card[]) => {
    socketRef.current?.emit('play-cards', { cards });
  }, []);

  const passTurnAction = useCallback(() => {
    socketRef.current?.emit('pass-turn');
  }, []);

  const bombAction = useCallback((cards: Card[]) => {
    socketRef.current?.emit('bomb', { cards });
  }, []);

  const bombAnnounce = useCallback(() => {
    socketRef.current?.emit('bomb-announce');
  }, []);

  const bombCancel = useCallback(() => {
    socketRef.current?.emit('bomb-cancel');
  }, []);

  const giveDragonTrick = useCallback((to: Seat) => {
    socketRef.current?.emit('give-dragon-trick', { to });
  }, []);

  const mahJongWish = useCallback((rank: NormalRank | null) => {
    socketRef.current?.emit('mah-jong-wish', { rank });
    setNeedMahJongWish(false);
  }, []);

  const concedeAction = useCallback(() => {
    socketRef.current?.emit('concede');
  }, []);

  const nextRound = useCallback(() => {
    socketRef.current?.emit('next-round');
  }, []);

  const updateSettings = useCallback((settings: Partial<GameSettings>) => {
    socketRef.current?.emit('update-settings', { settings });
  }, []);

  const swapSeatsAction = useCallback((seatA: Seat, seatB: Seat) => {
    socketRef.current?.emit('swap-seats', { seatA, seatB });
  }, []);

  const closeRoom = useCallback(() => {
    socketRef.current?.emit('close-room');
  }, []);

  // Acknowledged requests never hang forever: a rate-limited or dropped event
  // produces no ack at all, which used to leave "Loading…" panels stuck.
  const ACK_TIMEOUT_MS = 10000;

  // Emit an event with a callback; if the server signals needsAuth, force-refresh
  // the token, wait for the server to accept it, and retry once.
  const emitWithAuthRetry = useCallback(async <T extends { needsAuth?: boolean }>(
    event: string,
    payload?: unknown,
  ): Promise<T> => {
    const send = (): Promise<T> => new Promise(resolve => {
      const sock = socketRef.current;
      if (!sock) return resolve({} as T);
      const onAck = (err: Error | null, response?: T) => resolve(err ? ({} as T) : (response as T));
      if (payload === undefined) sock.timeout(ACK_TIMEOUT_MS).emit(event, onAck);
      else sock.timeout(ACK_TIMEOUT_MS).emit(event, payload, onAck);
    });
    const first = await send();
    if (!first.needsAuth || !refreshTokenRef.current) return first;
    const token = await refreshTokenRef.current();
    if (!token) return first;
    await new Promise<void>(resolve => {
      socketRef.current?.emit('authenticate', { token }, () => resolve());
    });
    return await send();
  }, []);

  const fetchPlayers = useCallback((): Promise<{ players: InvitablePlayer[] }> => {
    return emitWithAuthRetry<{ players: InvitablePlayer[]; needsAuth?: boolean }>('fetch-players');
  }, [emitWithAuthRetry]);

  const fetchPartnerStats = useCallback((): Promise<{ partners: PartnerStats[] }> => {
    return emitWithAuthRetry<{ partners: PartnerStats[]; needsAuth?: boolean }>('fetch-partner-stats');
  }, [emitWithAuthRetry]);

  const fetchUserStats = useCallback((): Promise<{ stats: UserStats | null }> => {
    return emitWithAuthRetry<{ stats: UserStats | null; needsAuth?: boolean }>('fetch-user-stats');
  }, []);

  const fetchTeamStats = useCallback((partnerUid: string): Promise<{ team: TeamStats | null }> => {
    return emitWithAuthRetry<{ team: TeamStats | null; needsAuth?: boolean }>('fetch-team-stats', { partnerUid });
  }, []);

  const fetchRecentGames = useCallback((): Promise<{ games: GameSummary[] }> => {
    return emitWithAuthRetry<{ games: GameSummary[]; needsAuth?: boolean }>('fetch-recent-games');
  }, [emitWithAuthRetry]);

  const fetchGameHistory = useCallback((gameId: string): Promise<{ rounds: GameHistoryRound[] }> => {
    return emitWithAuthRetry<{ rounds: GameHistoryRound[]; needsAuth?: boolean }>('fetch-game-history', { gameId });
  }, [emitWithAuthRetry]);

  const fetchRoomElos = useCallback((): Promise<RoomElos> => {
    const empty: RoomElos = { seatElos: [null, null, null, null], teamElos: [null, null] };
    return new Promise(resolve => {
      const sock = socketRef.current;
      if (!sock) return resolve(empty);
      sock.timeout(ACK_TIMEOUT_MS).emit('fetch-room-elos', (err: Error | null, res?: RoomElos) => resolve(err ? empty : (res as RoomElos)));
    });
  }, []);

  const sendInvite = useCallback((targetUid: string) => {
    socketRef.current?.emit('send-invite', { targetUid });
  }, []);

  const respondInvite = useCallback((inviteId: string, accept: boolean, playerName?: string, photoURL?: string | null) => {
    socketRef.current?.emit('respond-invite', { inviteId, accept, playerName, photoURL: photoURL ?? null, sessionId: sessionIdRef.current });
    setPendingInvites(prev => prev.filter(i => i.inviteId !== inviteId));
  }, []);

  const loadProfile = useCallback((): Promise<{ profile: unknown } | { error: string }> => {
    return emitWithAuthRetry<({ profile: unknown } | { error: string }) & { needsAuth?: boolean }>('load-profile');
  }, [emitWithAuthRetry]);

  const saveSettings = useCallback((settings: Partial<GameSettings>, randomPartners?: boolean) => {
    socketRef.current?.emit('save-settings', { settings, randomPartners });
  }, []);

  const updateRandomPartners = useCallback((randomPartners: boolean) => {
    socketRef.current?.emit('update-random-partners', { randomPartners });
  }, []);

  const markSeatAi = useCallback((seat: Seat) => {
    socketRef.current?.emit('mark-seat-ai', { seat });
  }, []);

  const unmarkSeatAi = useCallback((seat: Seat) => {
    socketRef.current?.emit('unmark-seat-ai', { seat });
  }, []);

  const playAgain = useCallback(() => {
    socketRef.current?.emit('play-again');
  }, []);

  const resetRoom = useCallback(() => {
    // Tell the server we're gone so the seat is freed (or opened to a
    // substitute) and this socket stops receiving the old room's broadcasts.
    socketRef.current?.emit('leave-room');
    setGameState(null);
    gameStateRef.current = null;
    setRoomCode(null);
    roomCodeRef.current = null;
    clearRoom();
    setRoomLost(false);
    setRoundResult(null);
    setEloUpdate(null);
    setHeadToHead(null);
    setIsOrganizer(false);
    setDisconnectedSeats([]);
    setError(null);
    // Also clear the rest of the per-room state so nothing leaks into the next room.
    setNeedMahJongWish(false);
    setRandomPartners(false);
    setPendingInvites([]);
    setExpiredInviteUids(new Set());
    setAutoSkippedSeat(null);
    setAiOpenSeats([]);
  }, []);

  return {
    connectionState,
    gameState,
    roomCode,
    error,
    needMahJongWish,
    roundResult,
    isOrganizer,
    randomPartners,
    createRoom,
    joinRoom,
    startGame,
    callGrandTichu,
    callSmallTichu,
    passCards,
    undoPass,
    playCards,
    passTurn: passTurnAction,
    bomb: bombAction,
    bombAnnounce,
    bombCancel,
    giveDragonTrick,
    mahJongWish,
    concede: concedeAction,
    nextRound,
    swapSeats: swapSeatsAction,
    closeRoom,
    updateSettings,
    autoSkippedSeat,
    pendingInvites,
    expiredInviteUids,
    fetchPlayers,
    fetchPartnerStats,
    fetchUserStats,
    fetchTeamStats,
    fetchRecentGames,
    fetchGameHistory,
    fetchRoomElos,
    eloUpdate,
    headToHead,
    sendInvite,
    respondInvite,
    roomLost,
    resetRoom,
    playAgain,
    aiOpenSeats,
    disconnectedSeats,
    markSeatAi,
    unmarkSeatAi,
    loadProfile,
    saveSettings,
    updateRandomPartners,
  };
}
