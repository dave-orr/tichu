import { useState, useEffect, useRef, useMemo } from 'react';
import type { ClientGameState, RoundResult } from '@tichu/shared';

export type GameEvent = {
  id: number;
  type: 'tichu' | 'grand-tichu' | 'dog' | 'out' | 'tichu-made' | 'grand-made';
  playerName: string;
};

const DURATIONS: Record<GameEvent['type'], number> = {
  tichu: 2500,
  'grand-tichu': 3000,
  dog: 2000,
  out: 2500,
  'tichu-made': 3500,
  'grand-made': 4000,
};

export function useGameEvents(
  gameState: ClientGameState | null,
  roundResult: RoundResult | null,
): GameEvent[] {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const prevRef = useRef<ClientGameState | null>(null);
  const prevRoundRef = useRef<RoundResult | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    if (!gameState) return;
    const prev = prevRef.current;
    const detected: Omit<GameEvent, 'id'>[] = [];

    if (prev) {
      // Tichu / Grand Tichu calls
      for (let i = 0; i < 4; i++) {
        if (prev.players[i].tichuCall === 'none' && gameState.players[i].tichuCall === 'small') {
          detected.push({ type: 'tichu', playerName: gameState.players[i].name });
        }
        if (prev.players[i].tichuCall === 'none' && gameState.players[i].tichuCall === 'grand') {
          detected.push({ type: 'grand-tichu', playerName: gameState.players[i].name });
        }
      }

      // Dog played (appears in playedCards)
      if (gameState.playedCards.length > prev.playedCards.length) {
        const newCards = gameState.playedCards.slice(prev.playedCards.length);
        if (newCards.some(c => c.type === 'special' && c.name === 'dog')) {
          detected.push({ type: 'dog', playerName: gameState.players[prev.turnIndex].name });
        }
      }

      // Player going out
      for (let i = 0; i < 4; i++) {
        if (prev.players[i].outOrder === 0 && gameState.players[i].outOrder > 0) {
          detected.push({ type: 'out', playerName: gameState.players[i].name });
        }
      }
    }

    // Tichu/Grand made (at round end)
    if (roundResult && roundResult !== prevRoundRef.current && gameState) {
      for (let i = 0; i < 4; i++) {
        const call = gameState.players[i].tichuCall;
        const order = gameState.players[i].outOrder;
        if (call === 'small' && order === 1) {
          detected.push({ type: 'tichu-made', playerName: gameState.players[i].name });
        }
        if (call === 'grand' && order === 1) {
          detected.push({ type: 'grand-made', playerName: gameState.players[i].name });
        }
      }
    }

    prevRef.current = gameState;
    prevRoundRef.current = roundResult;

    if (detected.length > 0) {
      const withIds = detected.map(e => ({ ...e, id: nextId.current++ }));
      setEvents(prev => [...prev, ...withIds]);
      for (const e of withIds) {
        setTimeout(() => {
          setEvents(prev => prev.filter(ev => ev.id !== e.id));
        }, DURATIONS[e.type]);
      }
    }
  }, [gameState, roundResult]);

  return events;
}

function Sparkles({ count, spread, colors }: { count: number; spread: number; colors: string[] }) {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const dist = spread * (0.5 + Math.random() * 0.5);
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        color: colors[i % colors.length],
        size: 3 + Math.random() * 5,
        delay: Math.random() * 0.3,
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-visible">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full announce-particle"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            '--tx': `${p.x}px`,
            '--ty': `${p.y}px`,
            animationDelay: `${p.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

const CELEBRATION_COLORS = ['#fbbf24', '#f59e0b', '#ef4444', '#f97316', '#eab308'];
const FIREWORK_COLORS = ['#ef4444', '#f97316', '#fbbf24', '#84cc16', '#22d3ee', '#a78bfa'];

function AnnouncementItem({ event }: { event: GameEvent }) {
  switch (event.type) {
    case 'tichu':
      return (
        <div className="announce-tichu text-center">
          <div className="text-5xl font-black text-orange-400 announce-text-shadow-orange tracking-wide">
            TICHU!
          </div>
          <div className="text-lg text-orange-300 font-semibold mt-1">
            {event.playerName}
          </div>
        </div>
      );

    case 'grand-tichu':
      return (
        <div className="announce-grand text-center relative">
          <div className="text-6xl font-black text-red-500 announce-text-shadow-red tracking-wider">
            GRAND TICHU!
          </div>
          <div className="text-xl text-red-300 font-semibold mt-1">
            {event.playerName}
          </div>
          <Sparkles count={16} spread={150} colors={['#ef4444', '#f97316', '#fbbf24']} />
        </div>
      );

    case 'dog':
      return (
        <div className="announce-dog text-center">
          <div className="text-6xl">🐕</div>
          <div className="text-xl font-bold text-gray-200 mt-1">
            {event.playerName} plays the Dog!
          </div>
        </div>
      );

    case 'out':
      return (
        <div className="announce-out text-center relative">
          <div className="text-3xl font-black text-green-400 announce-text-shadow-green">
            {event.playerName} is out!
          </div>
          <Sparkles count={20} spread={120} colors={FIREWORK_COLORS} />
        </div>
      );

    case 'tichu-made':
      return (
        <div className="announce-made text-center relative">
          <div className="text-5xl font-black announce-gold-text tracking-wide">
            TICHU MADE!
          </div>
          <div className="text-xl text-yellow-300 font-semibold mt-1">
            {event.playerName}
          </div>
          <Sparkles count={24} spread={160} colors={CELEBRATION_COLORS} />
        </div>
      );

    case 'grand-made':
      return (
        <div className="announce-made text-center relative">
          <div className="text-7xl font-black announce-gold-text tracking-wider">
            GRAND TICHU!
          </div>
          <div className="text-2xl text-yellow-300 font-semibold mt-1">
            {event.playerName} made it!
          </div>
          <Sparkles count={32} spread={200} colors={CELEBRATION_COLORS} />
        </div>
      );
  }
}

export default function GameAnnouncements({ events }: { events: GameEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col items-center justify-center z-50 gap-4">
      {events.map(event => (
        <AnnouncementItem key={event.id} event={event} />
      ))}
    </div>
  );
}
