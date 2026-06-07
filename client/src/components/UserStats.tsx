import { useEffect, useState } from 'react';
import type { PartnerStats } from '@tichu/shared';
import type { UserStats as UserStatsType } from '../hooks/useAuth.js';

type Props = {
  stats: UserStatsType;
  fetchPartnerStats: () => Promise<{ partners: PartnerStats[] }>;
  onClose: () => void;
};

export default function UserStats({ stats, fetchPartnerStats, onClose }: Props) {
  const [partners, setPartners] = useState<PartnerStats[] | null>(null);

  useEffect(() => {
    fetchPartnerStats().then(({ partners }) => setPartners(partners));
  }, [fetchPartnerStats]);

  const winRate = stats.gamesPlayed > 0
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
    : 0;
  const tichuRate = stats.tichuCalls > 0
    ? Math.round((stats.tichuSuccesses / stats.tichuCalls) * 100)
    : 0;
  const grandRate = stats.grandTichuCalls > 0
    ? Math.round((stats.grandTichuSuccesses / stats.grandTichuCalls) * 100)
    : 0;
  const pct = (num: number, denom: number) =>
    denom > 0 ? Math.round((num / denom) * 100) : 0;
  const tichuCallFreq = pct(stats.tichuCalls, stats.roundsPlayed);
  const grandCallFreq = pct(stats.grandTichuCalls, stats.roundsPlayed);
  const tichuFreqAhead200 = pct(stats.tichuCallsWhenAhead200, stats.roundsWhenAhead200);
  const tichuFreqBehind200 = pct(stats.tichuCallsWhenBehind200, stats.roundsWhenBehind200);
  const grandFreqAhead200 = pct(stats.grandCallsWhenAhead200, stats.roundsWhenAhead200);
  const grandFreqBehind200 = pct(stats.grandCallsWhenBehind200, stats.roundsWhenBehind200);
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
        <p className="text-gray-400 text-2xl text-center py-2">
          No games played yet. Stats will appear here after your first game.
        </p>
      ) : (
        <>
          <div className="flex items-baseline justify-center gap-2 mb-3 pb-3 border-b border-gray-700">
            <span className="text-5xl font-bold text-yellow-400">{stats.elo}</span>
            <span className="text-2xl text-gray-400">Elo</span>
            {stats.eloPeak > stats.elo && (
              <span className="text-2xl text-gray-500">(peak {stats.eloPeak})</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-2xl">
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
            <StatRow
              label="Tichu Call Rate"
              value={stats.roundsPlayed > 0 ? `${tichuCallFreq}%` : '—'}
            />
            <StatRow
              label="Grand Call Rate"
              value={stats.roundsPlayed > 0 ? `${grandCallFreq}%` : '—'}
            />
            <StatRow label="Double Victories" value={stats.doubleVictories} />
          </div>

          <div className="border-t border-gray-700 mt-3 pt-3">
            <h4 className="text-2xl text-gray-500 uppercase tracking-wide mb-2">Advanced</h4>
            <div className="grid grid-cols-2 gap-3 text-2xl">
              <StatRow
                label="Avg Point Diff / Round"
                value={avgPointDiff > 0 ? `+${avgPointDiff}` : String(avgPointDiff)}
              />
              <StatRow
                label="Bombs Played / Faced"
                value={`${stats.bombsPlayed} / ${stats.bombsFaced}`}
              />
              <StatRow
                label="Tichu Rate (ahead >200)"
                value={stats.roundsWhenAhead200 > 0
                  ? `${tichuFreqAhead200}% (${stats.tichuCallsWhenAhead200}/${stats.roundsWhenAhead200})`
                  : '—'}
              />
              <StatRow
                label="Tichu Rate (behind >200)"
                value={stats.roundsWhenBehind200 > 0
                  ? `${tichuFreqBehind200}% (${stats.tichuCallsWhenBehind200}/${stats.roundsWhenBehind200})`
                  : '—'}
              />
              <StatRow
                label="Grand Rate (ahead >200)"
                value={stats.roundsWhenAhead200 > 0
                  ? `${grandFreqAhead200}% (${stats.grandCallsWhenAhead200}/${stats.roundsWhenAhead200})`
                  : '—'}
              />
              <StatRow
                label="Grand Rate (behind >200)"
                value={stats.roundsWhenBehind200 > 0
                  ? `${grandFreqBehind200}% (${stats.grandCallsWhenBehind200}/${stats.roundsWhenBehind200})`
                  : '—'}
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

          {partners && partners.length > 0 && (
            <div className="border-t border-gray-700 mt-3 pt-3">
              <h4 className="text-2xl text-gray-500 uppercase tracking-wide mb-2">By Partner</h4>
              <div className="space-y-1">
                {partners.map(p => {
                  const rate = p.gamesPlayed > 0
                    ? Math.round((p.gamesWon / p.gamesPlayed) * 100)
                    : null;
                  return (
                    <div key={p.partnerUid} className="flex items-center justify-between gap-2 text-2xl">
                      <div className="flex items-center gap-2 min-w-0">
                        {p.partnerPhoto ? (
                          <img src={p.partnerPhoto} alt="" className="w-8 h-8 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-2xl flex-shrink-0">
                            {p.partnerName[0]}
                          </div>
                        )}
                        <span className="truncate">{p.partnerName}</span>
                      </div>
                      <span className="font-semibold flex-shrink-0 flex items-center gap-2">
                        {p.teamElo != null && (
                          <span className="text-yellow-300/90">{p.teamElo}</span>
                        )}
                        <span>
                          {p.gamesPlayed > 0
                            ? `${p.gamesWon}/${p.gamesPlayed} (${rate}%)`
                            : `${p.roundsPlayed} rd`}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-gray-400 text-2xl">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
