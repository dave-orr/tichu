import { useState } from 'react';
import { useSocket } from './hooks/useSocket.js';
import Lobby from './pages/Lobby.js';
import Game from './pages/Game.js';

export default function App() {
  const socket = useSocket();

  const inGame = socket.gameState && socket.gameState.phase !== 'waiting';

  return (
    <div className="min-h-screen bg-felt-dark text-white">
      {!inGame ? (
        <Lobby socket={socket} />
      ) : (
        <Game socket={socket} />
      )}
    </div>
  );
}
