import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { Card as CardType, cardId } from '@tichu/shared';
import CardComponent from './Card.js';

/** An arrow pointing toward a seat at the table, with a hover title. */
export type HandTag = { toward: 'left' | 'up' | 'right'; title: string };

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
  /** Arrow badges shown above particular cards, keyed by cardId (e.g. who passed it to you). */
  tags?: ReadonlyMap<string, HandTag>;
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
/** Tag badge size (w-8) and inset (left-2), so it sits in the card's visible strip (px). */
const TAG_SIZE = 32;
const TAG_INSET = 8;
/** Space kept between the banner and the nearest tag (px). */
const BANNER_GAP = 16;
/** Arrow rotation per direction (the drawn arrow points right). */
const ARROW_TURN: Record<HandTag['toward'], number> = { right: 0, up: -90, left: 180 };

/**
 * Where to float the banner so it stays clear of the tags: centred if that's
 * clear, else the nearest clear spot over the hand, else just above the tags.
 * Returns the offset of its centre from the hand's centre, and its lift.
 * Positions come from the settled layout (not the DOM), so a card mid-exit
 * doesn't skew them.
 */
function placeBanner(tagged: boolean[], step: number, handWidth: number, bannerWidth: number): { x: number; lift: number } {
  const spans = tagged.flatMap((t, i) => t ? [[i * step + TAG_INSET, i * step + TAG_INSET + TAG_SIZE] as const] : []);
  const centred = (handWidth - bannerWidth) / 2;
  const clear = (x: number) => x >= 0 && x + bannerWidth <= handWidth
    && spans.every(([a, b]) => x + bannerWidth + BANNER_GAP <= a || x >= b + BANNER_GAP);
  const best = [centred, ...spans.flatMap(([a, b]) => [a - BANNER_GAP - bannerWidth, b + BANNER_GAP])]
    .filter(clear)
    .sort((a, b) => Math.abs(a - centred) - Math.abs(b - centred))[0];
  if (spans.length === 0 || best !== undefined) return { x: (best ?? centred) - centred, lift: 0 };
  return { x: 0, lift: TAG_SIZE };
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

  // The banner's width depends on the theme's font, so measure it.
  const bannerRef = useRef<HTMLDivElement>(null);
  const [bannerWidth, setBannerWidth] = useState(0);
  useLayoutEffect(() => {
    const measure = () => setBannerWidth(bannerRef.current?.offsetWidth ?? 0);
    measure();
    // Theme fonts may arrive after the first paint and change the width.
    let live = true;
    document.fonts?.ready.then(() => { if (live) measure(); });
    return () => { live = false; };
  }, [!!banner]);
  const bannerPos = placeBanner(
    cards.map(c => !!tags?.has(cardId(c))),
    cardWidth + overlap,
    cards.length * cardWidth + Math.max(0, cards.length - 1) * overlap,
    bannerWidth,
  );

  return (
    <div className="relative flex justify-center">
      {banner && (
        <div
          ref={bannerRef}
          className="absolute bottom-full left-1/2 mb-3 z-20 pointer-events-none"
          style={{ transform: `translate(calc(-50% + ${bannerPos.x}px), -${bannerPos.lift}px)` }}
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
              // Small enough to sit in the strip of the card left visible by the overlap.
              <div
                title={tags.get(id)!.title}
                aria-label={tags.get(id)!.title}
                className="absolute bottom-full left-2 mb-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ochre text-ink shadow-[0_2px_0_rgb(var(--c-ochre-dark))]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" style={{ transform: `rotate(${ARROW_TURN[tags.get(id)!.toward]}deg)` }} fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 12h15M13 6l6 6-6 6" />
                </svg>
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
