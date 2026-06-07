import { ClientGameState, getLeftSeat, getRightSeat, getPartnerSeat } from '@tichu/shared';

type Props = {
  gameState: ClientGameState;
};

// A small round arrow showing the direction of play. Drawn clockwise; mirrored
// horizontally for counterclockwise (right side moving up reads as CCW).
function DirectionArrow({ clockwise }: { clockwise: boolean }) {
  return (
    <svg
      viewBox="0 0 28 28"
      className="w-9 h-9 text-yellow-400"
      style={{ transform: clockwise ? undefined : 'scaleX(-1)' }}
      aria-hidden
    >
      <path
        d="M14 5 A 9 9 0 1 1 5 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M5 9 L1.5 14.5 L8.5 14.5 Z" fill="currentColor" />
    </svg>
  );
}

function SeatLabel({
  name, isMe, position,
}: { name: string; isMe: boolean; position: 'top' | 'bottom' | 'left' | 'right' }) {
  const posClass = {
    top: 'top-0 left-1/2 -translate-x-1/2',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2',
    left: 'left-0 top-1/2 -translate-y-1/2',
    right: 'right-0 top-1/2 -translate-y-1/2',
  }[position];
  return (
    <div className={`absolute ${posClass} max-w-[64px]`}>
      <div
        className={`truncate rounded px-1.5 py-0.5 text-xs font-semibold text-center ${
          isMe
            ? 'bg-yellow-600/80 text-white ring-1 ring-yellow-300'
            : 'bg-gray-700/80 text-gray-200'
        }`}
        title={name}
      >
        {name}
        {isMe && <span className="text-yellow-200"> (you)</span>}
      </div>
    </div>
  );
}

export default function SeatingDiagram({ gameState }: Props) {
  const { players, mySeat, settings } = gameState;
  const leftSeat = getLeftSeat(mySeat);
  const rightSeat = getRightSeat(mySeat);
  const partnerSeat = getPartnerSeat(mySeat);

  return (
    <div className="bg-gray-900/80 rounded-lg p-3 flex flex-col items-center">
      <h3 className="font-bold text-center mb-2 text-yellow-400 text-base">Table</h3>
      <div className="relative w-48 h-28">
        <SeatLabel name={players[partnerSeat].name} isMe={false} position="top" />
        <SeatLabel name={players[leftSeat].name} isMe={false} position="left" />
        <SeatLabel name={players[rightSeat].name} isMe={false} position="right" />
        <SeatLabel name={players[mySeat].name} isMe position="bottom" />
        <div className="absolute inset-0 flex items-center justify-center">
          <DirectionArrow clockwise={settings.clockwise} />
        </div>
      </div>
    </div>
  );
}
