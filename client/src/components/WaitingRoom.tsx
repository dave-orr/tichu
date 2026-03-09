import { useState } from 'react';
import type { Seat, ClientGameState, InvitablePlayer } from '@tichu/shared';
import InvitePanel from './InvitePanel.js';

const SEAT_NAMES = ['North', 'East', 'South', 'West'];

type Props = {
  roomCode: string;
  gameState: ClientGameState;
  isOrganizer: boolean;
  randomPartners: boolean;
  hasProfile: boolean;
  onSwapSeats: (from: Seat, to: Seat) => void;
  onUpdateSettings: (settings: Record<string, boolean | number>) => void;
  onUpdateRandomPartners: (randomPartners: boolean) => void;
  onStartGame: () => void;
  fetchPlayers: () => Promise<{ players: InvitablePlayer[] }>;
  sendInvite: (targetUid: string) => void;
  expiredInviteUids: Set<string>;
};

export default function WaitingRoom({
  roomCode, gameState, isOrganizer, randomPartners, hasProfile,
  onSwapSeats, onUpdateSettings, onUpdateRandomPartners, onStartGame,
  fetchPlayers, sendInvite, expiredInviteUids,
}: Props) {
  const [swapFrom, setSwapFrom] = useState<Seat | null>(null);
  const [showInvitePanel, setShowInvitePanel] = useState(false);

  const playerCount = gameState.players.filter(p => p.name).length;
  const canSwapSeats = isOrganizer && !randomPartners && playerCount >= 2;

  const handleSeatClick = (seat: Seat) => {
    if (!canSwapSeats) return;
    if (!gameState.players[seat].name) return;
    if (swapFrom === null) {
      setSwapFrom(seat);
    } else if (swapFrom === seat) {
      setSwapFrom(null);
    } else {
      onSwapSeats(swapFrom, seat);
      setSwapFrom(null);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-felt p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-2">Tichu</h1>
        <p className="text-gray-300 mb-6">Room Code</p>
        <div className="text-5xl font-mono font-bold mb-6 tracking-widest text-yellow-400">
          {roomCode}
        </div>
        <p className="text-gray-300 mb-4">Share this code with other players</p>

        {isOrganizer && playerCount < 4 && hasProfile && (
          <button
            onClick={() => setShowInvitePanel(true)}
            className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
          >
            Invite Players
          </button>
        )}

        {showInvitePanel && (
          <InvitePanel
            onClose={() => setShowInvitePanel(false)}
            fetchPlayers={fetchPlayers}
            sendInvite={sendInvite}
            expiredInviteUids={expiredInviteUids}
          />
        )}


        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Players ({playerCount}/4)</h3>
          <div className="grid grid-cols-2 gap-2">
            {gameState.players.map((p, i) => {
              const isSelected = swapFrom === i;
              const isSwappable = canSwapSeats && p.name;
              return (
                <div
                  key={i}
                  onClick={() => handleSeatClick(i as Seat)}
                  className={`p-2 rounded transition-colors ${
                    p.name ? 'bg-green-700' : 'bg-gray-700'
                  } ${isSelected ? 'ring-2 ring-yellow-400' : ''} ${
                    isSwappable ? 'cursor-pointer hover:bg-green-600' : ''
                  }`}
                >
                  <span className="text-xs text-gray-300">
                    {SEAT_NAMES[i]}
                  </span>
                  <br />
                  {p.name || 'Waiting...'}
                </div>
              );
            })}
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Teams: North & South vs East & West
          </p>
          {canSwapSeats && (
            <p className="text-xs text-gray-500 mt-1">
              {swapFrom !== null
                ? `Click another player to swap with ${gameState.players[swapFrom].name}`
                : 'Click two players to swap their seats'}
            </p>
          )}
        </div>

        {/* Setup options */}
        <div className="mb-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-400 text-left">Setup Options</h3>
          <label
            className={`flex items-center gap-3 p-2 rounded-lg bg-gray-800 border border-gray-600 ${isOrganizer ? 'cursor-pointer' : 'opacity-70'}`}
          >
            <input
              type="checkbox"
              checked={randomPartners}
              onChange={e => isOrganizer && onUpdateRandomPartners(e.target.checked)}
              disabled={!isOrganizer}
              className="w-4 h-4 rounded accent-yellow-500"
            />
            <div className="text-left">
              <span className="text-sm font-semibold">Random Partners</span>
              <p className="text-xs text-gray-400">Randomly assign teams when the game starts</p>
            </div>
          </label>
          {[
            { key: 'countPoints' as const, label: 'Count Points', desc: 'Show captured point totals by each player\'s name' },
            { key: 'cardsSeen' as const, label: 'Cards Seen', desc: 'Show how many of each card remain unplayed' },
            { key: 'showPassedCards' as const, label: 'Show Passed Cards', desc: 'Show which cards you passed during play' },
            { key: 'clockwise' as const, label: 'Clockwise Play', desc: 'Play passes clockwise instead of counterclockwise' },
          ].map(opt => (
            <label
              key={opt.key}
              className={`flex items-center gap-3 p-2 rounded-lg bg-gray-800 border border-gray-600 ${isOrganizer ? 'cursor-pointer' : 'opacity-70'}`}
            >
              <input
                type="checkbox"
                checked={gameState.settings[opt.key]}
                onChange={e => isOrganizer && onUpdateSettings({ [opt.key]: e.target.checked })}
                disabled={!isOrganizer}
                className="w-4 h-4 rounded accent-yellow-500"
              />
              <div className="text-left">
                <span className="text-sm font-semibold">{opt.label}</span>
                <p className="text-xs text-gray-400">{opt.desc}</p>
              </div>
            </label>
          ))}
          <div className={`flex items-center gap-3 p-2 rounded-lg bg-gray-800 border border-gray-600 ${isOrganizer ? '' : 'opacity-70'}`}>
            <div className="flex-1 text-left">
              <span className="text-sm font-semibold">Target Score</span>
              <p className="text-xs text-gray-400">Points needed to win</p>
            </div>
            <input
              type="number"
              value={gameState.settings.targetScore}
              onChange={e => isOrganizer && onUpdateSettings({ targetScore: Math.max(100, Math.min(9999, Number(e.target.value) || 1000)) })}
              disabled={!isOrganizer}
              min={100}
              max={9999}
              step={50}
              className="w-20 py-1 px-2 bg-gray-700 border border-gray-500 rounded text-center text-white text-sm disabled:opacity-50"
            />
          </div>
        </div>

        {playerCount === 4 && isOrganizer && (
          <button
            onClick={onStartGame}
            className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold text-lg transition-colors"
          >
            Start Game
          </button>
        )}
        {playerCount === 4 && !isOrganizer && (
          <p className="text-gray-400 text-sm">Waiting for host to start the game...</p>
        )}
      </div>
    </div>
  );
}
