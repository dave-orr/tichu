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

export default function CardComponent({ card, selected, onClick, small, large, draggable, onDragStart }: Props) {
  // Default card is w-24 h-36. `large` is 50% bigger (w-36 h-[216px]) with
  // proportionally scaled glyphs, used for the player's own hand and pass slots.
  const sizeClass = small ? 'w-16 h-24 text-xs' : large ? 'w-36 h-[216px]' : 'w-24 h-36';
  const cornerClass = large ? 'text-2xl' : 'text-base';
  // Suit art (scripts/gen-card-art.py). The 發 reads heavier than the other
  // suits, so it is drawn a little smaller to balance them.
  const suitSize = small ? 9 : large ? 20 : 14;
  const suitClass = card.type === 'normal' && card.suit === 'jade'
    ? { 9: 'w-8 h-8', 14: 'w-12 h-12', 20: 'w-[72px] h-[72px]' }[suitSize]
    : { 9: 'w-9 h-9', 14: 'w-14 h-14', 20: 'w-20 h-20' }[suitSize];

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

  return (
    <div
      className={`card suit-${card.suit} ${selected ? 'selected' : ''} ${sizeClass}`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <div className={`${cornerClass} font-bold absolute top-1 left-1.5`}>
        {RANK_NAMES[card.rank]}
      </div>
      <img
        src={`${import.meta.env.BASE_URL}cards/suit-${card.suit}.svg`}
        alt={card.suit}
        draggable={false}
        className={`${suitClass} pointer-events-none`}
      />
      <div className={`${cornerClass} font-bold absolute bottom-1 right-1.5 rotate-180`}>
        {RANK_NAMES[card.rank]}
      </div>
    </div>
  );
}

function SpecialCardContent({ name, small, large }: { name: SpecialCardName; small?: boolean; large?: boolean }) {
  const cornerClass = large ? 'text-2xl' : 'text-base';
  const artClass = small ? 'w-12 h-12' : large ? 'w-28 h-28' : 'w-20 h-20';
  const labelClass = large ? 'text-base' : 'text-xs';
  return (
    <>
      {name === 'mahjong' && <div className={`${cornerClass} font-bold absolute top-1 left-1.5`}>1</div>}
      <img
        src={`${import.meta.env.BASE_URL}cards/${name}.svg`}
        alt=""
        draggable={false}
        className={`${artClass} pointer-events-none`}
      />
      <div className={`${labelClass} font-semibold leading-tight`}>{SPECIAL_NAMES[name]}</div>
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
