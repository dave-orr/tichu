import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { Card as CardType, cardId } from '@tichu/shared';
import CardComponent from './Card.js';

type Props = {
  cards: CardType[];
  selectedCards: Set<string>;
  onToggleCard: (card: CardType) => void;
  disabled?: boolean;
  draggable?: boolean;
  large?: boolean;
  onDragStart?: (card: CardType) => void;
  /** Widest the hand may spread (px); defaults to the full design width. */
  maxWidth?: number;
  /** Small tags shown above particular cards, keyed by cardId (e.g. who passed it to you). */
  tags?: ReadonlyMap<string, string>;
  /** A banner floated above the hand (e.g. "Your turn!"), kept clear of the tags. */
  banner?: ReactNode;
};

// Card widths in px (Card.tsx: w-24 / large w-36), and the widest a hand may
// spread by default within the 1300px design width (FitToViewport).
const CARD_WIDTH = 96;
const LARGE_CARD_WIDTH = 144;
const MAX_HAND_WIDTH = 1240;
/** How long a played card takes to lift out of the hand (index.css hand-leave). */
const LEAVE_MS = 300;
/** Space kept between neighbouring tags in a row (px). */
const TAG_GAP = 6;
/** Space kept between the banner and the nearest tag (px). */
const BANNER_GAP = 16;

type TagLayout = {
  /** Vertical lift of each tag, by cardId: adjacent tags are staggered into rows. */
  lift: Map<string, number>;
  /** Banner position: horizontal offset of its centre from the hand's centre, and lift. */
  bannerX: number;
  bannerLift: number;
};

/**
 * Lay out the tags and the banner so nothing overlaps. Each tag sits above the
 * left edge of its card; when a tag runs past the next tag's start (the
 * visible strip of an overlapped card is narrower than a tag), it goes up a
 * row. The banner stays centred if that's clear of every tag, else slides to
 * the nearest clear spot over the hand, else rises above the tag rows.
 * Positions come from the settled layout (not the DOM), so a card mid-exit
 * doesn't skew them.
 */
function layoutTags(
  ids: string[],
  step: number,
  handWidth: number,
  tagSize: ReadonlyMap<string, { w: number; h: number }>,
  bannerWidth: number,
): TagLayout {
  const lift = new Map<string, number>();
  const rowEnds: number[] = [];
  const spans: [number, number][] = [];
  let rowHeight = 0;
  ids.forEach((id, i) => {
    const size = tagSize.get(id);
    if (!size) return;
    const x = i * step;
    let row = rowEnds.findIndex(end => end + TAG_GAP <= x);
    if (row < 0) row = rowEnds.length;
    rowEnds[row] = x + size.w;
    rowHeight = Math.max(rowHeight, size.h);
    spans.push([x, x + size.w]);
    lift.set(id, row);
  });
  const rowStep = rowHeight + 2;
  for (const [id, row] of lift) lift.set(id, row * rowStep);

  const centred = (handWidth - bannerWidth) / 2;
  const clear = (x: number) => x >= 0 && x + bannerWidth <= handWidth
    && spans.every(([a, b]) => x + bannerWidth + BANNER_GAP <= a || x >= b + BANNER_GAP);
  const candidates = [centred, ...spans.flatMap(([a, b]) => [a - BANNER_GAP - bannerWidth, b + BANNER_GAP])]
    .filter(clear)
    .sort((a, b) => Math.abs(a - centred) - Math.abs(b - centred));
  if (spans.length === 0 || candidates.length > 0) {
    return { lift, bannerX: (candidates[0] ?? centred) - centred, bannerLift: 0 };
  }
  return { lift, bannerX: 0, bannerLift: rowEnds.length * rowStep };
}

