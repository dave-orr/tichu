import { useState, useEffect, useLayoutEffect, useRef, useMemo, type CSSProperties } from 'react';
import { getPartnerSeat, type ClientGameState, type RoundResult, type Seat } from '@tichu/shared';

export type GameEvent = {
  id: number;
  type: 'tichu' | 'grand-tichu' | 'dog' | 'out' | 'tichu-made' | 'grand-made' | 'dragon-given';
  /** The player the event is about; on the table view its bubble attaches to
   *  this seat's panel. For 'dragon-given' it is the receiver. */
  seat: Seat;
  playerName: string;
  /** Secondary text, e.g. "Lead passes to Theo", "1st" or "from Maya". */
  detail?: string;
  /** 'dragon-given' only: who gave the trick away. */
  giverSeat?: Seat;
};

const DURATIONS: Record<GameEvent['type'], number> = {
  tichu: 2500,
  'grand-tichu': 3000,
  dog: 2500,
  out: 2500,
  'tichu-made': 3500,
  'grand-made': 4000,
  'dragon-given': 3000,
};

/** Round-level events get the center banner, one at a time; the rest are
 *  about a single player and attach to that player's panel. */
const isBannerEvent = (e: GameEvent) => e.type === 'tichu-made' || e.type === 'grand-made';

const ORDINALS = ['', '1st', '2nd', '3rd', '4th'];

export function useGameEvents(
  gameState: ClientGameState | null,
  roundResult: RoundResult | null,
): GameEvent[] {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const prevRef = useRef<ClientGameState | null>(null);
  const prevRoundRef = useRef<RoundResult | null>(null);
  const nextId = useRef(0);
  const removalTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  // When the last queued banner finishes; the next banner starts after it.
  const bannerQueueEnd = useRef(0);

  useEffect(() => {
    if (!gameState) return;
    const prev = prevRef.current;
    const detected: Omit<GameEvent, 'id'>[] = [];
    const nameOf = (seat: number) => seat === gameState.mySeat ? 'you' : gameState.players[seat].name;

    if (prev) {
      // Tichu / Grand Tichu calls
      for (let i = 0; i < 4; i++) {
        const seat = i as Seat;
        const playerName = gameState.players[i].name;
        if (prev.players[i].tichuCall === 'none' && gameState.players[i].tichuCall === 'small') {
          detected.push({ type: 'tichu', seat, playerName });
        }
        if (prev.players[i].tichuCall === 'none' && gameState.players[i].tichuCall === 'grand') {
          detected.push({ type: 'grand-tichu', seat, playerName });
        }
      }

      // Dog played (appears in playedCards); the lead passes to their partner.
      if (gameState.playedCards.length > prev.playedCards.length) {
        const newCards = gameState.playedCards.slice(prev.playedCards.length);
        if (newCards.some(c => c.type === 'special' && c.name === 'dog')) {
          const seat = prev.turnIndex;
          const partner = nameOf(getPartnerSeat(seat));
          detected.push({
            type: 'dog',
            seat,
            playerName: gameState.players[seat].name,
            detail: `Lead passes to ${partner}`,
          });
        }
      }

      // Player going out
      for (let i = 0; i < 4; i++) {
        if (prev.players[i].outOrder === 0 && gameState.players[i].outOrder > 0) {
          detected.push({
            type: 'out',
            seat: i as Seat,
            playerName: gameState.players[i].name,
            detail: ORDINALS[gameState.players[i].outOrder],
          });
        }
      }

      // Dragon trick given to an opponent — the receiver is the player whose
      // trickCount went up while the giveaway flag dropped.
      if (prev.dragonGiveaway && !gameState.dragonGiveaway && prev.dragonGiveawayBy !== null) {
        const giver = prev.dragonGiveawayBy;
        const receiverIdx = gameState.players.findIndex((p, i) => p.trickCount > prev.players[i].trickCount);
        if (receiverIdx >= 0) {
          const receiver = receiverIdx as Seat;
          detected.push({
            type: 'dragon-given',
            seat: receiver,
            giverSeat: giver,
            playerName: gameState.players[receiver].name,
            detail: `from ${nameOf(giver)}`,
          });
        }
      }
    }

    // Tichu/Grand made (at round end)
    if (roundResult && roundResult !== prevRoundRef.current) {
      for (let i = 0; i < 4; i++) {
        const call = gameState.players[i].tichuCall;
        const order = gameState.players[i].outOrder;
        const name = gameState.players[i].name;
        if (call === 'small' && order === 1) {
          detected.push({ type: 'tichu-made', seat: i as Seat, playerName: name, detail: `${name} went out first · +100` });
        }
        if (call === 'grand' && order === 1) {
          detected.push({ type: 'grand-made', seat: i as Seat, playerName: name, detail: `${name} went out first · +200` });
        }
      }
    }

    prevRef.current = gameState;
    prevRoundRef.current = roundResult;

    if (detected.length > 0) {
      const withIds = detected.map(e => ({ ...e, id: nextId.current++ }));
      setEvents(prev => [...prev, ...withIds]);
      const now = Date.now();
      for (const e of withIds) {
        // Banners queue behind one another; bubbles live for their duration.
        let endsAt = now + DURATIONS[e.type];
        if (isBannerEvent(e)) {
          endsAt = Math.max(now, bannerQueueEnd.current) + DURATIONS[e.type];
          bannerQueueEnd.current = endsAt;
        }
        const timer = setTimeout(() => {
          removalTimers.current.delete(timer);
          setEvents(prev => prev.filter(ev => ev.id !== e.id));
        }, endsAt - now);
        removalTimers.current.add(timer);
      }
    }
  }, [gameState, roundResult]);

  // Clear any pending removal timers on unmount so they can't setState after.
  useEffect(() => () => {
    for (const timer of removalTimers.current) clearTimeout(timer);
  }, []);

  return events;
}

