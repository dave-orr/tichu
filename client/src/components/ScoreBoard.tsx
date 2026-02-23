import { ClientGameState } from '@tichu/shared';

type Props = {
  gameState: ClientGameState;
};

export default function ScoreBoard({ gameState }: Props) {
  const { teams, players } = gameState;

  return (
    <div className="bg-gray-900/80 rounded-lg p-3 text-sm">
      <h3 className="font-bold text-center mb-2 text-yellow-400">Score</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-xs text-gray-400">Team 1</div>
          <div className="text-xs text-gray-500">
            {players[0].name} & {players[2].name}
          </div>
          <div className="text-2xl font-bold">{teams[0].score}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-400">Team 2</div>
          <div className="text-xs text-gray-500">
            {players[1].name} & {players[3].name}
          </div>
          <div className="text-2xl font-bold">{teams[1].score}</div>
        </div>
      </div>

      {/* Tichu calls */}
      {players.some(p => p.tichuCall !== 'none') && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          {players.filter(p => p.tichuCall !== 'none').map(p => (
            <div key={p.seat} className="text-xs text-center">
              <span className="text-yellow-400">{p.name}</span>:{' '}
              <span className={p.tichuCall === 'grand' ? 'text-red-400 font-bold' : 'text-orange-400'}>
                {p.tichuCall === 'grand' ? 'GRAND TICHU' : 'Tichu'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Mah Jong wish */}
      {gameState.mahJongWish && (
        <div className="mt-2 pt-2 border-t border-gray-700 text-center">
          <span className="text-xs text-yellow-300">
            Wish: {gameState.mahJongWish === 11 ? 'J' : gameState.mahJongWish === 12 ? 'Q' : gameState.mahJongWish === 13 ? 'K' : gameState.mahJongWish === 14 ? 'A' : gameState.mahJongWish}
          </span>
        </div>
      )}
    </div>
  );
}
