import { Card as CardType, RANK_NAMES, SPECIAL_NAMES, SpecialCardName } from '@tichu/shared';

type Props = {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  large?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
};

// Pip positions for 2-10 within the card's central pip box (0..1 on each
// axis), laid out like a traditional deck so a hand reads by pattern as well
// as by number.
const PIPS: Record<number, [number, number][]> = {
  2: [[0.5, 0], [0.5, 1]],
  3: [[0.5, 0], [0.5, 0.5], [0.5, 1]],
  4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  5: [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
  6: [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  7: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  8: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
  9: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0.5, 0.5], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1]],
  10: [[0, 0], [1, 0], [0.5, 1 / 6], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [0.5, 5 / 6], [0, 1], [1, 1]],
};

// Per-size geometry (px): card size, corner index, pips, and the big centre
// symbol for courts and Aces. Pips and index symbols reuse the same few suit
// images, which the browser draws once and then just repeats.
const SIZES = {
  small: { w: 64, h: 96, corner: 'text-sm', index: 11, pip: 13, centre: 34 },
  default: { w: 96, h: 144, corner: 'text-base', index: 15, pip: 19, centre: 52 },
  large: { w: 144, h: 216, corner: 'text-2xl', index: 22, pip: 28, centre: 76 },
} as const;

export default function CardComponent({ card, selected, onClick, small, large, draggable, onDragStart }: Props) {
  // Default card is w-24 h-36. `large` is 50% bigger (w-36 h-[216px]) with
  // proportionally scaled glyphs, used for the player's own hand and pass slots.
  const sizeClass = small ? 'w-16 h-24 text-xs' : large ? 'w-36 h-[216px]' : 'w-24 h-36';

  if (card.type === 'special') {
    return (
      <div
        className={`card special-${card.name} ${selected ? 'selected' : ''} ${sizeClass}`}
        onClick={onClick}
        draggable={draggable}
        onDragStart={onDragStart}
      >
        <SpecialCardContent name={card.name} small={small} large={large} />
      </div>
    );
  }

  const g = SIZES[small ? 'small' : large ? 'large' : 'default'];
  // Full papercraft art for the big centre symbol; the bolder, filter-free
  // pip version for the corner index and pips (crisp small, cheap to draw).
  const suitSrc = `${import.meta.env.BASE_URL}cards/suit-${card.suit}.svg`;
  const pipSrc = `${import.meta.env.BASE_URL}cards/pip-${card.suit}.svg`;
  // The 發 reads heavier than the other suits, so draw it a touch smaller.
  const scale = card.suit === 'jade' ? 0.9 : 1;
  const suitImg = (size: number, style?: React.CSSProperties, key?: number, src = pipSrc) => (
    <img
      key={key}
      src={src}
      alt=""
      draggable={false}
      className="pointer-events-none select-none"
      style={{ width: size * scale, height: size * scale, ...style }}
    />
  );
  const index = (
    <div className={`${g.corner} leading-none flex flex-col items-center gap-0.5`}>
      <span className="card-rank">{RANK_NAMES[card.rank]}</span>
      {suitImg(g.index)}
    </div>
  );
  const pips = PIPS[card.rank];
  const isCourt = card.rank >= 11 && card.rank <= 13;
  // Pip box: the middle of the card, clear of the corner indices.
  const box = { left: g.w * 0.36, right: g.w * 0.64, top: g.h * 0.18, bottom: g.h * 0.82 };

  return (
    <div
      className={`card suit-${card.suit} ${selected ? 'selected' : ''} ${sizeClass}`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      aria-label={`${RANK_NAMES[card.rank]} of ${card.suit}`}
    >
      <div className="absolute top-1 left-1">{index}</div>
      <div className="absolute bottom-1 right-1 rotate-180">{index}</div>
      {pips ? (
        pips.map(([x, y], k) => {
          const px = g.pip * scale;
          return suitImg(g.pip, {
            position: 'absolute',
            left: box.left + (box.right - box.left) * x - px / 2,
            top: box.top + (box.bottom - box.top) * y - px / 2,
          }, k);
        })
      ) : (
        isCourt ? (
          // Court cards: a papercraft royal portrait inside a gold frame.
          <>
            <img
              src={`${import.meta.env.BASE_URL}cards/royal-${'JQK'[card.rank - 11]}-${card.suit}.svg`}
              alt=""
              draggable={false}
              className="absolute inset-[23%] w-[54%] h-[54%] rounded-md object-cover pointer-events-none select-none"
            />
            <div className="absolute inset-[23%] rounded-md border-2 border-[#C99A3B]/80 pointer-events-none" />
          </>
        ) : (
          suitImg(g.centre, undefined, undefined, suitSrc)
        )
      )}
    </div>
  );
}

function SpecialCardContent({ name, small, large }: { name: SpecialCardName; small?: boolean; large?: boolean }) {
  const cornerClass = large ? 'text-2xl' : 'text-base';
  const artClass = small ? 'w-12 h-12' : large ? 'w-28 h-28' : 'w-20 h-20';
  const labelClass = large ? 'text-base' : 'text-xs';
  return (
    <>
      {name === 'mahjong' && <div className={`${cornerClass} card-rank absolute top-1 left-1.5`}>1</div>}
      <img
        src={`${import.meta.env.BASE_URL}cards/${name}.svg`}
        alt=""
        draggable={false}
        className={`${artClass} pointer-events-none`}
      />
      {/* The Mah Jong is identified by its "1" corner; the others by name. */}
      {name !== 'mahjong' && <div className={`${labelClass} font-display font-semibold leading-tight`}>{SPECIAL_NAMES[name]}</div>}
    </>
  );
}

export function CardBack({ count, horizontal, rotated }: { count?: number; horizontal?: boolean; rotated?: boolean }) {
  if (count !== undefined && count === 0) {
    return <div className="text-gray-500 text-base italic">Out</div>;
  }
  if (horizontal) {
    const cardRow = (
      <div className="flex justify-center">
        {Array.from({ length: Math.min(count ?? 1, 14) }).map((_, i) => (
          <div key={i} className="card-back" style={{ marginLeft: i > 0 ? '-20px' : '0' }} />
        ))}
      </div>
    );
    if (rotated) {
      // Each card-back is 40w × 56h with 20px overlap. After a 90° rotation the
      // strip's visual size is 56 wide × (40 + (n-1)*20) tall, but CSS transforms
      // don't update layout — so reserve the rotated dimensions explicitly and
      // counter-translate to keep the content inside that box.
      const cardCount = Math.min(count ?? 1, 14);
      const stripHeight = cardCount > 0 ? 40 + (cardCount - 1) * 20 : 40;
      const stripWidth = 56;
      return (
        <div className="relative" style={{ width: stripWidth, height: stripHeight }}>
          <div
            className="absolute top-0 left-0"
            style={{ transform: `translateX(${stripWidth}px) rotate(90deg)`, transformOrigin: 'top left' }}
          >
            {cardRow}
          </div>
        </div>
      );
    }
    return cardRow;
  }
  return (
    <div className="flex flex-wrap gap-0.5 justify-center max-w-[80px]">
      {Array.from({ length: Math.min(count ?? 1, 14) }).map((_, i) => (
        <div key={i} className="card-back" style={{ marginLeft: i > 0 ? '-6px' : '0' }} />
      ))}
    </div>
  );
}