/** Player events for one seat's panel (banner events excluded). */
export function seatEvents(events: GameEvent[], seat: Seat): GameEvent[] {
  return events.filter(e => e.seat === seat && !isBannerEvent(e));
}

/** Panel ring for a seat that has a live Tichu/Grand/Dragon bubble. */
export function seatGlow(events: GameEvent[]): string | null {
  const types = new Set(events.map(e => e.type));
  if (types.has('dragon-given')) return 'ring-[3px] ring-purple-400 shadow-[0_0_26px_rgba(192,132,252,0.55)]';
  if (types.has('grand-tichu')) return 'ring-2 ring-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.45)]';
  if (types.has('tichu')) return 'ring-2 ring-green-400 shadow-[0_0_18px_rgba(74,222,128,0.4)]';
  return null;
}

const durStyle = (e: GameEvent) => ({ '--dur': `${DURATIONS[e.type]}ms` } as CSSProperties);

function MiniCard({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center justify-center w-9 h-12 rounded-md bg-white text-sm font-extrabold shadow ${className}`}>
      {label}
    </span>
  );
}

/** One solid, readable bubble for a player event. */
type Side = 'above' | 'below' | 'left' | 'right';
type Tail = 'down' | 'up' | 'right' | 'left';
const TAIL_FOR_SIDE: Record<Side, Tail> = { above: 'down', below: 'up', left: 'right', right: 'left' };

function Bubble({ event, tail }: { event: GameEvent; tail?: Tail }) {
  const base = 'announce-bubble relative flex items-center gap-3 whitespace-nowrap rounded-xl border-2 px-4 py-2 shadow-[0_6px_18px_rgba(0,0,0,0.45)]';
  const tailEl = tail ? <span className={`bubble-tail bubble-tail-${tail}`} /> : null;
  switch (event.type) {
    case 'tichu':
      return (
        <div className={`${base} bg-green-700 border-green-400 text-white text-4xl font-black tracking-wide`} style={durStyle(event)}>
          TICHU!{tailEl}
        </div>
      );
    case 'grand-tichu':
      return (
        <div className={`${base} bg-blue-700 border-blue-300 text-white text-4xl font-black tracking-wide`} style={durStyle(event)}>
          GRAND TICHU!{tailEl}
        </div>
      );
    case 'out':
      return (
        <div className={`${base} bg-gray-900 border-yellow-400 text-yellow-300 text-3xl font-bold`} style={durStyle(event)}>
          Out — {event.detail}{tailEl}
        </div>
      );
    case 'dog':
      return (
        <div className={`${base} bg-gray-800 border-gray-400 text-gray-100 text-2xl font-semibold`} style={durStyle(event)}>
          <MiniCard label="Dog" className="text-gray-700" />
          {event.detail}{tailEl}
        </div>
      );
    case 'dragon-given':
      return (
        <div className={`${base} bg-purple-950 border-purple-400 text-purple-100`} style={durStyle(event)}>
          <span className="flex flex-col leading-tight">
            <span className="text-3xl font-black text-white">Dragon trick</span>
            <span className="text-2xl font-semibold">{event.detail}</span>
          </span>
          {tailEl}
        </div>
      );
    default:
      return null;
  }
}

/**
 * Bubbles anchored to a player's panel. Each seat owns one empty corner of
 * the table so simultaneous bubbles never collide and the center stays clear:
 * left opponent above (top-left), partner right (top-right), right opponent
 * below (bottom-right), me left (bottom-left). `alignEnd` pins an above/below
 * stack to the panel's right edge so it grows toward the table, not off
 * screen. The parent panel must be `relative`.
 */
export function SeatBubbles({ events, side, alignEnd = false }: {
  events: GameEvent[];
  side: Side;
  alignEnd?: boolean;
}) {
  if (events.length === 0) return null;
  const edge = alignEnd ? 'right-4 items-end bubbles-end' : 'left-4 items-start';
  const pos: Record<Side, string> = {
    above: `bottom-full mb-4 flex-col-reverse ${edge}`,
    below: `top-full mt-4 flex-col ${edge}`,
    right: 'left-full ml-4 top-1/2 -translate-y-1/2 flex-col items-start',
    left: 'right-full mr-4 top-1/2 -translate-y-1/2 flex-col items-end',
  };
  return (
    <div className={`absolute z-40 pointer-events-none flex gap-3 ${pos[side]}`}>
      {events.map((e, i) => (
        // Only the bubble nearest the panel carries the pointer.
        <Bubble key={e.id} event={e} tail={i === 0 ? TAIL_FOR_SIDE[side] : undefined} />
      ))}
    </div>
  );
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
    <div className="absolute inset-0 flex items-center justify-center overflow-visible pointer-events-none">
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
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

const CELEBRATION_COLORS = ['#fbbf24', '#f59e0b', '#ef4444', '#f97316', '#eab308'];

/** Solid center banner for round-level events. */
function Banner({ event, queued }: { event: GameEvent; queued: number }) {
  const grand = event.type === 'grand-made';
  return (
    <div
      className="announce-bubble relative flex flex-col items-center gap-1 text-center rounded-2xl border-2 border-amber-500 bg-gray-900/95 px-10 py-6 shadow-[0_12px_40px_rgba(0,0,0,0.6),0_0_32px_rgba(251,191,36,0.25)]"
      style={durStyle(event)}
    >
      <div className={`${grand ? 'text-7xl' : 'text-6xl'} font-black tracking-wide text-amber-400`}>
        {grand ? 'GRAND TICHU MADE!' : 'TICHU MADE!'}
      </div>
      <div className="text-3xl font-semibold text-amber-200">{event.detail}</div>
      {queued > 1 && (
        <div className="flex gap-1.5 mt-2" aria-hidden="true">
          <span className="h-1.5 w-5 rounded-full bg-amber-400" />
          {Array.from({ length: queued - 1 }, (_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-gray-600" />
          ))}
        </div>
      )}
      <Sparkles count={grand ? 32 : 24} spread={grand ? 260 : 220} colors={CELEBRATION_COLORS} />
    </div>
  );
}

type Point = { x: number; y: number };

/** Point on `rect`'s border (plus a gap) along the line from its center toward `to`. */
function edgePoint(rect: DOMRect, to: Point, gap = 10): Point {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = to.x - cx;
  const dy = to.y - cy;
  const t = Math.min(
    dx === 0 ? Infinity : (rect.width / 2) / Math.abs(dx),
    dy === 0 ? Infinity : (rect.height / 2) / Math.abs(dy),
  );
  const len = Math.hypot(dx, dy) || 1;
  return { x: cx + dx * t + (dx / len) * gap, y: cy + dy * t + (dy / len) * gap };
}

/**
 * Dashed arc from the giver's panel to the receiver's, with the Dragon card
 * riding along it. Panels are found by `data-seat-panel`; coordinates are
 * converted into this overlay's own (possibly scaled) box.
 */
function DragonArrow({ event }: { event: GameEvent }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState<{ d: string } | null>(null);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const from = document.querySelector(`[data-seat-panel="${event.giverSeat}"]`);
    const to = document.querySelector(`[data-seat-panel="${event.seat}"]`);
    if (!overlay || !from || !to) return;
    const o = overlay.getBoundingClientRect();
    // FitToViewport scales the UI; client rects are post-scale, the overlay's
    // own coordinates are not.
    const scale = overlay.offsetWidth ? o.width / overlay.offsetWidth : 1;
    const fromRect = from.getBoundingClientRect();
    const toRect = to.getBoundingClientRect();
    const center = (r: DOMRect): Point => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    const local = (p: Point): Point => ({ x: (p.x - o.left) / scale, y: (p.y - o.top) / scale });
    const s = local(edgePoint(fromRect, center(toRect)));
    const e = local(edgePoint(toRect, center(fromRect)));
    // Bow the arc away from the table center so it doesn't cross the trick.
    const mid = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
    const len = Math.hypot(e.x - s.x, e.y - s.y) || 1;
    let nx = -(e.y - s.y) / len;
    let ny = (e.x - s.x) / len;
    const tableCenter = { x: overlay.offsetWidth / 2, y: overlay.offsetHeight / 2 };
    if ((mid.x - tableCenter.x) * nx + (mid.y - tableCenter.y) * ny < 0) { nx = -nx; ny = -ny; }
    const bow = len * 0.25;
    const c = { x: mid.x + nx * bow, y: mid.y + ny * bow };
    setPath({ d: `M ${s.x} ${s.y} Q ${c.x} ${c.y} ${e.x} ${e.y}` });
  }, [event.giverSeat, event.seat]);

  return (
    <div ref={overlayRef} className="fixed inset-0 pointer-events-none z-40 announce-fade" style={durStyle(event)}>
      {path && (
        <>
          <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
            <defs>
              <marker id={`dragon-arrow-${event.id}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="#c084fc" />
              </marker>
            </defs>
            <path
              d={path.d}
              fill="none"
              stroke="#c084fc"
              strokeWidth="4"
              strokeDasharray="10 10"
              strokeLinecap="round"
              markerEnd={`url(#dragon-arrow-${event.id})`}
            />
          </svg>
          <div
            className="dragon-card-fly absolute left-0 top-0 -ml-6 -mt-8 flex items-center justify-center w-12 h-16 rounded-md bg-white border-2 border-red-700 shadow-[0_6px_16px_rgba(0,0,0,0.5),0_0_16px_rgba(192,132,252,0.6)]"
            style={{ offsetPath: `path('${path.d}')` } as CSSProperties}
          >
            <span className="text-xs font-extrabold text-red-700">Dragon</span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Overlay announcements.
 *
 * `table` (the playing view): player events are drawn by the panels via
 * SeatBubbles, so this only renders the center banner and the Dragon arrow.
 * Otherwise (Grand Tichu / passing screens, which have no panels) player
 * events show as a centered stack of the same solid bubbles.
 */
export default function GameAnnouncements({ events, table = false }: { events: GameEvent[]; table?: boolean }) {
  const banners = events.filter(isBannerEvent);
  const playerEvents = events.filter(e => !isBannerEvent(e));
  if (events.length === 0) return null;

  return (
    <>
      {table
        ? playerEvents
            .filter(e => e.type === 'dragon-given' && e.giverSeat !== undefined)
            .map(e => <DragonArrow key={e.id} event={e} />)
        : playerEvents.length > 0 && (
            <div className="fixed inset-x-0 top-24 z-50 pointer-events-none flex flex-col items-center gap-3">
              {playerEvents.map(e => (
                <div
                  key={e.id}
                  className="announce-bubble flex items-center gap-4 rounded-2xl border border-gray-600 bg-gray-900/95 py-2 pl-5 pr-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                  style={durStyle(e)}
                >
                  <span className="text-4xl font-black text-yellow-400 [text-shadow:0_0_14px_rgba(250,204,21,0.75)]">{e.playerName}</span>
                  <Bubble event={e} />
                </div>
              ))}
            </div>
          )}
      {banners.length > 0 && (
        // Above the round-results modal, which opens at the same moment.
        <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center">
          <Banner key={banners[0].id} event={banners[0]} queued={banners.length} />
        </div>
      )}
    </>
  );
}