export default function Hand({ cards, selectedCards, onToggleCard, disabled, draggable, large, onDragStart, maxWidth = MAX_HAND_WIDTH, tags, banner }: Props) {
  // Larger cards are 50% wider, so scale the overlap up, and tighten it
  // further whenever the hand would still be wider than the layout allows.
  const cardWidth = large ? LARGE_CARD_WIDTH : CARD_WIDTH;
  const overlapFor = (n: number) => {
    const baseOverlap = n > 10 ? -30 : n > 7 ? -18 : n > 4 ? -6 : 0;
    const fitOverlap = n > 1 ? Math.min(0, Math.floor((maxWidth - n * cardWidth) / (n - 1))) : 0;
    return Math.min(large ? Math.round(baseOverlap * 1.5) : baseOverlap, fitOverlap);
  };
  const overlap = overlapFor(cards.length);

  // Cards that just left the hand (played, passed) stay for a moment so they
  // can lift and fade while their slot collapses and the rest slide together.
  // Each is re-inserted where it sat among the cards that remain.
  const prevRef = useRef<CardType[]>(cards);
  const [leaving, setLeaving] = useState<{ card: CardType; at: number; was: number }[]>([]);
  useLayoutEffect(() => {
    const prev = prevRef.current;
    prevRef.current = cards;
    const ids = new Set(cards.map(cardId));
    const gone = prev.filter(c => !ids.has(cardId(c)));
    // Skip a whole new hand (a fresh deal): nothing is being played from it.
    if (gone.length === 0 || gone.length === prev.length) return;
    const entries = gone.map(card => {
      const idx = prev.findIndex(c => cardId(c) === cardId(card));
      return { card, was: idx, at: prev.slice(0, idx).filter(c => ids.has(cardId(c))).length };
    });
    setLeaving(entries);
    const timer = setTimeout(() => setLeaving([]), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [cards]);

  const shown: { card: CardType; leaving: boolean }[] = cards.map(card => ({ card, leaving: false }));
  // Insert from the right so earlier insertions don't shift later positions.
  [...leaving].sort((x, y) => y.at - x.at || y.was - x.was).forEach(({ card, at }) => {
    if (!shown.some(s => cardId(s.card) === cardId(card))) shown.splice(at, 0, { card, leaving: true });
  });

  // Measure the tags and banner (their size depends on names and theme fonts),
  // then place them from the settled hand layout.
  const tagRefs = useRef(new Map<string, HTMLDivElement>());
  const bannerRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<{ tags: Map<string, { w: number; h: number }>; banner: number }>({ tags: new Map(), banner: 0 });
  const tagKey = tags ? [...tags].map(([id, t]) => `${id}=${t}`).join('|') : '';
  useLayoutEffect(() => {
    const measure = () => {
      const next = new Map<string, { w: number; h: number }>();
      tagRefs.current.forEach((el, id) => next.set(id, { w: el.offsetWidth, h: el.offsetHeight }));
      const bannerWidth = bannerRef.current?.offsetWidth ?? 0;
      setSizes(prev => {
        const same = prev.banner === bannerWidth && prev.tags.size === next.size
          && [...next].every(([id, s]) => prev.tags.get(id)?.w === s.w && prev.tags.get(id)?.h === s.h);
        return same ? prev : { tags: next, banner: bannerWidth };
      });
    };
    measure();
    // Theme fonts may arrive after the first paint and change the widths.
    let live = true;
    document.fonts?.ready.then(() => { if (live) measure(); });
    return () => { live = false; };
  }, [tagKey, !!banner, large]);
  const layout = layoutTags(
    cards.map(cardId),
    cardWidth + overlap,
    cards.length * cardWidth + Math.max(0, cards.length - 1) * overlap,
    sizes.tags,
    sizes.banner,
  );

  return (
    <div className="relative flex justify-center">
      {banner && (
        <div
          ref={bannerRef}
          className="absolute bottom-full left-1/2 mb-3 z-20 pointer-events-none"
          style={{ transform: `translate(calc(-50% + ${layout.bannerX}px), -${layout.bannerLift}px)` }}
        >
          {banner}
        </div>
      )}
      {shown.map(({ card, leaving: isLeaving }, i) => {
        const id = cardId(card);
        if (isLeaving) {
          // Start from the spacing the hand had before the play, then collapse.
          return (
            <div
              key={id}
              className="hand-leave pointer-events-none"
              style={{ marginLeft: i > 0 ? `${overlapFor(shown.length)}px` : '0', width: cardWidth }}
            >
              <CardComponent card={card} selected={selectedCards.has(id)} large={large} />
            </div>
          );
        }
        return (
          <div key={id} className="hand-slot relative" style={{ marginLeft: i > 0 ? `${overlap}px` : '0' }}>
            {tags?.get(id) && (
              // Left-aligned so it starts in the strip of the card left visible
              // by the overlap; layoutTags lifts it a row if it would run into
              // the next tag.
              <div
                ref={el => { if (el) tagRefs.current.set(id, el); else tagRefs.current.delete(id); }}
                className="absolute bottom-full left-0 mb-1 z-10 pointer-events-none whitespace-nowrap rounded-full bg-ochre px-2 py-0.5 text-base font-extrabold text-ink shadow-[0_2px_0_rgb(var(--c-ochre-dark))]"
                style={{ transform: `translateY(-${layout.lift.get(id) ?? 0}px)` }}
              >
                {tags.get(id)}
              </div>
            )}
            <CardComponent
              card={card}
              selected={selectedCards.has(id)}
              large={large}
              onClick={disabled ? undefined : () => onToggleCard(card)}
              draggable={draggable && !disabled}
              onDragStart={draggable && !disabled && onDragStart ? (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify(card));
                e.dataTransfer.effectAllowed = 'move';
                onDragStart(card);
              } : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
