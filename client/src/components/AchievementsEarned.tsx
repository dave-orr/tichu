import { ACHIEVEMENTS, type AchievementEvent, type ClientPlayer } from '@tichu/shared';

const DEFS = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

/**
 * Achievements the table earned, shown on the round / game results screen so
 * everyone gets to see them. Renders nothing when there are none.
 */
export default function AchievementsEarned({ events, players, isGameOver }: {
  events: AchievementEvent[] | undefined;
  players: ClientPlayer[];
  isGameOver: boolean;
}) {
  if (!events || events.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="text-3xl text-yellow-400 font-bold text-center mb-3">
        {isGameOver ? 'Achievements this game' : 'Achievements this hand'}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {events.map((e, i) => {
          const def = DEFS.get(e.id);
          if (!def) return null;
          return (
            <div
              key={`${e.id}-${e.roundNumber}-${e.seats.join()}-${i}`}
              className="achievement-pop flex items-center gap-3 rounded-xl border border-yellow-600/60 bg-gray-900/70 pl-2 pr-4 py-2"
              style={{ animationDelay: `${i * 120}ms` }}
              title={def.description}
            >
              <img src={`${import.meta.env.BASE_URL}achievements/${e.id}.svg`} alt="" className="w-20 h-20 flex-shrink-0" />
              <div className="text-left">
                <div className="text-2xl font-bold text-yellow-400">{def.name}</div>
                <div className="text-2xl text-white">{e.seats.map(s => players[s]?.name ?? '?').join(' + ')}</div>
                {isGameOver && e.roundNumber !== null && (
                  <div className="text-xl text-gray-400">Round {e.roundNumber}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
