import { Card as CardType, RANK_NAMES, SUIT_SYMBOLS, SPECIAL_NAMES, NormalRank } from '@tichu/shared';

type Props = {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
};

export default function CardComponent({ card, selected, onClick, small, draggable, onDragStart }: Props) {
  if (card.type === 'special') {
    return (
      <div
        className={`card special-${card.name} ${selected ? 'selected' : ''} ${small ? 'w-16 h-24 text-xs' : ''}`}
        onClick={onClick}
        draggable={draggable}
        onDragStart={onDragStart}
      >
        <SpecialCardContent name={card.name} />
      </div>
    );
  }

  const suitClass = `suit-${card.suit}`;
  return (
    <div
      className={`card ${suitClass} ${selected ? 'selected' : ''} ${small ? 'w-16 h-24 text-xs' : ''}`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <div className="text-base font-bold absolute top-1 left-1.5">
        {RANK_NAMES[card.rank]}
      </div>
      <div className="text-4xl">{SUIT_SYMBOLS[card.suit]}</div>
      <div className="text-base font-bold absolute bottom-1 right-1.5 rotate-180">
        {RANK_NAMES[card.rank]}
      </div>
    </div>
  );
}

function SpecialCardContent({ name }: { name: string }) {
  switch (name) {
    case 'mahjong':
      return (
        <>
          <div className="text-base font-bold absolute top-1 left-1.5">1</div>
          <div className="text-2xl font-bold">MJ</div>
          <div className="text-xs">Mah Jong</div>
        </>
      );
    case 'dog':
      return (
        <>
          <div className="text-4xl">🐕</div>
          <div className="text-xs">Dog</div>
        </>
      );
    case 'phoenix':
      return (
        <>
          <div className="text-4xl">🔥</div>
          <div className="text-xs">Phoenix</div>
        </>
      );
    case 'dragon':
      return (
        <>
          <div className="text-4xl">🐉</div>
          <div className="text-xs">Dragon</div>
        </>
      );
    default:
      return null;
  }
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
