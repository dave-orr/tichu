import { useSocket } from './hooks/useSocket.js';
import { useAuth } from './hooks/useAuth.js';
import Lobby from './pages/Lobby.js';
import Game from './pages/Game.js';

export default function App() {
  const authState = useAuth();
  const socket = useSocket(authState.idToken);

  const inGame = socket.gameState && socket.gameState.phase !== 'waiting';

  return (
    <div className="min-h-screen bg-felt-dark text-white">
      {!inGame ? (
        <Lobby socket={socket} auth={authState} />
      ) : (
        <Game socket={socket} auth={authState} />
      )}
    </div>
  );
}
