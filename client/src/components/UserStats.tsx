import { useEffect, useState } from 'react';
import { ACHIEVEMENTS, type AchievementCount } from '@tichu/shared';
import type { Comeback, PartnerStats, GameSummary, GameHistoryRound, TeamStats, UserStats as UserStatsType } from '@tichu/shared';
import RecentGames from './RecentGames.js';
import TeamStatsModal from './TeamStatsModal.js';
import AchievementBadge from './AchievementBadge.js';
import GameHistoryModal from './GameHistoryModal.js';

type Props = {
  /** Stats loaded with the profile; shown until a fresh copy arrives. */
  stats: UserStatsType;
  myUid: string;
  fetchUserStats: () => Promise<{ stats: UserStatsType | null }>;
  fetchPartnerStats: () => Promise<{ partners: PartnerStats[] }>;
  fetchTeamStats: (partnerUid: string) => Promise<{ team: TeamStats | null }>;
  fetchRecentGames: () => Promise<{ games: GameSummary[] }>;
  fetchComebackRecord: () => Promise<{ record: Comeback | null }>;
  fetchGameHistory: (gameId: string) => Promise<{ rounds: GameHistoryRound[] }>;
  onClose: () => void;
};

const pct = (num: number, denom: number) => (denom > 0 ? Math.round((num / denom) * 100) : 0);
/** "3/5 (60%)", or "0" when there is nothing to divide. */
const ratio = (num: number, denom: number) => (denom > 0 ? `${num}/${denom} (${pct(num, denom)}%)` : '0');

export default function UserStats({
  stats: initialStats, myUid, fetchUserStats, fetchPartnerStats, fetchTeamStats, fetchRecentGames, fetchComebackRecord, fetchGameHistory, onClose,
}: Props) {
  const [freshStats, setFreshStats] = useState<UserStatsType | null>(null);
  const [partners, setPartners] = useState<PartnerStats[] | null>(null);
  const [recentGames, setRecentGames] = useState<GameSummary[] | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<PartnerStats | null>(null);
  const [comebackRecord, setComebackRecord] = useState<Comeback | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameSummary | null>(null);

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

  useEffect(() => {
    fetchComebackRecord().then(({ record }) => setComebackRecord(record)).catch(() => {});
  }, [fetchComebackRecord]);

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
                <div className="mt-3 space-y-1">
                  <ComebackRow
                    label="Your Biggest Comeback"
                    comeback={stats.biggestComeback ?? null}
                    myUid={myUid}
                    onOpen={setSelectedGame}
                  />
                  <ComebackRow
                    label="Server Record"
                    comeback={comebackRecord}
                    myUid={myUid}
                    onOpen={setSelectedGame}
                  />
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

            {stats.achievements && (
              <div className="md:col-span-2 border-t border-gray-700 pt-3">
                <Achievements achievements={stats.achievements} onOpen={setSelectedGame} />
              </div>
            )}
          </div>
        )}

        {selectedGame && (
          <GameHistoryModal
            game={selectedGame}
            fetchGameHistory={fetchGameHistory}
            onClose={() => setSelectedGame(null)}
          />
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

/**
 * A comeback ("down 450 in round 6"), with the winners and final score. Opens
 * the game's history when the viewer played in it (history is private to its
 * players, and the server strips uids from games the viewer wasn't in).
 */
function ComebackRow({ label, comeback, myUid, onOpen }: {
  label: string;
  comeback: Comeback | null;
  myUid: string;
  onOpen: (game: GameSummary) => void;
}) {
  if (!comeback) {
    return (
      <div className="flex items-baseline justify-between gap-3 text-2xl">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-500">—</span>
      </div>
    );
  }
  const { game, team, deficit, roundNumber } = comeback;
  const winners = game.players.filter(p => p.team === team).sort((a, b) => a.seat - b.seat).map(p => p.name).join(' + ');
  const other = team === 0 ? 1 : 0;
  const date = new Date(game.finishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const canOpen = game.players.some(p => p.uid === myUid);
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-gray-400">{label}</span>
        <span className="font-semibold whitespace-nowrap">
          Down <span className="text-yellow-300">{deficit}</span> in round {roundNumber}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3 text-xl text-gray-400">
        <span className="truncate">{winners}</span>
        <span className="whitespace-nowrap">
          Won {game.finalScores[team]}–{game.finalScores[other]} · {date}
        </span>
      </div>
    </>
  );
  return canOpen ? (
    <button
      onClick={() => onOpen(game)}
      title="Show game history"
      className="block w-full text-left text-2xl rounded-lg px-2 py-1 -mx-2 hover:bg-gray-700 transition-colors"
    >
      {body}
    </button>
  ) : (
    <div className="text-2xl px-2 py-1 -mx-2">{body}</div>
  );
}

/**
 * Earned achievements only, with their counts; each opens the latest game it
 * was earned in. Unearned ones stay hidden so they're a surprise when they
 * first happen.
 */
function Achievements({ achievements, onOpen }: {
  achievements: AchievementCount[];
  onOpen: (game: GameSummary) => void;
}) {
  const byId = new Map(achievements.map(a => [a.id, a]));
  const earned = ACHIEVEMENTS
    .map(def => ({ def, a: byId.get(def.id) }))
    .filter((x): x is { def: typeof x.def; a: AchievementCount } => !!x.a && x.a.count > 0);
  return (
    <>
      <h4 className="text-2xl text-gray-500 uppercase tracking-wide mb-2">Achievements</h4>
      {earned.length === 0 ? (
        <p className="text-2xl text-gray-500">None yet. Keep playing to discover them!</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {earned.map(({ def, a }) => {
            const body = (
              <>
                <AchievementBadge id={def.id} className="w-24 h-24" hint={a.lastGame ? 'Click to see the latest game it happened in.' : undefined} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold text-yellow-400">{def.name}</span>
                    <span className="text-2xl font-black text-white">×{a.count}</span>
                  </div>
                  <div className="text-xl text-gray-300">{def.description}</div>
                </div>
              </>
            );
            const base = 'flex items-center gap-3 w-full text-left rounded-lg border border-yellow-600/60 bg-gray-900/60 px-3 py-2';
            return a.lastGame ? (
              <button
                key={def.id}
                onClick={() => onOpen(a.lastGame!)}
                className={`${base} hover:bg-gray-700 transition-colors`}
              >
                {body}
              </button>
            ) : (
              <div key={def.id} className={base}>{body}</div>
            );
          })}
        </div>
      )}
    </>
  );
}
