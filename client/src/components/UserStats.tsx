import type { UserStats as UserStatsType } from '../hooks/useAuth.js';

type Props = {
  stats: UserStatsType;
  onClose: () => void;
};

export default function UserStats({ stats, onClose }: Props) {
  const winRate = stats.gamesPlayed > 0
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
    : 0;
  const tichuRate = stats.tichuCalls > 0
    ? Math.round((stats.tichuSuccesses / stats.tichuCalls) * 100)
    : 0;
  const grandRate = stats.grandTichuCalls > 0
    ? Math.round((stats.grandTichuSuccesses / stats.grandTichuCalls) * 100)
    : 0;
  const avgPointDiff = stats.roundsPlayed > 0
    ? Math.round(stats.totalPointDifferential / stats.roundsPlayed)
    : 0;
  const closeGameRate = stats.closeGamesPlayed > 0
    ? Math.round((stats.closeGameWins / stats.closeGamesPlayed) * 100)
    : 0;
  const comebackRate = stats.comebackOpportunities > 0
    ? Math.round((stats.comebackWins / stats.comebackOpportunities) * 100)
    : 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-yellow-400">Your Stats</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-sm"
        >
          Close
        </button>
      </div>

      {stats.gamesPlayed === 0 ? (
        <p className="text-gray-400 text-sm text-center py-2">
          No games played yet. Stats will appear here after your first game.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <StatRow label="Games Played" value={stats.gamesPlayed} />
            <StatRow label="Games Won" value={`${stats.gamesWon} (${winRate}%)`} />
            <StatRow label="Rounds Played" value={stats.roundsPlayed} />
            <StatRow label="First Out" value={stats.roundsWonFirstOut} />
            <StatRow
              label="Tichu Calls"
              value={stats.tichuCalls > 0 ? `${stats.tichuSuccesses}/${stats.tichuCalls} (${tichuRate}%)` : '0'}
            />
            <StatRow
              label="Grand Tichu"
              value={stats.grandTichuCalls > 0 ? `${stats.grandTichuSuccesses}/${stats.grandTichuCalls} (${grandRate}%)` : '0'}
            />
            <StatRow label="Double Victories" value={stats.doubleVictories} />
          </div>

          <div className="border-t border-gray-700 mt-3 pt-3">
            <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Advanced</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <StatRow
                label="Avg Point Diff / Round"
                value={avgPointDiff > 0 ? `+${avgPointDiff}` : String(avgPointDiff)}
              />
              <StatRow
                label="Bombs Played / Faced"
                value={`${stats.bombsPlayed} / ${stats.bombsFaced}`}
              />
              <StatRow
                label="Tichu When Behind"
                value={stats.tichuCallsWhenBehind}
              />
              <StatRow
                label="Tichu When Ahead"
                value={stats.tichuCallsWhenAhead}
              />
              <StatRow
                label="Grand When Behind"
                value={stats.grandCallsWhenBehind}
              />
              <StatRow
                label="Grand When Ahead"
                value={stats.grandCallsWhenAhead}
              />
              <StatRow
                label="Close Games"
                value={stats.closeGamesPlayed > 0
                  ? `${stats.closeGameWins}/${stats.closeGamesPlayed} (${closeGameRate}%)`
                  : '0'}
              />
              <StatRow
                label="Comebacks (down 300+)"
                value={stats.comebackOpportunities > 0
                  ? `${stats.comebackWins}/${stats.comebackOpportunities} (${comebackRate}%)`
                  : '0'}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-gray-400 text-xs">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
