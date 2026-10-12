import { useLayoutEffect, useRef, useState } from 'react';
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
};

// Card widths in px (Card.tsx: w-24 / large w-36), and the widest a hand may
// spread within the 1300px design width (FitToViewport).
const CARD_WIDTH = 96;
const LARGE_CARD_WIDTH = 144;
const MAX_HAND_WIDTH = 1240;
/** How long a played card takes to lift out of the hand (index.css hand-leave). */
const LEAVE_MS = 300;

export default function Hand({ cards, selectedCards, onToggleCard, disabled, draggable, large, onDragStart }: Props) {
  // Larger cards are 50% wider, so scale the overlap up, and tighten it
  // further whenever the hand would still be wider than the layout allows.
  const cardWidth = large ? LARGE_CARD_WIDTH : CARD_WIDTH;
  const overlapFor = (n: number) => {
    const baseOverlap = n > 10 ? -30 : n > 7 ? -18 : n > 4 ? -6 : 0;
    const fitOverlap = n > 1 ? Math.min(0, Math.floor((MAX_HAND_WIDTH - n * cardWidth) / (n - 1))) : 0;
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

  return (
    <div className="flex justify-center">
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
          <div key={id} className="hand-slot" style={{ marginLeft: i > 0 ? `${overlap}px` : '0' }}>
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
