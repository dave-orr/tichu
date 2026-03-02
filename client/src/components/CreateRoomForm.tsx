import { useState } from 'react';
import type { GameSettings } from '@tichu/shared';

type Props = {
  initialSettings?: Partial<GameSettings>;
  onCreateRoom: (randomPartners: boolean, settings: GameSettings) => void;
  onBack: () => void;
};

export default function CreateRoomForm({ initialSettings, onCreateRoom, onBack }: Props) {
  const [randomPartners, setRandomPartners] = useState(false);
  const [countPoints, setCountPoints] = useState(initialSettings?.countPoints ?? false);
  const [cardsSeen, setCardsSeen] = useState(initialSettings?.cardsSeen ?? false);
  const [showPassedCards, setShowPassedCards] = useState(initialSettings?.showPassedCards ?? false);
  const [clockwise, setClockwise] = useState(initialSettings?.clockwise ?? false);

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-gray-800 border border-gray-600">
        <input
          type="checkbox"
          checked={randomPartners}
          onChange={e => setRandomPartners(e.target.checked)}
          className="w-5 h-5 rounded accent-yellow-500"
        />
        <div>
          <span className="font-semibold">Random Partners</span>
          <p className="text-sm text-gray-400">Randomly assign teams when the game starts</p>
        </div>
      </label>
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-gray-800 border border-gray-600">
        <input
          type="checkbox"
          checked={countPoints}
          onChange={e => setCountPoints(e.target.checked)}
          className="w-5 h-5 rounded accent-yellow-500"
        />
        <div>
          <span className="font-semibold">Count Points</span>
          <p className="text-sm text-gray-400">Show captured point totals by each player's name</p>
        </div>
      </label>
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-gray-800 border border-gray-600">
        <input
          type="checkbox"
          checked={cardsSeen}
          onChange={e => setCardsSeen(e.target.checked)}
          className="w-5 h-5 rounded accent-yellow-500"
        />
        <div>
          <span className="font-semibold">Cards Seen</span>
          <p className="text-sm text-gray-400">Show how many of each card remain unplayed</p>
        </div>
      </label>
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-gray-800 border border-gray-600">
        <input
          type="checkbox"
          checked={showPassedCards}
          onChange={e => setShowPassedCards(e.target.checked)}
          className="w-5 h-5 rounded accent-yellow-500"
        />
        <div>
          <span className="font-semibold">Show Passed Cards</span>
          <p className="text-sm text-gray-400">Show which cards you passed during play</p>
        </div>
      </label>
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-gray-800 border border-gray-600">
        <input
          type="checkbox"
          checked={clockwise}
          onChange={e => setClockwise(e.target.checked)}
          className="w-5 h-5 rounded accent-yellow-500"
        />
        <div>
          <span className="font-semibold">Clockwise Play</span>
          <p className="text-sm text-gray-400">Play passes clockwise instead of counterclockwise</p>
        </div>
      </label>
      <button
        onClick={() => {
          const settings = { countPoints, cardsSeen, showPassedCards, clockwise };
          onCreateRoom(randomPartners, settings);
        }}
        className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold text-lg transition-colors"
      >
        Create Room
      </button>
      <button
        onClick={onBack}
        className="w-full py-2 text-gray-400 hover:text-white transition-colors"
      >
        Back
      </button>
    </div>
  );
}
