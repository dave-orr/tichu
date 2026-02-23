import { useState } from 'react';
import type { useSocket } from '../hooks/useSocket.js';

type Props = {
  socket: ReturnType<typeof useSocket>;
};

export default function Lobby({ socket }: Props) {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');

  const { connectionState, gameState, roomCode, error } = socket;

  const isInRoom = roomCode && gameState;
  const playerCount = gameState?.players.filter(p => p.name).length ?? 0;

  if (connectionState !== 'connected' && !isInRoom) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Tichu</h1>
          <p className="text-gray-300">Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (isInRoom) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-felt p-8 rounded-xl shadow-2xl max-w-md w-full text-center">
          <h1 className="text-3xl font-bold mb-2">Tichu</h1>
          <p className="text-gray-300 mb-6">Room Code</p>
          <div className="text-5xl font-mono font-bold mb-6 tracking-widest text-yellow-400">
            {roomCode}
          </div>
          <p className="text-gray-300 mb-4">Share this code with other players</p>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Players ({playerCount}/4)</h3>
            <div className="grid grid-cols-2 gap-2">
              {gameState.players.map((p, i) => (
                <div
                  key={i}
                  className={`p-2 rounded ${
                    p.name ? 'bg-green-700' : 'bg-gray-700'
                  }`}
                >
                  <span className="text-xs text-gray-300">
                    {['North', 'East', 'South', 'West'][i]}
                  </span>
                  <br />
                  {p.name || 'Waiting...'}
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Teams: North & South vs East & West
            </p>
          </div>

          {playerCount === 4 && (
            <button
              onClick={() => socket.startGame()}
              className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold text-lg transition-colors"
            >
              Start Game
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-felt p-8 rounded-xl shadow-2xl max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-8">Tichu</h1>

        {error && (
          <div className="bg-red-900/50 border border-red-500 p-3 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        {mode === 'menu' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your name"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500"
              maxLength={20}
            />
            <button
              onClick={() => {
                if (!playerName.trim()) return;
                socket.createRoom(playerName.trim());
              }}
              disabled={!playerName.trim()}
              className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
            >
              Create Room
            </button>
            <button
              onClick={() => {
                if (!playerName.trim()) return;
                setMode('join');
              }}
              disabled={!playerName.trim()}
              className="w-full py-3 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
            >
              Join Room
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Room code"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500 text-center text-2xl tracking-widest font-mono"
              maxLength={4}
            />
            <button
              onClick={() => {
                if (joinCode.length !== 4) return;
                socket.joinRoom(joinCode, playerName.trim());
              }}
              disabled={joinCode.length !== 4}
              className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
            >
              Join
            </button>
            <button
              onClick={() => setMode('menu')}
              className="w-full py-2 text-gray-400 hover:text-white transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
