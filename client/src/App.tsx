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
      {!inGame ? (
        <Lobby socket={socket} auth={authState} />
      ) : (
        <Game socket={socket} auth={authState} />
      )}
    </div>
  );
}
