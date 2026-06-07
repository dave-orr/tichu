import { useEffect, useState } from 'react';
import type { GameSummary, GameHistoryRound, GameHistoryCall } from '@tichu/shared';

type Props = {
  game: GameSummary;
  fetchGameHistory: (gameId: string) => Promise<{ rounds: GameHistoryRound[] }>;
  onClose: () => void;
};

function teamNames(game: GameSummary, team: 0 | 1): string {
  return game.players
    .filter(p => p.team === team)
    .sort((a, b) => a.seat - b.seat)
    .map(p => p.name)
    .join(' & ');
}

function CallChip({ call }: { call: GameHistoryCall }) {
  const letter = call.tichuCall === 'grand' ? 'GT' : 'T';
  const idColor = call.tichuCall === 'grand' ? 'text-blue-400' : 'text-green-400';
  return (
    <span className="inline-flex items-center gap-0.5 mr-2 whitespace-nowrap">
      <span className="text-gray-200">{call.name}</span>
      <span className={`font-bold ${idColor}`}>{letter}</span>
      <span className={call.made ? 'text-green-400' : 'text-red-500'}>{call.made ? '✓' : '✗'}</span>
    </span>
  );
}

export default function GameHistoryModal({ game, fetchGameHistory, onClose }: Props) {
  const [rounds, setRounds] = useState<GameHistoryRound[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchGameHistory(game.gameId).then(({ rounds }) => {
      if (!cancelled) setRounds(rounds);
    });
    return () => { cancelled = true; };
  }, [fetchGameHistory, game.gameId]);

  const date = new Date(game.finishedAt).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-xl p-4 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-3xl font-bold text-yellow-400">Game History</h3>
            <div className="text-xl text-gray-400">{date}</div>
          </div>
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

        {rounds === null ? (
          <div className="text-2xl text-gray-400 text-center py-6">Loading…</div>
        ) : rounds.length === 0 ? (
          <div className="text-2xl text-gray-400 text-center py-6">No round-by-round history is available for this game.</div>
        ) : (
          <table className="w-full text-2xl">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-1 pr-2">#</th>
                <th className={`text-right py-1 px-2 ${game.winningTeam === 0 ? 'text-yellow-300' : ''}`}>{teamNames(game, 0)}</th>
                <th className={`text-right py-1 px-2 ${game.winningTeam === 1 ? 'text-yellow-300' : ''}`}>{teamNames(game, 1)}</th>
                <th className="text-left py-1 pl-2">Tichu calls</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map(r => {
                const delta: [number, number] = [
                  r.roundCardPoints[0] + r.tichuBonuses[0],
                  r.roundCardPoints[1] + r.tichuBonuses[1],
                ];
                const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
                return (
                  <tr key={r.roundNumber} className="border-b border-gray-700/50 align-top">
                    <td className="py-1 pr-2 text-gray-400">
                      {r.roundNumber}
                      {r.isDoubleVictory && <span className="ml-1 text-purple-300" title="Double victory">★</span>}
                    </td>
                    <td className="py-1 px-2 text-right">
                      <span className="text-gray-300">{fmt(delta[0])}</span>
                      <span className="text-gray-500"> ({r.scoresAfterRound[0]})</span>
                    </td>
                    <td className="py-1 px-2 text-right">
                      <span className="text-gray-300">{fmt(delta[1])}</span>
                      <span className="text-gray-500"> ({r.scoresAfterRound[1]})</span>
                    </td>
                    <td className="py-1 pl-2">
                      {r.calls.length === 0
                        ? <span className="text-gray-600">—</span>
                        : r.calls.map(c => <CallChip key={c.seat} call={c} />)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="py-2 pr-2 text-gray-400">Final</td>
                <td className={`py-2 px-2 text-right ${game.winningTeam === 0 ? 'text-yellow-300' : 'text-gray-200'}`}>{game.finalScores[0]}</td>
                <td className={`py-2 px-2 text-right ${game.winningTeam === 1 ? 'text-yellow-300' : 'text-gray-200'}`}>{game.finalScores[1]}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
