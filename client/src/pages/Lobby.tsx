import { useState, useEffect, useRef } from 'react';
import type { useSocket } from '../hooks/useSocket.js';
import type { useAuth } from '../hooks/useAuth.js';
import UserStats from '../components/UserStats.js';
import WaitingRoom from '../components/WaitingRoom.js';
import CreateRoomForm from '../components/CreateRoomForm.js';

type Props = {
  socket: ReturnType<typeof useSocket>;
  auth: ReturnType<typeof useAuth>;
};

export default function Lobby({ socket, auth }: Props) {
  const { profile, loading: authLoading, signInWithGoogle, signOut } = auth;
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [showStats, setShowStats] = useState(false);
  const namePrefilledRef = useRef(false);

  // Pre-fill name from profile
  useEffect(() => {
    if (profile && !namePrefilledRef.current) {
      namePrefilledRef.current = true;
      setPlayerName(profile.preferences.preferredName);
    }
  }, [profile]);

  const { connectionState, gameState, roomCode, error, isOrganizer } = socket;

  const isInRoom = roomCode && gameState;

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
      <WaitingRoom
        roomCode={roomCode}
        gameState={gameState}
        isOrganizer={isOrganizer}
        randomPartners={socket.randomPartners}
        hasProfile={!!profile}
        onSwapSeats={socket.swapSeats}
        onUpdateSettings={socket.updateSettings}
        onStartGame={socket.startGame}
        fetchPlayers={socket.fetchPlayers}
        sendInvite={socket.sendInvite}
        expiredInviteUids={socket.expiredInviteUids}
      />
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bg-felt p-8 rounded-xl shadow-2xl max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-8">Tichu</h1>

        {/* Auth section */}
        <div className="mb-6">
          {authLoading ? (
            <div className="text-center text-gray-400 text-sm">Loading...</div>
          ) : profile ? (
            <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-3">
                {profile.photoURL && (
                  <img
                    src={profile.photoURL}
                    alt=""
                    className="w-8 h-8 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <div className="text-sm font-semibold">{profile.displayName}</div>
                  <div className="text-xs text-gray-400">{profile.email}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowStats(!showStats)}
                  className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  Stats
                </button>
                <button
                  onClick={signOut}
                  className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="w-full py-3 bg-white text-gray-800 hover:bg-gray-100 rounded-lg font-semibold transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
          )}
        </div>

        {/* Stats modal */}
        {showStats && profile && (
          <UserStats stats={profile.stats} onClose={() => setShowStats(false)} />
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-500 p-3 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        {socket.pendingInvites.length > 0 && (
          <div className="space-y-2 mb-4">
            {socket.pendingInvites.map(inv => (
              <div key={inv.inviteId} className="bg-blue-900/50 border border-blue-500 p-3 rounded-lg flex items-center justify-between gap-3">
                <span className="text-sm">
                  <strong>{inv.fromName}</strong> invited you to room <strong>{inv.roomCode}</strong>
                </span>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => socket.respondInvite(inv.inviteId, true, playerName.trim() || profile?.preferences.preferredName || 'Player', profile?.photoURL)}
                    className="text-xs px-3 py-1 bg-green-600 hover:bg-green-500 rounded font-semibold transition-colors"
                  >
                    Join
                  </button>
                  <button
                    onClick={() => socket.respondInvite(inv.inviteId, false)}
                    className="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
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
                setMode('create');
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

        {mode === 'create' && (
          <CreateRoomForm
            initialSettings={profile?.preferences.lastSettings}
            onCreateRoom={(randomPartners, settings) => {
              socket.createRoom(playerName.trim(), randomPartners, settings, profile?.photoURL);
              socket.saveSettings(settings);
              auth.updateLastSettings(settings);
            }}
            onBack={() => setMode('menu')}
          />
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
                socket.joinRoom(joinCode, playerName.trim(), profile?.photoURL);
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

        {!profile && !authLoading && (
          <p className="text-center text-xs text-gray-500 mt-6">
            Sign in to track your stats across games
          </p>
        )}
      </div>
    </div>
  );
}
