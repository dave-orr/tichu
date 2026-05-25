import { Card as CardType, RANK_NAMES, SUIT_SYMBOLS, SPECIAL_NAMES, NormalRank } from '@tichu/shared';

type Props = {
  card: CardType;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
};

export default function CardComponent({ card, selected, onClick, small }: Props) {
  if (card.type === 'special') {
    return (
      <div
        className={`card special-${card.name} ${selected ? 'selected' : ''} ${small ? 'w-24 h-36' : ''}`}
        onClick={onClick}
      >
        <SpecialCardContent name={card.name} small={small} />
      </div>
    );
  }

  const suitClass = `suit-${card.suit}`;
  return (
    <div
      className={`card ${suitClass} ${selected ? 'selected' : ''} ${small ? 'w-24 h-36' : ''}`}
      onClick={onClick}
    >
      <div className={`font-bold absolute top-1 left-1.5 leading-none ${small ? 'text-base' : 'text-2xl'}`}>
        {RANK_NAMES[card.rank]}
      </div>
      <div className={small ? 'text-4xl' : 'text-6xl'}>{SUIT_SYMBOLS[card.suit]}</div>
      <div className={`font-bold absolute bottom-1 right-1.5 rotate-180 leading-none ${small ? 'text-base' : 'text-2xl'}`}>
        {RANK_NAMES[card.rank]}
      </div>
    </div>
  );
}

function SpecialCardContent({ name, small }: { name: string; small?: boolean }) {
  const big = small ? 'text-4xl' : 'text-6xl';
  const corner = small ? 'text-base' : 'text-2xl';
  const label = small ? 'text-xs' : 'text-sm';
  switch (name) {
    case 'mahjong':
      return (
        <>
          <div className={`${corner} font-bold absolute top-1 left-1.5 leading-none`}>1</div>
          <div className={`${small ? 'text-2xl' : 'text-4xl'} font-bold`}>MJ</div>
          <div className={label}>Mah Jong</div>
        </>
      );
    case 'dog':
      return (
        <>
          <div className={big}>🐕</div>
          <div className={label}>Dog</div>
        </>
      );
    case 'phoenix':
      return (
        <>
          <div className={big}>🔥</div>
          <div className={label}>Phoenix</div>
        </>
      );
    case 'dragon':
      return (
        <>
          <div className={big}>🐉</div>
          <div className={label}>Dragon</div>
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
