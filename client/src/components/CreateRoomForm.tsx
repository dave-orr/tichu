import { useState } from 'react';
import type { GameSettings } from '@tichu/shared';

type Props = {
  initialSettings?: Partial<GameSettings>;
  initialRandomPartners?: boolean;
  onCreateRoom: (randomPartners: boolean, settings: GameSettings) => void;
  onBack: () => void;
};

export default function CreateRoomForm({ initialSettings, initialRandomPartners, onCreateRoom, onBack }: Props) {
  const [randomPartners, setRandomPartners] = useState(initialRandomPartners ?? false);
  const [countPoints, setCountPoints] = useState(initialSettings?.countPoints ?? false);
  const [cardsSeen, setCardsSeen] = useState(initialSettings?.cardsSeen ?? false);
  const [showPassedCards, setShowPassedCards] = useState(initialSettings?.showPassedCards ?? false);
  const [clockwise, setClockwise] = useState(initialSettings?.clockwise ?? false);
  const [targetScore, setTargetScore] = useState(initialSettings?.targetScore ?? 1000);

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
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 border border-gray-600">
        <div className="flex-1">
          <span className="font-semibold">Target Score</span>
          <p className="text-sm text-gray-400">Points needed to win the game</p>
        </div>
        <input
          type="number"
          value={targetScore}
          onChange={e => setTargetScore(Math.max(100, Math.min(9999, Number(e.target.value) || 1000)))}
          min={100}
          max={9999}
          step={50}
          className="w-24 py-1 px-2 bg-gray-700 border border-gray-500 rounded text-center text-white"
        />
      </div>
      <button
        onClick={() => {
          const settings = { countPoints, cardsSeen, showPassedCards, clockwise, targetScore };
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
