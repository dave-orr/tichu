import { Card as CardType, cardId, sortHand } from '@tichu/shared';
import CardComponent from './Card.js';

/** A card that changes hands in the pass, marked in a face-up hand. */
export type OpenHandMark = { label: string; title: string; tone: 'out' | 'in' };

type Props = {
  cards: CardType[];
  /** Widest the row may spread (px); the overlap tightens to fit. */
  maxWidth?: number;
  marks?: ReadonlyMap<string, OpenHandMark>;
  /** Shown when the hand is empty. */
  emptyLabel?: string;
};

const CARD_W = 64; // Card.tsx small: w-16
const MAX_STEP = 34;

/**
 * Someone else's hand, face up (learning mode and hand reviews): a row of
 * small overlapping cards, sorted the way the player sees their own hand.
 */
export default function OpenHand({ cards, maxWidth = 430, marks, emptyLabel }: Props) {
  if (cards.length === 0) {
    return emptyLabel
      ? <div className="h-24 flex items-center text-lg italic text-cream/40">{emptyLabel}</div>
      : null;
  }
  const sorted = sortHand([...cards]);
  const step = sorted.length > 1 ? Math.min(MAX_STEP, (maxWidth - CARD_W) / (sorted.length - 1)) : 0;
  return (
    <div className="open-hand flex" aria-label="Face-up hand">
      {sorted.map((card, i) => {
        const mark = marks?.get(cardId(card));
        return (
          <div
            key={cardId(card)}
            className="relative"
            style={{ marginLeft: i > 0 ? `${step - CARD_W}px` : 0 }}
            title={mark?.title}
          >
            <div className={mark ? `rounded-lg ring-[3px] ${mark.tone === 'out' ? 'ring-ochre' : 'ring-good'}` : undefined}>
              <CardComponent card={card} small />
            </div>
            {mark && (
              <span
                className={`absolute -top-3 left-0.5 z-10 whitespace-nowrap rounded-full px-1.5 text-xs font-extrabold leading-5 shadow ${
                  mark.tone === 'out' ? 'bg-ochre text-ink' : 'bg-good text-ink'
                }`}
              >
                {mark.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
