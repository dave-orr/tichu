import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientGameState, Card, NormalRank, Seat, GameSettings, InvitablePlayer } from '@tichu/shared';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export type IncomingInvite = {
  inviteId: string;
  roomCode: string;
  fromName: string;
};

export function useSocket(idToken: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const tokenRef = useRef(idToken);
  tokenRef.current = idToken;
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needMahJongWish, setNeedMahJongWish] = useState(false);
  const [needDragonChoice, setNeedDragonChoice] = useState(false);
  const [roundResult, setRoundResult] = useState<any>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [randomPartners, setRandomPartners] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<IncomingInvite[]>([]);
  const [expiredInviteUids, setExpiredInviteUids] = useState<Set<string>>(new Set());

  useEffect(() => {
    const socket = io(window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : window.location.origin, {
      transports: ['websocket', 'polling'],
      auth: tokenRef.current ? { token: tokenRef.current } : undefined,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState('connected');
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
    });

    socket.on('room-created', ({ roomCode, randomPartners }: { roomCode: string; randomPartners: boolean }) => {
      setRoomCode(roomCode);
      setIsOrganizer(true);
      setRandomPartners(randomPartners);
    });

    socket.on('game-state', ({ state }: { state: ClientGameState }) => {
      setGameState(state);
      setError(null);
    });

    socket.on('error', ({ message }: { message: string }) => {
      setError(message);
    });

    socket.on('need-mah-jong-wish', () => {
      setNeedMahJongWish(true);
    });

    socket.on('need-dragon-choice', () => {
      setNeedDragonChoice(true);
    });

    socket.on('round-result', ({ result }: { result: any }) => {
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

    socket.on('room-joined-via-invite', ({ roomCode, randomPartners }: { roomCode: string; randomPartners: boolean }) => {
      setRoomCode(roomCode);
      setIsOrganizer(false);
      setRandomPartners(randomPartners);
      setPendingInvites([]);
    });

    setConnectionState('connecting');

    return () => {
      socket.disconnect();
    };
  }, []);

  // Send token to server when it changes (without reconnecting the socket)
  useEffect(() => {
    if (idToken && socketRef.current?.connected) {
      socketRef.current.emit('authenticate', { token: idToken });
    }
  }, [idToken]);

  const createRoom = useCallback((playerName: string, randomPartners: boolean, settings?: Partial<GameSettings>) => {
    socketRef.current?.emit('create-room', { playerName, randomPartners, settings });
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
    socketRef.current?.emit('join-room', { roomCode, playerName });
    setRoomCode(roomCode.toUpperCase());
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
    setNeedDragonChoice(false);
  }, []);

  const mahJongWish = useCallback((rank: NormalRank) => {
    socketRef.current?.emit('mah-jong-wish', { rank });
    setNeedMahJongWish(false);
  }, []);

  const nextRound = useCallback(() => {
    socketRef.current?.emit('next-round');
    setRoundResult(null);
  }, []);

  const updateSettings = useCallback((settings: Partial<GameSettings>) => {
    socketRef.current?.emit('update-settings', { settings });
  }, []);

  const swapSeatsAction = useCallback((seatA: Seat, seatB: Seat) => {
    socketRef.current?.emit('swap-seats', { seatA, seatB });
  }, []);

  const fetchPlayers = useCallback((): Promise<{ players: InvitablePlayer[] }> => {
    return new Promise(resolve => {
      socketRef.current?.emit('fetch-players', resolve);
    });
  }, []);

  const sendInvite = useCallback((targetUid: string) => {
    socketRef.current?.emit('send-invite', { targetUid });
  }, []);

  const respondInvite = useCallback((inviteId: string, accept: boolean, playerName?: string) => {
    socketRef.current?.emit('respond-invite', { inviteId, accept, playerName });
    setPendingInvites(prev => prev.filter(i => i.inviteId !== inviteId));
  }, []);

  return {
    connectionState,
    gameState,
    roomCode,
    error,
    needMahJongWish,
    needDragonChoice,
    roundResult,
    isOrganizer,
    randomPartners,
    createRoom,
    joinRoom,
    startGame,
    callGrandTichu,
    callSmallTichu,
    passCards,
    playCards,
    passTurn: passTurnAction,
    bomb: bombAction,
    bombAnnounce,
    bombCancel,
    giveDragonTrick,
    mahJongWish,
    nextRound,
    swapSeats: swapSeatsAction,
    updateSettings,
    pendingInvites,
    expiredInviteUids,
    fetchPlayers,
    sendInvite,
    respondInvite,
  };
}
