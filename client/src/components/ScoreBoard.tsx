import { ClientGameState, ClientPlayer } from '@tichu/shared';

type Props = {
  gameState: ClientGameState;
};

function PlayerAvatar({ player, size = 'sm' }: { player: ClientPlayer; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'w-7 h-7' : 'w-5 h-5';
  const textClass = size === 'md' ? 'text-2xl' : 'text-2xl';
  if (player.photoURL) {
    return <img src={player.photoURL} alt="" className={`${sizeClass} rounded-full inline-block`} referrerPolicy="no-referrer" />;
  }
  return <span className={`${textClass} font-semibold text-cream/80`}>{player.name}</span>;
}

function TeamDisplay({ p1, p2, score }: { p1: ClientPlayer; p2: ClientPlayer; score: number }) {
  const bothHavePhotos = p1.photoURL && p2.photoURL;
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {bothHavePhotos ? (
          <>
            <PlayerAvatar player={p1} size="md" />
            <span className="text-cream/40 text-2xl">+</span>
            <PlayerAvatar player={p2} size="md" />
          </>
        ) : (
          <span className="text-2xl font-semibold text-cream/80">
            {p1.name} + {p2.name}
          </span>
        )}
      </div>
      <div className="font-display text-5xl font-semibold text-cream">{score}</div>
    </div>
  );
}

export default function ScoreBoard({ gameState }: Props) {
  const { teams, players } = gameState;

  return (
    <div className="surface px-4 py-3 text-3xl">
      <h3 className="font-sans font-extrabold text-center mb-1 text-ochre-light text-xl uppercase tracking-[0.2em]">
        Score{gameState.settings.targetScore !== 1000 && (
          <span className="font-semibold normal-case tracking-normal text-cream/50"> (to {gameState.settings.targetScore})</span>
        )}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <TeamDisplay p1={players[0]} p2={players[2]} score={teams[0].score} />
        <TeamDisplay p1={players[1]} p2={players[3]} score={teams[1].score} />
      </div>

      {/* Tichu calls or "Points Hand" when no one can call */}
      {players.some(p => p.tichuCall !== 'none') ? (
        <div className="mt-2 pt-2 border-t border-cream/10">
          {players.filter(p => p.tichuCall !== 'none').map(p => (
            <div key={p.seat} className="text-2xl text-center">
              <span className="text-cream/80">{p.name}</span>:{' '}
              <span className={p.tichuCall === 'grand' ? 'text-[#8FB0F0] font-bold' : 'text-[#A9CF8A] font-semibold'}>
                {p.tichuCall === 'grand' ? 'GRAND TICHU' : 'Tichu'}
              </span>
            </div>
          ))}
        </div>
      ) : gameState.phase === 'playing' && players.every(p => p.isOut || p.hasPlayedFirstCard) && (
        <div className="mt-2 pt-2 border-t border-cream/10 text-2xl text-center text-cream/50">
          Points Hand
        </div>
      )}

    </div>
  );
}
