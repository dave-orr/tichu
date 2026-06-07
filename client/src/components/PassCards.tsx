import { useState } from 'react';
import { Card as CardType, cardId, getLeftSeat, getPartnerSeat, getRightSeat, Seat } from '@tichu/shared';
import CardComponent from './Card.js';
import Hand from './Hand.js';

type Props = {
  hand: CardType[];
  mySeat: Seat;
  playerNames: string[];
  onPass: (left: CardType, partner: CardType, right: CardType) => void;
};

type PassTarget = 'left' | 'partner' | 'right';

export default function PassCards({ hand, mySeat, playerNames, onPass }: Props) {
  const [selections, setSelections] = useState<Record<PassTarget, CardType | null>>({
    left: null,
    partner: null,
    right: null,
  });
  const [currentTarget, setCurrentTarget] = useState<PassTarget>('left');
  const [dragOverTarget, setDragOverTarget] = useState<PassTarget | null>(null);

  const leftSeat = getLeftSeat(mySeat);
  const partnerSeat = getPartnerSeat(mySeat);
  const rightSeat = getRightSeat(mySeat);

  const selectedIds = new Set(
    Object.values(selections).filter(Boolean).map(c => cardId(c!))
  );

  const handleCardClick = (card: CardType) => {
    const id = cardId(card);

    for (const target of ['left', 'partner', 'right'] as PassTarget[]) {
      if (selections[target] && cardId(selections[target]!) === id) {
        setSelections(s => ({ ...s, [target]: null }));
        setCurrentTarget(target);
        return;
      }
    }

    setSelections(s => ({ ...s, [currentTarget]: card }));

    const targets: PassTarget[] = ['left', 'partner', 'right'];
    const nextTargetIdx = targets.indexOf(currentTarget);
    for (let i = 1; i <= 3; i++) {
      const next = targets[(nextTargetIdx + i) % 3];
      const updatedSelections = { ...selections, [currentTarget]: card };
      if (!updatedSelections[next]) {
        setCurrentTarget(next);
        break;
      }
    }
  };

  const handleDrop = (target: PassTarget, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTarget(null);
    try {
      const card: CardType = JSON.parse(e.dataTransfer.getData('application/json'));
      const id = cardId(card);

      // If this card is already assigned to another slot, remove it from there
      const newSelections = { ...selections };
      for (const t of ['left', 'partner', 'right'] as PassTarget[]) {
        if (newSelections[t] && cardId(newSelections[t]!) === id) {
          newSelections[t] = null;
        }
      }

      newSelections[target] = card;
      setSelections(newSelections);

      // Advance currentTarget to next empty slot
      const targets: PassTarget[] = ['left', 'partner', 'right'];
      for (const t of targets) {
        if (!newSelections[t]) {
          setCurrentTarget(t);
          return;
        }
      }
    } catch {
      // ignore invalid drag data
    }
  };

  const handleDragOver = (target: PassTarget, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(target);
  };

  const handleSlotDragStart = (target: PassTarget, e: React.DragEvent) => {
    const card = selections[target];
    if (!card) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('application/json', JSON.stringify(card));
    e.dataTransfer.effectAllowed = 'move';
  };

  const allSelected = selections.left && selections.partner && selections.right;

  return (
    <div className="space-y-4">
      <h3 className="text-4xl font-bold text-center text-yellow-400">Pass Cards</h3>
      <p className="text-3xl text-gray-300 text-center">
        Select or drag one card to pass to each player
      </p>

      <div className="flex justify-center gap-8 mb-4">
        {([
          { target: 'left' as PassTarget, label: playerNames[leftSeat], seat: leftSeat },
          { target: 'partner' as PassTarget, label: playerNames[partnerSeat] + ' (partner)', seat: partnerSeat },
          { target: 'right' as PassTarget, label: playerNames[rightSeat], seat: rightSeat },
        ]).map(({ target, label }) => (
          <div
            key={target}
            className={`text-center cursor-pointer p-2 rounded transition-colors ${
              currentTarget === target ? 'bg-yellow-600/30 ring-2 ring-yellow-500' : ''
            } ${dragOverTarget === target ? 'bg-green-600/30 ring-2 ring-green-400' : ''}`}
            onClick={() => setCurrentTarget(target)}
            onDrop={(e) => handleDrop(target, e)}
            onDragOver={(e) => handleDragOver(target, e)}
            onDragLeave={() => setDragOverTarget(null)}
          >
            <div className="text-2xl text-gray-400 mb-1">{label}</div>
            {selections[target] ? (
              <div
                draggable
                onDragStart={(e) => handleSlotDragStart(target, e)}
              >
                <CardComponent card={selections[target]!} small />
              </div>
            ) : (
              <div className="w-16 h-24 border-2 border-dashed border-gray-500 rounded-lg flex items-center justify-center text-gray-500 text-sm">
                ?
              </div>
            )}
          </div>
        ))}
      </div>

      <Hand
        cards={hand}
        selectedCards={selectedIds}
        onToggleCard={handleCardClick}
        draggable
        onDragStart={() => {}}
      />

      {allSelected && (
        <div className="text-center">
          <button
            onClick={() => onPass(selections.left!, selections.partner!, selections.right!)}
            className="py-2 px-8 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold transition-colors"
          >
            Confirm Pass
          </button>
        </div>
      )}
    </div>
  );
}
