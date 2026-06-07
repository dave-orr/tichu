import { useState } from 'react';
import type { GameSummary, GameHistoryRound } from '@tichu/shared';
import GameHistoryModal from './GameHistoryModal.js';

type Props = {
  games: GameSummary[] | null;
  myUid: string;
  fetchGameHistory: (gameId: string) => Promise<{ rounds: GameHistoryRound[] }>;
};

function teamNames(game: GameSummary, team: 0 | 1): string {
  return game.players
    .filter(p => p.team === team)
    .sort((a, b) => a.seat - b.seat)
    .map(p => p.name)
    .join(' & ');
}

export default function RecentGames({ games, myUid, fetchGameHistory }: Props) {
  const [selected, setSelected] = useState<GameSummary | null>(null);

  return (
    <div className="bg-gray-900/60 rounded-lg p-3">
      <h4 className="text-2xl text-gray-500 uppercase tracking-wide mb-2">Recent Games</h4>

      {games === null ? (
        <div className="text-2xl text-gray-500 py-2">Loading…</div>
      ) : games.length === 0 ? (
        <div className="text-2xl text-gray-500 py-2">No completed games yet.</div>
      ) : (
        <div className="space-y-2">
          {games.map(game => {
            const myTeam = game.players.find(p => p.uid === myUid)?.team;
            const won = myTeam != null && game.winningTeam === myTeam;
            const lost = myTeam != null && game.winningTeam != null && game.winningTeam !== myTeam;
            const date = new Date(game.finishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return (
              <button
                key={game.gameId}
                onClick={() => setSelected(game)}
                className="w-full text-left bg-gray-800 hover:bg-gray-700 rounded-lg p-2 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xl font-bold px-2 py-0.5 rounded ${
                    won ? 'bg-green-700 text-green-100' : lost ? 'bg-red-800 text-red-100' : 'bg-gray-600 text-gray-200'
                  }`}>
                    {won ? 'Won' : lost ? 'Lost' : '—'}
                  </span>
                  <span className="text-xl text-gray-400">{date}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-2xl">
                  <span className={`truncate ${myTeam === 0 ? 'text-yellow-300' : 'text-gray-200'}`}>{teamNames(game, 0)}</span>
                  <span className="font-bold text-gray-100 whitespace-nowrap">
                    {game.finalScores[0]} – {game.finalScores[1]}
                  </span>
                  <span className={`truncate text-right ${myTeam === 1 ? 'text-yellow-300' : 'text-gray-200'}`}>{teamNames(game, 1)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <GameHistoryModal
          game={selected}
          fetchGameHistory={fetchGameHistory}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
