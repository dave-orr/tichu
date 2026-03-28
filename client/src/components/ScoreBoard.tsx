import { ClientGameState, ClientPlayer } from '@tichu/shared';

type Props = {
  gameState: ClientGameState;
};

function PlayerAvatar({ player, size = 'sm' }: { player: ClientPlayer; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'w-7 h-7' : 'w-5 h-5';
  const textClass = size === 'md' ? 'text-sm' : 'text-xs';
  if (player.photoURL) {
    return <img src={player.photoURL} alt="" className={`${sizeClass} rounded-full inline-block`} referrerPolicy="no-referrer" />;
  }
  return <span className={`${textClass} font-semibold text-gray-200`}>{player.name}</span>;
}

function TeamDisplay({ p1, p2, score }: { p1: ClientPlayer; p2: ClientPlayer; score: number }) {
  const bothHavePhotos = p1.photoURL && p2.photoURL;
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {bothHavePhotos ? (
          <>
            <PlayerAvatar player={p1} size="md" />
            <span className="text-gray-500 text-xs">&</span>
            <PlayerAvatar player={p2} size="md" />
          </>
        ) : (
          <span className="text-sm font-medium text-gray-200">
            {p1.name} & {p2.name}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold">{score}</div>
    </div>
  );
}

export default function ScoreBoard({ gameState }: Props) {
  const { teams, players } = gameState;

  return (
    <div className="bg-gray-900/80 rounded-lg p-3 text-base">
      <h3 className="font-bold text-center mb-2 text-yellow-400">
        Score{gameState.settings.targetScore !== 1000 && (
          <span className="text-sm font-normal text-gray-400"> (to {gameState.settings.targetScore})</span>
        )}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <TeamDisplay p1={players[0]} p2={players[2]} score={teams[0].score} />
        <TeamDisplay p1={players[1]} p2={players[3]} score={teams[1].score} />
      </div>

      {/* Tichu calls or "Points Hand" when no one can call */}
      {players.some(p => p.tichuCall !== 'none') ? (
        <div className="mt-2 pt-2 border-t border-gray-700">
          {players.filter(p => p.tichuCall !== 'none').map(p => (
            <div key={p.seat} className="text-sm text-center">
              <span className="text-yellow-400">{p.name}</span>:{' '}
              <span className={p.tichuCall === 'grand' ? 'text-red-400 font-bold' : 'text-orange-400'}>
                {p.tichuCall === 'grand' ? 'GRAND TICHU' : 'Tichu'}
              </span>
            </div>
          ))}
        </div>
      ) : gameState.phase === 'playing' && players.every(p => p.isOut || p.hasPlayedFirstCard) && (
        <div className="mt-2 pt-2 border-t border-gray-700 text-sm text-center text-gray-400">
          Points Hand
        </div>
      )}

    </div>
  );
}
