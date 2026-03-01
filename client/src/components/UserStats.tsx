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
