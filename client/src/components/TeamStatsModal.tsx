import { useEffect, useState } from 'react';
import type { TeamStats, StatTotals, GameHistoryRound, PairingPlayer } from '@tichu/shared';
import RecentGames from './RecentGames.js';

type Props = {
  partnerUid: string;
  partnerName: string;
  myUid: string;
  fetchTeamStats: (partnerUid: string) => Promise<{ team: TeamStats | null }>;
  fetchGameHistory: (gameId: string) => Promise<{ rounds: GameHistoryRound[] }>;
  onClose: () => void;
};

const pct = (num: number, denom: number) => (denom > 0 ? Math.round((num / denom) * 100) : 0);
/** "3/5 (60%)", or "0" when there is nothing to divide. */
const ratio = (num: number, denom: number) => (denom > 0 ? `${num}/${denom} (${pct(num, denom)}%)` : '0');
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function Avatar({ player }: { player: PairingPlayer }) {
  return player.photoURL ? (
    <img src={player.photoURL} alt="" className="w-10 h-10 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
  ) : (
    <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-2xl flex-shrink-0">
      {player.name[0]}
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

export default function TeamStatsModal({
  partnerUid, partnerName, myUid, fetchTeamStats, fetchGameHistory, onClose,
}: Props) {
  const [team, setTeam] = useState<TeamStats | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetchTeamStats(partnerUid).then(({ team }) => {
      if (!cancelled) setTeam(team);
    }).catch(() => {
      if (!cancelled) setTeam(null);
    });
    return () => { cancelled = true; };
  }, [fetchTeamStats, partnerUid]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-xl p-4 w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {team && <Avatar player={team.players[0]} />}
            {team && <Avatar player={team.players[1]} />}
            <h3 className="text-3xl font-bold text-yellow-400 truncate">
              {team ? `${team.players[0].name} + ${team.players[1].name}` : `You + ${partnerName}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {team === undefined ? (
          <div className="text-2xl text-gray-500 py-4 text-center">Loading…</div>
        ) : team === null ? (
          <div className="text-2xl text-gray-500 py-4 text-center">Couldn't load partnership stats.</div>
        ) : (
          <TeamBody team={team} myUid={myUid} fetchGameHistory={fetchGameHistory} />
        )}
      </div>
    </div>
  );
}

function TeamBody({ team, myUid, fetchGameHistory }: {
  team: TeamStats;
  myUid: string;
  fetchGameHistory: (gameId: string) => Promise<{ rounds: GameHistoryRound[] }>;
}) {
  const t = team.totals;
  const avgDiff = t.roundsPlayed > 0 ? Math.round(t.totalPointDifferential / t.roundsPlayed) : 0;
  // Show the viewer first regardless of how the server ordered the pair.
  const order: [0, 1] | [1, 0] = team.players[0].uid === myUid ? [0, 1] : [1, 0];
  const cols = order.map(i => ({ player: team.players[i], stats: team.perPlayer[i] }));

  const perPlayerRows: Array<{ label: string; value: (s: StatTotals) => string }> = [
    { label: 'Tichu', value: s => ratio(s.tichuSuccesses, s.tichuCalls) },
    { label: 'Grand Tichu', value: s => ratio(s.grandTichuSuccesses, s.grandTichuCalls) },
    { label: 'Tichu Call Rate', value: s => (s.roundsPlayed > 0 ? `${pct(s.tichuCalls, s.roundsPlayed)}%` : '—') },
    { label: 'Grand Call Rate', value: s => (s.roundsPlayed > 0 ? `${pct(s.grandTichuCalls, s.roundsPlayed)}%` : '—') },
    { label: 'First Out', value: s => ratio(s.roundsWonFirstOut, s.roundsPlayed) },
    { label: 'Bombs Played', value: s => String(s.bombsPlayed) },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <div className="flex items-baseline justify-center gap-2 mb-3 pb-3 border-b border-gray-700">
          {team.teamElo != null ? (
            <>
              <span className="text-5xl font-bold text-yellow-400">{team.teamElo}</span>
              <span className="text-2xl text-gray-400">Pairing Elo</span>
              <span className="text-2xl text-gray-500">
                ({team.teamEloGames} rated{team.teamEloPeak != null && team.teamEloPeak > team.teamElo ? `, peak ${team.teamEloPeak}` : ''})
              </span>
            </>
          ) : (
            <span className="text-2xl text-gray-500">No rated games together yet</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-2xl">
          <StatRow label="Games" value={`${t.gamesWon}–${t.gamesPlayed - t.gamesWon} (${pct(t.gamesWon, t.gamesPlayed)}%)`} />
          <StatRow label="Rounds Played" value={t.roundsPlayed} />
          <StatRow label="Avg Point Diff / Round" value={signed(avgDiff)} />
          <StatRow label="Double Victories" value={t.doubleVictories} />
          <StatRow label="Bombs Played / Faced" value={`${t.bombsPlayed} / ${t.bombsFaced}`} />
          <StatRow label="First Out (either)" value={ratio(t.roundsWonFirstOut, t.roundsPlayed)} />
          <StatRow label="Close Games" value={ratio(t.closeGameWins, t.closeGamesPlayed)} />
          <StatRow label="Comebacks (down 300+)" value={ratio(t.comebackWins, t.comebackOpportunities)} />
          <StatRow label="Tichu Rate (ahead >200)" value={`${pct(t.tichuCallsWhenAhead200, t.roundsWhenAhead200)}% (${t.tichuCallsWhenAhead200}/${t.roundsWhenAhead200})`} />
          <StatRow label="Tichu Rate (behind >200)" value={`${pct(t.tichuCallsWhenBehind200, t.roundsWhenBehind200)}% (${t.tichuCallsWhenBehind200}/${t.roundsWhenBehind200})`} />
        </div>

        <div className="border-t border-gray-700 mt-3 pt-3">
          <h4 className="text-2xl text-gray-500 uppercase tracking-wide mb-2">By Player</h4>
          <table className="w-full text-2xl">
            <thead>
              <tr className="text-gray-400">
                <th className="text-left font-normal pb-1"></th>
                {cols.map(c => (
                  <th key={c.player.uid} className="text-right font-normal pb-1 truncate">
                    {c.player.uid === myUid ? 'You' : c.player.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perPlayerRows.map(row => (
                <tr key={row.label}>
                  <td className="text-gray-400 py-0.5">{row.label}</td>
                  {cols.map(c => (
                    <td key={c.player.uid} className="text-right font-semibold py-0.5">{row.value(c.stats)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {team.opponents.length > 0 && (
          <div className="border-t border-gray-700 mt-3 pt-3">
            <h4 className="text-2xl text-gray-500 uppercase tracking-wide mb-2">Vs Opponents</h4>
            <div className="space-y-1">
              {team.opponents.map(o => (
                <div key={o.uids.join('|') || o.names} className="flex items-center justify-between gap-2 text-2xl">
                  <span className="truncate">{o.names}</span>
                  <span className="font-semibold flex-shrink-0">
                    {o.gamesWon}–{o.gamesPlayed - o.gamesWon}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <RecentGames games={team.games.slice(0, 10)} myUid={myUid} fetchGameHistory={fetchGameHistory} />
    </div>
  );
}
