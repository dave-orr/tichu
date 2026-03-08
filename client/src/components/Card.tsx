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
        className={`card special-${card.name} ${selected ? 'selected' : ''} ${small ? 'w-14 h-[84px] text-xs' : ''}`}
        onClick={onClick}
      >
        <SpecialCardContent name={card.name} />
      </div>
    );
  }

  const suitClass = `suit-${card.suit}`;
  return (
    <div
      className={`card ${suitClass} ${selected ? 'selected' : ''} ${small ? 'w-14 h-[84px] text-xs' : ''}`}
      onClick={onClick}
    >
      <div className="text-sm font-bold absolute top-1 left-1.5">
        {RANK_NAMES[card.rank]}
      </div>
      <div className="text-3xl">{SUIT_SYMBOLS[card.suit]}</div>
      <div className="text-sm font-bold absolute bottom-1 right-1.5 rotate-180">
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
          <div className="text-sm font-bold absolute top-1 left-1.5">1</div>
          <div className="text-xl font-bold">MJ</div>
          <div className="text-[10px]">Mah Jong</div>
        </>
      );
    case 'dog':
      return (
        <>
          <div className="text-3xl">🐕</div>
          <div className="text-[10px]">Dog</div>
        </>
      );
    case 'phoenix':
      return (
        <>
          <div className="text-3xl">🔥</div>
          <div className="text-[10px]">Phoenix</div>
        </>
      );
    case 'dragon':
      return (
        <>
          <div className="text-3xl">🐉</div>
          <div className="text-[10px]">Dragon</div>
        </>
      );
    default:
      return null;
  }
}

export function CardBack({ count, horizontal }: { count?: number; horizontal?: boolean }) {
  if (count !== undefined && count === 0) {
    return <div className="text-gray-500 text-sm italic">Out</div>;
  }
  if (horizontal) {
    return (
      <div className="flex items-center gap-2 justify-center">
        <div className="flex">
          {Array.from({ length: Math.min(count ?? 1, 14) }).map((_, i) => (
            <div key={i} className="card-back" style={{ marginLeft: i > 0 ? '-20px' : '0' }} />
          ))}
        </div>
        {count !== undefined && (
          <div className="text-xs text-gray-300">{count} cards</div>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-0.5 justify-center max-w-[80px]">
      {Array.from({ length: Math.min(count ?? 1, 14) }).map((_, i) => (
        <div key={i} className="card-back" style={{ marginLeft: i > 0 ? '-6px' : '0' }} />
      ))}
      {count !== undefined && (
        <div className="text-xs text-gray-300 w-full text-center mt-1">{count} cards</div>
      )}
    </div>
  );
}
