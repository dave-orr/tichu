import { useState, useEffect, useLayoutEffect, useRef, useMemo, type CSSProperties } from 'react';
import { dogLeadSeat, getPartnerSeat, type ClientGameState, type RoundResult, type Seat } from '@tichu/shared';
import { cardArt, useTheme } from '../theme.js';
import { detectDragonGift } from '../utils/dragonGift.js';

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
  /** 'dog' only: who leads next (the partner, or past them if they're out). */
  leadSeat?: Seat;
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

/** How long an event stays up; the Dog's runs past an empty partner seat take longer. */
function durationOf(e: Omit<GameEvent, 'id'>): number {
  if (e.type === 'dog' && e.leadSeat !== undefined) {
    const route = dogRoute(e.seat, e.leadSeat);
    if (route !== 'partner') return DOG_STEP_MS.run * 2 + (route === 'back' ? DOG_STEP_MS.confused : DOG_STEP_MS.stop) + DOG_STEP_MS.rest + 300;
  }
  return DURATIONS[e.type];
}

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

      // Dog played (appears in playedCards); the lead passes to their partner,
      // or past them if they're out, possibly all the way back.
      if (gameState.playedCards.length > prev.playedCards.length) {
        const newCards = gameState.playedCards.slice(prev.playedCards.length);
        if (newCards.some(c => c.type === 'special' && c.name === 'dog')) {
          const seat = prev.turnIndex;
          const leadSeat = dogLeadSeat(seat, gameState.players.map(p => p.isOut), gameState.settings.clockwise);
          detected.push({
            type: 'dog',
            seat,
            leadSeat,
            playerName: gameState.players[seat].name,
            detail: leadSeat === seat ? `Lead comes back to ${nameOf(seat)}` : `Lead passes to ${nameOf(leadSeat)}`,
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

      // Dragon trick given to an opponent (chosen, or automatic when an
      // opponent went out first).
      const gift = detectDragonGift(prev, gameState);
      if (gift) {
        const { giver, receiver } = gift;
        detected.push({
          type: 'dragon-given',
          seat: receiver,
          giverSeat: giver,
          playerName: gameState.players[receiver].name,
          detail: `from ${nameOf(giver)}`,
        });
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
        let endsAt = now + durationOf(e);
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

const durStyle = (e: GameEvent) => ({ '--dur': `${durationOf(e)}ms` } as CSSProperties);

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

/** Maps client (post-FitToViewport-scale) points into `overlay`'s own box. */
function overlayMapper(overlay: HTMLElement) {
  const o = overlay.getBoundingClientRect();
  const scale = overlay.offsetWidth ? o.width / overlay.offsetWidth : 1;
  return (p: Point): Point => ({ x: (p.x - o.left) / scale, y: (p.y - o.top) / scale });
}

const rectCenter = (r: DOMRect): Point => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** Two papercraft frames flipping back and forth (legs running, wings flapping). */
function Sprite({ name, flip, className }: { name: string; flip: boolean; className: string }) {
  const theme = useTheme();
  const src = (n: number) => cardArt(theme, `anim-${name}-${n}.svg`);
  return (
    <div className={`sprite-frames ${className}`} style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <img src={src(1)} alt="" />
      <img src={src(2)} alt="" />
    </div>
  );
}

/**
 * Dashed arc from the giver's panel to the receiver's, with the Dragon flying
 * along it. Panels are found by `data-seat-panel`; coordinates are
 * converted into this overlay's own (possibly scaled) box.
 */
function DragonArrow({ event }: { event: GameEvent }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState<{ d: string; flip: boolean } | null>(null);

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
    // Opponents sit next to each other and their panels nearly touch, so an
    // edge-to-edge arc would be a few pixels long. Launch from the middle of
    // the giver's panel instead, landing on the receiver's edge.
    const s = local(center(fromRect));
    const e = local(edgePoint(toRect, center(fromRect)));
    // Bow the arc away from the table center so it doesn't cross the trick.
    const mid = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
    const len = Math.hypot(e.x - s.x, e.y - s.y) || 1;
    let nx = -(e.y - s.y) / len;
    let ny = (e.x - s.x) / len;
    const tableCenter = { x: overlay.offsetWidth / 2, y: overlay.offsetHeight / 2 };
    if ((mid.x - tableCenter.x) * nx + (mid.y - tableCenter.y) * ny < 0) { nx = -nx; ny = -ny; }
    const bow = len * 0.35;
    const c = { x: mid.x + nx * bow, y: mid.y + ny * bow };
    // The sprite faces right; mirror it when the Dragon is heading left.
    setPath({ d: `M ${s.x} ${s.y} Q ${c.x} ${c.y} ${e.x} ${e.y}`, flip: e.x < s.x });
  }, [event.giverSeat, event.seat]);

  return (
    <div ref={overlayRef} className="fixed inset-0 pointer-events-none z-40 announce-fade" style={durStyle(event)}>
      {path && (
        <>
          <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
            <defs>
              <marker id={`dragon-arrow-${event.id}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path className="dragon-arc-head" d="M0 0 L10 5 L0 10 z" fill="#c084fc" />
              </marker>
            </defs>
            <path
              className="dragon-arc"
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
            className="dragon-card-fly sprite-motion absolute left-0 top-0 w-24 h-24"
            style={{ offsetPath: `path('${path.d}')` } as CSSProperties}
          >
            <Sprite name="dragon-fly" flip={path.flip} className="w-24 h-24 dragon-bob" />
          </div>
        </>
      )}
    </div>
  );
}

/** Where the Dog runs: to the partner; past their empty seat to the opponent
 *  after them; or to the empty seat and, finding the next one empty too, back. */
type DogRoute = 'partner' | 'onward' | 'back';
function dogRoute(seat: Seat, leadSeat: Seat): DogRoute {
  return leadSeat === getPartnerSeat(seat) ? 'partner' : leadSeat === seat ? 'back' : 'onward';
}

/** Step lengths (ms), matching the CSS animations in index.css: one run between panels, a quick stop at an empty seat on
 *  the way past it, the confused look-around before heading home, and lying
 *  down at the end (flop, rest, fade). */
const DOG_STEP_MS = { run: 800, stop: 300, confused: 1300, rest: 1400 };
const PAW_GAP_MS = 270;

type DogLeg = { d: string; sprite: string; flip: boolean; bounce: boolean; prints: Point[] };
type DogStep =
  | { kind: 'run'; leg: DogLeg; first: boolean; ms: number }
  | { kind: 'stop'; at: Point; sprite: string; flip: boolean; confused: boolean; ms: number }
  | { kind: 'rest'; at: Point; ms: number };

/**
 * One run between two points in three hops, leaving paw prints.
 * Running toward or away from the viewer is a straight run seen from the
 * front or behind, with the hops done as a bounce on the sprite; sideways
 * runs are in profile, hopping in arcs up the screen.
 */
function dogLeg(s: Point, e: Point): DogLeg {
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const at = (t: number): Point => ({ x: s.x + dx * t, y: s.y + dy * t });
  const landings = [1 / 3, 2 / 3, 1].map(at);
  const prints = [s, ...landings.slice(0, 2)];
  if (Math.abs(dy) > Math.abs(dx)) {
    return { d: `M ${s.x} ${s.y} L ${e.x} ${e.y}`, sprite: dy < 0 ? 'doodle-back' : 'doodle-front', flip: false, bounce: true, prints };
  }
  const len = Math.hypot(dx, dy) || 1;
  let nx = dy / len;
  let ny = -dx / len;
  if (ny > 0) { nx = -nx; ny = -ny; }
  const hop = Math.min(60, len * 0.14);
  let d = `M ${s.x} ${s.y}`;
  [0, 1, 2].forEach(i => {
    const m = at((i + 0.5) / 3);
    d += ` Q ${m.x + nx * hop * 2} ${m.y + ny * hop * 2} ${landings[i].x} ${landings[i].y}`;
  });
  return { d, sprite: 'doodle-run', flip: dx < 0, bounce: false, prints };
}

/** A motion path that just sits at `p`, so still steps line up with runs. */
const pinAt = (p: Point) => `path('M ${p.x} ${p.y} L ${p.x + 0.01} ${p.y}')`;

/**
 * The Dog was led: the blue doodle bounds from the player's panel to their
 * partner's in three hops, leaving paw prints, and lies down when it arrives,
 * head up and ready.
 * If the partner is out, it stops at their empty seat on the way: then it
 * runs on to the opponent who leads instead, or, when that opponent is out
 * too and the lead comes back, it looks around confused (???) and runs home.
 */
function DogDash({ event }: { event: GameEvent }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const [plan, setPlan] = useState<{ steps: DogStep[]; prints: { p: Point; delay: number }[] } | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const partner = getPartnerSeat(event.seat);
    const lead = event.leadSeat ?? partner;
    const route = dogRoute(event.seat, lead);
    const panel = (seat: Seat) => document.querySelector(`[data-seat-panel="${seat}"]`);
    const from = panel(event.seat);
    const mid = panel(partner);
    const to = panel(lead);
    if (!overlay || !from || !mid || !to) return;
    const local = overlayMapper(overlay);
    const fromRect = from.getBoundingClientRect();
    const midRect = mid.getBoundingClientRect();
    const s = local(edgePoint(fromRect, rectCenter(midRect), 18));
    const m = local(edgePoint(midRect, rectCenter(fromRect), 18));
    const first = dogLeg(s, m);
    const steps: DogStep[] = [{ kind: 'run', leg: first, first: true, ms: DOG_STEP_MS.run }];
    let end = m;
    if (route !== 'partner') {
      // From the empty seat, on to whoever leads (back home if that's us).
      const mClient = rectCenter(midRect);
      const e = local(edgePoint(to.getBoundingClientRect(), mClient, 18));
      const confused = route === 'back';
      steps.push(
        confused
          ? { kind: 'stop', at: m, sprite: 'doodle-front', flip: false, confused, ms: DOG_STEP_MS.confused }
          : { kind: 'stop', at: m, sprite: first.sprite, flip: first.flip, confused, ms: DOG_STEP_MS.stop },
        { kind: 'run', leg: dogLeg(m, e), first: false, ms: DOG_STEP_MS.run },
      );
      end = e;
    }
    steps.push({ kind: 'rest', at: end, ms: DOG_STEP_MS.rest });
    const prints: { p: Point; delay: number }[] = [];
    let t = 0;
    for (const step of steps) {
      if (step.kind === 'run') step.leg.prints.forEach((p, i) => prints.push({ p, delay: t + i * PAW_GAP_MS }));
      t += step.ms;
    }
    setPlan({ steps, prints });
  }, [event.seat, event.leadSeat]);

  useEffect(() => {
    if (!plan) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 0;
    plan.steps.slice(0, -1).forEach((step, i) => {
      t += step.ms;
      timers.push(setTimeout(() => setStepIndex(i + 1), t));
    });
    return () => timers.forEach(clearTimeout);
  }, [plan]);

  const step = plan?.steps[stepIndex];
  const box = 'dog-dash absolute left-0 top-0 -mt-8 w-24 h-24';
  return (
    <div ref={overlayRef} className="fixed inset-0 pointer-events-none z-40 sprite-motion">
      {plan && (
        <>
          {plan.prints.map(({ p, delay }, i) => (
            <svg
              key={i}
              className="paw-print absolute -ml-3 -mt-3 w-6 h-6"
              style={{ left: p.x, top: p.y, animationDelay: `${delay}ms` }}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <g className="paw-print-ink" fill="#2B2233" opacity="0.45">
                <ellipse cx="12" cy="15" rx="5" ry="4.2" />
                <circle cx="6" cy="9" r="2.2" /><circle cx="10" cy="6" r="2.2" />
                <circle cx="14" cy="6" r="2.2" /><circle cx="18" cy="9" r="2.2" />
              </g>
            </svg>
          ))}
          {step?.kind === 'run' && (
            <div
              key={stepIndex}
              className={`${box} dog-run${step.first ? ' dog-run-first' : ''}`}
              style={{ offsetPath: `path('${step.leg.d}')` } as CSSProperties}
            >
              <div className={`relative w-24 h-24 ${step.leg.bounce ? 'dog-bounce' : ''}`}>
                <Sprite name={step.leg.sprite} flip={step.leg.flip} className="w-24 h-24" />
              </div>
            </div>
          )}
          {step?.kind === 'stop' && (
            <div key={stepIndex} className={box} style={{ offsetPath: pinAt(step.at) } as CSSProperties}>
              <img
                src={cardArt(theme, `anim-${step.sprite}-1.svg`)}
                alt=""
                className={`w-24 h-24 ${step.confused ? 'dog-look' : ''}`}
                style={step.flip ? { transform: 'scaleX(-1)' } : undefined}
              />
              {step.confused && ['-left-4 -top-1', 'left-9 -top-7', '-right-3 -top-1'].map((pos, i) => (
                <span
                  key={i}
                  className={`dog-huh font-display absolute ${pos} text-4xl font-black`}
                  style={{ animationDelay: `${120 + i * 260}ms` }}
                >?</span>
              ))}
            </div>
          )}
          {step?.kind === 'rest' && (
            <div
              key={stepIndex}
              className={`${box} dog-rest`}
              style={{ offsetPath: pinAt(step.at) } as CSSProperties}
            >
              <img src={cardArt(theme, 'anim-doodle-lie.svg')} alt="" className="dog-lie w-24 h-24" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Overlay announcements.
 *
 * `table` (the playing view): player events are drawn by the panels via
 * SeatBubbles, so this only renders the center banner, the Dragon's flight
 * and the Dog's dash.
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
        ? playerEvents.map(e =>
            e.type === 'dragon-given' && e.giverSeat !== undefined ? <DragonArrow key={e.id} event={e} />
              : e.type === 'dog' ? <DogDash key={e.id} event={e} />
                : null)
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
