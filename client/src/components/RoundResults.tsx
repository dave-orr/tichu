import { RoundResult, ClientPlayer, Seat } from '@tichu/shared';

type Props = {
  result: RoundResult;
  players: ClientPlayer[];
  onNextRound: () => void;
  isGameOver: boolean;
};

function tichuLabel(call: 'small' | 'grand', made: boolean) {
  const letter = call === 'grand' ? 'G' : 'T';
  const color = made ? 'text-green-400' : 'text-red-400';
  return <span className={`${color} font-bold ml-1`}>{letter}</span>;
}

export default function RoundResults({ result, players, onNextRound, isGameOver }: Props) {
  const hasTichuBonus = result.tichuBonuses[0] !== 0 || result.tichuBonuses[1] !== 0;

  function renderTichuIndicator(seat: Seat) {
    const call = players[seat].tichuCall;
    if (call === 'none') return null;
    const made = result.outOrder[0] === seat;
    return tichuLabel(call, made);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-lg w-full">
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
        <table className="w-full mb-6 text-sm">
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
          <div className="text-sm text-gray-400 mb-2">Out order</div>
          <div className="flex flex-col items-center gap-1">
            {result.outOrder.map((seat, i) => (
              <div key={seat} className={`text-sm ${i === 0 ? 'text-yellow-400 font-bold' : 'text-gray-200'}`}>
                {i + 1}. {players[seat].name}{renderTichuIndicator(seat)}
              </div>
            ))}
          </div>
        </div>

        {isGameOver ? (
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400 mb-4">
              {result.totalScores[0] > result.totalScores[1]
                ? `${players[0].name} & ${players[2].name} Win!`
                : `${players[1].name} & ${players[3].name} Win!`
              }
            </div>
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
