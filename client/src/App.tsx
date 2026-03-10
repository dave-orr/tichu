import { useEffect, useRef } from 'react';
import { useSocket } from './hooks/useSocket.js';
import { useAuth } from './hooks/useAuth.js';
import type { UserProfile } from './hooks/useAuth.js';
import Lobby from './pages/Lobby.js';
import Game from './pages/Game.js';

export default function App() {
  const authState = useAuth();
  const socket = useSocket(authState.idToken);
  const profileLoadedRef = useRef(false);

  // Load full profile (stats + lastSettings) from server once connected + authenticated
  useEffect(() => {
    if (socket.connectionState !== 'connected' || !authState.idToken || profileLoadedRef.current) return;
    profileLoadedRef.current = true;
    socket.loadProfile().then(result => {
      if ('profile' in result) {
        authState.updateProfile(result.profile as UserProfile);
      }
    }).catch(() => { /* keep minimal profile */ });
  }, [socket.connectionState, authState.idToken]);

  // Reset when user signs out so profile reloads on next sign-in
  useEffect(() => {
    if (!authState.user) {
      profileLoadedRef.current = false;
    }
  }, [authState.user]);

  const inGame = socket.gameState && socket.gameState.phase !== 'waiting';

  return (
    <div className="min-h-screen bg-felt-dark text-white">
      {socket.connectionState === 'disconnected' && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-800 text-white text-center py-2 px-4 text-sm font-medium shadow-lg">
          Disconnected from server — reconnecting…
        </div>
      )}
      {socket.roomLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm mx-4 text-center shadow-xl">
            <h2 className="text-xl font-bold mb-2">Game session lost</h2>
            <p className="text-gray-300 mb-4">
              The server restarted and the game is no longer available.
            </p>
            <button
              onClick={socket.resetRoom}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium transition-colors"
            >
              Back to lobby
            </button>
          </div>
        </div>
      )}
      {!inGame ? (
        <Lobby socket={socket} auth={authState} />
      ) : (
        <Game socket={socket} auth={authState} />
      )}
    </div>
  );
}
