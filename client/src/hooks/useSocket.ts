import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientGameState, Card, NormalRank, Seat } from '@tichu/shared';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needMahJongWish, setNeedMahJongWish] = useState(false);
  const [needDragonChoice, setNeedDragonChoice] = useState(false);
  const [roundResult, setRoundResult] = useState<any>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [randomPartners, setRandomPartners] = useState(false);

  useEffect(() => {
    const socket = io(window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : window.location.origin, {
      transports: ['websocket', 'polling'],
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

    socket.on('player-joined', ({ playerName, seat }: { playerName: string; seat: number }) => {
      // Handled via game-state update
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

    setConnectionState('connecting');

    return () => {
      socket.disconnect();
    };
  }, []);

  const createRoom = useCallback((playerName: string, randomPartners: boolean) => {
    socketRef.current?.emit('create-room', { playerName, randomPartners });
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

  const swapSeatsAction = useCallback((seatA: Seat, seatB: Seat) => {
    socketRef.current?.emit('swap-seats', { seatA, seatB });
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
  };
}
