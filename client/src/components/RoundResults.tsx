import { RoundResult, ClientPlayer } from '@tichu/shared';

type Props = {
  result: RoundResult;
  players: ClientPlayer[];
  onNextRound: () => void;
  isGameOver: boolean;
};

export default function RoundResults({ result, players, onNextRound, isGameOver }: Props) {
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

        <div className="grid grid-cols-2 gap-6 mb-6">
          {[0, 1].map(team => (
            <div key={team} className="text-center">
              <div className="text-sm text-gray-400">
                {players[team === 0 ? 0 : 1].name} & {players[team === 0 ? 2 : 3].name}
              </div>
              <div className="mt-2 space-y-1">
                <div className="text-sm">
                  Card points: <span className="font-bold">{result.teamScores[team]}</span>
                </div>
                {result.tichuBonuses[team] !== 0 && (
                  <div className={`text-sm ${result.tichuBonuses[team] > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Tichu: {result.tichuBonuses[team] > 0 ? '+' : ''}{result.tichuBonuses[team]}
                  </div>
                )}
                <div className="text-lg font-bold border-t border-gray-600 pt-1 mt-1">
                  Total: {result.totalScores[team]}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mb-4">
          <div className="text-sm text-gray-400">Out order</div>
          <div className="flex justify-center gap-2 mt-1">
            {result.outOrder.map((seat, i) => (
              <span key={seat} className={`text-sm ${i === 0 ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
                {i + 1}. {players[seat].name}
              </span>
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
