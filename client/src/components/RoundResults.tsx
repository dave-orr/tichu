import { RoundResult, RoundHistoryEntry, ClientPlayer, Seat } from '@tichu/shared';

type Props = {
  result: RoundResult;
  players: ClientPlayer[];
  onNextRound: () => void;
  isGameOver: boolean;
  mySeat: Seat;
  roundEndReady: Seat[];
  roundHistory: RoundHistoryEntry[];
};

function tichuLabel(call: 'small' | 'grand', made: boolean) {
  const letter = call === 'grand' ? 'G' : 'T';
  const color = made ? 'text-green-400' : 'text-red-400';
  return <span className={`${color} font-bold ml-1`}>{letter}</span>;
}

function formatScore(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}

export default function RoundResults({ result, players, onNextRound, isGameOver, mySeat, roundEndReady, roundHistory }: Props) {
  const hasTichuBonus = result.tichuBonuses[0] !== 0 || result.tichuBonuses[1] !== 0;
  const iAmReady = roundEndReady.includes(mySeat);
  const readyCount = roundEndReady.length;

  function renderTichuIndicator(seat: Seat) {
    const call = players[seat].tichuCall;
    if (call === 'none') return null;
    const made = result.outOrder[0] === seat;
    return tichuLabel(call, made);
  }

  // Past rounds = all but the last entry (which is the current round)
  const pastRounds = roundHistory.slice(0, -1);
  const showHistory = pastRounds.length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-center mb-6 text-yellow-400">
          {isGameOver ? 'Game Over!' : 'Round Complete'}
        </h2>

        {result.isDoubleVictory && (
          <div className="text-center mb-4">
            <span className="text-xl font-bold text-green-400">
              Double Victory!
            </span>
            <p className="text-gray-300">
              {players[result.doubleVictoryTeam === 0 ? 0 : 1].name} &{' '}
              {players[result.doubleVictoryTeam === 0 ? 2 : 3].name} went out 1st and 2nd!
            </p>
          </div>
        )}

        {/* Scoring table with aligned rows */}
        <table className="w-full mb-6 text-base">
          <thead>
            <tr>
              {[0, 1].map(team => (
                <th key={team} className="text-white font-semibold pb-2 w-1/2">
                  {players[team === 0 ? 0 : 1].name} & {players[team === 0 ? 2 : 3].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-center">
            <tr>
              {[0, 1].map(team => (
                <td key={team} className="py-1 text-gray-200">
                  Card points: <span className="font-bold">{result.teamScores[team]}</span>
                </td>
              ))}
            </tr>
            {hasTichuBonus && (
              <tr>
                {[0, 1].map(team => (
                  <td key={team} className={`py-1 ${
                    result.tichuBonuses[team] > 0 ? 'text-green-400' :
                    result.tichuBonuses[team] < 0 ? 'text-red-400' : 'text-gray-500'
                  }`}>
                    {result.tichuBonuses[team] !== 0
                      ? `Tichu: ${result.tichuBonuses[team] > 0 ? '+' : ''}${result.tichuBonuses[team]}`
                      : '—'}
                  </td>
                ))}
              </tr>
            )}
            <tr>
              {[0, 1].map(team => (
                <td key={team} className="pt-2 border-t border-gray-600">
                  <span className="text-lg font-bold text-white">
                    {result.totalScores[team]}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {/* Out order with tichu indicators */}
        <div className="text-center mb-6">
          <div className="text-base text-gray-400 mb-2">Out order</div>
          <div className="flex flex-col items-center gap-1">
            {result.outOrder.map((seat, i) => (
              <div key={seat} className={`text-base ${i === 0 ? 'text-yellow-400 font-bold' : 'text-gray-200'}`}>
                {i + 1}. {players[seat].name}{renderTichuIndicator(seat)}
              </div>
            ))}
          </div>
        </div>

        {/* Round history table */}
        {showHistory && (
          <div className="mb-6">
            <div className="text-base text-gray-400 text-center mb-2">Score History</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-600">
                  <th className="py-1 text-left pl-2">Rd</th>
                  <th className="py-1 text-right">
                    <span className="hidden sm:inline">{players[0].name} & {players[2].name}</span>
                    <span className="sm:hidden">T1</span>
                  </th>
                  <th className="py-1 text-right pr-2">
                    <span className="hidden sm:inline">{players[1].name} & {players[3].name}</span>
                    <span className="sm:hidden">T2</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pastRounds.map(round => (
                  <tr key={round.roundNumber} className="border-b border-gray-700/50">
                    <td className="py-1 text-gray-400 pl-2">{round.roundNumber}</td>
                    {[0, 1].map(team => (
                      <td key={team} className="py-1 text-right pr-2">
                        <span className={
                          round.roundTotal[team] > 0 ? 'text-green-400' :
                          round.roundTotal[team] < 0 ? 'text-red-400' : 'text-gray-400'
                        }>
                          {formatScore(round.roundTotal[team])}
                        </span>
                        <span className="text-gray-500 ml-1">({round.cumulativeScores[team]})</span>
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Current round */}
                <tr className="bg-gray-700/30 font-bold">
                  <td className="py-1 text-yellow-400 pl-2">{roundHistory[roundHistory.length - 1].roundNumber}</td>
                  {[0, 1].map(team => {
                    const current = roundHistory[roundHistory.length - 1];
                    return (
                      <td key={team} className="py-1 text-right pr-2">
                        <span className={
                          current.roundTotal[team] > 0 ? 'text-green-400' :
                          current.roundTotal[team] < 0 ? 'text-red-400' : 'text-gray-400'
                        }>
                          {formatScore(current.roundTotal[team])}
                        </span>
                        <span className="text-white ml-1">({current.cumulativeScores[team]})</span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {isGameOver ? (
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400 mb-4">
              {result.totalScores[0] > result.totalScores[1]
                ? `${players[0].name} & ${players[2].name} Win!`
                : `${players[1].name} & ${players[3].name} Win!`
              }
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 py-3 px-8 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold text-lg transition-colors"
            >
              New Game
            </button>
          </div>
        ) : iAmReady ? (
          <div className="text-center text-gray-400 py-3">
            Waiting for {players
              .filter(p => !roundEndReady.includes(p.seat))
              .map(p => p.name)
              .join(', ')}...
          </div>
        ) : (
          <button
            onClick={onNextRound}
            className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold text-lg transition-colors"
          >
            Next Round
          </button>
        )}
      </div>
    </div>
  );
}
