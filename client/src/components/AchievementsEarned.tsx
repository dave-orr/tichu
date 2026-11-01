import { ACHIEVEMENTS, type AchievementEvent, type ClientPlayer } from '@tichu/shared';
import AchievementBadge from './AchievementBadge.js';

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
          // Each card's pop-in animation (fill-mode both) leaves a transform
          // on it, so every card is its own stacking context and the badge
          // tooltip's z-index can't escape it: later cards would paint over
          // it. Lifting the hovered card keeps its tooltip on top.
          return (
            <div
              key={`${e.id}-${e.roundNumber}-${e.seats.join()}-${i}`}
              className="achievement-pop relative hover:z-10 flex items-center gap-3 rounded-xl border border-yellow-600/60 bg-gray-900/70 pl-2 pr-4 py-2"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <AchievementBadge id={e.id} />
              <div className="text-left">
                <div className="text-2xl font-bold text-yellow-400">{def.name}</div>
                <div className="text-2xl text-white">{e.seats.length === 4 ? 'Everyone' : e.seats.map(s => players[s]?.name ?? '?').join(' + ')}</div>
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
