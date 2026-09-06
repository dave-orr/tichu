import { useEffect, useState } from 'react';
import type { PartnerStats, GameSummary, GameHistoryRound, TeamStats, UserStats as UserStatsType } from '@tichu/shared';
import RecentGames from './RecentGames.js';
import TeamStatsModal from './TeamStatsModal.js';

type Props = {
  /** Stats loaded with the profile; shown until a fresh copy arrives. */
  stats: UserStatsType;
  myUid: string;
  fetchUserStats: () => Promise<{ stats: UserStatsType | null }>;
  fetchPartnerStats: () => Promise<{ partners: PartnerStats[] }>;
  fetchTeamStats: (partnerUid: string) => Promise<{ team: TeamStats | null }>;
  fetchRecentGames: () => Promise<{ games: GameSummary[] }>;
  fetchGameHistory: (gameId: string) => Promise<{ rounds: GameHistoryRound[] }>;
  onClose: () => void;
};

const pct = (num: number, denom: number) => (denom > 0 ? Math.round((num / denom) * 100) : 0);
/** "3/5 (60%)", or "0" when there is nothing to divide. */
const ratio = (num: number, denom: number) => (denom > 0 ? `${num}/${denom} (${pct(num, denom)}%)` : '0');

export default function UserStats({
  stats: initialStats, myUid, fetchUserStats, fetchPartnerStats, fetchTeamStats, fetchRecentGames, fetchGameHistory, onClose,
}: Props) {
  const [freshStats, setFreshStats] = useState<UserStatsType | null>(null);
  const [partners, setPartners] = useState<PartnerStats[] | null>(null);
  const [recentGames, setRecentGames] = useState<GameSummary[] | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<PartnerStats | null>(null);

  // The profile copy can be stale (it's loaded once per sign-in), so refetch on open.
  useEffect(() => {
    fetchUserStats().then(({ stats }) => { if (stats) setFreshStats(stats); }).catch(() => {});
  }, [fetchUserStats]);

  useEffect(() => {
    fetchPartnerStats().then(({ partners }) => setPartners(partners));
  }, [fetchPartnerStats]);

  useEffect(() => {
    fetchRecentGames().then(({ games }) => setRecentGames(games));
  }, [fetchRecentGames]);

  const stats = freshStats ?? initialStats;

  const avgPointDiff = stats.roundsPlayed > 0
    ? Math.round(stats.totalPointDifferential / stats.roundsPlayed)
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-xl p-4 w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-3xl font-bold text-yellow-400">Your Stats</h3>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {stats.gamesPlayed === 0 ? (
          <p className="text-gray-400 text-2xl text-center py-4">
            No games played yet. Stats will appear here after your first game.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Left column: tracked stats */}
            <div>
              <div className="flex items-baseline justify-center gap-2 mb-3 pb-3 border-b border-gray-700">
                <span className="text-5xl font-bold text-yellow-400">{stats.elo}</span>
                <span className="text-2xl text-gray-400">Elo</span>
                {stats.eloPeak > stats.elo && (
                  <span className="text-2xl text-gray-500">(peak {stats.eloPeak})</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-2xl">
                <StatRow label="Games Played" value={stats.gamesPlayed} />
                <StatRow label="Games Won" value={`${stats.gamesWon} (${pct(stats.gamesWon, stats.gamesPlayed)}%)`} />
                <StatRow label="Rounds Played" value={stats.roundsPlayed} />
                <StatRow label="First Out" value={stats.roundsWonFirstOut} />
                <StatRow label="Tichu Calls" value={ratio(stats.tichuSuccesses, stats.tichuCalls)} />
                <StatRow label="Grand Tichu" value={ratio(stats.grandTichuSuccesses, stats.grandTichuCalls)} />
                <StatRow
                  label="Tichu Call Rate"
                  value={stats.roundsPlayed > 0 ? `${pct(stats.tichuCalls, stats.roundsPlayed)}%` : '—'}
                />
                <StatRow
                  label="Grand Call Rate"
                  value={stats.roundsPlayed > 0 ? `${pct(stats.grandTichuCalls, stats.roundsPlayed)}%` : '—'}
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
                    value={`${pct(stats.tichuCallsWhenAhead200, stats.roundsWhenAhead200)}% (${stats.tichuCallsWhenAhead200}/${stats.roundsWhenAhead200})`}
                  />
                  <StatRow
                    label="Tichu Rate (behind >200)"
                    value={`${pct(stats.tichuCallsWhenBehind200, stats.roundsWhenBehind200)}% (${stats.tichuCallsWhenBehind200}/${stats.roundsWhenBehind200})`}
                  />
                  <StatRow
                    label="Grand Rate (ahead >200)"
                    value={`${pct(stats.grandCallsWhenAhead200, stats.roundsWhenAhead200)}% (${stats.grandCallsWhenAhead200}/${stats.roundsWhenAhead200})`}
                  />
                  <StatRow
                    label="Grand Rate (behind >200)"
                    value={`${pct(stats.grandCallsWhenBehind200, stats.roundsWhenBehind200)}% (${stats.grandCallsWhenBehind200}/${stats.roundsWhenBehind200})`}
                  />
                  <StatRow label="Close Games" value={ratio(stats.closeGameWins, stats.closeGamesPlayed)} />
                  <StatRow label="Comebacks (down 300+)" value={ratio(stats.comebackWins, stats.comebackOpportunities)} />
                </div>
              </div>

              {partners && partners.length > 0 && (
                <div className="border-t border-gray-700 mt-3 pt-3">
                  <h4 className="text-2xl text-gray-500 uppercase tracking-wide mb-2">By Partner</h4>
                  <div className="space-y-1">
                    {partners.map(p => (
                      <button
                        key={p.partnerUid}
                        onClick={() => setSelectedPartner(p)}
                        title="Show partnership stats"
                        className="w-full text-left flex items-center justify-between gap-3 text-2xl rounded-lg px-2 py-1 -mx-2 hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {p.partnerPhoto ? (
                            <img src={p.partnerPhoto} alt="" className="w-8 h-8 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-2xl flex-shrink-0">
                              {p.partnerName[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate">{p.partnerName}</div>
                            <div className="text-xl text-gray-400 truncate">
                              Tichu {ratio(p.partnerTichuSuccesses, p.partnerTichuCalls)}
                              {p.partnerGrandCalls > 0 && ` · Grand ${ratio(p.partnerGrandSuccesses, p.partnerGrandCalls)}`}
                              {p.partnerRounds > 0 && ` · calls ${pct(p.partnerTichuCalls + p.partnerGrandCalls, p.partnerRounds)}% of rounds`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-semibold">
                            {p.gamesWon}–{p.gamesPlayed - p.gamesWon} ({pct(p.gamesWon, p.gamesPlayed)}%)
                          </div>
                          <div className="text-xl text-gray-400">
                            {p.roundsPlayed} rounds
                            {p.teamElo != null && (
                              <> · <span className="text-yellow-300/90">{p.teamElo} Elo</span></>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column: recent games (separate card) */}
            <RecentGames games={recentGames} myUid={myUid} fetchGameHistory={fetchGameHistory} />
          </div>
        )}

        {selectedPartner && (
          <TeamStatsModal
            partnerUid={selectedPartner.partnerUid}
            partnerName={selectedPartner.partnerName}
            myUid={myUid}
            fetchTeamStats={fetchTeamStats}
            fetchGameHistory={fetchGameHistory}
            onClose={() => setSelectedPartner(null)}
          />
        )}
      </div>
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
